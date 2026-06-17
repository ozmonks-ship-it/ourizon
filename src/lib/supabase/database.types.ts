export type AssetGroupId = "cash" | "stocks" | "crypto" | "property" | "super";
export type BucketKind = "income" | "expense";
export type AllocationMode = "amount" | "percent";

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
      buckets: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          kind: BucketKind;
          allocation_mode: AllocationMode;
          default_value: number;
          sort_order: number;
          parent_bucket_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          kind: BucketKind;
          allocation_mode: AllocationMode;
          default_value?: number;
          sort_order?: number;
          parent_bucket_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          kind?: BucketKind;
          allocation_mode?: AllocationMode;
          default_value?: number;
          sort_order?: number;
          parent_bucket_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      monthly_logs: {
        Row: {
          id: string;
          user_id: string;
          year: number;
          month: number;
          net_income: number;
          saving_amount: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          year: number;
          month: number;
          net_income?: number;
          saving_amount?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          year?: number;
          month?: number;
          net_income?: number;
          saving_amount?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      monthly_log_entries: {
        Row: {
          id: string;
          monthly_log_id: string;
          bucket_id: string;
          input_value: number;
          resolved_amount: number;
        };
        Insert: {
          id?: string;
          monthly_log_id: string;
          bucket_id: string;
          input_value?: number;
          resolved_amount?: number;
        };
        Update: {
          id?: string;
          monthly_log_id?: string;
          bucket_id?: string;
          input_value?: number;
          resolved_amount?: number;
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
      seed_default_buckets: { Args: Record<string, never>; Returns: void };
      save_monthly_log: {
        Args: {
          p_year: number;
          p_month: number;
          p_net_income: number;
          p_saving_amount: number;
          p_entries: { bucket_id: string; input_value: number; resolved_amount: number }[];
        };
        Returns: string;
      };
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type BudgetCollaborator = Database["public"]["Tables"]["budget_collaborators"]["Row"];
export type Asset = Database["public"]["Tables"]["assets"]["Row"];
export type BalanceSnapshot = Database["public"]["Tables"]["balance_snapshots"]["Row"];
export type BalanceSnapshotEntry = Database["public"]["Tables"]["balance_snapshot_entries"]["Row"];
export type Bucket = Database["public"]["Tables"]["buckets"]["Row"];
export type MonthlyLog = Database["public"]["Tables"]["monthly_logs"]["Row"];
export type MonthlyLogEntry = Database["public"]["Tables"]["monthly_log_entries"]["Row"];

export interface AssetWithBalance extends Asset {
  balance: number | null;
}

export interface NetWorthPoint {
  id: string;
  label: string;
  value: number;
  recordedAt: string;
}
