import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  fetchBudgetMembers,
  inviteCollaborator,
  removeCollaborator,
  resolveBudgetOwnerId,
  soloMemberFromSession,
  type BudgetMember,
} from "../lib/collaborationApi";
import { readCache, trackBusy, writeCache } from "../lib/dataCache";

interface MembersCache {
  ownerId: string;
  members: BudgetMember[];
}

interface UseCollaborationResult {
  loading: boolean;
  saving: boolean;
  error: string | null;
  budgetOwnerId: string | null;
  members: BudgetMember[];
  activeMembers: BudgetMember[];
  isOwner: boolean;
  invite: (email: string) => Promise<void>;
  remove: (inviteId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCollaboration(session: Session | null): UseCollaborationResult {
  const [cached] = useState(() => readCache<MembersCache>(`members:${session?.user.id ?? ""}`));
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budgetOwnerId, setBudgetOwnerId] = useState<string | null>(cached?.ownerId ?? null);
  const [members, setMembers] = useState<BudgetMember[]>(cached?.members ?? []);
  const hasData = useRef(Boolean(cached));

  const refresh = useCallback(async () => {
    if (!session?.user.id) {
      setBudgetOwnerId(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    if (!hasData.current) setLoading(true);
    setError(null);

    try {
      const { ownerId, nextMembers } = await trackBusy(
        (async () => {
          const ownerId = await resolveBudgetOwnerId(session.user.id);
          const nextMembers = await fetchBudgetMembers(session.user.id, ownerId, session.user);
          return { ownerId, nextMembers };
        })(),
      );
      setBudgetOwnerId(ownerId);
      setMembers(nextMembers);
      hasData.current = true;
      writeCache<MembersCache>(`members:${session.user.id}`, { ownerId, members: nextMembers });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load collaborators");
      setBudgetOwnerId(session.user.id);
      setMembers(soloMemberFromSession(session.user.id, session.user));
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const invite = useCallback(
    async (email: string) => {
      if (!session?.user.id) return;

      setSaving(true);
      setError(null);

      try {
        await inviteCollaborator(email);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to invite collaborator");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [refresh, session?.user.id],
  );

  const remove = useCallback(
    async (inviteId: string) => {
      setSaving(true);
      setError(null);

      try {
        await removeCollaborator(inviteId);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove collaborator");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  const activeMembers = members.filter((member) => !member.pending);
  const isOwner = budgetOwnerId === session?.user.id;

  return {
    loading,
    saving,
    error,
    budgetOwnerId,
    members,
    activeMembers,
    isOwner,
    invite,
    remove,
    refresh,
  };
}
