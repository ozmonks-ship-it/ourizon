import type { AssetWithBalance } from "@/lib/supabase/database.types";

/**
 * A snapshot of an in-progress "Update balances" edit on the Assets screen.
 * Persisted so the values a user has typed survive a page reload — most
 * commonly when a mobile OS relaunches the standalone PWA after the user
 * briefly switches to another app.
 */
export interface AssetsDraftSnapshot {
  /** Snapshot being edited, or null when capturing a brand-new balance snapshot. */
  editingSnapshotId: string | null;
  /** Raw input strings keyed by asset id. */
  draftBalances: Record<string, string>;
}

function storageKey(userId: string): string {
  return `ourizon:assets-draft:${userId}`;
}

export function loadAssetsDraft(userId: string): AssetsDraftSnapshot | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AssetsDraftSnapshot;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.draftBalances !== "object" ||
      parsed.draftBalances === null ||
      (parsed.editingSnapshotId !== null && typeof parsed.editingSnapshotId !== "string")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveAssetsDraft(userId: string, snapshot: AssetsDraftSnapshot): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(snapshot));
  } catch {
    // localStorage may be unavailable or full — losing the draft is acceptable here.
  }
}

export function clearAssetsDraft(userId: string): void {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
}

/**
 * Reconcile a stored draft against the assets currently loaded from the server.
 * Keeps the user's typed value for every asset that still exists, seeds any
 * asset added since the draft was saved from its current balance, and drops
 * entries for assets that have since been removed.
 */
export function mergeDraftWithAssets(
  stored: Record<string, string>,
  assets: AssetWithBalance[],
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const asset of assets) {
    next[asset.id] =
      asset.id in stored
        ? stored[asset.id]
        : asset.balance === null
          ? ""
          : String(asset.balance);
  }
  return next;
}
