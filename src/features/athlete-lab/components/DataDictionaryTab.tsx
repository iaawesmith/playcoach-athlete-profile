import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DictionaryField {
  id: string;
  label: string;
  tab: string;
  supabase_table: string;
  supabase_column: string;
  type: string;
  default: unknown;
  required_for_live: boolean;
  athletelab_status: "implemented" | "in_progress" | "not_built";
  supabase_status: "column_exists" | "needs_migration" | "missing";
  mmpose_status: "direct_mapping" | "indirect_mapping" | "llm_only" | "not_applicable";
  mmpose_category: string;
  rtmlib_reference: string | null;
  description: string;
  notes: string | null;
  added: string;
  added_by: string;
}

interface DictionaryData {
  meta: Record<string, unknown>;
  fields: DictionaryField[];
  summary: Record<string, unknown>;
}

type StatusFilter = "needs_work" | "all_clear" | "show_all";
type MmposeFilter = "all" | "direct_mapping" | "indirect_mapping" | "not_applicable";

const GITHUB_URL =
  "https://raw.githubusercontent.com/iaawesmith/playcoach-athlete-profile/main/docs/data-dictionary/fields.json";

/* ------------------------------------------------------------------ */
/*  Tab color mapping                                                  */
/* ------------------------------------------------------------------ */

const TAB_COLORS: Record<string, { bg: string; text: string }> = {
  Basics: { bg: "bg-blue-900/40", text: "text-blue-300" },
  Videos: { bg: "bg-blue-900/40", text: "text-blue-300" },
  Overview: { bg: "bg-blue-900/40", text: "text-blue-300" },
  Phases: { bg: "bg-teal-900/40", text: "text-teal-300" },
  Mechanics: { bg: "bg-teal-900/40", text: "text-teal-300" },
  Metrics: { bg: "bg-green-900/40", text: "text-green-300" },
  Scoring: { bg: "bg-amber-900/40", text: "text-amber-300" },
  Errors: { bg: "bg-amber-900/40", text: "text-amber-300" },
  Reference: { bg: "bg-purple-900/40", text: "text-purple-300" },
  Camera: { bg: "bg-purple-900/40", text: "text-purple-300" },
  "LLM Prompt": { bg: "bg-pink-900/40", text: "text-pink-300" },
  Badges: { bg: "bg-pink-900/40", text: "text-pink-300" },
  "Training Status": { bg: "bg-orange-900/40", text: "text-orange-300" },
};

function getTabColor(tab: string) {
  return TAB_COLORS[tab] || { bg: "bg-surface-container-high", text: "text-on-surface-variant" };
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

function StatusIcon({ status, type }: { status: string; type: "athletelab" | "supabase" }) {
  const map: Record<string, { icon: string; color: string; label: string }> = {
    implemented: { icon: "check_circle", color: "text-green-400", label: "Implemented" },
    in_progress: { icon: "warning", color: "text-amber-400", label: "In Progress" },
    not_built: { icon: "cancel", color: "text-red-400", label: "Not Built" },
    column_exists: { icon: "check_circle", color: "text-green-400", label: "Column Exists" },
    needs_migration: { icon: "warning", color: "text-amber-400", label: "Needs Migration" },
    missing: { icon: "cancel", color: "text-red-400", label: "Missing" },
  };
  const entry = map[status];
  if (!entry) return null;
  return (
    <span title={entry.label} className={`material-symbols-outlined ${entry.color} cursor-help`} style={{ fontSize: 18 }}>
      {entry.icon}
    </span>
  );
}

function MmposePill({ status, rtmlibRef }: { status: string; rtmlibRef: string | null }) {
  const map: Record<string, { icon: string; color: string; pillBg: string; pillText: string; label: string }> = {
    direct_mapping: { icon: "check_circle", color: "text-green-400", pillBg: "bg-green-900/40", pillText: "text-green-300", label: "DIRECT" },
    indirect_mapping: { icon: "warning", color: "text-amber-400", pillBg: "bg-amber-900/40", pillText: "text-amber-300", label: "INDIRECT" },
    llm_only: { icon: "psychology", color: "text-blue-400", pillBg: "bg-blue-900/40", pillText: "text-blue-300", label: "LLM" },
    not_applicable: { icon: "remove", color: "text-on-surface-variant/40", pillBg: "bg-surface-container-high", pillText: "text-on-surface-variant/60", label: "N/A" },
  };
  const entry = map[status];
  if (!entry) return null;
  return (
    <span title={rtmlibRef || status} className="inline-flex items-center gap-1 cursor-help">
      <span className={`material-symbols-outlined ${entry.color}`} style={{ fontSize: 14 }}>{entry.icon}</span>
      <span className={`${entry.pillBg} ${entry.pillText} text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full`}>{entry.label}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  DataDictionaryTab                                                  */
/* ------------------------------------------------------------------ */

export function DataDictionaryTab() {
  const [data, setData] = useState<DictionaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Filters
  const [tabFilter, setTabFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("show_all");
  const [mmposeFilter, setMmposeFilter] = useState<MmposeFilter>("all");

  const loadFromCache = useCallback(async (): Promise<{ data: DictionaryData; synced: string } | null> => {
    try {
      const { data: row } = await supabase
        .from("admin_reference_cache")
        .select("data, synced_at")
        .eq("cache_key", "data_dictionary")
        .maybeSingle();
      if (row?.data) {
        return { data: row.data as unknown as DictionaryData, synced: row.synced_at };
      }
    } catch { /* fallback to localStorage */ }
    const cached = localStorage.getItem("dd_cache");
    if (cached) {
      const parsed = JSON.parse(cached);
      return { data: parsed.data, synced: parsed.synced_at };
    }
    return null;
  }, []);

  const fetchFromGitHub = useCallback(async (): Promise<DictionaryData> => {
    const res = await fetch(GITHUB_URL);
    if (!res.ok) throw new Error("GitHub fetch failed");
    return res.json();
  }, []);

  const saveToCache = useCallback(async (d: DictionaryData) => {
    const now = new Date().toISOString();
    try {
      const jsonData = JSON.parse(JSON.stringify(d));
      const { data: existing } = await supabase
        .from("admin_reference_cache")
        .select("id")
        .eq("cache_key", "data_dictionary")
        .maybeSingle();
      if (existing) {
        await supabase.from("admin_reference_cache").update({ data: jsonData, synced_at: now }).eq("cache_key", "data_dictionary");
      } else {
        await supabase.from("admin_reference_cache").insert([{ cache_key: "data_dictionary", data: jsonData, synced_at: now }]);
      }
    } catch {
      localStorage.setItem("dd_cache", JSON.stringify({ data: d, synced_at: now }));
    }
    setSyncedAt(now);
  }, []);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    const cached = await loadFromCache();
    if (cached) {
      setData(cached.data);
      setSyncedAt(cached.synced);
      setLoading(false);
      return;
    }
    try {
      const fresh = await fetchFromGitHub();
      setData(fresh);
      await saveToCache(fresh);
    } catch {
      // no cache + no github
    }
    setLoading(false);
  }, [loadFromCache, fetchFromGitHub, saveToCache]);

  useEffect(() => { initialLoad(); }, [initialLoad]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const fresh = await fetchFromGitHub();
      setData(fresh);
      await saveToCache(fresh);
    } catch {
      toast("Could not reach GitHub — showing cached version", { style: { background: "#92400e", color: "#fef3c7" } });
    }
    setRefreshing(false);
  };

  // Filtering
  const fields = data?.fields || [];
  const uniqueTabs = [...new Set(fields.map((f) => f.tab))].sort();

  const filtered = fields.filter((f) => {
    if (tabFilter !== "all" && f.tab !== tabFilter) return false;
    if (statusFilter === "needs_work" && f.athletelab_status === "implemented" && f.supabase_status === "column_exists") return false;
    if (statusFilter === "all_clear" && (f.athletelab_status !== "implemented" || f.supabase_status !== "column_exists")) return false;
    if (mmposeFilter !== "all" && f.mmpose_status !== mmposeFilter) return false;
    return true;
  });

  // Summary counts (from filtered)
  const totalCount = filtered.length;
  const builtCount = filtered.filter((f) => f.athletelab_status === "implemented").length;
  const migrationCount = filtered.filter((f) => f.supabase_status === "needs_migration" || f.supabase_status === "missing").length;
  const directCount = filtered.filter((f) => f.mmpose_status === "direct_mapping").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-16 h-16 rounded-xl bg-surface-container flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 32 }}>database</span>
        </div>
        <p className="text-on-surface font-bold text-sm">Data Dictionary not loaded</p>
        <p className="text-on-surface-variant text-xs mt-1 max-w-xs">
          Could not load fields.json from GitHub. Check your connection and click Refresh to try again.
        </p>
        <button onClick={handleRefresh} disabled={refreshing} className="mt-4 h-9 px-5 rounded-full bg-surface-container border border-outline-variant/10 text-on-surface-variant font-black uppercase tracking-[0.2em] text-[10px] hover:bg-surface-container-high transition-all active:scale-95 flex items-center gap-1.5">
          {refreshing ? (
            <div className="w-4 h-4 rounded-full border-2 border-on-surface-variant border-t-transparent animate-spin" />
          ) : (
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
          )}
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-on-surface font-extrabold uppercase tracking-tight text-sm">Data Dictionary</h2>
          <p className="text-on-surface-variant text-xs mt-1">Field definitions, data types, and Supabase schema reference for AthleteLab.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          {syncedAt && (
            <span className="text-on-surface-variant/40 text-[10px]">
              Last synced: {new Date(syncedAt).toLocaleString()}
            </span>
          )}
          <button onClick={handleRefresh} disabled={refreshing} className="h-8 px-3 rounded-full bg-surface-container border border-outline-variant/10 text-on-surface-variant font-black uppercase tracking-[0.2em] text-[10px] hover:bg-surface-container-high transition-all active:scale-95 flex items-center gap-1.5">
            {refreshing ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-on-surface-variant border-t-transparent animate-spin" />
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="bg-surface-container rounded-xl px-4 py-2.5 border border-outline-variant/10 text-xs flex items-center gap-2 flex-wrap">
        <span className="text-on-surface font-bold">{totalCount}</span>
        <span className="text-on-surface-variant">fields ·</span>
        <span className="text-green-400 font-bold">{builtCount}</span>
        <span className="text-on-surface-variant">built ·</span>
        <span className="text-amber-400 font-bold">{migrationCount}</span>
        <span className="text-on-surface-variant">migrations needed ·</span>
        <span className="text-green-400 font-bold">{directCount}</span>
        <span className="text-on-surface-variant">direct MMPose connections</span>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Tab filter */}
        <select
          value={tabFilter}
          onChange={(e) => setTabFilter(e.target.value)}
          className="h-8 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant/10 text-on-surface text-xs focus:outline-none focus:border-primary-container/30 transition-colors"
        >
          <option value="all">All tabs</option>
          {uniqueTabs.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Status filter */}
        <div className="inline-flex bg-surface-container rounded-full p-0.5 border border-outline-variant/10">
          {([
            { id: "needs_work" as StatusFilter, icon: "warning", label: "Needs Work" },
            { id: "all_clear" as StatusFilter, icon: "check_circle", label: "All Clear" },
            { id: "show_all" as StatusFilter, icon: "", label: "Show All" },
          ]).map((s) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={`px-3 py-1.5 rounded-full font-black uppercase tracking-[0.1em] text-[9px] transition-all flex items-center gap-1 ${
                statusFilter === s.id
                  ? "bg-primary-container text-[#00460a]"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {s.icon && <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{s.icon}</span>}
              {s.label}
            </button>
          ))}
        </div>

        {/* MMPose filter */}
        <select
          value={mmposeFilter}
          onChange={(e) => setMmposeFilter(e.target.value as MmposeFilter)}
          className="h-8 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant/10 text-on-surface text-xs focus:outline-none focus:border-primary-container/30 transition-colors"
        >
          <option value="all">All MMPose</option>
          <option value="direct_mapping">Direct</option>
          <option value="indirect_mapping">Indirect</option>
          <option value="not_applicable">N/A</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-outline-variant/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-container-high border-b border-outline-variant/10">
                <th className="px-3 py-2.5 text-left text-on-surface-variant text-[10px] font-black uppercase tracking-[0.15em]">Tab</th>
                <th className="px-3 py-2.5 text-left text-on-surface-variant text-[10px] font-black uppercase tracking-[0.15em]">Field Label</th>
                <th className="px-3 py-2.5 text-left text-on-surface-variant text-[10px] font-black uppercase tracking-[0.15em]">Supabase Column</th>
                <th className="px-3 py-2.5 text-center text-on-surface-variant text-[10px] font-black uppercase tracking-[0.15em]">AthleteLab</th>
                <th className="px-3 py-2.5 text-center text-on-surface-variant text-[10px] font-black uppercase tracking-[0.15em]">Supabase</th>
                <th className="px-3 py-2.5 text-left text-on-surface-variant text-[10px] font-black uppercase tracking-[0.15em]">MMPose</th>
                <th className="px-3 py-2.5 text-center text-on-surface-variant text-[10px] font-black uppercase tracking-[0.15em]" title="Red dot = required before node can go Live">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-16 text-center text-on-surface-variant">No fields match current filters.</td>
                </tr>
              )}
              {filtered.map((f, i) => {
                const tabColor = getTabColor(f.tab);
                const isExpanded = expandedRow === f.id;
                return (
                  <FieldRow
                    key={f.id}
                    field={f}
                    tabColor={tabColor}
                    isExpanded={isExpanded}
                    isOdd={i % 2 === 1}
                    onClick={() => setExpandedRow(isExpanded ? null : f.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FieldRow                                                           */
/* ------------------------------------------------------------------ */

function FieldRow({
  field: f,
  tabColor,
  isExpanded,
  isOdd,
  onClick,
}: {
  field: DictionaryField;
  tabColor: { bg: string; text: string };
  isExpanded: boolean;
  isOdd: boolean;
  onClick: () => void;
}) {
  return (
    <>
      <tr
        onClick={onClick}
        className={`border-b border-outline-variant/5 cursor-pointer hover:bg-surface-container-high/50 transition-colors ${
          isOdd ? "bg-surface-container/30" : ""
        } ${isExpanded ? "bg-surface-container-high/70" : ""}`}
      >
        {/* Tab */}
        <td className="px-3 py-2.5">
          <span className={`${tabColor.bg} ${tabColor.text} text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap`}>
            {f.tab}
          </span>
        </td>

        {/* Field Label */}
        <td className="px-3 py-2.5 min-w-[200px]">
          <p className="text-on-surface font-bold text-xs">{f.label}</p>
          <p className="text-on-surface-variant/60 text-[10px] mt-0.5 line-clamp-1">{f.description}</p>
        </td>

        {/* Supabase Column */}
        <td className="px-3 py-2.5">
          <p className="font-mono text-green-400/70 text-[11px]">{f.supabase_table}.{f.supabase_column}</p>
          <p className="text-on-surface-variant/40 text-[10px] mt-0.5 font-mono">{f.type}</p>
        </td>

        {/* AthleteLab status */}
        <td className="px-3 py-2.5 text-center">
          <StatusIcon status={f.athletelab_status} type="athletelab" />
        </td>

        {/* Supabase status */}
        <td className="px-3 py-2.5 text-center">
          <StatusIcon status={f.supabase_status} type="supabase" />
        </td>

        {/* MMPose */}
        <td className="px-3 py-2.5">
          <MmposePill status={f.mmpose_status} rtmlibRef={f.rtmlib_reference} />
        </td>

        {/* Required for Live */}
        <td className="px-3 py-2.5 text-center">
          {f.required_for_live && (
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" title="Required for Live" />
          )}
        </td>
      </tr>

      {/* Expanded detail */}
      {isExpanded && (
        <tr className="bg-surface-container-high/40">
          <td colSpan={7} className="px-6 py-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.15em] mb-1">Description</p>
                <p className="text-on-surface/80">{f.description}</p>
              </div>
              {f.rtmlib_reference && (
                <div>
                  <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.15em] mb-1">rtmlib Reference</p>
                  <p className="text-on-surface/80">{f.rtmlib_reference}</p>
                </div>
              )}
              <div>
                <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.15em] mb-1">Default Value</p>
                <p className="text-on-surface/80 font-mono">{f.default === null ? "null" : String(f.default)}</p>
              </div>
              {f.notes && (
                <div>
                  <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.15em] mb-1">Notes</p>
                  <p className="text-on-surface/80">{f.notes}</p>
                </div>
              )}
              <div>
                <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.15em] mb-1">Added</p>
                <p className="text-on-surface/80">{f.added} by {f.added_by}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
