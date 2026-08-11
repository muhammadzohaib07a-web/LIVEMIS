export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      departments: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      issue_categories: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          description: string | null;
          group_name: string;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          group_name?: string;
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          group_name?: string;
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      kb_articles: {
        Row: {
          category: string;
          content: string;
          created_at: string;
          id: string;
          published: boolean;
          slug: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          category?: string;
          content: string;
          created_at?: string;
          id?: string;
          published?: boolean;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          content?: string;
          created_at?: string;
          id?: string;
          published?: boolean;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      message_reactions: {
        Row: {
          created_at: string;
          emoji: string;
          message_id: string;
          ticket_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          emoji: string;
          message_id: string;
          ticket_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          emoji?: string;
          message_id?: string;
          ticket_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      message_reads: {
        Row: {
          message_id: string;
          read_at: string;
          ticket_id: string;
          user_id: string;
        };
        Insert: {
          message_id: string;
          read_at?: string;
          ticket_id: string;
          user_id: string;
        };
        Update: {
          message_id?: string;
          read_at?: string;
          ticket_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          link: string | null;
          read: boolean;
          title: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read?: boolean;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read?: boolean;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          department: string | null;
          email: string | null;
          employee_id: string | null;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          department?: string | null;
          email?: string | null;
          employee_id?: string | null;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          department?: string | null;
          email?: string | null;
          employee_id?: string | null;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth_key: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          user_id: string;
        };
        Insert: {
          auth_key: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          user_id: string;
        };
        Update: {
          auth_key?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ticket_messages: {
        Row: {
          attachments: Json;
          body: string;
          created_at: string;
          id: string;
          sender_id: string;
          ticket_id: string;
        };
        Insert: {
          attachments?: Json;
          body: string;
          created_at?: string;
          id?: string;
          sender_id: string;
          ticket_id: string;
        };
        Update: {
          attachments?: Json;
          body?: string;
          created_at?: string;
          id?: string;
          sender_id?: string;
          ticket_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      tickets: {
        Row: {
          assignee_id: string | null;
          attachments: Json;
          category: string;
          closed_at: string | null;
          created_at: string;
          description: string;
          follow_up_reason: string | null;
          id: string;
          metadata: Json;
          parent_ticket_id: string | null;
          priority: Database["public"]["Enums"]["ticket_priority"];
          status: Database["public"]["Enums"]["ticket_status"];
          ticket_no: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          assignee_id?: string | null;
          attachments?: Json;
          category?: string;
          closed_at?: string | null;
          created_at?: string;
          description: string;
          follow_up_reason?: string | null;
          id?: string;
          metadata?: Json;
          parent_ticket_id?: string | null;
          priority?: Database["public"]["Enums"]["ticket_priority"];
          status?: Database["public"]["Enums"]["ticket_status"];
          ticket_no?: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          assignee_id?: string | null;
          attachments?: Json;
          category?: string;
          closed_at?: string | null;
          created_at?: string;
          description?: string;
          follow_up_reason?: string | null;
          id?: string;
          metadata?: Json;
          parent_ticket_id?: string | null;
          priority?: Database["public"]["Enums"]["ticket_priority"];
          status?: Database["public"]["Enums"]["ticket_status"];
          ticket_no?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_mis_staff: {
        Args: {
          _user_id: string;
        };
        Returns: boolean;
      };
      list_mis_agents: {
        Args: Record<PropertyKey, never>;
        Returns: {
          assigned_count: number;
          email: string | null;
          full_name: string | null;
          id: string;
        }[];
      };
    };
    Enums: {
      app_role: "admin" | "agent" | "employee";
      ticket_category:
        | "hardware"
        | "software"
        | "network"
        | "email"
        | "access"
        | "erp"
        | "printer"
        | "server"
        | "backup"
        | "cctv"
        | "attendance"
        | "odoo"
        | "other";
      ticket_priority: "low" | "medium" | "high" | "urgent";
      ticket_status:
        | "open"
        | "in_progress"
        | "answered"
        | "awaiting_feedback"
        | "resolved"
        | "closed"
        | "canceled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
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
  public: {
    Enums: {
      app_role: ["admin", "agent", "employee"],
      ticket_category: [
        "hardware",
        "software",
        "network",
        "email",
        "access",
        "erp",
        "printer",
        "server",
        "backup",
        "cctv",
        "attendance",
        "odoo",
        "other",
      ],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: [
        "open",
        "in_progress",
        "answered",
        "awaiting_feedback",
        "resolved",
        "closed",
        "canceled",
      ],
    },
  },
} as const;
