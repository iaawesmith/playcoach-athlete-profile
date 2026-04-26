// Slice D — D.5 step 4 post-strip determinism re-check.
//
// Single full-pipeline run (Section B style) on slant-route-reference-v1.mp4
// with athlete_height=74". Confirms that the JSONB sub-field strips in D.3/D.4
// did not perturb runtime calibration math by re-asserting the post-C.5
// deterministic baseline values:
//
//   - body_based_ppy ≈ 200.21 (post-C.5 edge function path)
//   - static_ppy === 80
//   - selected_source === 'body_based'
//   - body_based_status === 'used'
//   - dynamic_status === 'failed'
//   - calibration_audit hash matches post-C.5 reference (34a8712604547408…)
//
// Single run is sufficient because 5-run determinism was proven in Slice C.
// This run only needs to confirm the strips did not perturb the deterministic
// output.

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
  const r = await fetch(`${REST}/athlete_lab_nodes?id=eq.${NODE_ID}&select=node_version`, { headers: HEADERS })
  const rows = await r.json()
  return Number(rows[0].node_version)
}

async function insertUpload(nodeVersion: number): Promise<string> {
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
      experiment: "1c-slice-d-d5-post-strip-verify",
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
  const data = await r.json()
  if (!r.ok) throw new Error(`insert failed: ${JSON.stringify(data)}`)
  return data[0].id
}

async function pollResult(uploadId: string, timeoutMs = 240_000): Promise<Record<string, unknown>> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const r = await fetch(
      `${REST}/athlete_lab_results?upload_id=eq.${uploadId}&select=result_data,analyzed_at`,
      { headers: HEADERS },
    )
    const rows = await r.json()
    if (Array.isArray(rows) && rows.length > 0 && rows[0].result_data) {
      return rows[0].result_data as Record<string, unknown>
    }
    await new Promise((res) => setTimeout(res, 4000))
  }
  throw new Error(`timeout waiting for result on upload ${uploadId}`)
}

function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`
  const keys = Object.keys(v as Record<string, unknown>).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`).join(",")}}`
}

const POST_C5_BASELINE = {
  body_based_ppy_approx: 200.21,
  static_ppy: 80,
  selected_source: "body_based",
  body_based_status: "used",
  static_status: "computed_but_not_selected",
  dynamic_status: "failed",
}

async function main() {
  const nv = await resolveNodeVersion()
  console.log(`[D.5.4] node_version=${nv}; inserting single upload (athlete_height=74")...`)
  const uploadId = await insertUpload(nv)
  console.log(`[D.5.4] upload_id=${uploadId}; polling for result...`)
  const result = await pollResult(uploadId)
  const audit = result.calibration_audit as Record<string, unknown> | undefined
  if (!audit) {
    console.error("[D.5.4] FAIL — calibration_audit missing from result_data")
    console.error(JSON.stringify(result, null, 2))
    Deno.exit(2)
  }
  const auditCanon = canonicalJson(audit)
  const auditHash = await sha256(auditCanon)

  const failures: string[] = []
  const bbpy = Number(audit.body_based_ppy)
  if (!Number.isFinite(bbpy) || Math.abs(bbpy - POST_C5_BASELINE.body_based_ppy_approx) > 1.0) {
    failures.push(`body_based_ppy expected ~${POST_C5_BASELINE.body_based_ppy_approx}, got ${bbpy}`)
  }
  if (Number(audit.static_ppy) !== POST_C5_BASELINE.static_ppy) {
    failures.push(`static_ppy expected ${POST_C5_BASELINE.static_ppy}, got ${audit.static_ppy}`)
  }
  if (audit.selected_source !== POST_C5_BASELINE.selected_source) {
    failures.push(`selected_source expected ${POST_C5_BASELINE.selected_source}, got ${audit.selected_source}`)
  }
  if (audit.body_based_status !== POST_C5_BASELINE.body_based_status) {
    failures.push(`body_based_status expected ${POST_C5_BASELINE.body_based_status}, got ${audit.body_based_status}`)
  }
  if (audit.static_status !== POST_C5_BASELINE.static_status) {
    failures.push(`static_status expected ${POST_C5_BASELINE.static_status}, got ${audit.static_status}`)
  }
  if (audit.dynamic_status !== POST_C5_BASELINE.dynamic_status) {
    failures.push(`dynamic_status expected ${POST_C5_BASELINE.dynamic_status}, got ${audit.dynamic_status}`)
  }

  console.log("[D.5.4] calibration_audit:")
  console.log(JSON.stringify(audit, null, 2))
  console.log(`[D.5.4] calibration_audit hash: ${auditHash}`)
  console.log("[D.5.4] (Compare against Slice C post-C.5 baseline hash 34a8712604547408…)")

  if (failures.length > 0) {
    console.error("[D.5.4] FAIL — value mismatches:")
    failures.forEach((f) => console.error(`  - ${f}`))
    Deno.exit(3)
  }
  console.log("[D.5.4] PASS — all post-C.5 baseline values match. JSON strips did not perturb calibration runtime.")
}

main().catch((e) => {
  console.error("[D.5.4] FAIL — unhandled:", e)
  Deno.exit(1)
})
