"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AccessLevel = "View Only" | "Editor" | "Full Access";
type Staff = { id: string; name: string; email: string; accessLevel: AccessLevel; createdAt?: string };
type Profile = { name: string; email: string };
type ProfileDraft = Profile & { currentPassword: string; newPassword: string };
type StaffDraft = { name: string; email: string; password: string; accessLevel: AccessLevel };
const emptyStaff: StaffDraft = { name: "", email: "", password: "", accessLevel: "View Only" };

export function SettingsManager() {
  const [profile, setProfile] = useState<ProfileDraft>({ name: "", email: "", currentPassword: "", newPassword: "" });
  const [staff, setStaff] = useState<Staff[]>([]);
  const [newStaff, setNewStaff] = useState<StaffDraft>(emptyStaff);
  const [editingId, setEditingId] = useState("");
  const [editing, setEditing] = useState<StaffDraft>(emptyStaff);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingStaff, setSavingStaff] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profileResponse, staffResponse] = await Promise.all([
        fetch("/api/admin/settings"),
        fetch("/api/admin/staff"),
      ]);
      const profileData = (await profileResponse.json()) as { profile?: Profile; error?: string };
      const staffData = (await staffResponse.json()) as { staff?: Staff[]; error?: string };
      if (!profileResponse.ok) throw new Error(profileData.error ?? "Unable to load admin profile.");
      if (!staffResponse.ok) throw new Error(staffData.error ?? "Unable to load staff.");
      setProfile((current) => ({ ...current, ...profileData.profile }));
      setStaff(staffData.staff ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = (await response.json()) as { profile?: Profile; error?: string };
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to update profile.");
      if (data.profile) setProfile((current) => ({ ...current, ...data.profile, currentPassword: "", newPassword: "" }));
      setNotice("Admin profile updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function createStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingStaff(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStaff),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to create staff member.");
      setNewStaff(emptyStaff);
      setNotice("Staff member created.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create staff member.");
    } finally {
      setSavingStaff(false);
    }
  }

  async function saveStaff(id: string) {
    setSavingStaff(true);
    setError("");
    try {
      const updates = { ...editing, password: editing.password || undefined };
      const response = await fetch(`/api/admin/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to update staff member.");
      setEditingId("");
      setNotice("Staff member updated.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update staff member.");
    } finally {
      setSavingStaff(false);
    }
  }

  async function deleteStaff(member: Staff) {
    if (!window.confirm(`Delete staff account ${member.email}?`)) return;
    setError("");
    try {
      const response = await fetch(`/api/admin/staff/${member.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to delete staff member.");
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete staff member.");
    }
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-medium text-brand-olive">Administration</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-muted-foreground">Manage your profile and staff access.</p>
      </div>
      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-md bg-brand-olive/10 p-3 text-sm text-brand-olive">{notice}</p>}

      <Card>
        <CardHeader><CardTitle>Admin profile</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">Name<Input required maxLength={120} value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} /></label>
            <label className="space-y-2 text-sm font-medium">Email<Input required type="email" autoComplete="email" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} /></label>
            <label className="space-y-2 text-sm font-medium">Current password <span className="font-normal text-muted-foreground">· required to change email/password</span><Input type="password" autoComplete="current-password" value={profile.currentPassword} onChange={(event) => setProfile((current) => ({ ...current, currentPassword: event.target.value }))} /></label>
            <label className="space-y-2 text-sm font-medium">New password <span className="font-normal text-muted-foreground">· optional, minimum 12 characters</span><Input type="password" autoComplete="new-password" minLength={12} value={profile.newPassword} onChange={(event) => setProfile((current) => ({ ...current, newPassword: event.target.value }))} /></label>
            <Button type="submit" disabled={savingProfile || loading} className="sm:col-span-2">{savingProfile ? "Saving..." : "Save profile"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Staff access</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={createStaff} className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-2 text-sm font-medium">Name<Input required maxLength={120} value={newStaff.name} onChange={(event) => setNewStaff((current) => ({ ...current, name: event.target.value }))} /></label>
            <label className="space-y-2 text-sm font-medium">Email<Input required type="email" value={newStaff.email} onChange={(event) => setNewStaff((current) => ({ ...current, email: event.target.value }))} /></label>
            <label className="space-y-2 text-sm font-medium">Password<Input required type="password" minLength={12} value={newStaff.password} onChange={(event) => setNewStaff((current) => ({ ...current, password: event.target.value }))} /></label>
            <label className="space-y-2 text-sm font-medium">Access level<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={newStaff.accessLevel} onChange={(event) => setNewStaff((current) => ({ ...current, accessLevel: event.target.value as AccessLevel }))}><option>View Only</option><option>Editor</option><option>Full Access</option></select></label>
            <Button type="submit" disabled={savingStaff} className="self-end"><UserPlus aria-hidden="true" className="mr-2 size-4" />Add staff</Button>
          </form>
          {loading ? <p role="status" className="py-6 text-sm text-muted-foreground">Loading staff...</p> : (
            <div className="divide-y">
              {staff.map((member) => (
                <div key={member.id} className="py-4">
                  {editingId === member.id ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <Input aria-label="Staff name" value={editing.name} onChange={(event) => setEditing((current) => ({ ...current, name: event.target.value }))} />
                      <Input aria-label="Staff email" type="email" value={editing.email} onChange={(event) => setEditing((current) => ({ ...current, email: event.target.value }))} />
                      <Input aria-label="Reset staff password (optional)" type="password" minLength={12} placeholder="New password (optional)" value={editing.password} onChange={(event) => setEditing((current) => ({ ...current, password: event.target.value }))} />
                      <select aria-label="Staff access level" className="h-10 rounded-md border border-input bg-background px-3" value={editing.accessLevel} onChange={(event) => setEditing((current) => ({ ...current, accessLevel: event.target.value as AccessLevel }))}><option>View Only</option><option>Editor</option><option>Full Access</option></select>
                      <div className="flex gap-2"><Button size="sm" disabled={savingStaff} onClick={() => void saveStaff(member.id)}>Save</Button><Button size="sm" variant="outline" onClick={() => setEditingId("")}>Cancel</Button></div>
                    </div>
                  ) : (
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div><p className="font-medium">{member.name}</p><p className="text-sm text-muted-foreground">{member.email}</p><span className="mt-2 inline-flex rounded-full bg-muted px-2.5 py-1 text-xs">{member.accessLevel}</span></div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          setEditingId(member.id);
                          setEditing({ name: member.name, email: member.email, password: "", accessLevel: member.accessLevel });
                        }}><Pencil aria-hidden="true" className="mr-2 size-3.5" />Edit</Button>
                        <Button size="icon" variant="ghost" aria-label={`Delete ${member.email}`} onClick={() => void deleteStaff(member)}><Trash2 aria-hidden="true" className="size-4 text-destructive" /></Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
