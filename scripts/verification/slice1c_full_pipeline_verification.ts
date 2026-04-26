/**
 * slice1c_full_pipeline_verification.ts
 *
 * NAME:  slice1c_full_pipeline_verification
 * PHASE: PHASE-1C2 (Slice C — 5-run full-pipeline verification)
 *
 * VERIFIES:
 *   End-to-end pipeline determinism on the Slant reference clip across 5
 *   parallel athlete_uploads rows (Marcus Sterling, athlete_height=74"):
 *     (1) calibration_audit object is byte-identical across all 5 runs (hash)
 *     (2) body_based_ppy and static_ppy are non-null on every run
 *     (3) selected_source matches result_data.calibration_source
 *     (4) Value-correctness:
 *         - body_based_ppy ≈ 234 (±5%)
 *         - static_ppy === 80
 *         - selected_source === 'body_based'
 *         - body_based_status === 'used'
 *         - static_status === 'computed_but_not_selected'
 *         - dynamic_status === 'failed' with non-null dynamic_failure_reason
 *
 * RECIPE:
 *   Runtime:   deno
 *   Command:   deno run --allow-env --allow-net \
 *                scripts/verification/slice1c_full_pipeline_verification.ts
 *   Env vars:  SUPABASE_SERVICE_ROLE_KEY
 *   Args:      none
 *   Output:    stdout — per-run hash, value-correctness table, overall verdict
 *   Halt:      exit 1 if any of the 4 assertion families fails
 *
 *   NOTE on the body_based_ppy expectation: the ≈234 value is the pre-C.5
 *   baseline. Post-C.5 (the unified edge function body-based path,
 *   ADR-0014) the expectation is ≈200.21 — see slice1c2_d5_post_strip_verify
 *   for the post-C.5 assertion. This script remains pinned to the pre-C.5
 *   baseline to preserve the historical reference; do not update without
 *   amending the Slice C outcome doc.
 *
 * BACKLINKS:
 *   - docs/process/phase-1c1-slice3-outcome.md
 *   - docs/adr/0014-c5-unified-edge-function-body-based-path.md
 *   - docs/risk-register/F-SLICE-B-1-both-calibration-paths-produce-2-6-distance-errors-static-only.md
 *   - docs/reference/calibration-audit-rollup.md
 *
 * MAINTENANCE:
 *   See SIGNED_URL maintenance note in slice1c2_d5_post_strip_verify.
 */

const SUPABASE_URL = "https://nwgljkjckcizbrpbqsro.supabase.co"
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
if (!SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY required in env")
  Deno.exit(1)
}

const SIGNED_URL =
  "https://nwgljkjckcizbrpbqsro.supabase.co/storage/v1/object/sign/athlete-videos/test-clips/slant-route-reference-v1.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8yZjZlNWZhNi0xOWNkLTQ5MzgtYWI4OS04N2MxYjE3YjVkNjQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhdGhsZXRlLXZpZGVvcy90ZXN0LWNsaXBzL3NsYW50LXJvdXRlLXJlZmVyZW5jZS12MS5tcDQiLCJpYXQiOjE3NzcxNjMzODEsImV4cCI6MTc3NzI0OTc4MX0.8zWRX7Enjdda_zs_3-JQ1qpe1GM3wyfavwfFMQRwjqQ"

const FIXED_TEST_ATHLETE_ID = "8f42b1c3-5d9e-4a7b-b2e1-9c3f4d5a6e7b"
const NODE_ID = "75ed4b18-8a22-440e-9a23-b86204956056"
const NODE_VERSION = 1 // re-resolved at insert time below

const REST = `${SUPABASE_URL}/rest/v1`
const HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
}

async function sha256(s: string): Promise<string> {
  const bytes = new TextEncoder().encode(s)
  const hash = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function resolveNodeVersion(): Promise<number> {
  const r = await fetch(`${REST}/athlete_lab_nodes?id=eq.${NODE_ID}&select=node_version`, {
    headers: HEADERS,
  })
  const rows = await r.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Node ${NODE_ID} not found`)
  }
  return Number(rows[0].node_version)
}

async function insertOne(runIndex: number, nodeVersion: number): Promise<string> {
  const body = [{
    athlete_id: FIXED_TEST_ATHLETE_ID,
    node_id: NODE_ID,
    node_version: nodeVersion,
    video_url: SIGNED_URL,
    camera_angle: "sideline",
    start_seconds: 0,
    end_seconds: 3,
    status: "pending",
    analysis_context: {
      experiment: "1c-slice-c-verification",
      run_index: runIndex,
      camera_angle: "sideline",
      start_seconds: 0,
      end_seconds: 3,
      athlete_height: { value: 74, unit: "inches" },
    },
  }]
  const r = await fetch(`${REST}/athlete_uploads`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const txt = await r.text()
    throw new Error(`insert run ${runIndex} failed: ${r.status} ${txt}`)
  }
  const rows = await r.json()
  return rows[0].id as string
}

async function pollUpload(uploadId: string, timeoutMs = 240_000): Promise<{
  status: string
  error_message: string | null
}> {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const r = await fetch(
      `${REST}/athlete_uploads?id=eq.${uploadId}&select=status,error_message`,
      { headers: HEADERS },
    )
    const rows = await r.json()
    const row = rows?.[0]
    if (row && (row.status === "complete" || row.status === "failed")) {
      return row
    }
    await new Promise((res) => setTimeout(res, 3000))
  }
  return { status: "timeout", error_message: null }
}

type CalibrationAudit = Record<string, unknown> & {
  selected_source?: string
  selected_ppy?: number | null
  dynamic_status?: string
  dynamic_failure_reason?: string | null
  body_based_status?: string
  body_based_ppy?: number | null
  body_based_confidence?: number | null
  static_status?: string
  static_ppy?: number | null
  athlete_height_provided?: boolean
}

async function fetchResult(uploadId: string): Promise<{
  resultId: string | null
  topLevelSource: string | null
  topLevelPpy: number | null
  audit: CalibrationAudit | null
  auditRaw: string | null
}> {
  const r = await fetch(
    `${REST}/athlete_lab_results?upload_id=eq.${uploadId}&select=id,result_data`,
    { headers: HEADERS },
  )
  const rows = await r.json()
  const row = rows?.[0]
  if (!row) return { resultId: null, topLevelSource: null, topLevelPpy: null, audit: null, auditRaw: null }
  const data = row.result_data ?? {}
  const audit = data.calibration_audit ?? null
  return {
    resultId: row.id,
    topLevelSource: data.calibration_source ?? null,
    topLevelPpy: typeof data.pixels_per_yard === "number" ? data.pixels_per_yard : null,
    audit,
    // Use the audit JSON exactly as stored (JSONB) — re-stringify with sorted keys for stable hash.
    auditRaw: audit ? JSON.stringify(sortKeys(audit)) : null,
  }
}

// Recursively sort keys so hash is order-independent against any
// PostgREST/JSONB key reordering during round-trip.
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(obj).sort()) out[k] = sortKeys(obj[k])
    return out
  }
  return value
}

async function main() {
  console.log("Slice C — 5-run full-pipeline verification")
  console.log(`Clip: slant-route-reference-v1.mp4 (4K)`)
  console.log(`Window: 0–3s, sideline, athlete_height=74in`)
  console.log("")

  const nodeVersion = await resolveNodeVersion()
  console.log(`Resolved node_version=${nodeVersion} for node ${NODE_ID}`)
  console.log("")

  // Insert 5 in parallel — fires the trigger 5x.
  const tInsert = Date.now()
  const uploadIds = await Promise.all(
    [1, 2, 3, 4, 5].map((i) => insertOne(i, nodeVersion)),
  )
  console.log(`Inserted 5 uploads in ${Date.now() - tInsert}ms:`)
  uploadIds.forEach((id, i) => console.log(`  run ${i + 1}: ${id}`))
  console.log("")

  // Poll each to completion in parallel.
  console.log("Polling for completion (up to 4 minutes per run)...")
  const tPoll = Date.now()
  const finalStatuses = await Promise.all(uploadIds.map((id) => pollUpload(id)))
  console.log(`Polling done in ${Date.now() - tPoll}ms`)
  finalStatuses.forEach((s, i) => {
    console.log(`  run ${i + 1}: status=${s.status}${s.error_message ? ` err=${s.error_message}` : ""}`)
  })
  console.log("")

  const allComplete = finalStatuses.every((s) => s.status === "complete")
  if (!allComplete) {
    console.log("✗ Not all runs reached status=complete. Halting verification.")
    Deno.exit(1)
  }

  // Fetch results.
  const results = await Promise.all(uploadIds.map((id) => fetchResult(id)))
  results.forEach((r, i) => {
    if (!r.audit) {
      console.log(`✗ run ${i + 1}: no calibration_audit in result_data`)
    }
  })
  if (results.some((r) => !r.audit)) {
    Deno.exit(1)
  }

  // ============= Check 1: byte-identical hashes =============
  console.log("== Check 1: calibration_audit byte-equality (sorted-key hash) ==")
  const hashes = await Promise.all(results.map((r) => sha256(r.auditRaw!)))
  hashes.forEach((h, i) => console.log(`  run ${i + 1}: ${h.slice(0, 16)}…`))
  const allEqual = hashes.every((h) => h === hashes[0])
  console.log(allEqual ? "  ✓ all 5 hashes identical" : "  ✗ hashes diverge")
  console.log("")

  // ============= Check 2: non-null body_based_ppy and static_ppy =============
  console.log("== Check 2: body_based_ppy and static_ppy non-null on every run ==")
  let allNonNull = true
  results.forEach((r, i) => {
    const bb = r.audit!.body_based_ppy
    const st = r.audit!.static_ppy
    const ok = typeof bb === "number" && typeof st === "number"
    console.log(`  run ${i + 1}: body_based_ppy=${bb}  static_ppy=${st}  ${ok ? "✓" : "✗"}`)
    if (!ok) allNonNull = false
  })
  console.log(allNonNull ? "  ✓ all non-null" : "  ✗ at least one null")
  console.log("")

  // ============= Check 3: selected_source matches top-level metadata =============
  console.log("== Check 3: selected_source matches existing result_data.calibration_source ==")
  let allMatch = true
  results.forEach((r, i) => {
    const matches = r.audit!.selected_source === r.topLevelSource
    console.log(
      `  run ${i + 1}: audit.selected_source=${r.audit!.selected_source} top_level=${r.topLevelSource} ${matches ? "✓" : "✗"}`,
    )
    if (!matches) allMatch = false
  })
  console.log(allMatch ? "  ✓ all match" : "  ✗ mismatch")
  console.log("")

  // ============= Check 4: value-correctness =============
  console.log("== Check 4: value-correctness against expected Slant clip baseline ==")
  const expected = {
    body_based_ppy_target: 234,
    body_based_ppy_tolerance_pct: 5,
    static_ppy_exact: 80,
    selected_source: "body_based",
    body_based_status: "used",
    static_status: "computed_but_not_selected",
    dynamic_status: "failed",
  }
  console.log("  Expected:", JSON.stringify(expected))
  let allValuesCorrect = true
  results.forEach((r, i) => {
    const a = r.audit!
    const bb = typeof a.body_based_ppy === "number" ? a.body_based_ppy : NaN
    const bbDeltaPct = Math.abs(bb - expected.body_based_ppy_target) / expected.body_based_ppy_target * 100
    const checks = {
      body_based_ppy_in_range: bbDeltaPct <= expected.body_based_ppy_tolerance_pct,
      static_ppy_exact: a.static_ppy === expected.static_ppy_exact,
      selected_source: a.selected_source === expected.selected_source,
      body_based_status: a.body_based_status === expected.body_based_status,
      static_status: a.static_status === expected.static_status,
      dynamic_status: a.dynamic_status === expected.dynamic_status,
      dynamic_failure_reason_present: typeof a.dynamic_failure_reason === "string" && a.dynamic_failure_reason.length > 0,
    }
    const allOk = Object.values(checks).every(Boolean)
    if (!allOk) allValuesCorrect = false
    console.log(
      `  run ${i + 1}: body_based_ppy=${bb} (Δ=${bbDeltaPct.toFixed(2)}%) ` +
        `static_ppy=${a.static_ppy} sel=${a.selected_source} bb_status=${a.body_based_status} ` +
        `static_status=${a.static_status} dyn_status=${a.dynamic_status} ` +
        `dyn_reason=${a.dynamic_failure_reason} ${allOk ? "✓" : "✗"}`,
    )
    if (!allOk) {
      console.log(`    failing checks:`, Object.entries(checks).filter(([, v]) => !v).map(([k]) => k))
    }
  })
  console.log(allValuesCorrect ? "  ✓ all values correct" : "  ✗ value mismatch")
  console.log("")

  // ============= Final verdict =============
  console.log("===========================================")
  console.log("FINAL VERDICT")
  console.log("===========================================")
  console.log(`Check 1 (byte-equality):       ${allEqual ? "PASS" : "FAIL"}`)
  console.log(`Check 2 (non-null ppy):        ${allNonNull ? "PASS" : "FAIL"}`)
  console.log(`Check 3 (source matches):      ${allMatch ? "PASS" : "FAIL"}`)
  console.log(`Check 4 (value correctness):   ${allValuesCorrect ? "PASS" : "FAIL"}`)
  console.log("")

  // Dump first audit for posterity.
  console.log("Sample calibration_audit (run 1):")
  console.log(JSON.stringify(results[0].audit, null, 2))

  // Write summary
  await Deno.writeTextFile(
    "/tmp/slice_c_verification_summary.json",
    JSON.stringify({
      uploadIds,
      hashes,
      audits: results.map((r) => r.audit),
      topLevel: results.map((r) => ({ source: r.topLevelSource, ppy: r.topLevelPpy })),
      verdict: {
        check1_byte_equality: allEqual,
        check2_non_null_ppy: allNonNull,
        check3_source_matches: allMatch,
        check4_value_correctness: allValuesCorrect,
        ship: allEqual && allNonNull && allMatch && allValuesCorrect,
      },
    }, null, 2),
  )

  if (allEqual && allNonNull && allMatch && allValuesCorrect) {
    console.log("\n✓✓✓ Slice C VERIFIED — ship.")
    Deno.exit(0)
  } else {
    console.log("\n✗ Slice C verification FAILED — investigate before shipping.")
    Deno.exit(2)
  }
}

main().catch((e) => {
  console.error("FATAL", e)
  Deno.exit(1)
})
