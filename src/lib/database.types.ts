// ============================================================================
// ATLASBANX - Database Types
// Types TypeScript correspondant au schema Supabase
// ============================================================================

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          settings: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          settings?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          logo_url?: string | null;
          settings?: Record<string, unknown>;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          organization_id: string | null;
          role: 'admin' | 'auditor' | 'viewer';
          account_type: 'enterprise' | 'cabinet';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          organization_id?: string | null;
          role?: 'admin' | 'auditor' | 'viewer';
          account_type?: 'enterprise' | 'cabinet';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          organization_id?: string | null;
          role?: 'admin' | 'auditor' | 'viewer';
          account_type?: 'enterprise' | 'cabinet';
          updated_at?: string;
        };
      };
      user_settings: {
        Row: {
          id: string;
          user_id: string;
          settings: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          settings?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          settings?: Record<string, unknown>;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: 'admin' | 'auditor' | 'viewer';
      account_type: 'enterprise' | 'cabinet';
    };
  };
  atlasbanx: {
    Tables: {
      clients: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          code: string;
          legal_name: string | null;
          siret: string | null;
          rccm: string | null;
          nif: string | null;
          legal_form: string | null;
          capital: number | null;
          currency: string | null;
          address: string | null;
          city: string | null;
          postal_code: string | null;
          country: string | null;
          email: string | null;
          phone: string | null;
          website: string | null;
          contact_name: string | null;
          contact_role: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          sector: string | null;
          activity: string | null;
          employee_count: number | null;
          annual_revenue: number | null;
          fiscal_year_end: string | null;
          notes: string | null;
          tags: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          code: string;
          legal_name?: string | null;
          siret?: string | null;
          rccm?: string | null;
          nif?: string | null;
          legal_form?: string | null;
          capital?: number | null;
          currency?: string | null;
          address?: string | null;
          city?: string | null;
          postal_code?: string | null;
          country?: string | null;
          email?: string | null;
          phone?: string | null;
          website?: string | null;
          contact_name?: string | null;
          contact_role?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          sector?: string | null;
          activity?: string | null;
          employee_count?: number | null;
          annual_revenue?: number | null;
          fiscal_year_end?: string | null;
          notes?: string | null;
          tags?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['atlasbanx']['Tables']['clients']['Insert']>;
      };
      bank_accounts: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          account_number: string;
          bank_code: string;
          bank_name: string;
          currency: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id: string;
          account_number: string;
          bank_code: string;
          bank_name: string;
          currency?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['atlasbanx']['Tables']['bank_accounts']['Insert']>;
      };
      bank_statements: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          account_id: string | null;
          bank_code: string;
          bank_name: string;
          file_name: string;
          file_type: 'csv' | 'excel' | 'pdf';
          period_start: string;
          period_end: string;
          transaction_count: number;
          status: 'imported' | 'analyzed' | 'archived';
          imported_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id: string;
          account_id?: string | null;
          bank_code: string;
          bank_name: string;
          file_name: string;
          file_type: 'csv' | 'excel' | 'pdf';
          period_start: string;
          period_end: string;
          transaction_count?: number;
          status?: 'imported' | 'analyzed' | 'archived';
          imported_at?: string;
        };
        Update: Partial<Database['atlasbanx']['Tables']['bank_statements']['Insert']>;
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          account_id: string | null;
          account_number: string | null;
          bank_code: string;
          bank_name: string | null;
          date: string;
          value_date: string | null;
          amount: number;
          balance: number | null;
          description: string;
          reference: string | null;
          type: string;
          category: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id: string;
          account_id?: string | null;
          account_number?: string | null;
          bank_code: string;
          bank_name?: string | null;
          date: string;
          value_date?: string | null;
          amount: number;
          balance?: number | null;
          description: string;
          reference?: string | null;
          type: string;
          category?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['atlasbanx']['Tables']['transactions']['Insert']>;
      };
      audit_trail: {
        Row: {
          id: string;
          event_id: string;
          user_id: string | null;
          cabinet_id: string | null;
          client_id: string | null;
          event_type: string;
          resource_type: string;
          resource_id: string | null;
          action: string;
          payload: Record<string, unknown>;
          ip_address: string | null;
          user_agent: string | null;
          session_id: string | null;
          integrity_hash: string;
          previous_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id?: string | null;
          cabinet_id?: string | null;
          client_id?: string | null;
          event_type: string;
          resource_type: string;
          resource_id?: string | null;
          action: string;
          payload?: Record<string, unknown>;
          ip_address?: string | null;
          user_agent?: string | null;
          session_id?: string | null;
          // integrity_hash & previous_hash are computed by the BEFORE INSERT trigger
          integrity_hash?: string;
          previous_hash?: string | null;
          created_at?: string;
        };
        // UPDATE is intentionally impossible via RLS — kept here only to
        // satisfy the Supabase type contract.
        Update: Partial<Database['atlasbanx']['Tables']['audit_trail']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      verify_audit_chain: {
        Args: {
          p_user_id: string;
          p_start_date?: string | null;
          p_end_date?: string | null;
        };
        Returns: Array<{
          total_events: number;
          first_broken_event: string | null;
          first_broken_at: string | null;
          is_valid: boolean;
        }>;
      };
    };
    Enums: Record<string, never>;
  };
}

// Convenience types — public schema
export type Organization = Database['public']['Tables']['organizations']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type UserSettings = Database['public']['Tables']['user_settings']['Row'];
export type UserRole = Database['public']['Enums']['user_role'];
export type AccountType = Database['public']['Enums']['account_type'];

// Convenience types — atlasbanx schema (app-specific)
export type DbClient = Database['atlasbanx']['Tables']['clients']['Row'];
export type DbClientInsert = Database['atlasbanx']['Tables']['clients']['Insert'];
export type DbClientUpdate = Database['atlasbanx']['Tables']['clients']['Update'];

export type DbBankAccount = Database['atlasbanx']['Tables']['bank_accounts']['Row'];
export type DbBankAccountInsert = Database['atlasbanx']['Tables']['bank_accounts']['Insert'];

export type DbBankStatement = Database['atlasbanx']['Tables']['bank_statements']['Row'];
export type DbBankStatementInsert = Database['atlasbanx']['Tables']['bank_statements']['Insert'];

export type DbTransaction = Database['atlasbanx']['Tables']['transactions']['Row'];
export type DbTransactionInsert = Database['atlasbanx']['Tables']['transactions']['Insert'];
