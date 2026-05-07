
-- Enums
CREATE TYPE public.member_role AS ENUM ('Admin', 'Member');
CREATE TYPE public.task_status AS ENUM ('To Do', 'In Progress', 'In Review', 'Done');
CREATE TYPE public.task_priority AS ENUM ('Low', 'Medium', 'High');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Project members
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.member_role NOT NULL DEFAULT 'Member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'To Do',
  priority public.task_priority NOT NULL DEFAULT 'Medium',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Security definer helpers (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_admin(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id AND role = 'Admin'
  );
$$;

-- Profile autocreate trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-add creator as Admin member
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'Admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_created
AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();

-- ============= RLS POLICIES =============

-- Profiles: any signed-in user can read (for member pickers); update own
CREATE POLICY "profiles_select_authenticated" ON public.profiles
FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update_self" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "profiles_insert_self" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Projects
CREATE POLICY "projects_select_members" ON public.projects
FOR SELECT TO authenticated
USING (public.is_project_member(id, auth.uid()));

CREATE POLICY "projects_insert_self" ON public.projects
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "projects_update_admin" ON public.projects
FOR UPDATE TO authenticated
USING (public.is_project_admin(id, auth.uid()));

CREATE POLICY "projects_delete_admin" ON public.projects
FOR DELETE TO authenticated
USING (public.is_project_admin(id, auth.uid()));

-- Project members
CREATE POLICY "members_select_members" ON public.project_members
FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

-- Allow insert when (a) user is admin of project, OR (b) the trigger inserts the creator as the first admin.
-- Since the trigger runs SECURITY DEFINER it bypasses RLS, so we only need admin path here.
CREATE POLICY "members_insert_admin" ON public.project_members
FOR INSERT TO authenticated
WITH CHECK (public.is_project_admin(project_id, auth.uid()));

CREATE POLICY "members_update_admin" ON public.project_members
FOR UPDATE TO authenticated
USING (public.is_project_admin(project_id, auth.uid()));

CREATE POLICY "members_delete_admin" ON public.project_members
FOR DELETE TO authenticated
USING (public.is_project_admin(project_id, auth.uid()));

-- Tasks
CREATE POLICY "tasks_select_members" ON public.tasks
FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "tasks_insert_members" ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "tasks_update_members" ON public.tasks
FOR UPDATE TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "tasks_delete_admin" ON public.tasks
FOR DELETE TO authenticated
USING (public.is_project_admin(project_id, auth.uid()));
