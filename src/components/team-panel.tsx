import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import type { Member } from "@/routes/_app/projects/$projectId";
import type { Database } from "@/integrations/supabase/types";

type Role = Database["public"]["Enums"]["member_role"];

export function TeamPanel({ projectId, members, isAdmin, currentUserId }: {
  projectId: string;
  members: Member[];
  isAdmin: boolean;
  currentUserId: string;
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["members", projectId] });

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    setAdding(true);
    const { data: profile, error: pErr } = await supabase
      .from("profiles").select("id").eq("email", email.trim().toLowerCase()).maybeSingle();
    if (pErr || !profile) {
      setAdding(false);
      return toast.error("No user found with that email. They need to sign up first.");
    }
    const { error } = await supabase.from("project_members").insert({
      project_id: projectId, user_id: profile.id, role: "Member",
    });
    setAdding(false);
    if (error) return toast.error(error.message);
    toast.success("Member added");
    setEmail("");
    refresh();
  };

  const updateRole = async (id: string, role: Role) => {
    const { error } = await supabase.from("project_members").update({ role }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("project_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Member removed");
    refresh();
  };

  return (
    <div className="space-y-6">
      {isAdmin && (
        <form onSubmit={invite} className="flex gap-2">
          <Input
            type="email" required placeholder="teammate@company.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" disabled={adding}>
            <UserPlus className="size-4" /> {adding ? "Adding..." : "Add"}
          </Button>
        </form>
      )}

      <ul className="divide-y">
        {members.map((m) => {
          const name = m.profiles?.name || m.profiles?.email || "Unknown";
          const isSelf = m.user_id === currentUserId;
          return (
            <li key={m.id} className="py-3 flex items-center gap-3">
              <Avatar className="size-9">
                <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{name} {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}</p>
                <p className="text-xs text-muted-foreground truncate">{m.profiles?.email}</p>
              </div>
              {isAdmin && !isSelf ? (
                <>
                  <Select value={m.role} onValueChange={(v) => updateRole(m.id, v as Role)}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => remove(m.id)} aria-label="Remove">
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <Badge variant="secondary">{m.role}</Badge>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
