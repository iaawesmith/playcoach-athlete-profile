import { useState, useMemo } from "react";
import type { KeyMetric, TrainingNode } from "../types";
import { SectionTooltip } from "./SectionTooltip";
import keypointLibrary from "@/constants/keypointLibrary.json";

/* ── Style constants (match NodeEditor) ── */
const INPUT_CLASS = "w-full border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface text-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-container/70 focus:ring-2 focus:ring-primary-container/30 focus:shadow-[0_0_8px_rgba(0,230,57,0.15)] transition-all bg-[#0E1319]";
const LABEL_CLASS = "text-on-surface-variant text-[10px] font-medium uppercase tracking-widest";
const CARD_CLASS = "p-5 rounded-xl border border-outline-variant/20 space-y-3 bg-[#1A2029]";

/* ── Camera settings stored as JSON in camera_guidelines ── */
export interface CameraSettings {
  camera_min_fps: number;
  camera_min_resolution: string;
  camera_min_distance: number | null;
  camera_max_distance: number | null;
  auto_reject_athlete_too_small: boolean;
  auto_reject_athlete_too_small_threshold: number;
  auto_reject_duration_out_of_range: boolean;
  auto_reject_resolution_below_min: boolean;
  auto_reject_keypoint_confidence_low: boolean;
  auto_reject_keypoint_confidence_threshold: number;
  camera_filming_instructions: string;
}

const DEFAULT_SETTINGS: CameraSettings = {
  camera_min_fps: 30,
  camera_min_resolution: "720p",
  camera_min_distance: null,
  camera_max_distance: null,
  auto_reject_athlete_too_small: true,
  auto_reject_athlete_too_small_threshold: 15,
  auto_reject_duration_out_of_range: true,
  auto_reject_resolution_below_min: true,
  auto_reject_keypoint_confidence_low: true,
  auto_reject_keypoint_confidence_threshold: 0.65,
  camera_filming_instructions: "",
};

export function parseCameraSettings(raw: string): CameraSettings {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "camera_min_fps" in parsed) {
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch { /* not JSON, legacy text */ }
  return { ...DEFAULT_SETTINGS };
}

function serializeCameraSettings(s: CameraSettings): string {
  return JSON.stringify(s);
}

/* ── Body part grouping from keypoint indices ── */
interface BodyPartGroup {
  label: string;
  humanLabel: string;
  indexRange: [number, number];
  requiresModel?: string;
}

const BODY_PART_GROUPS: BodyPartGroup[] = [
  { label: "Head and Face", humanLabel: "Head must be clearly visible and facing camera", indexRange: [0, 4] },
  { label: "Shoulders and Arms", humanLabel: "Full upper body from shoulders to wrists", indexRange: [5, 10] },
  { label: "Hips", humanLabel: "Full hip width visible", indexRange: [11, 12] },
  { label: "Knees", humanLabel: "Both knees clearly visible", indexRange: [13, 14] },
  { label: "Ankles", humanLabel: "Both ankles clearly visible", indexRange: [15, 16] },
  { label: "Feet (Heel/Toe)", humanLabel: "Plant foot and heel clearly visible — requires Body with Feet or Wholebody model", indexRange: [17, 22], requiresModel: "Body with Feet" },
  { label: "Hands", humanLabel: "Both hands clearly visible at catch point — requires Wholebody model", indexRange: [91, 132], requiresModel: "Wholebody" },
];

function getKeypointName(index: number): string {
  const kp = (keypointLibrary.keypoints as Array<{ index: number; name: string }>).find(k => k.index === index);
  return kp ? kp.name : `Keypoint ${index}`;
}

function getRequiredBodyParts(metrics: KeyMetric[]) {
  const result: Array<{
    group: BodyPartGroup;
    indices: number[];
    keypointNames: string[];
    metricNames: string[];
  }> = [];

  for (const grp of BODY_PART_GROUPS) {
    const matchingIndices = new Set<number>();
    const matchingMetrics = new Set<string>();

    for (const m of metrics) {
      const indices = m.keypoint_mapping?.keypoint_indices ?? [];
      for (const idx of indices) {
        if (idx >= grp.indexRange[0] && idx <= grp.indexRange[1]) {
          matchingIndices.add(idx);
          matchingMetrics.add(m.name || "Untitled");
        }
      }
    }

    if (matchingIndices.size > 0) {
      const sortedIndices = Array.from(matchingIndices).sort((a, b) => a - b);
      result.push({
        group: grp,
        indices: sortedIndices,
        keypointNames: sortedIndices.map(i => getKeypointName(i)),
        metricNames: Array.from(matchingMetrics),
      });
    }
  }

  return result;
}

/* ── FPS / Resolution helpers ── */
const FPS_OPTIONS = [
  { value: 24, label: "24 fps — Not recommended" },
  { value: 30, label: "30 fps — Minimum required" },
  { value: 60, label: "60 fps — Recommended for precision" },
  { value: 120, label: "120 fps — High speed (slow motion)" },
];

const FPS_HELPER: Record<number, { text: string; color: string }> = {
  24: { text: "Below minimum — Velocity and Acceleration metrics will have reduced accuracy", color: "text-amber-400" },
  30: { text: "Minimum for reliable analysis", color: "text-on-surface-variant/60" },
  60: { text: "Recommended — captures the break moment with 2x frame resolution", color: "text-primary-container" },
  120: { text: "High precision — ideal for plant foot and timing metrics", color: "text-primary-container" },
};

const RES_OPTIONS = [
  { value: "480p", label: "480p — Not recommended" },
  { value: "720p", label: "720p — Minimum required" },
  { value: "1080p", label: "1080p — Recommended" },
  { value: "4K", label: "4K — Maximum quality" },
];

const RES_HELPER: Record<string, { text: string; color: string }> = {
  "480p": { text: "Below minimum — hand and foot keypoints will be unreliable at this resolution", color: "text-amber-400" },
  "720p": { text: "Minimum for reliable keypoint detection", color: "text-on-surface-variant/60" },
  "1080p": { text: "Recommended — optimal detail for all keypoint groups", color: "text-primary-container" },
  "4K": { text: "Highest quality — automatically downsampled to 1080p for processing", color: "text-on-surface-variant/60" },
};

/* ── Section Divider ── */
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-on-surface font-black uppercase tracking-tighter text-sm">{label}</span>
      <div className="flex-1 h-px bg-outline-variant/20" />
    </div>
  );
}

/* ── Main Component ── */
interface CameraEditorProps {
  node: TrainingNode;
  value: string;
  onChange: (v: string) => void;
}

export function CameraEditor({ node, value, onChange }: CameraEditorProps) {
  const [settings, setSettings] = useState<CameraSettings>(() => parseCameraSettings(value));

  const updateField = <K extends keyof CameraSettings>(key: K, val: CameraSettings[K]) => {
    const next = { ...settings, [key]: val };
    setSettings(next);
    onChange(serializeCameraSettings(next));
  };

  const requiredBodyParts = useMemo(() => getRequiredBodyParts(node.key_metrics ?? []), [node.key_metrics]);

  const distanceError = settings.camera_min_distance != null && settings.camera_max_distance != null && settings.camera_min_distance >= settings.camera_max_distance;

  return (
    <div className="space-y-6">

      {/* ── SECTION 1: FILMING REQUIREMENTS ── */}
      <SectionDivider label="Filming Requirements" />

      <div className={CARD_CLASS}>
        {/* FPS */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <label className={LABEL_CLASS}>Minimum FPS</label>
            <SectionTooltip tip="Minimum frames per second required for accurate metric calculations. Velocity and Acceleration metrics lose precision below 30fps. 60fps is strongly recommended for break angle and plant foot metrics where the critical moment spans only 3-5 frames." />
          </div>
          <select
            className={`${INPUT_CLASS} max-w-xs`}
            value={settings.camera_min_fps}
            onChange={(e) => updateField("camera_min_fps", parseInt(e.target.value, 10))}
          >
            {FPS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {FPS_HELPER[settings.camera_min_fps] && (
            <p className={`text-[10px] mt-1.5 ${FPS_HELPER[settings.camera_min_fps].color}`}>
              {FPS_HELPER[settings.camera_min_fps].text}
            </p>
          )}
        </div>

        {/* Resolution */}
        <div className="pt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <label className={LABEL_CLASS}>Minimum Resolution</label>
            <SectionTooltip tip="Minimum source video resolution. rtmlib model input is 384x288 — source footage below 720p provides insufficient detail for reliable keypoint extraction, especially for hand and foot keypoints." />
          </div>
          <select
            className={`${INPUT_CLASS} max-w-xs`}
            value={settings.camera_min_resolution}
            onChange={(e) => updateField("camera_min_resolution", e.target.value)}
          >
            {RES_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {RES_HELPER[settings.camera_min_resolution] && (
            <p className={`text-[10px] mt-1.5 ${RES_HELPER[settings.camera_min_resolution].color}`}>
              {RES_HELPER[settings.camera_min_resolution].text}
            </p>
          )}
        </div>

        {/* Distance */}
        <div className="pt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <label className={LABEL_CLASS}>Recommended Distance</label>
            <SectionTooltip tip="How far the camera should be positioned from the athlete. Too close and full body parts leave the frame. Too far and the athlete occupies less than 15% of the frame — triggering auto-rejection." />
          </div>
          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-on-surface-variant text-[10px] uppercase tracking-widest font-medium">Min</span>
              <input
                type="number"
                step="1"
                min="0"
                className={`${INPUT_CLASS} !w-24`}
                value={settings.camera_min_distance ?? ""}
                onChange={(e) => updateField("camera_min_distance", e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="e.g. 10"
              />
              <span className="text-on-surface-variant/60 text-xs">yards</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-on-surface-variant text-[10px] uppercase tracking-widest font-medium">Max</span>
              <input
                type="number"
                step="1"
                min="0"
                className={`${INPUT_CLASS} !w-24`}
                value={settings.camera_max_distance ?? ""}
                onChange={(e) => updateField("camera_max_distance", e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="e.g. 20"
              />
              <span className="text-on-surface-variant/60 text-xs">yards</span>
            </div>
          </div>
          {distanceError && (
            <p className="text-red-400 text-[10px] mt-1.5">Min distance must be less than max distance.</p>
          )}
          <p className="text-on-surface-variant/60 text-[10px] mt-1.5">
            Athlete should occupy 20-60% of the frame height. For route running nodes, 10-20 yards sideline distance captures the full stem and break.
          </p>
        </div>
      </div>

      {/* ── SECTION 2: REQUIRED VISIBLE BODY PARTS ── */}
      <SectionDivider label="Required Visible Body Parts" />

      <div className={CARD_CLASS}>
        <p className="text-on-surface-variant text-xs leading-relaxed">
          Auto-derived from your Metrics tab keypoint mappings. These body parts must be clearly visible throughout the clip for accurate analysis.
        </p>

        {requiredBodyParts.length === 0 ? (
          <div className="flex items-center gap-3 py-4">
            <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 28 }}>skeleton</span>
            <p className="text-on-surface-variant/60 text-sm">Configure metrics in the Metrics tab to see required body part requirements.</p>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {requiredBodyParts.map((bp) => (
              <div key={bp.group.label} className="flex items-start gap-2.5">
                <span className="text-primary-container mt-0.5 text-sm">✓</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-on-surface text-sm font-semibold">{bp.group.label}</span>
                    <span className="text-on-surface-variant/50 text-[10px]">
                      (indices {bp.indices.length === 1 ? bp.indices[0] : `${bp.indices[0]}-${bp.indices[bp.indices.length - 1]}`})
                    </span>
                  </div>
                  <p className="text-on-surface-variant text-xs mt-0.5">
                    {bp.keypointNames.join(", ")}
                  </p>
                  <p className="text-on-surface-variant/60 text-[10px] mt-0.5">
                    Required for: {bp.metricNames.join(", ")}
                  </p>
                  {bp.group.requiresModel && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-amber-400 text-xs">⚠</span>
                      <span className="text-amber-400 text-[10px]">Requires {bp.group.requiresModel} solution class</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SECTION 3: AUTO-REJECT CONDITIONS ── */}
      <SectionDivider label="Auto-Reject Conditions" />

      <div className={CARD_CLASS}>
        <p className="text-on-surface-variant text-xs leading-relaxed mb-2">
          Rules enforced by the Edge Function before sending to Cloud Run. Videos failing these conditions are rejected and the athlete is asked to refilm with specific guidance.
        </p>

        {/* Row 1: Athlete too small */}
        <AutoRejectRow
          label="Athlete Too Small in Frame"
          tooltip="Below 15%, foot and hand keypoints return near-zero confidence. The analysis would produce meaningless scores. Recommended: 15-20%."
          enabled={settings.auto_reject_athlete_too_small}
          onToggle={(v) => updateField("auto_reject_athlete_too_small", v)}
        >
          <div className="flex items-center gap-2 mt-2">
            <span className="text-on-surface-variant text-xs">Reject if athlete occupies less than</span>
            <input
              type="number"
              step="1"
              min="5"
              max="50"
              className={`${INPUT_CLASS} !w-16 !py-1.5 !px-2 text-center`}
              value={settings.auto_reject_athlete_too_small_threshold}
              onChange={(e) => updateField("auto_reject_athlete_too_small_threshold", parseInt(e.target.value, 10) || 15)}
              disabled={!settings.auto_reject_athlete_too_small}
            />
            <span className="text-on-surface-variant text-xs">% of frame height</span>
          </div>
        </AutoRejectRow>

        {/* Row 2: Duration out of range */}
        <AutoRejectRow
          label="Video Duration Out of Range"
          tooltip="Automatically reads from Basics tab settings. Configure clip duration bounds there."
          enabled={settings.auto_reject_duration_out_of_range}
          onToggle={(v) => updateField("auto_reject_duration_out_of_range", v)}
        >
          <p className="text-on-surface-variant/60 text-xs mt-1">
            Currently: {node.clip_duration_min}s — {node.clip_duration_max}s
          </p>
        </AutoRejectRow>

        {/* Row 3: Resolution below minimum */}
        <AutoRejectRow
          label="Resolution Below Minimum"
          tooltip="Automatically reads from Minimum Resolution setting above."
          enabled={settings.auto_reject_resolution_below_min}
          onToggle={(v) => updateField("auto_reject_resolution_below_min", v)}
        >
          <p className="text-on-surface-variant/60 text-xs mt-1">
            Currently: below {settings.camera_min_resolution} rejected
          </p>
        </AutoRejectRow>

        {/* Row 4: Keypoint confidence too low */}
        <AutoRejectRow
          label="Keypoint Confidence Too Low"
          tooltip="Catches videos where the athlete is partially out of frame or occluded before the metric-level confidence thresholds even fire. Set lower than your lowest per-metric confidence threshold."
          enabled={settings.auto_reject_keypoint_confidence_low}
          onToggle={(v) => updateField("auto_reject_keypoint_confidence_low", v)}
        >
          <div className="flex items-center gap-2 mt-2">
            <span className="text-on-surface-variant text-xs">Reject if average confidence below</span>
            <input
              type="number"
              step="0.01"
              min="0.40"
              max="0.80"
              className={`${INPUT_CLASS} !w-20 !py-1.5 !px-2 text-center`}
              value={settings.auto_reject_keypoint_confidence_threshold}
              onChange={(e) => updateField("auto_reject_keypoint_confidence_threshold", parseFloat(e.target.value) || 0.65)}
              disabled={!settings.auto_reject_keypoint_confidence_low}
            />
          </div>
        </AutoRejectRow>
      </div>

      {/* ── SECTION 4: ATHLETE FILMING INSTRUCTIONS ── */}
      <SectionDivider label="Athlete Filming Instructions" />

      <div className={CARD_CLASS}>
        <div className="flex items-center gap-1.5 mb-2">
          <label className={LABEL_CLASS}>Filming Instructions</label>
          <SectionTooltip tip="Shown to athletes in the upload flow before they film. Clear instructions directly improve video quality and reduce rejected uploads. Be specific about distance, angle, and body part visibility." />
        </div>
        <textarea
          className={`${INPUT_CLASS} min-h-[140px] resize-y`}
          value={settings.camera_filming_instructions}
          onChange={(e) => updateField("camera_filming_instructions", e.target.value)}
          placeholder={`e.g.\n- Stand 12-18 yards away on the sideline\n- Film at waist height, not above your head\n- Make sure your full body is visible from head to foot throughout the rep\n- Your plant foot must be clearly visible at the moment of your break\n- Film in good lighting — avoid filming into the sun`}
        />
      </div>
    </div>
  );
}

/* ── Auto-Reject Row ── */
function AutoRejectRow({ label, tooltip, enabled, onToggle, children }: {
  label: string;
  tooltip: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="py-3 border-b border-outline-variant/10 last:border-b-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-on-surface text-sm font-semibold uppercase tracking-wide">{label}</span>
          <SectionTooltip tip={tooltip} />
        </div>
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? "bg-primary-container" : "bg-outline-variant/30"}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-surface transition-transform ${enabled ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
      {children}
    </div>
  );
}

/* ── Completeness checks for Camera tab ── */
export function checkCameraCompleteness(node: TrainingNode): Array<{ label: string; detail: string }> {
  const issues: Array<{ label: string; detail: string }> = [];
  const settings = parseCameraSettings(node.camera_guidelines);

  if (!settings.camera_min_fps) {
    issues.push({ label: "Camera", detail: "Minimum FPS not configured" });
  }
  if (!settings.camera_min_resolution) {
    issues.push({ label: "Camera", detail: "Minimum resolution not configured" });
  }
  if (settings.camera_min_distance == null || settings.camera_max_distance == null) {
    issues.push({ label: "Camera", detail: "Recommended distance not set" });
  } else if (settings.camera_min_distance >= settings.camera_max_distance) {
    issues.push({ label: "Camera", detail: "Min distance must be less than max distance" });
  }

  return issues;
}
