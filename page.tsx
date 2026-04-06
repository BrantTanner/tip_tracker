import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type TodoRow = {
  id: number;
  name: string;
  created_at?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ?? "";

export function createSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment values.");
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function getTodos(): Promise<TodoRow[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("todos")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as TodoRow[];
}