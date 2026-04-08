import type { TrainingNode } from "../types";

interface NodeSidebarProps {
  nodes: TrainingNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}

export function NodeSidebar({ nodes, selectedId, onSelect, onAdd, onDelete }: NodeSidebarProps) {
  return (
    <div className="w-72 min-w-[288px] h-full flex flex-col border-r-2 border-primary-container/15" style={{ backgroundColor: '#161C24' }}>
      <div className="p-4">
        <h2 className="text-on-surface font-black uppercase tracking-[0.2em] text-xs mb-4">Training Nodes</h2>
        <button
          onClick={onAdd}
          className="w-full h-11 rounded-full kinetic-gradient text-[#00460a] font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-2 active:scale-95 transition-all duration-150"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          Add New Node
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        {nodes.map((node) => (
          <div
            key={node.id}
            className={`group flex items-center gap-3 cursor-pointer transition-all duration-200 ${
              selectedId === node.id
                ? "px-4 py-3.5 rounded-xl border-l-[5px] border-primary-container shadow-[inset_0_0_20px_rgba(0,230,57,0.1),0_0_20px_rgba(0,230,57,0.15)]"
                : "px-3 py-3 rounded-xl hover:bg-surface-container"
            }`}
            style={selectedId === node.id ? { backgroundColor: '#2E3848' } : undefined}
            onClick={() => onSelect(node.id)}
          >
            {node.icon_url ? (
              <img src={node.icon_url} alt="" className="w-5 h-5 rounded object-cover" />
            ) : (
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 20 }}>route</span>
            )}
            <span className="flex-1 text-on-surface text-sm font-medium truncate">{node.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-red-400 transition-opacity"
              aria-label="Delete node"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
            </button>
          </div>
        ))}
        {nodes.length === 0 && (
          <div className="text-center py-12 text-on-surface-variant text-xs">
            <span className="material-symbols-outlined block mb-2" style={{ fontSize: 32 }}>neurology</span>
            No training nodes yet
          </div>
        )}
      </div>
    </div>
  );
}
