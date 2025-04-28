export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      deco_chat_agents: {
        Row: {
          avatar: string;
          created_at: string;
          description: string | null;
          draft: boolean | null;
          id: string;
          instructions: string;
          max_steps: number | null;
          max_tokens: number | null;
          memory: Json | null;
          model: string;
          name: string;
          tools_set: Json;
          views: Json;
          workspace: string;
        };
        Insert: {
          avatar: string;
          created_at?: string;
          description?: string | null;
          draft?: boolean | null;
          id?: string;
          instructions: string;
          max_steps?: number | null;
          max_tokens?: number | null;
          memory?: Json | null;
          model?: string;
          name: string;
          tools_set: Json;
          views: Json;
          workspace: string;
        };
        Update: {
          avatar?: string;
          created_at?: string;
          description?: string | null;
          draft?: boolean | null;
          id?: string;
          instructions?: string;
          max_steps?: number | null;
          max_tokens?: number | null;
          memory?: Json | null;
          model?: string;
          name?: string;
          tools_set?: Json;
          views?: Json;
          workspace?: string;
        };
        Relationships: [];
      };
      deco_chat_cron_triggers: {
        Row: {
          agent_workspace: string;
          created_at: string;
          cron_exp: string;
          description: string | null;
          id: string;
          prompt: Json;
          title: string;
          updated_at: string;
          workspace: string;
        };
        Insert: {
          agent_workspace: string;
          created_at?: string;
          cron_exp: string;
          description?: string | null;
          id?: string;
          prompt: Json;
          title: string;
          updated_at?: string;
          workspace: string;
        };
        Update: {
          agent_workspace?: string;
          created_at?: string;
          cron_exp?: string;
          description?: string | null;
          id?: string;
          prompt?: Json;
          title?: string;
          updated_at?: string;
          workspace?: string;
        };
        Relationships: [];
      };
      deco_chat_integrations: {
        Row: {
          connection: Json;
          created_at: string;
          description: string | null;
          icon: string | null;
          id: string;
          name: string;
          workspace: string;
        };
        Insert: {
          connection: Json;
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          name: string;
          workspace: string;
        };
        Update: {
          connection?: Json;
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          name?: string;
          workspace?: string;
        };
        Relationships: [];
      };
      deco_chat_webhook_triggers: {
        Row: {
          agent_workspace: string;
          created_at: string;
          description: string | null;
          id: string;
          passphrase: string;
          schema: Json;
          title: string;
          updated_at: string;
          url: string;
          workspace: string;
        };
        Insert: {
          agent_workspace: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          passphrase: string;
          schema: Json;
          title: string;
          updated_at?: string;
          url: string;
          workspace: string;
        };
        Update: {
          agent_workspace?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          passphrase?: string;
          schema?: Json;
          title?: string;
          updated_at?: string;
          url?: string;
          workspace?: string;
        };
        Relationships: [];
      };
      deco_users: {
        Row: {
          avatar: string | null;
          created_at: string;
          experts_airtable_id: string;
          id: number;
          username: string;
        };
        Insert: {
          avatar?: string | null;
          created_at?: string;
          experts_airtable_id: string;
          id?: number;
          username: string;
        };
        Update: {
          avatar?: string | null;
          created_at?: string;
          experts_airtable_id?: string;
          id?: number;
          username?: string;
        };
        Relationships: [];
      };
      "decochat-admin": {
        Row: {
          code: string | null;
          connectionId: string | null;
          created_at: string;
          id: number;
          token: string | null;
        };
        Insert: {
          code?: string | null;
          connectionId?: string | null;
          created_at?: string;
          id?: number;
          token?: string | null;
        };
        Update: {
          code?: string | null;
          connectionId?: string | null;
          created_at?: string;
          id?: number;
          token?: string | null;
        };
        Relationships: [];
      };
      domain_validation_tokens: {
        Row: {
          created_at: string;
          domain: string | null;
          id: number;
          sitename: string | null;
          uuid: string | null;
        };
        Insert: {
          created_at?: string;
          domain?: string | null;
          id?: number;
          sitename?: string | null;
          uuid?: string | null;
        };
        Update: {
          created_at?: string;
          domain?: string | null;
          id?: number;
          sitename?: string | null;
          uuid?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "domain_validation_tokens_sitename_fkey";
            columns: ["sitename"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["name"];
          },
        ];
      };
      form_submission: {
        Row: {
          created_at: string | null;
          data: Json | null;
          id: number;
          site_id: number;
        };
        Insert: {
          created_at?: string | null;
          data?: Json | null;
          id?: number;
          site_id: number;
        };
        Update: {
          created_at?: string | null;
          data?: Json | null;
          id?: number;
          site_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "form_submission_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      invites: {
        Row: {
          created_at: string;
          id: string;
          invited_email: string;
          invited_roles: Json[] | null;
          inviter_id: string;
          team_id: number;
          team_name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invited_email: string;
          invited_roles?: Json[] | null;
          inviter_id: string;
          team_id: number;
          team_name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invited_email?: string;
          invited_roles?: Json[] | null;
          inviter_id?: string;
          team_id?: number;
          team_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invites_inviter_id_fkey";
            columns: ["inviter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "invites_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      mcp_wallet_tokens: {
        Row: {
          created_at: string;
          mcp_id: string;
          token: string;
        };
        Insert: {
          created_at?: string;
          mcp_id: string;
          token: string;
        };
        Update: {
          created_at?: string;
          mcp_id?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mcp_wallet_tokens_mcp_id_fkey";
            columns: ["mcp_id"];
            isOneToOne: false;
            referencedRelation: "mcp_wallets";
            referencedColumns: ["id"];
          },
        ];
      };
      mcp_wallets: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          owner_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          owner_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mcp_wallets_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      member_roles: {
        Row: {
          created_at: string;
          id: number;
          member_id: number;
          role_id: number;
        };
        Insert: {
          created_at?: string;
          id?: number;
          member_id: number;
          role_id: number;
        };
        Update: {
          created_at?: string;
          id?: number;
          member_id?: number;
          role_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "member_roles_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_roles_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      members: {
        Row: {
          activity: Json[] | null;
          admin: boolean | null;
          created_at: string | null;
          deleted_at: string | null;
          id: number;
          stripe_customer_id: string | null;
          team_id: number | null;
          user_id: string | null;
        };
        Insert: {
          activity?: Json[] | null;
          admin?: boolean | null;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: number;
          stripe_customer_id?: string | null;
          team_id?: number | null;
          user_id?: string | null;
        };
        Update: {
          activity?: Json[] | null;
          admin?: boolean | null;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: number;
          stripe_customer_id?: string | null;
          team_id?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "members_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      permissions: {
        Row: {
          action: string;
          created_at: string;
          id: number;
          role_id: number;
          type: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: number;
          role_id: number;
          type: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: number;
          role_id?: number;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "permissions_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          currency: string | null;
          discount: number | null;
          fixed_price: number | null;
          gmv_threshold: number | null;
          id: number;
          included_bw: number | null;
          included_bw_per_10k_pageviews: number | null;
          included_pageviews: number | null;
          included_requests_per_10k_pageviews: number | null;
          name: string | null;
          performance_bonus: number | null;
          plan_id: string | null;
          price_extra_1gb_bw_after_included_per_10k_pageviews: number | null;
          price_extra_1k_requests_after_included_per_10k_pageviews:
            | number
            | null;
          price_per_10k: number | null;
          price_per_additional_1gb_bw: number | null;
          price_review: number | null;
          takerate_gmv: number | null;
        };
        Insert: {
          currency?: string | null;
          discount?: number | null;
          fixed_price?: number | null;
          gmv_threshold?: number | null;
          id: number;
          included_bw?: number | null;
          included_bw_per_10k_pageviews?: number | null;
          included_pageviews?: number | null;
          included_requests_per_10k_pageviews?: number | null;
          name?: string | null;
          performance_bonus?: number | null;
          plan_id?: string | null;
          price_extra_1gb_bw_after_included_per_10k_pageviews?: number | null;
          price_extra_1k_requests_after_included_per_10k_pageviews?:
            | number
            | null;
          price_per_10k?: number | null;
          price_per_additional_1gb_bw?: number | null;
          price_review?: number | null;
          takerate_gmv?: number | null;
        };
        Update: {
          currency?: string | null;
          discount?: number | null;
          fixed_price?: number | null;
          gmv_threshold?: number | null;
          id?: number;
          included_bw?: number | null;
          included_bw_per_10k_pageviews?: number | null;
          included_pageviews?: number | null;
          included_requests_per_10k_pageviews?: number | null;
          name?: string | null;
          performance_bonus?: number | null;
          plan_id?: string | null;
          price_extra_1gb_bw_after_included_per_10k_pageviews?: number | null;
          price_extra_1k_requests_after_included_per_10k_pageviews?:
            | number
            | null;
          price_per_10k?: number | null;
          price_per_additional_1gb_bw?: number | null;
          price_review?: number | null;
          takerate_gmv?: number | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string | null;
          deco_user_id: number | null;
          email: string;
          id: number;
          is_new_user: boolean | null;
          name: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          deco_user_id?: number | null;
          email: string;
          id?: number;
          is_new_user?: boolean | null;
          name?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          deco_user_id?: number | null;
          email?: string;
          id?: number;
          is_new_user?: boolean | null;
          name?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users_meta_data_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "public_profiles_deco_user_id_fkey";
            columns: ["deco_user_id"];
            isOneToOne: false;
            referencedRelation: "deco_users";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          customer_details: Json | null;
          go_live_date: string | null;
          id: string;
          plan: number | null;
          signed_date: string | null;
          status: string | null;
          tax_id: string | null;
          team: number | null;
        };
        Insert: {
          customer_details?: Json | null;
          go_live_date?: string | null;
          id?: string;
          plan?: number | null;
          signed_date?: string | null;
          status?: string | null;
          tax_id?: string | null;
          team?: number | null;
        };
        Update: {
          customer_details?: Json | null;
          go_live_date?: string | null;
          id?: string;
          plan?: number | null;
          signed_date?: string | null;
          status?: string | null;
          tax_id?: string | null;
          team?: number | null;
        };
        Relationships: [];
      };
      tag: {
        Row: {
          color: string;
          created_at: string;
          id: number;
          label: string;
        };
        Insert: {
          color: string;
          created_at?: string;
          id?: number;
          label: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: number;
          label?: string;
        };
        Relationships: [];
      };
      team_access_suspension: {
        Row: {
          created_at: string;
          id: number;
          is_active: boolean;
          suspended_at: string;
          suspended_reason: string;
          team_id: number;
        };
        Insert: {
          created_at?: string;
          id?: number;
          is_active?: boolean;
          suspended_at: string;
          suspended_reason: string;
          team_id: number;
        };
        Update: {
          created_at?: string;
          id?: number;
          is_active?: boolean;
          suspended_at?: string;
          suspended_reason?: string;
          team_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "team_blocks_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      team_overdue_warning: {
        Row: {
          acknowledged_at: string | null;
          created_at: string;
          expected_access_suspension: string;
          id: number;
          is_active: boolean;
          overdue_invoices: number[];
          team_id: number;
          warned_at: string;
        };
        Insert: {
          acknowledged_at?: string | null;
          created_at?: string;
          expected_access_suspension: string;
          id?: number;
          is_active?: boolean;
          overdue_invoices: number[];
          team_id: number;
          warned_at: string;
        };
        Update: {
          acknowledged_at?: string | null;
          created_at?: string;
          expected_access_suspension?: string;
          id?: number;
          is_active?: boolean;
          overdue_invoices?: number[];
          team_id?: number;
          warned_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_overdue_warning_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          created_at: string | null;
          id: number;
          name: string;
          slug: string | null;
          stripe_subscription_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: number;
          name: string;
          slug?: string | null;
          stripe_subscription_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: number;
          name?: string;
          slug?: string | null;
          stripe_subscription_id?: string | null;
        };
        Relationships: [];
      };
      url_metadata_cache: {
        Row: {
          created_at: string;
          creator_token: string | null;
          data: Json | null;
          id: number;
          url: string | null;
        };
        Insert: {
          created_at?: string;
          creator_token?: string | null;
          data?: Json | null;
          id?: number;
          url?: string | null;
        };
        Update: {
          created_at?: string;
          creator_token?: string | null;
          data?: Json | null;
          id?: number;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "url_metadata_cache_creator_token_fkey";
            columns: ["creator_token"];
            isOneToOne: false;
            referencedRelation: "tokens";
            referencedColumns: ["token"];
          },
        ];
      };
      user_activity: {
        Row: {
          created_at: string;
          id: number;
          key: string | null;
          resource: string;
          user_id: string;
          value: string | null;
        };
        Insert: {
          created_at?: string;
          id?: number;
          key?: string | null;
          resource: string;
          user_id: string;
          value?: string | null;
        };
        Update: {
          created_at?: string;
          id?: number;
          key?: string | null;
          resource?: string;
          user_id?: string;
          value?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_opened_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      workflow_executions: {
        Row: {
          created_at: string;
          id: number;
          site: string | null;
          workflow_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: number;
          site?: string | null;
          workflow_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: number;
          site?: string | null;
          workflow_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  } ? keyof (
      & Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
      & Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"]
    )
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database } ? (
    & Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    & Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"]
  )[TableName] extends {
    Row: infer R;
  } ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (
    & DefaultSchema["Tables"]
    & DefaultSchema["Views"]
  ) ? (
      & DefaultSchema["Tables"]
      & DefaultSchema["Views"]
    )[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    } ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  } ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][
    TableName
  ] extends {
    Insert: infer I;
  } ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    } ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  } ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][
    TableName
  ] extends {
    Update: infer U;
  } ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    } ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  } ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  } ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]][
      "CompositeTypes"
    ]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][
    CompositeTypeName
  ]
  : PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
