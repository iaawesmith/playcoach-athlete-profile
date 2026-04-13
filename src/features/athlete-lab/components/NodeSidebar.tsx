import { useState } from "react";
import type { TrainingNode, NodePosition } from "../types";
import { computeCategories, computeScore, scoreColor } from "./NodeReadinessBar";

const POSITION_TABS: Array<{ key: "ALL" | NodePosition; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "WR", label: "WR" },
  { key: "QB", label: "QB" },
  { key: "RB", label: "RB" },
];

const POSITION_COLORS: Record<NodePosition, string> = {
  WR: "#00e639",
  QB: "#4A90D9",
  RB: "#E88A3A",
};

interface NodeSidebarProps {
  nodes: TrainingNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (position: NodePosition) => void;
  onDelete: (id: string) => void;
}

export function NodeSidebar({ nodes, selectedId, onSelect, onAdd, onDelete }: NodeSidebarProps) {
  const [posFilter, setPosFilter] = useState<"ALL" | NodePosition>("ALL");
  const [showPosPicker, setShowPosPicker] = useState(false);

  const filtered = posFilter === "ALL" ? nodes : nodes.filter((n) => n.position === posFilter);

  return (
    <div className="w-72 min-w-[288px] h-full flex flex-col border-r-2 border-primary-container/15" style={{ backgroundColor: '#1C222B' }}>
      <div className="p-4 space-y-4">
        <h2 className="text-on-surface font-black uppercase tracking-[0.2em] text-xs">Training Nodes</h2>

        {/* Position segmented control */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: '#141920' }}>
          {POSITION_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPosFilter(tab.key)}
              className={`flex-1 h-8 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200 ${
                posFilter === tab.key
                  ? "text-[#00460a] shadow-md"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
              style={posFilter === tab.key ? { background: 'linear-gradient(135deg, #00e639 0%, #006714 100%)' } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Add button */}
        <div className="relative">
          <button
            onClick={() => setShowPosPicker((v) => !v)}
            className="w-full h-11 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-2 active:scale-95 transition-all duration-150"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
            Add New Node
          </button>

          {showPosPicker && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-outline-variant/20 overflow-hidden z-20 shadow-[0_20px_50px_rgba(0,0,0,0.5)]" style={{ backgroundColor: '#1A2029' }}>
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-on-surface-variant border-b border-outline-variant/15">
                Select Position
              </div>
              {(["WR", "QB", "RB"] as NodePosition[]).map((pos) => (
                <button
                  key={pos}
                  onClick={() => {
                    setShowPosPicker(false);
                    onAdd(pos);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-on-surface text-sm font-medium hover:bg-surface-container transition-colors"
                >
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider"
                    style={{ backgroundColor: `${POSITION_COLORS[pos]}20`, color: POSITION_COLORS[pos] }}
                  >
                    {pos}
                  </span>
                  <span className="text-on-surface-variant text-xs">
                    {pos === "WR" ? "Wide Receiver" : pos === "QB" ? "Quarterback" : "Running Back"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        {filtered.map((node) => (
          <div
            key={node.id}
            className={`group flex items-center gap-3 cursor-pointer transition-all duration-200 ${
              selectedId === node.id
                ? "px-4 py-3.5 rounded-xl border-l-[5px] border-primary-container shadow-[inset_0_0_20px_rgba(0,230,57,0.08),0_0_16px_rgba(0,230,57,0.12)]"
                : "px-3 py-3 rounded-xl hover:bg-surface-container"
            }`}
            style={selectedId === node.id ? { backgroundColor: '#2A323F' } : undefined}
            onClick={() => onSelect(node.id)}
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: node.status === "live" ? "#00e639" : "#f59e0b" }}
            />
            <span className="flex-1 text-on-surface text-sm font-medium truncate">{node.name}</span>

            {/* Position badge */}
            {node.position && (
              <span
                className="px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-wider shrink-0"
                style={{ backgroundColor: `${POSITION_COLORS[node.position]}20`, color: POSITION_COLORS[node.position] }}
              >
                {node.position}
              </span>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-red-400 transition-opacity shrink-0"
              aria-label="Delete node"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-on-surface-variant text-xs">
            <span className="material-symbols-outlined block mb-2" style={{ fontSize: 32 }}>neurology</span>
            {posFilter === "ALL" ? "No training nodes yet" : `No ${posFilter} training nodes yet`}
          </div>
        )}
      </div>
    </div>
  );
}
