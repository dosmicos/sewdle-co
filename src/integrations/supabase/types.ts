export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
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
          synced_to_shopify: boolean
          tracking_number: string | null
          updated_at: string
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
          synced_to_shopify?: boolean
          tracking_number?: string | null
          updated_at?: string
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
          synced_to_shopify?: boolean
          tracking_number?: string | null
          updated_at?: string
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
          billable_units: number
          created_at: string
          created_by: string | null
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
          billable_units: number
          created_at?: string
          created_by?: string | null
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
          billable_units?: number
          created_at?: string
          created_by?: string | null
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
      inventory_sync_logs: {
        Row: {
          created_at: string
          delivery_id: string
          error_count: number
          id: string
          success_count: number
          sync_results: Json
          synced_at: string
        }
        Insert: {
          created_at?: string
          delivery_id: string
          error_count?: number
          id?: string
          success_count?: number
          sync_results: Json
          synced_at?: string
        }
        Update: {
          created_at?: string
          delivery_id?: string
          error_count?: number
          id?: string
          success_count?: number
          sync_results?: Json
          synced_at?: string
        }
        Relationships: []
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
          name: string | null
          organization_id: string | null
          requires_password_change: boolean | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          name?: string | null
          organization_id?: string | null
          requires_password_change?: boolean | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          organization_id?: string | null
          requires_password_change?: boolean | null
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
      replenishment_config: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          lead_time_days: number
          max_stock_level: number
          min_stock_level: number
          product_variant_id: string
          safety_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number
          max_stock_level?: number
          min_stock_level?: number
          product_variant_id: string
          safety_days?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number
          max_stock_level?: number
          min_stock_level?: number
          product_variant_id?: string
          safety_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "replenishment_config_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replenishment_config_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      replenishment_suggestions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          calculation_date: string
          created_at: string
          current_stock: number
          days_of_stock: number
          executed_at: string | null
          id: string
          open_orders_quantity: number
          product_variant_id: string
          projected_demand: number
          reason: string | null
          sales_velocity: number
          status: string
          suggested_quantity: number
          updated_at: string
          urgency_level: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          calculation_date?: string
          created_at?: string
          current_stock?: number
          days_of_stock?: number
          executed_at?: string | null
          id?: string
          open_orders_quantity?: number
          product_variant_id: string
          projected_demand?: number
          reason?: string | null
          sales_velocity?: number
          status?: string
          suggested_quantity: number
          updated_at?: string
          urgency_level?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          calculation_date?: string
          created_at?: string
          current_stock?: number
          days_of_stock?: number
          executed_at?: string | null
          id?: string
          open_orders_quantity?: number
          product_variant_id?: string
          projected_demand?: number
          reason?: string | null
          sales_velocity?: number
          status?: string
          suggested_quantity?: number
          updated_at?: string
          urgency_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "replenishment_suggestions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replenishment_suggestions_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
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
      sales_metrics: {
        Row: {
          avg_order_size: number
          created_at: string
          id: string
          metric_date: string
          orders_count: number
          product_variant_id: string
          sales_quantity: number
        }
        Insert: {
          avg_order_size?: number
          created_at?: string
          id?: string
          metric_date?: string
          orders_count?: number
          product_variant_id: string
          sales_quantity?: number
        }
        Update: {
          avg_order_size?: number
          created_at?: string
          id?: string
          metric_date?: string
          orders_count?: number
          product_variant_id?: string
          sales_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_metrics_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
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
          billing_address: Json | null
          browser_ip: string | null
          cancelled_at: string | null
          closed_at: string | null
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
          note: string | null
          order_number: string
          order_source_url: string | null
          order_status_url: string | null
          processed_at: string | null
          raw_data: Json | null
          referring_site: string | null
          shipping_address: Json | null
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
          billing_address?: Json | null
          browser_ip?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
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
          note?: string | null
          order_number: string
          order_source_url?: string | null
          order_status_url?: string | null
          processed_at?: string | null
          raw_data?: Json | null
          referring_site?: string | null
          shipping_address?: Json | null
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
          billing_address?: Json | null
          browser_ip?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
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
          note?: string | null
          order_number?: string
          order_source_url?: string | null
          order_status_url?: string | null
          processed_at?: string | null
          raw_data?: Json | null
          referring_site?: string | null
          shipping_address?: Json | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
      deliveries_stats: {
        Row: {
          approved_deliveries: number | null
          in_quality_deliveries: number | null
          pending_deliveries: number | null
          rejected_deliveries: number | null
          total_deliveries: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_delivery_payment: {
        Args: { delivery_id_param: string }
        Returns: {
          total_units: number
          billable_units: number
          gross_amount: number
          advance_deduction: number
          net_amount: number
          workshop_payment_method: string
        }[]
      }
      calculate_replenishment_suggestions: {
        Args: Record<PropertyKey, never>
        Returns: {
          variant_id: string
          product_name: string
          variant_size: string
          variant_color: string
          sku_variant: string
          current_stock: number
          sales_velocity: number
          days_of_stock: number
          open_orders: number
          projected_demand: number
          suggested_quantity: number
          urgency_level: string
          reason: string
        }[]
      }
      cleanup_old_sku_logs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      clear_delivery_sync_lock: {
        Args: { delivery_id_param: string }
        Returns: Json
      }
      clear_stale_sync_locks: {
        Args: Record<PropertyKey, never>
        Returns: Json[]
      }
      consume_order_materials: {
        Args: { order_id_param: string; consumption_data: Json }
        Returns: undefined
      }
      fix_delivery_sync_status_inconsistencies: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      generate_delivery_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_material_sku: {
        Args: { category_name: string }
        Returns: string
      }
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_available_orders: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          order_number: string
          client_name: string
          due_date: string
          total_amount: number
          status: string
          created_at: string
        }[]
      }
      get_current_organization: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_organization_safe: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_role_safe: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_customer_analytics: {
        Args: { start_date?: string; end_date?: string }
        Returns: {
          customer_email: string
          customer_name: string
          orders_count: number
          total_spent: number
          avg_order_value: number
          first_order_date: string
          last_order_date: string
          customer_segment: string
        }[]
      }
      get_deliveries_with_details: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          tracking_number: string
          order_id: string
          order_number: string
          workshop_id: string
          workshop_name: string
          delivery_date: string
          status: string
          delivered_by: string
          delivered_by_name: string
          recipient_name: string
          recipient_phone: string
          recipient_address: string
          notes: string
          created_at: string
          items_count: number
          total_quantity: number
        }[]
      }
      get_deliveries_with_details_v2: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          tracking_number: string
          order_id: string
          order_number: string
          workshop_id: string
          workshop_name: string
          delivery_date: string
          status: string
          delivered_by: string
          delivered_by_name: string
          recipient_name: string
          recipient_phone: string
          recipient_address: string
          notes: string
          created_at: string
          items_count: number
          total_quantity: number
          total_approved: number
          total_defective: number
        }[]
      }
      get_deliveries_with_sync_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          tracking_number: string
          order_id: string
          order_number: string
          workshop_id: string
          workshop_name: string
          delivery_date: string
          status: string
          delivered_by: string
          delivered_by_name: string
          recipient_name: string
          recipient_phone: string
          recipient_address: string
          notes: string
          created_at: string
          items_count: number
          total_quantity: number
          total_approved: number
          total_defective: number
          synced_to_shopify: boolean
          sync_attempts: number
          last_sync_attempt: string
          sync_error_message: string
        }[]
      }
      get_delivery_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_deliveries: number
          pending_deliveries: number
          in_quality_deliveries: number
          approved_deliveries: number
          rejected_deliveries: number
        }[]
      }
      get_delivery_sync_status: {
        Args: { delivery_id_param?: string }
        Returns: {
          delivery_id: string
          tracking_number: string
          synced_to_shopify: boolean
          sync_attempts: number
          last_sync_attempt: string
          sync_error_message: string
          is_locked: boolean
          lock_age_minutes: number
          can_sync: boolean
        }[]
      }
      get_financial_report: {
        Args: {
          workshop_id_param?: string
          start_date?: string
          end_date?: string
        }
        Returns: {
          delivery_id: string
          tracking_number: string
          workshop_name: string
          order_number: string
          delivery_date: string
          total_units: number
          billable_units: number
          gross_amount: number
          advance_deduction: number
          net_amount: number
          payment_status: string
          payment_date: string
          payment_method: string
        }[]
      }
      get_material_consumptions_by_order: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          material_id: string
          workshop_id: string
          order_id: string
          quantity_consumed: number
          delivery_date: string
          created_at: string
          updated_at: string
          material_name: string
          material_unit: string
          material_category: string
          material_color: string
          workshop_name: string
          order_number: string
        }[]
      }
      get_material_deliveries_with_real_balance: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          material_id: string
          workshop_id: string
          order_id: string
          delivery_date: string
          delivered_by: string
          notes: string
          created_at: string
          updated_at: string
          total_delivered: number
          total_consumed: number
          real_balance: number
          material_name: string
          material_sku: string
          material_unit: string
          material_color: string
          material_category: string
          workshop_name: string
          order_number: string
        }[]
      }
      get_materials_with_stock_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          sku: string
          name: string
          description: string
          unit: string
          color: string
          category: string
          min_stock_alert: number
          current_stock: number
          supplier: string
          unit_cost: number
          image_url: string
          stock_status: string
          created_at: string
        }[]
      }
      get_order_deliveries_breakdown: {
        Args: { order_id_param: string }
        Returns: {
          delivery_id: string
          tracking_number: string
          delivery_date: string
          delivery_status: string
          workshop_name: string
          items_delivered: number
          items_approved: number
          items_defective: number
          delivery_notes: string
        }[]
      }
      get_order_delivery_stats_v2: {
        Args: { order_id_param: string }
        Returns: {
          total_ordered: number
          total_delivered: number
          total_approved: number
          total_defective: number
          total_pending: number
          completion_percentage: number
        }[]
      }
      get_order_variants_breakdown: {
        Args: { order_id_param: string }
        Returns: {
          product_name: string
          variant_size: string
          variant_color: string
          sku_variant: string
          total_ordered: number
          total_approved: number
          total_pending: number
          completion_percentage: number
        }[]
      }
      get_product_sales_analytics: {
        Args: { start_date?: string; end_date?: string }
        Returns: {
          sku: string
          product_title: string
          variant_title: string
          total_quantity: number
          total_revenue: number
          avg_price: number
          orders_count: number
          customers_count: number
        }[]
      }
      get_replenishment_suggestions_with_details: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          product_name: string
          variant_size: string
          variant_color: string
          sku_variant: string
          suggested_quantity: number
          current_stock: number
          sales_velocity: number
          sales_30_days: number
          days_of_stock: number
          open_orders_quantity: number
          projected_demand: number
          urgency_level: string
          reason: string
          status: string
          calculation_date: string
          created_at: string
          pending_production_quantity: number
        }[]
      }
      get_user_organizations: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      get_user_role: {
        Args: { user_uuid: string }
        Returns: string
      }
      get_user_role_info: {
        Args: { user_uuid: string }
        Returns: {
          role_name: string
          permissions: Json
          workshop_id: string
        }[]
      }
      get_workshop_capacity_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          workshop_id: string
          workshop_name: string
          total_capacity: number
          current_assignments: number
          available_capacity: number
          completion_rate: number
        }[]
      }
      get_workshop_financial_summary: {
        Args: {
          workshop_id_param: string
          start_date?: string
          end_date?: string
        }
        Returns: {
          total_deliveries: number
          pending_payments: number
          paid_deliveries: number
          total_gross_amount: number
          total_advances: number
          total_net_amount: number
          total_paid_amount: number
          pending_amount: number
        }[]
      }
      get_workshop_material_stock: {
        Args: { material_id_param: string; workshop_id_param: string }
        Returns: {
          available_stock: number
          total_delivered: number
          total_consumed: number
        }[]
      }
      get_workshop_product_price: {
        Args: {
          workshop_id_param: string
          product_id_param: string
          calculation_date?: string
        }
        Returns: number
      }
      has_permission: {
        Args: { user_uuid: string; module_name: string; action_name: string }
        Returns: boolean
      }
      is_admin: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      is_current_user_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_sync_in_progress: {
        Args: { sync_type_param: string; sync_mode_param: string }
        Returns: boolean
      }
      make_user_admin: {
        Args: { user_email: string }
        Returns: undefined
      }
      mark_password_changed: {
        Args: { user_uuid: string }
        Returns: undefined
      }
      recalculate_material_deliveries_remaining: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      recalculate_material_stock: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      require_password_change: {
        Args: { user_uuid: string }
        Returns: undefined
      }
      sync_sales_metrics_from_shopify: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      sync_shopify_inventory: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      trigger_replenishment_calculation: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      user_belongs_to_organization: {
        Args: { org_id: string }
        Returns: boolean
      }
      user_has_org_admin_role: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      user_has_workshop_permissions: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      users_share_organization: {
        Args: { user1_id: string; user2_id: string }
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
    Enums: {},
  },
} as const
