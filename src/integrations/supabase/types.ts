export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      lojas: {
        Row: {
          ativa: boolean;
          cnpj: string | null;
          codigo: string;
          created_at: string;
          endereco: string | null;
          id: string;
          matriz_id: string | null;
          nome: string;
          supermercado_id: string;
          tipo: string;
          updated_at: string;
        };
        Insert: {
          ativa?: boolean;
          cnpj?: string | null;
          codigo: string;
          created_at?: string;
          endereco?: string | null;
          id?: string;
          matriz_id?: string | null;
          nome: string;
          supermercado_id: string;
          tipo?: string;
          updated_at?: string;
        };
        Update: {
          ativa?: boolean;
          cnpj?: string | null;
          codigo?: string;
          created_at?: string;
          endereco?: string | null;
          id?: string;
          matriz_id?: string | null;
          nome?: string;
          supermercado_id?: string;
          tipo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lojas_matriz_id_fkey";
            columns: ["matriz_id"];
            isOneToOne: false;
            referencedRelation: "lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lojas_supermercado_id_fkey";
            columns: ["supermercado_id"];
            isOneToOne: false;
            referencedRelation: "supermercados";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
          nome: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id: string;
          nome?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: string;
          nome?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      recebimento_itens: {
        Row: {
          created_at: string;
          descricao: string;
          ean: string;
          id: string;
          lote: string | null;
          observacao: string | null;
          preco_unitario: number | null;
          qtd_conferida: number;
          qtd_esperada: number;
          recebimento_id: string;
          status: string;
          unidade: string;
          updated_at: string;
          validade: string | null;
        };
        Insert: {
          created_at?: string;
          descricao: string;
          ean: string;
          id?: string;
          lote?: string | null;
          observacao?: string | null;
          preco_unitario?: number | null;
          qtd_conferida?: number;
          qtd_esperada?: number;
          recebimento_id: string;
          status?: string;
          unidade?: string;
          updated_at?: string;
          validade?: string | null;
        };
        Update: {
          created_at?: string;
          descricao?: string;
          ean?: string;
          id?: string;
          lote?: string | null;
          observacao?: string | null;
          preco_unitario?: number | null;
          qtd_conferida?: number;
          qtd_esperada?: number;
          recebimento_id?: string;
          status?: string;
          unidade?: string;
          updated_at?: string;
          validade?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "recebimento_itens_recebimento_id_fkey";
            columns: ["recebimento_id"];
            isOneToOne: false;
            referencedRelation: "recebimentos";
            referencedColumns: ["id"];
          },
        ];
      };
      recebimentos: {
        Row: {
          cnpj: string | null;
          conferente: string | null;
          created_at: string;
          finalizado_at: string | null;
          fornecedor: string;
          id: string;
          loja: string;
          numero_nf: string;
          observacoes: string | null;
          status: string;
          total_conferidos: number;
          total_divergencias: number;
          total_itens: number;
          updated_at: string;
        };
        Insert: {
          cnpj?: string | null;
          conferente?: string | null;
          created_at?: string;
          finalizado_at?: string | null;
          fornecedor: string;
          id?: string;
          loja?: string;
          numero_nf: string;
          observacoes?: string | null;
          status?: string;
          total_conferidos?: number;
          total_divergencias?: number;
          total_itens?: number;
          updated_at?: string;
        };
        Update: {
          cnpj?: string | null;
          conferente?: string | null;
          created_at?: string;
          finalizado_at?: string | null;
          fornecedor?: string;
          id?: string;
          loja?: string;
          numero_nf?: string;
          observacoes?: string | null;
          status?: string;
          total_conferidos?: number;
          total_divergencias?: number;
          total_itens?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      supermercados: {
        Row: {
          cnpj: string | null;
          created_at: string;
          id: string;
          nome: string;
          updated_at: string;
        };
        Insert: {
          cnpj?: string | null;
          created_at?: string;
          id?: string;
          nome: string;
          updated_at?: string;
        };
        Update: {
          cnpj?: string | null;
          created_at?: string;
          id?: string;
          nome?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_loja_roles: {
        Row: {
          created_at: string;
          id: string;
          loja_id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          loja_id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          loja_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_loja_roles_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "lojas";
            referencedColumns: ["id"];
          },
        ];
      };
      user_lojas: {
        Row: {
          created_at: string;
          id: string;
          loja: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          loja: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          loja?: string;
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
      has_loja_access: {
        Args: { _loja: string; _user_id: string };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "conferente" | "supervisor" | "auditor";
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["conferente", "supervisor", "auditor"],
    },
  },
} as const;
