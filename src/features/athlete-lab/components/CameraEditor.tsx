import { useState, useMemo } from "react";
import type { KeyMetric, TrainingNode } from "../types";
import { SectionTooltip } from "./SectionTooltip";
import keypointLibrary from "@/constants/keypointLibrary.json";

/* ── Style constants (match NodeEditor) ── */
const INPUT_CLASS = "w-full border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface text-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-container/70 focus:ring-2 focus:ring-primary-container/30 focus:shadow-[0_0_8px_rgba(0,230,57,0.15)] transition-all bg-[#0E1319]";
const LABEL_CLASS = "text-on-surface-variant text-[10px] font-medium uppercase tracking-widest";
const CARD_CLASS = "p-5 rounded-xl border border-outline-variant/20 space-y-3 bg-[#1A2029]";

/* ── Camera settings stored as JSON in camera_guidelines ── */
// Note: legacy `auto_reject_*` flags were removed in Group C — they were
// UI-only toggles never consumed by the Edge Function. parseCameraSettings
// silently drops them on next save by spreading DEFAULT_SETTINGS first.
export interface CameraSettings {
  camera_min_fps: number;
  camera_min_resolution: string;
  camera_min_distance: number | null;
  camera_max_distance: number | null;
  camera_filming_instructions: string;
  skill_specific_filming_notes?: string;
}

const DEFAULT_SETTINGS: CameraSettings = {
  camera_min_fps: 30,
  camera_min_resolution: "720p",
  camera_min_distance: null,
  camera_max_distance: null,
  camera_filming_instructions: "",
  skill_specific_filming_notes: "",
};

export function parseCameraSettings(raw: string): CameraSettings {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "camera_min_fps" in parsed) {
      // Pick only known fields — legacy auto_reject_* keys are dropped here.
      return {
        ...DEFAULT_SETTINGS,
        camera_min_fps: parsed.camera_min_fps ?? DEFAULT_SETTINGS.camera_min_fps,
        camera_min_resolution: parsed.camera_min_resolution ?? DEFAULT_SETTINGS.camera_min_resolution,
        camera_min_distance: parsed.camera_min_distance ?? DEFAULT_SETTINGS.camera_min_distance,
        camera_max_distance: parsed.camera_max_distance ?? DEFAULT_SETTINGS.camera_max_distance,
        camera_filming_instructions: parsed.camera_filming_instructions ?? DEFAULT_SETTINGS.camera_filming_instructions,
        skill_specific_filming_notes: parsed.skill_specific_filming_notes ?? DEFAULT_SETTINGS.skill_specific_filming_notes,
      };
    }
  } catch { /* not JSON, legacy text */ }
  return { ...DEFAULT_SETTINGS };
}

export function serializeCameraSettings(s: CameraSettings): string {
  return JSON.stringify(s);
}

/* ── Body part grouping from keypoint indices ── */
interface BodyPartGroup {
  label: string;
  humanLabel: string;
  indexRange: [number, number];
  requiresModel?: string;
}

// MediaPipe Pose 33-landmark index map. All ranges below match MediaPipe's
// canonical landmark ordering (face cluster 0–10, upper body 11–22, lower
// body 23–32). All landmarks come from a single MediaPipe Pose model, so
// `requiresModel` is no longer used by any group; it remains on the
// interface for forward compatibility (e.g. layering MediaPipe HandLandmarker
// for precise finger tracking in a future version).
const BODY_PART_GROUPS: BodyPartGroup[] = [
  { label: "Face", humanLabel: "Head must be clearly visible and facing camera", indexRange: [0, 10] },
  { label: "Shoulders", humanLabel: "Both shoulders visible", indexRange: [11, 12] },
  { label: "Elbows", humanLabel: "Both elbows clearly visible", indexRange: [13, 14] },
  { label: "Wrists", humanLabel: "Both wrists clearly visible at catch point", indexRange: [15, 16] },
  { label: "Hands (approximation)", humanLabel: "Pinky / index / thumb landmarks from MediaPipe Pose. Approximation only — for precise finger tracking, future versions can layer in MediaPipe HandLandmarker.", indexRange: [17, 22] },
  { label: "Hips", humanLabel: "Full hip width visible", indexRange: [23, 24] },
  { label: "Knees", humanLabel: "Both knees clearly visible", indexRange: [25, 26] },
  { label: "Ankles", humanLabel: "Both ankles clearly visible", indexRange: [27, 28] },
  { label: "Feet (heel + toe)", humanLabel: "Plant foot heel and toe clearly visible — required for break-foot timing and stance width", indexRange: [29, 32] },
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
            <SectionTooltip tip="Minimum source video resolution. The pose engine downsamples frames to roughly 384×288 — source footage below 720p provides insufficient detail for reliable keypoint extraction, especially for hand and foot keypoints." />
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

      {/* ── SECTION 3: ATHLETE FILMING INSTRUCTIONS ── */}
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
