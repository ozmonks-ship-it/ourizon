import { useMemo, useState } from "react";
import { Mail, UserMinus, UserPlus } from "lucide-react";
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
import { btnOutline, btnPrimary } from "./ui/buttonStyles";
import { ConfirmDialog, Field, StatusChip, describedBy } from "./ui/kit";
import { useToast } from "./Toast";
import { emailError } from "../lib/validation";
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
  const sizeClass = size === "sm" ? "w-8 h-8 text-sm" : "w-11 h-11 text-base";

  if (member.avatarUrl) {
    return (
      <img
        src={member.avatarUrl}
        alt=""
        title={member.displayName ?? member.email}
        className={`${sizeClass} rounded-full border-2 border-background object-cover shrink-0`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      title={member.displayName ?? member.email}
      className={`${sizeClass} rounded-full border-2 border-background flex items-center justify-center font-bold bg-secondary text-foreground shrink-0`}
    >
      {memberInitials(member)}
    </div>
  );
}

function HeaderAvatars({ members }: { members: BudgetMember[] }) {
  const active = members.filter((member) => !member.pending);

  // Small gap between avatars so initials are never covered (A16).
  return (
    <div className="flex gap-1" aria-hidden="true">
      {active.slice(0, 3).map((member) => (
        <MemberAvatar key={member.userId} member={member} />
      ))}
    </div>
  );
}

export function CollaboratorsMenu({ session }: { session: Session }) {
  const { members, activeMembers, isOwner, saving, error, invite, remove } =
    useCollaboration(session);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<BudgetMember | null>(null);

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
  const peopleCount = displayMembers.length;

  const handleInvite = async () => {
    const problem = emailError(email);
    setFieldError(problem);
    if (problem) {
      document.getElementById("invite-email")?.focus();
      return;
    }

    try {
      const added = email.trim();
      await invite(added);
      setEmail("");
      toast(`${added} can now sign in to see this household`);
    } catch {
      // error surfaced via hook
    }
  };

  const memberName = (member: BudgetMember) => member.displayName ?? member.email;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-field-border px-3 py-1 transition-colors hover:bg-muted"
          >
            <HeaderAvatars members={displayMembers} />
            <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <UserPlus className="size-4" aria-hidden="true" />
              Household
              <span className="sr-only">
                , {peopleCount} {peopleCount === 1 ? "person" : "people"}
              </span>
            </span>
          </button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Household members</DialogTitle>
            <DialogDescription>
              Everyone listed here sees and edits the same assets, monthly plans and budgets.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <section aria-labelledby="members-heading" className="space-y-1">
              <h3 id="members-heading" className="text-base font-bold text-foreground">
                Members
              </h3>
              <ul className="divide-y divide-border">
                {dialogMembers
                  .filter((member) => !member.pending)
                  .map((member) => (
                    <li key={member.userId} className="flex items-center gap-3 py-2">
                      <MemberAvatar member={member} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-semibold text-foreground">
                          {memberName(member)}
                          {member.isYou && <span className="font-normal text-muted-foreground"> (you)</span>}
                        </p>
                        {member.displayName && (
                          <p className="break-words text-sm text-muted-foreground">{member.email}</p>
                        )}
                      </div>
                      <StatusChip tone="neutral">{member.isOwner ? "Owner" : "Member"}</StatusChip>
                      {isBudgetOwner && !member.isOwner && member.inviteId && (
                        <button
                          type="button"
                          onClick={() => setRemoving(member)}
                          disabled={saving}
                          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                          aria-label={`Remove ${memberName(member)} from the household`}
                        >
                          <UserMinus className="size-5" aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  ))}
              </ul>
            </section>

            {pendingInvites.length > 0 && (
              <section aria-labelledby="pending-heading" className="space-y-1">
                <h3 id="pending-heading" className="text-base font-bold text-foreground">
                  Waiting to sign in
                </h3>
                <ul className="divide-y divide-border">
                  {pendingInvites.map((pending) => (
                    <li key={pending.inviteId} className="flex items-center gap-3 py-2">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden="true">
                        <Mail className="size-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-semibold text-foreground">{pending.email}</p>
                        <p className="text-sm text-muted-foreground">Can join when they sign in with this email</p>
                      </div>
                      {isBudgetOwner && pending.inviteId && (
                        <button
                          type="button"
                          onClick={() => setRemoving(pending)}
                          disabled={saving}
                          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                          aria-label={`Cancel access for ${pending.email}`}
                        >
                          <UserMinus className="size-5" aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {isBudgetOwner && (
              <form
                className="space-y-3"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleInvite();
                }}
              >
                <Field
                  id="invite-email"
                  label="Add someone by email"
                  hint="Use the Google address they sign in with. We don't send them an email, so let them know yourself."
                  error={fieldError}
                >
                  <Input
                    id="invite-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="sam@example.com"
                    value={email}
                    aria-invalid={fieldError ? true : undefined}
                    aria-describedby={describedBy("invite-email", true, fieldError)}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldError) setFieldError(null);
                    }}
                  />
                </Field>

                {error && (
                  <p role="alert" className="text-sm font-semibold text-destructive">
                    {error}
                  </p>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <button type="button" className={`${btnOutline} flex-1`} onClick={() => setOpen(false)}>
                    Close
                  </button>
                  <button type="submit" disabled={saving} className={`${btnPrimary} flex-1`}>
                    <UserPlus aria-hidden="true" />
                    {saving ? "Adding…" : "Give access"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(next) => !next && setRemoving(null)}
        title={removing?.pending ? `Cancel access for ${removing.email}?` : `Remove ${removing ? memberName(removing) : ""}?`}
        description={
          removing?.pending
            ? "They won't be able to join this household when they sign in."
            : "They'll lose access to this household's assets, plans and budgets straight away. You can add them again later."
        }
        confirmLabel={removing?.pending ? "Cancel access" : "Remove"}
        onConfirm={async () => {
          if (!removing?.inviteId) return;
          await remove(removing.inviteId);
          toast(removing.pending ? "Access cancelled" : `${memberName(removing)} removed`);
        }}
      />
    </>
  );
}
