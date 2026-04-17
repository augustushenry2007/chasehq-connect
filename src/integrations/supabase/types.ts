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
  public: {
    Tables: {
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
      gmail_connections: {
        Row: {
          access_token: string
          created_at: string
          email: string
          id: string
          refresh_token: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email: string
          id?: string
          refresh_token: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string
          id?: string
          refresh_token?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
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
      profiles: {
        Row: {
          created_at: string
          email_provider: string | null
          full_name: string | null
          id: string
          onboarding_completed: boolean
          sender_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_provider?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          sender_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_provider?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          sender_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      smtp_connections: {
        Row: {
          created_at: string
          from_email: string
          from_name: string | null
          smtp_host: string
          smtp_password: string
          smtp_port: number
          smtp_username: string
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          from_email: string
          from_name?: string | null
          smtp_host: string
          smtp_password: string
          smtp_port?: number
          smtp_username: string
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          from_email?: string
          from_name?: string | null
          smtp_host?: string
          smtp_password?: string
          smtp_port?: number
          smtp_username?: string
          updated_at?: string
          user_id?: string
          verified?: boolean
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
      smtp_connections_safe: {
        Row: {
          created_at: string | null
          from_email: string | null
          from_name: string | null
          smtp_host: string | null
          smtp_port: number | null
          smtp_username: string | null
          updated_at: string | null
          user_id: string | null
          verified: boolean | null
        }
        Insert: {
          created_at?: string | null
          from_email?: string | null
          from_name?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Update: {
          created_at?: string | null
          from_email?: string | null
          from_name?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_active_entitlement: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      invoice_status:
        | "Escalated"
        | "Overdue"
        | "Follow-up"
        | "Upcoming"
        | "Paid"
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
  public: {
    Enums: {
      invoice_status: ["Escalated", "Overdue", "Follow-up", "Upcoming", "Paid"],
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
