import { contextDisplayValue, LIBRARY_CONTEXT_LABELS } from "@/services/libraryRunContext";

export function LibraryRunContextPanel({ context }: { context: Record<string, unknown> }) {
  if (context.source !== "calibration_library") return null;
  const overrides = Array.isArray(context.overrides) ? context.overrides : [];
  return (
    <section className="space-y-3 bg-surface-container p-5" aria-label="Run context">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Run context</h3>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(Object.keys(LIBRARY_CONTEXT_LABELS) as Array<keyof typeof LIBRARY_CONTEXT_LABELS>).map((field) => {
          const override: unknown = overrides.find((entry: unknown) => typeof entry === "object" && entry !== null && "field" in entry && entry.field === field);
          const original = typeof override === "object" && override !== null && "clip_value" in override ? override.clip_value : undefined;
          return (
            <div key={field} className="min-w-0 text-xs">
              <dt className="uppercase text-on-surface-variant">{LIBRARY_CONTEXT_LABELS[field]}</dt>
              <dd className="mt-1 break-words text-on-surface">{contextDisplayValue(context[field])}
                {override !== undefined && <span className="ml-2 text-primary">OVERRIDE · clip: {contextDisplayValue(original)}</span>}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}