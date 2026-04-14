import { useState, useEffect } from "react";
import type { TrainingNode, NodePosition } from "./types";
import { fetchNodes, createNode, deleteNode as deleteNodeApi } from "@/services/athleteLab";
import { NodeSidebar } from "./components/NodeSidebar";
import { NodeEditor } from "./components/NodeEditor";
import { AdminReferencePanel } from "./components/AdminReferencePanel";

export function AthleteLab() {
  const [nodes, setNodes] = useState<TrainingNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdminRef, setShowAdminRef] = useState(false);

  useEffect(() => {
    loadNodes();
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
      setNodes((prev) => prev.filter((n) => n.id !== id));
      if (selectedId === id) {
        setSelectedId(nodes.find((n) => n.id !== id)?.id ?? null);
      }
    } catch {
      // handle error
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
          onClick={() => setShowAdminRef(true)}
          title="Admin Reference & Handoff Prompt"
          className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant/60 hover:text-on-surface-variant hover:bg-surface-container-high transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>menu_book</span>
        </button>
      </div>

      {showAdminRef && <AdminReferencePanel onClose={() => setShowAdminRef(false)} />}

      <div className="flex flex-1 min-h-0">
        <NodeSidebar
          nodes={nodes}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={handleAdd}
          onDelete={handleDelete}
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
