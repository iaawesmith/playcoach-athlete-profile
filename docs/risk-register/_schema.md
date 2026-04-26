# Risk-register entry schema

This directory holds the canonical record of Phase 1c risks (`R-NN`) and findings (`F-*`). One file per entry; IDs are immutable. The aggregated view + meta-commentary lives in [`INDEX.md`](INDEX.md). The original combined doc was split during Phase 1c.2 cleanup (Pass 4); a redirect stub remains at `docs/migration-risk-register.md` and is registered in the `docs/process/phase-1c3-prep-backlog.md` cleanup queue.

## File naming

- `R-NN-<kebab-slug>.md` for risks (e.g., `R-04-backup-table-omits-text-bearing-field.md`).
- `F-<area>-<n>-<kebab-slug>.md` for findings (e.g., `F-SLICE-B-1-both-calibration-paths-2-6x-distance-errors.md`).

Slugs are derived from the original `### {ID} — {title}` heading. Truncate slugs at ~10 words; preserve technical tokens (`pro_mechanics`, `body_based`, `det_frequency`, etc.) verbatim where they appear.

## Frontmatter contract

Every entry file starts with YAML frontmatter using these fields. Fields whose value cannot be derived from the original prose are **flagged** as `TODO` rather than guessed.

```yaml
---
id: R-NN | F-<AREA>-<N>          # immutable; matches the original ID verbatim
title: <one-line summary>         # taken from the original ### heading after the em-dash
status: open | mitigated | resolved | deferred | closed | superseded
severity: Sev-1 | Sev-2 | Sev-3 | Sev-4 | none   # "none" only for process-lesson findings (e.g., F-SLICE-E-3)
origin_slice: 1c.0 | 1c.1 | 1c.2 | 1c.2-Slice-A | 1c.2-Slice-B | 1c.2-Slice-B1 | 1c.2-Slice-C | 1c.2-Slice-C.5 | 1c.2-Slice-D | 1c.2-Slice-E | 1c.2-Slice-E.5 | 1c.3 | post-1c
origin_doc: <relative path to the slice-outcome / investigation doc that surfaced this entry>
related_adrs: []                  # list of ADR-NNNN IDs (see docs/adr/INDEX.md). Empty list if none. See "related_adrs derivation" below.
related_entries: []               # list of cross-referenced R-/F- IDs from this register
opened: YYYY-MM-DD                # date the entry was first logged. From the prose "Logged:" field, or §0 header date for original-batch entries.
last_updated: YYYY-MM-DD          # date of the most recent in-prose update. Matches `opened` if the entry has not been revised.
---
```

### `related_adrs` derivation

- **For entries created during Pass 4 split:** `related_adrs` was derived from the canonical Pass 3d ADR set (see [`docs/adr/INDEX.md`](../adr/INDEX.md)) plus entry context — i.e., judgment about which decisions each entry connects to.
- **For new entries going forward:** populate `related_adrs` directly at creation time based on actual ADR connections. Do not rely on automatic or retroactive derivation.

## Body shape

Frontmatter is followed by the original prose, mechanically lifted with no rewording. Section order preserved. The `### {ID} — {title}` heading becomes a single-`#` H1 in the new file:

```markdown
# {ID} — {title}

- **Phase:** ...
- **Severity:** ...
- ...
```

Cross-references to other R-/F- IDs in the prose are left as plain text in this pass (e.g., `R-04`, `F-SLICE-E-4`). A future maintenance pass MAY wikilink them; out of scope for Pass 4.

## Status field derivation

The `status` value is derived from the original `**Status:**` prose line where present, mapped:

| Prose phrase | Frontmatter value |
|---|---|
| "Mitigated", "Mitigated — Slice N shipped" | `mitigated` |
| "Resolved via …", "Resolved" | `resolved` |
| "Open", "Open. Must …" | `open` |
| "Deferred", "Deferred to Phase N" | `deferred` |
| "Closed", "Closed. Mitigation …" | `closed` |
| "Superseded by …" | `superseded` |
| (no explicit status line) | `open` (default for original-batch R-* entries authored 2026-04-25) |

When the prose contains both "deferred" and a date-stamped follow-up status (e.g., F-SLICE-B-1 has Option A withdrawn but B2 deferred), prefer the most recent status from the most recent `Status (YYYY-MM-DD):` line.

## Origin-slice field derivation

| Prose marker | `origin_slice` |
|---|---|
| `Phase: 1c.0`, foundation-batch entries (no explicit "Logged:" date) | `1c.0` |
| `Phase: 1c.1` | `1c.1` |
| `Phase: 1c.2` | `1c.2` |
| `Logged: ..., Slice E pre-flight (E.0)` | `1c.2-Slice-E` |
| `Logged: ..., Slice E pre-flight (Option C scan)` | `1c.2-Slice-E` |
| `Logged: ..., Slice E E.1 Gate 5 halt` | `1c.2-Slice-E` |
| `Logged: ..., Slice E E.2 migration security linter check` | `1c.2-Slice-E` |
| Heading under §5 "Slice E E.5 findings" | `1c.2-Slice-E.5` |

## Origin-doc field derivation

`origin_doc` points to the slice outcome or investigation doc that surfaced the entry. Where the original prose includes a "Cross-reference:" or "Cross-references:" pointing at exactly one slice outcome, that path is used. Where multiple paths are listed, the most-specific slice outcome is used. Where none is given, `docs/migration-risk-register.md` (the original batch doc) is used and the path is annotated `# original-batch entry`.

## Pass 4 split-script lesson (preserved for future maintenance)

The Pass 4 split was performed by a Python script that assumed `###` entry headers don't have intervening `##` section headers between them. That assumption was wrong: a meta-section (§2 Heatmap, §3.5 Comparison Invariants, etc.) appeared between `### F-SEC-1` and the next `###` entry, causing `F-SEC-1` to absorb everything up to the next entry header. The bug was caught and corrected mid-pass by stopping entry bodies at any intervening `##` header.

Future splits or maintenance scripts should not make this assumption. Verify entry boundaries against the actual section structure (both `##` and `###` headers, plus end-of-file) before lifting bodies.
