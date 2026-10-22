import { useCallback, useEffect, useMemo, useState } from "react";
import { athleteHeightError, HEIGHT_HELP } from "../../../../supabase/functions/_shared/athleteHeight";
import type { TrainingNode } from "../types";
import {
  EMPTY_CLIP_METADATA,
  checkClipSize,
  computeExpectedDepth,
  deleteCalibrationClip,
  listCalibrationClips,
  readVideoFileMetadata,
  setCalibrationClipArchived,
  signCalibrationClip,
  updateCalibrationClip,
  uploadCalibrationClip,
  yardMetricNames,
  type CalibrationClip,
  type CalibrationClipMetadata,
} from "@/services/calibrationLibrary";
import { useCalibrationLibraryStore } from "@/store/calibrationLibraryStore";
import { ConfirmModal } from "./ConfirmModal";

interface VideoLibraryPanelProps {
  nodes: TrainingNode[];
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
}

type FormState = { mode: "create" } | { mode: "edit"; clip: CalibrationClip } | null;

const inputCls = "h-10 w-full rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-3 text-xs text-on-surface focus:outline-none focus:border-primary-container/30";
const labelCls = "text-[10px] font-medium uppercase tracking-widest text-on-surface-variant";
const btnCls = "flex h-9 items-center gap-1.5 rounded-full px-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed";

const SOURCE_LABEL: Record<string, string> = { dynamic: "Dynamic", height_based: "Height Based", body_based: "Body Based", static: "Static", unknown: "Unknown" };

export function VideoLibraryPanel({ nodes, onClose, onSelectNode }: VideoLibraryPanelProps) {
  const [clips, setClips] = useState<CalibrationClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<FormState>(null);
  const [preview, setPreview] = useState<{ title: string; url: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CalibrationClip | null>(null);
  const [blockedDelete, setBlockedDelete] = useState<CalibrationClip | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const setPending = useCalibrationLibraryStore((s) => s.setPending);
  const editClip = useCalibrationLibraryStore((s) => s.editClip);
  const clearClipEditor = useCalibrationLibraryStore((s) => s.clearClipEditor);

  useEffect(() => {
    if (editClip) setForm({ mode: "edit", clip: editClip });
  }, [editClip]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setClips(await listCalibrationClips(showArchived));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load library");
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePreview = async (clip: CalibrationClip) => {
    setBusyId(clip.id);
    try {
      setPreview({ title: clip.title, url: await signCalibrationClip(clip.id, "preview") });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleUse = async (clip: CalibrationClip) => {
    if (!clip.node_id) return;
    setBusyId(clip.id);
    try {
      const signedUrl = await signCalibrationClip(clip.id, "test");
      setPending({ clip, signedUrl });
      onSelectNode(clip.node_id);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not open clip");
    } finally {
      setBusyId(null);
    }
  };

  const requestDelete = (clip: CalibrationClip) => {
    if (clip.run_count > 0) setBlockedDelete(clip);
    else setPendingDelete(clip);
  };

  const doDelete = async (clip: CalibrationClip) => {
    setPendingDelete(null);
    setBusyId(clip.id);
    try {
      await deleteCalibrationClip(clip.id);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const doArchive = async (clip: CalibrationClip, archived: boolean) => {
    setBlockedDelete(null);
    setBusyId(clip.id);
    try {
      await setCalibrationClipArchived(clip.id, archived);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Archive failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-surface-container-lowest/70 backdrop-blur-sm">
      <div className="relative flex h-full w-full max-w-5xl flex-col bg-surface shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(39,45,50,0.4)_0%,_rgba(11,15,18,0)_70%)]" />
        <div className="relative flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-6">
          <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 22 }}>video_library</span>
          <span className="text-lg font-black uppercase tracking-tighter text-on-surface">Video Library</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant">Calibration clips</span>
          <div className="flex-1" />
          <label className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived
          </label>
          <button onClick={() => setForm({ mode: "create" })} className={`${btnCls} kinetic-gradient text-surface-container-lowest`}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>upload</span>Upload clip
          </button>
          <button onClick={onClose} aria-label="Close library" className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        <div className="relative flex-1 space-y-4 overflow-y-auto p-6">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-error-dim/30 bg-surface-container p-3 text-xs text-on-surface">
              <span className="material-symbols-outlined text-error-dim" style={{ fontSize: 16 }}>error</span>
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="text-on-surface-variant">Dismiss</button>
            </div>
          )}

          {loading ? (
            [1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-container" />)
          ) : clips.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <span className="material-symbols-outlined mb-4 text-on-surface-variant/30" style={{ fontSize: 64 }}>video_library</span>
              <p className="text-sm font-extrabold uppercase text-on-surface">No calibration clips yet</p>
              <p className="mt-2 max-w-sm text-xs text-on-surface-variant">Upload a clip once with its ground truth, then run it against any node without re-uploading.</p>
              <button onClick={() => setForm({ mode: "create" })} className={`${btnCls} kinetic-gradient mt-6 text-surface-container-lowest`}>Upload first clip</button>
            </div>
          ) : (
            clips.map((clip) => {
              const depth = clip.expected_route_depth_yards ?? computeExpectedDepth(clip.start_yard_line, clip.break_yard_line);
              const busy = busyId === clip.id;
              return (
                <div key={clip.id} className={`rounded-xl border border-white/5 bg-surface-container-high p-4 ${clip.archived ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-extrabold uppercase text-on-surface">{clip.title}</span>
                        {clip.archived && <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Archived</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-on-surface-variant">
                        {clip.node ? (
                          <>
                            <span className="text-on-surface">{clip.node.name}{clip.node.position ? ` (${clip.node.position})` : ""}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${clip.node.status === "live" ? "bg-primary-container/15 text-primary" : "bg-surface-container-highest text-on-surface-variant"}`}>
                              {clip.node.status === "live" ? "Live" : "Draft"}
                            </span>
                          </>
                        ) : <span className="text-error-dim">No node assigned</span>}
                        <span>· Depth {depth !== null ? `${depth} yd` : "—"}</span>
                        <span>· Expected {SOURCE_LABEL[clip.expected_calibration_source]}</span>
                        <span>· {clip.run_count} run{clip.run_count === 1 ? "" : "s"}</span>
                        {clip.resolution && <span>· {clip.resolution}</span>}
                        {clip.duration_seconds !== null && <span>· {clip.duration_seconds}s</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button disabled={busy || clip.archived || !clip.node_id} onClick={() => void handleUse(clip)} className={`${btnCls} kinetic-gradient text-surface-container-lowest`} title={clip.archived ? "Archived clips can't be used in new tests" : undefined}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>play_arrow</span>Use in test
                      </button>
                      <button disabled={busy} onClick={() => void handlePreview(clip)} className={`${btnCls} bg-surface-container-highest text-on-surface`}>Preview</button>
                      <button disabled={busy} onClick={() => setForm({ mode: "edit", clip })} className={`${btnCls} bg-surface-container-highest text-on-surface`}>Edit</button>
                      {clip.archived ? (
                        <button disabled={busy} onClick={() => void doArchive(clip, false)} className={`${btnCls} bg-surface-container-highest text-on-surface`}>Unarchive</button>
                      ) : (
                        <button disabled={busy} onClick={() => requestDelete(clip)} className={`${btnCls} bg-surface-container-highest text-error-dim`}>Delete</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-surface-container-lowest/80 p-6" onClick={() => setPreview(null)}>
          <div className="glass-card w-full max-w-3xl rounded-xl border border-white/10 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-extrabold uppercase text-on-surface">{preview.title}</span>
              <button onClick={() => setPreview(null)} aria-label="Close preview" className="text-on-surface-variant"><span className="material-symbols-outlined">close</span></button>
            </div>
            <video src={preview.url} controls className="w-full rounded-xl bg-surface-container-lowest" />
          </div>
        </div>
      )}

      {form && (
        <ClipForm
          state={form}
          nodes={nodes}
          onCancel={() => { setForm(null); clearClipEditor(); }}
          onSaved={() => {
            setForm(null);
            clearClipEditor();
            void load();
          }}
        />
      )}

      <ConfirmModal
        open={pendingDelete !== null}
        title="Delete clip?"
        body={pendingDelete ? `"${pendingDelete.title}" has no test runs. Deleting removes the library entry and the stored video file permanently.` : ""}
        confirmLabel="Delete clip"
        onConfirm={() => { if (pendingDelete) void doDelete(pendingDelete); }}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmModal
        open={blockedDelete !== null}
        title="Clip has test runs"
        body={blockedDelete ? `"${blockedDelete.title}" was used in ${blockedDelete.run_count} test run(s), so it can't be deleted. Archive it instead — it will be hidden by default and can't be used in new tests, but past runs keep their link to it.` : ""}
        confirmLabel="Archive clip"
        onConfirm={() => { if (blockedDelete) void doArchive(blockedDelete, true); }}
        onCancel={() => setBlockedDelete(null)}
      />
    </div>
  );
}

function toMetadata(clip: CalibrationClip): CalibrationClipMetadata {
  const keys = Object.keys(EMPTY_CLIP_METADATA) as Array<keyof CalibrationClipMetadata>;
  return keys.reduce((acc, key) => ({ ...acc, [key]: clip[key] }), { ...EMPTY_CLIP_METADATA });
}

function numOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

interface ClipFormProps {
  state: NonNullable<FormState>;
  nodes: TrainingNode[];
  onCancel: () => void;
  onSaved: () => void;
}

function ClipForm({ state, nodes, onCancel, onSaved }: ClipFormProps) {
  const [meta, setMeta] = useState<CalibrationClipMetadata>(state.mode === "edit" ? toMetadata(state.clip) : EMPTY_CLIP_METADATA);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CalibrationClipMetadata>(key: K, value: CalibrationClipMetadata[K]) => setMeta((m) => ({ ...m, [key]: value }));
  const node = useMemo(() => nodes.find((n) => n.id === meta.node_id) ?? null, [nodes, meta.node_id]);
  const yardMetrics = useMemo(() => yardMetricNames(node), [node]);
  const depth = computeExpectedDepth(meta.start_yard_line, meta.break_yard_line);

  const onFile = async (f: File | null) => {
    setError(null);
    if (!f) return;
    const sizeError = checkClipSize(f.size);
    if (sizeError) {
      setFile(null);
      setError(sizeError);
      return;
    }
    setFile(f);
    const info = await readVideoFileMetadata(f);
    setMeta((m) => ({ ...m, title: m.title || f.name.replace(/\.[^.]+$/, ""), duration_seconds: info.duration, resolution: info.resolution }));
  };

  const save = async () => {
    setError(null);
    if (!meta.title.trim()) return setError("Title is required.");
    if (!meta.node_id) return setError("Choose a node.");
    if (state.mode === "create" && !file) return setError("Choose a video file.");
    const heightError = athleteHeightError(meta.athlete_height, meta.athlete_height_unit);
    if (heightError) return setError(heightError);
    const payload = { ...meta, depth_metric_key: meta.depth_metric_key && yardMetrics.includes(meta.depth_metric_key) ? meta.depth_metric_key : null };
    setSaving(true);
    try {
      if (state.mode === "create" && file) await uploadCalibrationClip(file, payload);
      if (state.mode === "edit") await updateCalibrationClip(state.clip.id, payload);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const select = <K extends keyof CalibrationClipMetadata>(key: K, label: string, options: Array<[string, string]>) => (
    <label className="space-y-1">
      <span className={labelCls}>{label}</span>
      <select value={String(meta[key] ?? "")} onChange={(e) => set(key, e.target.value as CalibrationClipMetadata[K])} className={inputCls}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
  const numberField = (key: "start_yard_line" | "break_yard_line" | "athlete_height" | "athlete_wingspan" | "fps", label: string) => (
    <label className="space-y-1">
      <span className={labelCls}>{label}</span>
      <input type="number" step="any" value={meta[key] ?? ""} onChange={(e) => set(key, numOrNull(e.target.value))} className={inputCls} />
    </label>
  );
  const textField = (key: "yard_line_notes" | "hand_timed_splits" | "camera_distance_notes" | "notes" | "created_by", label: string, area = false) => (
    <label className="space-y-1 sm:col-span-2">
      <span className={labelCls}>{label}</span>
      {area ? (
        <textarea value={meta[key] ?? ""} onChange={(e) => set(key, e.target.value)} rows={2} className="w-full rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-3 text-xs text-on-surface focus:outline-none" />
      ) : (
        <input value={meta[key] ?? ""} onChange={(e) => set(key, e.target.value)} className={inputCls} />
      )}
    </label>
  );
  const section = (title: string) => <h4 className="pt-2 text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant sm:col-span-2">{title}</h4>;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-surface-container-lowest/80 p-6">
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-xl border border-white/10 bg-surface-container shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm font-black uppercase tracking-tight text-on-surface">{state.mode === "create" ? "Upload calibration clip" : "Edit clip"}</span>
          <button onClick={onCancel} aria-label="Close form" className="text-on-surface-variant"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto px-5 pb-5 sm:grid-cols-2">
          {state.mode === "create" && (
            <label className="space-y-1 sm:col-span-2">
              <span className={labelCls}>Video file (max 500 MB)</span>
              <input type="file" accept="video/*" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} className="block w-full text-xs text-on-surface-variant" />
              {file && <span className="text-[11px] text-on-surface-variant">{(file.size / 1024 / 1024).toFixed(1)} MB · {meta.resolution ?? "?"} · {meta.duration_seconds ?? "?"}s</span>}
            </label>
          )}
          {section("Clip")}
          <label className="space-y-1 sm:col-span-2">
            <span className={labelCls}>Title</span>
            <input value={meta.title} onChange={(e) => set("title", e.target.value)} className={inputCls} />
          </label>
          <label className="space-y-1">
            <span className={labelCls}>Node</span>
            <select value={meta.node_id ?? ""} onChange={(e) => setMeta((m) => ({ ...m, node_id: e.target.value || null, depth_metric_key: null }))} className={inputCls}>
              <option value="">Choose node…</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.name} ({n.position ?? "—"}){n.status === "live" ? " · LIVE" : ""}</option>)}
            </select>
          </label>
          {numberField("fps", "FPS")}
          {textField("created_by", "Uploaded by")}

          {section("Test context")}
          {select("camera_angle", "Camera angle", [["sideline", "Sideline"], ["behind_qb", "Behind QB"], ["endzone", "Endzone"], ["other", "Other"]])}
          {select("people_in_video", "People in video", [["solo", "Just me"], ["with_defender", "Me + defender"], ["multiple", "Multiple"]])}
          {select("route_direction", "Route direction", [["left", "Breaks left"], ["right", "Breaks right"], ["both", "Both"], ["straight", "Straight / no break"]])}
          {select("catch_status", "Catch", [["yes", "Yes"], ["no", "No"], ["partial", "Partial"]])}
          {select("athlete_level", "Athlete level", [["youth", "Youth"], ["high_school", "High school"], ["college", "College"], ["professional", "Professional"]])}
          <div />
          <div className="space-y-1">
            {numberField("athlete_height", "Athlete height *")}
            <p className="text-[10px] text-on-surface-variant/60">{HEIGHT_HELP}</p>
          </div>
          {select("athlete_height_unit", "Height unit", [["inches", "Inches"], ["cm", "cm"]])}
          {numberField("athlete_wingspan", "Athlete wingspan")}
          {select("athlete_wingspan_unit", "Wingspan unit", [["inches", "Inches"], ["cm", "cm"]])}

          {section("Ground truth")}
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" checked={meta.yard_lines_visible} onChange={(e) => set("yard_lines_visible", e.target.checked)} />
            <span className={labelCls}>Yard lines visible</span>
          </label>
          {textField("yard_line_notes", "Yard line notes")}
          {numberField("start_yard_line", "Start yard line")}
          {numberField("break_yard_line", "Break yard line")}
          <div className="rounded-xl bg-surface-container-lowest p-3 sm:col-span-2">
            <span className={labelCls}>Expected route depth</span>
            <div className="text-lg font-black text-on-surface">{depth !== null ? `${depth} yd` : "—"}</div>
          </div>
          <label className="space-y-1">
            <span className={labelCls}>Depth metric to compare</span>
            <select value={meta.depth_metric_key ?? ""} onChange={(e) => set("depth_metric_key", e.target.value || null)} className={inputCls} disabled={!node}>
              <option value="">{node ? (yardMetrics.length ? "None" : "Node has no yard metrics") : "Choose a node first"}</option>
              {yardMetrics.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          {select("expected_calibration_source", "Expected calibration source", [["unknown", "Unknown"], ["dynamic", "Dynamic"], ["height_based", "Height based"], ["body_based", "Body based"], ["static", "Static"]])}
          {textField("hand_timed_splits", "Hand-timed splits (optional)")}

          {section("Camera")}
          {select("camera_setup", "Camera setup", [["tripod", "Tripod"], ["handheld", "Handheld"]])}
          <div />
          {textField("camera_distance_notes", "Camera distance notes")}
          {textField("notes", "Notes", true)}
        </div>
        <div className="flex items-center gap-3 px-5 py-4">
          {error && <span className="flex-1 text-xs text-error-dim">{error}</span>}
          <div className="flex-1" />
          <button onClick={onCancel} className={`${btnCls} bg-surface-container-highest text-on-surface`}>Cancel</button>
          <button disabled={saving} onClick={() => void save()} className={`${btnCls} kinetic-gradient text-surface-container-lowest`}>
            {saving ? (state.mode === "create" ? "Uploading…" : "Saving…") : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
