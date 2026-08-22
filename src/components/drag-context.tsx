import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotes } from "@/store/notes";

export type DragKind = "group" | "page" | "section";

export type DragItem =
  | { kind: "group"; id: string; title: string; index: number }
  | { kind: "page"; id: string; title: string; groupId: string; index: number }
  | { kind: "section"; id: string; title: string; pageId: string; index: number };

export type DropHint =
  | { kind: "group-slot"; index: number }
  | { kind: "page-slot"; groupId: string; index: number }
  | { kind: "section-slot"; pageId: string; index: number }
  | { kind: "page"; pageId: string; title: string }
  | null;

type DragState = {
  item: DragItem;
  x: number;
  y: number;
  over: DropHint;
} | null;

type DragApi = {
  drag: DragState;
  begin: (item: DragItem, event: ReactPointerEvent<HTMLElement>) => void;
};

const DragCtx = createContext<DragApi>({
  drag: null,
  begin: () => undefined,
});

export function useDrag() {
  return useContext(DragCtx);
}

function parseHint(node: Element | null, clientY: number, item: DragItem): DropHint {
  if (!node) return null;
  const row = node.closest("[data-drop-kind]") as HTMLElement | null;
  if (!row) return null;
  const kind = row.dataset.dropKind;
  const rect = row.getBoundingClientRect();
  const before = clientY < rect.top + rect.height / 2;
  if (kind === "group") {
    const index = Number(row.dataset.index);
    if (item.kind === "group") return { kind: "group-slot", index: before ? index : index + 1 };
    if (item.kind === "page") {
      return { kind: "page-slot", groupId: row.dataset.id ?? "", index: Number(row.dataset.pageCount ?? 0) };
    }
    return null;
  }
  if (kind === "page") {
    const pageId = row.dataset.id ?? "";
    const groupId = row.dataset.groupId ?? "";
    const index = Number(row.dataset.index);
    if (item.kind === "section") return { kind: "page", pageId, title: row.dataset.title ?? "" };
    if (item.kind === "page") return { kind: "page-slot", groupId, index: before ? index : index + 1 };
    if (item.kind === "group") {
      const gi = Number(row.dataset.groupIndex);
      return { kind: "group-slot", index: before ? gi : gi + 1 };
    }
  }
  if (kind === "section") {
    if (item.kind !== "section") return null;
    const pageId = row.dataset.pageId ?? "";
    const index = Number(row.dataset.index);
    return { kind: "section-slot", pageId, index: before ? index : index + 1 };
  }
  if (kind === "page-end") {
    if (item.kind !== "page") return null;
    return { kind: "page-slot", groupId: row.dataset.groupId ?? "", index: Number(row.dataset.index) };
  }
  if (kind === "section-end") {
    if (item.kind !== "section") return null;
    return { kind: "section-slot", pageId: row.dataset.pageId ?? "", index: Number(row.dataset.index) };
  }
  if (kind === "group-end") {
    if (item.kind !== "group") return null;
    return { kind: "group-slot", index: Number(row.dataset.index) };
  }
  return null;
}

function commit(over: DropHint, item: DragItem) {
  const store = useNotes.getState();
  if (!over) return;
  if (item.kind === "group" && over.kind === "group-slot") {
    store.moveGroup(item.index, over.index);
    return;
  }
  if (item.kind === "page" && over.kind === "page-slot") {
    store.movePage(item.id, over.groupId, over.index);
    return;
  }
  if (item.kind === "section" && over.kind === "section-slot") {
    store.moveSection(item.id, item.pageId, over.pageId, over.index);
    return;
  }
  if (item.kind === "section" && over.kind === "page") {
    const dest = store.pages[over.pageId];
    if (!dest) return;
    store.moveSection(item.id, item.pageId, over.pageId, dest.sections.length);
  }
}

export function DragProvider({ children }: { children: ReactNode }) {
  const [drag, setDrag] = useState<DragState>(null);
  const dragRef = useRef<DragState>(null);

  const begin = useCallback((item: DragItem, event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const originX = event.clientX;
    const originY = event.clientY;
    let started = false;
    let lastOver: DropHint = null;
    let done = false;
    const pointerId = event.pointerId;
    const handle = event.currentTarget;
    try {
      handle.setPointerCapture(pointerId);
    } catch {
      /* capture is best-effort */
    }

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - originX;
      const dy = ev.clientY - originY;
      if (!started) {
        if (dx * dx + dy * dy < 25) return;
        started = true;
        document.body.classList.add("dragging");
      }
      ev.preventDefault();
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const over = parseHint(under, ev.clientY, item) ?? lastOver;
      if (over) lastOver = over;
      const next = { item, x: ev.clientX, y: ev.clientY, over };
      dragRef.current = next;
      setDrag(next);
    };

    const onUp = () => {
      if (done) return;
      done = true;
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove("dragging");
      try {
        handle.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
      const current = dragRef.current;
      if (started) commit(current?.over ?? lastOver, item);
      dragRef.current = null;
      setDrag(null);
    };

    handle.addEventListener("pointermove", onMove, { passive: false });
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
  }, []);

  const api = useMemo(() => ({ drag, begin }), [drag, begin]);

  return (
    <DragCtx.Provider value={api}>
      {children}
      {drag ? (
        <div
          className="pointer-events-none fixed z-50 max-w-xs rounded-sm border border-border bg-surface px-2 py-1 text-sm shadow-sheet"
          style={{ left: drag.x + 12, top: drag.y + 12 }}
        >
          {drag.item.title}
          {drag.over?.kind === "page" ? (
            <span className="mt-0.5 block text-xs text-muted">Move to {drag.over.title}</span>
          ) : null}
        </div>
      ) : null}
    </DragCtx.Provider>
  );
}

export function DropLine({ show }: { show: boolean }) {
  if (!show) return null;
  return <div className="h-0.5 rounded-full bg-primary" />;
}

export function DragHandle({
  item,
  label,
}: {
  item: DragItem;
  label: string;
}) {
  const { begin, drag } = useDrag();
  const active = drag?.item.kind === item.kind && drag.item.id === item.id;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onPointerDown={(event) => begin(item, event)}
      className={cn(
        "grid size-8 shrink-0 touch-none place-items-center rounded-sm text-subtle hover:bg-hover hover:text-fg",
        active && "cursor-grabbing text-fg",
        !active && "cursor-grab",
      )}
    >
      <GripVertical className="size-3.5" />
    </div>
  );
}
