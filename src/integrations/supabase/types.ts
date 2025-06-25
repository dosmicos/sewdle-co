export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
            foreignKeyName: "deliveries_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          created_at: string
          delivery_id: string
          id: string
          notes: string | null
          order_item_id: string
          quality_notes: string | null
          quality_status: string | null
          quantity_approved: number
          quantity_defective: number
          quantity_delivered: number
        }
        Insert: {
          created_at?: string
          delivery_id: string
          id?: string
          notes?: string | null
          order_item_id: string
          quality_notes?: string | null
          quality_status?: string | null
          quantity_approved?: number
          quantity_defective?: number
          quantity_delivered: number
        }
        Update: {
          created_at?: string
          delivery_id?: string
          id?: string
          notes?: string | null
          order_item_id?: string
          quality_notes?: string | null
          quality_status?: string | null
          quantity_approved?: number
          quantity_defective?: number
          quantity_delivered?: number
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
          sku?: string
          supplier?: string | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: []
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
          status?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: []
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
          sku?: string
          status?: string | null
          technical_file_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          requires_password_change: boolean | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          name?: string | null
          requires_password_change?: boolean | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          requires_password_change?: boolean | null
          updated_at?: string | null
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
          permissions: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          permissions?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          permissions?: Json | null
          updated_at?: string
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
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role_id: string | null
          updated_at: string | null
          user_id: string
          workshop_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role_id?: string | null
          updated_at?: string | null
          user_id: string
          workshop_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role_id?: string | null
          updated_at?: string | null
          user_id?: string
          workshop_id?: string | null
        }
        Relationships: [
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
            foreignKeyName: "workshop_assignments_workshop_id_fkey"
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
          phone?: string | null
          specialties?: string[] | null
          status?: string | null
          updated_at?: string
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Relationships: []
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
      cleanup_old_sku_logs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      consume_order_materials: {
        Args: { order_id_param: string; consumption_data: Json }
        Returns: undefined
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
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_role_safe: {
        Args: Record<PropertyKey, never>
        Returns: string
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
      get_order_delivery_stats: {
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
      make_user_admin: {
        Args: { user_email: string }
        Returns: undefined
      }
      mark_password_changed: {
        Args: { user_uuid: string }
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
      user_has_workshop_permissions: {
        Args: Record<PropertyKey, never>
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
