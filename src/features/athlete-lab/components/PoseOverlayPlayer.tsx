import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchNode, fetchRunDiagnosticData } from "@/services/athleteLab";
import { signCalibrationClip, signUploadVideo } from "@/services/calibrationLibrary";
import type { KeyMetric, TrainingNode } from "../types";
import {
  POSE_CONNECTIONS,
  activePhases,
  confidenceLevel,
  followWindow,
  frameFromMediaTime,
  frameSource,
  frameSourceLabel,
  jointAngle,
  median,
  mediaTimeForFrame,
  parseOverlayData,
  phaseLabel,
  smoothOverlayKeypoints,
  smoothedHipPath,
  toDisplay,
  weakerLevel,
  type ConfidenceLevel,
  type OverlayData,
  type Pt,
  type Rect,
} from "../utils/poseOverlay";

// Canvas drawing colors (data visualisation, not UI surfaces).
const LEVEL_COLOR: Record<ConfidenceLevel, string> = { reliable: "#3bfe4f", marginal: "#facc15", unreliable: "#ef4444" };
const METRIC_COLOR = "#22d3ee";
const TRAIL_COLOR = "#f59e0b";
const PHASE_COLORS = ["#f59e0b", "#60a5fa", "#c084fc", "#facc15", "#86efac", "#f472b6", "#2dd4bf"];
const SPEEDS = [0.25, 0.5, 1] as const;

type VideoFrameCb = (now: number, meta: { mediaTime: number }) => void;
type RvfcVideo = HTMLVideoElement & { requestVideoFrameCallback?: (cb: VideoFrameCb) => number; cancelVideoFrameCallback?: (id: number) => void };

interface Props { uploadId: string; node: TrainingNode }
interface SectionProps { uploadId: string; nodeId: string | null; node?: TrainingNode }

export function PoseOverlaySection({ uploadId, nodeId, node }: SectionProps) {
  const [open, setOpen] = useState(false);
  const [loadedNode, setLoadedNode] = useState<TrainingNode | null>(node ?? null);
  useEffect(() => {
    if (!open || loadedNode || !nodeId) return;
    let cancelled = false;
    fetchNode(nodeId).then((n) => { if (!cancelled) setLoadedNode(n); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [open, loadedNode, nodeId]);
  return (
    <div className="rounded-xl border border-white/5 bg-surface-container p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant">Admin</div>
          <div className="text-sm font-extrabold uppercase text-on-surface">Pose overlay</div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full bg-surface-container-high px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-on-surface transition-all duration-150 active:scale-95"
        >
          <span className="material-symbols-outlined text-base">{open ? "expand_less" : "play_circle"}</span>
          {open ? "Hide" : "Open player"}
        </button>
      </div>
      {open && (loadedNode
        ? <PoseOverlayPlayer uploadId={uploadId} node={loadedNode} />
        : <div className="mt-4 aspect-video w-full animate-pulse rounded-xl bg-surface-container-high" />)}
    </div>
  );
}

export function PoseOverlayPlayer({ uploadId, node }: Props) {
  const nodeMetrics: KeyMetric[] = useMemo(() => node.key_metrics ?? [], [node.key_metrics]);
  const [data, setData] = useState<OverlayData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [errorText, setErrorText] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [clipId, setClipId] = useState<string | null>(null);
  const [startSeconds, setStartSeconds] = useState(0);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [smoothed, setSmoothed] = useState(true);
  const [metricSel, setMetricSel] = useState<string>("all");
  const [trail, setTrail] = useState(true);
  const [follow, setFollow] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [drawTick, setDrawTick] = useState(0);

  const videoRef = useRef<RvfcVideo | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const firstTsRef = useRef<number | null>(null);
  const refreshedRef = useRef(false);
  const resumeFrameRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  frameRef.current = frame;

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetchRunDiagnosticData(uploadId, node.id)
      .then((d) => {
        if (cancelled) return;
        const parsed = parseOverlayData(d.result, nodeMetrics);
        const cid = d.upload.analysis_context.calibration_clip_id;
        setClipId(typeof cid === "string" && cid ? cid : null);
        setStartSeconds(d.upload.start_seconds ?? 0);
        setVideoUrl(d.upload.video_url);
        if (!parsed) { setState("empty"); return; }
        setData(parsed);
        const h = median(parsed.perFrame.map((p) => p.athleteHeightPx).filter((v): v is number => v !== null));
        setFollow(h !== null ? h / parsed.height < 0.2 : false);
        setState("ready");
      })
      .catch((e: unknown) => { if (!cancelled) { setErrorText(e instanceof Error ? e.message : "Failed to load run."); setState("error"); } });
    return () => { cancelled = true; };
  }, [uploadId, node.id, nodeMetrics]);

  const smoothedKps = useMemo(() => (data ? smoothOverlayKeypoints(data, nodeMetrics) : []), [data, nodeMetrics]);
  const hipPath = useMemo(() => (data ? smoothedHipPath(data.perFrame) : []), [data]);
  const lastFrame = data ? data.frameCount - 1 : 0;

  // Frame-accurate sync from the decoded frame's media time, relative to the clip's first-frame timestamp.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !data || !videoReady) return;
    if (typeof video.requestVideoFrameCallback === "function") {
      let id = 0;
      const cb: VideoFrameCb = (_now, meta) => {
        if (firstTsRef.current === null) firstTsRef.current = meta.mediaTime;
        setFrame(frameFromMediaTime(meta.mediaTime, firstTsRef.current, data.fps, startSeconds, data.frameCount));
        id = video.requestVideoFrameCallback?.(cb) ?? 0;
      };
      id = video.requestVideoFrameCallback(cb);
      return () => video.cancelVideoFrameCallback?.(id);
    }
    let raf = 0;
    const tick = () => {
      setFrame(frameFromMediaTime(video.currentTime, firstTsRef.current ?? 0, data.fps, startSeconds, data.frameCount));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [data, videoReady, startSeconds]);

  const seek = useCallback((f: number) => {
    const video = videoRef.current;
    if (!video || !data) return;
    const target = Math.max(0, Math.min(data.frameCount - 1, f));
    video.currentTime = mediaTimeForFrame(target, firstTsRef.current ?? 0, data.fps, startSeconds);
    setFrame(target);
  }, [data, startSeconds]);

  const step = useCallback((delta: number) => {
    videoRef.current?.pause();
    seek(frameRef.current + delta);
  }, [seek]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName)) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = speed; }, [speed, videoReady]);

  const handleLoaded = () => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setVideoReady(true);
    const resume = resumeFrameRef.current;
    resumeFrameRef.current = null;
    if (resume !== null && data) {
      video.currentTime = mediaTimeForFrame(resume, firstTsRef.current ?? 0, data.fps, startSeconds);
      if (playing) void video.play();
    } else if (firstTsRef.current === null) {
      // Decode the first frame so its timestamp anchors the frame index.
      video.currentTime = 0;
    }
  };

  // Signed-link refresh: on a playback error, request one fresh link and resume at the current frame.
  const handleError = async () => {
    if (refreshedRef.current) { setErrorText("The clip couldn't be played, even with a fresh link."); return; }
    refreshedRef.current = true;
    resumeFrameRef.current = frameRef.current;
    try {
      const url = clipId ? await signCalibrationClip(clipId, "preview") : await signUploadVideo(uploadId);
      setVideoReady(false);
      setVideoUrl(url);
    } catch (e: unknown) {
      setErrorText(e instanceof Error ? e.message : "Couldn't refresh the clip link.");
    }
  };

  const view: Rect | null = useMemo(() => {
    if (!data) return null;
    if (!follow) return { x: 0, y: 0, w: data.width, h: data.height };
    const center = hipPath[frame] ?? hipPath.find((p) => p !== null) ?? [data.width / 2, data.height / 2];
    return followWindow(center, data.width, data.height);
  }, [data, follow, hipPath, frame]);

  const highlighted = useMemo(
    () => (data ? data.metrics.filter((m) => (metricSel === "all" || m.name === metricSel) && m.frames.includes(frame)) : []),
    [data, metricSel, frame],
  );

  const kpsForFrame: Pt[] | null = data ? (smoothed ? smoothedKps[frame] : data.keypoints[frame]) ?? null : null;
  const source = data ? frameSource(frame, data) : "main";
  const noDetection = source === "missed" || source === "rejected" || !kpsForFrame;

  const angleLabels = useMemo(() => {
    if (!kpsForFrame) return [] as Array<{ name: string; at: Pt; deg: number }>;
    return highlighted
      .filter((m) => m.calculationType === "angle" && m.indices.length === 3)
      .map((m) => ({ name: m.name, at: kpsForFrame[m.indices[1]], deg: jointAngle(kpsForFrame[m.indices[0]], kpsForFrame[m.indices[1]], kpsForFrame[m.indices[2]]) }));
  }, [highlighted, kpsForFrame]);

  // Draw video frame + overlay.
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !data || !view) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cw = Math.round(rect.width * dpr);
    const ch = Math.round(rect.height * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cw, ch);
    const vw = video?.videoWidth || data.width;
    const vh = video?.videoHeight || data.height;
    const rx = vw / data.width;
    const ry = vh / data.height;
    if (video && video.readyState >= 2) ctx.drawImage(video, view.x * rx, view.y * ry, view.w * rx, view.h * ry, 0, 0, cw, ch);
    const D = (p: Pt) => toDisplay(p, view, cw, ch);
    const lw = Math.max(2, cw / 500);

    if (trail) {
      ctx.strokeStyle = TRAIL_COLOR;
      ctx.lineWidth = lw;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= frame; i += 1) {
        const h = data.perFrame[i]?.hip;
        if (!h) continue;
        const [x, y] = D(h);
        if (started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; }
      }
      ctx.stroke();
    }

    if (!noDetection && kpsForFrame) {
      const scores = data.scores?.[frame] ?? null;
      const visible = (i: number) => {
        const p = kpsForFrame[i];
        if (!p || (p[0] === 0 && p[1] === 0)) return false;
        return !(scores && scores[i] === 0);
      };
      const level = (i: number): ConfidenceLevel => (scores ? confidenceLevel(scores[i] ?? 0) : data.landmarkStatus.get(i) ?? "reliable");
      for (const [a, b] of POSE_CONNECTIONS) {
        if (!visible(a) || !visible(b)) continue;
        ctx.strokeStyle = LEVEL_COLOR[weakerLevel(level(a), level(b))];
        ctx.lineWidth = lw;
        const pa = D(kpsForFrame[a]);
        const pb = D(kpsForFrame[b]);
        ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
      }
      for (const m of highlighted) {
        ctx.strokeStyle = METRIC_COLOR;
        ctx.lineWidth = lw * 2.5;
        for (let k = 0; k + 1 < m.indices.length; k += 1) {
          const a = m.indices[k], b = m.indices[k + 1];
          if (!visible(a) || !visible(b)) continue;
          const pa = D(kpsForFrame[a]); const pb = D(kpsForFrame[b]);
          ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
        }
      }
      const highlightSet = new Set(highlighted.flatMap((m) => m.indices));
      for (let i = 0; i < kpsForFrame.length; i += 1) {
        if (!visible(i)) continue;
        const [x, y] = D(kpsForFrame[i]);
        ctx.fillStyle = highlightSet.has(i) ? METRIC_COLOR : LEVEL_COLOR[level(i)];
        ctx.beginPath(); ctx.arc(x, y, lw * (highlightSet.has(i) ? 2.2 : 1.6), 0, Math.PI * 2); ctx.fill();
      }
      ctx.font = `${Math.round(14 * dpr)}px Lexend, sans-serif`;
      ctx.fillStyle = METRIC_COLOR;
      for (const a of angleLabels) {
        const [x, y] = D(a.at);
        ctx.fillText(`${Math.round(a.deg)}°`, x + 12 * dpr, y);
      }
    }

    if (follow) {
      const mw = cw * 0.24;
      const mh = mw * (data.height / data.width);
      const mx = cw - mw - 12 * dpr;
      const my = ch - mh - 12 * dpr;
      if (video && video.readyState >= 2) ctx.drawImage(video, mx, my, mw, mh);
      else { ctx.fillStyle = "#000"; ctx.fillRect(mx, my, mw, mh); }
      const M = (x: number, y: number): Pt => [mx + (x / data.width) * mw, my + (y / data.height) * mh];
      ctx.lineWidth = Math.max(1, dpr);
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.strokeRect(mx, my, mw, mh);
      if (data.zoomCrop) { const [a, b] = M(data.zoomCrop.x, data.zoomCrop.y); ctx.strokeRect(a, b, (data.zoomCrop.w / data.width) * mw, (data.zoomCrop.h / data.height) * mh); }
      ctx.strokeStyle = TRAIL_COLOR;
      const [fx, fy] = M(view.x, view.y);
      ctx.strokeRect(fx, fy, (view.w / data.width) * mw, (view.h / data.height) * mh);
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= frame; i += 1) {
        const h = data.perFrame[i]?.hip;
        if (!h) continue;
        const [x, y] = M(h[0], h[1]);
        if (started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; }
      }
      ctx.stroke();
    }
  }, [data, view, frame, trail, follow, kpsForFrame, highlighted, angleLabels, noDetection, videoReady, drawTick]);

  if (state === "loading") {
    return <div className="mt-4 aspect-video w-full animate-pulse rounded-xl bg-surface-container-high" />;
  }
  if (state === "error") {
    return <div className="mt-4 rounded-xl bg-surface-container-lowest p-4 text-sm text-error-dim">{errorText}</div>;
  }
  if (state === "empty" || !data) {
    return (
      <div className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-surface-container-lowest p-8 text-center">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant">accessibility_new</span>
        <div className="text-sm text-on-surface">No stored keypoints for this run.</div>
      </div>
    );
  }

  const pf = data.perFrame[frame];
  const tags = [
    frame === data.releaseAnchorFrame ? "Release anchor" : null,
    frame === data.catchAnchorFrame ? "Catch anchor" : null,
  ].filter((t): t is string => t !== null);
  const pct = (f: number) => (lastFrame > 0 ? (f / lastFrame) * 100 : 0);
  const metricFrames = [...new Set(data.metrics.filter((m) => metricSel === "all" || m.name === metricSel).flatMap((m) => m.frames))];

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { void v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="relative w-full overflow-hidden rounded-xl bg-surface-container-lowest" style={{ aspectRatio: `${data.width} / ${data.height}` }}>
        {videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            muted
            playsInline
            preload="auto"
            onLoadedData={handleLoaded}
            onSeeked={() => setDrawTick((t) => t + 1)}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
            onError={() => { void handleError(); }}
            className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          />
        )}
        <canvas ref={canvasRef} data-testid="pose-overlay-canvas" className="absolute inset-0 h-full w-full" />
        <div className="glass-card absolute left-3 top-3 max-w-[60%] space-y-1 rounded-xl px-4 py-3 text-xs text-on-surface" data-testid="pose-overlay-panel">
          <div className="font-bold">Frame {frame}/{lastFrame} · {(frame / data.fps).toFixed(2)}s</div>
          <div>Phase: {phaseLabel(frame, data.phaseWindows)}</div>
          <div className="text-on-surface-variant">Source: {frameSourceLabel(frame, data)}</div>
          <div className="text-on-surface-variant">
            Scale: {pf?.scalePpy != null ? `${pf.scalePpy.toFixed(1)} px/yd` : "not recorded"} · Athlete height: {pf?.athleteHeightPx != null ? `${pf.athleteHeightPx.toFixed(0)} px` : "not recorded"}
          </div>
          {tags.map((t) => <div key={t} className="font-bold text-primary">{t}</div>)}
          {highlighted.map((m) => (
            <div key={m.name} style={{ color: METRIC_COLOR }}>
              {m.name}: {m.value !== null ? `${m.value} ${m.unit}` : m.status}
              {angleLabels.find((a) => a.name === m.name) ? ` · live ${Math.round(angleLabels.find((a) => a.name === m.name)?.deg ?? 0)}°` : ""}
            </div>
          ))}
          {noDetection && <div className="font-bold text-error-dim">No detection</div>}
        </div>
        <div className="glass-card absolute right-3 top-3 space-y-1 rounded-xl px-3 py-2 text-[10px] uppercase tracking-widest text-on-surface">
          {(["reliable", "marginal", "unreliable"] as const).map((l) => (
            <div key={l} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: LEVEL_COLOR[l] }} />{l}</div>
          ))}
          <div className="flex items-center gap-2"><span className="h-0.5 w-3" style={{ background: TRAIL_COLOR }} />hip trail</div>
          <div className="flex items-center gap-2"><span className="h-0.5 w-3" style={{ background: METRIC_COLOR }} />metric</div>
          <div className="normal-case tracking-normal text-on-surface-variant">{data.confidenceSource === "per_frame" ? "Per-frame confidence" : "Run-level confidence"}</div>
        </div>
      </div>

      <div
        className="relative w-full cursor-pointer rounded-lg bg-surface-container-lowest py-2"
        style={{ height: `${data.phaseWindows.length * 8 + 24}px` }}
        data-testid="pose-overlay-timeline"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          seek(Math.round(((e.clientX - r.left) / r.width) * lastFrame));
        }}
      >
        {data.phaseWindows.map((w, i) => (
          <div
            key={w.phase}
            title={`${w.phase}: ${w.start}–${w.end}`}
            className="absolute h-1 rounded-full"
            style={{ left: `${pct(w.start)}%`, width: `${Math.max(0.5, pct(w.end) - pct(w.start))}%`, top: `${8 + i * 8}px`, background: PHASE_COLORS[i % PHASE_COLORS.length] }}
          />
        ))}
        {metricFrames.map((f) => (
          <div key={`m${f}`} className="absolute bottom-1 h-1 w-1 rounded-full" style={{ left: `${pct(f)}%`, background: METRIC_COLOR }} />
        ))}
        {data.releaseAnchorFrame !== null && <div title="Release anchor" className="absolute bottom-0 top-0 w-0.5 bg-on-surface/70" style={{ left: `${pct(data.releaseAnchorFrame)}%` }} />}
        {data.catchAnchorFrame !== null && <div title="Catch anchor" className="absolute bottom-0 top-0 w-0.5 bg-primary" style={{ left: `${pct(data.catchAnchorFrame)}%` }} />}
        <div className="absolute bottom-0 top-0 w-0.5 bg-on-surface" style={{ left: `${pct(frame)}%` }} />
      </div>
      <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-widest text-on-surface-variant">
        {data.phaseWindows.map((w, i) => (
          <span key={w.phase} className="flex items-center gap-1"><span className="h-1 w-3 rounded-full" style={{ background: PHASE_COLORS[i % PHASE_COLORS.length] }} />{w.phase} {w.start}–{w.end}</span>
        ))}
        {activePhases(frame, data.phaseWindows).length > 1 && <span className="text-on-surface">Overlap</span>}
      </div>

      <input
        type="range"
        min={0}
        max={lastFrame}
        value={frame}
        onChange={(e) => { videoRef.current?.pause(); seek(Number(e.target.value)); }}
        className="w-full accent-primary-container"
        aria-label="Scrub frames"
      />

      <div className="flex flex-wrap items-center gap-2">
        <IconButton icon="skip_previous" label="Previous frame" onClick={() => step(-1)} />
        <IconButton icon={playing ? "pause" : "play_arrow"} label={playing ? "Pause" : "Play"} onClick={togglePlay} />
        <IconButton icon="skip_next" label="Next frame" onClick={() => step(1)} />
        <div className="flex rounded-full bg-surface-container-high p-1">
          {SPEEDS.map((s) => (
            <button key={s} type="button" onClick={() => setSpeed(s)} className={`rounded-full px-3 py-1 text-xs font-black ${speed === s ? "bg-primary-container text-surface" : "text-on-surface-variant"}`}>{s}×</button>
          ))}
        </div>
        <Toggle label="Smoothed" on={smoothed} onChange={setSmoothed} />
        <Toggle label="Hip trail" on={trail} onChange={setTrail} />
        <Toggle label="Follow athlete" on={follow} onChange={setFollow} />
        <label className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">
          Metric
          <select value={metricSel} onChange={(e) => setMetricSel(e.target.value)} className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-3 py-1.5 text-xs normal-case text-on-surface">
            <option value="all">All</option>
            {data.metrics.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
          </select>
        </label>
      </div>
      {errorText && <div className="text-xs text-error-dim">{errorText}</div>}
    </div>
  );
}

function IconButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-high text-on-surface transition-all duration-150 active:scale-95">
      <span className="material-symbols-outlined text-lg">{icon}</span>
    </button>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={() => onChange(!on)} className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-150 active:scale-95 ${on ? "bg-primary-container text-surface" : "bg-surface-container-high text-on-surface-variant"}`}>
      {label}
    </button>
  );
}
