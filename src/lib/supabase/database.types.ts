export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_role: Database["public"]["Enums"]["log_actor_role"] | null;
          after: Json | null;
          at: string;
          before: Json | null;
          entity_id: string | null;
          entity_type: string;
          id: string;
          meta: Json | null;
          order_id: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["log_actor_role"] | null;
          after?: Json | null;
          at?: string;
          before?: Json | null;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          meta?: Json | null;
          order_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["log_actor_role"] | null;
          after?: Json | null;
          at?: string;
          before?: Json | null;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          meta?: Json | null;
          order_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_logs_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_reports: {
        Row: {
          data: Json;
          generated_at: string;
          report_date: string;
        };
        Insert: {
          data: Json;
          generated_at?: string;
          report_date: string;
        };
        Update: {
          data?: Json;
          generated_at?: string;
          report_date?: string;
        };
        Relationships: [];
      };
      error_logs: {
        Row: {
          at: string;
          code: string;
          context: Json | null;
          id: string;
          message: string;
          order_id: string | null;
          sentry_event_id: string | null;
          severity: Database["public"]["Enums"]["error_severity"];
          source: Database["public"]["Enums"]["error_source"];
          user_id: string | null;
        };
        Insert: {
          at?: string;
          code: string;
          context?: Json | null;
          id?: string;
          message: string;
          order_id?: string | null;
          sentry_event_id?: string | null;
          severity: Database["public"]["Enums"]["error_severity"];
          source: Database["public"]["Enums"]["error_source"];
          user_id?: string | null;
        };
        Update: {
          at?: string;
          code?: string;
          context?: Json | null;
          id?: string;
          message?: string;
          order_id?: string | null;
          sentry_event_id?: string | null;
          severity?: Database["public"]["Enums"]["error_severity"];
          source?: Database["public"]["Enums"]["error_source"];
          user_id?: string | null;
        };
        Relationships: [];
      };
      ingredients: {
        Row: {
          id: string;
          name: string;
          stock_qty: number;
          unit: Database["public"]["Enums"]["ingredient_unit"];
        };
        Insert: {
          id?: string;
          name: string;
          stock_qty?: number;
          unit: Database["public"]["Enums"]["ingredient_unit"];
        };
        Update: {
          id?: string;
          name?: string;
          stock_qty?: number;
          unit?: Database["public"]["Enums"]["ingredient_unit"];
        };
        Relationships: [];
      };
      menu_items: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          price: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          price: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          price?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          menu_item_id: string;
          name_snapshot: string;
          note: string | null;
          order_id: string;
          price_snapshot: number;
          qty: number;
          subtotal: number;
        };
        Insert: {
          id?: string;
          menu_item_id: string;
          name_snapshot: string;
          note?: string | null;
          order_id: string;
          price_snapshot: number;
          qty: number;
          subtotal: number;
        };
        Update: {
          id?: string;
          menu_item_id?: string;
          name_snapshot?: string;
          note?: string | null;
          order_id?: string;
          price_snapshot?: number;
          qty?: number;
          subtotal?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          cancelled_at: string | null;
          cancelled_by: string | null;
          cancelled_by_role:
            Database["public"]["Enums"]["order_cancel_role"] | null;
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          customer_name: string;
          finished_at: string | null;
          finished_by: string | null;
          id: string;
          idempotency_key: string | null;
          is_manual_time: boolean;
          occurred_at: string;
          queue_date: string;
          queue_number: number;
          source: Database["public"]["Enums"]["order_source"];
          started_at: string | null;
          started_by: string | null;
          status: Database["public"]["Enums"]["order_status"];
          total: number;
        };
        Insert: {
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancelled_by_role?:
            Database["public"]["Enums"]["order_cancel_role"] | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          customer_name: string;
          finished_at?: string | null;
          finished_by?: string | null;
          id?: string;
          idempotency_key?: string | null;
          is_manual_time?: boolean;
          occurred_at?: string;
          queue_date: string;
          queue_number: number;
          source: Database["public"]["Enums"]["order_source"];
          started_at?: string | null;
          started_by?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          total: number;
        };
        Update: {
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancelled_by_role?:
            Database["public"]["Enums"]["order_cancel_role"] | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          customer_name?: string;
          finished_at?: string | null;
          finished_by?: string | null;
          id?: string;
          idempotency_key?: string | null;
          is_manual_time?: boolean;
          occurred_at?: string;
          queue_date?: string;
          queue_number?: number;
          source?: Database["public"]["Enums"]["order_source"];
          started_at?: string | null;
          started_by?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orders_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_confirmed_by_fkey";
            columns: ["confirmed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_finished_by_fkey";
            columns: ["finished_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_started_by_fkey";
            columns: ["started_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          id: string;
          method: Database["public"]["Enums"]["payment_method"];
          order_id: string;
          recorded_at: string;
          recorded_by: string;
          voided_at: string | null;
          voided_by: string | null;
        };
        Insert: {
          amount: number;
          id?: string;
          method: Database["public"]["Enums"]["payment_method"];
          order_id: string;
          recorded_at?: string;
          recorded_by: string;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          amount?: number;
          id?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          order_id?: string;
          recorded_at?: string;
          recorded_by?: string;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_voided_by_fkey";
            columns: ["voided_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          is_active?: boolean;
          name: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      queue_counters: {
        Row: {
          last_number: number;
          queue_date: string;
        };
        Insert: {
          last_number?: number;
          queue_date: string;
        };
        Update: {
          last_number?: number;
          queue_date?: string;
        };
        Relationships: [];
      };
      recipes: {
        Row: {
          ingredient_id: string;
          menu_item_id: string;
          qty_per_portion: number;
        };
        Insert: {
          ingredient_id: string;
          menu_item_id: string;
          qty_per_portion: number;
        };
        Update: {
          ingredient_id?: string;
          menu_item_id?: string;
          qty_per_portion?: number;
        };
        Relationships: [
          {
            foreignKeyName: "recipes_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipes_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          ingredient_id: string;
          note: string | null;
          order_id: string | null;
          qty_change: number;
          stock_after: number;
          type: Database["public"]["Enums"]["stock_movement_type"];
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          ingredient_id: string;
          note?: string | null;
          order_id?: string | null;
          qty_change: number;
          stock_after: number;
          type: Database["public"]["Enums"]["stock_movement_type"];
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          ingredient_id?: string;
          note?: string | null;
          order_id?: string | null;
          qty_change?: number;
          stock_after?: number;
          type?: Database["public"]["Enums"]["stock_movement_type"];
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_order_confirmation: {
        Args: {
          p_actor_id: string;
          p_actor_role: Database["public"]["Enums"]["log_actor_role"];
          p_before: Json;
          p_meta: Json;
          p_order_id: string;
          p_payment_method: Database["public"]["Enums"]["payment_method"];
          p_queue_number: number;
        };
        Returns: Json;
      };
      cancel_order: {
        Args: { p_actor_id: string; p_meta?: Json; p_order_id: string };
        Returns: Json;
      };
      confirm_order: {
        Args: {
          p_actor_id: string;
          p_meta?: Json;
          p_order_id: string;
          p_payment_method: Database["public"]["Enums"]["payment_method"];
        };
        Returns: Json;
      };
      create_manual_order: {
        Args: {
          p_actor_id: string;
          p_customer_name: string;
          p_idempotency_key: string;
          p_items: Json;
          p_meta?: Json;
          p_occurred_at: string;
          p_payment_method: Database["public"]["Enums"]["payment_method"];
        };
        Returns: Json;
      };
      create_order: {
        Args: {
          p_customer_name: string;
          p_idempotency_key: string;
          p_items: Json;
        };
        Returns: Json;
      };
      current_user_role: {
        Args: never;
        Returns: Database["public"]["Enums"]["app_role"];
      };
      finish_order: {
        Args: { p_actor_id: string; p_meta?: Json; p_order_id: string };
        Returns: Json;
      };
      get_menu: { Args: never; Returns: Json };
      get_order_status: { Args: { p_order_id: string }; Returns: Json };
      menu_item_available: {
        Args: { p_menu_item_id: string };
        Returns: boolean;
      };
      parse_order_id: { Args: { p_order_id: string }; Returns: string };
      require_staff: {
        Args: {
          p_actor_id: string;
          p_allowed_roles: Database["public"]["Enums"]["app_role"][];
        };
        Returns: Database["public"]["Enums"]["app_role"];
      };
      start_order: {
        Args: { p_actor_id: string; p_meta?: Json; p_order_id: string };
        Returns: Json;
      };
      validate_customer_name: {
        Args: { p_customer_name: string };
        Returns: string;
      };
      validate_order_items: {
        Args: { p_items: Json };
        Returns: {
          menu_item_id: string;
          name_snapshot: string;
          note: string;
          price_snapshot: number;
          qty: number;
        }[];
      };
      wib_today: { Args: never; Returns: string };
      write_activity_log: {
        Args: {
          p_action: string;
          p_actor_id: string;
          p_actor_role: Database["public"]["Enums"]["log_actor_role"];
          p_after: Json;
          p_before: Json;
          p_entity_id: string;
          p_entity_type: string;
          p_meta: Json;
          p_order_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "admin" | "cashier" | "barista";
      error_severity: "warning" | "error" | "critical";
      error_source: "client" | "server" | "database";
      ingredient_unit: "g" | "ml" | "pcs";
      log_actor_role: "admin" | "cashier" | "barista" | "customer" | "system";
      order_cancel_role: "customer" | "cashier" | "admin";
      order_source: "online" | "cashier";
      order_status:
        | "menunggu_konfirmasi"
        | "antrean"
        | "dikerjakan"
        | "selesai"
        | "dibatalkan";
      payment_method: "qris" | "tunai";
      stock_movement_type:
        "order_confirm" | "order_cancel_restore" | "restock" | "adjustment";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "cashier", "barista"],
      error_severity: ["warning", "error", "critical"],
      error_source: ["client", "server", "database"],
      ingredient_unit: ["g", "ml", "pcs"],
      log_actor_role: ["admin", "cashier", "barista", "customer", "system"],
      order_cancel_role: ["customer", "cashier", "admin"],
      order_source: ["online", "cashier"],
      order_status: [
        "menunggu_konfirmasi",
        "antrean",
        "dikerjakan",
        "selesai",
        "dibatalkan",
      ],
      payment_method: ["qris", "tunai"],
      stock_movement_type: [
        "order_confirm",
        "order_cancel_restore",
        "restock",
        "adjustment",
      ],
    },
  },
} as const;
