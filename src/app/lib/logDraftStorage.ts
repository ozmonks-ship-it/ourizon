import type { Bucket } from "@/lib/supabase/database.types";

export interface BucketsDraftSnapshot {
  draftValues: Record<string, string>;
  netIncomeDraft: string;
}

function storageKey(userId: string, year: number, month: number): string {
  return `ourizon:buckets-draft:${userId}:${year}-${String(month).padStart(2, "0")}`;
}

export function loadDraftSnapshot(
  userId: string,
  year: number,
  month: number,
): BucketsDraftSnapshot | null {
  try {
    const raw = sessionStorage.getItem(storageKey(userId, year, month));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BucketsDraftSnapshot;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.netIncomeDraft !== "string" ||
      typeof parsed.draftValues !== "object" ||
      parsed.draftValues === null
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraftSnapshot(
  userId: string,
  year: number,
  month: number,
  snapshot: BucketsDraftSnapshot,
): void {
  try {
    sessionStorage.setItem(storageKey(userId, year, month), JSON.stringify(snapshot));
  } catch {
    // sessionStorage may be unavailable or full
  }
}

export function clearDraftSnapshot(userId: string, year: number, month: number): void {
  try {
    sessionStorage.removeItem(storageKey(userId, year, month));
  } catch {
    // ignore
  }
}

export function buildDraftFromServer(
  bucketRows: Bucket[],
  netIncome: number,
  entries: Map<string, { input_value: number }>,
): BucketsDraftSnapshot {
  const draftValues: Record<string, string> = {};
  for (const bucket of bucketRows) {
    const entry = entries.get(bucket.id);
    const value = entry?.input_value ?? bucket.default_value;
    draftValues[bucket.id] = value === 0 ? "" : String(value);
  }
  return {
    draftValues,
    netIncomeDraft: netIncome === 0 ? "" : String(netIncome),
  };
}

export function mergeDraftWithBuckets(
  currentDraft: Record<string, string>,
  bucketRows: Bucket[],
  entries: Map<string, { input_value: number }>,
): Record<string, string> {
  const next = { ...currentDraft };
  const bucketIds = new Set(bucketRows.map((b) => b.id));

  for (const bucket of bucketRows) {
    if (!(bucket.id in next)) {
      const entry = entries.get(bucket.id);
      const value = entry?.input_value ?? bucket.default_value;
      next[bucket.id] = value === 0 ? "" : String(value);
    }
  }

  for (const id of Object.keys(next)) {
    if (!bucketIds.has(id)) {
      delete next[id];
    }
  }

  return next;
}

export function restoreDraftSnapshot(
  fromServer: BucketsDraftSnapshot,
  stored: BucketsDraftSnapshot,
  bucketRows: Bucket[],
): BucketsDraftSnapshot {
  const bucketIds = new Set(bucketRows.map((b) => b.id));
  const draftValues: Record<string, string> = { ...fromServer.draftValues };

  for (const bucket of bucketRows) {
    if (bucket.id in stored.draftValues) {
      draftValues[bucket.id] = stored.draftValues[bucket.id];
    }
  }

  for (const id of Object.keys(draftValues)) {
    if (!bucketIds.has(id)) {
      delete draftValues[id];
    }
  }

  return {
    draftValues,
    netIncomeDraft: stored.netIncomeDraft,
  };
}
