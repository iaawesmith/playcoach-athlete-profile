import { useState } from "react";
import type { TrainingNode, AnalysisResult } from "../types";
import { runAnalysis } from "@/services/athleteLab";
import { SectionTooltip } from "./SectionTooltip";

interface TestingPanelProps {
  node: TrainingNode;
}

export function TestingPanel({ node }: TestingPanelProps) {
  const [videoDesc, setVideoDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!videoDesc.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await runAnalysis(node, videoDesc);
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-container rounded-xl p-6 border border-white/5">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 20 }}>science</span>
        <h3 className="text-on-surface font-black uppercase tracking-[0.2em] text-xs">Testing Panel</h3>
        <SectionTooltip tip="Upload a sample video or describe the athlete's performance to run AI analysis against this node's configuration." />
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-on-surface-variant text-[10px] font-medium uppercase tracking-widest mb-2">
            Video Description / Upload
          </label>
          <textarea
            value={videoDesc}
            onChange={(e) => setVideoDesc(e.target.value)}
            placeholder="Describe the athlete's performance in detail, or paste a video URL..."
            className="w-full min-h-[100px] bg-surface-container-lowest border border-outline-variant/10 rounded-xl px-4 py-3 text-on-surface text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container/50 transition-colors resize-y"
          />
        </div>

        <button
          onClick={handleRun}
          disabled={loading || !videoDesc.trim()}
          className="h-11 px-8 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
              Analyzing...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span>
              Run Analysis
            </>
          )}
        </button>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4 mt-4">
            {/* Overall Score */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-high">
              <div className="w-16 h-16 rounded-full flex items-center justify-center font-black text-2xl" style={{ background: "linear-gradient(135deg, #00e639, #006714)", color: "#00460a" }}>
                {result.overallScore}
              </div>
              <div>
                <div className="text-on-surface font-bold text-lg">Route Mastery Score</div>
                <div className="text-on-surface-variant text-xs">Confidence: {Math.round(result.confidence * 100)}%</div>
              </div>
            </div>

            {/* Metric Scores */}
            <div className="p-4 rounded-xl bg-surface-container-high">
              <h4 className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.4em] mb-3">Metric Scores</h4>
              <div className="space-y-2">
                {result.metricScores.map((m) => (
                  <div key={m.name} className="flex items-center gap-3">
                    <span className="text-on-surface text-xs font-medium w-40 truncate">{m.name}</span>
                    <div className="flex-1 h-2 bg-surface-container-lowest rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-primary-container" style={{ width: `${m.score}%` }} />
                    </div>
                    <span className="text-on-surface text-xs font-bold w-10 text-right">{m.score}</span>
                    <span className="text-on-surface-variant text-[10px] w-20">{m.value} / {m.target}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Phase Breakdown */}
            <div className="p-4 rounded-xl bg-surface-container-high">
              <h4 className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.4em] mb-3">Phase Breakdown</h4>
              <div className="space-y-3">
                {result.phaseBreakdown.map((p) => (
                  <div key={p.phase} className="flex gap-3">
                    <div className="w-12 h-12 rounded-lg bg-surface-container-lowest flex items-center justify-center font-black text-on-surface text-sm">
                      {p.score}
                    </div>
                    <div className="flex-1">
                      <div className="text-on-surface text-sm font-semibold">{p.phase}</div>
                      <div className="text-on-surface-variant text-xs">{p.feedback}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-surface-container-high">
                <h4 className="text-primary-container text-[10px] font-semibold uppercase tracking-[0.4em] mb-2">Strengths</h4>
                <ul className="space-y-1">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="text-on-surface text-xs flex gap-2">
                      <span className="text-primary-container">✓</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-4 rounded-xl bg-surface-container-high">
                <h4 className="text-orange-400 text-[10px] font-semibold uppercase tracking-[0.4em] mb-2">Improvements</h4>
                <ul className="space-y-1">
                  {result.improvements.map((s, i) => (
                    <li key={i} className="text-on-surface text-xs flex gap-2">
                      <span className="text-orange-400">→</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Coach Feedback */}
            <div className="p-4 rounded-xl bg-surface-container-high">
              <h4 className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.4em] mb-2">Coach Feedback</h4>
              <p className="text-on-surface text-sm leading-relaxed whitespace-pre-wrap">{result.coachFeedback}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
