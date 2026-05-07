import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { PriorityBadge } from "@/components/task-badges";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, Trash2 } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Task, Member } from "@/routes/_app/projects/$projectId";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["task_status"];
const COLUMNS: { id: Status; label: string; accent: string }[] = [
  { id: "To Do", label: "To Do", accent: "bg-status-todo" },
  { id: "In Progress", label: "In Progress", accent: "bg-status-progress" },
  { id: "In Review", label: "In Review", accent: "bg-status-review" },
  { id: "Done", label: "Done", accent: "bg-status-done" },
];

export function KanbanBoard({
  tasks, members, onMove, onEdit, isAdmin, onAfterChange,
}: {
  tasks: Task[];
  members: Member[];
  onMove: (id: string, status: Status) => void;
  onEdit: (t: Task) => void;
  isAdmin: boolean;
  onAfterChange: () => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const newStatus = e.over?.id as Status | undefined;
    if (!newStatus) return;
    const t = tasks.find((x) => x.id === id);
    if (t && t.status !== newStatus) onMove(id, newStatus);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <Column key={col.id} id={col.id} label={col.label} accent={col.accent} count={colTasks.length}>
              {colTasks.map((t) => (
                <TaskCard
                  key={t.id} task={t} members={members}
                  onEdit={() => onEdit(t)} isAdmin={isAdmin} onAfterChange={onAfterChange}
                />
              ))}
            </Column>
          );
        })}
      </div>
    </DndContext>
  );
}

function Column({ id, label, accent, count, children }: { id: Status; label: string; accent: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const isEmpty = !Array.isArray(children) ? !children : (children as React.ReactNode[]).length === 0;
  return (
    <div ref={setNodeRef} className={cn("rounded-2xl bg-muted/50 p-5 transition-colors", isOver && "bg-accent")}>
      <div className="flex items-center gap-2 mb-4 px-1">
        <span className={cn("size-2 rounded-full", accent)} />
        <h3 className="text-sm font-semibold tracking-tight">{label}</h3>
        <span className="text-xs text-gray-500 ml-auto font-medium">{count}</span>
      </div>
      <div className="space-y-3 min-h-32">
        {isEmpty ? (
          <div className="rounded-xl border-2 border-dashed border-border/60 py-8 px-3 text-center">
            <p className="text-xs text-gray-500">No tasks here yet.<br />Enjoy the quiet!</p>
          </div>
        ) : children}
      </div>
    </div>
  );
}

function TaskCard({ task, members, onEdit, isAdmin, onAfterChange }: {
  task: Task; members: Member[]; onEdit: () => void; isAdmin: boolean; onAfterChange: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const assignee = members.find((m) => m.user_id === task.assigned_to);
  const overdue = task.status !== "Done" && task.due_date && isBefore(new Date(task.due_date), startOfDay(new Date()));

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) return toast.error(error.message);
    toast.success("Task deleted");
    onAfterChange();
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onEdit}
      className={cn(
        "p-4 cursor-grab active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-soft-lg transition-all duration-200 group",
        isDragging && "opacity-50",
        overdue && "border-destructive/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm leading-snug flex-1">{task.title}</p>
        {isAdmin && (
          <Button variant="ghost" size="icon" className="size-6 opacity-0 group-hover:opacity-100" onClick={handleDelete}>
            <Trash2 className="size-3" />
          </Button>
        )}
      </div>
      {task.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <PriorityBadge priority={task.priority} />
        {task.due_date && (
          <span className={cn("text-xs inline-flex items-center gap-1", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
            <Calendar className="size-3" />
            {format(new Date(task.due_date), "MMM d")}
          </span>
        )}
        {assignee && (
          <Avatar className="size-6 ml-auto">
            <AvatarFallback className="text-[10px]">
              {(assignee.profiles?.name || assignee.profiles?.email || "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </Card>
  );
}
