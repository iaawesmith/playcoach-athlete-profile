// Step 5 smoke test — verify export reflects coaching_cues + migration status.
import { generateTabMarkdown, generateFullNodeMarkdown } from "/dev-server/src/features/athlete-lab/utils/nodeExport";

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
const r = await fetch(`${url}/rest/v1/athlete_lab_nodes?name=ilike.*slant*&select=*&limit=1`, {
  headers: { apikey: key!, Authorization: `Bearer ${key}` },
});
const [slant] = await r.json();

let pass = 0, fail = 0;
const t = (l: string, c: boolean, x?: unknown) => { if (c) { pass++; console.log("PASS", l); } else { fail++; console.log("FAIL", l, x ?? ""); } };

// --- Case A: live Slant (unmigrated, status=pending, no coaching_cues populated) ---
const basicsA = generateTabMarkdown(slant, "basics");
const phasesA = generateTabMarkdown(slant, "phases");
const fullA = generateFullNodeMarkdown(slant);

t("A.basics: includes migration status line", basicsA.includes("Coaching Cues Migration Status: pending"));
t("A.phases: includes migration status line", phasesA.includes("Coaching Cues Migration Status: pending"));
t("A.phases: no Coaching Cues subsection (cues empty)", !phasesA.includes("#### Coaching Cues"));
t("A.full: migration status appears (basics + phases)", (fullA.match(/Coaching Cues Migration Status: pending/g) ?? []).length >= 2);
t("A.full: still no Coaching Cues subsection", !fullA.includes("#### Coaching Cues"));

// --- Case B: post-migration synthetic (status=in_progress, 2/5 phases populated) ---
const slantB = JSON.parse(JSON.stringify(slant));
slantB.coaching_cues_migration_status = "in_progress";
slantB.phase_breakdown[0].coaching_cues = "Drive off the line decisively. Sell vertical.";
slantB.phase_breakdown[2].coaching_cues = "Plant explosively, snap hips at 45 degrees.";
const phasesB = generateTabMarkdown(slantB, "phases");
t("B.phases: status=in_progress", phasesB.includes("Coaching Cues Migration Status: in_progress"));
t("B.phases: Coaching Cues for phase 1", phasesB.includes("#### Coaching Cues\nDrive off the line decisively. Sell vertical."));
t("B.phases: Coaching Cues for phase 3", phasesB.includes("#### Coaching Cues\nPlant explosively, snap hips at 45 degrees."));
t("B.phases: only 2 Coaching Cues subsections", (phasesB.match(/#### Coaching Cues/g) ?? []).length === 2);
t("B.phases: phase 2 (no cues) skipped subsection", !phasesB.split("Phase 2:")[1]?.split("Phase 3:")[0]?.includes("#### Coaching Cues"));

// --- Case C: fully confirmed synthetic (status=confirmed, all 5 phases populated, with whitespace edge cases) ---
const slantC = JSON.parse(JSON.stringify(slant));
slantC.coaching_cues_migration_status = "confirmed";
for (let i = 0; i < slantC.phase_breakdown.length; i++) {
  slantC.phase_breakdown[i].coaching_cues = `Cue ${i + 1} body text.`;
}
// Edge case: whitespace-only cue should NOT render the subsection
slantC.phase_breakdown[1].coaching_cues = "   \n   ";
const phasesC = generateTabMarkdown(slantC, "phases");
t("C.phases: status=confirmed", phasesC.includes("Coaching Cues Migration Status: confirmed"));
t("C.phases: 4 Coaching Cues subsections (whitespace-only skipped)", (phasesC.match(/#### Coaching Cues/g) ?? []).length === 4);
t("C.phases: phase 1 cue rendered", phasesC.includes("#### Coaching Cues\nCue 1 body text."));
t("C.phases: phase 5 cue rendered", phasesC.includes("#### Coaching Cues\nCue 5 body text."));

// --- Case D: existing tabs unaffected ---
const mechanicsA = generateTabMarkdown(slant, "mechanics");
t("D.mechanics tab: still emits sections from pro_mechanics (untouched)", mechanicsA.includes("## Mechanics") && mechanicsA.includes("Release"));
const metricsA = generateTabMarkdown(slant, "metrics");
t("D.metrics tab: still emits", metricsA.includes("## Metrics"));
t("D.metrics tab: no Coaching Cues leakage", !metricsA.includes("#### Coaching Cues") && !metricsA.includes("Coaching Cues Migration Status"));

console.log(`\n--- ${pass} passed, ${fail} failed ---`);
process.exit(fail === 0 ? 0 : 1);
