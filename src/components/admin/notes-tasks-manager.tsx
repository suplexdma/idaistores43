"use client";

import { useCallback, useEffect, useState } from "react";
import { Pin, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Assignee = { id: string; name: string };
type RecordItem = {
  id: string;
  kind: "note" | "task";
  title: string;
  content: string;
  dueDate: string | null;
  completed: boolean;
  assignee: Assignee | null;
  favorite: boolean;
  pinned: boolean;
};
type Staff = { id: string; name: string };
type Draft = {
  kind: "note" | "task";
  title: string;
  content: string;
  dueDate: string;
  completed: boolean;
  assignee: string;
};
const emptyDraft: Draft = { kind: "note", title: "", content: "", dueDate: "", completed: false, assignee: "" };

export function NotesTasksManager() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/notes-tasks");
      const data = (await response.json()) as { records?: RecordItem[]; staff?: Staff[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to load records.");
      setRecords(data.records ?? []);
      setStaff(data.staff ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  function startEditing(record: RecordItem) {
    setEditingId(record.id);
    setDraft({
      kind: record.kind,
      title: record.title,
      content: record.content,
      dueDate: record.dueDate ? new Date(record.dueDate).toISOString().slice(0, 10) : "",
      completed: record.completed,
      assignee: record.assignee?.id ?? "",
    });
  }

  async function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      kind: draft.kind,
      title: draft.title.trim(),
      content: draft.content,
      dueDate: draft.kind === "task" && draft.dueDate ? new Date(`${draft.dueDate}T23:59:59`).toISOString() : null,
      completed: draft.kind === "task" ? draft.completed : false,
      assignee: draft.kind === "task" && draft.assignee ? draft.assignee : null,
    };
    try {
      const response = await fetch(editingId ? `/api/admin/notes-tasks?id=${editingId}` : "/api/admin/notes-tasks", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to save record.");
      setDraft(emptyDraft);
      setEditingId("");
      await loadRecords();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save record.");
    } finally {
      setSaving(false);
    }
  }

  async function updateFlag(record: RecordItem, field: "favorite" | "pinned") {
    setError("");
    try {
      const response = await fetch(`/api/admin/notes-tasks?id=${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !record[field] }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to update record.");
      await loadRecords();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update record.");
    }
  }

  async function deleteRecord(record: RecordItem) {
    if (!window.confirm(`Move “${record.title}” to Trash?`)) return;
    setError("");
    try {
      const response = await fetch(`/api/admin/notes-tasks?id=${record.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to move record to Trash.");
      await loadRecords();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to move record to Trash.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-brand-olive">Workspace</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Notes &amp; Tasks</h1>
        <p className="mt-2 text-muted-foreground">Shared with admins who have access.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>{editingId ? "Edit item" : "Add a note or task"}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveRecord} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              Type
              <select className="h-10 w-full rounded-md border border-input bg-background px-3" value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as Draft["kind"] }))}>
                <option value="note">Note</option>
                <option value="task">Task</option>
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Title
              <Input required maxLength={180} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Details
              <textarea rows={4} maxLength={10000} value={draft.content} onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </label>
            {draft.kind === "task" && (
              <>
                <label className="space-y-2 text-sm font-medium">
                  Due date
                  <Input type="date" value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Assignee
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3" value={draft.assignee} onChange={(event) => setDraft((current) => ({ ...current, assignee: event.target.value }))}>
                    <option value="">Unassigned</option>
                    {staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input type="checkbox" checked={draft.completed} onChange={(event) => setDraft((current) => ({ ...current, completed: event.target.checked }))} className="size-4 accent-brand-olive" />
                  Completed
                </label>
              </>
            )}
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Add item"}</Button>
              {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(""); setDraft(emptyDraft); }}>Cancel</Button>}
            </div>
          </form>
        </CardContent>
      </Card>
      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {loading ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading notes and tasks...</p> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {records.map((record) => (
            <Card key={record.id} className={record.pinned ? "border-brand-gold/60" : ""}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-olive">{record.kind}</p>
                  <CardTitle className="mt-1 text-base">{record.title}</CardTitle>
                </div>
                <div className="flex">
                  <Button type="button" size="icon" variant="ghost" aria-label={record.favorite ? "Remove favorite" : "Add favorite"} aria-pressed={record.favorite} onClick={() => void updateFlag(record, "favorite")}>
                    <Star aria-hidden="true" className={`size-4 ${record.favorite ? "fill-brand-gold text-brand-gold" : ""}`} />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" aria-label={record.pinned ? "Unpin item" : "Pin item"} aria-pressed={record.pinned} onClick={() => void updateFlag(record, "pinned")}>
                    <Pin aria-hidden="true" className={`size-4 ${record.pinned ? "fill-brand-gold text-brand-gold" : ""}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {record.content && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{record.content}</p>}
                {record.kind === "task" && (
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{record.completed ? "Completed" : "Pending"}</span>
                    {record.dueDate && <span>Due {new Date(record.dueDate).toLocaleDateString()}</span>}
                    {record.assignee && <span>Assigned to {record.assignee.name}</span>}
                  </div>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => startEditing(record)}>Edit</Button>
                  <Button type="button" size="sm" variant="ghost" aria-label={`Move ${record.title} to Trash`} onClick={() => void deleteRecord(record)}><Trash2 aria-hidden="true" className="size-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {records.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground lg:col-span-2">No notes or tasks yet.</p>}
        </div>
      )}
    </div>
  );
}
