import { useMemo, useState } from "react";
import { Mail, Trash2, UserPlus } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { useCollaboration } from "../hooks/useCollaboration";
import { soloMemberFromSession, type BudgetMember } from "../lib/collaborationApi";

function memberInitials(member: BudgetMember): string {
  const source = member.displayName ?? member.email;
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function MemberAvatar({
  member,
  size = "sm",
}: {
  member: BudgetMember;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "w-7 h-7 text-xs" : "w-10 h-10 text-sm";

  if (member.avatarUrl) {
    return (
      <img
        src={member.avatarUrl}
        alt={member.displayName ?? member.email}
        title={member.displayName ?? member.email}
        className={`${sizeClass} rounded-full border-2 border-background object-cover shrink-0`}
      />
    );
  }

  return (
    <div
      title={member.displayName ?? member.email}
      className={`${sizeClass} rounded-full border-2 border-background flex items-center justify-center font-medium bg-muted text-muted-foreground shrink-0`}
    >
      {memberInitials(member)}
    </div>
  );
}

function HeaderAvatars({ members }: { members: BudgetMember[] }) {
  const active = members.filter((member) => !member.pending);

  return (
    <div className="flex -space-x-1.5">
      {active.map((member) => (
        <MemberAvatar key={member.userId} member={member} />
      ))}
    </div>
  );
}

export function CollaboratorsMenu({ session }: { session: Session }) {
  const { members, activeMembers, isOwner, saving, error, invite, remove } =
    useCollaboration(session);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);

  const fallbackMembers = useMemo(
    () => soloMemberFromSession(session.user.id, session.user),
    [session.user],
  );

  const displayMembers =
    activeMembers.length > 0
      ? activeMembers
      : members.length > 0
        ? members.filter((member) => !member.pending)
        : fallbackMembers;

  const dialogMembers = members.length > 0 ? members : fallbackMembers;
  const pendingInvites = dialogMembers.filter((member) => member.pending);
  const isBudgetOwner = isOwner || dialogMembers.every((member) => member.isYou);

  const handleInvite = async () => {
    if (!email.trim()) return;

    try {
      await invite(email);
      setEmail("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      // error surfaced via hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60 transition-colors border border-transparent hover:border-border"
          aria-label="Share budget and manage collaborators"
        >
          <HeaderAvatars members={displayMembers} />
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <UserPlus size={14} />
            Share
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Shared budget</DialogTitle>
          <DialogDescription>
            Invite someone by email to collaborate on this budget. No email is sent — they get
            access when they sign in with that address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <p className="font-medium text-sm text-foreground">Members</p>
            </div>
            <div className="divide-y divide-border">
              {dialogMembers
                .filter((member) => !member.pending)
                .map((member) => (
                  <div key={member.userId} className="flex items-center gap-3 px-4 py-3">
                    <MemberAvatar member={member} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground text-sm truncate">
                          {member.displayName ?? member.email}
                        </p>
                        {member.isYou && (
                          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            you
                          </span>
                        )}
                      </div>
                      {member.displayName && (
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      )}
                    </div>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-md shrink-0 bg-muted text-muted-foreground">
                      {member.isOwner ? "Owner" : "Collaborator"}
                    </span>
                    {isBudgetOwner && !member.isOwner && member.inviteId && (
                      <button
                        type="button"
                        onClick={() => void remove(member.inviteId!)}
                        disabled={saving}
                        className="w-7 h-7 rounded-md bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        aria-label={`Remove ${member.displayName ?? member.email}`}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {pendingInvites.length > 0 && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <p className="font-medium text-sm text-foreground">Pending access</p>
              </div>
              <div className="divide-y divide-border">
                {pendingInvites.map((invite) => (
                  <div key={invite.inviteId} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-muted/50">
                      <Mail size={16} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{invite.email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Access granted — waiting for sign-in
                      </p>
                    </div>
                    {isBudgetOwner && invite.inviteId && (
                      <button
                        type="button"
                        onClick={() => void remove(invite.inviteId!)}
                        disabled={saving}
                        className="w-7 h-7 rounded-md bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        aria-label={`Cancel invite for ${invite.email}`}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isBudgetOwner && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <p className="font-medium text-sm text-foreground">Invite someone</p>
              </div>
              <div className="px-4 py-4 space-y-3">
                {success && (
                  <div className="flex items-center gap-2.5 rounded-lg p-3 bg-muted/50">
                    <span className="text-lg">✓</span>
                    <div>
                      <p className="font-medium text-sm text-foreground">Access granted</p>
                      <p className="text-xs text-muted-foreground">
                        They can sign in with that email to collaborate
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="invite-email"
                    className="block text-xs font-medium text-muted-foreground mb-1.5"
                  >
                    Email address
                  </label>
                  <Input
                    id="invite-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="their@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleInvite();
                    }}
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <button
                  type="button"
                  onClick={() => void handleInvite()}
                  disabled={saving || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-foreground text-background rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <UserPlus size={16} />
                  Grant access
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
