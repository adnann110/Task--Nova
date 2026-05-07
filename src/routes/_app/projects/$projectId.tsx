import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, ArrowLeft, Trash2, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TaskDialog } from "@/components/task-dialog";
import { KanbanBoard } from "@/components/kanban-board";
import { TeamPanel } from "@/components/team-panel";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Database } from "@/integrations/supabase/types";

export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Member = Database["public"]["Tables"]["project_members"]["Row"] & {
  profiles: Database["public"]["Tables"]["profiles"]["Row"] | null;
};

export const Route = createFileRoute("/_app/projects/$projectId")({
  component: ProjectDetail,
});

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [taskOpen, setTaskOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_members").select("*").eq("project_id", projectId);
      if (error) throw error;
      const ids = data.map((m) => m.user_id);
      if (ids.length === 0) return [] as Member[];
      const { data: profs, error: pErr } = await supabase
        .from("profiles").select("*").in("id", ids);
      if (pErr) throw pErr;
      return data.map((m) => ({
        ...m,
        profiles: profs?.find((p) => p.id === m.user_id) ?? null,
      })) as Member[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const myRole = useMemo(
    () => members.find((m) => m.user_id === user?.id)?.role,
    [members, user?.id],
  );
  const isAdmin = myRole === "Admin";

  const deleteProject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project deleted");
      navigate({ to: "/projects" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Database["public"]["Enums"]["task_status"] }) => {
      const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!project) return <div className="p-10 text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <Link to="/projects" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="size-3" /> Projects
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight truncate">{project.title}</h1>
          {project.description && <p className="text-muted-foreground mt-1">{project.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex -space-x-2">
            {members.slice(0, 4).map((m) => (
              <Avatar key={m.id} className="size-8 border-2 border-background">
                <AvatarFallback className="text-xs">
                  {(m.profiles?.name || m.profiles?.email || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Delete project">
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the project and all its tasks. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteProject.mutate()}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="board">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="team">Team ({members.length})</TabsTrigger>
          </TabsList>
          <Button onClick={() => { setEditTask(null); setTaskOpen(true); }}>
            <Plus className="size-4" /> New task
          </Button>
        </div>

        <TabsContent value="board">
          <KanbanBoard
            tasks={tasks}
            members={members}
            onMove={(id, status) => updateTaskStatus.mutate({ id, status })}
            onEdit={(t) => { setEditTask(t); setTaskOpen(true); }}
            isAdmin={isAdmin}
            onAfterChange={() => qc.invalidateQueries({ queryKey: ["tasks", projectId] })}
          />
        </TabsContent>

        <TabsContent value="team">
          <Card className="p-6">
            <TeamPanel projectId={projectId} members={members} isAdmin={isAdmin} currentUserId={user?.id ?? ""} />
            {!isAdmin && (
              <p className="text-xs text-muted-foreground mt-4 inline-flex items-center gap-1">
                <UserPlus className="size-3" /> Only admins can manage members.
              </p>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <TaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        projectId={projectId}
        members={members}
        task={editTask}
        onSaved={() => qc.invalidateQueries({ queryKey: ["tasks", projectId] })}
      />
    </div>
  );
}
