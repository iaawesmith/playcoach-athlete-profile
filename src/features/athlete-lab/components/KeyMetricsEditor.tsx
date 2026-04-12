import { useState, useMemo } from "react";
import type { KeyMetric, KeypointMapping, CalculationType, BilateralMode, PhaseNote } from "../types";
import { SectionTooltip } from "./SectionTooltip";
import keypointLibrary from "@/constants/keypointLibrary.json";

const INPUT_CLASS = "w-full border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface text-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-container/70 focus:ring-2 focus:ring-primary-container/30 focus:shadow-[0_0_8px_rgba(0,230,57,0.15)] transition-all bg-[#0E1319] [&_option]:bg-surface-container [&_option]:text-on-surface [&_option:checked]:bg-primary-container/20";
const LABEL_CLASS = "text-on-surface-variant text-[10px] font-medium uppercase tracking-widest";
const CARD_CLASS = "p-5 rounded-xl border border-outline-variant/20 space-y-3 bg-[#1A2029]";

type ConfirmDeleteFn = (opts: { title: string; body: string; confirmLabel: string; onConfirm: () => void }) => void;

const TOOLTIPS = {
  name: "The athlete-facing label for this measurement. Appears in results ('Your Break Angle score was 84/100') and in AI coaching feedback. Keep it under 4 words — specific and sport-accurate.",
  unit: "The unit displayed alongside measured values. Must match the Calculation Type in Keypoint Mapping: Angle → degrees, Distance → yards, Velocity → mph, Acceleration → mph/s, Frame Delta → frames.",
  description: "Passed to the AI as context when generating athlete feedback. Explain what this measurement represents on the field, what good looks like, and what goes wrong when it is done incorrectly. Include the elite target value and why it matters. Aim for 2-3 sentences.",
  eliteTarget: "The benchmark value representing elite-level performance. Every athlete result is scored as a deviation from this number. Base this on actual measurement of elite footage — not assumption. This is the most important number in the metric card.",
  weight: "How much this metric contributes to the overall Mastery Score. All metric weights in the node must sum to exactly 100. Higher weight = greater influence on the final score. Never assign less than 5% or more than 30% to a single metric.",
  tolerance: "The acceptable deviation from the Elite Target before scoring penalties apply. A value within tolerance scores at or near 100. Accounts for natural movement variance and measurement noise. Recommended ranges: Angle ±2-5°, Distance ±0.3-0.7 yards, Velocity ±1-2 mph, Frame Delta ±1-2 frames.",
  temporalWindow: "Number of consecutive frames this metric is evaluated across. Window of 1 = single snapshot (correct for Angle and Distance). Velocity requires minimum 3. Acceleration requires minimum 5. Frame Delta requires minimum 10. Setting this too low for velocity-based metrics returns null.",
  dependsOn: "Optional. Select another metric that must succeed before this one is evaluated. If the upstream metric is flagged as low confidence or skipped, this metric is automatically skipped too. Example: Post-Catch YAC Burst depends on Catch Efficiency — acceleration after the catch only matters if the catch was confirmed.",
  keypointMapping: "Defines which body landmarks rtmlib extracts from each video frame and what calculation to apply. The analysis pipeline reads these settings directly — a metric with no keypoint mapping cannot be scored.",
  bodyGroup: "Filter keypoints by body region. BODY is available on all models. FEET requires Body_with_feet or Wholebody. HANDS and FACE require Wholebody only.",
  selectKeypoints: "Select the body landmarks for this metric. For Angle: select exactly 3 in order — first endpoint, vertex joint, second endpoint. Distance and Frame Delta: exactly 2. Velocity and Acceleration: 1 or 2.",
  calculationType: "The mathematical operation applied to the selected keypoints. Angle measures degrees at the vertex keypoint. Distance measures space between 2 points (requires Reference tab calibration for pixel-to-yard conversion). Velocity measures movement speed. Acceleration measures rate of speed change. Frame Delta counts frames between two body position events.",
  bilateral: "Routes break in either direction. Auto-detect uses rtmlib confidence scores to determine the active plant side per frame — recommended for all route metrics. Use Left or Right only for drills where direction is fixed.",
  confidenceThreshold: "rtmlib returns a confidence score 0-1 per keypoint. If any keypoint falls below this threshold the metric is flagged and excluded from scoring. Default 0.70 works for most metrics. Increase to 0.80 for high-weight metrics. Never set below 0.50.",
  phase: "Assigns this metric to a movement phase. The pipeline only evaluates this metric within the frame window belonging to the selected phase. Assigning the wrong phase produces scores calculated on the wrong frames.",
  keypointIndices: "Raw index numbers passed to the rtmlib pipeline. Auto-populated from your keypoint selection above. Verify these match your intended keypoints before going Live.",
  quickSelect: "Common football metric presets. Clicking a preset auto-populates the keypoint selector and calculation type. You can modify the selection after loading a preset.",
};

const CALC_OPTIONS: { value: CalculationType; label: string; desc: string }[] = [
  { value: "angle", label: "ANGLE", desc: "Degrees at vertex keypoint. Requires 3 keypoints: endpoint → vertex → endpoint." },
  { value: "distance", label: "DISTANCE", desc: "Straight-line distance between 2 keypoints. Requires Reference tab scale calibration for yard conversion." },
  { value: "velocity", label: "VELOCITY", desc: "Speed of keypoint movement. Temporal Window minimum: 3 frames." },
  { value: "acceleration", label: "ACCELERATION", desc: "Rate of velocity change. Temporal Window minimum: 5 frames." },
  { value: "frame_delta", label: "FRAME DELTA", desc: "Frames between two body position events. Temporal Window minimum: 10 frames." },
];

const BILATERAL_OPTIONS: { value: BilateralMode; label: string }[] = [
  { value: "auto", label: "Auto-detect (recommended)" },
  { value: "left", label: "Left side only" },
  { value: "right", label: "Right side only" },
];

const GROUP_NAMES: Record<string, string> = { body: "BODY", feet: "FEET", hands: "HANDS", face: "FACE" };
const ALL_GROUPS = ["body", "feet", "hands", "face"];

function getDefaultMapping(): KeypointMapping {
  return {
    body_groups: ["body"],
    keypoint_indices: [],
    calculation_type: null,
    bilateral: "auto",
    confidence_threshold: 0.70,
    phase_id: null,
  };
}

function isKeypointMappingConfigured(km: KeypointMapping | null | undefined): boolean {
  if (!km) return false;
  return !!(km.calculation_type && km.keypoint_indices.length > 0 && km.phase_id);
}

function getKeypointValidation(calcType: CalculationType | null, count: number): { valid: boolean; message: string } {
  if (!calcType) return { valid: false, message: "Select a Calculation Type to validate" };
  switch (calcType) {
    case "angle":
      return count === 3
        ? { valid: true, message: "✓ Valid for Angle" }
        : { valid: false, message: `⚠ Angle requires exactly 3 keypoints (${count} selected)` };
    case "distance":
    case "frame_delta":
      return count === 2
        ? { valid: true, message: `✓ Valid for ${calcType === "distance" ? "Distance" : "Frame Delta"}` }
        : { valid: false, message: `⚠ ${calcType === "distance" ? "Distance" : "Frame Delta"} requires exactly 2 keypoints (${count} selected)` };
    case "velocity":
    case "acceleration":
      return count >= 1 && count <= 2
        ? { valid: true, message: `✓ Valid for ${calcType === "velocity" ? "Velocity" : "Acceleration"}` }
        : { valid: false, message: `⚠ ${calcType === "velocity" ? "Velocity" : "Acceleration"} requires 1 or 2 keypoints (${count} selected)` };
  }
}

function getTemporalWarning(calcType: CalculationType | null, window: number): string | null {
  if (!calcType) return null;
  if (calcType === "velocity" && window < 3) return "Velocity requires minimum 3 frames";
  if (calcType === "acceleration" && window < 5) return "Acceleration requires minimum 5 frames";
  if (calcType === "frame_delta" && window < 10) return "Frame Delta requires minimum 10 frames";
  return null;
}

interface KeyMetricsEditorProps {
  metrics: KeyMetric[];
  onChange: (m: KeyMetric[]) => void;
  onConfirmDelete: ConfirmDeleteFn;
  phases: PhaseNote[];
}

export function KeyMetricsEditor({ metrics, onChange, onConfirmDelete, phases }: KeyMetricsEditorProps) {
  const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const defaultMetric: KeyMetric = { name: "", description: "", eliteTarget: "", unit: "", weight: 0, tolerance: null, temporal_window: 1, depends_on_metric_id: null, keypoint_mapping: null };
  const [draft, setDraft] = useState<KeyMetric>(defaultMetric);
  const [editDraft, setEditDraft] = useState<KeyMetric>(defaultMetric);

  const startEdit = (i: number) => {
    setEditIdx(i);
    setEditDraft({ ...metrics[i] });
    setAdding(false);
  };

  const saveEdit = (i: number) => {
    const n = [...metrics];
    n[i] = editDraft;
    onChange(n);
    setEditIdx(null);
  };

  const handleAdd = () => {
    onChange([...metrics, draft]);
    setDraft({ ...defaultMetric });
    setAdding(false);
  };

  const renderFields = (m: KeyMetric, setM: (v: KeyMetric) => void, allMetrics: KeyMetric[], selfIdx: number | null) => (
    <MetricFields m={m} setM={setM} allMetrics={allMetrics} selfIdx={selfIdx} phases={phases} />
  );

  const totalClass = totalWeight === 100
    ? "text-primary-container"
    : totalWeight > 100
      ? "text-amber-400"
      : "text-on-surface-variant/60";

  const totalText = totalWeight === 100
    ? "Total: 100% ✓"
    : totalWeight > 100
      ? `Total: ${totalWeight}% — over by ${totalWeight - 100}%`
      : `Total: ${totalWeight}% — ${100 - totalWeight}% remaining`;

  return (
    <div className="space-y-4">
      <div className={`text-xs font-semibold ${totalClass}`} style={totalWeight === 100 ? { textShadow: '0 0 8px rgba(0,230,57,0.4)' } : undefined}>
        {totalText}
      </div>
      <div className="space-y-2">
        {metrics.map((m, i) => {
          const mappingOk = isKeypointMappingConfigured(m.keypoint_mapping);
          return (
            <div key={i} className={CARD_CLASS}>
              {editIdx === i ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface text-xs font-bold">Metric {i + 1}</span>
                  </div>
                  {renderFields(editDraft, setEditDraft, metrics, i)}
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => saveEdit(i)} className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">Save</button>
                    <button onClick={() => setEditIdx(null)} className="px-4 py-2 rounded-lg text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors" style={{ backgroundColor: '#1A2029' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 group">
                  <span className="text-on-surface-variant/30 text-[10px] font-mono font-semibold w-4 text-center shrink-0">{i + 1}</span>
                  <p className="text-on-surface text-sm font-semibold truncate flex-1 min-w-0">{m.name || "Untitled Metric"}</p>
                  <span className="text-on-surface-variant/40 text-[10px] font-medium shrink-0">{m.unit}</span>
                  <span className="text-on-surface-variant/40 text-[10px] font-medium shrink-0">{m.eliteTarget}</span>
                  <span className="text-on-surface-variant/40 text-[10px] font-medium shrink-0">{m.weight}%</span>
                  {mappingOk ? (
                    <span className="text-primary-container/60 text-[10px] font-medium shrink-0 flex items-center gap-0.5">
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check_circle</span>
                      mapping
                    </span>
                  ) : (
                    <span className="text-amber-400/70 text-[10px] font-medium shrink-0 flex items-center gap-0.5">
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>warning</span>
                      mapping
                    </span>
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => startEdit(i)} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary-container transition-colors" style={{ backgroundColor: '#111720' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                    </button>
                    <button onClick={() => onConfirmDelete({ title: "Delete Metric?", body: `Deleting Metric ${i + 1}${m.name ? ` (${m.name})` : ""} will remove it from the scoring pipeline. This cannot be undone.`, confirmLabel: "Delete Metric", onConfirm: () => { onChange(metrics.filter((_, j) => j !== i)); setEditIdx(null); } })} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-red-400 transition-colors" style={{ backgroundColor: '#111720' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className={CARD_CLASS + " border-primary-container/20"}>
          <p className="text-on-surface text-xs font-bold uppercase tracking-widest">Add Metric</p>
          {renderFields(draft, setDraft, metrics, null)}
          <div className="flex gap-2 pt-2">
            <button onClick={handleAdd} className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">Add</button>
            <button onClick={() => { setAdding(false); setDraft({ ...defaultMetric }); }} className="px-4 py-2 rounded-lg text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors" style={{ backgroundColor: '#1A2029' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setEditIdx(null); }} className="w-full py-3 rounded-xl border border-dashed border-outline-variant/20 text-primary-container text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:border-primary-container/40 transition-all" style={{ backgroundColor: '#131920' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span> Add Metric
        </button>
      )}
    </div>
  );
}

/* ── Metric Fields (expanded edit state) ── */
function MetricFields({ m, setM, allMetrics, selfIdx, phases }: {
  m: KeyMetric;
  setM: (v: KeyMetric) => void;
  allMetrics: KeyMetric[];
  selfIdx: number | null;
  phases: PhaseNote[];
}) {
  const [mappingOpen, setMappingOpen] = useState(false);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const km = m.keypoint_mapping ?? getDefaultMapping();
  const setKm = (newKm: KeypointMapping) => setM({ ...m, keypoint_mapping: newKm });

  const temporalWarning = getTemporalWarning(km.calculation_type, m.temporal_window ?? 1);
  const otherMetrics = allMetrics.filter((_, i) => i !== selfIdx);

  const mappingConfigured = isKeypointMappingConfigured(m.keypoint_mapping);

  return (
    <div className="space-y-3 pt-3">
      {/* Name + Unit row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className={LABEL_CLASS}>Name</span>
            <SectionTooltip tip={TOOLTIPS.name} />
          </div>
          <input className={INPUT_CLASS} value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} placeholder="e.g. Separation Distance" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className={LABEL_CLASS}>Unit</span>
            <SectionTooltip tip={TOOLTIPS.unit} />
          </div>
          <div className="relative">
            <input
              className={INPUT_CLASS}
              value={m.unit}
              onChange={(e) => setM({ ...m, unit: e.target.value })}
              placeholder="e.g. yards"
              onFocus={() => setUnitDropdownOpen(true)}
              onBlur={() => setTimeout(() => setUnitDropdownOpen(false), 150)}
            />
            {unitDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full rounded-xl border border-white/10 bg-surface-container shadow-[0_20px_50px_rgba(0,0,0,0.5)] py-1 max-h-[220px] overflow-y-auto">
                {["degrees", "yards", "mph", "mph/s", "frames", "%", "feet", "seconds"].map((u) => (
                  <button
                    key={u}
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-sm text-on-surface hover:bg-primary-container/20 hover:text-primary transition-colors"
                    onMouseDown={(e) => { e.preventDefault(); setM({ ...m, unit: u }); setUnitDropdownOpen(false); }}
                  >
                    {u}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className={LABEL_CLASS}>Description</span>
          <SectionTooltip tip={TOOLTIPS.description} />
        </div>
        <textarea className={`${INPUT_CLASS} min-h-[60px] resize-y`} value={m.description} onChange={(e) => setM({ ...m, description: e.target.value })} placeholder="e.g. Distance between receiver and nearest defender at catch point" />
      </div>

      {/* Elite Target + Tolerance + Weight row */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className={LABEL_CLASS}>Elite Target</span>
            <SectionTooltip tip={TOOLTIPS.eliteTarget} />
          </div>
          <input className={INPUT_CLASS} value={m.eliteTarget} onChange={(e) => setM({ ...m, eliteTarget: e.target.value })} placeholder="e.g. 3.5+" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className={LABEL_CLASS}>Tolerance</span>
            <SectionTooltip tip={TOOLTIPS.tolerance} />
          </div>
          <input type="number" min={0} step="any" className={INPUT_CLASS} value={m.tolerance ?? ""} onChange={(e) => setM({ ...m, tolerance: e.target.value === "" ? null : Number(e.target.value) })} placeholder="e.g. 3" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className={LABEL_CLASS}>Weight (%)</span>
            <SectionTooltip tip={TOOLTIPS.weight} />
          </div>
          <input type="number" className={INPUT_CLASS} value={m.weight} onChange={(e) => setM({ ...m, weight: Number(e.target.value) })} placeholder="e.g. 25" />
        </div>
      </div>

      {/* Temporal Window */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className={LABEL_CLASS}>Temporal Window</span>
          <SectionTooltip tip={TOOLTIPS.temporalWindow} />
        </div>
        <input type="number" min={1} step={1} className={INPUT_CLASS + " max-w-[200px]"} value={m.temporal_window ?? 1} onChange={(e) => setM({ ...m, temporal_window: Math.max(1, Math.round(Number(e.target.value))) })} placeholder="1" />
        {temporalWarning && (
          <p className="text-amber-400 text-xs mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
            {temporalWarning}
          </p>
        )}
      </div>

      {/* Depends On */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className={LABEL_CLASS}>Depends On</span>
          <SectionTooltip tip={TOOLTIPS.dependsOn} />
        </div>
        <select
          className={INPUT_CLASS + " max-w-[320px]"}
          value={m.depends_on_metric_id ?? ""}
          onChange={(e) => setM({ ...m, depends_on_metric_id: e.target.value || null })}
        >
          <option value="">None (no dependency)</option>
          {otherMetrics.map((om, oi) => (
            <option key={oi} value={om.name}>{om.name || `Metric ${oi + 1}`}</option>
          ))}
        </select>
      </div>

      {/* Keypoint Mapping collapsible */}
      <div className="border-t border-white/[0.08] pt-3 mt-3">
        <button
          type="button"
          onClick={() => {
            if (!mappingOpen && !m.keypoint_mapping) {
              setM({ ...m, keypoint_mapping: getDefaultMapping() });
            }
            setMappingOpen(!mappingOpen);
          }}
          className="w-full flex items-center gap-2 py-2 text-left"
        >
          {mappingConfigured ? (
            <span className="text-primary-container/70 text-xs flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
              <span className="font-semibold uppercase tracking-widest">
                {km.calculation_type ? CALC_OPTIONS.find(c => c.value === km.calculation_type)?.label : ""} · Phase: {phases.find(p => p.id === km.phase_id)?.phase || "—"} · Keypoints: [{km.keypoint_indices.join(", ")}]
              </span>
            </span>
          ) : (
            <span className="text-amber-400/80 text-xs flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
              <span className="font-semibold uppercase tracking-widest">Keypoint Mapping — not configured</span>
            </span>
          )}
          <span className="ml-auto material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 16 }}>
            {mappingOpen ? "expand_less" : "expand_more"}
          </span>
          <SectionTooltip tip={TOOLTIPS.keypointMapping} />
        </button>

        <div className={`overflow-hidden transition-all duration-200 ease-in-out ${mappingOpen ? "max-h-[3000px] opacity-100 mt-3" : "max-h-0 opacity-0"}`}>
          <KeypointMappingPanel km={km} setKm={setKm} phases={phases} metric={m} setMetric={setM} />
        </div>
      </div>
    </div>
  );
}

/* ── Keypoint Mapping Panel ── */

const PRESET_FIELDS: Record<string, { name: string; unit: string }> = {
  "Break Angle (standard)": { name: "Break Angle", unit: "degrees" },
  "Break Angle (precise — heel plant)": { name: "Break Angle", unit: "degrees" },
  "Separation Distance": { name: "Separation Distance", unit: "yards" },
  "Release Speed": { name: "Release Speed", unit: "mph" },
  "Head Snap Timing": { name: "Head Snap Timing", unit: "frames" },
  "Catch Efficiency (wholebody)": { name: "Catch Efficiency", unit: "%" },
};

function KeypointMappingPanel({ km, setKm, phases, metric, setMetric }: {
  km: KeypointMapping;
  setKm: (km: KeypointMapping) => void;
  phases: PhaseNote[];
  metric: KeyMetric;
  setMetric: (v: KeyMetric) => void;
}) {
  const [activeGroupTab, setActiveGroupTab] = useState<string>(km.body_groups[0] || "body");
  const [presetLoaded, setPresetLoaded] = useState<string | null>(null);

  const keypoints = keypointLibrary.keypoints as Array<{
    index: number; name: string; group: string; sub_group: string; side: string; football_use: string | null;
  }>;
  const subGroupOrder = keypointLibrary.sub_group_order as Record<string, string[]>;
  const subGroupDisplayNames = keypointLibrary.sub_group_display_names as Record<string, string>;
  const combinations = keypointLibrary.common_football_combinations as Array<{
    metric: string; keypoints: number[]; names: string[]; calculation: string; notes: string;
  }>;

  const filteredKeypoints = useMemo(() => {
    return keypoints.filter(kp => km.body_groups.includes(kp.group));
  }, [km.body_groups, keypoints]);

  const tabKeypoints = useMemo(() => {
    return keypoints.filter(kp => kp.group === activeGroupTab);
  }, [activeGroupTab, keypoints]);

  const groupedTabKeypoints = useMemo(() => {
    const order = subGroupOrder[activeGroupTab] || [];
    const groups: Record<string, typeof keypoints> = {};
    for (const kp of tabKeypoints) {
      if (!groups[kp.sub_group]) groups[kp.sub_group] = [];
      groups[kp.sub_group].push(kp);
    }
    return order.map(sg => ({ subGroup: sg, displayName: subGroupDisplayNames[sg] || sg, keypoints: groups[sg] || [] })).filter(g => g.keypoints.length > 0);
  }, [tabKeypoints, activeGroupTab, subGroupOrder, subGroupDisplayNames]);

  const toggleGroup = (g: string) => {
    const newGroups = km.body_groups.includes(g)
      ? km.body_groups.filter(x => x !== g)
      : [...km.body_groups, g];
    if (newGroups.length === 0) return;
    // Remove keypoints that belong to deselected groups
    const validKeypoints = km.keypoint_indices.filter(idx => {
      const kp = keypoints.find(k => k.index === idx);
      return kp && newGroups.includes(kp.group);
    });
    setKm({ ...km, body_groups: newGroups, keypoint_indices: validKeypoints });
    if (!newGroups.includes(activeGroupTab)) setActiveGroupTab(newGroups[0]);
  };

  const toggleKeypoint = (idx: number) => {
    const newIndices = km.keypoint_indices.includes(idx)
      ? km.keypoint_indices.filter(x => x !== idx)
      : [...km.keypoint_indices, idx];
    setKm({ ...km, keypoint_indices: newIndices });
  };

  const removeKeypoint = (idx: number) => {
    setKm({ ...km, keypoint_indices: km.keypoint_indices.filter(x => x !== idx) });
  };

  const loadPreset = (combo: typeof combinations[0]) => {
    // Determine needed body groups from keypoint indices using both
    // library lookup AND index-range fallback to guarantee correctness
    const neededGroups = new Set<string>();
    for (const idx of combo.keypoints) {
      const kp = keypoints.find(k => k.index === idx);
      if (kp) {
        neededGroups.add(kp.group);
      } else {
        // Fallback: derive group from index range
        if (idx >= 0 && idx <= 16) neededGroups.add("body");
        else if (idx >= 17 && idx <= 22) neededGroups.add("feet");
        else if (idx >= 23 && idx <= 90) neededGroups.add("face");
        else if (idx >= 91 && idx <= 132) neededGroups.add("hands");
      }
    }
    const newGroups = Array.from(new Set([...km.body_groups, ...neededGroups]));
    setKm({
      ...km,
      body_groups: newGroups,
      keypoint_indices: combo.keypoints,
      calculation_type: combo.calculation as CalculationType,
    });
    // Switch active tab to the first newly-added group so user sees the selection
    const firstNewGroup = Array.from(neededGroups).find(g => !km.body_groups.includes(g));
    if (firstNewGroup) setActiveGroupTab(firstNewGroup);

    // Pre-fill name and unit on parent metric if empty
    const presetFields = PRESET_FIELDS[combo.metric];
    if (presetFields) {
      const updates: Partial<KeyMetric> = {};
      if (!metric.name.trim()) updates.name = presetFields.name;
      if (!metric.unit.trim()) updates.unit = presetFields.unit;
      if (Object.keys(updates).length > 0) {
        setMetric({ ...metric, ...updates });
      }
    }

    setPresetLoaded(combo.metric);
    setTimeout(() => setPresetLoaded(null), 4000);
  };

  const validation = getKeypointValidation(km.calculation_type, km.keypoint_indices.length);

  const confidenceColor = km.confidence_threshold >= 0.70
    ? "text-primary-container"
    : km.confidence_threshold >= 0.60
      ? "text-amber-400"
      : "text-red-400";

  return (
    <div className="space-y-4 pl-1">
      {/* Body Group toggles */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className={LABEL_CLASS}>Body Group</span>
          <SectionTooltip tip={TOOLTIPS.bodyGroup} />
        </div>
        <div className="flex gap-2">
          {ALL_GROUPS.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => toggleGroup(g)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                km.body_groups.includes(g)
                  ? "bg-primary-container/20 text-primary-container border border-primary-container/30"
                  : "bg-surface-container text-on-surface-variant/50 border border-outline-variant/20"
              }`}
            >
              {GROUP_NAMES[g]}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Select presets */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className={LABEL_CLASS}>Quick Select</span>
          <SectionTooltip tip={TOOLTIPS.quickSelect} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {combinations.map((combo) => (
            <button
              key={combo.metric}
              type="button"
              onClick={() => loadPreset(combo)}
              className="px-2.5 py-1 rounded-full border border-outline-variant/20 text-on-surface-variant text-[9px] font-semibold uppercase tracking-widest whitespace-nowrap hover:border-primary-container/40 hover:text-primary-container transition-all shrink-0"
              style={{ backgroundColor: '#131920' }}
            >
              {combo.metric}
            </button>
          ))}
        </div>
        {presetLoaded && (
          <p className="text-on-surface-variant/50 text-[10px] mt-1">Preset loaded: {presetLoaded} — name and unit pre-filled. Review all fields before saving.</p>
        )}
      </div>

      {/* Select Keypoints with tabs */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className={LABEL_CLASS}>Select Keypoints</span>
          <SectionTooltip tip={TOOLTIPS.selectKeypoints} />
        </div>
        {/* Group tabs */}
        <div className="flex gap-1 mb-3">
          {km.body_groups.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setActiveGroupTab(g)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
                activeGroupTab === g
                  ? "bg-surface-container-highest text-on-surface"
                  : "text-on-surface-variant/40 hover:text-on-surface-variant"
              }`}
            >
              {GROUP_NAMES[g]}
            </button>
          ))}
        </div>
        {/* Chips by sub_group */}
        <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin">
          {groupedTabKeypoints.map(({ subGroup, displayName, keypoints: sgKps }) => (
            <div key={subGroup}>
              <p className="text-on-surface-variant/40 text-[9px] font-semibold uppercase tracking-widest mb-1.5">{displayName}</p>
              <div className="flex flex-wrap gap-1.5">
                {sgKps.map(kp => {
                  const selected = km.keypoint_indices.includes(kp.index);
                  return (
                    <button
                      key={kp.index}
                      type="button"
                      onClick={() => toggleKeypoint(kp.index)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                        selected
                          ? "bg-primary-container/20 text-primary-container border border-primary-container/30"
                          : "bg-surface-container text-on-surface-variant/60 border border-outline-variant/10 hover:border-outline-variant/30"
                      }`}
                    >
                      {kp.name} ({kp.index})
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Selected summary */}
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <p className="text-on-surface-variant/50 text-[10px] font-semibold uppercase tracking-widest mb-1.5">
            Selected: {km.keypoint_indices.length} keypoints
          </p>
          {km.keypoint_indices.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {km.keypoint_indices.map(idx => {
                const kp = keypoints.find(k => k.index === idx);
                return (
                  <span key={idx} className="px-2 py-0.5 rounded-lg bg-primary-container/10 text-primary-container text-[10px] font-medium flex items-center gap-1 border border-primary-container/20">
                    {kp?.name || idx} ({idx})
                    <button type="button" onClick={() => removeKeypoint(idx)} className="hover:text-red-400 transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: 10 }}>close</span>
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          {/* Validation */}
          <p className={`text-xs mt-2 ${validation.valid ? "text-primary-container/70" : "text-amber-400"}`}>
            {validation.message}
          </p>
        </div>
      </div>

      {/* Calculation Type */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className={LABEL_CLASS}>Calculation Type</span>
          <SectionTooltip tip={TOOLTIPS.calculationType} />
        </div>
        <div className="space-y-1.5">
          {CALC_OPTIONS.map(opt => (
            <label key={opt.value} className="flex items-start gap-2.5 cursor-pointer group">
              <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                km.calculation_type === opt.value ? "border-primary-container" : "border-outline-variant/40"
              }`}>
                {km.calculation_type === opt.value && <div className="w-2 h-2 rounded-full bg-primary-container" />}
              </div>
              <div>
                <span className="text-on-surface text-xs font-bold uppercase tracking-widest">{opt.label}</span>
                <span className="text-on-surface-variant/50 text-[10px] ml-2">{opt.desc}</span>
              </div>
              <input
                type="radio"
                name="calc_type"
                className="hidden"
                checked={km.calculation_type === opt.value}
                onChange={() => setKm({ ...km, calculation_type: opt.value })}
              />
            </label>
          ))}
        </div>
      </div>

      {/* Bilateral */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className={LABEL_CLASS}>Bilateral</span>
          <SectionTooltip tip={TOOLTIPS.bilateral} />
        </div>
        <div className="space-y-1.5">
          {BILATERAL_OPTIONS.map(opt => (
            <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                km.bilateral === opt.value ? "border-primary-container" : "border-outline-variant/40"
              }`}>
                {km.bilateral === opt.value && <div className="w-2 h-2 rounded-full bg-primary-container" />}
              </div>
              <span className="text-on-surface text-xs">{opt.label}</span>
              <input
                type="radio"
                name="bilateral"
                className="hidden"
                checked={km.bilateral === opt.value}
                onChange={() => setKm({ ...km, bilateral: opt.value })}
              />
            </label>
          ))}
        </div>
      </div>

      {/* Confidence Threshold */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className={LABEL_CLASS}>Confidence Threshold</span>
          <SectionTooltip tip={TOOLTIPS.confidenceThreshold} />
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={km.confidence_threshold}
            onChange={(e) => setKm({ ...km, confidence_threshold: Number(e.target.value) })}
            className="flex-1 h-2 rounded-full appearance-none bg-surface-container-highest accent-primary-container"
          />
          <span className={`text-sm font-bold w-12 text-right ${confidenceColor}`}>
            {km.confidence_threshold.toFixed(2)}
          </span>
        </div>
        {km.confidence_threshold < 0.60 && (
          <p className="text-red-400 text-[10px] mt-1">Not recommended</p>
        )}
      </div>

      {/* Phase */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className={LABEL_CLASS}>Phase</span>
          <SectionTooltip tip={TOOLTIPS.phase} />
        </div>
        {phases.length === 0 ? (
          <select disabled className={INPUT_CLASS + " max-w-[320px] opacity-50"}>
            <option>Define phases in the Phases tab first</option>
          </select>
        ) : (
          <>
            <select
              className={INPUT_CLASS + " max-w-[320px]"}
              value={km.phase_id ?? ""}
              onChange={(e) => setKm({ ...km, phase_id: e.target.value || null })}
            >
              <option value="">Select a phase…</option>
              {phases.map(p => (
                <option key={p.id} value={p.id}>{p.phase}</option>
              ))}
            </select>
            {km.phase_id && !phases.find(p => p.id === km.phase_id) && (
              <p className="text-amber-400 text-xs mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                Linked phase was deleted — reassign this metric.
              </p>
            )}
          </>
        )}
      </div>

      {/* Keypoint Indices (read-only) */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className={LABEL_CLASS}>Keypoint Indices (Read-Only)</span>
          <SectionTooltip tip={TOOLTIPS.keypointIndices} />
        </div>
        <div className={`${INPUT_CLASS} max-w-[320px] opacity-60 cursor-default`}>
          {km.keypoint_indices.length > 0 ? km.keypoint_indices.join(", ") : "—"}
        </div>
      </div>
    </div>
  );
}
