import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ListTodo, AlertCircle, Calendar } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import { StatusBadge, PriorityBadge } from "@/components/task-badges";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const userId = user?.id;

  const { data: tasks = [] } = useQuery({
    queryKey: ["my-tasks", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, projects(title)")
        .eq("assigned_to", userId!)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const today = startOfDay(new Date());
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "Done").length;
  const overdue = tasks.filter((t) => t.status !== "Done" && t.due_date && isBefore(new Date(t.due_date), today)).length;
  const upcoming = tasks.filter((t) => t.status !== "Done").slice(0, 6);

  const stats = [
    { label: "My Tasks", value: total, icon: ListTodo, color: "text-status-progress" },
    { label: "Completed", value: completed, icon: CheckCircle2, color: "text-status-done" },
    { label: "Overdue", value: overdue, icon: AlertCircle, color: "text-destructive" },
  ];

  return (
    <div className="p-6 lg:p-12 max-w-6xl mx-auto">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome back, {user?.user_metadata?.name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-gray-500 mt-2 text-base">Here's what's on your plate today.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
        {stats.map((s) => (
          <Card key={s.label} className="p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-soft-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">{s.label}</p>
              <div className="size-9 rounded-xl bg-accent grid place-items-center">
                <s.icon className={`size-4 ${s.color}`} />
              </div>
            </div>
            <p className="text-4xl font-bold mt-3 tracking-tight">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold tracking-tight">Upcoming tasks</h2>
          <Badge variant="secondary" className="rounded-full">{upcoming.length}</Badge>
        </div>
        {upcoming.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto size-14 rounded-2xl bg-accent grid place-items-center mb-3">
              <CheckCircle2 className="size-7 text-primary" />
            </div>
            <p className="font-semibold">All caught up!</p>
            <p className="text-sm text-gray-500 mt-1">No upcoming tasks. Enjoy the quiet. 🎉</p>
          </div>
        ) : (
          <ul className="divide-y">
            {upcoming.map((t) => {
              const od = t.due_date && isBefore(new Date(t.due_date), today);
              return (
                <li key={t.id} className="py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: t.project_id }}
                      className="font-medium hover:underline truncate block"
                    >
                      {t.title}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate">
                      {(t.projects as { title: string } | null)?.title}
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <StatusBadge status={t.status} />
                    <PriorityBadge priority={t.priority} />
                  </div>
                  {t.due_date && (
                    <div className={`flex items-center gap-1 text-xs ${od ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      <Calendar className="size-3" />
                      {format(new Date(t.due_date), "MMM d")}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
