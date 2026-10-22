import { supabase } from "@/integrations/supabase/client";
import type { CoachProvider } from "../../supabase/functions/analyze-athlete-video/llm";

export interface CoachingModelDefault {
  provider: CoachProvider;
  model: string;
  updated_at: string;
}

export interface BuiltinModelOption {
  id: string;
  deprecated: boolean;
  retention: string;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-coaching-model", { body });
  if (error) throw new Error(error.message);
  return data as T;
}

export function getCoachingModelSettings(): Promise<{ default: CoachingModelDefault | null; builtin_options: BuiltinModelOption[] }> {
  return call({ action: "get" });
}

export function setCoachingModelDefault(provider: CoachProvider, model: string): Promise<{ default: CoachingModelDefault }> {
  return call({ action: "set_default", provider, model });
}
