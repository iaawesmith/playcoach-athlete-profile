import { supabase } from "@/integrations/supabase/client";
import type { TrainingNode, AnalysisResult } from "@/features/athlete-lab/types";

export async function fetchNodes(): Promise<TrainingNode[]> {
  const { data, error } = await supabase
    .from("athlete_lab_nodes" as never)
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as TrainingNode[];
}

export async function fetchNode(id: string): Promise<TrainingNode> {
  const { data, error } = await supabase
    .from("athlete_lab_nodes" as never)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as unknown as TrainingNode;
}

export async function createNode(node: Partial<TrainingNode>): Promise<TrainingNode> {
  const { data, error } = await supabase
    .from("athlete_lab_nodes" as never)
    .insert(node as never)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TrainingNode;
}

export async function updateNode(id: string, updates: Partial<TrainingNode>): Promise<TrainingNode> {
  const { data, error } = await supabase
    .from("athlete_lab_nodes" as never)
    .update(updates as never)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TrainingNode;
}

export async function deleteNode(id: string): Promise<void> {
  const { error } = await supabase
    .from("athlete_lab_nodes" as never)
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function runAnalysis(node: TrainingNode, videoDescription: string): Promise<AnalysisResult> {
  const { data, error } = await supabase.functions.invoke("athlete-lab-analyze", {
    body: { node, videoDescription },
  });

  if (error) throw error;
  return data as AnalysisResult;
}
