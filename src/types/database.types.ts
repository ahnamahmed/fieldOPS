export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          alternate_phone: string | null
          billing_address: string | null
          company_name: string | null
          contact_name: string
          created_at: string
          customer_type: string
          email: string | null
          id: string
          is_archived: boolean
          name: string | null
          notes: string | null
          organization_id: string
          phone: string
          updated_at: string
        }
        Insert: {
          alternate_phone?: string | null
          billing_address?: string | null
          company_name?: string | null
          contact_name: string
          created_at?: string
          customer_type?: string
          email?: string | null
          id?: string
          is_archived?: boolean
          name?: string | null
          notes?: string | null
          organization_id: string
          phone: string
          updated_at?: string
        }
        Update: {
          alternate_phone?: string | null
          billing_address?: string | null
          company_name?: string | null
          contact_name?: string
          created_at?: string
          customer_type?: string
          email?: string | null
          id?: string
          is_archived?: boolean
          name?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_sequences: {
        Row: {
          current_val: number
          document_type: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          current_val?: number
          document_type: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          current_val?: number
          document_type?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_assets: {
        Row: {
          asset_tag: string | null
          brand: string
          capacity: string | null
          condition_status: string
          created_at: string
          customer_id: string
          equipment_type: string
          id: string
          installation_date: string | null
          is_archived: boolean
          location_description: string | null
          location_in_facility: string | null
          model: string | null
          model_number: string | null
          notes: string | null
          organization_id: string
          refrigerant_type: string | null
          serial_number: string | null
          service_notes: string | null
          service_site_id: string | null
          site_id: string
          updated_at: string
          warranty_expiry: string | null
        }
        Insert: {
          asset_tag?: string | null
          brand: string
          capacity?: string | null
          condition_status?: string
          created_at?: string
          customer_id: string
          equipment_type: string
          id?: string
          installation_date?: string | null
          is_archived?: boolean
          location_description?: string | null
          location_in_facility?: string | null
          model?: string | null
          model_number?: string | null
          notes?: string | null
          organization_id: string
          refrigerant_type?: string | null
          serial_number?: string | null
          service_notes?: string | null
          service_site_id?: string | null
          site_id: string
          updated_at?: string
          warranty_expiry?: string | null
        }
        Update: {
          asset_tag?: string | null
          brand?: string
          capacity?: string | null
          condition_status?: string
          created_at?: string
          customer_id?: string
          equipment_type?: string
          id?: string
          installation_date?: string | null
          is_archived?: boolean
          location_description?: string | null
          location_in_facility?: string | null
          model?: string | null
          model_number?: string | null
          notes?: string | null
          organization_id?: string
          refrigerant_type?: string | null
          serial_number?: string | null
          service_notes?: string | null
          service_site_id?: string | null
          site_id?: string
          updated_at?: string
          warranty_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_assets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assets_service_site_id_fkey"
            columns: ["service_site_id"]
            isOneToOne: false
            referencedRelation: "service_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "service_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_equipment_customer_org"
            columns: ["customer_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "fk_equipment_site_org"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "service_sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          line_total: number
          quantity: number
          sort_order: number | null
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          line_total: number
          quantity: number
          sort_order?: number | null
          unit_price: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          quantity?: number
          sort_order?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance_due: number
          created_at: string
          customer_id: string
          discount_amount: number
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          job_id: string | null
          notes: string | null
          organization_id: string
          paid_amount: number
          payment_terms: string | null
          quote_id: string | null
          status: string
          subtotal: number
          total_amount: number
          updated_at: string
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          balance_due?: number
          created_at?: string
          customer_id: string
          discount_amount?: number
          due_date: string
          id?: string
          invoice_number: string
          issue_date?: string
          job_id?: string | null
          notes?: string | null
          organization_id: string
          paid_amount?: number
          payment_terms?: string | null
          quote_id?: string | null
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          balance_due?: number
          created_at?: string
          customer_id?: string
          discount_amount?: number
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          job_id?: string | null
          notes?: string | null
          organization_id?: string
          paid_amount?: number
          payment_terms?: string | null
          quote_id?: string | null
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      job_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assignment_status: string
          id: string
          is_lead: boolean
          job_id: string
          organization_id: string
          technician_id: string
          technician_user_id: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_status?: string
          id?: string
          is_lead?: boolean
          job_id: string
          organization_id: string
          technician_id: string
          technician_user_id?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_status?: string
          id?: string
          is_lead?: boolean
          job_id?: string
          organization_id?: string
          technician_id?: string
          technician_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_job_assignments_job_org"
            columns: ["job_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "job_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_attachments: {
        Row: {
          attachment_type: string
          caption: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size_bytes: number
          id: string
          job_id: string
          mime_type: string
          organization_id: string
          uploaded_by: string | null
          visit_id: string | null
        }
        Insert: {
          attachment_type: string
          caption?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size_bytes: number
          id?: string
          job_id: string
          mime_type: string
          organization_id: string
          uploaded_by?: string | null
          visit_id?: string | null
        }
        Update: {
          attachment_type?: string
          caption?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number
          id?: string
          job_id?: string
          mime_type?: string
          organization_id?: string
          uploaded_by?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_attachments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_attachments_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "job_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      job_checklists: {
        Row: {
          field_type: string
          id: string
          is_mandatory: boolean
          item_key: string
          job_id: string
          label: string
          organization_id: string
          passed: boolean | null
          recorded_at: string
          recorded_by: string | null
          value_boolean: boolean | null
          value_number: number | null
          value_text: string | null
          visit_id: string | null
        }
        Insert: {
          field_type: string
          id?: string
          is_mandatory?: boolean
          item_key: string
          job_id: string
          label: string
          organization_id: string
          passed?: boolean | null
          recorded_at?: string
          recorded_by?: string | null
          value_boolean?: boolean | null
          value_number?: number | null
          value_text?: string | null
          visit_id?: string | null
        }
        Update: {
          field_type?: string
          id?: string
          is_mandatory?: boolean
          item_key?: string
          job_id?: string
          label?: string
          organization_id?: string
          passed?: boolean | null
          recorded_at?: string
          recorded_by?: string | null
          value_boolean?: boolean | null
          value_number?: number | null
          value_text?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_checklists_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_checklists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_checklists_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_checklists_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "job_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      job_parts_used: {
        Row: {
          created_at: string
          id: string
          is_billable: boolean
          job_id: string
          organization_id: string
          part_name: string
          quantity: number
          unit_cost: number
          unit_of_measure: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_billable?: boolean
          job_id: string
          organization_id: string
          part_name: string
          quantity: number
          unit_cost?: number
          unit_of_measure?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_billable?: boolean
          job_id?: string
          organization_id?: string
          part_name?: string
          quantity?: number
          unit_cost?: number
          unit_of_measure?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_parts_used_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_parts_used_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_visits: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          created_at: string
          customer_sign_name: string | null
          customer_signature_url: string | null
          id: string
          job_id: string
          organization_id: string
          scheduled_end: string
          scheduled_start: string
          status: string
          technician_notes: string | null
          updated_at: string
          visit_number: number
          visit_status: string | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          customer_sign_name?: string | null
          customer_signature_url?: string | null
          id?: string
          job_id: string
          organization_id: string
          scheduled_end: string
          scheduled_start: string
          status?: string
          technician_notes?: string | null
          updated_at?: string
          visit_number?: number
          visit_status?: string | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          customer_sign_name?: string | null
          customer_signature_url?: string | null
          id?: string
          job_id?: string
          organization_id?: string
          scheduled_end?: string
          scheduled_start?: string
          status?: string
          technician_notes?: string | null
          updated_at?: string
          visit_number?: number
          visit_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_job_visits_job_org"
            columns: ["job_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "job_visits_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_visits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          asset_id: string | null
          assigned_notes: string | null
          completed_at: string | null
          completion_notes: string | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          description: string | null
          equipment_asset_id: string | null
          estimated_duration: number | null
          estimated_duration_minutes: number | null
          id: string
          job_number: string
          job_type: string
          organization_id: string
          priority: string
          request_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          service_site_id: string | null
          site_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          assigned_notes?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          description?: string | null
          equipment_asset_id?: string | null
          estimated_duration?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          job_number: string
          job_type: string
          organization_id: string
          priority?: string
          request_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          service_site_id?: string | null
          site_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          assigned_notes?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          description?: string | null
          equipment_asset_id?: string | null
          estimated_duration?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          job_number?: string
          job_type?: string
          organization_id?: string
          priority?: string
          request_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          service_site_id?: string | null
          site_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_jobs_asset_org"
            columns: ["asset_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "equipment_assets"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "fk_jobs_customer_org"
            columns: ["customer_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "fk_jobs_site_org"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "service_sites"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "equipment_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "service_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          city: string
          contact_email: string | null
          contact_phone: string
          created_at: string
          currency: string
          id: string
          name: string
          settings: Json
          slug: string
          tax_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string
          contact_email?: string | null
          contact_phone: string
          created_at?: string
          currency?: string
          id?: string
          name: string
          settings?: Json
          slug: string
          tax_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string
          contact_email?: string | null
          contact_phone?: string
          created_at?: string
          currency?: string
          id?: string
          name?: string
          settings?: Json
          slug?: string
          tax_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          organization_id: string
          payment_date: string
          payment_method: string
          recorded_by: string
          status: string
          transaction_reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          organization_id: string
          payment_date?: string
          payment_method: string
          recorded_by: string
          status?: string
          transaction_reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          organization_id?: string
          payment_date?: string
          payment_method?: string
          recorded_by?: string
          status?: string
          transaction_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          description: string
          id: string
          line_total: number
          quantity: number
          quote_id: string
          sort_order: number | null
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          line_total: number
          quantity: number
          quote_id: string
          sort_order?: number | null
          unit_price: number
        }
        Update: {
          description?: string
          id?: string
          line_total?: number
          quantity?: number
          quote_id?: string
          sort_order?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          created_at: string
          customer_id: string
          discount_amount: number
          id: string
          job_id: string | null
          notes: string | null
          organization_id: string
          quote_number: string
          status: string
          subtotal: number
          terms: string | null
          total_amount: number
          updated_at: string
          valid_until: string | null
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          customer_id: string
          discount_amount?: number
          id?: string
          job_id?: string | null
          notes?: string | null
          organization_id: string
          quote_number: string
          status?: string
          subtotal?: number
          terms?: string | null
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          customer_id?: string
          discount_amount?: number
          id?: string
          job_id?: string | null
          notes?: string | null
          organization_id?: string
          quote_number?: string
          status?: string
          subtotal?: number
          terms?: string | null
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contract_assets: {
        Row: {
          asset_id: string
          contract_id: string
          id: string
        }
        Insert: {
          asset_id: string
          contract_id: string
          id?: string
        }
        Update: {
          asset_id?: string
          contract_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_contract_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "equipment_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contract_assets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contract_schedules: {
        Row: {
          contract_id: string
          created_at: string
          generated_job_id: string | null
          id: string
          scheduled_date: string
          status: string
          visit_title: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          generated_job_id?: string | null
          id?: string
          scheduled_date: string
          status?: string
          visit_title: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          generated_job_id?: string | null
          id?: string
          scheduled_date?: string
          status?: string
          visit_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_contract_schedules_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contract_schedules_generated_job_id_fkey"
            columns: ["generated_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contracts: {
        Row: {
          billing_frequency: string
          contract_number: string
          contract_type: string
          created_at: string
          customer_id: string
          end_date: string
          id: string
          organization_id: string
          service_interval_months: number
          special_terms: string | null
          start_date: string
          status: string
          title: string
          total_contract_value: number
          updated_at: string
        }
        Insert: {
          billing_frequency: string
          contract_number: string
          contract_type: string
          created_at?: string
          customer_id: string
          end_date: string
          id?: string
          organization_id: string
          service_interval_months?: number
          special_terms?: string | null
          start_date: string
          status?: string
          title: string
          total_contract_value?: number
          updated_at?: string
        }
        Update: {
          billing_frequency?: string
          contract_number?: string
          contract_type?: string
          created_at?: string
          customer_id?: string
          end_date?: string
          id?: string
          organization_id?: string
          service_interval_months?: number
          special_terms?: string | null
          start_date?: string
          status?: string
          title?: string
          total_contract_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          contact_name: string
          contact_phone: string
          created_at: string
          customer_id: string | null
          description: string
          id: string
          intake_status: string
          organization_id: string
          priority: string
          request_number: string
          service_site_id: string | null
          site_id: string | null
          source: string
          status: string
          title: string
          updated_at: string
          urgency: string
        }
        Insert: {
          contact_name: string
          contact_phone: string
          created_at?: string
          customer_id?: string | null
          description: string
          id?: string
          intake_status?: string
          organization_id: string
          priority?: string
          request_number: string
          service_site_id?: string | null
          site_id?: string | null
          source?: string
          status?: string
          title: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          contact_name?: string
          contact_phone?: string
          created_at?: string
          customer_id?: string | null
          description?: string
          id?: string
          intake_status?: string
          organization_id?: string
          priority?: string
          request_number?: string
          service_site_id?: string | null
          site_id?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_requests_customer_org"
            columns: ["customer_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "fk_requests_site_org"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "service_sites"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "service_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "service_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      service_sites: {
        Row: {
          access_instructions: string | null
          access_notes: string | null
          address: string | null
          address_line1: string
          address_line2: string | null
          area: string | null
          city: string
          created_at: string
          customer_id: string
          district: string
          id: string
          is_archived: boolean
          landmark: string | null
          organization_id: string
          postal_code: string | null
          postcode: string | null
          site_contact_name: string | null
          site_contact_phone: string | null
          site_name: string
          updated_at: string
        }
        Insert: {
          access_instructions?: string | null
          access_notes?: string | null
          address?: string | null
          address_line1: string
          address_line2?: string | null
          area?: string | null
          city?: string
          created_at?: string
          customer_id: string
          district?: string
          id?: string
          is_archived?: boolean
          landmark?: string | null
          organization_id: string
          postal_code?: string | null
          postcode?: string | null
          site_contact_name?: string | null
          site_contact_phone?: string | null
          site_name: string
          updated_at?: string
        }
        Update: {
          access_instructions?: string | null
          access_notes?: string | null
          address?: string | null
          address_line1?: string
          address_line2?: string | null
          area?: string | null
          city?: string
          created_at?: string
          customer_id?: string
          district?: string
          id?: string
          is_archived?: boolean
          landmark?: string | null
          organization_id?: string
          postal_code?: string | null
          postcode?: string | null
          site_contact_name?: string | null
          site_contact_phone?: string | null
          site_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_service_sites_customer_org"
            columns: ["customer_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "service_sites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_sites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization_with_owner:
        | {
            Args: {
              city?: string
              contact_phone: string
              org_name: string
              org_slug: string
            }
            Returns: string
          }
        | {
            Args: {
              address?: string
              city?: string
              contact_email?: string
              contact_phone: string
              currency?: string
              org_name: string
              org_slug: string
              timezone?: string
            }
            Returns: string
          }
      get_next_document_number: {
        Args: { doc_type: string; prefix: string; target_org_id: string }
        Returns: string
      }
      get_user_membership_details: {
        Args: never
        Returns: {
          currency: string
          organization_id: string
          organization_name: string
          organization_slug: string
          role: string
          status: string
          timezone: string
        }[]
      }
      get_user_organizations: { Args: never; Returns: string[] }
      user_has_role: {
        Args: { allowed_roles: string[]; target_org_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
