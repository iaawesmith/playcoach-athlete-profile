import { useState, useRef } from "react";
import type { TrainingNode, AnalysisResult } from "../types";
import { runAnalysis } from "@/services/athleteLab";
import { SectionTooltip } from "./SectionTooltip";
import { supabase } from "@/integrations/supabase/client";

interface TestingPanelProps {
  node: TrainingNode;
}

export function TestingPanel({ node }: TestingPanelProps) {
  const [videoDesc, setVideoDesc] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

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

  const handleRun = async () => {
    if (!videoDesc.trim() && !videoUrl.trim() && !uploadedFile) return;
    setLoading(true);
    setError(null);
    setResult(null);

    let finalVideoUrl = videoUrl;

    if (uploadedFile) {
      setUploading(true);
      const ext = uploadedFile.name.split(".").pop() || "mp4";
      const path = `test-videos/${node.id}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("athlete-media").upload(path, uploadedFile, { upsert: true });
      setUploading(false);
      if (uploadErr) {
        setError("Video upload failed: " + uploadErr.message);
        setLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("athlete-media").getPublicUrl(path);
      finalVideoUrl = urlData.publicUrl;
    }

    try {
      const description = [
        videoDesc.trim(),
        finalVideoUrl ? `Video URL: ${finalVideoUrl}` : "",
      ].filter(Boolean).join("\n\n");
      const res = await runAnalysis(node, description);
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRerun = () => {
    setResult(null);
    setError(null);
    setUploadedFile(null);
    setVideoUrl("");
    setVideoDesc("");
  };

  const hasInput = videoDesc.trim() || videoUrl.trim() || uploadedFile;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#00e639";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 24 }}>science</span>
          <h3 className="text-on-surface font-black uppercase tracking-[0.2em] text-sm">Test & Preview</h3>
          <SectionTooltip tip="Upload a sample video or describe the athlete's performance to run AI analysis against this node's configuration." />
        </div>
        <p className="text-on-surface-variant text-xs leading-relaxed">
          Upload a sample video or paste a video URL to instantly test how the AI would score and give feedback for this node.
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-surface-container rounded-xl p-5 border border-white/5 space-y-4">
        {/* Video Upload */}
        <div>
          <label className="block text-on-surface-variant text-[10px] font-medium uppercase tracking-widest mb-2">
            Video Upload
          </label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full min-h-[90px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
              dragOver
                ? "border-primary-container/50 bg-primary-container/5"
                : uploadedFile
                  ? "border-primary-container/30 bg-surface-container-lowest"
                  : "border-outline-variant/20 bg-surface-container-lowest hover:border-outline-variant/40"
            }`}
          >
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            {uploadedFile ? (
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 24 }}>videocam</span>
                <div>
                  <div className="text-on-surface text-sm font-medium">{uploadedFile.name}</div>
                  <div className="text-on-surface-variant text-[10px]">{(uploadedFile.size / 1024 / 1024).toFixed(1)} MB</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }} className="text-on-surface-variant hover:text-red-400 ml-2">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              </div>
            ) : (
              <>
                <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 28 }}>cloud_upload</span>
                <span className="text-on-surface-variant text-xs">Drag & drop a video or <span className="text-primary-container font-semibold">browse</span></span>
              </>
            )}
          </div>
        </div>

        {/* Video URL */}
        <div>
          <label className="block text-on-surface-variant text-[10px] font-medium uppercase tracking-widest mb-2">Or Paste Video URL</label>
          <input
            value={videoUrl}
            onChange={(e) => { setVideoUrl(e.target.value); if (e.target.value) setUploadedFile(null); }}
            placeholder="https://youtube.com/watch?v=... or direct video link"
            className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl px-4 py-3 text-on-surface text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container/50 transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-on-surface-variant text-[10px] font-medium uppercase tracking-widest mb-2">Performance Description (Optional)</label>
          <textarea
            value={videoDesc}
            onChange={(e) => setVideoDesc(e.target.value)}
            placeholder="Describe the athlete's performance for additional context..."
            className="w-full min-h-[70px] bg-surface-container-lowest border border-outline-variant/10 rounded-xl px-4 py-3 text-on-surface text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container/50 transition-colors resize-y"
          />
        </div>

        <button
          onClick={handleRun}
          disabled={loading || uploading || !hasInput}
          className="h-11 px-8 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
        >
          {loading || uploading ? (
            <>
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
              {uploading ? "Uploading..." : "Analyzing..."}
            </>
          ) : (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span>
              Run Analysis
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-400 shrink-0" style={{ fontSize: 20 }}>error</span>
          <div>
            <div className="text-red-400 text-sm font-semibold">Analysis Failed</div>
            <div className="text-red-400/80 text-xs mt-1">{error}</div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* 1. Overall Score */}
          <div className="bg-surface-container rounded-xl p-5 border border-white/5">
            <div className="flex items-center gap-5">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center font-black text-3xl shrink-0"
                style={{ background: `linear-gradient(135deg, ${getScoreColor(result.overallScore)}, ${getScoreColor(result.overallScore)}88)`, color: "#0b0f12" }}
              >
                {result.overallScore}
              </div>
              <div className="flex-1">
                <div className="text-on-surface font-black uppercase tracking-tighter text-xl">Route Mastery Score</div>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-on-surface-variant text-xs">
                    Confidence: <span className="text-on-surface font-bold">{Math.round(result.confidence * 100)}%</span>
                  </span>
                  <div className="flex-1 max-w-[120px] h-1.5 bg-surface-container-lowest rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary-container" style={{ width: `${result.confidence * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {result.warnings && result.warnings.length > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-400" style={{ fontSize: 18 }}>warning</span>
                <span className="text-orange-400 text-[10px] font-semibold uppercase tracking-[0.3em]">Warnings</span>
              </div>
              {result.warnings.map((w, i) => (
                <div key={i} className="text-orange-300/80 text-xs flex gap-2">
                  <span className="text-orange-400 shrink-0">•</span> {w}
                </div>
              ))}
            </div>
          )}

          {/* 2. Phase Breakdown */}
          <div className="bg-surface-container rounded-xl p-5 border border-white/5">
            <h4 className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.4em] mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 16 }}>timeline</span>
              Phase Breakdown
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {result.phaseBreakdown.map((p) => (
                <div key={p.phase} className="bg-surface-container-high rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-on-surface text-sm font-bold">{p.phase}</span>
                    <span
                      className="text-sm font-black px-2 py-0.5 rounded-lg"
                      style={{ color: getScoreColor(p.score), background: `${getScoreColor(p.score)}15` }}
                    >
                      {p.score}
                    </span>
                  </div>
                  <div className="h-1.5 bg-surface-container-lowest rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p.score}%`, background: getScoreColor(p.score) }} />
                  </div>
                  <p className="text-on-surface-variant text-xs leading-relaxed">{p.feedback}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Feedback — Strengths & Improvements */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-surface-container rounded-xl p-5 border border-white/5">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.4em] mb-3 flex items-center gap-2" style={{ color: "#00e639" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#00e639" }}>thumb_up</span>
                Strengths
              </h4>
              <ul className="space-y-2">
                {result.strengths.map((s, i) => (
                  <li key={i} className="text-on-surface text-xs flex gap-2 leading-relaxed">
                    <span className="shrink-0 mt-0.5" style={{ color: "#00e639" }}>✓</span> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-surface-container rounded-xl p-5 border border-white/5">
              <h4 className="text-orange-400 text-[10px] font-semibold uppercase tracking-[0.4em] mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-400" style={{ fontSize: 16 }}>trending_up</span>
                Areas to Improve
              </h4>
              <ul className="space-y-2">
                {result.improvements.map((s, i) => (
                  <li key={i} className="text-on-surface text-xs flex gap-2 leading-relaxed">
                    <span className="text-orange-400 shrink-0 mt-0.5">→</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 4. Raw Metrics Table */}
          <div className="bg-surface-container rounded-xl p-5 border border-white/5">
            <h4 className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.4em] mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 16 }}>analytics</span>
              Raw Metrics
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-on-surface-variant text-[9px] uppercase tracking-[0.3em] border-b border-white/5">
                    <th className="text-left py-2 pr-4 font-semibold">Metric</th>
                    <th className="text-right py-2 px-3 font-semibold">Score</th>
                    <th className="text-right py-2 px-3 font-semibold">Value</th>
                    <th className="text-right py-2 px-3 font-semibold">Elite Target</th>
                    <th className="text-right py-2 pl-3 font-semibold">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {result.metricScores.map((m) => (
                    <tr key={m.name} className="border-b border-white/5 last:border-0">
                      <td className="py-2.5 pr-4 text-on-surface font-medium">{m.name}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="font-bold" style={{ color: getScoreColor(m.score) }}>{m.score}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-on-surface">{m.value}</td>
                      <td className="py-2.5 px-3 text-right text-on-surface-variant">{m.target}</td>
                      <td className="py-2.5 pl-3 text-right text-on-surface-variant">{m.difference || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. Elite Comparison */}
          {result.eliteComparison && (
            <div className="bg-surface-container rounded-xl p-5 border border-white/5">
              <h4 className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.4em] mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 16 }}>compare</span>
                Elite Comparison
              </h4>
              <p className="text-on-surface text-sm leading-relaxed">{result.eliteComparison}</p>
            </div>
          )}

          {/* Coach Feedback */}
          <div className="bg-surface-container rounded-xl p-5 border border-white/5">
            <h4 className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.4em] mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 16 }}>sports</span>
              Coach Feedback
            </h4>
            <p className="text-on-surface text-sm leading-relaxed whitespace-pre-wrap">{result.coachFeedback}</p>
          </div>

          {/* 6. Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleRerun}
              className="h-10 px-6 rounded-full bg-surface-container-high border border-outline-variant/20 text-on-surface font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all duration-150 flex items-center gap-2 hover:bg-surface-container-highest"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
              Re-run with Different Video
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
