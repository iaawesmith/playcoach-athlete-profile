#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { fingerprintValues, type MetricFingerprintInput } from "./fingerprintValues";

type Row = Record<string, unknown>;
type AnalyzerApi = {
  calculateAllMetrics: (...args: unknown[]) => Promise<unknown>;
  calculateAggregateScore: (...args: unknown[]) => unknown;
  parsePhaseBreakdown: (phases: unknown[]) => { id: string; name: string }[];
  detectErrors: (errors: unknown[], metrics: unknown[]) => unknown;
  calculatePhaseWindows: (count: number, phases: unknown[], buffer: number) => Record<string, { start: number; end: number }>;
};
const row = (value: unknown): Row => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object");
  return value as Row;
};
const list = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) throw new Error("Expected an array");
  return value;
};
const numeric = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Expected a finite number");
  return value;
};
const nullableNumber = (value: unknown): number | null => value == null ? null : numeric(value);
const args = process.argv.slice(2);
const option = (name: string) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const analyzerRoot = resolve(option("--analyzer-root") ?? root);
const inputPath = option("--input");
const id = args[0];
if (!inputPath && (!id || !/^[a-f0-9-]{8,36}$/i.test(id))) {
  throw new Error("Usage: bun scripts/fingerprint-rescore.ts RESULT_ID [--input snapshot.json] [--save-input snapshot.json] [--analyzer-root checkout] [--expect HASH] [--errors]");
}
const input: unknown = inputPath
  ? JSON.parse(await readFile(resolve(inputPath), "utf8"))
  : (() => {
    // Read-only project CLI authentication; no embedded tokens and no result writes.
    const sql = `select to_jsonb(r) || jsonb_build_object('analysis_context', u.analysis_context) as result, to_jsonb(n) as node from public.athlete_lab_results r join public.athlete_uploads u on u.id = r.upload_id join public.athlete_lab_nodes n on n.id = u.node_id where r.id::text like '${id}%'`;
    const response: unknown = JSON.parse(execFileSync("lovable", ["supabase", "query", sql, "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
    const rows = list(row(response).rows);
    if (rows.length !== 1) throw new Error(`Result prefix must match exactly one result (matched ${rows.length})`);
    return rows[0];
  })();
if (option("--save-input")) await writeFile(resolve(option("--save-input") ?? ""), JSON.stringify(input));
const data = row(input), result = row(data.result), node = row(data.node);
const rd = row(result.result_data), diagnostics = row(rd.diagnostics);
const keypoints = list(diagnostics.raw_keypoints), scores = list(diagnostics.raw_scores), perFrame = list(diagnostics.per_frame);
if (!keypoints.length || keypoints.length !== scores.length || keypoints.length !== perFrame.length) throw new Error("Require matching nonempty raw keypoints, scores and per-frame scales");
const fps = numeric(row(diagnostics.service).fps);
if (fps <= 0) throw new Error("FPS must be positive");
const context = row(result.analysis_context ?? rd.analysis_context ?? rd.context);
const savedMetrics = list(result.metric_results ?? diagnostics.metrics);
const calibrationMetric = savedMetrics.map(row).find(m => m.detail && row(m.detail).calibrationDetails);
// Runs where every metric was skipped carry calibration only at result level.
const detail = calibrationMetric ? row(calibrationMetric.detail) : rd.calibration_details ? {
  pixelsPerYard: rd.pixels_per_yard ?? null, calibrationSource: rd.calibration_source,
  calibrationConfidence: Number(rd.calibration_confidence) || 0, calibrationDetails: rd.calibration_details,
} : null;
if (!detail) throw new Error("Missing stored calibration details");
const details = { ...row(detail.calibrationDetails) };
delete details.windowPixelsPerYard; delete details.windowStart; delete details.windowEnd;
const calibration = {
  pixelsPerYard: nullableNumber(detail.pixelsPerYard), source: detail.calibrationSource,
  confidence: numeric(detail.calibrationConfidence), reason: "stored-data replay", details,
  perFrame: perFrame.map(p => numeric(row(p).scale_ppy)),
};
const temp = await mkdtemp(join(tmpdir(), "fingerprint-rescore-"));
try {
  const base = join(analyzerRoot, "supabase/functions/analyze-athlete-video");
  const source = await readFile(join(base, "index.ts"), "utf8");
  const ast = ts.createSourceFile("index.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const pure = new Set(["measurementWindow", "segmentation", "calibration", "quality", "scoring", "smoothing", "speedRetention", "scaleGate"]);
  const chunks: string[] = [];
  for (const statement of ast.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const spec = statement.moduleSpecifier.text;
      if (pure.has(spec.replace("./", "").replace(".ts", ""))) chunks.push(statement.getText(ast).replace(spec, join(base, spec)));
    } else if (ts.isFunctionDeclaration(statement)) {
      // Extract inert declarations, never clients, Deno.serve, network or AI initialization.
      if (["logInfo", "logWarn", "logError"].includes(statement.name?.text ?? "")) continue;
      chunks.push(statement.getText(ast));
    }
  }
  const smoothing = ast.statements.find(s => ts.isVariableStatement(s) && s.declarationList.declarations.some(d => d.name.getText(ast) === "SMOOTHING_WINDOW_FRAMES"));
  if (!smoothing) throw new Error("Analyzer smoothing constant not found");
  chunks.push(smoothing.getText(ast), "const MIRROR_INDEX_BY_INDEX = buildMirrorIndexMap();", "function logInfo() {} function logWarn() {} function logError() {}", "export { calculateAllMetrics, calculateAggregateScore, parsePhaseBreakdown, detectErrors, calculatePhaseWindows };");
  const modulePath = join(temp, "analyzer.ts");
  await writeFile(modulePath, chunks.join("\n"));
  const api = await import(modulePath) as AnalyzerApi;
  const phases = api.parsePhaseBreakdown(list(node.phase_breakdown));
  const windows: Record<string, { start: number; end: number }> = {};
  for (const item of list(row(row(rd.log_data).rtmlib).phase_windows)) {
    const window = row(item);
    const phase = phases.find(p => p.id === window.phase_id || p.name === window.phase);
    if (phase) windows[phase.id] = { start: numeric(window.start), end: numeric(window.end) };
  }
  if (!Object.keys(windows).length) throw new Error("Missing stored phase windows");
  // --anchor-events: preview event-anchored phases on the same stored data
  // (replaces stored windows; reports detected events). Default path unchanged.
  let anchoring: unknown = null;
  let eventsReport: unknown = undefined;
  if (args.includes("--anchor-events")) {
    const seg = await import(join(base, "segmentation.ts"));
    const sorted = [...list(node.phase_breakdown)].map(row).sort((a, b) => numeric(a.sequence_order) - numeric(b.sequence_order));
    const named = api.parsePhaseBreakdown(sorted).map((p, i) => ({ ...sorted[i], id: p.id, name: p.name }));
    const hips = seg.hipSeries(keypoints, scores);
    const snap = seg.snapEvent(seg.computeReleaseAnchor(hips, calibration.perFrame));
    const snapFrame = snap.detected ? snap.frame : 0;
    const svc = row(diagnostics.service);
    const pre = context.catch_included === false ? null : seg.detectCatch(keypoints, scores, 0.5, snapFrame);
    const brk = seg.phaseRoles(named).hasBreak ? seg.detectBreak(hips, calibration.perFrame, snapFrame, { width: numeric(svc.frame_width), height: numeric(svc.frame_height) }, pre && pre.detected ? pre.start - 1 : null, seg.bodyScaleSeries(keypoints, scores)) : null;
    const cat = context.catch_included === false ? null : seg.detectCatch(keypoints, scores, 0.5, brk && brk.detected ? brk.end + 1 : snapFrame);
    const events = { snap, break: brk, catch: cat };
    const anchored = seg.anchorPhaseWindows(keypoints.length, named, events, (count: number, group: unknown[]) => api.calculatePhaseWindows(count, group, 3));
    for (const k of Object.keys(windows)) delete windows[k];
    for (const ap of anchored) if (ap.window) windows[ap.id] = ap.window;
    anchoring = { anchoredPhases: anchored, catchEvent: cat };
    eventsReport = { events, phases: anchored.map((ap: { name: string; window: unknown; missing_event: unknown }) => ({ phase: ap.name, window: ap.window, missing_event: ap.missing_event })) };
  }
  // Stored raw_keypoints already contain the measured smoothing: never smooth twice.
  const metrics = list(await api.calculateAllMetrics(list(node.key_metrics), keypoints, scores, windows, 0, calibration, node.reference_fallback_behavior ?? "pixel_warning", context, fps, null, node.phase_breakdown, anchoring));
  const aggregate = row(api.calculateAggregateScore(metrics, node, context.catch_included !== false));
  const values: MetricFingerprintInput[] = metrics.map(item => {
    const metric = row(item);
    if (typeof metric.name !== "string" || typeof metric.status !== "string") throw new Error("Missing metric identity/status");
    return { name: metric.name, value: nullableNumber(metric.value), score: nullableNumber(metric.score), status: metric.status };
  });
  const output = fingerprintValues(values, nullableNumber(aggregate.aggregate_score));
  const expected = option("--expect");
  process.stdout.write(JSON.stringify({ result_id: result.id, node_version: node.node_version, frame_count: keypoints.length, ...output, ...(expected ? { matches_baseline: output.fingerprint === expected } : {}), ...(eventsReport ? { anchoring: eventsReport, metrics: values } : {}), ...(args.includes("--errors") ? { errors: api.detectErrors(list(node.common_errors), metrics) } : {}) }, null, 2) + "\n");
  if (expected && output.fingerprint !== expected) process.exitCode = 2;
} finally {
  await rm(temp, { recursive: true, force: true });
}