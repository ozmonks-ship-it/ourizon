export type AssetGroupId = "cash" | "stocks" | "crypto" | "property" | "super";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      budget_collaborators: {
        Row: {
          id: string;
          owner_id: string;
          collaborator_id: string | null;
          email: string;
          invited_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          collaborator_id?: string | null;
          email: string;
          invited_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          collaborator_id?: string | null;
          email?: string;
          invited_at?: string;
        };
      };
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
      update_balance_snapshot: {
        Args: {
          p_snapshot_id: string;
          p_entries: { asset_id: string; balance: number }[];
        };
        Returns: void;
      };
      upsert_profile: { Args: Record<string, never>; Returns: void };
      link_pending_invites: { Args: Record<string, never>; Returns: void };
      invite_budget_collaborator: { Args: { p_email: string }; Returns: string };
      remove_budget_collaborator: { Args: { p_invite_id: string }; Returns: void };
      resolve_budget_user_id: { Args: Record<string, never>; Returns: string };
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type BudgetCollaborator = Database["public"]["Tables"]["budget_collaborators"]["Row"];
export type Asset = Database["public"]["Tables"]["assets"]["Row"];
export type BalanceSnapshot = Database["public"]["Tables"]["balance_snapshots"]["Row"];
export type BalanceSnapshotEntry = Database["public"]["Tables"]["balance_snapshot_entries"]["Row"];

export interface AssetWithBalance extends Asset {
  balance: number | null;
}

export interface NetWorthPoint {
  id: string;
  label: string;
  value: number;
  recordedAt: string;
}
