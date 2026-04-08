import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
  tabKey: string;
  tabLabel: string;
}

export function HelpDrawer({ open, onClose, tabKey, tabLabel }: HelpDrawerProps) {
  const [content, setContent] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const fetchContent = useCallback(async () => {
    const { data } = await supabase
      .from("admin_tab_guidance" as never)
      .select("content")
      .eq("tab_key", tabKey)
      .single();
    const row = data as unknown as { content: string } | null;
    if (row) {
      setContent(row.content);
      setDraftContent(row.content);
    } else {
      setContent("");
      setDraftContent("");
    }
    setLoaded(true);
  }, [tabKey]);

  useEffect(() => {
    if (open) {
      setLoaded(false);
      setEditing(false);
      fetchContent();
    }
  }, [open, fetchContent]);

  const handleSave = async () => {
    setSaving(true);
    const html = editorRef.current?.innerHTML ?? draftContent;
    const { error } = await supabase
      .from("admin_tab_guidance" as never)
      .update({ content: html } as never)
      .eq("tab_key", tabKey);
    if (!error) {
      setContent(html);
      setDraftContent(html);
      setEditing(false);
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setDraftContent(content);
    if (editorRef.current) {
      editorRef.current.innerHTML = content;
    }
    setEditing(false);
  };

  const handleEdit = () => {
    setEditing(true);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = draftContent;
        editorRef.current.focus();
      }
    }, 0);
  };

  const execCommand = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col bg-surface border-l border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
          <div className="space-y-1">
            <h2 className="text-on-surface font-black uppercase tracking-tighter text-base flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 20 }}>help</span>
              Admin Help — {tabLabel}
            </h2>
            <p className="text-[9px] text-on-surface-variant/50 uppercase tracking-[0.3em] font-medium">
              Admin-only guidance — not visible to athletes
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!loaded ? (
            <div className="space-y-3">
              <div className="h-4 w-3/4 rounded bg-surface-container-high animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-surface-container-high animate-pulse" />
              <div className="h-20 rounded-xl bg-surface-container-high animate-pulse" />
            </div>
          ) : (
            <>
              {/* Action buttons */}
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
                      disabled={saving}
                      className="h-8 px-4 rounded-lg kinetic-gradient text-[#00460a] text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all duration-150 disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                        {saving ? "progress_activity" : "save"}
                      </span>
                      {saving ? "Saving..." : "Save"}
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

              {/* Toolbar (edit mode) */}
              {editing && (
                <div className="flex items-center gap-1 p-1.5 rounded-lg bg-surface-container-high border border-white/5">
                  <ToolbarBtn icon="format_bold" onClick={() => execCommand("bold")} title="Bold" />
                  <ToolbarBtn icon="format_italic" onClick={() => execCommand("italic")} title="Italic" />
                  <ToolbarBtn icon="format_underlined" onClick={() => execCommand("underline")} title="Underline" />
                  <div className="w-px h-5 bg-white/10 mx-1" />
                  <ToolbarBtn icon="format_list_bulleted" onClick={() => execCommand("insertUnorderedList")} title="Bullet List" />
                  <ToolbarBtn icon="format_list_numbered" onClick={() => execCommand("insertOrderedList")} title="Numbered List" />
                  <div className="w-px h-5 bg-white/10 mx-1" />
                  <ToolbarBtn icon="title" onClick={() => execCommand("formatBlock", "h3")} title="Heading" />
                  <ToolbarBtn icon="format_paragraph" onClick={() => execCommand("formatBlock", "p")} title="Paragraph" />
                </div>
              )}

              {/* Content */}
              {editing ? (
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="min-h-[400px] max-h-[70vh] overflow-y-auto p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/10 text-on-surface text-sm leading-relaxed focus:outline-none focus:border-primary-container/30 transition-colors prose-admin"
                />
              ) : (
                <div
                  className="p-4 rounded-xl bg-surface-container-high border border-white/5 text-on-surface text-sm leading-relaxed prose-admin min-h-[200px]"
                  dangerouslySetInnerHTML={{
                    __html: content || "<p class='text-on-surface-variant/40 italic'>No guidance added yet. Click Edit to add admin notes for this tab.</p>",
                  }}
                />
              )}
            </>
          )}
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
