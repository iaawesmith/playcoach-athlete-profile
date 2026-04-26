// Phase 1c.2 — Section A: Cloud Run /analyze 5-run determinism harness.
//
// Usage:
//   deno run --allow-env --allow-net --allow-write \
//     scripts/slice1c2_determinism_cloudrun.ts
//
// Fires 5 PARALLEL POSTs at the MediaPipe service with the exact
// 4-key payload the trimmed Edge Function uses, captures NDJSON
// `result` lines, hashes the keypoints/scores arrays, and reports
// pairwise byte-equality + summary-stat variance.
//
// Outputs: /tmp/cloudrun_run_{1..5}.json  (raw responses, ephemeral)
//          /tmp/cloudrun_summary.json     (parsed summary across runs)

const CLOUD_RUN_URL =
  "https://mediapipe-service-874407535869.us-central1.run.app/analyze";

const SIGNED_URL =
  "https://nwgljkjckcizbrpbqsro.supabase.co/storage/v1/object/sign/athlete-videos/test-clips/slant-route-reference-v1.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8yZjZlNWZhNi0xOWNkLTQ5MzgtYWI4OS04N2MxYjE3YjVkNjQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhdGhsZXRlLXZpZGVvcy90ZXN0LWNsaXBzL3NsYW50LXJvdXRlLXJlZmVyZW5jZS12MS5tcDQiLCJpYXQiOjE3NzcxNjMzODEsImV4cCI6MTc3NzI0OTc4MX0.8zWRX7Enjdda_zs_3-JQ1qpe1GM3wyfavwfFMQRwjqQ";

const PAYLOAD = {
  video_url: SIGNED_URL,
  start_seconds: 0,
  end_seconds: 3,
  det_frequency: 2,
};

type CloudRunResult = Record<string, unknown> & {
  keypoints?: number[][][][];
  scores?: number[][][];
  frame_count?: number;
  fps?: number;
  pixels_per_yard?: number | null;
  calibration_source?: string;
  calibration_confidence?: string;
  calibration_details?: Record<string, unknown>;
  auto_zoom_applied?: boolean;
  auto_zoom_factor?: number;
  auto_zoom_reason?: string | null;
  auto_zoom_final_fill_ratio?: number;
  auto_zoom_crop_rect?: Record<string, number> | null;
  auto_zoom_padding?: Record<string, number> | null;
  movement_direction?: string;
  movement_confidence?: number;
  person_detection_confidence?: number;
  safety_backoff_applied?: boolean;
  athlete_framing_message?: string | null;
  mean_keypoint_confidence_before_auto_zoom?: number;
  mean_keypoint_confidence_after_auto_zoom?: number;
};

async function sha256(s: string): Promise<string> {
  const bytes = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function runOne(idx: number): Promise<{
  idx: number;
  ok: boolean;
  status?: number;
  error?: string;
  durationMs: number;
  result?: CloudRunResult;
  keypointsHash?: string;
  scoresHash?: string;
}> {
  const t0 = Date.now();
  console.log(`[run ${idx}] POST start`);
  try {
    const resp = await fetch(CLOUD_RUN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/x-ndjson",
      },
      body: JSON.stringify(PAYLOAD),
    });
    if (!resp.ok || !resp.body) {
      const txt = await resp.text().catch(() => "");
      return {
        idx,
        ok: false,
        status: resp.status,
        error: `HTTP ${resp.status}: ${txt.slice(0, 400)}`,
        durationMs: Date.now() - t0,
      };
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let resultLine: Record<string, unknown> | null = null;
    let errLine: Record<string, unknown> | null = null;
    let keepalives = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.type === "keepalive") {
            keepalives++;
            continue;
          }
          if (obj.type === "result") resultLine = obj.data;
          if (obj.type === "error") errLine = obj;
        } catch (_e) {
          // ignore parse errors on partial lines
        }
      }
    }

    if (errLine) {
      return {
        idx,
        ok: false,
        error: `pipeline error: ${JSON.stringify(errLine).slice(0, 400)}`,
        durationMs: Date.now() - t0,
      };
    }
    if (!resultLine) {
      return {
        idx,
        ok: false,
        error: `no result line received (keepalives=${keepalives})`,
        durationMs: Date.now() - t0,
      };
    }

    const result = resultLine as CloudRunResult;
    const kpHash = await sha256(JSON.stringify(result.keypoints ?? []));
    const scHash = await sha256(JSON.stringify(result.scores ?? []));

    await Deno.writeTextFile(
      `/tmp/cloudrun_run_${idx}.json`,
      JSON.stringify(result, null, 2),
    );

    console.log(
      `[run ${idx}] OK ${Date.now() - t0}ms keepalives=${keepalives} ` +
        `frames=${result.frame_count} ppy=${result.pixels_per_yard} ` +
        `kpHash=${kpHash.slice(0, 12)}…`,
    );

    return {
      idx,
      ok: true,
      durationMs: Date.now() - t0,
      result,
      keypointsHash: kpHash,
      scoresHash: scHash,
    };
  } catch (e) {
    return {
      idx,
      ok: false,
      error: String(e),
      durationMs: Date.now() - t0,
    };
  }
}

function pickStat(r: CloudRunResult) {
  return {
    frame_count: r.frame_count,
    fps: r.fps,
    pixels_per_yard: r.pixels_per_yard,
    calibration_source: r.calibration_source,
    calibration_confidence: r.calibration_confidence,
    auto_zoom_applied: r.auto_zoom_applied,
    auto_zoom_factor: r.auto_zoom_factor,
    auto_zoom_reason: r.auto_zoom_reason,
    auto_zoom_final_fill_ratio: r.auto_zoom_final_fill_ratio,
    auto_zoom_crop_rect: r.auto_zoom_crop_rect,
    safety_backoff_applied: r.safety_backoff_applied,
    person_detection_confidence: r.person_detection_confidence,
    movement_direction: r.movement_direction,
    movement_confidence: r.movement_confidence,
    mean_kp_conf_before: r.mean_keypoint_confidence_before_auto_zoom,
    mean_kp_conf_after: r.mean_keypoint_confidence_after_auto_zoom,
  };
}

function findFirstDivergence(
  a: number[][][][] | undefined,
  b: number[][][][] | undefined,
): { frame: number; person: number; joint: number; dx: number; dy: number } | null {
  if (!a || !b) return null;
  const F = Math.min(a.length, b.length);
  for (let f = 0; f < F; f++) {
    const fa = a[f] ?? [];
    const fb = b[f] ?? [];
    const P = Math.min(fa.length, fb.length);
    for (let p = 0; p < P; p++) {
      const pa = fa[p] ?? [];
      const pb = fb[p] ?? [];
      const J = Math.min(pa.length, pb.length);
      for (let j = 0; j < J; j++) {
        const ja = pa[j] ?? [0, 0];
        const jb = pb[j] ?? [0, 0];
        const dx = (ja[0] ?? 0) - (jb[0] ?? 0);
        const dy = (ja[1] ?? 0) - (jb[1] ?? 0);
        if (dx !== 0 || dy !== 0) {
          return { frame: f, person: p, joint: j, dx, dy };
        }
      }
    }
  }
  return null;
}

async function main() {
  console.log("Section A — Cloud Run determinism (5 parallel runs)");
  console.log("Payload:", JSON.stringify(PAYLOAD).slice(0, 200) + "…");
  console.log("");

  const t0 = Date.now();
  const results = await Promise.all([1, 2, 3, 4, 5].map(runOne));
  const wallMs = Date.now() - t0;
  console.log(`\nAll 5 runs complete in ${wallMs}ms wall.`);

  const successes = results.filter((r) => r.ok && r.result);
  const failures = results.filter((r) => !r.ok);
  console.log(`Successes: ${successes.length}/5  Failures: ${failures.length}/5`);
  failures.forEach((f) => console.log(`  [run ${f.idx}] FAIL: ${f.error}`));

  if (successes.length < 2) {
    console.log("\nNot enough successful runs to compare.");
    return;
  }

  // Pairwise byte-equality
  console.log("\n== Pairwise keypoint hash equality ==");
  const pairs: Array<[number, number, boolean, boolean]> = [];
  for (let i = 0; i < successes.length; i++) {
    for (let j = i + 1; j < successes.length; j++) {
      const a = successes[i];
      const b = successes[j];
      const kpEq = a.keypointsHash === b.keypointsHash;
      const scEq = a.scoresHash === b.scoresHash;
      pairs.push([a.idx, b.idx, kpEq, scEq]);
      console.log(
        `  run${a.idx} vs run${b.idx}: keypoints ${kpEq ? "EQUAL" : "DIFFER"}, scores ${scEq ? "EQUAL" : "DIFFER"}`,
      );
      if (!kpEq) {
        const div = findFirstDivergence(
          a.result!.keypoints,
          b.result!.keypoints,
        );
        if (div) {
          console.log(
            `    first divergence: frame=${div.frame} person=${div.person} joint=${div.joint} dx=${div.dx.toFixed(4)} dy=${div.dy.toFixed(4)}`,
          );
        }
      }
    }
  }

  // Summary stat variance
  console.log("\n== Per-run summary stats ==");
  const stats = successes.map((r) => ({ run: r.idx, ...pickStat(r.result!) }));
  console.table(stats);

  // Variance of pixels_per_yard
  const ppys = successes
    .map((r) => r.result!.pixels_per_yard)
    .filter((v): v is number => typeof v === "number");
  if (ppys.length) {
    const min = Math.min(...ppys);
    const max = Math.max(...ppys);
    const mean = ppys.reduce((a, b) => a + b, 0) / ppys.length;
    console.log(
      `\nppy: min=${min.toFixed(3)} max=${max.toFixed(3)} mean=${mean.toFixed(3)} ` +
        `range=${(max - min).toFixed(3)} pct_of_mean=${((max - min) / mean * 100).toFixed(3)}%`,
    );
  }

  await Deno.writeTextFile(
    "/tmp/cloudrun_summary.json",
    JSON.stringify(
      {
        wallMs,
        payload: PAYLOAD,
        runs: successes.map((r) => ({
          idx: r.idx,
          durationMs: r.durationMs,
          keypointsHash: r.keypointsHash,
          scoresHash: r.scoresHash,
          stats: pickStat(r.result!),
        })),
        failures,
        pairs: pairs.map(([a, b, kpEq, scEq]) => ({
          a,
          b,
          keypoints_equal: kpEq,
          scores_equal: scEq,
        })),
      },
      null,
      2,
    ),
  );
  console.log("\nWrote /tmp/cloudrun_summary.json");
}

main().catch((e) => {
  console.error("FATAL", e);
  Deno.exit(1);
});
