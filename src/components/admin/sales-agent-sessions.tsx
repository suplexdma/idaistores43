"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Message = { index: number; role: "user" | "assistant" | "tool"; content: string; createdAt: string };
type Session = {
  id: string;
  sessionId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
};

function formatPKT(value: string) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Karachi",
  }).format(new Date(value)) + " PKT";
}

export function SalesAgentSessions({ canDelete }: { canDelete: boolean }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/sales-agent");
      const data = (await response.json()) as { sessions?: Session[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to load AI sessions.");
      setSessions(data.sessions ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load AI sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  async function remove(payload: { action: "all" } | { action: "session"; id: string } | { action: "message"; id: string; index: number }) {
    setBusy(payload.action === "all" ? "all" : payload.id);
    setError("");
    try {
      const response = await fetch("/api/admin/sales-agent", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to delete AI session data.");
      await loadSessions();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete AI session data.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-brand-olive">Customer support</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">AI Sales Agent</h1>
          <p className="mt-2 text-muted-foreground">Conversation log with timestamps in Pakistan Standard Time.</p>
        </div>
        <Button
          variant="destructive"
          disabled={!canDelete || sessions.length === 0 || busy !== ""}
          onClick={() => {
            if (window.confirm(`Permanently delete all ${sessions.length} AI sessions? This cannot be undone.`)) {
              void remove({ action: "all" });
            }
          }}
        >
          Delete All Sessions
        </Button>
      </div>
      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {loading ? (
        <p role="status" className="py-10 text-center text-sm text-muted-foreground">Loading conversations...</p>
      ) : sessions.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No AI conversations have been recorded.</CardContent></Card>
      ) : (
        sessions.map((session) => (
          <Card key={session.id}>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Session {session.sessionId}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Updated {formatPKT(session.updatedAt)} · Started {formatPKT(session.createdAt)}</p>
              </div>
              {canDelete && <Button
                size="sm"
                variant="outline"
                disabled={busy !== ""}
                onClick={() => {
                  if (window.confirm("Delete this entire AI session?")) void remove({ action: "session", id: session.id });
                }}
              >
                Delete Session
              </Button>}
            </CardHeader>
            <CardContent className="space-y-3">
              {session.messages.map((message) => (
                <article key={`${message.index}-${message.createdAt}`} className="rounded-lg border bg-muted/20 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-olive">{message.role}</p>
                    <time className="text-xs text-muted-foreground">{formatPKT(message.createdAt)}</time>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                  <div className="mt-2 flex justify-end">
                    {canDelete && <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy !== ""}
                      onClick={() => {
                        if (window.confirm("Delete this message? The session will remain.")) {
                          void remove({ action: "message", id: session.id, index: message.index });
                        }
                      }}
                    >
                      Delete Message
                    </Button>}
                  </div>
                </article>
              ))}
              {session.messages.length === 0 && <p className="text-sm text-muted-foreground">This session has no messages.</p>}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
