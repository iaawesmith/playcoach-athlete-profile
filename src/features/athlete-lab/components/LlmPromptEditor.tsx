import { useState, useRef, useCallback } from "react";
import { SectionTooltip } from "./SectionTooltip";

const INPUT_CLASS = "w-full border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface text-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-container/70 focus:ring-2 focus:ring-primary-container/30 focus:shadow-[0_0_8px_rgba(0,230,57,0.15)] transition-all bg-[#0E1319]";
const LABEL_CLASS = "text-on-surface-variant text-[10px] font-medium uppercase tracking-widest";

const TEMPLATE_VARIABLES = [
  { var: "{{mastery_score}}", desc: "Overall Mastery Score 0-100. Use to open feedback: 'Your score was {{mastery_score}}/100'" },
  { var: "{{phase_scores}}", desc: "Score per phase breakdown. e.g. Release: 82, Break: 71, Catch Window: 90" },
  { var: "{{phase_context}}", desc: "Phase definitions from the Phases tab — names, weights, descriptions, coaching cues — rendered per the Phase Context Mode below. Lets Claude reason about phases without you copy-pasting them into the prompt." },
  { var: "{{scoring_rules}}", desc: "Free-text scoring rules from the Scoring tab. Tells Claude how the aggregate score is computed so it can explain it accurately." },
  { var: "{{node_overview}}", desc: "The Overview field from the Basics tab. One-paragraph summary of what this skill is and why it matters." },
  { var: "{{node_name}}", desc: "The skill being analyzed. e.g. 'Slant Route'" },
  { var: "{{metric_results}}", desc: "Each metric: name, measured value, elite target, deviation, and score. e.g. Break Angle: 41° (target 45°, score 78/100)" },
  { var: "{{confidence_flags}}", desc: "Metrics with low-confidence keypoints. Tells Claude which measurements were uncertain and why. Use to suggest better filming." },
  { var: "{{detected_errors}}", desc: "Auto-detected errors that fired from Errors tab conditions. These are confirmed observations, not guesses — Claude should state them as facts." },
  { var: "{{athlete_name}}", desc: "Athlete's first name for personalized feedback." },
  { var: "{{position}}", desc: "Athlete position code (e.g. WR, CB, RB). Pulled from the athlete's profile or test context. Use to tailor terminology — 'release' for WR, 'jam' for CB, 'plant foot' for RB." },
  { var: "{{athlete_level}}", desc: "Athlete's self-reported experience level: Youth, High School, College, or Professional. Use to adjust technical depth and vocabulary. Pulled from athlete onboarding profile when available — set manually in Run Analysis context for testing." },
  { var: "{{focus_area}}", desc: "Optional focus area submitted by the athlete before filming. e.g. 'working on my break angle' or 'trying to improve my release'. Reference directly if provided. Empty string if not provided — do not reference if empty." },
  { var: "{{skipped_metrics}}", desc: "Metrics excluded from this analysis because athlete reported no catch was made. e.g. 'Catch Efficiency and YAC Burst were not evaluated on this rep.' Include a brief acknowledgment if this variable is not empty." },
];

type PhaseContextMode = "off" | "names_only" | "compact" | "full";

const PHASE_CONTEXT_MODE_OPTIONS: Array<{ value: PhaseContextMode; label: string; help: string }> = [
  { value: "off", label: "Off", help: "{{phase_context}} resolves to empty string. Use for nodes where phase detail is irrelevant." },
  { value: "names_only", label: "Names only", help: "Phase numbers and names only. Smallest token footprint." },
  { value: "compact", label: "Compact (default)", help: "Names, weights, first 200 chars of description, count of coaching cues. Safe for most nodes." },
  { value: "full", label: "Full", help: "Names, weights, full descriptions, full coaching cues, frame buffers. May overflow token budget on dense nodes." },
];


function getWordGuidance(words: number): { text: string; color: string } {
  if (words <= 100) return { text: "Brief — 3-4 sentences. Good for quick reps and younger athletes.", color: "text-primary-container" };
  if (words <= 200) return { text: "Balanced — one paragraph. Recommended default.", color: "text-primary-container" };
  if (words <= 350) return { text: "Detailed — full breakdown per phase. Good for training sessions.", color: "text-amber-400" };
  return { text: "Comprehensive — full report. Use sparingly. May overwhelm athletes.", color: "text-red-400" };
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-on-surface font-black uppercase tracking-tighter text-sm">{label}</span>
      <div className="flex-1 h-px bg-outline-variant/20" />
    </div>
  );
}

interface LlmPromptEditorProps {
  promptTemplate: string;
  onPromptChange: (v: string) => void;
  maxWords: number;
  onMaxWordsChange: (v: number) => void;
  systemInstructions: string;
  onSystemInstructionsChange: (v: string) => void;
  phaseContextMode: PhaseContextMode;
  onPhaseContextModeChange: (v: PhaseContextMode) => void;
}

export function LlmPromptEditor({
  promptTemplate, onPromptChange,
  maxWords, onMaxWordsChange,
  systemInstructions, onSystemInstructionsChange,
  phaseContextMode, onPhaseContextModeChange,
}: LlmPromptEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [insertedVar, setInsertedVar] = useState<string | null>(null);

  const insertVariable = useCallback((variable: string) => {
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart ?? promptTemplate.length;
      const end = el.selectionEnd ?? promptTemplate.length;
      const before = promptTemplate.slice(0, start);
      const after = promptTemplate.slice(end);
      const newValue = before + variable + after;
      onPromptChange(newValue);
      // Restore cursor after variable
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + variable.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      onPromptChange(promptTemplate + variable);
    }
    setInsertedVar(variable);
    setTimeout(() => setInsertedVar(null), 1500);
  }, [promptTemplate, onPromptChange]);

  const hasTemplateVars = /\{\{[a-z_]+\}\}/.test(promptTemplate);
  const knownVarNames = new Set(TEMPLATE_VARIABLES.map(t => t.var.replace(/[{}]/g, "")));
  const usedVarMatches = Array.from(promptTemplate.matchAll(/\{\{([a-z_]+)\}\}/g));
  const unknownVars = Array.from(new Set(usedVarMatches.map(m => m[1]).filter(v => !knownVarNames.has(v))));
  const wordGuidance = getWordGuidance(maxWords);

  return (
    <div className="space-y-6">

      {/* ── SECTION 1: TEMPLATE VARIABLES ── */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <span className={LABEL_CLASS}>Template Variables</span>
          <SectionTooltip tip="These variables are automatically injected by the Edge Function when calling Claude. Click any variable to insert it at the cursor position in the prompt template below." />
        </div>

        <div className="rounded-xl border border-outline-variant/20 overflow-hidden bg-[#1A2029]">
          {/* Header */}
          <div className="flex border-b border-outline-variant/10 px-4 py-2">
            <span className="text-on-surface-variant text-[9px] font-bold uppercase tracking-widest w-44 shrink-0">Variable</span>
            <span className="text-on-surface-variant text-[9px] font-bold uppercase tracking-widest flex-1">Contains</span>
          </div>
          {/* Rows */}
          {TEMPLATE_VARIABLES.map((tv) => (
            <button
              key={tv.var}
              type="button"
              onClick={() => insertVariable(tv.var)}
              className="w-full flex items-start gap-0 px-4 py-2.5 border-b border-outline-variant/5 hover:bg-surface-container-highest/50 transition-colors text-left group"
            >
              <div className="w-44 shrink-0 flex items-center gap-2">
                <code className="text-primary-container text-xs font-mono">{tv.var}</code>
                {insertedVar === tv.var && (
                  <span className="text-primary-container/60 text-[9px] font-medium animate-pulse">Inserted!</span>
                )}
              </div>
              <span className="text-on-surface-variant/60 text-xs leading-relaxed flex-1">{tv.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── EXISTING PROMPT TEXTAREA ── */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <label className={LABEL_CLASS}>Prompt Template</label>
        </div>
        <textarea
          ref={textareaRef}
          className={`${INPUT_CLASS} min-h-[300px] resize-y font-mono text-xs`}
          value={promptTemplate}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="e.g. You are an elite football skills coach analyzing a {{position}} athlete performing a {{node_name}}..."
        />
        {/* No-variables warning */}
        {promptTemplate.trim().length > 0 && !hasTemplateVars && (
          <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <span className="material-symbols-outlined text-amber-400 mt-0.5" style={{ fontSize: 14 }}>warning</span>
            <p className="text-amber-300 text-xs leading-snug">
              No template variables detected — Claude will generate generic feedback without actual metric data. Add at least {"{{mastery_score}}"} and {"{{metric_results}}"}.
            </p>
          </div>
        )}
        {/* Unknown-variable warning */}
        {unknownVars.length > 0 && (
          <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <span className="material-symbols-outlined text-amber-400 mt-0.5" style={{ fontSize: 14 }}>warning</span>
            <p className="text-amber-300 text-xs leading-snug">
              Unknown template variable{unknownVars.length > 1 ? "s" : ""}: {unknownVars.map(v => <code key={v} className="font-mono text-amber-200 mx-0.5">{`{{${v}}}`}</code>)}. These will be sent to Claude as literal text — they are not injected by the Edge Function. Remove them or pick from the variables list above.
            </p>
          </div>
        )}
      </div>

      {/* ── SECTION 1.5: PHASE CONTEXT MODE ── */}
      <SectionDivider label="Phase Context Mode" />

      <div className="p-5 rounded-xl border border-outline-variant/20 space-y-3 bg-[#1A2029]">
        <div className="flex items-center gap-1.5 mb-1">
          <label className={LABEL_CLASS}>Phase Context Mode</label>
          <SectionTooltip tip="Controls how phases are rendered into the {{phase_context}} template variable. Compact is safe for most nodes. Full sends every phase description and coaching cue and may overflow the token budget on dense nodes — the Edge Function will hard-fail with a 413 rather than truncate silently." />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PHASE_CONTEXT_MODE_OPTIONS.map((opt) => {
            const active = phaseContextMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onPhaseContextModeChange(opt.value)}
                className={`text-left rounded-xl px-4 py-3 border transition-all ${
                  active
                    ? "border-primary-container/60 bg-primary-container/10 shadow-[0_0_8px_rgba(0,230,57,0.15)]"
                    : "border-outline-variant/15 bg-surface-container-lowest hover:border-outline-variant/40"
                }`}
              >
                <div className={`text-xs font-bold uppercase tracking-widest ${active ? "text-primary-container" : "text-on-surface"}`}>
                  {opt.label}
                </div>
                <div className="text-on-surface-variant/70 text-[11px] leading-snug mt-1">{opt.help}</div>
              </button>
            );
          })}
        </div>
        <p className="text-on-surface-variant/50 text-[10px] leading-snug">
          Use {"{{phase_context}}"} in the prompt template above to inject the rendered phase block.
          Default is Compact. Mode applies to this node only.
        </p>
      </div>

      {/* ── SECTION 2: COACHING SETTINGS ── */}
      <SectionDivider label="Coaching Settings" />

      <div className="p-5 rounded-xl border border-outline-variant/20 space-y-5 bg-[#1A2029]">
        {/* Max Words */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <label className={LABEL_CLASS}>Max Feedback Length</label>
            <SectionTooltip tip="Word count target passed to Claude. This is a guideline not a hard cap — Claude may go slightly over on complex analyses." />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-on-surface-variant text-xs">Target feedback length:</span>
            <input
              type="number"
              min="50"
              max="500"
              step="10"
              className={`${INPUT_CLASS} !w-24 text-center`}
              value={maxWords}
              onChange={(e) => onMaxWordsChange(Math.max(50, Math.min(500, parseInt(e.target.value, 10) || 150)))}
            />
            <span className="text-on-surface-variant text-xs">words</span>
          </div>
          <p className={`text-[10px] mt-1.5 ${wordGuidance.color}`}>{wordGuidance.text}</p>
        </div>
      </div>

      {/* ── SECTION 3: SYSTEM INSTRUCTIONS ── */}
      <SectionDivider label="System Instructions" />

      <div className="p-5 rounded-xl border border-outline-variant/20 space-y-3 bg-[#1A2029]">
        <div className="flex items-center gap-1.5 mb-2">
          <label className={LABEL_CLASS}>System Instructions</label>
          <SectionTooltip tip="Optional. A persona and context statement prepended to every Claude call for this node. Sets the coaching voice before the prompt template runs. Keep under 100 words." />
        </div>
        <textarea
          className={`${INPUT_CLASS} min-h-[100px] resize-y`}
          value={systemInstructions}
          onChange={(e) => onSystemInstructionsChange(e.target.value)}
          placeholder="e.g. You are an NFL wide receivers coach with 15 years of experience developing elite route runners. You speak directly to athletes aged 14-22 using real coaching language. You are encouraging but honest. You never sugarcoat poor technique — you name it and fix it."
        />
        <div className="flex items-center justify-between">
          <span className="text-on-surface-variant/40 text-[10px]">
            {systemInstructions.length} / 500 characters recommended
          </span>
          {systemInstructions.length > 500 && (
            <span className="text-amber-400 text-[10px] flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>warning</span>
              Long system instructions reduce the token budget available for actual feedback
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
