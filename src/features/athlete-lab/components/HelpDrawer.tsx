import { useState, useEffect, useRef, useCallback, type ClipboardEvent } from "react";
import type { KnowledgeSection } from "../types";

interface TabDef {
  key: string;
  label: string;
  icon: string;
}

interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
  tabKey: string;
  tabLabel: string;
  tabs: TabDef[];
  onTabChange: (key: string) => void;
  knowledgeBase: Record<string, KnowledgeSection[]>;
  onKnowledgeBaseChange: (kb: Record<string, KnowledgeSection[]>) => void;
}

export function HelpDrawer({ open, onClose, tabKey, tabLabel, tabs, onTabChange, knowledgeBase, onKnowledgeBaseChange }: HelpDrawerProps) {
  const sections = knowledgeBase[tabKey] ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && sections.length > 0) {
      setSelectedId((prev) => {
        if (prev && sections.some((s) => s.id === prev)) return prev;
        return sections[0].id;
      });
    }
    setEditing(false);
  }, [open, tabKey, sections.length]);

  useEffect(() => {
    if (renamingId && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renamingId]);

  const selected = sections.find((s) => s.id === selectedId) ?? null;

  const updateSections = useCallback((updated: KnowledgeSection[]) => {
    onKnowledgeBaseChange({ ...knowledgeBase, [tabKey]: updated });
  }, [knowledgeBase, tabKey, onKnowledgeBaseChange]);

  const handleAddSection = () => {
    const id = crypto.randomUUID();
    const newSection: KnowledgeSection = { id, sectionTitle: "New Section", content: "" };
    updateSections([...sections, newSection]);
    setSelectedId(id);
    setEditing(false);
  };

  const handleDeleteSection = (id: string) => {
    const updated = sections.filter((s) => s.id !== id);
    updateSections(updated);
    if (selectedId === id) {
      setSelectedId(updated[0]?.id ?? null);
    }
    setEditing(false);
  };

  const handleRenameStart = (s: KnowledgeSection) => {
    setRenamingId(s.id);
    setRenameValue(s.sectionTitle);
  };

  const handleRenameFinish = () => {
    if (renamingId && renameValue.trim()) {
      updateSections(sections.map((s) => s.id === renamingId ? { ...s, sectionTitle: renameValue.trim() } : s));
    }
    setRenamingId(null);
  };

  const handleEdit = () => {
    setEditing(true);
    setTimeout(() => {
      if (editorRef.current && selected) {
        editorRef.current.innerHTML = selected.content;
        editorRef.current.focus();
      }
    }, 0);
  };

  const handleSave = () => {
    if (!selected) return;
    const html = editorRef.current?.innerHTML ?? "";
    updateSections(sections.map((s) => s.id === selected.id ? { ...s, content: html } : s));
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  const execCommand = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  const handlePaste = useCallback((e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const clipboardData = e.clipboardData;
    const html = clipboardData.getData("text/html");
    const plain = clipboardData.getData("text/plain");

    if (html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const walker = doc.body.querySelectorAll("*");
      walker.forEach((el) => {
        el.removeAttribute("style");
        el.removeAttribute("class");
        el.removeAttribute("data-sourcepos");
        el.removeAttribute("width");
      });
      const cleanedHtml = doc.body.innerHTML;
      document.execCommand("insertHTML", false, cleanedHtml);
    } else if (plain) {
      const converted = markdownToHtml(plain);
      document.execCommand("insertHTML", false, converted);
    }
  }, []);

  const handleTabSwitch = (key: string) => {
    onTabChange(key);
    setEditing(false);
  };

  if (!open) return null;

  return (
    <>
      {/* Full-screen overlay */}
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex flex-col animate-in fade-in duration-200" style={{ backgroundColor: '#111720' }}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
            </button>
            <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 20 }}>menu_book</span>
            <div>
              <h2 className="text-on-surface font-black uppercase tracking-tighter text-base">
                Knowledge Base
              </h2>
              <p className="text-[9px] text-on-surface-variant/50 uppercase tracking-[0.3em] font-medium">
                Admin-only documentation — not visible to athletes
              </p>
            </div>
          </div>
        </div>

        {/* Tab navigation row */}
        <div className="px-5 pt-2 pb-1 flex gap-1 overflow-x-auto scrollbar-thin shrink-0 border-b border-outline-variant/10" style={{ backgroundColor: '#131920' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => handleTabSwitch(t.key)}
              className={`px-3 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-[0.15em] flex items-center gap-1.5 whitespace-nowrap transition-all duration-200 shrink-0 ${
                tabKey === t.key
                  ? "bg-primary-container/15 text-primary-container border border-primary-container/30"
                  : "text-on-surface-variant hover:bg-surface-container border border-transparent"
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Split body */}
        <div className="flex flex-1 min-h-0">
          {/* Left sidebar */}
          <div className="w-[260px] min-w-[260px] flex flex-col border-r border-primary-container/15" style={{ backgroundColor: '#161C24' }}>
            <div className="px-4 py-3 border-b border-white/5">
              <h3 className="text-on-surface font-bold uppercase tracking-wide text-xs">{tabLabel}</h3>
            </div>
            <div className="p-3">
              <button
                onClick={handleAddSection}
                className="w-full h-9 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-1.5 active:scale-95 transition-all duration-150"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                Add Section
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
              {sections.map((s) => (
                <div
                  key={s.id}
                  className={`group flex items-center gap-2 cursor-pointer transition-all duration-200 ${
                    selectedId === s.id
                      ? "px-3 py-2.5 rounded-xl border-l-[4px] border-primary-container shadow-[inset_0_0_16px_rgba(0,230,57,0.06),0_0_12px_rgba(0,230,57,0.08)]"
                      : "px-3 py-2.5 rounded-xl hover:bg-surface-container"
                  }`}
                  style={selectedId === s.id ? { backgroundColor: '#222B38' } : undefined}
                  onClick={() => { setSelectedId(s.id); setEditing(false); }}
                >
                  <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>article</span>

                  {renamingId === s.id ? (
                    <input
                      ref={renameRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleRenameFinish}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRenameFinish(); if (e.key === "Escape") setRenamingId(null); }}
                      className="flex-1 bg-transparent border-b border-primary-container/40 text-on-surface text-xs font-medium outline-none py-0.5"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="flex-1 text-on-surface text-xs font-medium truncate">{s.sectionTitle}</span>
                  )}

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRenameStart(s); }}
                      className="text-on-surface-variant hover:text-on-surface transition-colors"
                      aria-label="Rename"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                    </button>
                    {sections.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteSection(s.id); }}
                        className="text-on-surface-variant hover:text-red-400 transition-colors"
                        aria-label="Delete"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {sections.length === 0 && (
                <div className="text-center py-8 text-on-surface-variant text-[10px]">
                  <span className="material-symbols-outlined block mb-2" style={{ fontSize: 28 }}>menu_book</span>
                  No sections yet
                </div>
              )}
            </div>
          </div>

          {/* Right content */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {selected ? (
              <>
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0">
                  <h3 className="text-on-surface font-bold uppercase tracking-wide text-sm truncate">{selected.sectionTitle}</h3>
                  <div className="flex items-center gap-2">
                    {!editing ? (
                      <button
                        onClick={handleEdit}
                        className="h-8 px-4 rounded-lg bg-surface-container-high border border-outline-variant/10 text-on-surface-variant text-[10px] font-semibold uppercase tracking-widest hover:bg-surface-container-highest transition-colors flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                        Edit
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleSave}
                          className="h-8 px-4 rounded-lg kinetic-gradient text-[#00460a] text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all duration-150 flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>save</span>
                          Save
                        </button>
                        <button
                          onClick={handleCancel}
                          className="h-8 px-4 rounded-lg bg-surface-container-high border border-outline-variant/10 text-on-surface-variant text-[10px] font-semibold uppercase tracking-widest hover:bg-surface-container-highest transition-colors flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {editing && (
                  <div className="flex items-center gap-1 p-1.5 mx-5 mt-3 rounded-lg bg-surface-container-high border border-white/5">
                    <ToolbarBtn icon="format_bold" onClick={() => execCommand("bold")} title="Bold" />
                    <ToolbarBtn icon="format_italic" onClick={() => execCommand("italic")} title="Italic" />
                    <ToolbarBtn icon="format_underlined" onClick={() => execCommand("underline")} title="Underline" />
                    <div className="w-px h-5 bg-white/10 mx-1" />
                    <ToolbarBtn icon="format_list_bulleted" onClick={() => execCommand("insertUnorderedList")} title="Bullet List" />
                    <ToolbarBtn icon="format_list_numbered" onClick={() => execCommand("insertOrderedList")} title="Numbered List" />
                    <div className="w-px h-5 bg-white/10 mx-1" />
                    <ToolbarBtn icon="title" onClick={() => execCommand("formatBlock", "h3")} title="Heading" />
                    <ToolbarBtn icon="format_paragraph" onClick={() => execCommand("formatBlock", "p")} title="Paragraph" />
                    <div className="w-px h-5 bg-white/10 mx-1" />
                    <ToolbarBtn icon="horizontal_rule" onClick={() => execCommand("insertHorizontalRule")} title="Line Separator" />
                  </div>
                )}

                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {editing ? (
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      onPaste={handlePaste}
                      className="min-h-[400px] p-4 rounded-xl border border-gray-300 text-sm leading-relaxed focus:outline-none focus:border-primary-container/60 transition-colors prose-admin"
                      style={{ backgroundColor: '#ffffff', color: '#1a1a1a' }}
                    />
                  ) : (
                    <div
                      className="p-4 rounded-xl border border-gray-300 text-sm leading-relaxed prose-admin min-h-[200px]"
                      style={{ backgroundColor: '#ffffff', color: '#1a1a1a' }}
                      dangerouslySetInnerHTML={{
                        __html: selected.content || "<p style='color:#999;font-style:italic'>No content yet. Click Edit to add documentation for this section.</p>",
                      }}
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-on-surface-variant text-xs">
                <div className="text-center">
                  <span className="material-symbols-outlined block mb-2" style={{ fontSize: 40 }}>menu_book</span>
                  Add a section to start building documentation
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ToolbarBtn({ icon, onClick, title }: { icon: string; onClick: () => void; title: string }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors"
    >
      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{icon}</span>
    </button>
  );
}
