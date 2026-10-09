import type { AssetGroupId } from "@/lib/supabase/database.types";

export interface AssetGroupDefinition {
  id: AssetGroupId;
  label: string;
  /** Bar colour on Home's "What you own" list. */
  color: string;
}

export const ASSET_GROUPS: AssetGroupDefinition[] = [
  { id: "cash", label: "Cash", color: "var(--chart-4)" },
  { id: "stocks", label: "Shares and ETFs", color: "var(--chart-1)" },
  { id: "crypto", label: "Crypto", color: "var(--chart-3)" },
  { id: "property", label: "Property", color: "var(--chart-5)" },
  { id: "super", label: "Super", color: "var(--chart-2)" },
];

export function getAssetGroupLabel(groupId: AssetGroupId): string {
  return ASSET_GROUPS.find((group) => group.id === groupId)?.label ?? groupId;
}
