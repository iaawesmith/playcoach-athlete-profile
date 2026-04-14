import { supabase } from "@/integrations/supabase/client";
import type { TrainingNode, AnalysisResult, NodeStatus } from "@/features/athlete-lab/types";

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

export async function setNodeStatus(id: string, status: NodeStatus): Promise<TrainingNode> {
  const { data, error } = await supabase
    .from("athlete_lab_nodes" as never)
    .update({ status } as never)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TrainingNode;
}

export interface AnalysisContext {
  camera_angle: string;
  people_in_video: string;
  route_direction: string;
  catch_included: boolean;
  catch_status: string;
  athlete_level: string;
  focus_area: string;
}

export async function runAnalysis(node: TrainingNode, videoDescription: string, analysisContext?: AnalysisContext): Promise<AnalysisResult> {
  const { data, error } = await supabase.functions.invoke("athlete-lab-analyze", {
    body: { node, videoDescription, analysis_context: analysisContext },
  });

  if (error) throw error;
  return data as AnalysisResult;
}
