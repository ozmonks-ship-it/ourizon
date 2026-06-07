export type AssetGroupId = "cash" | "stocks" | "crypto" | "property" | "super";

export interface Database {
  public: {
    Tables: {
      assets: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          institution: string;
          group_id: AssetGroupId;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          institution?: string;
          group_id: AssetGroupId;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          institution?: string;
          group_id?: AssetGroupId;
          created_at?: string;
          updated_at?: string;
        };
      };
      balance_snapshots: {
        Row: {
          id: string;
          user_id: string;
          recorded_at: string;
          total_worth: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recorded_at?: string;
          total_worth: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          recorded_at?: string;
          total_worth?: number;
          created_at?: string;
        };
      };
      balance_snapshot_entries: {
        Row: {
          id: string;
          snapshot_id: string;
          asset_id: string;
          balance: number;
        };
        Insert: {
          id?: string;
          snapshot_id: string;
          asset_id: string;
          balance: number;
        };
        Update: {
          id?: string;
          snapshot_id?: string;
          asset_id?: string;
          balance?: number;
        };
      };
    };
    Functions: {
      save_balance_snapshot: {
        Args: { p_entries: { asset_id: string; balance: number }[] };
        Returns: string;
      };
    };
  };
}

export type Asset = Database["public"]["Tables"]["assets"]["Row"];
export type BalanceSnapshot = Database["public"]["Tables"]["balance_snapshots"]["Row"];
export type BalanceSnapshotEntry = Database["public"]["Tables"]["balance_snapshot_entries"]["Row"];

export interface AssetWithBalance extends Asset {
  balance: number | null;
}

export interface NetWorthPoint {
  label: string;
  value: number;
  recordedAt: string;
}
