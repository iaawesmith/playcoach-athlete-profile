import { useEffect, useState } from "react";
import type { KnowledgeSection } from "../types";
import { GuideButton } from "@/components/GuideButton";
import { SETUP_GUIDE } from "../utils/setupGuide";

interface TabDef { key: string; label: string; icon: string }
interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
  tabKey: string;
  tabLabel: string;
  tabs: TabDef[];
  onTabChange: (key: string) => void;
  knowledgeBase: Record<string, KnowledgeSection[]>;
  onKnowledgeBaseChange: (kb: Record<string, KnowledgeSection[]>) => void;
  nodeId: string;
  onNodeSaved?: (updatedNode: unknown) => void;
}

const REDIRECTS: Record<string, string> = {
  scoring: "metrics", errors: "metrics", camera: "reference", "filming-guidance": "reference",
  checkpoints: "phases", mechanics: "phases", overview: "basics", training_status: "basics",
  "training-status": "basics", "pipeline-config": "basics",
};

/** The active guide is shared; original stored knowledge is a read-only node archive. */
export function HelpDrawer({ open, onClose, tabKey, onTabChange, knowledgeBase }: HelpDrawerProps) {
  const [selectedKey, setSelectedKey] = useState("basics");
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const archived = Object.entries(knowledgeBase).flatMap(([tab, sections]) =>
    sections.map((section, index) => ({ ...section, tab, archiveKey: `${tab}:${index}:${section.id}` })),
  );
  useEffect(() => {
    if (open) setSelectedKey(REDIRECTS[tabKey] ?? tabKey);
  }, [open, tabKey]);
  if (!open) return null;
  const isArchive = selectedKey === "archive";
  const guide = SETUP_GUIDE.find(p => p.tab === selectedKey) ?? SETUP_GUIDE[0];
  const archive = archived.find(p => p.archiveKey === archiveId) ?? archived[0];
  const selected = isArchive ? archive : guide;

  return (
    <div role="dialog" aria-modal="true" aria-label="Node setup guide" className="fixed inset-0 z-50 flex flex-col bg-surface text-on-surface">
      <header className="flex items-center gap-3 bg-surface-container-low px-5 py-3">
        <GuideButton onClick={onClose} aria-label="Close setup guide" title="Close setup guide">
          <span className="material-symbols-outlined">arrow_back</span>
        </GuideButton>
        <span className="material-symbols-outlined text-primary-container">menu_book</span>
        <div>
          <h2 className="text-base font-black uppercase">Node setup guide</h2>
          <p className="text-xs text-on-surface-variant">Admin-only · Code-verified October 23, 2026</p>
        </div>
      </header>
      <nav aria-label="Guide pages" className="flex shrink-0 gap-1 overflow-x-auto bg-surface-container px-4 py-2">
        {SETUP_GUIDE.map(p => (
          <GuideButton key={p.tab} aria-pressed={selectedKey === p.tab}
            className={`shrink-0 whitespace-nowrap ${selectedKey === p.tab ? "bg-primary-container/15 text-primary-container" : ""}`}
            onClick={() => { setSelectedKey(p.tab); if (p.tab !== "checklist") onTabChange(p.tab); }}>
            {p.sectionTitle}
          </GuideButton>
        ))}
        <GuideButton aria-pressed={isArchive} className={`shrink-0 whitespace-nowrap ${isArchive ? "bg-primary-container/15 text-primary-container" : ""}`} onClick={() => setSelectedKey("archive")}>
          <span className="material-symbols-outlined mr-1 align-middle text-base">archive</span>Archive
        </GuideButton>
      </nav>
      {isArchive && (
        <div className="bg-surface-container-high px-5 py-4">
          <p className="mb-3 text-sm text-on-surface-variant">Original node knowledge, preserved unchanged. Historical admin notes are not current setup instructions or coaching evidence.</p>
          <label className="text-xs font-medium uppercase" htmlFor="archived-node-page">Archived page</label>
          <select id="archived-node-page" value={archive?.archiveKey ?? ""} onChange={event => setArchiveId(event.target.value)}
            className="mt-2 block w-full max-w-2xl rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface">
            {archived.map(p => <option key={p.archiveKey} value={p.archiveKey}>{p.tab} — {p.sectionTitle || "Untitled"}</option>)}
          </select>
          {!archived.length && <p className="mt-3 text-sm text-on-surface-variant">This node has no historical knowledge pages.</p>}
        </div>
      )}
      <main className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        {selected && <article className="mx-auto max-w-3xl">
          <h3 className="mb-5 text-xl font-extrabold uppercase">{selected.sectionTitle}</h3>
          <div className="space-y-4 text-sm leading-7 text-on-surface-variant [&_strong]:font-semibold [&_strong]:text-on-surface [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:block [&_table]:overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: selected.content }} />
        </article>}
      </main>
    </div>
  );
}