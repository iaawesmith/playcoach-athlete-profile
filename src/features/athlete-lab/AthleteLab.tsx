import { useState, useEffect } from "react";
import type { TrainingNode, NodePosition } from "./types";
import { fetchNodes, createNode, deleteNode as deleteNodeApi } from "@/services/athleteLab";
import { NodeSidebar } from "./components/NodeSidebar";
import { NodeEditor } from "./components/NodeEditor";
import { AdminReferencePanel } from "./components/AdminReferencePanel";
import { ConfirmModal } from "./components/ConfirmModal";

export function AthleteLab() {
  const [nodes, setNodes] = useState<TrainingNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdminRef, setShowAdminRef] = useState(false);
  const [pendingDeleteNode, setPendingDeleteNode] = useState<TrainingNode | null>(null);

  useEffect(() => {
    loadNodes();
  }, []);

  // Refetch on window focus so out-of-band DB changes (migrations, direct edits)
  // appear without a full reload. Pairs with NodeEditor's resync-on-updated_at.
  useEffect(() => {
    const handleFocus = () => {
      void refreshNodes({ silent: true });
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const loadNodes = async () => {
    setLoading(true);
    try {
      const data = await fetchNodes();
      setNodes(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  const refreshNodes = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setRefreshing(true);
    try {
      const data = await fetchNodes();
      setNodes(data);
    } catch {
      // handle error
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  const handleAdd = async (position: NodePosition) => {
    try {
      const newNode = await createNode({ name: "New Training Node", position });
      setNodes((prev) => [...prev, newNode]);
      setSelectedId(newNode.id);
    } catch {
      // handle error
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNodeApi(id);
      const remainingNodes = nodes.filter((n) => n.id !== id);
      setNodes(remainingNodes);
      if (selectedId === id) {
        setSelectedId(remainingNodes[0]?.id ?? null);
      }
    } catch {
      // handle error
    } finally {
      setPendingDeleteNode(null);
    }
  };

  const handleUpdated = (updated: TrainingNode) => {
    setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  };

  const handleIconChange = (nodeId: string, iconUrl: string | null) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, icon_url: iconUrl } : n)));
  };

  const selectedNode = nodes.find((n) => n.id === selectedId);

  return (
    <div className="h-screen w-full flex flex-col bg-surface overflow-hidden">
      {/* Top Bar */}
      <div className="h-16 flex items-center px-6 bg-surface/80 backdrop-blur-xl border-b border-white/10 shrink-0">
        <span className="material-symbols-outlined text-primary-container mr-3" style={{ fontSize: 24 }}>neurology</span>
        <span className="text-on-surface font-black uppercase tracking-tighter text-lg">AthleteLab</span>
        <div className="w-px h-6 bg-white/10 mx-4" />
        <span className="text-primary-container text-xs font-semibold uppercase tracking-[0.3em]">Training Node Manager</span>
        <div className="flex-1" />
        <button
          onClick={() => void refreshNodes()}
          disabled={refreshing || loading}
          title="Refetch nodes from the database (use after an out-of-band migration)"
          className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant/60 hover:text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span
            className={`material-symbols-outlined ${refreshing ? "animate-spin" : ""}`}
            style={{ fontSize: 20 }}
          >
            refresh
          </span>
        </button>
        <button
          onClick={() => setShowAdminRef(true)}
          title="Admin Reference & Handoff Prompt"
          className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant/60 hover:text-on-surface-variant hover:bg-surface-container-high transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>menu_book</span>
        </button>
      </div>

      {showAdminRef && <AdminReferencePanel onClose={() => setShowAdminRef(false)} />}
      <ConfirmModal
        open={pendingDeleteNode !== null}
        title="Delete Training Node?"
        body={pendingDeleteNode ? `Are you sure you want to delete \"${pendingDeleteNode.name}\"? This will permanently remove this node and all of its saved configuration.` : ""}
        confirmLabel="Delete Node"
        onConfirm={() => {
          if (pendingDeleteNode) {
            void handleDelete(pendingDeleteNode.id);
          }
        }}
        onCancel={() => setPendingDeleteNode(null)}
      />

      <div className="flex flex-1 min-h-0">
        <NodeSidebar
          nodes={nodes}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={handleAdd}
          onRequestDelete={setPendingDeleteNode}
        />

        <div className="flex-1 min-w-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="space-y-4 w-80">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-xl bg-surface-container animate-pulse" />
                ))}
              </div>
            </div>
          ) : selectedNode ? (
            <NodeEditor node={selectedNode} onUpdated={handleUpdated} onIconChange={handleIconChange} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <span className="material-symbols-outlined text-on-surface-variant/30 block mb-4" style={{ fontSize: 64 }}>neurology</span>
                <p className="text-on-surface-variant text-sm">Select a training node or create a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
