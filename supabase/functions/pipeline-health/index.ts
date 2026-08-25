// Pipeline health probe — active liveness check for every component required
// for a MediaPipe video pose analysis. Read-only: it never mutates pipeline
// state and never returns secret values (presence booleans only).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

type ProbeStatus = 'pass' | 'fail' | 'warn' | 'skip'

interface Probe {
  id: string
  group: string
  label: string
  status: ProbeStatus
  detail: string
  latency_ms?: number
}

const REFERENCE_CLIP_PATH = 'test-clips/slant-route-reference-v1.mp4'
const VIDEO_BUCKET = 'athlete-videos'
const HEALTH_TIMEOUT_MS = 30_000
const ANALYZE_TIMEOUT_MS = 120_000
const COLD_START_WARN_MS = 15_000
const ZOMBIE_AGE_MIN = 15

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function poseServiceUrl(): string {
  return (
    Deno.env.get('MEDIAPIPE_SERVICE_URL')?.trim() ||
    Deno.env.get('RTMLIB_URL')?.trim() ||
    ''
  )
}

/** Build `<origin>/<path>` from a configured service URL that may already
 * carry a path (e.g. `.../analyze`) or a trailing slash. */
function serviceEndpoint(base: string, path: 'health' | 'analyze'): string {
  try {
    return `${new URL(base).origin}/${path}`
  } catch {
    return `${base.replace(/\/+$/, '').replace(/\/(analyze|health)$/, '')}/${path}`
  }
}

/** Host only — safe to surface in a probe detail; never the full secret URL. */
function safeHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return 'pose service'
  }
}


async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function probe(
  id: string,
  group: string,
  label: string,
  status: ProbeStatus,
  detail: string,
  latency_ms?: number,
): Probe {
  return { id, group, label, status, detail, latency_ms }
}

/* ---------------------------------------------------------------- ingest --- */

async function probeStorage(): Promise<Probe[]> {
  const out: Probe[] = []
  const db = admin()

  try {
    const { data, error } = await db.storage.listBuckets()
    if (error) throw error
    const bucket = data?.find((b) => b.name === VIDEO_BUCKET)
    out.push(
      bucket
        ? probe('storage_bucket', 'Ingest', `Storage bucket "${VIDEO_BUCKET}" reachable`, 'pass', bucket.public ? 'Bucket found (public).' : 'Bucket found (private).')
        : probe('storage_bucket', 'Ingest', `Storage bucket "${VIDEO_BUCKET}" reachable`, 'fail', `Bucket "${VIDEO_BUCKET}" not found. Video uploads cannot land.`),
    )
  } catch (err) {
    out.push(probe('storage_bucket', 'Ingest', `Storage bucket "${VIDEO_BUCKET}" reachable`, 'fail', `Storage API error: ${(err as Error).message}`))
  }

  try {
    const { data, error } = await db.storage.from(VIDEO_BUCKET).createSignedUrl(REFERENCE_CLIP_PATH, 60)
    if (error) throw error
    out.push(
      data?.signedUrl
        ? probe('storage_signed_url', 'Ingest', 'Signed URL issuance works (reference clip)', 'pass', 'Signed URL minted for the slant-route reference clip — Cloud Run can fetch video.')
        : probe('storage_signed_url', 'Ingest', 'Signed URL issuance works (reference clip)', 'fail', 'Signing returned no URL.'),
    )
  } catch (err) {
    out.push(probe('storage_signed_url', 'Ingest', 'Signed URL issuance works (reference clip)', 'fail', `Could not sign ${REFERENCE_CLIP_PATH}: ${(err as Error).message}`))
  }

  return out
}

async function probeUploadsTable(): Promise<Probe> {
  try {
    const { error } = await admin().from('athlete_uploads').select('id', { count: 'exact', head: true })
    if (error) throw error
    return probe('uploads_table', 'Ingest', 'athlete_uploads table readable by service role', 'pass', 'Table reachable — the analysis queue is intact.')
  } catch (err) {
    return probe('uploads_table', 'Ingest', 'athlete_uploads table readable by service role', 'fail', (err as Error).message)
  }
}

/* --------------------------------------------------------------- trigger --- */

async function probeTriggerChain(): Promise<Probe[]> {
  const labels: Record<string, [string, string, string]> = {
    trigger_function_exists: ['trigger_function', 'trigger_analysis_on_upload() function exists', 'Missing — nothing will call the analyzer on upload.'],
    upload_trigger_exists: ['upload_trigger', 'on_athlete_upload_insert trigger enabled on athlete_uploads', 'Missing or disabled — uploads will sit at pending forever.'],
    pg_net_installed: ['pg_net', 'pg_net extension installed (trigger HTTP dependency)', 'Missing — the trigger cannot POST to the edge function.'],
  }

  try {
    const { data, error } = await admin().rpc('pipeline_health_introspect')
    if (error) throw error
    const result = (data ?? {}) as Record<string, boolean>
    return Object.entries(labels).map(([key, [id, label, failDetail]]) =>
      result[key]
        ? probe(id, 'Trigger', label, 'pass', 'Present and enabled.')
        : probe(id, 'Trigger', label, 'fail', failDetail),
    )
  } catch (err) {
    return Object.entries(labels).map(([, [id, label]]) =>
      probe(id, 'Trigger', label, 'fail', `Introspection failed: ${(err as Error).message}`),
    )
  }
}

/* --------------------------------------------------------- edge function --- */

function probeSecrets(): Probe[] {
  const out: Probe[] = []

  const poseUrl = poseServiceUrl()
  out.push(
    poseUrl
      ? probe('secret_pose_url', 'Edge Function', 'Pose service URL secret set (MEDIAPIPE_SERVICE_URL / RTMLIB_URL)', 'pass', 'Configured.')
      : probe('secret_pose_url', 'Edge Function', 'Pose service URL secret set (MEDIAPIPE_SERVICE_URL / RTMLIB_URL)', 'fail', 'Not set — the analyzer has no Cloud Run endpoint to call.'),
  )

  for (const [name, id] of [
    ['SUPABASE_URL', 'secret_supabase_url'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'secret_service_role'],
  ] as const) {
    const present = Boolean(Deno.env.get(name)?.trim())
    out.push(
      probe(id, 'Edge Function', `${name} available to functions`, present ? 'pass' : 'fail', present ? 'Present.' : 'Missing — result writes will fail.'),
    )
  }

  const lovable = Boolean(Deno.env.get('LOVABLE_API_KEY')?.trim())
  const anthropic = Boolean(Deno.env.get('ANTHROPIC_API_KEY')?.trim())
  out.push(
    lovable || anthropic
      ? probe('secret_llm_key', 'Edge Function', 'LLM key present (LOVABLE_API_KEY / ANTHROPIC_API_KEY)', 'pass', `Present: ${[lovable && 'LOVABLE_API_KEY', anthropic && 'ANTHROPIC_API_KEY'].filter(Boolean).join(', ')}.`)
      : probe('secret_llm_key', 'Edge Function', 'LLM key present (LOVABLE_API_KEY / ANTHROPIC_API_KEY)', 'fail', 'No LLM key — coaching feedback generation will fail.'),
  )

  return out
}

async function probeAnalyzerDeployed(): Promise<Probe> {
  const started = Date.now()
  try {
    // Empty body → the analyzer returns a 4xx it controls. Any HTTP answer
    // proves the function is deployed and booting; a network error does not.
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/functions/v1/analyze-athlete-video`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ healthProbe: true }),
      },
      HEALTH_TIMEOUT_MS,
    )
    const latency = Date.now() - started
    if (res.status === 404) {
      return probe('analyzer_deployed', 'Edge Function', 'analyze-athlete-video deployed and responding', 'fail', 'Function returned 404 — not deployed.', latency)
    }
    return probe('analyzer_deployed', 'Edge Function', 'analyze-athlete-video deployed and responding', 'pass', `Responding (HTTP ${res.status} to an empty probe payload, as expected).`, latency)
  } catch (err) {
    return probe('analyzer_deployed', 'Edge Function', 'analyze-athlete-video deployed and responding', 'fail', `Unreachable: ${(err as Error).message}`, Date.now() - started)
  }
}

/* ------------------------------------------------------------- cloud run --- */

async function probeCloudRunHealth(): Promise<Probe[]> {
  const base = poseServiceUrl()
  if (!base) {
    return [
      probe('cloudrun_up', 'Cloud Run Pose Service', 'Pose service /health responding', 'skip', 'No service URL configured.'),
      probe('cloudrun_model', 'Cloud Run Pose Service', 'MediaPipe model loaded', 'skip', 'No service URL configured.'),
      probe('cloudrun_latency', 'Cloud Run Pose Service', 'Cold-start latency acceptable', 'skip', 'No service URL configured.'),
    ]
  }

  const healthUrl = serviceEndpoint(base, 'health')
  const started = Date.now()
  try {
    const res = await fetchWithTimeout(healthUrl, { method: 'GET' }, HEALTH_TIMEOUT_MS)
    const latency = Date.now() - started
    const raw = await res.text()
    let body: Record<string, unknown> = {}
    try {
      body = JSON.parse(raw) as Record<string, unknown>
    } catch {
      body = {}
    }

    if (!res.ok || body.ok !== true) {
      const host = safeHost(healthUrl)
      const snippet = raw.trim().slice(0, 180)
      const detail = `HTTP ${res.status} from ${host}/health${snippet ? ` — ${snippet}` : ''}`
      return [
        probe('cloudrun_up', 'Cloud Run Pose Service', 'Pose service /health responding', 'fail', detail, latency),
        probe('cloudrun_model', 'Cloud Run Pose Service', 'MediaPipe model loaded', 'fail', 'Cannot read model — service unhealthy.'),
        probe('cloudrun_latency', 'Cloud Run Pose Service', 'Cold-start latency acceptable', 'skip', 'Service unhealthy.'),
      ]
    }

    const model = typeof body.model === 'string' ? body.model : ''
    return [
      probe('cloudrun_up', 'Cloud Run Pose Service', 'Pose service /health responding', 'pass', `Engine: ${String(body.engine ?? 'unknown')}.`, latency),
      model
        ? probe('cloudrun_model', 'Cloud Run Pose Service', 'MediaPipe model loaded', 'pass', `Model: ${model} (${String(body.model_path ?? 'path unknown')}).`)
        : probe('cloudrun_model', 'Cloud Run Pose Service', 'MediaPipe model loaded', 'warn', 'Service healthy but reported no model name.'),
      latency > COLD_START_WARN_MS
        ? probe('cloudrun_latency', 'Cloud Run Pose Service', 'Cold-start latency acceptable', 'warn', `Health probe took ${(latency / 1000).toFixed(1)}s — likely a cold start. Analyses will be slow until the instance warms.`, latency)
        : probe('cloudrun_latency', 'Cloud Run Pose Service', 'Cold-start latency acceptable', 'pass', `Health probe answered in ${latency}ms.`, latency),
    ]
  } catch (err) {
    const latency = Date.now() - started
    return [
      probe('cloudrun_up', 'Cloud Run Pose Service', 'Pose service /health responding', 'fail', `Unreachable: ${(err as Error).message}`, latency),
      probe('cloudrun_model', 'Cloud Run Pose Service', 'MediaPipe model loaded', 'fail', 'Cannot read model — service unreachable.'),
      probe('cloudrun_latency', 'Cloud Run Pose Service', 'Cold-start latency acceptable', 'skip', 'Service unreachable.'),
    ]
  }
}

async function probeCloudRunContract(deep: boolean): Promise<Probe> {
  const id = 'cloudrun_contract'
  const group = 'Cloud Run Pose Service'
  const label = '/analyze response contract intact (deep check)'

  if (!deep) return probe(id, group, label, 'skip', 'Deep check not requested.')

  const base = poseServiceUrl()
  if (!base) return probe(id, group, label, 'skip', 'No service URL configured.')

  const started = Date.now()
  try {
    const { data, error } = await admin().storage.from(VIDEO_BUCKET).createSignedUrl(REFERENCE_CLIP_PATH, 300)
    if (error || !data?.signedUrl) throw new Error(error?.message ?? 'could not sign reference clip')

    const analyzeUrl = `${base.replace(/\/+$/, '').replace(/\/analyze$/, '')}/analyze`
    const res = await fetchWithTimeout(
      analyzeUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: data.signedUrl, start_seconds: 0, end_seconds: 0.5, det_frequency: 1 }),
      },
      ANALYZE_TIMEOUT_MS,
    )
    if (!res.ok || !res.body) {
      return probe(id, group, label, 'fail', `HTTP ${res.status} from /analyze.`, Date.now() - started)
    }

    // NDJSON: skip keepalives, read the single result/error frame.
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let payload: Record<string, unknown> | null = null
    let failure = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        const frame = JSON.parse(line) as Record<string, unknown>
        if (frame.type === 'result') payload = frame.data as Record<string, unknown>
        else if (frame.type === 'error') failure = `${frame.status} — ${String(frame.detail)}`
      }
      if (payload || failure) break
    }
    reader.cancel().catch(() => {})

    const latency = Date.now() - started
    if (failure) return probe(id, group, label, 'fail', `Service reported: ${failure}`, latency)
    if (!payload) return probe(id, group, label, 'fail', 'Stream ended without a result frame.', latency)

    const required = ['keypoints', 'scores', 'world_keypoints', 'fps', 'frame_count']
    const missing = required.filter((k) => payload![k] === undefined || payload![k] === null)
    if (missing.length) {
      return probe(id, group, label, 'fail', `Response is missing: ${missing.join(', ')}. The deploy is out of contract with the analyzer.`, latency)
    }

    const frames = Number(payload.frame_count ?? 0)
    const worldOk = Array.isArray(payload.world_keypoints) && (payload.world_keypoints as unknown[]).length > 0
    return probe(
      id,
      group,
      label,
      frames > 0 && worldOk ? 'pass' : 'warn',
      `frame_count=${frames}, fps=${String(payload.fps)}, calibration_source=${String(payload.calibration_source ?? 'n/a')}, world_keypoints=${worldOk ? 'present' : 'empty'}.`,
      latency,
    )
  } catch (err) {
    return probe(id, group, label, 'fail', `Probe failed: ${(err as Error).message}`, Date.now() - started)
  }
}

/* ------------------------------------------------------- scoring + write --- */

async function probePublishedNode(): Promise<Probe> {
  const id = 'published_node'
  const group = 'Scoring & Write'
  const label = 'At least one published node with key metrics'
  try {
    const { data, error } = await admin()
      .from('athlete_lab_nodes')
      .select('id, name, status, key_metrics')
      .eq('status', 'published')
      .limit(50)
    if (error) throw error

    const withMetrics = (data ?? []).filter((n) => Array.isArray(n.key_metrics) && n.key_metrics.length > 0)
    if (!data?.length) {
      return probe(id, group, label, 'fail', 'No published nodes. Uploads against draft nodes fail silently (F-OPS-5).')
    }
    if (!withMetrics.length) {
      return probe(id, group, label, 'fail', `${data.length} published node(s) but none define key_metrics — scoring will produce nothing.`)
    }
    return probe(id, group, label, 'pass', `${withMetrics.length} published node(s) with metrics: ${withMetrics.slice(0, 3).map((n) => n.name).join(', ')}.`)
  } catch (err) {
    return probe(id, group, label, 'fail', (err as Error).message)
  }
}

async function probeResultsTable(): Promise<Probe> {
  const id = 'results_table'
  const group = 'Scoring & Write'
  const label = 'athlete_lab_results reachable by service role'
  try {
    const { error } = await admin().from('athlete_lab_results').select('id', { count: 'exact', head: true })
    if (error) throw error
    return probe(id, group, label, 'pass', 'Result table reachable — completed analyses can be written.')
  } catch (err) {
    return probe(id, group, label, 'fail', (err as Error).message)
  }
}

async function probeLlmGateway(deep: boolean): Promise<Probe> {
  const id = 'llm_gateway'
  const group = 'Scoring & Write'
  const label = 'LLM gateway reachable (deep check)'
  if (!deep) return probe(id, group, label, 'skip', 'Deep check not requested.')

  const key = Deno.env.get('LOVABLE_API_KEY')?.trim()
  if (!key) return probe(id, group, label, 'skip', 'LOVABLE_API_KEY not set; feedback runs through ANTHROPIC_API_KEY instead.')

  const started = Date.now()
  try {
    const res = await fetchWithTimeout(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
      },
      HEALTH_TIMEOUT_MS,
    )
    const latency = Date.now() - started
    if (res.status === 429) return probe(id, group, label, 'warn', 'Gateway rate-limited right now, but reachable.', latency)
    if (res.status === 402) return probe(id, group, label, 'fail', 'Gateway reports no credits remaining.', latency)
    if (!res.ok) return probe(id, group, label, 'fail', `HTTP ${res.status} from the gateway.`, latency)
    return probe(id, group, label, 'pass', 'Gateway answered a 1-token ping.', latency)
  } catch (err) {
    return probe(id, group, label, 'fail', `Unreachable: ${(err as Error).message}`, Date.now() - started)
  }
}

/* ------------------------------------------------------------ freshness --- */

async function probeFreshness(): Promise<Probe[]> {
  const out: Probe[] = []
  const db = admin()

  try {
    const { data, error } = await db
      .from('athlete_uploads')
      .select('id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) throw error
    const last = data?.[0]
    if (!last) {
      out.push(probe('last_upload', 'Freshness', 'Most recent upload', 'warn', 'No uploads recorded yet — the pipeline has never run.'))
    } else {
      const ageMin = Math.round((Date.now() - new Date(last.created_at).getTime()) / 60000)
      const ageLabel = ageMin < 60 ? `${ageMin} min ago` : `${Math.round(ageMin / 60)} h ago`
      out.push(
        probe('last_upload', 'Freshness', 'Most recent upload', last.status === 'failed' ? 'warn' : 'pass', `Status "${last.status}", ${ageLabel}.`),
      )
    }
  } catch (err) {
    out.push(probe('last_upload', 'Freshness', 'Most recent upload', 'fail', (err as Error).message))
  }

  try {
    const cutoff = new Date(Date.now() - ZOMBIE_AGE_MIN * 60_000).toISOString()
    const { count, error } = await db
      .from('athlete_uploads')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'processing'])
      .lt('created_at', cutoff)
    if (error) throw error
    const zombies = count ?? 0
    out.push(
      zombies === 0
        ? probe('zombie_uploads', 'Freshness', `No uploads stuck over ${ZOMBIE_AGE_MIN} min`, 'pass', 'Queue is clean.')
        : probe('zombie_uploads', 'Freshness', `No uploads stuck over ${ZOMBIE_AGE_MIN} min`, 'warn', `${zombies} upload(s) stuck in pending/processing (F-OPS-1 zombie signal).`),
    )
  } catch (err) {
    out.push(probe('zombie_uploads', 'Freshness', `No uploads stuck over ${ZOMBIE_AGE_MIN} min`, 'fail', (err as Error).message))
  }

  return out
}

/* ----------------------------------------------------------------- serve --- */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: 'Health probe misconfigured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY unavailable.' }, 500)
  }

  let deep = false
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    deep = body.deep === true
  } catch {
    deep = false
  }

  const startedAt = new Date().toISOString()
  const t0 = Date.now()

  const groups = await Promise.all([
    probeStorage(),
    probeUploadsTable().then((p) => [p]),
    probeTriggerChain(),
    Promise.resolve(probeSecrets()),
    probeAnalyzerDeployed().then((p) => [p]),
    probeCloudRunHealth(),
    probeCloudRunContract(deep).then((p) => [p]),
    probePublishedNode().then((p) => [p]),
    probeResultsTable().then((p) => [p]),
    probeLlmGateway(deep).then((p) => [p]),
    probeFreshness(),
  ])

  const probes = groups.flat()
  const summary = {
    pass: probes.filter((p) => p.status === 'pass').length,
    fail: probes.filter((p) => p.status === 'fail').length,
    warn: probes.filter((p) => p.status === 'warn').length,
    skip: probes.filter((p) => p.status === 'skip').length,
  }

  return json({
    ran_at: startedAt,
    deep,
    duration_ms: Date.now() - t0,
    summary,
    healthy: summary.fail === 0,
    probes,
  })
})
