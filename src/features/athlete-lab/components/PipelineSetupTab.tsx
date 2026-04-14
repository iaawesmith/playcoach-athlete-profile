import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ChecklistItem {
  item_id: string;
  title: string;
  description: string;
}

interface Phase {
  name: string;
  items: ChecklistItem[];
}

const PHASES: Phase[] = [
  {
    name: "SUPABASE INFRASTRUCTURE",
    items: [
      { item_id: "athlete_uploads_created", title: "athlete_uploads table created", description: "Core trigger table for the webhook pipeline. RLS enabled with athlete INSERT and service role SELECT/UPDATE policies." },
      { item_id: "webhook_configured", title: "Database Webhook configured", description: "Webhook on athlete_uploads INSERT → Edge Function URL. Fires the moment an athlete uploads a video." },
      { item_id: "edge_function_deployed", title: "Edge Function deployed", description: "analyze-athlete-video Supabase Edge Function (Deno/TypeScript). Orchestrates the full pipeline from webhook to results." },
      { item_id: "edge_function_env_vars", title: "Edge Function environment variables set", description: "SUPABASE_SERVICE_ROLE_KEY and CLOUD_RUN_SERVICE_URL must be set as Edge Function secrets." },
      { item_id: "storage_bucket_created", title: "Supabase Storage bucket created", description: "athlete-videos bucket for uploaded footage. RLS allows authenticated athletes to upload to their own folder." },
      { item_id: "storage_rls_configured", title: "Storage RLS policies configured", description: "Athletes can upload to athletes/{user_id}/. Service role can read all files for Edge Function processing." },
      { item_id: "results_table_verified", title: "athlete_lab_results table verified", description: "Confirm table exists and Edge Function service role can INSERT results rows." },
    ],
  },
  {
    name: "CLOUD RUN RTMLIB SERVICE",
    items: [
      { item_id: "dockerfile_created", title: "Dockerfile created", description: "Container with: rtmlib, onnxruntime-gpu, numpy, opencv-python-headless, fastapi, uvicorn, yt-dlp, ffmpeg." },
      { item_id: "fastapi_implemented", title: "FastAPI service implemented", description: "POST /analyze endpoint accepts video_url + node_config JSON. Returns keypoints and scores per frame." },
      { item_id: "container_pushed", title: "Container built and pushed", description: "Docker build + push to Google Artifact Registry. Tag with version number." },
      { item_id: "cloud_run_deployed", title: "Cloud Run service deployed (CPU)", description: "gcloud run deploy with --memory 8Gi --cpu 4. Note service URL." },
      { item_id: "rtmw_model_confirmed", title: "RTMW model download confirmed", description: "First request triggers auto-download of RTMW ONNX weights. Confirm model loads without error." },
      { item_id: "wholebody_tested", title: "Wholebody solution class tested", description: "Test with a sample frame. Confirm keypoints[person][index] returns [x,y] for all 133 indices." },
      { item_id: "cloud_run_url_added", title: "Cloud Run URL added to Edge Function config", description: "Set CLOUD_RUN_SERVICE_URL environment variable in Edge Function secrets." },
    ],
  },
  {
    name: "EDGE FUNCTION LOGIC",
    items: [
      { item_id: "node_config_fetch", title: "Node config fetch implemented", description: "Single query to athlete_lab_nodes. Reads all JSONB columns: key_metrics, phase_breakdown, reference_calibrations, llm_prompt_template, llm_system_instructions." },
      { item_id: "preflight_validation", title: "Pre-flight validation implemented", description: "Check clip duration, resolution, and athlete frame size against camera_guidelines auto-reject conditions." },
      { item_id: "cloud_run_post", title: "Cloud Run POST implemented", description: "Send video_url + full node config to Cloud Run. Handle timeout and retry logic." },
      { item_id: "phase_windowing", title: "Phase frame windowing implemented", description: "Divide total frames by proportion_weight percentages. Apply frame_buffer overlap on boundaries." },
      { item_id: "person_locking_implemented", title: "Person locking implemented", description: "When multiple people are detected in a frame, select the person with the largest bounding box area as the target athlete. Lock onto that person ID for all subsequent metric calculations in the clip. Prevents metrics from silently computing on a teammate or defender who enters frame." },
      { item_id: "temporal_smoothing_implemented", title: "Temporal smoothing implemented", description: "Apply a moving average (window=3 frames minimum) to all keypoint coordinate timeseries before any metric calculation. Interpolate gaps where keypoint confidence falls below threshold using linear interpolation across adjacent good frames (max gap 5 frames). Critical for velocity and acceleration metrics — without smoothing, 2-5px jitter produces ~60-150px/second of false velocity signal. See MMPose audit in Architecture tab for full implementation spec." },
      { item_id: "detection_frequency_tuned", title: "Detection frequency tuned for athletic movements", description: "Reduce det_frequency from 7 to 2 for all nodes. The slant route break occurs over 3-5 frames — det_frequency=7 means the critical break phase may receive stale bounding boxes, causing the pose estimator to receive poorly cropped input on the most important frames. For the Break phase specifically, consider det_frequency=1. See MMPose audit in Architecture tab." },
      { item_id: "metric_angle", title: "Metric calculation — Angle", description: "Geometric angle at vertex keypoint from 3 [x,y] coordinates." },
      { item_id: "metric_distance", title: "Metric calculation — Distance", description: "Euclidean pixel distance × pixels_per_yard conversion from reference_calibrations." },
      { item_id: "metric_velocity", title: "Metric calculation — Velocity", description: "Displacement per frame × fps. Temporal window minimum 3." },
      { item_id: "metric_acceleration", title: "Metric calculation — Acceleration", description: "Velocity delta over temporal_window. Minimum 5 frames." },
      { item_id: "metric_frame_delta", title: "Metric calculation — Frame Delta", description: "Frame count between two body position events. Minimum 10 frames." },
      { item_id: "bilateral_autodetect", title: "Bilateral auto-detect implemented", description: "Compare left vs right keypoint confidence scores. Use higher confidence side." },
      { item_id: "confidence_flagging", title: "Confidence flagging implemented", description: "Flag metrics where any keypoint falls below confidence_threshold." },
      { item_id: "error_autodetection", title: "Error auto-detection implemented", description: "Evaluate auto_detection_condition strings against metric results. Pass confirmed errors to Claude as facts." },
      { item_id: "scoring_formula", title: "Scoring formula implemented", description: "Weighted average of metric scores. Apply confidence_handling rule (skip/penalize/flag). Check min_metrics_threshold." },
      { item_id: "claude_api_call", title: "Claude API call implemented", description: "Inject all template variables. Apply llm_system_instructions as system prompt. Enforce llm_max_words and llm_tone." },
      { item_id: "results_write", title: "Results write implemented", description: "INSERT to athlete_lab_results with all fields: aggregate_score, phase_scores, metric_results, feedback, confidence_flags, detected_errors." },
      { item_id: "status_update", title: "Status update implemented", description: "UPDATE athlete_uploads.status through pending → processing → complete/failed." },
    ],
  },
  {
    name: "END-TO-END TESTING",
    items: [
      { item_id: "webhook_fires", title: "Webhook fires on test upload", description: "Manually INSERT a row to athlete_uploads and confirm Edge Function is triggered." },
      { item_id: "edge_receives_payload", title: "Edge Function receives payload", description: "Check Edge Function logs — confirm node_config loaded correctly." },
      { item_id: "cloud_run_returns", title: "Cloud Run returns keypoints", description: "Confirm rtmlib processes test video and returns full keypoint arrays." },
      { item_id: "slant_metrics_correct", title: "Slant Route metrics calculate correctly", description: "Run Break Angle calculation. Confirm result is in degrees and near expected range." },
      { item_id: "claude_feedback_generated", title: "Claude feedback generated", description: "Confirm feedback string is returned, references metric values, and matches configured tone." },
      { item_id: "results_in_table", title: "Results in athlete_lab_results", description: "Confirm row written with aggregate_score, feedback, and all metric_results." },
      { item_id: "realtime_delivers", title: "Supabase Realtime delivers to device", description: "Confirm results broadcast reaches a connected test session within 20 seconds." },
      { item_id: "pipeline_under_20s", title: "Full pipeline under 20 seconds", description: "Measure total time from athlete_uploads INSERT to results visible on device." },
      { item_id: "first_real_analysis", title: "First real athlete analysis", description: "Invite one athlete. Record a Slant Route rep. Upload. Confirm full pipeline fires and produces meaningful feedback." },
    ],
  },
];

const TOTAL_ITEMS = PHASES.reduce((s, p) => s + p.items.length, 0);

interface CheckState {
  completed: boolean;
  completed_at: string | null;
  notes: string;
}

function generatePhaseCopy(phase: Phase, phaseIndex: number, state: Record<string, CheckState>): string {
  const completed = phase.items.filter(i => state[i.item_id]?.completed).length;
  const now = new Date().toLocaleString();
  const lines: string[] = [];
  lines.push(`# AthleteLab Pipeline Setup — Phase ${phaseIndex + 1}: ${phase.name}`);
  lines.push(`# Copied: ${now}`);
  lines.push(`# Progress: ${completed} of ${phase.items.length} complete`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`## ${phase.name}`);
  lines.push("");
  for (const item of phase.items) {
    const s = state[item.item_id];
    const done = s?.completed || false;
    lines.push(`${done ? "✅" : "⬜"} ${item.title}`);
    lines.push(`  Description: ${item.description}`);
    lines.push(`  Status: ${done ? "Complete" : "Incomplete"}`);
    if (s?.notes) {
      lines.push(`  Notes: ${s.notes}`);
    }
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  lines.push("PHASE SUMMARY:");
  lines.push(`Complete: ${completed} of ${phase.items.length}`);
  const remaining = phase.items.filter(i => !state[i.item_id]?.completed).map(i => i.title);
  lines.push(`Remaining: ${remaining.length > 0 ? remaining.join(", ") : "None"}`);
  return lines.join("\n");
}

function generateAllPhasesCopy(state: Record<string, CheckState>): string {
  return PHASES.map((phase, i) => generatePhaseCopy(phase, i, state)).join("\n\n\n");
}

function AutoExpandTextarea({ value, onChange, onBlur, placeholder }: {
  value: string;
  onChange: (val: string) => void;
  onBlur: () => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = Math.max(120, ref.current.scrollHeight) + "px";
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-lg px-3 py-2 text-on-surface text-[11px] font-mono leading-relaxed resize-y focus:outline-none focus:border-primary-container/30 transition-colors"
      style={{ minHeight: 120 }}
    />
  );
}

export function PipelineSetupTab() {
  const [state, setState] = useState<Record<string, CheckState>>({});
  const [loading, setLoading] = useState(true);
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({ 0: true, 1: true, 2: true, 3: true });
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);
  const [copiedPhase, setCopiedPhase] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("pipeline_setup_checklist").select("item_id, completed, completed_at, notes");
    const map: Record<string, CheckState> = {};
    if (data) {
      for (const row of data) {
        map[row.item_id] = { completed: row.completed, completed_at: row.completed_at, notes: row.notes || "" };
      }
    }
    setState(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleItem = async (item_id: string) => {
    const current = state[item_id];
    const newCompleted = !current?.completed;
    const now = new Date().toISOString();
    const newState = { ...state, [item_id]: { completed: newCompleted, completed_at: newCompleted ? now : null, notes: current?.notes || "" } };
    setState(newState);

    const { data: existing } = await supabase.from("pipeline_setup_checklist").select("id").eq("item_id", item_id).maybeSingle();
    if (existing) {
      await supabase.from("pipeline_setup_checklist").update({ completed: newCompleted, completed_at: newCompleted ? now : null, updated_at: now }).eq("item_id", item_id);
    } else {
      await supabase.from("pipeline_setup_checklist").insert({ item_id, completed: newCompleted, completed_at: newCompleted ? now : null, notes: "" });
    }
  };

  const saveNotes = async (item_id: string, notes: string) => {
    const now = new Date().toISOString();
    const current = state[item_id];
    setState({ ...state, [item_id]: { completed: current?.completed || false, completed_at: current?.completed_at || null, notes } });

    const { data: existing } = await supabase.from("pipeline_setup_checklist").select("id").eq("item_id", item_id).maybeSingle();
    if (existing) {
      await supabase.from("pipeline_setup_checklist").update({ notes, updated_at: now }).eq("item_id", item_id);
    } else {
      await supabase.from("pipeline_setup_checklist").insert({ item_id, completed: false, notes });
    }

    setSavedNote(item_id);
    setTimeout(() => setSavedNote(null), 1500);
  };

  const copyPhase = async (phaseIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const text = generatePhaseCopy(PHASES[phaseIndex], phaseIndex, state);
    await navigator.clipboard.writeText(text);
    setCopiedPhase(phaseIndex);
    setTimeout(() => setCopiedPhase(null), 2000);
  };

  const copyAll = async () => {
    const text = generateAllPhasesCopy(state);
    await navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const completedCount = Object.values(state).filter((s) => s.completed).length;
  const pct = Math.round((completedCount / TOTAL_ITEMS) * 100);
  const barColor = completedCount <= 10 ? "#ef4444" : completedCount <= 25 ? "#f59e0b" : "#22c55e";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-on-surface font-extrabold uppercase tracking-tight text-sm">Pipeline Setup</h2>
        <p className="text-on-surface-variant text-xs mt-1 max-w-2xl">
          Step-by-step checklist for deploying the rtmlib pose estimation pipeline from zero to first successful athlete analysis.
        </p>
      </div>

      {/* Overall progress */}
      <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-on-surface font-black uppercase tracking-[0.15em] text-xs">
            Pipeline Readiness: {completedCount} of {TOTAL_ITEMS} steps complete
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={copyAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-colors text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: copiedAll ? "#22c55e" : undefined }}>
                {copiedAll ? "check_circle" : "content_copy"}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest">{copiedAll ? "Copied" : "Copy All Phases"}</span>
            </button>
            <span className="font-black text-sm" style={{ color: barColor }}>{pct}%</span>
          </div>
        </div>
        <div className="w-full h-3 bg-surface-container-lowest rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
        </div>
      </div>

      {/* Phases */}
      {PHASES.map((phase, pi) => {
        const phaseComplete = phase.items.filter((i) => state[i.item_id]?.completed).length;
        const open = expandedPhases[pi] ?? false;
        const phaseBarColor = phaseComplete === phase.items.length ? "#22c55e" : phaseComplete > 0 ? "#f59e0b" : "#ef4444";

        return (
          <div key={pi} className="bg-surface-container rounded-xl border border-outline-variant/10 overflow-hidden">
            {/* Phase header */}
            <button
              onClick={() => setExpandedPhases((p) => ({ ...p, [pi]: !open }))}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface-container-high/50 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }}>
                {open ? "expand_more" : "chevron_right"}
              </span>
              <span className="text-on-surface font-black uppercase tracking-[0.12em] text-[11px]">
                Phase {pi + 1} — {phase.name}
              </span>
              <span className="text-on-surface-variant text-[10px] font-bold">
                {phaseComplete} of {phase.items.length} complete
              </span>
              <div className="flex-1" />
              <span
                className="material-symbols-outlined text-on-surface-variant hover:text-on-surface transition-colors"
                style={{ fontSize: 16, color: copiedPhase === pi ? "#22c55e" : undefined }}
                onClick={(e) => copyPhase(pi, e)}
              >
                {copiedPhase === pi ? "check_circle" : "content_copy"}
              </span>
              <div className="w-24 h-2 bg-surface-container-lowest rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(phaseComplete / phase.items.length) * 100}%`, backgroundColor: phaseBarColor }}
                />
              </div>
            </button>

            {/* Items */}
            {open && (
              <div className="border-t border-outline-variant/10">
                {phase.items.map((item) => {
                  const s = state[item.item_id];
                  const done = s?.completed || false;
                  const notesOpen = expandedNotes === item.item_id;

                  return (
                    <div key={item.item_id} className="border-b border-outline-variant/5 last:border-b-0">
                      <div
                        className="flex items-start gap-3 px-5 py-3 hover:bg-surface-container-high/30 transition-colors cursor-pointer"
                        onClick={() => setExpandedNotes(notesOpen ? null : item.item_id)}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleItem(item.item_id); }}
                          className="mt-0.5 shrink-0 w-5 h-5 rounded flex items-center justify-center border transition-all"
                          style={{
                            backgroundColor: done ? "#22c55e" : "transparent",
                            borderColor: done ? "#22c55e" : "#44484c",
                          }}
                        >
                          {done && (
                            <span className="material-symbols-outlined text-[#00460a]" style={{ fontSize: 16 }}>check</span>
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <span className={`text-xs font-bold ${done ? "text-on-surface-variant line-through" : "text-on-surface"}`}>
                            {item.title}
                          </span>
                          <p className="text-on-surface-variant/60 text-[11px] mt-0.5 leading-relaxed">{item.description}</p>
                          {s?.completed_at && (
                            <p className="text-primary-container/50 text-[9px] mt-1">
                              Completed {new Date(s.completed_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>

                        <span className="material-symbols-outlined text-on-surface-variant/30 mt-1" style={{ fontSize: 14 }}>
                          {notesOpen ? "expand_less" : "notes"}
                        </span>
                      </div>

                      {/* Notes */}
                      {notesOpen && (
                        <div className="px-5 pb-4 ml-8">
                          <p className="text-on-surface-variant font-black uppercase tracking-[0.15em] text-[9px] mb-2">
                            Implementation Notes
                          </p>
                          <AutoExpandTextarea
                            value={s?.notes || ""}
                            onChange={(val) => setState({ ...state, [item.item_id]: { ...s, completed: s?.completed || false, completed_at: s?.completed_at || null, notes: val } })}
                            onBlur={() => {}}
                            placeholder="Add implementation notes, prompts, links, or any context needed for this step..."
                          />
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-on-surface-variant/40 text-[9px] font-mono">
                              {(s?.notes || "").length} characters
                            </span>
                            <button
                              onClick={() => saveNotes(item.item_id, s?.notes || "")}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-colors"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 13, color: savedNote === item.item_id ? "#22c55e" : undefined }}>
                                {savedNote === item.item_id ? "check" : "save"}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: savedNote === item.item_id ? "#22c55e" : undefined }}>
                                {savedNote === item.item_id ? "Saved ✓" : "Save"}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
