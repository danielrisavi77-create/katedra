// Generated from canonical Supabase project zrrjttizjyfcxmcpgzml on 2026-08-06.
//
// V2-001 intentionally checks in the production `entitlements` projection
// required by Katedra's Project Pass boundary. Do not hand-add columns here:
// refresh this projection from Supabase when the canonical schema changes.
// In particular, the live table has `academic_project_id` and DOES NOT have
// `project_id`, `scope`, `capabilities`, or `source_product_id` columns.

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      entitlements: {
        Row: {
          academic_project_id: string | null
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          provider: string
          purchase_expires_at: string
          slots_total: number
          slots_used: number
          status: string
          user_id: string
          work_type: string
        }
        Insert: {
          academic_project_id?: string | null
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          provider: string
          purchase_expires_at: string
          slots_total: number
          slots_used?: number
          status?: string
          user_id: string
          work_type: string
        }
        Update: {
          academic_project_id?: string | null
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          provider?: string
          purchase_expires_at?: string
          slots_total?: number
          slots_used?: number
          status?: string
          user_id?: string
          work_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
