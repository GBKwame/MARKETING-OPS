import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format, isPast } from "date-fns";
import { CheckCircle2, Circle, Clock, Plus, Calendar, GripVertical } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Todo } from "@/lib/store";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/todo")({
  head: () => ({
    meta: [
      { title: "To Do — Zexpand" },
      { name: "description", content: "Assigned future marketing activities across the team." },
      { property: "og:title", content: "Zexpand — To Do" },
      { property: "og:description", content: "Track upcoming marketing work by assignee and due date." },
    ],
  }),
  component: TodoPage,
});

const STATUSES: { key: Todo["status"]; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

function TodoPage() {
  const { currentUser, todos, members, memberById, setTodoStatus, createTodo } = useStore();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Drag and Drop State
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<Todo["status"] | null>(null);

  const canCreateTodo = currentUser?.role === "admin" || currentUser?.role === "manager";

  // Filter tasks based on user role (Marketers only see their assigned/created tasks)
  const visibleTodos = todos.filter((t) => {
    if (!currentUser) return true;
    if (currentUser.role === "admin" || currentUser.role === "manager") {
      return true; // Admins and Managers see all workspace tasks
    }
    // Marketer sees only tasks assigned to them or created by them
    return t.assigneeId === currentUser.id || (t as any).createdById === currentUser.id;
  });

  const defaultAssignee = members[0]?.id || "u-admin";
  const defaultDueDate = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];

  const [form, setForm] = useState({
    title: "",
    assigneeId: defaultAssignee,
    dueDate: defaultDueDate,
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return;
    setSubmitting(true);
    try {
      await createTodo(
        form.title,
        form.assigneeId || defaultAssignee,
        form.dueDate || defaultDueDate,
        form.notes
      );
      setOpen(false);
      setForm({
        title: "",
        assigneeId: defaultAssignee,
        dueDate: defaultDueDate,
        notes: "",
      });
    } catch (err) {
      console.error("Create todo error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="To Do"
        description="Assigned upcoming marketing activities. Drag and drop tasks between columns to update status."
        actions={
          canCreateTodo ? (
            <Button
              size="sm"
              className="gap-1.5 cursor-pointer font-semibold shadow-xs"
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  assigneeId: prev.assigneeId || members[0]?.id || "u-admin",
                }));
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New task
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        {STATUSES.map((s) => {
          const items = visibleTodos.filter((t) => t.status === s.key);
          const isTargetOver = dragOverStatus === s.key;
          return (
            <div
              key={s.key}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOverStatus(s.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverStatus(null);
                }
              }}
              onDrop={async (e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId || (window as any).__draggedTaskId;
                if (taskId) {
                  try {
                    await setTodoStatus(taskId, s.key);
                    toast.success(`Task moved to ${s.label}`);
                  } catch (err) {
                    toast.error("Failed to move task");
                  }
                }
                setDragOverStatus(null);
                setDraggedTaskId(null);
                (window as any).__draggedTaskId = null;
              }}
              className={cn(
                "rounded-2xl border bg-card p-4 shadow-xs transition-all duration-200 flex flex-col justify-between min-h-[360px]",
                isTargetOver && "border-primary bg-primary/5 ring-2 ring-primary/20 scale-[1.01]"
              )}
            >
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <span>{s.label}</span>
                  </div>
                  <Badge variant="secondary" className="h-5">
                    {items.length}
                  </Badge>
                </div>

                <div className="space-y-2.5">
                  {items.map((t) => {
                    const m = memberById(t.assigneeId);
                    const overdue = s.key !== "done" && t.dueDate && isPast(new Date(t.dueDate));
                    const isBeingDragged = draggedTaskId === t.id;
                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", t.id);
                          setDraggedTaskId(t.id);
                          (window as any).__draggedTaskId = t.id;
                        }}
                        onDragEnd={() => {
                          setDraggedTaskId(null);
                          setDragOverStatus(null);
                        }}
                        className={cn(
                          "rounded-xl border bg-background p-3.5 transition-all cursor-grab active:cursor-grabbing hover:border-primary/50 shadow-2xs hover:shadow-sm",
                          t.status === "done" && "opacity-80 bg-muted/30",
                          isBeingDragged && "opacity-40 border-dashed border-primary"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical
                            className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0 mt-0.5"
                          />
                          <button
                            onClick={() =>
                              setTodoStatus(
                                t.id,
                                t.status === "done" ? "todo" : t.status === "todo" ? "in_progress" : "done"
                              )
                            }
                            className="mt-0.5 cursor-pointer"
                            title="Toggle status"
                          >
                            {t.status === "done" ? (
                              <CheckCircle2 className="h-4 w-4 text-[color:var(--success)]" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div
                              className={cn(
                                "text-sm font-medium leading-snug",
                                t.status === "done" && "text-muted-foreground line-through"
                              )}
                            >
                              {t.title}
                            </div>
                            {t.notes && (
                              <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                {t.notes}
                              </div>
                            )}
                            <div className="mt-2.5 flex items-center justify-between border-t pt-2">
                              {m && (
                                <div className="flex items-center gap-1.5">
                                  <Avatar className="h-5 w-5">
                                    <AvatarFallback className="text-[9px] font-semibold">
                                      {m.avatar}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs text-muted-foreground">
                                    {m.name.split(" ")[0]}
                                  </span>
                                </div>
                              )}
                              {t.dueDate && (
                                <div
                                  className={cn(
                                    "flex items-center gap-1 text-xs",
                                    overdue
                                      ? "text-destructive font-semibold"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(t.dueDate), "d MMM")}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {items.length === 0 && (
                    <div
                      className={cn(
                        "rounded-xl border border-dashed py-10 text-center text-xs text-muted-foreground transition-colors",
                        isTargetOver ? "border-primary text-primary font-semibold" : "border-border/60"
                      )}
                    >
                      {isTargetOver ? `Drop to move to ${s.label}` : "Nothing here"}
                    </div>
                  )}
                </div>
              </div>

              {isTargetOver && items.length > 0 && (
                <div className="mt-2 text-center text-[11px] font-semibold text-primary animate-pulse">
                  Drop to move to {s.label}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New Task Dialog Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[480px] max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Task Title</label>
                <Input
                  required
                  placeholder="e.g. Post in Caregiver Jobs Ghana"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Assignee</label>
                  <select
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.assigneeId}
                    onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Due Date</label>
                  <div className="relative mt-1">
                    <Input
                      id="todo-due-date-input"
                      type="date"
                      required
                      value={form.dueDate}
                      onClick={(e) => {
                        if ("showPicker" in e.currentTarget) {
                          try { e.currentTarget.showPicker(); } catch {}
                        }
                      }}
                      onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                      className="h-9 w-full pr-9 font-medium cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none dark:[color-scheme:dark] [color-scheme:light]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById("todo-due-date-input") as HTMLInputElement;
                        if (el && "showPicker" in el) {
                          try { el.showPicker(); } catch {}
                        }
                      }}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer pointer-events-auto transition-colors"
                      title="Pick Date"
                    >
                      <Calendar className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Notes / Instructions</label>
                <textarea
                  rows={3}
                  placeholder="Add any specific guidelines or requirements..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}