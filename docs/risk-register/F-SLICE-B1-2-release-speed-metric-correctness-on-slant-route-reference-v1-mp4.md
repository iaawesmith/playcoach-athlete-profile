---
id: F-SLICE-B1-2
title: Release Speed metric correctness on `slant-route-reference-v1.mp4` — REFRAMED 2026-04-26 (status: needs verification with known-speed clip)
status: open
severity: Sev-3
origin_slice: 1c.2-Slice-B1
origin_doc: docs/process/phase-1c2-slice-b1-outcome.md
related_adrs: [ADR-0004]
related_entries: []
opened: 2026-04-26
last_updated: 2026-04-26
---

# F-SLICE-B1-2 — Release Speed metric correctness on `slant-route-reference-v1.mp4` — REFRAMED 2026-04-26 (status: needs verification with known-speed clip)

- **Phase:** deferred to Phase 2 (calibration / metric audit work)
- **Severity:** **Sev-3** (downgraded 2026-04-26 from Sev-2; previous Sev-2 assumed a confirmed independent metric-math bug that the reframing no longer supports)
- **Likelihood:** Unknown until tested against a known-speed clip
- **Status (2026-04-26):** **Reframed from "confirmed metric bug" to "needs verification with a known-speed test clip."** Do **not** close — verification still required.
- **Original framing (now superseded):** Per `docs/phase-1c2-determinism-experiment.md` Section D and `docs/release-speed-velocity-investigation.md`, Release Speed of 158.94 mph (Slice B1 baseline) and 3.37 mph (Section B current) were both interpreted as evidence of an independent metric-math bug *beyond* calibration error, on the assumption the rep being measured was a full-effort game-speed release for which 5–10 mph is the credible window.
- **Reframing trigger:** Re-watching `slant-route-reference-v1.mp4`, the athlete performs a foot shuffle and a controlled-tempo release — **not** a full-burst attack off the line. Realistic ground-truth release speed for *this specific rep* is approximately **1–2 mph**, not 5–7 mph. The 5–10 mph window only applies to a full-effort game-speed release.
- **Reframed interpretation:**
  - **158.94 mph (Slice B1 baseline)** is explainable by severe calibration error alone — when ppy was way off, velocity inflated ~100×.
  - **1.34 mph (Slice D diagnostic, edge-path body_based ppy ~201.78)** is plausibly approximately correct for what the athlete actually did: a slow controlled rep at better calibration. It is **no longer evidence of a metric-math bug** under the corrected ground-truth assumption.
- **What this changes:** Calibration may be the dominant error source for **all** distance/velocity metrics on this clip, with **no separate metric formula bug confirmed**. This shifts the relative priority weighting between:
  - **Phase 2a — world coordinates / calibration redesign (B2 work):** may resolve more issues than originally scoped.
  - **Phase 2b — metric formula audits:** may have a smaller surface area than the prior "confirmed bug" framing implied.
- **Verification gate (required before this finding can be closed or reopened as a confirmed bug):**
  1. Acquire or film a **known-speed test clip** — a timed 40-yard-dash style rep with stopwatch ground-truth speed (or equivalent independently-measured velocity reference).
  2. Run the pipeline against that clip and compare reported Release Speed against the ground-truth value.
  3. If Release Speed produces sensible numbers when input speed is known → close F-SLICE-B1-2; the metric is calibration-dominated and Phase 2a alone is sufficient.
  4. If Release Speed is still off by an order of magnitude after calibration is on a known-good clip → reopen as a confirmed independent metric-math bug; Phase 2b retains its prior priority.
- **Cross-references:** `docs/release-speed-velocity-investigation.md` (original "single-sample lottery" hypothesis — still on the table as a candidate root cause if the verification clip fails); `docs/phase-1c2-determinism-experiment.md` Section D (original framing); `docs/phase-1c2-diagnostic-snapshot-2026-04-26.md` §5.3 (1.34 mph current value).
- **Do not act in Phase 1c.2.** No code change. Backlog item gated on verification clip availability.
