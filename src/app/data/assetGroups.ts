import type { AssetGroupId } from "@/lib/supabase/database.types";

export interface AssetGroupDefinition {
  id: AssetGroupId;
  label: string;
}

export const ASSET_GROUPS: AssetGroupDefinition[] = [
  { id: "cash", label: "Cash 💵" },
  { id: "stocks", label: "Stocks & ETFs 📈" },
  { id: "crypto", label: "Crypto ₿" },
  { id: "property", label: "Property 🏠" },
  { id: "super", label: "Super 🏦" },
];

export function getAssetGroupLabel(groupId: AssetGroupId): string {
  return ASSET_GROUPS.find((group) => group.id === groupId)?.label ?? groupId;
}
