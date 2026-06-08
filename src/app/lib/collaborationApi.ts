import { createClient } from "@/lib/supabase/client";
import type { BudgetCollaborator, Profile } from "@/lib/supabase/database.types";

export interface BudgetMember {
  userId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  isOwner: boolean;
  isYou: boolean;
  inviteId?: string;
  pending: boolean;
}

function isMissingSchemaError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    (error.message?.includes("schema cache") ?? false)
  );
}

export async function bootstrapCollaboration(): Promise<boolean> {
  const supabase = createClient();
  const { error: profileError } = await supabase.rpc("upsert_profile");
  if (profileError) {
    if (isMissingSchemaError(profileError)) return false;
    console.warn("upsert_profile failed:", profileError);
    return false;
  }

  const { error: linkError } = await supabase.rpc("link_pending_invites");
  if (linkError) {
    if (isMissingSchemaError(linkError)) return false;
    console.warn("link_pending_invites failed:", linkError);
    return false;
  }

  return true;
}

export async function resolveBudgetOwnerId(fallbackUserId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("resolve_budget_user_id");
  if (error) {
    if (isMissingSchemaError(error)) return fallbackUserId;
    throw error;
  }
  return (data as string) ?? fallbackUserId;
}

export function soloMemberFromSession(
  currentUserId: string,
  sessionUser?: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  },
): BudgetMember[] {
  const profile = sessionUser ? profileFromSession(sessionUser) : null;
  return [
    {
      userId: currentUserId,
      email: profile?.email ?? "",
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      isOwner: true,
      isYou: true,
      pending: false,
    },
  ];
}

export async function fetchBudgetMembers(
  currentUserId: string,
  budgetOwnerId: string,
  sessionUser?: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  },
): Promise<BudgetMember[]> {
  const supabase = createClient();

  const { data: invites, error: invitesError } = await supabase
    .from("budget_collaborators")
    .select("id, email, collaborator_id, invited_at")
    .eq("owner_id", budgetOwnerId);

  if (invitesError) {
    if (isMissingSchemaError(invitesError)) {
      return soloMemberFromSession(currentUserId, sessionUser);
    }
    throw invitesError;
  }

  const userIds = new Set<string>([budgetOwnerId]);
  for (const invite of invites ?? []) {
    if (invite.collaborator_id) userIds.add(invite.collaborator_id);
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url")
    .in("id", [...userIds]);

  if (profilesError) {
    if (isMissingSchemaError(profilesError)) {
      return soloMemberFromSession(currentUserId, sessionUser);
    }
    throw profilesError;
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const ownerProfile = profileById.get(budgetOwnerId);
  const ownerFallback =
    sessionUser?.id === budgetOwnerId ? profileFromSession(sessionUser) : null;

  const members: BudgetMember[] = [
    {
      userId: budgetOwnerId,
      email: ownerProfile?.email ?? ownerFallback?.email ?? "",
      displayName: ownerProfile?.display_name ?? ownerFallback?.display_name ?? null,
      avatarUrl: ownerProfile?.avatar_url ?? ownerFallback?.avatar_url ?? null,
      isOwner: true,
      isYou: budgetOwnerId === currentUserId,
      pending: false,
    },
  ];

  for (const invite of invites ?? []) {
    if (invite.collaborator_id) {
      const profile = profileById.get(invite.collaborator_id);
      const fallback =
        sessionUser?.id === invite.collaborator_id ? profileFromSession(sessionUser) : null;
      members.push({
        userId: invite.collaborator_id,
        email: profile?.email ?? fallback?.email ?? invite.email,
        displayName: profile?.display_name ?? fallback?.display_name ?? null,
        avatarUrl: profile?.avatar_url ?? fallback?.avatar_url ?? null,
        isOwner: false,
        isYou: invite.collaborator_id === currentUserId,
        inviteId: invite.id,
        pending: false,
      });
    } else {
      members.push({
        userId: invite.id,
        email: invite.email,
        displayName: null,
        avatarUrl: null,
        isOwner: false,
        isYou: false,
        inviteId: invite.id,
        pending: true,
      });
    }
  }

  return members;
}

export async function inviteCollaborator(email: string): Promise<BudgetCollaborator> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("invite_budget_collaborator", {
    p_email: email.trim(),
  });

  if (error) throw error;

  const { data: invite, error: fetchError } = await supabase
    .from("budget_collaborators")
    .select("*")
    .eq("id", data as string)
    .single();

  if (fetchError) throw fetchError;
  return invite;
}

export async function removeCollaborator(inviteId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("remove_budget_collaborator", {
    p_invite_id: inviteId,
  });
  if (error) throw error;
}

export function profileFromSession(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): Profile {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? "",
    display_name: (meta.full_name as string) ?? (meta.name as string) ?? null,
    avatar_url: (meta.avatar_url as string) ?? (meta.picture as string) ?? null,
    updated_at: new Date().toISOString(),
  };
}
