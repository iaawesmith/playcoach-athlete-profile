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
    name: "CLOUD RUN POSE SERVICE (MediaPipe — Phase 1)",
    items: [
      // PREREQUISITES (Google Cloud Setup)
      { item_id: "gcp_account_billing", title: "Google Cloud account and billing enabled", description: "Create Google Cloud account (or use existing). Enable billing on the account with a credit card. Set a monthly budget alert at $50 to avoid surprise charges during development. Required before any deployment work begins." },
      { item_id: "gcp_project_created", title: "Google Cloud project created", description: "Create a new Google Cloud project named 'playcoach-pipeline' (or similar). Note the project ID — required for all gcloud commands. Consider using region us-central1 as the default location for resources." },
      { item_id: "gcp_apis_enabled", title: "Required Google Cloud APIs enabled", description: "Enable three APIs from the GCP Console or via gcloud command: Cloud Run API, Artifact Registry API, and Cloud Build API. Each is a single click or a single command. Required before attempting any deployment." },
      { item_id: "gcloud_cli_authenticated", title: "gcloud CLI installed and authenticated", description: "Install Google Cloud SDK on local machine. Run 'gcloud auth login' to authenticate. Run 'gcloud config set project [project-id]' to lock in the project. Also install Docker Desktop if not already installed — required for building the container image locally." },
      { item_id: "artifact_registry_created", title: "Artifact Registry repository created", description: "Phase 1 placeholder — create a Docker repository in Artifact Registry to store the MediaPipe pose service container image. Region us-central1 recommended." },

      // CORE BUILD (Application Code)
      { item_id: "dockerfile_created", title: "Dockerfile created", description: "Phase 1 placeholder — container with MediaPipe Tasks (vision/pose), numpy, opencv-python-headless, fastapi, uvicorn, yt-dlp, ffmpeg. Based on python:3.11-slim. Install system dependencies for yt-dlp and OpenCV (libgl1, libglib2.0-0)." },
      { item_id: "fastapi_implemented", title: "FastAPI service implemented", description: "Phase 1 placeholder — POST /analyze endpoint accepts video_url, start_seconds, end_seconds, and pose_engine config in JSON body. Downloads the clip via yt-dlp, runs MediaPipe Pose Landmarker, returns landmarks (33 per person), scores, frame_count, and fps in JSON response." },
      { item_id: "dynamic_calibration_implemented", title: "Dynamic field line calibration implemented (basic)", description: "Ship the basic version first, iterate after real athlete data. Use cv2.Canny edge detection on first 10 frames → HoughLinesP to detect horizontal line segments → filter for lines spanning frame width → measure pixel distance between consecutive detected lines → divide by 5 (yard spacing) → return pixels_per_yard. Fall back to node's static reference_calibrations value if detection fails. Expect 30-40% detection failure rate in first iteration — tune thresholds after first 20 analyses." },

      // DEPLOYMENT (Push to Production)
      { item_id: "container_pushed", title: "Container built and pushed to Artifact Registry", description: "Phase 1 placeholder — Docker build local image with version tag and push to Artifact Registry. First build takes 10-15 minutes due to opencv and MediaPipe model dependencies. Subsequent builds benefit from layer caching." },
      { item_id: "cloud_run_deployed", title: "Cloud Run service deployed (CPU)", description: "Phase 1 placeholder — start with CPU deployment to validate pipeline end-to-end before optimizing for speed. Recommended: --memory=4Gi --cpu=2 --timeout=300 --region=us-central1. Note the service URL from deploy output — required for the integration step." },

      // VERIFICATION (Test Before Wiring)
      { item_id: "rtmw_model_confirmed", title: "MediaPipe model confirmed on first request", description: "First request to Cloud Run triggers download / load of the MediaPipe Pose Landmarker model. Confirm via Cloud Run logs that the model loads without error. Expected load time: 5-15 seconds on cold start. Subsequent requests use the warm model." },
      { item_id: "wholebody_tested", title: "Pose endpoint tested with sample frame", description: "Test with a known good video frame. Confirm response includes landmarks[person][index] returning [x, y, z, visibility] for all 33 indices (0-32). Spot check specific landmarks: left hip (23), right hip (24), left heel (29), nose (0), left index (19)." },
      { item_id: "cloud_run_isolation_test", title: "Cloud Run endpoint tested in isolation", description: "Before wiring to Edge Function, test Cloud Run independently via curl with the Slant Route reference video. Confirms service is functional in isolation. Prevents scenario where a bad service breaks the live pipeline with no easy rollback. Expected response includes landmarks, scores, frame_count, and fps." },

      // INTEGRATION (Go Live)
      { item_id: "cloud_run_url_added", title: "Cloud Run URL added to Edge Function config", description: "Update the pose service URL secret in Supabase Edge Function secrets. Replace any placeholder value with the real Cloud Run service URL. This is the moment the pipeline goes live end-to-end." },
      { item_id: "e2e_real_upload_test", title: "End-to-end pipeline test with real upload", description: "Run the same test INSERT as Phase 1 verification. Expect status to reach 'complete' (not 'failed') with: pose engine returning landmarks, metrics calculated, Claude feedback generated, and athlete_lab_results row written. If any step fails, debug individually. This test is the official signal that the full pipeline is operational." },
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
      { item_id: "temporal_smoothing_implemented", title: "Temporal smoothing implemented", description: "Apply a moving average (window=3 frames minimum) to all keypoint coordinate timeseries before any metric calculation. Interpolate gaps where keypoint confidence falls below threshold using linear interpolation across adjacent good frames (max gap 5 frames). Critical for velocity and acceleration metrics — without smoothing, 2-5px jitter produces ~60-150px/second of false velocity signal." },
      { item_id: "detection_frequency_tuned", title: "Detection frequency tuned for athletic movements", description: "Reduce det_frequency from 7 to 2 for all nodes. The slant route break occurs over 3-5 frames — det_frequency=7 means the critical break phase may receive stale bounding boxes, causing the pose estimator to receive poorly cropped input on the most important frames. For the Break phase specifically, consider det_frequency=1." },
      { item_id: "metric_angle", title: "Metric calculation — Angle", description: "Geometric angle at vertex keypoint from 3 [x,y] coordinates." },
      { item_id: "metric_distance", title: "Metric calculation — Distance", description: "Euclidean pixel distance × pixels_per_yard conversion from reference_calibrations." },
      { item_id: "metric_velocity", title: "Metric calculation — Velocity", description: "Displacement per frame × fps. Temporal window minimum 3." },
      { item_id: "metric_acceleration", title: "Metric calculation — Acceleration", description: "Velocity delta over temporal_window. Minimum 5 frames." },
      { item_id: "metric_frame_delta", title: "Metric calculation — Frame Delta", description: "Frame count between two body position events. Minimum 10 frames." },
      { item_id: "bilateral_autodetect", title: "Bilateral auto-detect implemented", description: "Compare left vs right keypoint confidence scores. Use higher confidence side." },
      { item_id: "confidence_flagging", title: "Confidence flagging implemented", description: "Flag metrics where any keypoint falls below confidence_threshold." },
      { item_id: "error_autodetection", title: "Error auto-detection implemented", description: "Evaluate auto_detection_condition strings against metric results. Pass confirmed errors to Claude as facts." },
      { item_id: "scoring_formula", title: "Scoring formula implemented", description: "Weighted average of metric scores. Apply confidence_handling rule (skip/penalize/flag). Check min_metrics_threshold." },
      { item_id: "claude_api_call", title: "Claude API call implemented", description: "Inject all template variables. Apply llm_system_instructions as system prompt. Enforce llm_max_words." },
      { item_id: "results_write", title: "Results write implemented", description: "INSERT to athlete_lab_results with all fields: aggregate_score, phase_scores, metric_results, feedback, confidence_flags, detected_errors." },
      { item_id: "status_update", title: "Status update implemented", description: "UPDATE athlete_uploads.status through pending → processing → complete/failed." },
      { item_id: "analysis_context_handling_implemented", title: "Analysis context handling implemented", description: "Edge Function reads analysis_context from the webhook payload and applies each field: camera_angle → selects matching reference_calibrations card for pixel-to-yard conversion. people_in_video → selects det_frequency_solo, det_frequency_defender, or det_frequency_multiple from node config. route_direction → overrides bilateral_override=auto with force_left or force_right on all metrics. catch_included → excludes metrics where requires_catch=true from calculation and scoring. athlete_level + focus_area → injected as {{athlete_level}} and {{focus_area}} template variables in Claude API call. Falls back gracefully if analysis_context is absent from payload." },
      { item_id: "catch_exclusion_renormalize_implemented", title: "Catch exclusion and renormalize implemented", description: "When catch_included=false in analysis_context, metrics where requires_catch=true are excluded from calculation. If scoring_renormalize_on_skip=true, remaining metric weights are scaled proportionally so aggregate score totals out of 100. If false, aggregate is capped at total weight of included metrics. Excluded metrics listed in {{skipped_metrics}} variable passed to Claude API." },
    ],
  },
  {
    name: "END-TO-END TESTING",
    items: [
      { item_id: "webhook_fires", title: "Webhook fires on test upload", description: "Manually INSERT a row to athlete_uploads and confirm Edge Function is triggered." },
      { item_id: "edge_receives_payload", title: "Edge Function receives payload", description: "Check Edge Function logs — confirm node_config loaded correctly." },
      { item_id: "cloud_run_returns", title: "Cloud Run returns keypoints", description: "Confirm the pose engine processes test video and returns full keypoint arrays." },
      { item_id: "slant_metrics_correct", title: "Slant Route metrics calculate correctly", description: "Run Plant Leg Extension calculation. Confirm result is in degrees and near expected range." },
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
          Step-by-step checklist for deploying the MediaPipe Pose estimation pipeline from zero to first successful athlete analysis.
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
