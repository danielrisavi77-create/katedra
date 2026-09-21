// Derived from Supabase-generated types for canonical production project
// zrrjttizjyfcxmcpgzml on 2026-08-06.
//
// Katedra intentionally checks in only the production projections required by
// its current Academic Suite boundaries rather than duplicating the full shared
// schema owned by Lekta. Do not hand-add columns here: refresh these projections
// from canonical generated types when the shared schema changes.

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      academic_projects: {
        Row: {
          academic_year: string | null
          contract_version: string
          created_at: string
          deadline: string | null
          deleted_at: string | null
          id: string
          institution_id: string | null
          legacy_client_project_id: string | null
          mentor_name: string | null
          profile_id: string | null
          program_id: string | null
          purge_after: string | null
          ruleset_id: string | null
          ruleset_version: string | null
          stage: string
          title: string | null
          topic: string
          unit_id: string
          updated_at: string
          user_id: string
          work_type: string
        }
        Insert: {
          academic_year?: string | null
          contract_version?: string
          created_at?: string
          deadline?: string | null
          deleted_at?: string | null
          id?: string
          institution_id?: string | null
          legacy_client_project_id?: string | null
          mentor_name?: string | null
          profile_id?: string | null
          program_id?: string | null
          purge_after?: string | null
          ruleset_id?: string | null
          ruleset_version?: string | null
          stage?: string
          title?: string | null
          topic?: string
          unit_id?: string
          updated_at?: string
          user_id: string
          work_type: string
        }
        Update: {
          academic_year?: string | null
          contract_version?: string
          created_at?: string
          deadline?: string | null
          deleted_at?: string | null
          id?: string
          institution_id?: string | null
          legacy_client_project_id?: string | null
          mentor_name?: string | null
          profile_id?: string | null
          program_id?: string | null
          purge_after?: string | null
          ruleset_id?: string | null
          ruleset_version?: string | null
          stage?: string
          title?: string | null
          topic?: string
          unit_id?: string
          updated_at?: string
          user_id?: string
          work_type?: string
        }
        Relationships: []
      }
      completion_project_state: {
        Row: {
          academic_project_id: string
          ai_data_safety_acknowledged: boolean
          ai_disclosure_state: string
          ai_mentor_consultation: string
          ai_policy_ruleset_id: string | null
          ai_policy_ruleset_version: string | null
          ai_policy_verified_at: string | null
          created_at: string
          deadline_authority_type: string
          deadline_source_id: string | null
          deadline_source_label: string | null
          defended_at: string | null
          defense_approval_authority_type: string | null
          defense_approved: boolean | null
          mentor_last_seen_version_label: string | null
          mentor_last_sent_at: string | null
          mentor_last_sent_version_label: string | null
          mentor_waiting_for_response: boolean
          methodology_approval_authority_type: string | null
          methodology_approved: boolean | null
          stage: string
          structure_approval_authority_type: string | null
          structure_approved: boolean | null
          submitted_at: string | null
          target_defense_date: string | null
          target_submission_date: string | null
          topic_approval_authority_type: string | null
          topic_approved: boolean | null
          updated_at: string
        }
        Insert: {
          academic_project_id: string
          ai_data_safety_acknowledged?: boolean
          ai_disclosure_state?: string
          ai_mentor_consultation?: string
          ai_policy_ruleset_id?: string | null
          ai_policy_ruleset_version?: string | null
          ai_policy_verified_at?: string | null
          created_at?: string
          deadline_authority_type?: string
          deadline_source_id?: string | null
          deadline_source_label?: string | null
          defended_at?: string | null
          defense_approval_authority_type?: string | null
          defense_approved?: boolean | null
          mentor_last_seen_version_label?: string | null
          mentor_last_sent_at?: string | null
          mentor_last_sent_version_label?: string | null
          mentor_waiting_for_response?: boolean
          methodology_approval_authority_type?: string | null
          methodology_approved?: boolean | null
          stage?: string
          structure_approval_authority_type?: string | null
          structure_approved?: boolean | null
          submitted_at?: string | null
          target_defense_date?: string | null
          target_submission_date?: string | null
          topic_approval_authority_type?: string | null
          topic_approved?: boolean | null
          updated_at?: string
        }
        Update: {
          academic_project_id?: string
          ai_data_safety_acknowledged?: boolean
          ai_disclosure_state?: string
          ai_mentor_consultation?: string
          ai_policy_ruleset_id?: string | null
          ai_policy_ruleset_version?: string | null
          ai_policy_verified_at?: string | null
          created_at?: string
          deadline_authority_type?: string
          deadline_source_id?: string | null
          deadline_source_label?: string | null
          defended_at?: string | null
          defense_approval_authority_type?: string | null
          defense_approved?: boolean | null
          mentor_last_seen_version_label?: string | null
          mentor_last_sent_at?: string | null
          mentor_last_sent_version_label?: string | null
          mentor_waiting_for_response?: boolean
          methodology_approval_authority_type?: string | null
          methodology_approved?: boolean | null
          stage?: string
          structure_approval_authority_type?: string | null
          structure_approved?: boolean | null
          submitted_at?: string | null
          target_defense_date?: string | null
          target_submission_date?: string | null
          topic_approval_authority_type?: string | null
          topic_approved?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'completion_project_state_academic_project_id_fkey'
            columns: ['academic_project_id']
            isOneToOne: true
            referencedRelation: 'academic_projects'
            referencedColumns: ['id']
          },
        ]
      }
      completion_tasks: {
        Row: {
          academic_project_id: string
          authority_source_id: string | null
          authority_source_label: string | null
          authority_type: string
          capability: string | null
          created_at: string
          id: string
          priority: string
          related_lekta_finding_ids: string[]
          related_rule_ids: string[]
          stage: string
          status: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          academic_project_id: string
          authority_source_id?: string | null
          authority_source_label?: string | null
          authority_type: string
          capability?: string | null
          created_at?: string
          id?: string
          priority?: string
          related_lekta_finding_ids?: string[]
          related_rule_ids?: string[]
          stage: string
          status?: string
          task_type: string
          title: string
          updated_at?: string
        }
        Update: {
          academic_project_id?: string
          authority_source_id?: string | null
          authority_source_label?: string | null
          authority_type?: string
          capability?: string | null
          created_at?: string
          id?: string
          priority?: string
          related_lekta_finding_ids?: string[]
          related_rule_ids?: string[]
          stage?: string
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'completion_tasks_academic_project_id_fkey'
            columns: ['academic_project_id']
            isOneToOne: false
            referencedRelation: 'academic_projects'
            referencedColumns: ['id']
          },
        ]
      }
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
        Relationships: [
          {
            foreignKeyName: 'entitlements_academic_project_id_fkey'
            columns: ['academic_project_id']
            isOneToOne: false
            referencedRelation: 'academic_projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'entitlements_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
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
