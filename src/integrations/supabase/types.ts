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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      ai_catalog_connections: {
        Row: {
          connected: boolean
          created_at: string
          id: string
          organization_id: string
          shopify_product_id: number
          updated_at: string
        }
        Insert: {
          connected?: boolean
          created_at?: string
          id?: string
          organization_id: string
          shopify_product_id: number
          updated_at?: string
        }
        Update: {
          connected?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          shopify_product_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_catalog_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generations: {
        Row: {
          created_at: string
          id: string
          model: string
          prompt: string
          result: string
          tokens_used: number
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          model: string
          prompt: string
          result: string
          tokens_used?: number
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          prompt?: string
          result?: string
          tokens_used?: number
          type?: string
        }
        Relationships: []
      }
      alegra_invoices: {
        Row: {
          alegra_invoice_id: number
          alegra_invoice_number: string | null
          created_at: string | null
          cufe: string | null
          id: string
          organization_id: string
          shopify_order_id: number
          shopify_order_number: string
          stamped: boolean | null
          stamped_at: string | null
          updated_at: string | null
        }
        Insert: {
          alegra_invoice_id: number
          alegra_invoice_number?: string | null
          created_at?: string | null
          cufe?: string | null
          id?: string
          organization_id: string
          shopify_order_id: number
          shopify_order_number: string
          stamped?: boolean | null
          stamped_at?: string | null
          updated_at?: string | null
        }
        Update: {
          alegra_invoice_id?: number
          alegra_invoice_number?: string | null
          created_at?: string | null
          cufe?: string | null
          id?: string
          organization_id?: string
          shopify_order_id?: number
          shopify_order_number?: string
          stamped?: boolean | null
          stamped_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alegra_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alegra_product_mapping: {
        Row: {
          alegra_item_id: string
          alegra_item_name: string | null
          created_at: string | null
          id: string
          organization_id: string
          shopify_product_title: string
          shopify_sku: string | null
          shopify_variant_title: string | null
          updated_at: string | null
        }
        Insert: {
          alegra_item_id: string
          alegra_item_name?: string | null
          created_at?: string | null
          id?: string
          organization_id: string
          shopify_product_title: string
          shopify_sku?: string | null
          shopify_variant_title?: string | null
          updated_at?: string | null
        }
        Update: {
          alegra_item_id?: string
          alegra_item_name?: string | null
          created_at?: string | null
          id?: string
          organization_id?: string
          shopify_product_title?: string
          shopify_sku?: string | null
          shopify_variant_title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alegra_product_mapping_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          rate_limit: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          rate_limit?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          rate_limit?: number
        }
        Relationships: []
      }
      automation_enrollments: {
        Row: {
          automation_id: string
          completed_at: string | null
          contact_id: string
          current_step_id: string | null
          enrolled_at: string
          id: string
          next_action_at: string | null
          status: string
        }
        Insert: {
          automation_id: string
          completed_at?: string | null
          contact_id: string
          current_step_id?: string | null
          enrolled_at?: string
          id?: string
          next_action_at?: string | null
          status?: string
        }
        Update: {
          automation_id?: string
          completed_at?: string | null
          contact_id?: string
          current_step_id?: string | null
          enrolled_at?: string
          id?: string
          next_action_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_enrollments_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_enrollments_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "automation_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_steps: {
        Row: {
          automation_id: string
          config: Json | null
          created_at: string
          id: string
          step_order: number
          step_type: string
        }
        Insert: {
          automation_id: string
          config?: Json | null
          created_at?: string
          id?: string
          step_order?: number
          step_type: string
        }
        Update: {
          automation_id?: string
          config?: Json | null
          created_at?: string
          id?: string
          step_order?: number
          step_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_steps_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          total_completed: number
          total_enrolled: number
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          total_completed?: number
          total_enrolled?: number
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          total_completed?: number
          total_enrolled?: number
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaign_discount_codes: {
        Row: {
          campaign_id: string
          discount_code_id: string
        }
        Insert: {
          campaign_id: string
          discount_code_id: string
        }
        Update: {
          campaign_id?: string
          discount_code_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_discount_codes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_discount_codes_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "shopify_discount_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          ab_test_duration_hours: number | null
          ab_test_enabled: boolean
          ab_test_sample_percentage: number | null
          ab_test_subject_b: string | null
          ab_test_winner: string | null
          ab_test_winner_criteria: string | null
          created_at: string
          design: Json | null
          estimated_recipients: number | null
          exclude_list_ids: string[] | null
          from_email: string | null
          from_name: string | null
          html: string | null
          id: string
          name: string
          preview_text: string | null
          recipient_list_ids: string[] | null
          recipient_segment_ids: string[] | null
          recipient_tag_ids: string[] | null
          recipient_type: string
          reply_to: string | null
          scheduled_at: string | null
          sending_completed_at: string | null
          sending_started_at: string | null
          status: string
          subject: string | null
          template_id: string | null
          total_bounced: number
          total_clicked: number
          total_complained: number
          total_delivered: number
          total_opened: number
          total_orders: number
          total_revenue: number
          total_sent: number
          total_unsubscribed: number
          updated_at: string
        }
        Insert: {
          ab_test_duration_hours?: number | null
          ab_test_enabled?: boolean
          ab_test_sample_percentage?: number | null
          ab_test_subject_b?: string | null
          ab_test_winner?: string | null
          ab_test_winner_criteria?: string | null
          created_at?: string
          design?: Json | null
          estimated_recipients?: number | null
          exclude_list_ids?: string[] | null
          from_email?: string | null
          from_name?: string | null
          html?: string | null
          id?: string
          name: string
          preview_text?: string | null
          recipient_list_ids?: string[] | null
          recipient_segment_ids?: string[] | null
          recipient_tag_ids?: string[] | null
          recipient_type?: string
          reply_to?: string | null
          scheduled_at?: string | null
          sending_completed_at?: string | null
          sending_started_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          total_bounced?: number
          total_clicked?: number
          total_complained?: number
          total_delivered?: number
          total_opened?: number
          total_orders?: number
          total_revenue?: number
          total_sent?: number
          total_unsubscribed?: number
          updated_at?: string
        }
        Update: {
          ab_test_duration_hours?: number | null
          ab_test_enabled?: boolean
          ab_test_sample_percentage?: number | null
          ab_test_subject_b?: string | null
          ab_test_winner?: string | null
          ab_test_winner_criteria?: string | null
          created_at?: string
          design?: Json | null
          estimated_recipients?: number | null
          exclude_list_ids?: string[] | null
          from_email?: string | null
          from_name?: string | null
          html?: string | null
          id?: string
          name?: string
          preview_text?: string | null
          recipient_list_ids?: string[] | null
          recipient_segment_ids?: string[] | null
          recipient_tag_ids?: string[] | null
          recipient_type?: string
          reply_to?: string | null
          scheduled_at?: string | null
          sending_completed_at?: string | null
          sending_started_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          total_bounced?: number
          total_clicked?: number
          total_complained?: number
          total_delivered?: number
          total_opened?: number
          total_orders?: number
          total_revenue?: number
          total_sent?: number
          total_unsubscribed?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_lists: {
        Row: {
          contact_id: string
          created_at: string
          list_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          list_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_lists_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_lists_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_segments: {
        Row: {
          contact_id: string
          created_at: string
          segment_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          segment_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_segments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_segments_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          contact_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          average_order_value: number
          birthday: string | null
          children_ages: Json | null
          city: string | null
          created_at: string
          custom_fields: Json | null
          department: string | null
          email: string
          email_consent: boolean
          email_consent_at: string | null
          emails_clicked: number
          emails_opened: number
          emails_sent: number
          first_name: string | null
          first_order_at: string | null
          id: string
          last_email_clicked_at: string | null
          last_email_opened_at: string | null
          last_name: string | null
          last_order_at: string | null
          lifecycle_stage: string
          phone: string | null
          preferred_sizes: Json | null
          rfm_frequency_score: number | null
          rfm_last_calculated_at: string | null
          rfm_monetary_score: number | null
          rfm_recency_score: number | null
          rfm_segment: string | null
          rfm_total_score: number | null
          shopify_customer_id: string | null
          sms_consent: boolean
          source: string | null
          status: string
          total_orders: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          average_order_value?: number
          birthday?: string | null
          children_ages?: Json | null
          city?: string | null
          created_at?: string
          custom_fields?: Json | null
          department?: string | null
          email: string
          email_consent?: boolean
          email_consent_at?: string | null
          emails_clicked?: number
          emails_opened?: number
          emails_sent?: number
          first_name?: string | null
          first_order_at?: string | null
          id?: string
          last_email_clicked_at?: string | null
          last_email_opened_at?: string | null
          last_name?: string | null
          last_order_at?: string | null
          lifecycle_stage?: string
          phone?: string | null
          preferred_sizes?: Json | null
          rfm_frequency_score?: number | null
          rfm_last_calculated_at?: string | null
          rfm_monetary_score?: number | null
          rfm_recency_score?: number | null
          rfm_segment?: string | null
          rfm_total_score?: number | null
          shopify_customer_id?: string | null
          sms_consent?: boolean
          source?: string | null
          status?: string
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          average_order_value?: number
          birthday?: string | null
          children_ages?: Json | null
          city?: string | null
          created_at?: string
          custom_fields?: Json | null
          department?: string | null
          email?: string
          email_consent?: boolean
          email_consent_at?: string | null
          emails_clicked?: number
          emails_opened?: number
          emails_sent?: number
          first_name?: string | null
          first_order_at?: string | null
          id?: string
          last_email_clicked_at?: string | null
          last_email_opened_at?: string | null
          last_name?: string | null
          last_order_at?: string | null
          lifecycle_stage?: string
          phone?: string | null
          preferred_sizes?: Json | null
          rfm_frequency_score?: number | null
          rfm_last_calculated_at?: string | null
          rfm_monetary_score?: number | null
          rfm_recency_score?: number | null
          rfm_segment?: string | null
          rfm_total_score?: number | null
          shopify_customer_id?: string | null
          sms_consent?: boolean
          source?: string | null
          status?: string
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          created_at: string
          delivered_by: string | null
          delivery_date: string | null
          id: string
          last_sync_attempt: string | null
          notes: string | null
          order_id: string
          organization_id: string | null
          recipient_address: string | null
          recipient_name: string | null
          recipient_phone: string | null
          status: string | null
          sync_attempts: number
          sync_error_message: string | null
          sync_lock_acquired_at: string | null
          sync_lock_acquired_by: string | null
          synced_to_shopify: boolean
          tracking_number: string | null
          updated_at: string
          user_observations: string | null
          workshop_id: string
        }
        Insert: {
          created_at?: string
          delivered_by?: string | null
          delivery_date?: string | null
          id?: string
          last_sync_attempt?: string | null
          notes?: string | null
          order_id: string
          organization_id?: string | null
          recipient_address?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          status?: string | null
          sync_attempts?: number
          sync_error_message?: string | null
          sync_lock_acquired_at?: string | null
          sync_lock_acquired_by?: string | null
          synced_to_shopify?: boolean
          tracking_number?: string | null
          updated_at?: string
          user_observations?: string | null
          workshop_id: string
        }
        Update: {
          created_at?: string
          delivered_by?: string | null
          delivery_date?: string | null
          id?: string
          last_sync_attempt?: string | null
          notes?: string | null
          order_id?: string
          organization_id?: string | null
          recipient_address?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          status?: string | null
          sync_attempts?: number
          sync_error_message?: string | null
          sync_lock_acquired_at?: string | null
          sync_lock_acquired_by?: string | null
          synced_to_shopify?: boolean
          tracking_number?: string | null
          updated_at?: string
          user_observations?: string | null
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_files: {
        Row: {
          created_at: string
          delivery_id: string
          file_category: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          notes: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          delivery_id: string
          file_category?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          notes?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          delivery_id?: string
          file_category?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          notes?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_files_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          created_at: string
          delivery_id: string
          id: string
          last_sync_attempt: string | null
          notes: string | null
          order_item_id: string
          quality_notes: string | null
          quality_status: string | null
          quantity_approved: number
          quantity_defective: number
          quantity_delivered: number
          sync_attempt_count: number
          sync_error_message: string | null
          synced_to_shopify: boolean
        }
        Insert: {
          created_at?: string
          delivery_id: string
          id?: string
          last_sync_attempt?: string | null
          notes?: string | null
          order_item_id: string
          quality_notes?: string | null
          quality_status?: string | null
          quantity_approved?: number
          quantity_defective?: number
          quantity_delivered: number
          sync_attempt_count?: number
          sync_error_message?: string | null
          synced_to_shopify?: boolean
        }
        Update: {
          created_at?: string
          delivery_id?: string
          id?: string
          last_sync_attempt?: string | null
          notes?: string | null
          order_item_id?: string
          quality_notes?: string | null
          quality_status?: string | null
          quantity_approved?: number
          quantity_defective?: number
          quantity_delivered?: number
          sync_attempt_count?: number
          sync_error_message?: string | null
          synced_to_shopify?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_payments: {
        Row: {
          advance_deduction: number
          advance_notes: string | null
          billable_units: number
          created_at: string
          created_by: string | null
          custom_advance_deduction: number | null
          delivery_id: string
          gross_amount: number
          id: string
          net_amount: number
          notes: string | null
          order_id: string
          organization_id: string | null
          paid_by: string | null
          payment_date: string | null
          payment_method: string | null
          payment_status: string
          reference_number: string | null
          total_units: number
          unit_price: number
          updated_at: string
          workshop_id: string
        }
        Insert: {
          advance_deduction?: number
          advance_notes?: string | null
          billable_units: number
          created_at?: string
          created_by?: string | null
          custom_advance_deduction?: number | null
          delivery_id: string
          gross_amount: number
          id?: string
          net_amount: number
          notes?: string | null
          order_id: string
          organization_id?: string | null
          paid_by?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          reference_number?: string | null
          total_units: number
          unit_price: number
          updated_at?: string
          workshop_id: string
        }
        Update: {
          advance_deduction?: number
          advance_notes?: string | null
          billable_units?: number
          created_at?: string
          created_by?: string | null
          custom_advance_deduction?: number | null
          delivery_id?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          order_id?: string
          organization_id?: string | null
          paid_by?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          reference_number?: string | null
          total_units?: number
          unit_price?: number
          updated_at?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_payments_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: true
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_payments_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          campaign_id: string | null
          contact_id: string | null
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          link_url: string | null
          metadata: Json | null
          queue_id: string | null
          tracking_id: string
          user_agent: string | null
        }
        Insert: {
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          link_url?: string | null
          metadata?: Json | null
          queue_id?: string | null
          tracking_id: string
          user_agent?: string | null
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          link_url?: string | null
          metadata?: Json | null
          queue_id?: string | null
          tracking_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "email_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          ab_variant: string | null
          attempts: number
          campaign_id: string | null
          contact_id: string | null
          created_at: string
          error_message: string | null
          from_email: string
          from_name: string | null
          html: string
          id: string
          max_attempts: number
          next_retry_at: string | null
          provider: string | null
          provider_message_id: string | null
          reply_to: string | null
          sent_at: string | null
          status: string
          subject: string
          to_email: string
          to_name: string | null
          tracking_id: string
          updated_at: string
        }
        Insert: {
          ab_variant?: string | null
          attempts?: number
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          from_email: string
          from_name?: string | null
          html: string
          id?: string
          max_attempts?: number
          next_retry_at?: string | null
          provider?: string | null
          provider_message_id?: string | null
          reply_to?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          to_email: string
          to_name?: string | null
          tracking_id: string
          updated_at?: string
        }
        Update: {
          ab_variant?: string | null
          attempts?: number
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          from_email?: string
          from_name?: string | null
          html?: string
          id?: string
          max_attempts?: number
          next_retry_at?: string | null
          provider?: string | null
          provider_message_id?: string | null
          reply_to?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
          to_name?: string | null
          tracking_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          design: Json | null
          html: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          subject: string | null
          thumbnail_url: string | null
          times_used: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          design?: Json | null
          html?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          subject?: string | null
          thumbnail_url?: string | null
          times_used?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          design?: Json | null
          html?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          subject?: string | null
          thumbnail_url?: string | null
          times_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      inventory_replenishment: {
        Row: {
          avg_daily_sales: number
          calculated_at: string
          calculation_date: string
          current_stock: number
          data_confidence: string
          days_of_supply: number | null
          id: string
          in_transit: number | null
          last_known_velocity: number | null
          orders_count_30d: number
          organization_id: string
          pending_production: number
          projected_demand_40d: number
          reason: string | null
          sales_30d: number
          status: string
          suggested_quantity: number
          urgency: string
          variant_id: string
        }
        Insert: {
          avg_daily_sales?: number
          calculated_at?: string
          calculation_date?: string
          current_stock?: number
          data_confidence?: string
          days_of_supply?: number | null
          id?: string
          in_transit?: number | null
          last_known_velocity?: number | null
          orders_count_30d?: number
          organization_id: string
          pending_production?: number
          projected_demand_40d?: number
          reason?: string | null
          sales_30d?: number
          status?: string
          suggested_quantity?: number
          urgency?: string
          variant_id: string
        }
        Update: {
          avg_daily_sales?: number
          calculated_at?: string
          calculation_date?: string
          current_stock?: number
          data_confidence?: string
          days_of_supply?: number | null
          id?: string
          in_transit?: number | null
          last_known_velocity?: number | null
          orders_count_30d?: number
          organization_id?: string
          pending_production?: number
          projected_demand_40d?: number
          reason?: string | null
          sales_30d?: number
          status?: string
          suggested_quantity?: number
          urgency?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_replenishment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_replenishment_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_sync_logs: {
        Row: {
          created_at: string
          delivery_id: string
          error_count: number
          id: string
          inventory_after: Json | null
          inventory_before: Json | null
          mathematical_verification: Json | null
          rollback_details: Json | null
          rollback_performed: boolean | null
          success_count: number
          sync_results: Json
          synced_at: string
          verification_status: string | null
        }
        Insert: {
          created_at?: string
          delivery_id: string
          error_count?: number
          id?: string
          inventory_after?: Json | null
          inventory_before?: Json | null
          mathematical_verification?: Json | null
          rollback_details?: Json | null
          rollback_performed?: boolean | null
          success_count?: number
          sync_results: Json
          synced_at?: string
          verification_status?: string | null
        }
        Update: {
          created_at?: string
          delivery_id?: string
          error_count?: number
          id?: string
          inventory_after?: Json | null
          inventory_before?: Json | null
          mathematical_verification?: Json | null
          rollback_details?: Json | null
          rollback_performed?: boolean | null
          success_count?: number
          sync_results?: Json
          synced_at?: string
          verification_status?: string | null
        }
        Relationships: []
      }
      lists: {
        Row: {
          contact_count: number
          created_at: string
          description: string | null
          dynamic_rules: Json | null
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          contact_count?: number
          created_at?: string
          description?: string | null
          dynamic_rules?: Json | null
          id?: string
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          contact_count?: number
          created_at?: string
          description?: string | null
          dynamic_rules?: Json | null
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      manifest_items: {
        Row: {
          created_at: string
          destination_city: string | null
          id: string
          manifest_id: string
          notes: string | null
          order_number: string
          recipient_name: string | null
          scan_status: string | null
          scanned_at: string | null
          scanned_by: string | null
          shipping_label_id: string
          shopify_order_id: number
          tracking_number: string
        }
        Insert: {
          created_at?: string
          destination_city?: string | null
          id?: string
          manifest_id: string
          notes?: string | null
          order_number: string
          recipient_name?: string | null
          scan_status?: string | null
          scanned_at?: string | null
          scanned_by?: string | null
          shipping_label_id: string
          shopify_order_id: number
          tracking_number: string
        }
        Update: {
          created_at?: string
          destination_city?: string | null
          id?: string
          manifest_id?: string
          notes?: string | null
          order_number?: string
          recipient_name?: string | null
          scan_status?: string | null
          scanned_at?: string | null
          scanned_by?: string | null
          shipping_label_id?: string
          shopify_order_id?: number
          tracking_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "manifest_items_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "shipping_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifest_items_shipping_label_id_fkey"
            columns: ["shipping_label_id"]
            isOneToOne: false
            referencedRelation: "shipping_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      material_deliveries: {
        Row: {
          created_at: string
          delivered_by: string | null
          delivery_date: string | null
          id: string
          material_id: string
          notes: string | null
          order_id: string | null
          organization_id: string | null
          quantity_consumed: number | null
          quantity_delivered: number
          quantity_remaining: number
          updated_at: string
          workshop_id: string
        }
        Insert: {
          created_at?: string
          delivered_by?: string | null
          delivery_date?: string | null
          id?: string
          material_id: string
          notes?: string | null
          order_id?: string | null
          organization_id?: string | null
          quantity_consumed?: number | null
          quantity_delivered: number
          quantity_remaining: number
          updated_at?: string
          workshop_id: string
        }
        Update: {
          created_at?: string
          delivered_by?: string | null
          delivery_date?: string | null
          id?: string
          material_id?: string
          notes?: string | null
          order_id?: string | null
          organization_id?: string | null
          quantity_consumed?: number | null
          quantity_delivered?: number
          quantity_remaining?: number
          updated_at?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_deliveries_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_deliveries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_deliveries_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      material_inventory: {
        Row: {
          created_at: string
          current_stock: number
          id: string
          location_id: string
          location_type: string
          material_id: string
          organization_id: string
          reserved_stock: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_stock?: number
          id?: string
          location_id: string
          location_type: string
          material_id: string
          organization_id: string
          reserved_stock?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_stock?: number
          id?: string
          location_id?: string
          location_type?: string
          material_id?: string
          organization_id?: string
          reserved_stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_inventory_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      material_transfers: {
        Row: {
          approved_by: string | null
          completed_by: string | null
          created_at: string
          from_location_id: string
          from_location_type: string
          id: string
          material_id: string
          notes: string | null
          organization_id: string
          quantity: number
          requested_by: string | null
          status: string
          to_location_id: string
          to_location_type: string
          transfer_date: string | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          completed_by?: string | null
          created_at?: string
          from_location_id: string
          from_location_type: string
          id?: string
          material_id: string
          notes?: string | null
          organization_id: string
          quantity: number
          requested_by?: string | null
          status?: string
          to_location_id: string
          to_location_type: string
          transfer_date?: string | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          completed_by?: string | null
          created_at?: string
          from_location_id?: string
          from_location_type?: string
          id?: string
          material_id?: string
          notes?: string | null
          organization_id?: string
          quantity?: number
          requested_by?: string | null
          status?: string
          to_location_id?: string
          to_location_type?: string
          transfer_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_transfers_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          category: string
          color: string | null
          created_at: string
          current_stock: number | null
          description: string | null
          id: string
          image_url: string | null
          min_stock_alert: number | null
          name: string
          organization_id: string | null
          sku: string
          supplier: string | null
          unit: string
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          category: string
          color?: string | null
          created_at?: string
          current_stock?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          min_stock_alert?: number | null
          name: string
          organization_id?: string | null
          sku: string
          supplier?: string | null
          unit: string
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string
          current_stock?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          min_stock_alert?: number | null
          name?: string
          organization_id?: string | null
          sku?: string
          supplier?: string | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_channels: {
        Row: {
          ai_config: Json | null
          ai_enabled: boolean | null
          channel_identifier: string | null
          channel_name: string | null
          channel_type: string
          created_at: string | null
          id: string
          is_active: boolean | null
          meta_account_id: string | null
          meta_page_id: string | null
          meta_phone_number_id: string | null
          organization_id: string
          updated_at: string | null
          webhook_verified: boolean | null
        }
        Insert: {
          ai_config?: Json | null
          ai_enabled?: boolean | null
          channel_identifier?: string | null
          channel_name?: string | null
          channel_type: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          meta_account_id?: string | null
          meta_page_id?: string | null
          meta_phone_number_id?: string | null
          organization_id: string
          updated_at?: string | null
          webhook_verified?: boolean | null
        }
        Update: {
          ai_config?: Json | null
          ai_enabled?: boolean | null
          channel_identifier?: string | null
          channel_name?: string | null
          channel_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          meta_account_id?: string | null
          meta_page_id?: string | null
          meta_phone_number_id?: string | null
          organization_id?: string
          updated_at?: string | null
          webhook_verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "messaging_channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_conversation_tag_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          conversation_id: string
          id: string
          tag_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          conversation_id: string
          id?: string
          tag_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          conversation_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messaging_conversation_tag_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "messaging_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_conversation_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "messaging_conversation_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_conversation_tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messaging_conversation_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_conversations: {
        Row: {
          ai_managed: boolean | null
          channel_id: string
          channel_type: string
          created_at: string | null
          external_user_id: string
          folder_id: string | null
          id: string
          is_pinned: boolean | null
          last_message_at: string | null
          last_message_preview: string | null
          metadata: Json | null
          organization_id: string
          profile_pic_url: string | null
          status: string | null
          unread_count: number | null
          updated_at: string | null
          user_identifier: string | null
          user_name: string | null
        }
        Insert: {
          ai_managed?: boolean | null
          channel_id: string
          channel_type: string
          created_at?: string | null
          external_user_id: string
          folder_id?: string | null
          id?: string
          is_pinned?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          metadata?: Json | null
          organization_id: string
          profile_pic_url?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
          user_identifier?: string | null
          user_name?: string | null
        }
        Update: {
          ai_managed?: boolean | null
          channel_id?: string
          channel_type?: string
          created_at?: string | null
          external_user_id?: string
          folder_id?: string | null
          id?: string
          is_pinned?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          metadata?: Json | null
          organization_id?: string
          profile_pic_url?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
          user_identifier?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messaging_conversations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "messaging_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_conversations_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "messaging_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_folders: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          organization_id: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          organization_id: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messaging_folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_messages: {
        Row: {
          channel_type: string
          content: string | null
          conversation_id: string
          delivered_at: string | null
          direction: string
          error_message: string | null
          external_message_id: string | null
          id: string
          media_mime_type: string | null
          media_url: string | null
          message_type: string | null
          metadata: Json | null
          read_at: string | null
          reply_to_message_id: string | null
          sender_type: string
          sent_at: string | null
        }
        Insert: {
          channel_type: string
          content?: string | null
          conversation_id: string
          delivered_at?: string | null
          direction: string
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_type: string
          sent_at?: string | null
        }
        Update: {
          channel_type?: string
          content?: string | null
          conversation_id?: string
          delivered_at?: string | null
          direction?: string
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_type?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messaging_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "messaging_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messaging_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_alignment: {
        Row: {
          child_objective_id: string
          created_at: string
          id: string
          parent_objective_id: string
        }
        Insert: {
          child_objective_id: string
          created_at?: string
          id?: string
          parent_objective_id: string
        }
        Update: {
          child_objective_id?: string
          created_at?: string
          id?: string
          parent_objective_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_alignment_child_objective_id_fkey"
            columns: ["child_objective_id"]
            isOneToOne: false
            referencedRelation: "okr_objective"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_alignment_parent_objective_id_fkey"
            columns: ["parent_objective_id"]
            isOneToOne: false
            referencedRelation: "okr_objective"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_checkin: {
        Row: {
          author_id: string
          blockers: string | null
          confidence: Database["public"]["Enums"]["okr_confidence"] | null
          created_at: string
          delta_value: number | null
          id: string
          kr_id: string
          note: string | null
          organization_id: string
          progress_pct: number | null
        }
        Insert: {
          author_id: string
          blockers?: string | null
          confidence?: Database["public"]["Enums"]["okr_confidence"] | null
          created_at?: string
          delta_value?: number | null
          id?: string
          kr_id: string
          note?: string | null
          organization_id: string
          progress_pct?: number | null
        }
        Update: {
          author_id?: string
          blockers?: string | null
          confidence?: Database["public"]["Enums"]["okr_confidence"] | null
          created_at?: string
          delta_value?: number | null
          id?: string
          kr_id?: string
          note?: string | null
          organization_id?: string
          progress_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "okr_checkin_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_checkin_kr_id_fkey"
            columns: ["kr_id"]
            isOneToOne: false
            referencedRelation: "okr_key_result"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_evidence: {
        Row: {
          created_at: string
          id: string
          kr_id: string
          label: string | null
          organization_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          kr_id: string
          label?: string | null
          organization_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          kr_id?: string
          label?: string | null
          organization_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_evidence_kr_id_fkey"
            columns: ["kr_id"]
            isOneToOne: false
            referencedRelation: "okr_key_result"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_incentive: {
        Row: {
          created_at: string
          id: string
          kr_id: string | null
          organization_id: string
          rule_key: string
          status: Database["public"]["Enums"]["okr_incentive_status"] | null
          updated_at: string
          user_id: string
          value_num: number | null
          value_type: Database["public"]["Enums"]["okr_incentive_value_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          kr_id?: string | null
          organization_id: string
          rule_key: string
          status?: Database["public"]["Enums"]["okr_incentive_status"] | null
          updated_at?: string
          user_id: string
          value_num?: number | null
          value_type: Database["public"]["Enums"]["okr_incentive_value_type"]
        }
        Update: {
          created_at?: string
          id?: string
          kr_id?: string | null
          organization_id?: string
          rule_key?: string
          status?: Database["public"]["Enums"]["okr_incentive_status"] | null
          updated_at?: string
          user_id?: string
          value_num?: number | null
          value_type?: Database["public"]["Enums"]["okr_incentive_value_type"]
        }
        Relationships: [
          {
            foreignKeyName: "okr_incentive_kr_id_fkey"
            columns: ["kr_id"]
            isOneToOne: false
            referencedRelation: "okr_key_result"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_incentive_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_key_result: {
        Row: {
          confidence: Database["public"]["Enums"]["okr_confidence"] | null
          created_at: string
          current_value: number | null
          data_source: Database["public"]["Enums"]["okr_data_source"] | null
          guardrail: boolean | null
          id: string
          objective_id: string
          organization_id: string
          owner_id: string
          private: boolean | null
          progress_pct: number | null
          target_value: number
          title: string
          unit: Database["public"]["Enums"]["okr_unit"] | null
          updated_at: string
        }
        Insert: {
          confidence?: Database["public"]["Enums"]["okr_confidence"] | null
          created_at?: string
          current_value?: number | null
          data_source?: Database["public"]["Enums"]["okr_data_source"] | null
          guardrail?: boolean | null
          id?: string
          objective_id: string
          organization_id: string
          owner_id: string
          private?: boolean | null
          progress_pct?: number | null
          target_value: number
          title: string
          unit?: Database["public"]["Enums"]["okr_unit"] | null
          updated_at?: string
        }
        Update: {
          confidence?: Database["public"]["Enums"]["okr_confidence"] | null
          created_at?: string
          current_value?: number | null
          data_source?: Database["public"]["Enums"]["okr_data_source"] | null
          guardrail?: boolean | null
          id?: string
          objective_id?: string
          organization_id?: string
          owner_id?: string
          private?: boolean | null
          progress_pct?: number | null
          target_value?: number
          title?: string
          unit?: Database["public"]["Enums"]["okr_unit"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_key_result_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "okr_objective"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_key_result_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_objective: {
        Row: {
          area: Database["public"]["Enums"]["okr_area"] | null
          created_at: string
          description: string | null
          id: string
          level: Database["public"]["Enums"]["okr_level"]
          organization_id: string
          owner_id: string
          parent_objective_id: string | null
          period_end: string
          period_start: string
          tier: Database["public"]["Enums"]["okr_tier"] | null
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["okr_visibility"] | null
        }
        Insert: {
          area?: Database["public"]["Enums"]["okr_area"] | null
          created_at?: string
          description?: string | null
          id?: string
          level: Database["public"]["Enums"]["okr_level"]
          organization_id: string
          owner_id: string
          parent_objective_id?: string | null
          period_end: string
          period_start: string
          tier?: Database["public"]["Enums"]["okr_tier"] | null
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["okr_visibility"] | null
        }
        Update: {
          area?: Database["public"]["Enums"]["okr_area"] | null
          created_at?: string
          description?: string | null
          id?: string
          level?: Database["public"]["Enums"]["okr_level"]
          organization_id?: string
          owner_id?: string
          parent_objective_id?: string | null
          period_end?: string
          period_start?: string
          tier?: Database["public"]["Enums"]["okr_tier"] | null
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["okr_visibility"] | null
        }
        Relationships: [
          {
            foreignKeyName: "okr_objective_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_objective_parent_objective_id_fkey"
            columns: ["parent_objective_id"]
            isOneToOne: false
            referencedRelation: "okr_objective"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_score_history: {
        Row: {
          id: string
          kr_id: string
          organization_id: string
          score_0_1: number
          scored_at: string
          scored_by: string
        }
        Insert: {
          id?: string
          kr_id: string
          organization_id: string
          score_0_1: number
          scored_at?: string
          scored_by: string
        }
        Update: {
          id?: string
          kr_id?: string
          organization_id?: string
          score_0_1?: number
          scored_at?: string
          scored_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_score_history_kr_id_fkey"
            columns: ["kr_id"]
            isOneToOne: false
            referencedRelation: "okr_key_result"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_score_history_scored_by_fkey"
            columns: ["scored_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_advances: {
        Row: {
          advance_date: string
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          notes: string | null
          order_id: string
          organization_id: string | null
          payment_method: string | null
          receipt_url: string | null
          reference_number: string | null
          updated_at: string
          workshop_id: string
        }
        Insert: {
          advance_date?: string
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          order_id: string
          organization_id?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          reference_number?: string | null
          updated_at?: string
          workshop_id: string
        }
        Update: {
          advance_date?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          order_id?: string
          organization_id?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          reference_number?: string | null
          updated_at?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_advances_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_advances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_advances_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      order_files: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          order_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          order_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_variant_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_variant_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_variant_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_supplies: {
        Row: {
          created_at: string
          id: string
          material_id: string
          notes: string | null
          order_id: string
          quantity: number
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          notes?: string | null
          order_id: string
          quantity: number
          unit: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          notes?: string | null
          order_id?: string
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_supplies_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_supplies_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_timeline_phases: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          form_data: Json | null
          id: string
          notes: string | null
          order_id: string
          organization_id: string
          phase_type: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          form_data?: Json | null
          id?: string
          notes?: string | null
          order_id: string
          organization_id: string
          phase_type: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          form_data?: Json | null
          id?: string
          notes?: string | null
          order_id?: string
          organization_id?: string
          phase_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_timeline_phases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          notes: string | null
          order_number: string
          organization_id: string | null
          status: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_number: string
          organization_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          organization_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_users: {
        Row: {
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          branding: Json | null
          created_at: string
          id: string
          max_orders_per_month: number | null
          max_users: number | null
          max_workshops: number | null
          name: string
          plan: string
          settings: Json | null
          shopify_credentials: Json | null
          shopify_store_url: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          branding?: Json | null
          created_at?: string
          id?: string
          max_orders_per_month?: number | null
          max_users?: number | null
          max_workshops?: number | null
          name: string
          plan?: string
          settings?: Json | null
          shopify_credentials?: Json | null
          shopify_store_url?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          branding?: Json | null
          created_at?: string
          id?: string
          max_orders_per_month?: number | null
          max_users?: number | null
          max_workshops?: number | null
          name?: string
          plan?: string
          settings?: Json | null
          shopify_credentials?: Json | null
          shopify_store_url?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_receipts: {
        Row: {
          delivery_payment_id: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          notes: string | null
          receipt_type: string
          upload_date: string
          uploaded_by: string | null
        }
        Insert: {
          delivery_payment_id: string
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          notes?: string | null
          receipt_type?: string
          upload_date?: string
          uploaded_by?: string | null
        }
        Update: {
          delivery_payment_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          notes?: string | null
          receipt_type?: string
          upload_date?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_delivery_payment_id_fkey"
            columns: ["delivery_payment_id"]
            isOneToOne: false
            referencedRelation: "delivery_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      picking_packing_orders: {
        Row: {
          created_at: string
          id: string
          internal_notes: string | null
          operational_status: string
          order_number: string
          organization_id: string
          packed_at: string | null
          packed_by: string | null
          picked_at: string | null
          picked_by: string | null
          shipped_at: string | null
          shipped_by: string | null
          shopify_order_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          internal_notes?: string | null
          operational_status?: string
          order_number: string
          organization_id: string
          packed_at?: string | null
          packed_by?: string | null
          picked_at?: string | null
          picked_by?: string | null
          shipped_at?: string | null
          shipped_by?: string | null
          shopify_order_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          internal_notes?: string | null
          operational_status?: string
          order_number?: string
          organization_id?: string
          packed_at?: string | null
          packed_by?: string | null
          picked_at?: string | null
          picked_by?: string | null
          shipped_at?: string | null
          shipped_by?: string | null
          shopify_order_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "picking_packing_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_packing_orders_shopify_order_id_fkey"
            columns: ["shopify_order_id"]
            isOneToOne: false
            referencedRelation: "shopify_orders"
            referencedColumns: ["shopify_order_id"]
          },
        ]
      }
      picking_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: string
          notes: string | null
          picking_order_id: string
          previous_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: string
          notes?: string | null
          picking_order_id: string
          previous_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: string
          notes?: string | null
          picking_order_id?: string
          previous_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "picking_status_history_picking_order_id_fkey"
            columns: ["picking_order_id"]
            isOneToOne: false
            referencedRelation: "picking_packing_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_email_clicks: {
        Row: {
          campaign_id: string | null
          clicked_at: string
          contact_id: string | null
          id: string
          product_id: string
          tracking_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          clicked_at?: string
          contact_id?: string | null
          id?: string
          product_id: string
          tracking_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          clicked_at?: string
          contact_id?: string | null
          id?: string
          product_id?: string
          tracking_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_email_clicks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_email_clicks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_email_clicks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shopify_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_embeddings: {
        Row: {
          created_at: string | null
          embedding: string | null
          id: string
          image_embedding: string | null
          image_url: string | null
          organization_id: string | null
          product_handle: string | null
          product_title: string
          shopify_product_id: number
          updated_at: string | null
          variants: Json | null
          visual_description: string | null
        }
        Insert: {
          created_at?: string | null
          embedding?: string | null
          id?: string
          image_embedding?: string | null
          image_url?: string | null
          organization_id?: string | null
          product_handle?: string | null
          product_title: string
          shopify_product_id: number
          updated_at?: string | null
          variants?: Json | null
          visual_description?: string | null
        }
        Update: {
          created_at?: string | null
          embedding?: string | null
          id?: string
          image_embedding?: string | null
          image_url?: string | null
          organization_id?: string | null
          product_handle?: string | null
          product_title?: string
          shopify_product_id?: number
          updated_at?: string | null
          variants?: Json | null
          visual_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_embeddings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_image_embeddings: {
        Row: {
          created_at: string | null
          id: string
          image_embedding: string | null
          image_index: number
          image_url: string | null
          product_embedding_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_embedding?: string | null
          image_index: number
          image_url?: string | null
          product_embedding_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_embedding?: string | null
          image_index?: number
          image_url?: string | null
          product_embedding_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_image_embeddings_product_embedding_id_fkey"
            columns: ["product_embedding_id"]
            isOneToOne: false
            referencedRelation: "product_embeddings"
            referencedColumns: ["id"]
          },
        ]
      }
      product_indexing_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          error_message: string | null
          id: string
          organization_id: string | null
          processed_at: string | null
          shopify_product_id: number
          status: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          organization_id?: string | null
          processed_at?: string | null
          shopify_product_id: number
          status?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          organization_id?: string | null
          processed_at?: string | null
          shopify_product_id?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_indexing_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock_history: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          product_variant_id: string
          recorded_at: string
          source: string
          stock_quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          product_variant_id: string
          recorded_at?: string
          source?: string
          stock_quantity: number
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          product_variant_id?: string
          recorded_at?: string
          source?: string
          stock_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_history_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          additional_price: number | null
          color: string | null
          created_at: string
          id: string
          product_id: string
          size: string | null
          sku_variant: string
          stock_quantity: number | null
          updated_at: string
          warehouse_location: string | null
        }
        Insert: {
          additional_price?: number | null
          color?: string | null
          created_at?: string
          id?: string
          product_id: string
          size?: string | null
          sku_variant: string
          stock_quantity?: number | null
          updated_at?: string
          warehouse_location?: string | null
        }
        Update: {
          additional_price?: number | null
          color?: string | null
          created_at?: string
          id?: string
          product_id?: string
          size?: string | null
          sku_variant?: string
          stock_quantity?: number | null
          updated_at?: string
          warehouse_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          organization_id: string | null
          sku: string
          status: string | null
          technical_file_url: string | null
          updated_at: string
        }
        Insert: {
          base_price?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          organization_id?: string | null
          sku: string
          status?: string | null
          technical_file_url?: string | null
          updated_at?: string
        }
        Update: {
          base_price?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          organization_id?: string | null
          sku?: string
          status?: string | null
          technical_file_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string
          locale: string | null
          name: string | null
          organization_id: string | null
          requires_password_change: boolean | null
          role: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          locale?: string | null
          name?: string | null
          organization_id?: string | null
          requires_password_change?: boolean | null
          role?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          locale?: string | null
          name?: string | null
          organization_id?: string | null
          requires_password_change?: boolean | null
          role?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["prospect_activity_type"]
          completed_date: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          organization_id: string
          prospect_id: string
          scheduled_date: string | null
          status: Database["public"]["Enums"]["prospect_activity_status"]
          title: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["prospect_activity_type"]
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id: string
          prospect_id: string
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["prospect_activity_status"]
          title: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["prospect_activity_type"]
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          prospect_id?: string
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["prospect_activity_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_activities_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "workshop_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_files: {
        Row: {
          created_at: string
          file_category: Database["public"]["Enums"]["prospect_file_category"]
          file_name: string
          file_type: string
          file_url: string
          id: string
          organization_id: string
          prospect_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_category?: Database["public"]["Enums"]["prospect_file_category"]
          file_name: string
          file_type: string
          file_url: string
          id?: string
          organization_id: string
          prospect_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_category?: Database["public"]["Enums"]["prospect_file_category"]
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          organization_id?: string
          prospect_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_files_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "workshop_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      role_change_audit: {
        Row: {
          action: string
          changed_by_user_id: string | null
          changed_user_id: string
          created_at: string | null
          id: string
          new_role_id: string | null
          old_role_id: string | null
          organization_id: string
        }
        Insert: {
          action: string
          changed_by_user_id?: string | null
          changed_user_id: string
          created_at?: string | null
          id?: string
          new_role_id?: string | null
          old_role_id?: string | null
          organization_id: string
        }
        Update: {
          action?: string
          changed_by_user_id?: string | null
          changed_user_id?: string
          created_at?: string | null
          id?: string
          new_role_id?: string | null
          old_role_id?: string | null
          organization_id?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          organization_id: string | null
          permissions: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          organization_id?: string | null
          permissions?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          organization_id?: string | null
          permissions?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_picking_filters: {
        Row: {
          created_at: string | null
          filters: Json
          id: string
          is_shared: boolean | null
          name: string
          organization_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          filters: Json
          id?: string
          is_shared?: boolean | null
          name: string
          organization_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          filters?: Json
          id?: string
          is_shared?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_picking_filters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          created_at: string | null
          event_details: Json | null
          event_type: string
          id: string
          ip_address: unknown
          organization_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_details?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown
          organization_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_details?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown
          organization_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      segments: {
        Row: {
          contact_count: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          last_evaluated_at: string | null
          name: string
          rfm_label: string | null
          rules: Json | null
          type: string
          updated_at: string
        }
        Insert: {
          contact_count?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_evaluated_at?: string | null
          name: string
          rfm_label?: string | null
          rules?: Json | null
          type?: string
          updated_at?: string
        }
        Update: {
          contact_count?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_evaluated_at?: string | null
          name?: string
          rfm_label?: string | null
          rules?: Json | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      shipping_coverage: {
        Row: {
          coordinadora: boolean | null
          created_at: string
          dane_code: string | null
          department: string
          deprisa: boolean | null
          id: string
          interrapidisimo: boolean | null
          municipality: string
          organization_id: string | null
          postal_code: string | null
          priority_carrier: string | null
          updated_at: string
        }
        Insert: {
          coordinadora?: boolean | null
          created_at?: string
          dane_code?: string | null
          department: string
          deprisa?: boolean | null
          id?: string
          interrapidisimo?: boolean | null
          municipality: string
          organization_id?: string | null
          postal_code?: string | null
          priority_carrier?: string | null
          updated_at?: string
        }
        Update: {
          coordinadora?: boolean | null
          created_at?: string
          dane_code?: string | null
          department?: string
          deprisa?: boolean | null
          id?: string
          interrapidisimo?: boolean | null
          municipality?: string
          organization_id?: string | null
          postal_code?: string | null
          priority_carrier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_coverage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_labels: {
        Row: {
          carrier: string
          cod_amount_requested: number | null
          cod_requested: boolean | null
          created_at: string
          created_by: string | null
          destination_address: string | null
          destination_city: string | null
          destination_department: string | null
          id: string
          label_url: string | null
          order_number: string
          organization_id: string
          raw_response: Json | null
          recipient_name: string | null
          recipient_phone: string | null
          shipment_id: string | null
          shopify_fulfillment_error: string | null
          shopify_fulfillment_id: string | null
          shopify_fulfillment_status: string | null
          shopify_order_id: number
          status: string | null
          total_price: number | null
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          carrier: string
          cod_amount_requested?: number | null
          cod_requested?: boolean | null
          created_at?: string
          created_by?: string | null
          destination_address?: string | null
          destination_city?: string | null
          destination_department?: string | null
          id?: string
          label_url?: string | null
          order_number: string
          organization_id: string
          raw_response?: Json | null
          recipient_name?: string | null
          recipient_phone?: string | null
          shipment_id?: string | null
          shopify_fulfillment_error?: string | null
          shopify_fulfillment_id?: string | null
          shopify_fulfillment_status?: string | null
          shopify_order_id: number
          status?: string | null
          total_price?: number | null
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string
          cod_amount_requested?: number | null
          cod_requested?: boolean | null
          created_at?: string
          created_by?: string | null
          destination_address?: string | null
          destination_city?: string | null
          destination_department?: string | null
          id?: string
          label_url?: string | null
          order_number?: string
          organization_id?: string
          raw_response?: Json | null
          recipient_name?: string | null
          recipient_phone?: string | null
          shipment_id?: string | null
          shopify_fulfillment_error?: string | null
          shopify_fulfillment_id?: string | null
          shopify_fulfillment_status?: string | null
          shopify_order_id?: number
          status?: string | null
          total_price?: number | null
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_labels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_manifests: {
        Row: {
          carrier: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          manifest_date: string
          manifest_number: string
          notes: string | null
          organization_id: string
          pickup_confirmed_at: string | null
          pickup_confirmed_by: string | null
          status: string
          total_packages: number | null
          total_verified: number | null
          updated_at: string
        }
        Insert: {
          carrier: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          manifest_date?: string
          manifest_number: string
          notes?: string | null
          organization_id: string
          pickup_confirmed_at?: string | null
          pickup_confirmed_by?: string | null
          status?: string
          total_packages?: number | null
          total_verified?: number | null
          updated_at?: string
        }
        Update: {
          carrier?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          manifest_date?: string
          manifest_number?: string
          notes?: string | null
          organization_id?: string
          pickup_confirmed_at?: string | null
          pickup_confirmed_by?: string | null
          status?: string
          total_packages?: number | null
          total_verified?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_manifests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_carts: {
        Row: {
          abandoned_at: string | null
          contact_id: string | null
          created_at: string
          id: string
          is_abandoned: boolean
          line_items: Json | null
          shopify_cart_token: string
          shopify_created_at: string | null
          total_price: number | null
          updated_at: string
        }
        Insert: {
          abandoned_at?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          is_abandoned?: boolean
          line_items?: Json | null
          shopify_cart_token: string
          shopify_created_at?: string | null
          total_price?: number | null
          updated_at?: string
        }
        Update: {
          abandoned_at?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          is_abandoned?: boolean
          line_items?: Json | null
          shopify_cart_token?: string
          shopify_created_at?: string | null
          total_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_carts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_collections: {
        Row: {
          created_at: string
          description: string | null
          handle: string | null
          id: string
          image_url: string | null
          products_count: number | null
          shopify_collection_id: string
          shopify_updated_at: string | null
          sort_order: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          handle?: string | null
          id?: string
          image_url?: string | null
          products_count?: number | null
          shopify_collection_id: string
          shopify_updated_at?: string | null
          sort_order?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          handle?: string | null
          id?: string
          image_url?: string | null
          products_count?: number | null
          shopify_collection_id?: string
          shopify_updated_at?: string | null
          sort_order?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      shopify_discount_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          last_synced_at: string | null
          price_rule_id: string
          shopify_created_at: string | null
          shopify_discount_code_id: string | null
          updated_at: string
          usage_count: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          price_rule_id: string
          shopify_created_at?: string | null
          shopify_discount_code_id?: string | null
          updated_at?: string
          usage_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          price_rule_id?: string
          shopify_created_at?: string | null
          shopify_discount_code_id?: string | null
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "shopify_discount_codes_price_rule_id_fkey"
            columns: ["price_rule_id"]
            isOneToOne: false
            referencedRelation: "shopify_price_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_order_line_items: {
        Row: {
          created_at: string
          fulfillment_service: string | null
          fulfillment_status: string | null
          gift_card: boolean | null
          id: string
          image_url: string | null
          organization_id: string
          price: number
          product_id: number | null
          product_type: string | null
          properties: Json | null
          quantity: number
          requires_shipping: boolean | null
          shopify_line_item_id: number
          shopify_order_id: number
          sku: string | null
          taxable: boolean | null
          title: string
          total_discount: number | null
          updated_at: string
          variant_id: number | null
          variant_title: string | null
          vendor: string | null
        }
        Insert: {
          created_at?: string
          fulfillment_service?: string | null
          fulfillment_status?: string | null
          gift_card?: boolean | null
          id?: string
          image_url?: string | null
          organization_id: string
          price: number
          product_id?: number | null
          product_type?: string | null
          properties?: Json | null
          quantity: number
          requires_shipping?: boolean | null
          shopify_line_item_id: number
          shopify_order_id: number
          sku?: string | null
          taxable?: boolean | null
          title: string
          total_discount?: number | null
          updated_at?: string
          variant_id?: number | null
          variant_title?: string | null
          vendor?: string | null
        }
        Update: {
          created_at?: string
          fulfillment_service?: string | null
          fulfillment_status?: string | null
          gift_card?: boolean | null
          id?: string
          image_url?: string | null
          organization_id?: string
          price?: number
          product_id?: number | null
          product_type?: string | null
          properties?: Json | null
          quantity?: number
          requires_shipping?: boolean | null
          shopify_line_item_id?: number
          shopify_order_id?: number
          sku?: string | null
          taxable?: boolean | null
          title?: string
          total_discount?: number | null
          updated_at?: string
          variant_id?: number | null
          variant_title?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopify_order_line_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_order_line_items_shopify_order_id_fkey"
            columns: ["shopify_order_id"]
            isOneToOne: false
            referencedRelation: "shopify_orders"
            referencedColumns: ["shopify_order_id"]
          },
        ]
      }
      shopify_orders: {
        Row: {
          alegra_cufe: string | null
          alegra_invoice_id: number | null
          alegra_invoice_number: string | null
          alegra_invoice_status: string | null
          alegra_stamped: boolean | null
          alegra_synced_at: string | null
          auto_invoice_processing: boolean | null
          auto_invoice_processing_at: string | null
          auto_invoice_retries: number | null
          billing_address: Json | null
          browser_ip: string | null
          cancelled_at: string | null
          closed_at: string | null
          contact_id: string | null
          created_at: string
          created_at_shopify: string
          currency: string | null
          customer_accepts_marketing: boolean | null
          customer_email: string | null
          customer_first_name: string | null
          customer_id: number | null
          customer_last_name: string | null
          customer_orders_count: number | null
          customer_phone: string | null
          customer_total_spent: number | null
          email: string | null
          financial_status: string | null
          fulfillment_status: string | null
          id: string
          landing_site: string | null
          line_items: Json | null
          note: string | null
          order_number: string
          order_source_url: string | null
          order_status_url: string | null
          organization_id: string
          processed_at: string | null
          raw_data: Json | null
          referring_site: string | null
          shipping_address: Json | null
          shopify_created_at: string | null
          shopify_order_id: number
          source_name: string | null
          subtotal_price: number | null
          sync_version: number | null
          synced_at: string
          tags: string | null
          total_discounts: number | null
          total_line_items_price: number | null
          total_price: number
          total_shipping: number | null
          total_tax: number | null
          updated_at: string
          updated_at_shopify: string
        }
        Insert: {
          alegra_cufe?: string | null
          alegra_invoice_id?: number | null
          alegra_invoice_number?: string | null
          alegra_invoice_status?: string | null
          alegra_stamped?: boolean | null
          alegra_synced_at?: string | null
          auto_invoice_processing?: boolean | null
          auto_invoice_processing_at?: string | null
          auto_invoice_retries?: number | null
          billing_address?: Json | null
          browser_ip?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_at_shopify: string
          currency?: string | null
          customer_accepts_marketing?: boolean | null
          customer_email?: string | null
          customer_first_name?: string | null
          customer_id?: number | null
          customer_last_name?: string | null
          customer_orders_count?: number | null
          customer_phone?: string | null
          customer_total_spent?: number | null
          email?: string | null
          financial_status?: string | null
          fulfillment_status?: string | null
          id?: string
          landing_site?: string | null
          line_items?: Json | null
          note?: string | null
          order_number: string
          order_source_url?: string | null
          order_status_url?: string | null
          organization_id: string
          processed_at?: string | null
          raw_data?: Json | null
          referring_site?: string | null
          shipping_address?: Json | null
          shopify_created_at?: string | null
          shopify_order_id: number
          source_name?: string | null
          subtotal_price?: number | null
          sync_version?: number | null
          synced_at?: string
          tags?: string | null
          total_discounts?: number | null
          total_line_items_price?: number | null
          total_price?: number
          total_shipping?: number | null
          total_tax?: number | null
          updated_at?: string
          updated_at_shopify: string
        }
        Update: {
          alegra_cufe?: string | null
          alegra_invoice_id?: number | null
          alegra_invoice_number?: string | null
          alegra_invoice_status?: string | null
          alegra_stamped?: boolean | null
          alegra_synced_at?: string | null
          auto_invoice_processing?: boolean | null
          auto_invoice_processing_at?: string | null
          auto_invoice_retries?: number | null
          billing_address?: Json | null
          browser_ip?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_at_shopify?: string
          currency?: string | null
          customer_accepts_marketing?: boolean | null
          customer_email?: string | null
          customer_first_name?: string | null
          customer_id?: number | null
          customer_last_name?: string | null
          customer_orders_count?: number | null
          customer_phone?: string | null
          customer_total_spent?: number | null
          email?: string | null
          financial_status?: string | null
          fulfillment_status?: string | null
          id?: string
          landing_site?: string | null
          line_items?: Json | null
          note?: string | null
          order_number?: string
          order_source_url?: string | null
          order_status_url?: string | null
          organization_id?: string
          processed_at?: string | null
          raw_data?: Json | null
          referring_site?: string | null
          shipping_address?: Json | null
          shopify_created_at?: string | null
          shopify_order_id?: number
          source_name?: string | null
          subtotal_price?: number | null
          sync_version?: number | null
          synced_at?: string
          tags?: string | null
          total_discounts?: number | null
          total_line_items_price?: number | null
          total_price?: number
          total_shipping?: number | null
          total_tax?: number | null
          updated_at?: string
          updated_at_shopify?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_price_rules: {
        Row: {
          allocation_method: string
          created_at: string
          customer_selection: string
          ends_at: string | null
          entitled_collection_ids: string[] | null
          entitled_product_ids: string[] | null
          id: string
          last_synced_at: string | null
          once_per_customer: boolean
          shopify_created_at: string | null
          shopify_price_rule_id: string | null
          shopify_updated_at: string | null
          starts_at: string
          status: string
          target_selection: string
          target_type: string
          title: string
          updated_at: string
          usage_limit: number | null
          value: number
          value_type: string
        }
        Insert: {
          allocation_method?: string
          created_at?: string
          customer_selection?: string
          ends_at?: string | null
          entitled_collection_ids?: string[] | null
          entitled_product_ids?: string[] | null
          id?: string
          last_synced_at?: string | null
          once_per_customer?: boolean
          shopify_created_at?: string | null
          shopify_price_rule_id?: string | null
          shopify_updated_at?: string | null
          starts_at?: string
          status?: string
          target_selection?: string
          target_type?: string
          title: string
          updated_at?: string
          usage_limit?: number | null
          value: number
          value_type?: string
        }
        Update: {
          allocation_method?: string
          created_at?: string
          customer_selection?: string
          ends_at?: string | null
          entitled_collection_ids?: string[] | null
          entitled_product_ids?: string[] | null
          id?: string
          last_synced_at?: string | null
          once_per_customer?: boolean
          shopify_created_at?: string | null
          shopify_price_rule_id?: string | null
          shopify_updated_at?: string | null
          starts_at?: string
          status?: string
          target_selection?: string
          target_type?: string
          title?: string
          updated_at?: string
          usage_limit?: number | null
          value?: number
          value_type?: string
        }
        Relationships: []
      }
      shopify_product_collections: {
        Row: {
          collection_id: string
          position: number | null
          product_id: string
        }
        Insert: {
          collection_id: string
          position?: number | null
          product_id: string
        }
        Update: {
          collection_id?: string
          position?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_product_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "shopify_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_product_collections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shopify_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_product_variants: {
        Row: {
          compare_at_price: number | null
          created_at: string
          id: string
          image_url: string | null
          inventory_quantity: number | null
          is_available: boolean | null
          option1: string | null
          option2: string | null
          option3: string | null
          position: number | null
          price: number | null
          product_id: string
          shopify_variant_id: string
          sku: string | null
          title: string
          updated_at: string
        }
        Insert: {
          compare_at_price?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          inventory_quantity?: number | null
          is_available?: boolean | null
          option1?: string | null
          option2?: string | null
          option3?: string | null
          position?: number | null
          price?: number | null
          product_id: string
          shopify_variant_id: string
          sku?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          compare_at_price?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          inventory_quantity?: number | null
          is_available?: boolean | null
          option1?: string | null
          option2?: string | null
          option3?: string | null
          position?: number | null
          price?: number | null
          product_id?: string
          shopify_variant_id?: string
          sku?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shopify_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_products: {
        Row: {
          compare_at_price: number | null
          created_at: string
          currency: string | null
          description: string | null
          handle: string | null
          id: string
          image_url: string | null
          images: Json | null
          last_synced_at: string | null
          price: number | null
          product_type: string | null
          shopify_created_at: string | null
          shopify_product_id: string
          shopify_updated_at: string | null
          shopify_url: string | null
          status: string
          tags: string[] | null
          title: string
          total_email_clicks: number | null
          total_email_conversions: number | null
          total_inventory: number | null
          total_revenue: number | null
          total_sold: number | null
          track_inventory: boolean | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          compare_at_price?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          handle?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          last_synced_at?: string | null
          price?: number | null
          product_type?: string | null
          shopify_created_at?: string | null
          shopify_product_id: string
          shopify_updated_at?: string | null
          shopify_url?: string | null
          status?: string
          tags?: string[] | null
          title: string
          total_email_clicks?: number | null
          total_email_conversions?: number | null
          total_inventory?: number | null
          total_revenue?: number | null
          total_sold?: number | null
          track_inventory?: boolean | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          compare_at_price?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          handle?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          last_synced_at?: string | null
          price?: number | null
          product_type?: string | null
          shopify_created_at?: string | null
          shopify_product_id?: string
          shopify_updated_at?: string | null
          shopify_url?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          total_email_clicks?: number | null
          total_email_conversions?: number | null
          total_inventory?: number | null
          total_revenue?: number | null
          total_sold?: number | null
          track_inventory?: boolean | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      sku_assignment_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          current_cursor: string | null
          detailed_results: Json | null
          error_message: string | null
          error_variants: number | null
          id: string
          last_activity_at: string
          last_processed_product_id: string | null
          last_processed_variant_id: string | null
          process_id: string
          processed_variants: number | null
          rate_limit_hits: number | null
          shopify_api_calls: number | null
          skipped_variants: number | null
          started_at: string
          status: string
          total_products: number | null
          total_variants: number | null
          updated_at: string
          updated_variants: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_cursor?: string | null
          detailed_results?: Json | null
          error_message?: string | null
          error_variants?: number | null
          id?: string
          last_activity_at?: string
          last_processed_product_id?: string | null
          last_processed_variant_id?: string | null
          process_id?: string
          processed_variants?: number | null
          rate_limit_hits?: number | null
          shopify_api_calls?: number | null
          skipped_variants?: number | null
          started_at?: string
          status?: string
          total_products?: number | null
          total_variants?: number | null
          updated_at?: string
          updated_variants?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_cursor?: string | null
          detailed_results?: Json | null
          error_message?: string | null
          error_variants?: number | null
          id?: string
          last_activity_at?: string
          last_processed_product_id?: string | null
          last_processed_variant_id?: string | null
          process_id?: string
          processed_variants?: number | null
          rate_limit_hits?: number | null
          shopify_api_calls?: number | null
          skipped_variants?: number | null
          started_at?: string
          status?: string
          total_products?: number | null
          total_variants?: number | null
          updated_at?: string
          updated_variants?: number | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean
          max_orders_per_month: number | null
          max_users: number | null
          max_workshops: number | null
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          max_orders_per_month?: number | null
          max_users?: number | null
          max_workshops?: number | null
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          max_orders_per_month?: number | null
          max_users?: number | null
          max_workshops?: number | null
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      sync_control_logs: {
        Row: {
          created_at: string
          days_processed: number
          end_time: string | null
          error_message: string | null
          execution_details: Json | null
          id: string
          metrics_created: number
          orders_processed: number
          start_time: string
          status: string
          sync_mode: string
          sync_type: string
          variants_updated: number
        }
        Insert: {
          created_at?: string
          days_processed?: number
          end_time?: string | null
          error_message?: string | null
          execution_details?: Json | null
          id?: string
          metrics_created?: number
          orders_processed?: number
          start_time?: string
          status?: string
          sync_mode: string
          sync_type: string
          variants_updated?: number
        }
        Update: {
          created_at?: string
          days_processed?: number
          end_time?: string | null
          error_message?: string | null
          execution_details?: Json | null
          id?: string
          metrics_created?: number
          orders_processed?: number
          start_time?: string
          status?: string
          sync_mode?: string
          sync_type?: string
          variants_updated?: number
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          contact_count: number
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          contact_count?: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          contact_count?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      ugc_campaigns: {
        Row: {
          agreed_payment: number | null
          agreed_videos: number | null
          created_at: string
          creator_id: string
          deadline: string | null
          id: string
          name: string
          notes: string | null
          order_number: string | null
          organization_id: string
          payment_type: string | null
          product_sent: string | null
          received_date: string | null
          shipping_date: string | null
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          agreed_payment?: number | null
          agreed_videos?: number | null
          created_at?: string
          creator_id: string
          deadline?: string | null
          id?: string
          name: string
          notes?: string | null
          order_number?: string | null
          organization_id: string
          payment_type?: string | null
          product_sent?: string | null
          received_date?: string | null
          shipping_date?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          agreed_payment?: number | null
          agreed_videos?: number | null
          created_at?: string
          creator_id?: string
          deadline?: string | null
          id?: string
          name?: string
          notes?: string | null
          order_number?: string | null
          organization_id?: string
          payment_type?: string | null
          product_sent?: string | null
          received_date?: string | null
          shipping_date?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ugc_campaigns_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "ugc_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ugc_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ugc_creator_children: {
        Row: {
          age_description: string | null
          birth_date: string | null
          created_at: string
          creator_id: string
          gender: string | null
          id: string
          name: string
          organization_id: string
          size: string | null
          updated_at: string
        }
        Insert: {
          age_description?: string | null
          birth_date?: string | null
          created_at?: string
          creator_id: string
          gender?: string | null
          id?: string
          name: string
          organization_id: string
          size?: string | null
          updated_at?: string
        }
        Update: {
          age_description?: string | null
          birth_date?: string | null
          created_at?: string
          creator_id?: string
          gender?: string | null
          id?: string
          name?: string
          organization_id?: string
          size?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ugc_creator_children_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "ugc_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ugc_creator_children_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ugc_creator_tag_assignments: {
        Row: {
          assigned_at: string
          creator_id: string
          id: string
          tag_id: string
        }
        Insert: {
          assigned_at?: string
          creator_id: string
          id?: string
          tag_id: string
        }
        Update: {
          assigned_at?: string
          creator_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ugc_creator_tag_assignments_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "ugc_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ugc_creator_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "ugc_creator_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      ugc_creator_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ugc_creator_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ugc_creators: {
        Row: {
          avatar_url: string | null
          avg_likes: number | null
          avg_views: number | null
          city: string | null
          content_types: string[] | null
          created_at: string
          email: string | null
          engagement_rate: number | null
          id: string
          instagram_followers: number | null
          instagram_handle: string | null
          last_contact_date: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          platform: string | null
          status: string
          tiktok_handle: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          avg_likes?: number | null
          avg_views?: number | null
          city?: string | null
          content_types?: string[] | null
          created_at?: string
          email?: string | null
          engagement_rate?: number | null
          id?: string
          instagram_followers?: number | null
          instagram_handle?: string | null
          last_contact_date?: string | null
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          platform?: string | null
          status?: string
          tiktok_handle?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          avg_likes?: number | null
          avg_views?: number | null
          city?: string | null
          content_types?: string[] | null
          created_at?: string
          email?: string | null
          engagement_rate?: number | null
          id?: string
          instagram_followers?: number | null
          instagram_handle?: string | null
          last_contact_date?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          platform?: string | null
          status?: string
          tiktok_handle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ugc_creators_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ugc_notifications: {
        Row: {
          campaign_id: string
          created_at: string | null
          creator_id: string
          id: string
          message: string
          organization_id: string
          read: boolean | null
          title: string
          type: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          creator_id: string
          id?: string
          message: string
          organization_id: string
          read?: boolean | null
          title: string
          type: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          creator_id?: string
          id?: string
          message?: string
          organization_id?: string
          read?: boolean | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ugc_notifications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ugc_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ugc_notifications_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "ugc_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ugc_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ugc_upload_tokens: {
        Row: {
          created_at: string | null
          creator_id: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uploads: number | null
          organization_id: string
          token: string
          updated_at: string | null
          upload_count: number | null
        }
        Insert: {
          created_at?: string | null
          creator_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uploads?: number | null
          organization_id: string
          token?: string
          updated_at?: string | null
          upload_count?: number | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uploads?: number | null
          organization_id?: string
          token?: string
          updated_at?: string | null
          upload_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ugc_upload_tokens_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "ugc_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ugc_upload_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ugc_videos: {
        Row: {
          campaign_id: string
          comments: number | null
          created_at: string
          creator_id: string
          feedback: string | null
          id: string
          likes: number | null
          organization_id: string
          platform: string | null
          published_date: string | null
          status: string
          updated_at: string
          video_url: string | null
          views: number | null
        }
        Insert: {
          campaign_id: string
          comments?: number | null
          created_at?: string
          creator_id: string
          feedback?: string | null
          id?: string
          likes?: number | null
          organization_id: string
          platform?: string | null
          published_date?: string | null
          status?: string
          updated_at?: string
          video_url?: string | null
          views?: number | null
        }
        Update: {
          campaign_id?: string
          comments?: number | null
          created_at?: string
          creator_id?: string
          feedback?: string | null
          id?: string
          likes?: number | null
          organization_id?: string
          platform?: string | null
          published_date?: string | null
          status?: string
          updated_at?: string
          video_url?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ugc_videos_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ugc_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ugc_videos_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "ugc_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ugc_videos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string | null
          role_id: string | null
          updated_at: string | null
          user_id: string
          workshop_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id?: string | null
          role_id?: string | null
          updated_at?: string | null
          user_id: string
          workshop_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string | null
          role_id?: string | null
          updated_at?: string | null
          user_id?: string
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          created_at: string
          description: string | null
          id: string
          is_central: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_central?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_central?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      workshop_assignments: {
        Row: {
          assigned_by: string | null
          assigned_date: string | null
          created_at: string
          expected_completion_date: string | null
          id: string
          notes: string | null
          order_id: string
          organization_id: string | null
          status: string | null
          workshop_id: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_date?: string | null
          created_at?: string
          expected_completion_date?: string | null
          id?: string
          notes?: string | null
          order_id: string
          organization_id?: string | null
          status?: string | null
          workshop_id: string
        }
        Update: {
          assigned_by?: string | null
          assigned_date?: string | null
          created_at?: string
          expected_completion_date?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          organization_id?: string | null
          status?: string | null
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_assignments_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_pricing: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          effective_from: string
          effective_until: string | null
          id: string
          notes: string | null
          organization_id: string | null
          product_id: string
          unit_price: number
          updated_at: string
          workshop_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          product_id: string
          unit_price: number
          updated_at?: string
          workshop_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          product_id?: string
          unit_price?: number
          updated_at?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_pricing_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_pricing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_pricing_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_prospects: {
        Row: {
          address: string | null
          assigned_to: string | null
          city: string | null
          contact_person: string | null
          converted_workshop_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          quality_index: number | null
          source: string | null
          specialties: string[] | null
          stage: Database["public"]["Enums"]["prospect_stage"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          contact_person?: string | null
          converted_workshop_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          quality_index?: number | null
          source?: string | null
          specialties?: string[] | null
          stage?: Database["public"]["Enums"]["prospect_stage"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          contact_person?: string | null
          converted_workshop_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          quality_index?: number | null
          source?: string | null
          specialties?: string[] | null
          stage?: Database["public"]["Enums"]["prospect_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_prospects_converted_workshop_id_fkey"
            columns: ["converted_workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_prospects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          address: string | null
          capacity: number | null
          city: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          payment_method: string | null
          phone: string | null
          specialties: string[] | null
          status: string | null
          updated_at: string
          working_hours_end: string | null
          working_hours_start: string | null
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          payment_method?: string | null
          phone?: string | null
          specialties?: string[] | null
          status?: string | null
          updated_at?: string
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Update: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          payment_method?: string | null
          phone?: string | null
          specialties?: string[] | null
          status?: string | null
          updated_at?: string
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workshops_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_replenishment_details: {
        Row: {
          avg_daily_sales: number | null
          calculated_at: string | null
          calculation_date: string | null
          current_stock: number | null
          data_confidence: string | null
          days_of_supply: number | null
          id: string | null
          in_transit: number | null
          last_known_velocity: number | null
          orders_count_30d: number | null
          organization_id: string | null
          pending_production: number | null
          pipeline_coverage_days: number | null
          product_name: string | null
          projected_demand_40d: number | null
          reason: string | null
          sales_30d: number | null
          sku: string | null
          sku_variant: string | null
          status: string | null
          suggested_quantity: number | null
          urgency: string | null
          variant_color: string | null
          variant_id: string | null
          variant_size: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_replenishment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_replenishment_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      acquire_delivery_sync_lock: {
        Args: { delivery_uuid: string }
        Returns: boolean
      }
      assign_admin_role_to_users_without_role: {
        Args: never
        Returns: {
          assigned: boolean
          error_message: string
          user_id: string
        }[]
      }
      calculate_delivery_payment: {
        Args: {
          custom_advance_deduction_param?: number
          delivery_id_param: string
        }
        Returns: {
          advance_already_used: number
          advance_deduction: number
          billable_units: number
          gross_amount: number
          net_amount: number
          total_advance_available: number
          total_units: number
          workshop_payment_method: string
        }[]
      }
      calculate_okr_score: { Args: { kr_id_param: string }; Returns: number }
      check_delivery_sync_lock: {
        Args: { delivery_uuid: string }
        Returns: boolean
      }
      check_variant_update_safety: {
        Args: { new_sku_param: string; variant_id_param: string }
        Returns: Json
      }
      cleanup_old_sku_logs: { Args: never; Returns: undefined }
      clear_delivery_sync_lock: {
        Args: { delivery_id_param: string }
        Returns: Json
      }
      clear_stale_sync_locks: { Args: never; Returns: Json[] }
      complete_user_setup: {
        Args: {
          p_organization_name?: string
          p_organization_type?: string
          p_selected_plan?: string
          p_user_id: string
        }
        Returns: Json
      }
      consolidate_duplicate_variants: { Args: never; Returns: Json }
      consume_order_materials: {
        Args: { p_consumptions: Json; p_order_id: string }
        Returns: boolean
      }
      debug_role_update_permissions: {
        Args: never
        Returns: {
          can_update_system_roles: boolean
          org_role: string
          org_status: string
          organization_id: string
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      find_matching_local_variant: {
        Args: {
          p_color: string
          p_organization_id: string
          p_product_name: string
          p_size: string
        }
        Returns: string
      }
      fix_delivery_sync_status_inconsistencies: { Args: never; Returns: Json }
      generate_delivery_number: { Args: never; Returns: string }
      generate_manifest_number: {
        Args: { carrier_code: string; org_id: string }
        Returns: string
      }
      generate_material_sku: {
        Args: { category_name: string }
        Returns: string
      }
      generate_order_number: { Args: never; Returns: string }
      get_available_orders: {
        Args: never
        Returns: {
          created_at: string
          due_date: string
          id: string
          order_number: string
          status: string
          total_amount: number
        }[]
      }
      get_current_organization: { Args: never; Returns: string }
      get_current_organization_for_views: { Args: never; Returns: string }
      get_current_organization_safe: { Args: never; Returns: string }
      get_current_user_role: { Args: never; Returns: string }
      get_current_user_role_safe: { Args: never; Returns: string }
      get_customer_analytics: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          avg_order_value: number
          customer_email: string
          customer_name: string
          customer_segment: string
          first_order_date: string
          last_order_date: string
          orders_count: number
          total_spent: number
        }[]
      }
      get_deliveries_with_details: {
        Args: never
        Returns: {
          created_at: string
          delivered_by: string
          delivered_by_name: string
          delivery_date: string
          id: string
          items_count: number
          notes: string
          order_id: string
          order_number: string
          recipient_address: string
          recipient_name: string
          recipient_phone: string
          status: string
          total_quantity: number
          tracking_number: string
          workshop_id: string
          workshop_name: string
        }[]
      }
      get_deliveries_with_details_v2: {
        Args: never
        Returns: {
          created_at: string
          delivered_by: string
          delivered_by_name: string
          delivery_date: string
          id: string
          items_count: number
          notes: string
          order_id: string
          order_number: string
          recipient_address: string
          recipient_name: string
          recipient_phone: string
          status: string
          total_approved: number
          total_defective: number
          total_quantity: number
          tracking_number: string
          workshop_id: string
          workshop_name: string
        }[]
      }
      get_deliveries_with_sync_status: {
        Args: never
        Returns: {
          created_at: string
          delivered_by: string
          delivered_by_name: string
          delivery_date: string
          id: string
          items_count: number
          last_sync_attempt: string
          notes: string
          order_id: string
          order_number: string
          recipient_address: string
          recipient_name: string
          recipient_phone: string
          status: string
          sync_attempts: number
          sync_error_message: string
          synced_to_shopify: boolean
          total_approved: number
          total_defective: number
          total_quantity: number
          tracking_number: string
          workshop_id: string
          workshop_name: string
        }[]
      }
      get_delivery_statistics: {
        Args: never
        Returns: {
          approved_deliveries: number
          in_quality_deliveries: number
          pending_deliveries: number
          rejected_deliveries: number
          total_deliveries: number
        }[]
      }
      get_delivery_stats: {
        Args: never
        Returns: {
          approved_deliveries: number
          in_quality_deliveries: number
          pending_deliveries: number
          rejected_deliveries: number
          total_deliveries: number
        }[]
      }
      get_delivery_stats_admin: {
        Args: never
        Returns: {
          approved_deliveries: number
          in_quality_deliveries: number
          organization_name: string
          pending_deliveries: number
          rejected_deliveries: number
          total_deliveries: number
        }[]
      }
      get_delivery_sync_status: {
        Args: { delivery_id_param?: string }
        Returns: {
          can_sync: boolean
          delivery_id: string
          is_locked: boolean
          last_sync_attempt: string
          lock_age_minutes: number
          sync_attempts: number
          sync_error_message: string
          synced_to_shopify: boolean
          tracking_number: string
        }[]
      }
      get_dosmicos_org_id: { Args: never; Returns: string }
      get_financial_report: {
        Args: {
          end_date?: string
          start_date?: string
          workshop_id_param?: string
        }
        Returns: {
          advance_deduction: number
          billable_units: number
          delivery_date: string
          delivery_id: string
          gross_amount: number
          net_amount: number
          order_number: string
          payment_date: string
          payment_method: string
          payment_status: string
          total_units: number
          tracking_number: string
          workshop_name: string
        }[]
      }
      get_material_consumptions_by_order: {
        Args: never
        Returns: {
          created_at: string
          delivery_date: string
          id: string
          material_category: string
          material_color: string
          material_id: string
          material_name: string
          material_unit: string
          order_id: string
          order_number: string
          quantity_consumed: number
          updated_at: string
          workshop_id: string
          workshop_name: string
        }[]
      }
      get_material_deliveries_with_real_balance: {
        Args: never
        Returns: {
          created_at: string
          delivered_by: string
          delivery_date: string
          id: string
          material_category: string
          material_color: string
          material_id: string
          material_name: string
          material_sku: string
          material_unit: string
          notes: string
          order_id: string
          order_number: string
          real_balance: number
          total_consumed: number
          total_delivered: number
          updated_at: string
          workshop_id: string
          workshop_name: string
        }[]
      }
      get_material_stock_by_location: {
        Args: {
          p_location_id: string
          p_location_type: string
          p_material_id: string
        }
        Returns: number
      }
      get_materials_with_stock_status: {
        Args: never
        Returns: {
          category: string
          color: string
          created_at: string
          current_stock: number
          description: string
          id: string
          image_url: string
          min_stock_alert: number
          name: string
          sku: string
          stock_status: string
          supplier: string
          unit: string
          unit_cost: number
        }[]
      }
      get_order_deliveries_breakdown: {
        Args: { order_id_param: string }
        Returns: {
          delivery_date: string
          delivery_id: string
          delivery_notes: string
          delivery_status: string
          items_approved: number
          items_defective: number
          items_delivered: number
          tracking_number: string
          workshop_name: string
        }[]
      }
      get_order_delivery_stats_v2: {
        Args: { order_id_param: string }
        Returns: {
          completion_percentage: number
          total_approved: number
          total_defective: number
          total_delivered: number
          total_ordered: number
          total_pending: number
        }[]
      }
      get_order_variants_breakdown: {
        Args: { order_id_param: string }
        Returns: {
          completion_percentage: number
          product_name: string
          sku_variant: string
          total_approved: number
          total_ordered: number
          total_pending: number
          variant_color: string
          variant_size: string
        }[]
      }
      get_organization_users_detailed: {
        Args: never
        Returns: {
          created_at: string
          created_by: string
          email: string
          id: string
          last_login: string
          name: string
          requires_password_change: boolean
          role: string
          status: string
          workshop_id: string
          workshop_name: string
        }[]
      }
      get_password_change_required: { Args: never; Returns: boolean }
      get_pending_indexing: {
        Args: { max_items?: number; org_id?: string }
        Returns: {
          id: string
          organization_id: string
          shopify_product_id: number
        }[]
      }
      get_product_sales_analytics: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          avg_price: number
          customers_count: number
          orders_count: number
          product_title: string
          sku: string
          total_quantity: number
          total_revenue: number
          variant_title: string
        }[]
      }
      get_shopify_orders_sanitized: {
        Args: never
        Returns: {
          created_at_shopify: string
          currency: string
          customer_email_masked: string
          customer_name_masked: string
          financial_status: string
          fulfillment_status: string
          id: string
          order_number: string
          organization_id: string
          shopify_order_id: number
          total_price: number
          updated_at_shopify: string
        }[]
      }
      get_user_email_admin: { Args: { user_id_param: string }; Returns: string }
      get_user_organizations: { Args: never; Returns: string[] }
      get_user_role: { Args: { user_uuid: string }; Returns: string }
      get_user_role_info: {
        Args: { user_uuid: string }
        Returns: {
          permissions: Json
          role_name: string
          workshop_id: string
        }[]
      }
      get_workshop_capacity_stats: {
        Args: never
        Returns: {
          available_capacity: number
          completion_rate: number
          current_assignments: number
          total_capacity: number
          workshop_id: string
          workshop_name: string
        }[]
      }
      get_workshop_delivery_info: {
        Args: { delivery_id_param: string }
        Returns: {
          delivery_date: string
          id: string
          notes: string
          order_id: string
          status: string
          synced_to_shopify: boolean
          tracking_number: string
          workshop_id: string
        }[]
      }
      get_workshop_financial_summary: {
        Args: {
          end_date?: string
          start_date?: string
          workshop_id_param: string
        }
        Returns: {
          paid_deliveries: number
          pending_amount: number
          pending_payments: number
          total_advances: number
          total_deliveries: number
          total_gross_amount: number
          total_net_amount: number
          total_paid_amount: number
        }[]
      }
      get_workshop_material_stock: {
        Args: { material_id_param: string; workshop_id_param: string }
        Returns: {
          available_stock: number
          total_consumed: number
          total_delivered: number
        }[]
      }
      get_workshop_pricing_gaps: {
        Args: never
        Returns: {
          avg_sale_price: number
          base_price: number
          deliveries_count: number
          product_id: string
          product_name: string
          workshop_id: string
          workshop_name: string
        }[]
      }
      get_workshop_product_price: {
        Args: {
          calculation_date?: string
          product_id_param: string
          workshop_id_param: string
        }
        Returns: number
      }
      has_delivery_permission: {
        Args: { action_name: string; user_uuid: string }
        Returns: boolean
      }
      has_permission: {
        Args: { action_name: string; module_name: string; user_id: string }
        Returns: boolean
      }
      has_recent_successful_sync: {
        Args: { delivery_id_param: string; minutes_threshold?: number }
        Returns: boolean
      }
      increment_product_clicks: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      is_admin: { Args: { user_uuid: string }; Returns: boolean }
      is_current_user_admin: { Args: never; Returns: boolean }
      is_dosmicos_user: { Args: never; Returns: boolean }
      is_okr_manager: {
        Args: { area_name?: string; user_uuid: string }
        Returns: boolean
      }
      is_sync_in_progress: {
        Args: { sync_mode_param: string; sync_type_param: string }
        Returns: boolean
      }
      is_system_or_service_role: { Args: never; Returns: boolean }
      is_user_admin_in_org: { Args: { org_id: string }; Returns: boolean }
      log_security_event:
        | {
            Args: { event_details_param?: Json; event_type_param: string }
            Returns: undefined
          }
        | {
            Args: {
              event_details_param?: Json
              event_type_param: string
              ip_address_param?: unknown
            }
            Returns: string
          }
      log_stats_access: { Args: never; Returns: undefined }
      make_user_admin: { Args: { user_email: string }; Returns: undefined }
      map_shopify_tags_to_operational_status: {
        Args: { tags: string }
        Returns: string
      }
      mark_delivery_as_synced: {
        Args: { p_delivery_id: string }
        Returns: number
      }
      mark_indexing_complete: {
        Args: { error_msg?: string; queue_id: string; success: boolean }
        Returns: undefined
      }
      mark_password_changed: { Args: { user_uuid: string }; Returns: undefined }
      match_products: {
        Args: {
          match_count?: number
          match_threshold?: number
          org_id: string
          query_embedding: string
        }
        Returns: {
          id: string
          product_handle: string
          product_title: string
          shopify_product_id: number
          similarity: number
          variants: Json
          visual_description: string
        }[]
      }
      match_products_by_image: {
        Args: {
          match_count?: number
          match_threshold?: number
          org_id: string
          query_embedding: string
        }
        Returns: {
          id: string
          product_handle: string
          product_title: string
          shopify_product_id: number
          similarity: number
          variants: Json
        }[]
      }
      migrate_ruana_mapache_variants: { Args: never; Returns: Json }
      migrate_sleeping_walker_dinosaurios_variants: {
        Args: never
        Returns: Json
      }
      migrate_sleeping_walker_tigres_variants: { Args: never; Returns: Json }
      normalize_phone_number: { Args: { phone: string }; Returns: string }
      process_material_transfer: {
        Args: { p_transfer_id: string }
        Returns: boolean
      }
      recalculate_material_deliveries_remaining: {
        Args: never
        Returns: undefined
      }
      recalculate_material_stock: { Args: never; Returns: undefined }
      refresh_inventory_replenishment: {
        Args: { org_id: string }
        Returns: Json
      }
      release_delivery_sync_lock: {
        Args: { delivery_uuid: string }
        Returns: boolean
      }
      require_password_change: {
        Args: { user_uuid: string }
        Returns: undefined
      }
      sync_sales_metrics_from_shopify: { Args: never; Returns: undefined }
      sync_shopify_inventory: { Args: never; Returns: Json }
      trigger_replenishment_calculation: { Args: never; Returns: Json }
      ugc_submit_video: {
        Args: {
          p_campaign_id: string
          p_notes?: string
          p_platform?: string
          p_token: string
          p_video_url: string
        }
        Returns: Json
      }
      update_sales_metrics_secure: {
        Args: {
          p_avg_order_size: number
          p_metric_date: string
          p_orders_count: number
          p_organization_id: string
          p_product_variant_id: string
          p_sales_quantity: number
        }
        Returns: undefined
      }
      update_variant_sku_cascade: {
        Args: { new_sku_param: string; variant_id_param: string }
        Returns: Json
      }
      user_belongs_to_organization: {
        Args: { org_id: string }
        Returns: boolean
      }
      user_can_view_all_deliveries: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      user_has_messaging_permission: {
        Args: { org_id: string; permission_type: string }
        Returns: boolean
      }
      user_has_org_admin_role: { Args: never; Returns: boolean }
      user_has_role: {
        Args: { check_user_id: string; role_name: string }
        Returns: boolean
      }
      user_has_workshop_permissions: { Args: never; Returns: boolean }
      users_share_organization: {
        Args: { user1_id: string; user2_id: string }
        Returns: boolean
      }
      validate_ugc_upload_token: { Args: { p_token: string }; Returns: Json }
    }
    Enums: {
      okr_area: "marketing" | "diseno_prod" | "operaciones"
      okr_confidence: "low" | "med" | "high"
      okr_data_source: "manual" | "auto" | "computed"
      okr_incentive_status: "pending" | "approved" | "paid"
      okr_incentive_value_type: "days" | "bonus" | "recognition"
      okr_level: "company" | "area" | "team" | "individual"
      okr_tier: "T1" | "T2"
      okr_unit: "%" | "#" | "$" | "rate" | "binary"
      okr_visibility: "public" | "area" | "private"
      prospect_activity_status: "pending" | "completed" | "cancelled"
      prospect_activity_type:
        | "note"
        | "call"
        | "videocall"
        | "visit"
        | "email"
        | "whatsapp"
        | "stage_change"
        | "sample_sent"
        | "sample_received"
      prospect_file_category:
        | "facility_photo"
        | "sample_photo"
        | "contract"
        | "other"
      prospect_stage:
        | "lead"
        | "videocall_scheduled"
        | "videocall_completed"
        | "visit_scheduled"
        | "visit_completed"
        | "sample_requested"
        | "sample_in_progress"
        | "sample_approved"
        | "sample_rejected"
        | "trial_production"
        | "trial_approved"
        | "trial_rejected"
        | "approved_workshop"
        | "rejected"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      okr_area: ["marketing", "diseno_prod", "operaciones"],
      okr_confidence: ["low", "med", "high"],
      okr_data_source: ["manual", "auto", "computed"],
      okr_incentive_status: ["pending", "approved", "paid"],
      okr_incentive_value_type: ["days", "bonus", "recognition"],
      okr_level: ["company", "area", "team", "individual"],
      okr_tier: ["T1", "T2"],
      okr_unit: ["%", "#", "$", "rate", "binary"],
      okr_visibility: ["public", "area", "private"],
      prospect_activity_status: ["pending", "completed", "cancelled"],
      prospect_activity_type: [
        "note",
        "call",
        "videocall",
        "visit",
        "email",
        "whatsapp",
        "stage_change",
        "sample_sent",
        "sample_received",
      ],
      prospect_file_category: [
        "facility_photo",
        "sample_photo",
        "contract",
        "other",
      ],
      prospect_stage: [
        "lead",
        "videocall_scheduled",
        "videocall_completed",
        "visit_scheduled",
        "visit_completed",
        "sample_requested",
        "sample_in_progress",
        "sample_approved",
        "sample_rejected",
        "trial_production",
        "trial_approved",
        "trial_rejected",
        "approved_workshop",
        "rejected",
      ],
    },
  },
} as const
