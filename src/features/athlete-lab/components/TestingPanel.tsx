import { useRef, useState } from "react";
import type {
  PipelineAnalysisResult,
  PipelineMetricResult,
  PipelineRunStage,
  PipelineUploadSnapshot,
  TrainingNode,
} from "../types";
import {
  type AnalysisContext,
  cancelRunAnalysis,
  pollRunAnalysisResult,
  submitRunAnalysisJob,
} from "@/services/athleteLab";
import { SectionTooltip } from "./SectionTooltip";
import { AnalysisLog } from "./AnalysisLog";
import { cn } from "@/lib/utils";

const MAX_CLIP_WINDOW_SECONDS = 3;

interface TestingPanelProps {
  node: TrainingNode;
}

type CameraAngleOption = "sideline" | "behind_qb" | "endzone" | "other";
type PeopleOption = "solo" | "with_defender" | "multiple";
type BreakDirectionOption = "left" | "right" | "both" | "straight";
type CatchOption = "yes" | "no" | "partial";
type AthleteLevelOption = "youth" | "high_school" | "college" | "professional";
type MeasurementUnit = "inches" | "cm";

type ScoreTone = "success" | "warning" | "danger";

const STAGE_LABELS: Record<PipelineRunStage, string> = {
  idle: "Ready",
  preparing_video: "Compressing to 30 fps",
  uploading: "Uploading video",
  queued: "Queued for analysis",
  processing: "Processing on server",
  fetching_results: "Fetching results",
  complete: "Complete",
  cancelled: "Cancelled",
  failed: "Pipeline failed",
  timed_out: "Polling timed out",
};

const STAGE_ICONS: Record<PipelineRunStage, string> = {
  idle: "science",
  preparing_video: "movie_edit",
  uploading: "cloud_upload",
  queued: "schedule",
  processing: "bolt",
  fetching_results: "database",
  complete: "check_circle",
  cancelled: "block",
  failed: "error",
  timed_out: "hourglass_top",
};

function RadioPills({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: readonly { value: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "h-8 rounded-full px-4 text-xs font-bold uppercase tracking-[0.15em] transition-all duration-150 active:scale-95",
            value === opt.value
              ? "kinetic-gradient text-primary-foreground"
              : "bg-surface-container-high border border-outline-variant/20 text-on-surface-variant hover:text-on-surface hover:border-outline-variant/40",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function scoreTone(score: number | null): ScoreTone {
  if (score === null) return "danger";
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "danger";
}

function scoreClasses(score: number | null) {
  const tone = scoreTone(score);
  if (tone === "success") {
    return {
      badge: "bg-primary-container/15 text-primary",
      bar: "bg-primary-container",
      ring: "bg-primary-container/20",
    };
  }

  if (tone === "warning") {
    return {
      badge: "bg-yellow-500/15 text-yellow-300",
      bar: "bg-yellow-300",
      ring: "bg-yellow-500/20",
    };
  }

  return {
    badge: "bg-destructive/15 text-destructive-foreground",
    bar: "bg-destructive",
    ring: "bg-destructive/20",
  };
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function buildPoseQualityAudit(result: PipelineAnalysisResult) {
  const logData = result.log_data;
  const rtmlib = logData?.rtmlib;
  const metrics = result.metricResults;
  const lowConfidenceFlags = result.confidenceFlags.filter((flag) => flag.reason.toLowerCase().includes("confidence"));
  const lowConfidenceMetrics = metrics.filter((metric) => metric.status === "flagged" && (metric.reason ?? "").toLowerCase().includes("confidence"));
  const reliableFramePercentage = typeof rtmlib?.reliable_frame_percentage === "number"
    ? rtmlib.reliable_frame_percentage
    : typeof rtmlib?.keypoint_confidence?.length === "number" && rtmlib.keypoint_confidence.length > 0
      ? Math.max(0, 100 - (rtmlib.keypoint_confidence.reduce((sum, entry) => sum + entry.percent_below, 0) / rtmlib.keypoint_confidence.length))
      : null;
  const averageKeypointConfidence = typeof rtmlib?.average_keypoint_confidence === "number"
    ? rtmlib.average_keypoint_confidence
    : typeof rtmlib?.keypoint_confidence?.length === "number" && rtmlib.keypoint_confidence.length > 0
      ? rtmlib.keypoint_confidence.reduce((sum, entry) => sum + entry.mean_confidence, 0) / rtmlib.keypoint_confidence.length
      : null;
  const personDetected = typeof rtmlib?.person_detected === "boolean"
    ? rtmlib.person_detected
    : Boolean(rtmlib?.total_frames && (rtmlib.keypoint_confidence?.length ?? 0) > 0);
  const isLowConfidence = (result.aggregateScore ?? 0) === 0 || lowConfidenceMetrics.length >= Math.max(2, Math.ceil(Math.max(metrics.length, 1) * 0.6));

  if (!isLowConfidence) return null;

  return {
    personDetected,
    averageKeypointConfidence,
    reliableFramePercentage,
    mostCommonIssue: rtmlib?.most_common_issue ?? (lowConfidenceFlags.length > 0 ? lowConfidenceFlags[0]?.reason : "Pose quality too low for reliable scoring"),
  };
}

function calibrationSummary(metric: PipelineMetricResult) {
  const detail = metric.detail;
  if (!detail) return null;

  const calibrationSource = typeof detail.calibrationSource === "string" ? detail.calibrationSource : null;
  const calibrationConfidence = typeof detail.calibrationConfidence === "number"
    ? detail.calibrationConfidence
    : typeof detail.calibrationConfidence === "string"
      ? detail.calibrationConfidence
      : null;
  const calibrationDetails = detail.calibrationDetails && typeof detail.calibrationDetails === "object" && !Array.isArray(detail.calibrationDetails)
    ? (detail.calibrationDetails as Record<string, unknown>)
    : null;
  const pixelsPerYard = typeof detail.pixelsPerYard === "number"
    ? detail.pixelsPerYard
    : calibrationDetails && typeof calibrationDetails.pixelsPerYard === "number"
      ? calibrationDetails.pixelsPerYard
      : null;

  if (!calibrationSource && calibrationConfidence === null && !calibrationDetails && pixelsPerYard === null) {
    return null;
  }

  return {
    calibrationSource,
    calibrationConfidence,
    calibrationDetails,
    pixelsPerYard,
  };
}

export function TestingPanel({ node }: TestingPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localAbortRef = useRef<AbortController | null>(null);
  const [videoDesc, setVideoDesc] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineAnalysisResult | null>(null);
  const [activeUpload, setActiveUpload] = useState<PipelineUploadSnapshot | null>(null);
  const [runStage, setRunStage] = useState<PipelineRunStage>("idle");
  const [contextEnabled, setContextEnabled] = useState(true);
  const [cameraAngle, setCameraAngle] = useState<CameraAngleOption>("sideline");
  const [peopleInVideo, setPeopleInVideo] = useState<PeopleOption>("solo");
  const [breakDirection, setBreakDirection] = useState<BreakDirectionOption>("left");
  const [catchStatus, setCatchStatus] = useState<CatchOption>("yes");
  const [athleteLevel, setAthleteLevel] = useState<AthleteLevelOption>("high_school");
  const [focusArea, setFocusArea] = useState("");
  const [athleteHeight, setAthleteHeight] = useState("");
  const [athleteHeightUnit, setAthleteHeightUnit] = useState<MeasurementUnit>("inches");
  const [athleteWingspan, setAthleteWingspan] = useState("");
  const [athleteWingspanUnit, setAthleteWingspanUnit] = useState<MeasurementUnit>("inches");
  const [endSeconds, setEndSeconds] = useState(
    Math.min(node.clip_duration_max, MAX_CLIP_WINDOW_SECONDS).toString(),
  );
  const [contextCopied, setContextCopied] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [localProgressMessage, setLocalProgressMessage] = useState("");
  const [preparationNotice, setPreparationNotice] = useState<string | null>(null);

  const isRunning = ["preparing_video", "uploading", "queued", "processing", "fetching_results"].includes(runStage);
  const hasInput = Boolean(videoUrl.trim() || uploadedFile);
  const poseQualityAudit = result ? buildPoseQualityAudit(result) : null;

  const handleFileSelect = (file: File) => {
    setUploadedFile(file);
    setVideoUrl("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      handleFileSelect(file);
    }
  };

  const buildRouteDirectionPayload = (value: BreakDirectionOption): Pick<AnalysisContext, "route_direction"> | Record<string, never> => {
    if (value === "straight") return {};
    return { route_direction: value };
  };

  const buildContext = (): AnalysisContext & Record<string, unknown> => {
    const parsedHeight = athleteHeight.trim() ? Number(athleteHeight) : Number.NaN;
    const parsedWingspan = athleteWingspan.trim() ? Number(athleteWingspan) : Number.NaN;

    return {
      camera_angle: cameraAngle,
      people_in_video: peopleInVideo,
      ...buildRouteDirectionPayload(breakDirection),
      catch_included: catchStatus !== "no",
      catch_status: catchStatus,
      athlete_level: athleteLevel,
      focus_area: focusArea.trim(),
      performance_description: videoDesc.trim(),
      ...(Number.isFinite(parsedHeight)
        ? {
            athlete_height: {
              value: parsedHeight,
              unit: athleteHeightUnit,
            },
          }
        : {}),
      ...(Number.isFinite(parsedWingspan)
        ? {
            athlete_wingspan: {
              value: parsedWingspan,
              unit: athleteWingspanUnit,
            },
          }
        : {}),
    };
  };

  const resetRunState = () => {
    localAbortRef.current?.abort();
    localAbortRef.current = null;
    setError(null);
    setResult(null);
    setActiveUpload(null);
    setLocalProgressMessage("");
    setPreparationNotice(null);
    setRunStage("idle");
  };

  const handleRerun = () => {
    resetRunState();
    setUploadedFile(null);
    setVideoUrl("");
    setVideoDesc("");
  };

  const handleRetry = () => {
    localAbortRef.current?.abort();
    localAbortRef.current = null;
    setError(null);
    setResult(null);
    setLocalProgressMessage("");
    setPreparationNotice(null);
    setRunStage("idle");
  };

  const handleCancel = async () => {
    if (isCancelling) return;

    if (!activeUpload && (runStage === "preparing_video" || runStage === "uploading")) {
      localAbortRef.current?.abort();
      localAbortRef.current = null;
      setLocalProgressMessage("");
      setPreparationNotice(null);
      setResult(null);
      setError(null);
      setRunStage("cancelled");
      return;
    }

    if (!activeUpload) return;

    setIsCancelling(true);
    setError(null);

    try {
      const cancelledUpload = await cancelRunAnalysis(activeUpload.id);
      setActiveUpload(cancelledUpload);
      setResult(null);
      setError(null);
      setLocalProgressMessage("");
      setPreparationNotice(null);
      setRunStage("cancelled");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRun = async () => {
    if (!hasInput || isRunning) return;

    setError(null);
    setResult(null);
    setActiveUpload(null);
    setLocalProgressMessage("");
    setPreparationNotice(null);

    const abortController = new AbortController();
    localAbortRef.current = abortController;
    setRunStage(uploadedFile ? "preparing_video" : "queued");

    try {
      const parsedEndSeconds = endSeconds.trim() ? Number(endSeconds) : Number.NaN;
      const effectiveMax = Math.min(node.clip_duration_max, MAX_CLIP_WINDOW_SECONDS);
      const effectiveMin = Math.min(node.clip_duration_min, effectiveMax);
      const normalizedEndSeconds = Number.isFinite(parsedEndSeconds)
        ? Math.min(Math.max(parsedEndSeconds, effectiveMin), effectiveMax)
        : effectiveMax;

      const submission = await submitRunAnalysisJob(
        {
          node,
          uploadedFile,
          externalVideoUrl: videoUrl.trim() || undefined,
          cameraAngle,
          startSeconds: 0,
          endSeconds: normalizedEndSeconds,
          analysisContext: contextEnabled ? buildContext() : {
            camera_angle: cameraAngle,
            people_in_video: peopleInVideo,
            ...buildRouteDirectionPayload(breakDirection),
            catch_included: catchStatus !== "no",
            catch_status: catchStatus,
            athlete_level: athleteLevel,
            focus_area: "",
            performance_description: videoDesc.trim(),
          },
        },
        {
          signal: abortController.signal,
          onStageChange: (stage) => setRunStage(stage),
          onProgressMessage: (message) => setLocalProgressMessage(message),
        },
      );

      setActiveUpload(submission.upload);
      setPreparationNotice(submission.preparationNote ?? null);
      setLocalProgressMessage("");
      setRunStage(submission.upload.status === "pending" ? "queued" : "processing");

      const polled = await pollRunAnalysisResult(submission.uploadId, node, {
        onStageChange: (stage, upload) => {
          if (stage === "cancelled") {
            setRunStage("cancelled");
            setLocalProgressMessage("");
            setPreparationNotice(null);
            if (upload) setActiveUpload(upload);
            return;
          }

          setRunStage(stage);
          if (stage === "processing" || stage === "fetching_results" || stage === "complete") {
            setLocalProgressMessage("");
            setPreparationNotice(null);
          }
          if (upload) setActiveUpload(upload);
        },
      });

      setActiveUpload(polled.upload);

      if (polled.stage === "complete" && polled.result) {
        setResult({
          ...polled.result,
          uploadStatus: polled.upload.status,
          errorMessage: polled.upload.error_message,
        });
        setRunStage("complete");
        return;
      }

      if (polled.stage === "cancelled") {
        setRunStage("cancelled");
        setLocalProgressMessage("");
        setPreparationNotice(null);
        setError(null);
        return;
      }

      if (polled.stage === "timed_out") {
        setRunStage("timed_out");
        setError("Polling stopped after 240 seconds. The production pipeline may still be running, so check back later using this upload ID.");
        return;
      }

      setRunStage("failed");
      setError(polled.upload.error_message || "The production pipeline failed before results were written.");
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setRunStage("cancelled");
        setLocalProgressMessage("");
        setPreparationNotice(null);
        setError(null);
        return;
      }

      setRunStage("failed");
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      if (localAbortRef.current === abortController) {
        localAbortRef.current = null;
      }
    }
  };

  const copyContext = () => {
    const cameraLabel: Record<CameraAngleOption, string> = { sideline: "Sideline", behind_qb: "Behind QB", endzone: "Endzone", other: "Other" };
    const peopleLabel: Record<PeopleOption, string> = { solo: "Just Me", with_defender: "Me + Defender", multiple: "Multiple People" };
    const breakLabel: Record<BreakDirectionOption, string> = {
      left: "Athlete Breaks Left",
      right: "Athlete Breaks Right",
      both: "Both Directions",
      straight: "No Break / Straight Route",
    };
    const catchLabel: Record<CatchOption, string> = { yes: "Yes", no: "No", partial: "Partial" };
    const levelLabel: Record<AthleteLevelOption, string> = { youth: "Youth (Under 14)", high_school: "High School", college: "College", professional: "Professional" };

    const text = `# Analysis Context\nCamera Angle: ${cameraLabel[cameraAngle]}\nPeople in Video: ${peopleLabel[peopleInVideo]}\nBreak Direction: ${breakLabel[breakDirection]}\nCatch Included: ${catchLabel[catchStatus]}\nAthlete Level: ${levelLabel[athleteLevel]}\nAthlete Height: ${athleteHeight.trim() ? `${athleteHeight.trim()} ${athleteHeightUnit}` : "Not provided"}\nAthlete Wingspan: ${athleteWingspan.trim() ? `${athleteWingspan.trim()} ${athleteWingspanUnit}` : "Not provided"}\nEnd Seconds: ${endSeconds.trim() || node.clip_duration_max}\nFocus Area: ${focusArea.trim() || "Not specified"}\nPerformance Description: ${videoDesc.trim() || "Not specified"}`;
    navigator.clipboard.writeText(text);
    setContextCopied(true);
    setTimeout(() => setContextCopied(false), 1500);
  };

  const statusTone = runStage === "complete"
    ? "text-primary"
    : runStage === "cancelled"
      ? "text-on-surface-variant"
    : runStage === "timed_out"
      ? "text-yellow-300"
      : runStage === "failed"
        ? "text-destructive-foreground"
        : "text-on-surface";

  const progressMessage = activeUpload?.progress_message?.trim() || "";
  const displayProgressMessage = localProgressMessage || progressMessage || (
    runStage === "preparing_video"
      ? "Compressing video to 30 fps..."
      : runStage === "uploading"
        ? "Uploading video..."
      : runStage === "queued"
        ? "Queued for analysis..."
        : runStage === "processing"
          ? "Loading model on server..."
          : runStage === "fetching_results"
            ? "Loading the completed analysis package..."
            : ""
  );
  const progressSegments = [
    runStage !== "idle",
    ["uploading", "queued", "processing", "fetching_results", "complete", "cancelled"].includes(runStage),
    ["queued", "processing", "fetching_results", "complete", "cancelled"].includes(runStage),
    ["processing", "fetching_results", "complete"].includes(runStage),
    ["fetching_results", "complete"].includes(runStage),
    runStage === "complete",
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/5 bg-surface-container">
        <div className="flex items-center justify-between p-5 pb-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant">Analysis Context</span>
            <SectionTooltip tip="Context flows directly into the production upload payload so calibration, detection frequency, and feedback use the real pipeline settings." />
            <button onClick={copyContext} className="ml-2 text-on-surface-variant/40 transition-colors hover:text-on-surface" title="Copy context">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{contextCopied ? "check" : "content_copy"}</span>
            </button>
          </div>
          <button
            onClick={() => setContextEnabled(!contextEnabled)}
            className={cn(
              "relative h-5 w-10 rounded-full transition-colors duration-200",
              contextEnabled ? "bg-primary-container" : "bg-surface-container-highest",
            )}
          >
            <span className={cn(
              "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-on-surface transition-transform duration-200",
              contextEnabled ? "translate-x-5" : "",
            )} />
          </button>
        </div>

        {contextEnabled && (
          <div className="space-y-4 p-5 pt-4">
            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">Camera Angle</label>
              <RadioPills value={cameraAngle} onChange={(v) => setCameraAngle(v as CameraAngleOption)} options={[
                { value: "sideline", label: "Sideline" },
                { value: "behind_qb", label: "Behind QB" },
                { value: "endzone", label: "Endzone" },
                { value: "other", label: "Other" },
              ]} />
              <p className="mt-1.5 text-[10px] text-on-surface-variant/50">Used by the calibration resolver in the production pipeline.</p>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">People in Video</label>
              <RadioPills value={peopleInVideo} onChange={(v) => setPeopleInVideo(v as PeopleOption)} options={[
                { value: "solo", label: "Just Me" },
                { value: "with_defender", label: "Me + Defender" },
                { value: "multiple", label: "Multiple People" },
              ]} />
              <p className="mt-1.5 text-[10px] text-on-surface-variant/50">Used by person locking strategy and detector frequency selection.</p>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">Break Direction</label>
              <RadioPills value={breakDirection} onChange={(v) => setBreakDirection(v as BreakDirectionOption)} options={[
                { value: "left", label: "Athlete Breaks Left" },
                { value: "right", label: "Athlete Breaks Right" },
                { value: "straight", label: "No Break / Straight Route" },
                { value: "both", label: "Both Directions" },
              ]} />
              <p className="mt-1.5 text-[10px] text-on-surface-variant/50">Indicates the direction the athlete cuts at the break point. For routes with a break, this determines which foot plants (outside foot) and which side&apos;s keypoints are measured. For straight routes with no break, select &quot;No Break / Straight Route.&quot;</p>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">Clip Includes Catch?</label>
              <RadioPills value={catchStatus} onChange={(v) => setCatchStatus(v as CatchOption)} options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "partial", label: "Partial" },
              ]} />
              <p className="mt-1.5 text-[10px] text-on-surface-variant/50">Catch-dependent metrics stay aligned with the real scoring rules.</p>
              {catchStatus === "no" && (
                <div className="mt-2 rounded-lg border border-outline-variant/10 bg-surface-container-high px-3 py-2">
                  <p className="text-xs text-on-surface-variant">Catch Efficiency and YAC Burst will be excluded when the run reaches metric scoring.</p>
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">Athlete Level</label>
              <select
                value={athleteLevel}
                onChange={(e) => setAthleteLevel(e.target.value as AthleteLevelOption)}
                className="w-full rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface transition-colors focus:border-primary-container/50 focus:outline-none"
              >
                <option value="youth">Youth (Under 14)</option>
                <option value="high_school">High School</option>
                <option value="college">College</option>
                <option value="professional">Professional</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">Focus Area <span className="text-on-surface-variant/30">(Optional)</span></label>
              <input
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value.slice(0, 100))}
                placeholder="e.g. working on my break angle"
                className="w-full rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 transition-colors focus:border-primary-container/50 focus:outline-none"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-[10px] text-on-surface-variant/50">Passed into the full analysis context JSON.</p>
                <span className="text-[10px] text-on-surface-variant/30">{focusArea.length}/100</span>
              </div>
            </div>

            <div className="space-y-3 rounded-xl bg-surface-container-high/60 p-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant">Body Calibration</p>
                <p className="mt-1 text-[10px] text-on-surface-variant/50">Height and wingspan feed the body-based calibration fallback when dynamic calibration is unavailable.</p>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">Athlete Height</label>
                <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={athleteHeight}
                    onChange={(e) => setAthleteHeight(e.target.value)}
                    placeholder="70"
                    className="w-full rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 transition-colors focus:border-primary-container/50 focus:outline-none"
                  />
                  <select
                    value={athleteHeightUnit}
                    onChange={(e) => setAthleteHeightUnit(e.target.value as MeasurementUnit)}
                    className="w-full rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface transition-colors focus:border-primary-container/50 focus:outline-none"
                  >
                    <option value="inches">Inches</option>
                    <option value="cm">CM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">Athlete Wingspan <span className="text-on-surface-variant/30">(Optional)</span></label>
                <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={athleteWingspan}
                    onChange={(e) => setAthleteWingspan(e.target.value)}
                    placeholder="72"
                    className="w-full rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 transition-colors focus:border-primary-container/50 focus:outline-none"
                  />
                  <select
                    value={athleteWingspanUnit}
                    onChange={(e) => setAthleteWingspanUnit(e.target.value as MeasurementUnit)}
                    className="w-full rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface transition-colors focus:border-primary-container/50 focus:outline-none"
                  >
                    <option value="inches">Inches</option>
                    <option value="cm">CM</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-white/5 bg-surface-container p-5">
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">Video Upload</label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex min-h-[90px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-surface-container-lowest transition-colors",
              dragOver
                ? "border-primary-container/50 bg-primary-container/5"
                : uploadedFile
                  ? "border-primary-container/30"
                  : "border-outline-variant/20 hover:border-outline-variant/40",
            )}
          >
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(file); }} />
            {uploadedFile ? (
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 24 }}>videocam</span>
                <div>
                  <div className="text-sm font-medium text-on-surface">{uploadedFile.name}</div>
                  <div className="text-[10px] text-on-surface-variant">{(uploadedFile.size / 1024 / 1024).toFixed(1)} MB</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }} className="ml-2 text-on-surface-variant transition-colors hover:text-destructive-foreground">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              </div>
            ) : (
              <>
                <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 28 }}>cloud_upload</span>
                <span className="text-xs text-on-surface-variant">Drag & drop a video or <span className="font-semibold text-primary">browse</span></span>
                <span className="text-[10px] text-on-surface-variant/40">Accepted by MIME type: video/*</span>
              </>
            )}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">Or Paste Direct Video URL</label>
          <input
            value={videoUrl}
            onChange={(e) => { setVideoUrl(e.target.value); if (e.target.value) setUploadedFile(null); }}
            placeholder="https://..."
            className="w-full rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 transition-colors focus:border-primary-container/50 focus:outline-none"
          />
          <p className="mt-1.5 text-[10px] text-on-surface-variant/50">Local uploads land in athlete-videos/test-clips with a 24-hour signed URL. External URLs are passed through as-is.</p>
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">Performance Description (Optional)</label>
          <textarea
            value={videoDesc}
            onChange={(e) => setVideoDesc(e.target.value)}
            placeholder="Describe the rep for later result review..."
            className="min-h-[70px] w-full resize-y rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 transition-colors focus:border-primary-container/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">Clip End Seconds</label>
          <input
            type="number"
            min={Math.min(node.clip_duration_min, MAX_CLIP_WINDOW_SECONDS)}
            max={MAX_CLIP_WINDOW_SECONDS}
            step="0.1"
            value={endSeconds}
            onChange={(e) => setEndSeconds(e.target.value)}
            className="w-full rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 transition-colors focus:border-primary-container/50 focus:outline-none"
          />
          <p className="mt-1.5 text-[10px] text-on-surface-variant/50">3-second clips are currently supported; longer clips coming soon. Start seconds are fixed at 0; end seconds are clamped to {MAX_CLIP_WINDOW_SECONDS}s.</p>
        </div>

        <div className="rounded-xl border border-white/5 bg-surface-container-high/50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className={cn("material-symbols-outlined", statusTone)} style={{ fontSize: 18 }}>{STAGE_ICONS[runStage]}</span>
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-on-surface-variant">Pipeline Status</p>
              <p className="mt-1 text-sm text-on-surface">{STAGE_LABELS[runStage]}</p>
            </div>
            {activeUpload && (
              <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">Upload ID</p>
                <p className="mt-1 break-all font-mono text-[11px] text-on-surface">{activeUpload.id}</p>
              </div>
            )}
          </div>
          {displayProgressMessage && (
            <div className="mt-4 space-y-3">
              <div className="flex gap-1">
                {progressSegments.map((filled, index) => (
                  <span
                    key={`progress-segment-${index}`}
                    className={cn(
                      "h-1.5 flex-1 rounded-full bg-surface-container-lowest transition-colors",
                      filled && "bg-primary-container",
                    )}
                  />
                ))}
              </div>
              <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-on-surface-variant/70">Latest Progress</p>
                <p className="mt-1 text-sm text-on-surface">{displayProgressMessage}</p>
              </div>
            </div>
          )}
          {preparationNotice && (
            <div className="mt-3 rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-on-surface-variant/70">Upload Note</p>
              <p className="mt-1 text-sm text-on-surface">{preparationNotice}</p>
            </div>
          )}
          {runStage === "timed_out" && (
            <p className="mt-3 text-xs text-on-surface-variant">Polling gave up after 240 seconds. This does not mean the pipeline failed — the job may still complete and appear in results later.</p>
          )}
          {runStage === "cancelled" && (
            <p className="mt-3 text-xs text-on-surface-variant">This run was cancelled before completion. No final analysis results will be written for this upload.</p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleRun}
            disabled={!hasInput || isRunning}
            className="flex h-11 items-center gap-2 rounded-full kinetic-gradient px-8 text-xs font-black uppercase tracking-[0.2em] text-primary-foreground transition-all duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            <span className={cn("material-symbols-outlined", isRunning && "animate-pulse")} style={{ fontSize: 16 }}>
              {isRunning ? STAGE_ICONS[runStage] : "play_arrow"}
            </span>
            {isRunning ? STAGE_LABELS[runStage] : "Run Analysis"}
          </button>

          {((runStage === "preparing_video" || runStage === "uploading") || (activeUpload && (activeUpload.status === "pending" || activeUpload.status === "processing"))) && runStage !== "cancelled" && (
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="flex h-11 items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-high px-6 text-xs font-black uppercase tracking-[0.2em] text-on-surface transition-all duration-150 active:scale-95 hover:bg-surface-container-highest disabled:pointer-events-none disabled:opacity-50"
            >
              <span className={cn("material-symbols-outlined", isCancelling && "animate-pulse")} style={{ fontSize: 16 }}>
                {isCancelling ? "hourglass_top" : "block"}
              </span>
              {isCancelling ? "Cancelling" : "Cancel Run"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined shrink-0 text-destructive-foreground" style={{ fontSize: 20 }}>error</span>
            <div className="space-y-2">
              <div>
                <div className="text-sm font-semibold text-destructive-foreground">{runStage === "timed_out" ? "Polling Timed Out" : "Analysis Failed"}</div>
                <div className="mt-1 text-xs text-destructive-foreground/80">{error}</div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleRetry}
                  className="flex h-10 items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-high px-5 text-xs font-black uppercase tracking-[0.2em] text-on-surface transition-all duration-150 active:scale-95 hover:bg-surface-container-highest"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                  Retry
                </button>
                {activeUpload && (
                  <div className="flex items-center rounded-full border border-outline-variant/10 bg-surface-container-lowest px-4 text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
                    Last upload: {activeUpload.id}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!result && !error && !isRunning && (
        <div className="flex flex-col items-center space-y-4 rounded-xl border border-white/5 bg-surface-container p-8 text-center">
          <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: 48 }}>{runStage === "cancelled" ? "block" : "analytics"}</span>
          <p className="max-w-md text-sm text-on-surface-variant">
            {runStage === "cancelled"
              ? "This test run was intentionally stopped. Start another run whenever you want to re-enter the full production pipeline."
              : "Run the real production pipeline to inspect aggregate score, phase scores, metric calibration detail, confidence flags, and generated feedback here."}
          </p>
          <div className="mt-2 grid w-full max-w-lg grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { icon: "speed", label: "Aggregate Score" },
              { icon: "timeline", label: "Phase Scores" },
              { icon: "analytics", label: "Metric Details" },
              { icon: "straighten", label: "Calibration" },
              { icon: "flag", label: "Confidence Flags" },
              { icon: "sports", label: "Feedback" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 rounded-lg border border-white/5 bg-surface-container-high px-3 py-2">
                <span className="material-symbols-outlined text-primary/40" style={{ fontSize: 16 }}>{item.icon}</span>
                <span className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant/60">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          <div className="rounded-xl border border-white/5 bg-surface-container p-5">
            <div className="flex flex-wrap items-center gap-5">
              <div className={cn("flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-3xl font-black", scoreClasses(result.aggregateScore).ring)}>
                <span className={cn("rounded-full px-3 py-2", scoreClasses(result.aggregateScore).badge)}>
                  {result.aggregateScore ?? "—"}
                </span>
              </div>
              <div className="flex-1">
                <div className="text-xl font-black uppercase tracking-tight text-on-surface">Production Analysis Score</div>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-on-surface-variant">
                  <span>Status: <span className="font-bold text-on-surface">{result.uploadStatus}</span></span>
                  {result.analyzedAt && <span>Analyzed: <span className="font-bold text-on-surface">{new Date(result.analyzedAt).toLocaleString()}</span></span>}
                  {result.resultId && <span>Result ID: <span className="font-mono text-on-surface">{result.resultId}</span></span>}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-surface-container p-5">
            <h4 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>timeline</span>
              Phase Breakdown
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {result.phaseBreakdown.map((phase) => {
                const phaseStyles = scoreClasses(phase.score);
                return (
                  <div key={phase.id} className="rounded-xl border border-white/5 bg-surface-container-high p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-on-surface">{phase.name}</span>
                      <span className={cn("rounded-lg px-2 py-0.5 text-sm font-black", phaseStyles.badge)}>{phase.score}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-lowest">
                      <div className={cn("h-full rounded-full", phaseStyles.bar)} style={{ width: `${Math.max(0, Math.min(phase.score, 100))}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-surface-container p-5">
            <h4 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>analytics</span>
              Metric Results
            </h4>
            <div className="space-y-3">
              {result.metricResults.map((metric) => {
                const metricStyles = scoreClasses(metric.score ?? null);
                const calibration = calibrationSummary(metric);
                return (
                  <div key={`${metric.name}-${metric.phase_id ?? metric.phase_name ?? "metric"}`} className="rounded-xl border border-white/5 bg-surface-container-high p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-on-surface">{metric.name}</div>
                        <div className="mt-1 flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/70">
                          <span>{metric.phase_name ?? metric.phase_id ?? "Unassigned phase"}</span>
                          <span>{metric.calculation_type ?? "Unknown calc"}</span>
                          <span>{metric.status}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]", metricStyles.badge)}>
                          {metric.score ?? "—"}
                        </span>
                        <span className="rounded-full border border-outline-variant/10 bg-surface-container-lowest px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
                          Weight {metric.weight}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      <div className="rounded-lg bg-surface-container-lowest px-3 py-3">
                        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">Measured</p>
                        <p className="mt-1 text-sm font-semibold text-on-surface">{formatNumber(metric.value)} {metric.unit}</p>
                      </div>
                      <div className="rounded-lg bg-surface-container-lowest px-3 py-3">
                        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">Elite Target</p>
                        <p className="mt-1 text-sm font-semibold text-on-surface">{metric.elite_target || "—"}</p>
                      </div>
                      <div className="rounded-lg bg-surface-container-lowest px-3 py-3">
                        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">Deviation</p>
                        <p className="mt-1 text-sm font-semibold text-on-surface">{formatNumber(metric.deviation)}</p>
                      </div>
                      <div className="rounded-lg bg-surface-container-lowest px-3 py-3">
                        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">Reason</p>
                        <p className="mt-1 text-sm font-semibold text-on-surface">{metric.reason ?? "—"}</p>
                      </div>
                    </div>

                    {calibration && (
                      <div className="mt-4 rounded-xl border border-primary-container/10 bg-primary-container/5 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>straighten</span>
                          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-on-surface-variant">Calibration</span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">Source</p>
                            <p className="mt-1 text-sm font-semibold text-on-surface">{calibration.calibrationSource ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">Confidence</p>
                            <p className="mt-1 text-sm font-semibold text-on-surface">{typeof calibration.calibrationConfidence === "number" ? calibration.calibrationConfidence.toFixed(2) : calibration.calibrationConfidence ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">Pixels Per Yard</p>
                            <p className="mt-1 text-sm font-semibold text-on-surface">{formatNumber(calibration.pixelsPerYard)}</p>
                          </div>
                        </div>
                        {calibration.calibrationDetails && (
                          <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-container-lowest p-3 text-[11px] text-on-surface-variant">{JSON.stringify(calibration.calibrationDetails, null, 2)}</pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/5 bg-surface-container p-5">
              <h4 className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>flag</span>
                Confidence Flags
              </h4>
              {result.confidenceFlags.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No confidence flags were recorded for this run.</p>
              ) : (
                <ul className="space-y-2">
                  {result.confidenceFlags.map((flag, index) => (
                    <li key={`${flag.metric}-${index}`} className="rounded-lg bg-surface-container-high px-3 py-3 text-xs text-on-surface">
                      <div className="font-semibold text-on-surface">{flag.metric}</div>
                      <div className="mt-1 text-on-surface-variant">{flag.reason}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-white/5 bg-surface-container p-5">
              <h4 className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>error</span>
                Detected Errors
              </h4>
              {result.detectedErrors.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No auto-detected errors fired for this run.</p>
              ) : (
                <div className="space-y-2">
                  {result.detectedErrors.map((entry, index) => (
                    <pre key={index} className="overflow-x-auto rounded-lg bg-surface-container-high p-3 text-[11px] text-on-surface-variant">{JSON.stringify(entry, null, 2)}</pre>
                  ))}
                </div>
              )}
            </div>
          </div>

          {poseQualityAudit && (
            <div className="rounded-xl border border-primary-container/10 bg-primary-container/5 p-5">
              <h4 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>videocam</span>
                Pose Quality Audit
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-surface-container-lowest px-3 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">Person detected</p>
                  <p className="mt-1 text-sm font-semibold text-on-surface">{poseQualityAudit.personDetected ? "Yes" : "No"}</p>
                </div>
                <div className="rounded-lg bg-surface-container-lowest px-3 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">Average keypoint confidence</p>
                  <p className="mt-1 text-sm font-semibold text-on-surface">{formatNumber(poseQualityAudit.averageKeypointConfidence)}</p>
                </div>
                <div className="rounded-lg bg-surface-container-lowest px-3 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">Reliable keypoint frames</p>
                  <p className="mt-1 text-sm font-semibold text-on-surface">{poseQualityAudit.reliableFramePercentage == null ? "—" : `${poseQualityAudit.reliableFramePercentage.toFixed(1)}%`}</p>
                </div>
                <div className="rounded-lg bg-surface-container-lowest px-3 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">Most common issue</p>
                  <p className="mt-1 text-sm font-semibold text-on-surface">{poseQualityAudit.mostCommonIssue}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-on-surface">
                Try filming closer (10–15 yards away), perpendicular to the route, and make sure your full body is in frame from head to toe.
              </p>
            </div>
          )}

          {result.log_data?.claude_api?.status === "SKIPPED" && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-400 mt-0.5" style={{ fontSize: 20 }}>warning</span>
              <div className="flex-1">
                <p className="text-amber-200 text-xs font-bold uppercase tracking-widest">
                  Coaching feedback skipped
                </p>
                <p className="text-amber-100/80 text-sm leading-relaxed mt-1">
                  {result.log_data.claude_api.skipped_reason ??
                    "Pose confidence was too low to generate reliable coaching feedback."}
                </p>
                <p className="text-amber-100/60 text-xs mt-2">
                  Metric scores below were calculated from low-confidence keypoints and may be unreliable. Re-film with the athlete 10–15 yards away, perpendicular to motion, full body in frame, then re-run.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-white/5 bg-surface-container p-5">
            <h4 className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.4em] text-on-surface-variant">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>sports</span>
              Feedback
            </h4>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface">{result.feedback || "No feedback returned."}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRerun}
              className="flex h-10 items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-high px-6 text-xs font-black uppercase tracking-[0.2em] text-on-surface transition-all duration-150 active:scale-95 hover:bg-surface-container-highest"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
              Re-run with Different Video
            </button>
          </div>
        </div>
      )}

      <AnalysisLog logData={result?.log_data} nodeName={node.name} hasResult={!!result} />
    </div>
  );
}
