import { useRef, useState } from "react";
import { AutoText } from "@/components/field";
import type { Block, FlowEdge, FlowNode } from "@/lib/notes-types";
import { cn } from "@/lib/utils";

const BOX_W = 148;
const BOX_H = 52;

function nid(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}`;
}

export function emptyFlow(): Extract<Block, { type: "flow" }> {
  const a = nid("fn");
  const b = nid("fn");
  const c = nid("fn");
  return {
    id: nid("flow"),
    type: "flow",
    nodes: [
      { id: a, text: "Start", x: 140, y: 16 },
      { id: b, text: "Step", x: 140, y: 120 },
      { id: c, text: "End", x: 140, y: 224 },
    ],
    edges: [
      { id: nid("fe"), from: a, to: b, label: "" },
      { id: nid("fe"), from: b, to: c, label: "" },
    ],
  };
}

function nodeById(nodes: FlowNode[], id: string) {
  return nodes.find((node) => node.id === id);
}

export function FlowEditor({
  block,
  onChange,
  onRemove,
}: {
  block: Extract<Block, { type: "flow" }>;
  onChange: (block: Block) => void;
  onRemove: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [fromId, setFromId] = useState<string | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const surface = useRef<HTMLDivElement>(null);

  const maxX = block.nodes.reduce((n, node) => Math.max(n, node.x + BOX_W), 320);
  const maxY = block.nodes.reduce((n, node) => Math.max(n, node.y + BOX_H), 240);

  function patch(next: Partial<Extract<Block, { type: "flow" }>>) {
    onChange({ ...block, ...next });
  }

  function addBox() {
    const id = nid("fn");
    const y = block.nodes.reduce((n, node) => Math.max(n, node.y), 0) + 104;
    const created: FlowNode = { id, text: "New", x: 140, y };
    patch({ nodes: [...block.nodes, created] });
    setSelected(id);
  }

  function deleteSelected() {
    if (!selected) {
      if (!block.nodes.length) onRemove();
      return;
    }
    const isEdge = block.edges.some((edge) => edge.id === selected);
    if (isEdge) {
      patch({ edges: block.edges.filter((edge) => edge.id !== selected) });
      setSelected(null);
      return;
    }
    const nodes = block.nodes.filter((node) => node.id !== selected);
    const edges = block.edges.filter((edge) => edge.from !== selected && edge.to !== selected);
    if (!nodes.length) {
      onRemove();
      return;
    }
    patch({ nodes, edges });
    setSelected(null);
  }

  function onNodePointer(event: React.PointerEvent, node: FlowNode, startDrag: boolean) {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (linking) {
      if (!fromId) {
        setFromId(node.id);
        setSelected(node.id);
        return;
      }
      if (fromId !== node.id && !block.edges.some((edge) => edge.from === fromId && edge.to === node.id)) {
        const edge: FlowEdge = { id: nid("fe"), from: fromId, to: node.id, label: "" };
        patch({ edges: [...block.edges, edge] });
      }
      setFromId(null);
      setLinking(false);
      setSelected(node.id);
      return;
    }
    setSelected(node.id);
    if (!startDrag) return;
    const origin = surface.current?.getBoundingClientRect();
    drag.current = {
      id: node.id,
      dx: event.clientX - (origin?.left ?? 0) - node.x,
      dy: event.clientY - (origin?.top ?? 0) - node.y,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onMove(event: React.PointerEvent) {
    const active = drag.current;
    if (!active) return;
    const origin = surface.current?.getBoundingClientRect();
    if (!origin) return;
    const x = Math.max(8, Math.round((event.clientX - origin.left - active.dx) / 8) * 8);
    const y = Math.max(8, Math.round((event.clientY - origin.top - active.dy) / 8) * 8);
    patch({
      nodes: block.nodes.map((node) => (node.id === active.id ? { ...node, x, y } : node)),
    });
  }

  return (
    <div
      className="rounded-md border border-border bg-surface"
      data-no-line-select="true"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Backspace" || event.key === "Delete") {
          event.preventDefault();
          deleteSelected();
        }
      }}
    >
      <div className="flex flex-wrap gap-2 border-b border-border px-2 py-1.5">
        <button type="button" className="h-8 px-2 text-xs text-muted hover:text-fg" onClick={addBox}>
          Add box
        </button>
        <button
          type="button"
          className={cn("h-8 px-2 text-xs", linking ? "bg-active text-fg" : "text-muted hover:text-fg")}
          onClick={() => {
            setLinking((on) => !on);
            setFromId(null);
          }}
        >
          {linking ? "Click two boxes" : "Connect"}
        </button>
        <button type="button" className="h-8 px-2 text-xs text-muted hover:text-fg" onClick={deleteSelected}>
          Delete
        </button>
      </div>
      <div
        ref={surface}
        className="relative overflow-auto"
        style={{ minHeight: maxY + 32, minWidth: maxX + 24 }}
        onPointerMove={onMove}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) setSelected(null);
        }}
      >
        <svg className="pointer-events-none absolute inset-0" width={maxX + 24} height={maxY + 32}>
          <defs>
            <marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted" />
            </marker>
          </defs>
          {block.edges.map((edge) => {
            const from = nodeById(block.nodes, edge.from);
            const to = nodeById(block.nodes, edge.to);
            if (!from || !to) return null;
            const x1 = from.x + BOX_W / 2;
            const y1 = from.y + BOX_H;
            const x2 = to.x + BOX_W / 2;
            const y2 = to.y;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const active = selected === edge.id;
            return (
              <g key={edge.id}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  className={active ? "stroke-fg" : "stroke-muted"}
                  strokeWidth={active ? 2 : 1.5}
                  markerEnd="url(#flow-arrow)"
                />
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  className="pointer-events-auto cursor-pointer stroke-transparent"
                  strokeWidth={16}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected(edge.id);
                  }}
                />
                {edge.label ? (
                  <text x={mx} y={my - 6} textAnchor="middle" className="fill-muted text-[11px]">
                    {edge.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        {block.nodes.map((node) => (
          <div
            key={node.id}
            className={cn(
              "absolute rounded-md border bg-bg px-1 py-0.5 shadow-sm",
              selected === node.id ? "border-primary" : "border-border",
              fromId === node.id && "ring-1 ring-primary",
            )}
            style={{ left: node.x, top: node.y, width: BOX_W, minHeight: BOX_H }}
            onPointerDown={(event) => onNodePointer(event, node, false)}
          >
            <div
              className="h-3 cursor-grab touch-none rounded-t-sm"
              aria-hidden
              onPointerDown={(event) => onNodePointer(event, node, true)}
            />
            <AutoText
              value={node.text}
              onChange={(text) =>
                patch({ nodes: block.nodes.map((item) => (item.id === node.id ? { ...item, text } : item)) })
              }
              placeholder="Step"
              aria-label="Flowchart box"
              className="px-1 py-1 text-center text-sm"
            />
          </div>
        ))}
      </div>
      {selected && block.edges.some((edge) => edge.id === selected) ? (
        <div className="border-t border-border px-2 py-1.5">
          <AutoText
            value={block.edges.find((edge) => edge.id === selected)?.label ?? ""}
            onChange={(label) =>
              patch({
                edges: block.edges.map((edge) => (edge.id === selected ? { ...edge, label } : edge)),
              })
            }
            placeholder="Arrow label (Yes / No)"
            aria-label="Arrow label"
            className="text-sm"
          />
        </div>
      ) : null}
    </div>
  );
}
