Initialising login role...
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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      apple_notification_log: {
        Row: {
          notification_type: string | null
          notification_uuid: string
          original_transaction_id: string | null
          processed_ok: boolean
          received_at: string
          subtype: string | null
        }
        Insert: {
          notification_type?: string | null
          notification_uuid: string
          original_transaction_id?: string | null
          processed_ok?: boolean
          received_at?: string
          subtype?: string | null
        }
        Update: {
          notification_type?: string | null
          notification_uuid?: string
          original_transaction_id?: string | null
          processed_ok?: boolean
          received_at?: string
          subtype?: string | null
        }
        Relationships: []
      }
      daily_quotas: {
        Row: {
          call_count: number
          day: string
          function_name: string
          subject: string
        }
        Insert: {
          call_count?: number
          day: string
          function_name: string
          subject: string
        }
        Update: {
          call_count?: number
          day?: string
          function_name?: string
          subject?: string
        }
        Relationships: []
      }
      dispatch_health: {
        Row: {
          id: number
          last_counts: Json | null
          last_error: string | null
          last_ok_at: string | null
          last_run_at: string | null
        }
        Insert: {
          id?: number
          last_counts?: Json | null
          last_error?: string | null
          last_ok_at?: string | null
          last_run_at?: string | null
        }
        Update: {
          id?: number
          last_counts?: Json | null
          last_error?: string | null
          last_ok_at?: string | null
          last_run_at?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          id: string
          invoice_id: string | null
          recipient: string
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          invoice_id?: string | null
          recipient: string
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          invoice_id?: string | null
          recipient?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      followup_schedules: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          paused: boolean
          steps: Json
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          paused?: boolean
          steps?: Json
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          paused?: boolean
          steps?: Json
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      followups: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          is_ai_generated: boolean
          message: string
          sent_at: string | null
          subject: string | null
          tone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          is_ai_generated?: boolean
          message: string
          sent_at?: string | null
          subject?: string | null
          tone?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          is_ai_generated?: boolean
          message?: string
          sent_at?: string | null
          subject?: string | null
          tone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followups_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      gemini_usage: {
        Row: {
          cost_estimate_usd: number | null
          created_at: string
          function_name: string
          id: string
          input_tokens: number | null
          model: string
          output_tokens: number | null
          prompt_injection_attempts: number
          subject: string
          total_tokens: number | null
        }
        Insert: {
          cost_estimate_usd?: number | null
          created_at?: string
          function_name: string
          id?: string
          input_tokens?: number | null
          model: string
          output_tokens?: number | null
          prompt_injection_attempts?: number
          subject: string
          total_tokens?: number | null
        }
        Update: {
          cost_estimate_usd?: number | null
          created_at?: string
          function_name?: string
          id?: string
          input_tokens?: number | null
          model?: string
          output_tokens?: number | null
          prompt_injection_attempts?: number
          subject?: string
          total_tokens?: number | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          client: string
          client_email: string
          client_reply_received_at: string | null
          client_reply_sender_email: string | null
          client_reply_snippet: string | null
          created_at: string
          days_past_due: number
          description: string
          due_date: string
          id: string
          invoice_number: string
          payment_details: string
          sent_from: string
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          client: string
          client_email: string
          client_reply_received_at?: string | null
          client_reply_sender_email?: string | null
          client_reply_snippet?: string | null
          created_at?: string
          days_past_due?: number
          description?: string
          due_date: string
          id?: string
          invoice_number: string
          payment_details?: string
          sent_from?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          client?: string
          client_email?: string
          client_reply_received_at?: string | null
          client_reply_sender_email?: string | null
          client_reply_snippet?: string | null
          created_at?: string
          days_past_due?: number
          description?: string
          due_date?: string
          id?: string
          invoice_number?: string
          payment_details?: string
          sent_from?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          default_tone: string | null
          email_enabled: boolean
          enabled: boolean
          push_enabled: boolean
          quiet_hours_end: number
          quiet_hours_start: number
          schedule_preset: string | null
          schedule_steps: Json | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_tone?: string | null
          email_enabled?: boolean
          enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: number
          quiet_hours_start?: number
          schedule_preset?: string | null
          schedule_steps?: Json | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_tone?: string | null
          email_enabled?: boolean
          enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: number
          quiet_hours_start?: number
          schedule_preset?: string | null
          schedule_steps?: Json | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          attempts: number
          body: string
          created_at: string
          delivered_at: string | null
          email_attempts: number
          email_sent_at: string | null
          id: string
          invoice_id: string
          read_at: string | null
          schedule_step_index: number
          scheduled_for: string
          status: Database["public"]["Enums"]["notification_status"]
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          body: string
          created_at?: string
          delivered_at?: string | null
          email_attempts?: number
          email_sent_at?: string | null
          id?: string
          invoice_id: string
          read_at?: string | null
          schedule_step_index: number
          scheduled_for: string
          status?: Database["public"]["Enums"]["notification_status"]
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          body?: string
          created_at?: string
          delivered_at?: string | null
          email_attempts?: number
          email_sent_at?: string | null
          id?: string
          invoice_id?: string
          read_at?: string | null
          schedule_step_index?: number
          scheduled_for?: string
          status?: Database["public"]["Enums"]["notification_status"]
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          dismissed_hints: Json
          email_provider: string | null
          full_name: string | null
          id: string
          onboarding_completed: boolean
          onboarding_step: number | null
          tour_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dismissed_hints?: Json
          email_provider?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          onboarding_step?: number | null
          tour_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dismissed_hints?: Json
          email_provider?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          onboarding_step?: number | null
          tour_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          call_count: number
          function_name: string
          subject: string
          window_start: string
        }
        Insert: {
          call_count?: number
          function_name: string
          subject: string
          window_start: string
        }
        Update: {
          call_count?: number
          function_name?: string
          subject?: string
          window_start?: string
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          apple_latest_receipt: string | null
          apple_original_transaction_id: string | null
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          id: string
          last_event_at: string
          plan: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          apple_latest_receipt?: string | null
          apple_original_transaction_id?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          last_event_at?: string
          plan?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          apple_latest_receipt?: string | null
          apple_original_transaction_id?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          last_event_at?: string
          plan?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_active_entitlement: { Args: { _user_id: string }; Returns: boolean }
      increment_daily_quota: {
        Args: { p_day: string; p_function_name: string; p_subject: string }
        Returns: number
      }
      increment_rate_limit: {
        Args: {
          p_function_name: string
          p_subject: string
          p_window_start: string
        }
        Returns: number
      }
      pg_try_advisory_lock: { Args: { key: number }; Returns: boolean }
      prune_apple_notification_log: { Args: never; Returns: undefined }
      prune_daily_quotas: { Args: never; Returns: undefined }
      prune_gemini_usage: { Args: never; Returns: undefined }
      prune_rate_limits: { Args: never; Returns: undefined }
      reconcile_invoice_status: { Args: never; Returns: undefined }
      vault_read_secret: { Args: { p_id: string }; Returns: string }
      vault_update_secret: {
        Args: { p_id: string; p_value: string }
        Returns: undefined
      }
    }
    Enums: {
      invoice_status:
        | "Escalated"
        | "Overdue"
        | "Follow-up"
        | "Upcoming"
        | "Paid"
      notification_status:
        | "pending"
        | "delivered"
        | "read"
        | "canceled"
        | "failed"
      notification_type: "due" | "followup" | "escalation"
      subscription_status:
        | "none"
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "expired"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      invoice_status: ["Escalated", "Overdue", "Follow-up", "Upcoming", "Paid"],
      notification_status: [
        "pending",
        "delivered",
        "read",
        "canceled",
        "failed",
      ],
      notification_type: ["due", "followup", "escalation"],
      subscription_status: [
        "none",
        "trialing",
        "active",
        "past_due",
        "canceled",
        "expired",
      ],
    },
  },
} as const
A new version of Supabase CLI is available: v2.98.2 (currently installed v2.90.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
