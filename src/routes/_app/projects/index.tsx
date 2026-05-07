import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, FolderKanban } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/projects/")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, project_members(count), tasks(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("projects").insert({
        title,
        description: description || null,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project created");
      qc.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      setTitle("");
      setDescription("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <div className="p-6 lg:p-12 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-10 gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Projects</h1>
          <p className="text-gray-500 mt-2">All projects you're part of.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg"><Plus className="size-4" /> New project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create project</DialogTitle></DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : projects.length === 0 ? (
        <Card className="p-16 text-center">
          <div className="mx-auto size-16 rounded-2xl bg-accent grid place-items-center mb-4">
            <FolderKanban className="size-8 text-primary" />
          </div>
          <h3 className="font-bold text-lg">No projects yet</h3>
          <p className="text-sm text-gray-500 mt-1.5">Create your first project to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => {
            const memberCount = (p.project_members as unknown as { count: number }[])?.[0]?.count ?? 0;
            const taskCount = (p.tasks as unknown as { count: number }[])?.[0]?.count ?? 0;
            return (
              <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }}>
                <Card className="p-6 hover:-translate-y-1 hover:shadow-soft-lg transition-all duration-200 h-full">
                  <h3 className="font-bold tracking-tight text-lg">{p.title}</h3>
                  {p.description && (
                    <p className="text-sm text-gray-500 mt-1.5 line-clamp-2">{p.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-5 text-xs text-gray-500">
                    <span>{memberCount} member{memberCount !== 1 && "s"}</span>
                    <span>{taskCount} task{taskCount !== 1 && "s"}</span>
                    <span className="ml-auto">{format(new Date(p.created_at), "MMM d")}</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
