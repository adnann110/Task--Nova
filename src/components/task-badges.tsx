import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["task_status"];
type Priority = Database["public"]["Enums"]["task_priority"];

const pill = "rounded-full px-2.5 py-0.5 text-xs font-medium border-transparent";

const statusStyles: Record<Status, string> = {
  "To Do": "bg-slate-100 text-slate-700",
  "In Progress": "bg-blue-100 text-blue-800",
  "In Review": "bg-amber-100 text-amber-800",
  "Done": "bg-emerald-100 text-emerald-800",
};

const priorityStyles: Record<Priority, string> = {
  Low: "bg-slate-100 text-slate-700",
  Medium: "bg-amber-100 text-amber-800",
  High: "bg-rose-100 text-rose-800",
};

export function StatusBadge({ status }: { status: Status }) {
  return <Badge variant="outline" className={`${pill} ${statusStyles[status]}`}>{status}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant="outline" className={`${pill} ${priorityStyles[priority]}`}>{priority}</Badge>;
}
