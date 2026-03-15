"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Settings, Loader2, UserPlus, Trash2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  updateWorkspace,
  inviteWorkspaceMember,
  listWorkspaceMembers,
  updateMemberRole,
  removeMember,
  leaveWorkspace,
} from "@/actions/workspace";

interface WorkspaceSettingsDialogProps {
  workspaceId: string;
  workspaceName: string;
  workspaceDescription?: string | null;
  workspaceKind: string;
  currentUserRole: string;
}

type Member = {
  memberId: string;
  userId: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  joinedAt: Date | null;
};

export function WorkspaceSettingsDialog({
  workspaceId,
  workspaceName,
  workspaceDescription,
  workspaceKind,
  currentUserRole,
}: WorkspaceSettingsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [name, setName] = useState(workspaceName);
  const [description, setDescription] = useState(workspaceDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [generalSuccess, setGeneralSuccess] = useState("");

  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";
  const canLeave = currentUserRole !== "owner";

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    const result = await listWorkspaceMembers(workspaceId);
    if (result.success) {
      setMembers(result.data);
    }
    setMembersLoading(false);
  }, [workspaceId]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      loadMembers();
    } else {
      setConfirmLeave(false);
    }
  }

  async function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError("");
    setGeneralSuccess("");
    setSaving(true);

    const result = await updateWorkspace({
      workspaceId,
      name: name !== workspaceName ? name : undefined,
      description: description !== (workspaceDescription ?? "") ? description : undefined,
    });

    if (!result.success) {
      setGeneralError(result.error);
    } else {
      setGeneralSuccess("Saved");
      router.refresh();
    }
    setSaving(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteSuccess("");
    setInviting(true);

    const result = await inviteWorkspaceMember({
      workspaceId,
      email: inviteEmail,
      role: inviteRole,
    });

    if (!result.success) {
      setInviteError(result.error);
    } else {
      setInviteSuccess(`Invited ${inviteEmail}`);
      setInviteEmail("");
      loadMembers();
    }
    setInviting(false);
  }

  async function handleLeave() {
    setLeaving(true);
    const result = await leaveWorkspace(workspaceId);
    if (result.success) {
      setOpen(false);
      router.push("/library");
      router.refresh();
    } else {
      setGeneralError(result.error);
      setConfirmLeave(false);
    }
    setLeaving(false);
  }

  async function handleRoleChange(memberId: string, role: string) {
    const result = await updateMemberRole({ memberId, role });
    if (result.success) {
      loadMembers();
    }
  }

  async function handleRemove(memberId: string) {
    const result = await removeMember(memberId);
    if (result.success) {
      loadMembers();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Settings className="mr-2 h-4 w-4" />
        Settings
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Workspace Settings</DialogTitle>
          <DialogDescription>Manage workspace details and members.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1">
              General
            </TabsTrigger>
            <TabsTrigger value="members" className="flex-1">
              Members
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 pt-4">
            <form onSubmit={handleSaveGeneral} className="space-y-4">
              {generalError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {generalError}
                </div>
              )}
              {generalSuccess && (
                <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
                  {generalSuccess}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="ws-settings-name">Name</Label>
                <Input
                  id="ws-settings-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ws-settings-desc">Description</Label>
                <Input
                  id="ws-settings-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <div className="text-sm text-muted-foreground">
                  <Badge variant="outline">{workspaceKind}</Badge>
                  <span className="ml-2">Cannot be changed after creation</span>
                </div>
              </div>
              {canManage && (
                <Button type="submit" disabled={saving} className="w-full">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              )}
            </form>

            {canLeave && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-destructive">Leave Workspace</Label>
                  {!confirmLeave ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        You will lose access to all decks in this workspace.
                      </p>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmLeave(true)}
                        className="w-full"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Leave Workspace
                      </Button>
                    </>
                  ) : (
                    <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 space-y-3">
                      <p className="text-sm font-medium">
                        Are you sure you want to leave{" "}
                        <span className="font-bold">{workspaceName}</span>?
                      </p>
                      <p className="text-xs text-muted-foreground">
                        You&apos;ll need a new invite to rejoin.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setConfirmLeave(false)}
                          disabled={leaving}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                          onClick={handleLeave}
                          disabled={leaving}
                        >
                          {leaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <LogOut className="mr-2 h-4 w-4" />
                          )}
                          Confirm Leave
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-4 pt-4">
            {canManage && workspaceKind === "shared" && (
              <>
                <form onSubmit={handleInvite} className="space-y-3">
                  <Label className="text-sm font-medium">Invite a member</Label>
                  {inviteError && (
                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                      {inviteError}
                    </div>
                  )}
                  {inviteSuccess && (
                    <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
                      {inviteSuccess}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                      className="flex-1"
                    />
                    <Select
                      value={inviteRole}
                      onValueChange={(v) => setInviteRole(v as "admin" | "editor" | "viewer")}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="submit" size="sm" disabled={inviting}>
                      {inviting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </form>
                <Separator />
              </>
            )}

            {workspaceKind === "personal" && (
              <div className="text-sm text-muted-foreground">
                Personal workspaces cannot have additional members.
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-sm font-medium">Current members ({members.length})</Label>
              {membersLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : members.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No members found.</p>
              ) : (
                <div className="space-y-2 pt-2">
                  {members.map((member) => (
                    <div
                      key={member.memberId}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {member.name || member.email}
                        </p>
                        {member.name && (
                          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                        )}
                        {member.status === "invited" && (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            Pending invite
                          </Badge>
                        )}
                      </div>
                      <div className="ml-3 flex items-center gap-2">
                        {member.role === "owner" ? (
                          <Badge>Owner</Badge>
                        ) : canManage ? (
                          <>
                            <Select
                              value={member.role}
                              onValueChange={(v) => v && handleRoleChange(member.memberId, v)}
                            >
                              <SelectTrigger className="h-8 w-24 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleRemove(member.memberId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Badge variant="outline">{member.role}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
