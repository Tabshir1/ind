import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FormatToolbar } from "@/components/rich-text";
import type { LineTarget, PageDoc } from "@/lib/notes-types";
import { stripHtml, writeClipboard, writeClipboardImage, type LineFormat } from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import { useNotes } from "@/store/notes";

type LineSelectContextValue = {
  selected: Set<string>;
  order: string[];
  isSelected: (id: string) => boolean;
};

const LineSelectContext = createContext<LineSelectContextValue>({
  selected: new Set(),
  order: [],
  isSelected: () => false,
});

export function lineIdBlock(sectionId: string, blockId: string) {
  return `${sectionId}::block::${blockId}`;
}
export function lineIdList(sectionId: string, blockId: string, itemId: string) {
  return `${sectionId}::li::${blockId}::${itemId}`;
}
export function lineIdKv(sectionId: string, blockId: string, index: number) {
  return `${sectionId}::kv::${blockId}::${index}`;
}
export function lineIdTable(sectionId: string, blockId: string, index: number) {
  return `${sectionId}::tr::${blockId}::${index}`;
}

export function parseLineId(id: string): LineTarget | null {
  const parts = id.split("::");
  if (parts.length < 3) return null;
  const [sectionId, kind, blockId] = parts;
  if (!sectionId || !blockId) return null;
  if (kind === "block") return { kind: "block", sectionId, blockId };
  if (kind === "li" && parts[3]) return { kind: "list-item", sectionId, blockId, itemId: parts[3] };
  if (kind === "kv" && parts[3] !== undefined) {
    return { kind: "kv-row", sectionId, blockId, index: Number(parts[3]) };
  }
  if (kind === "tr" && parts[3] !== undefined) {
    return { kind: "table-row", sectionId, blockId, index: Number(parts[3]) };
  }
  return null;
}

function rangeIds(order: string[], a: string, b: string) {
  const i = order.indexOf(a);
  const j = order.indexOf(b);
  if (i < 0 && j < 0) return [b];
  if (i < 0) return [b];
  if (j < 0) return [a];
  const from = Math.min(i, j);
  const to = Math.max(i, j);
  return order.slice(from, to + 1);
}

function lineFromPoint(x: number, y: number) {
  const el = document.elementFromPoint(x, y);
  return el?.closest("[data-line-id]")?.getAttribute("data-line-id") ?? null;
}

function targetText(page: PageDoc, target: LineTarget) {
  const section = page.sections.find((item) => item.id === target.sectionId);
  const block = section?.blocks.find((item) => item.id === target.blockId);
  if (!section || !block) return "";
  if (target.kind === "list-item" && block.type === "ul") {
    const item = block.items.find((row) => row.id === target.itemId);
    return item ? stripHtml(item.text) : "";
  }
  if (target.kind === "kv-row" && block.type === "kv") {
    const row = block.rows[target.index];
    return row ? `${row.k}: ${stripHtml(row.v)}` : "";
  }
  if (target.kind === "table-row" && block.type === "table") {
    return (block.rows[target.index] ?? []).map((cell) => stripHtml(cell)).join("\t");
  }
  if (block.type === "p" || block.type === "h" || block.type === "note" || block.type === "formula") {
    return stripHtml(block.text);
  }
  if (block.type === "ul") return block.items.map((item) => stripHtml(item.text)).join("\n");
  if (block.type === "image") return stripHtml(block.caption);
  if (block.type === "flow") return block.nodes.map((node) => node.text).join(" → ");
  if (block.type === "kv") return block.rows.map((row) => `${row.k}: ${stripHtml(row.v)}`).join("\n");
  if (block.type === "table") return block.rows.map((row) => row.map((cell) => stripHtml(cell)).join("\t")).join("\n");
  return "";
}

function targetImage(page: PageDoc, target: LineTarget) {
  if (target.kind !== "block") return "";
  const section = page.sections.find((item) => item.id === target.sectionId);
  const block = section?.blocks.find((item) => item.id === target.blockId);
  return block?.type === "image" ? block.src : "";
}

export function LineSelectProvider({
  pageId,
  order,
  children,
}: {
  pageId: string;
  order: string[];
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const orderRef = useRef(order);
  const selectedRef = useRef(selected);
  const anchorRef = useRef<string | null>(null);
  const dragRef = useRef<{
    startId: string;
    pointerId: number;
    x: number;
    y: number;
    fromGutter: boolean;
    active: boolean;
  } | null>(null);
  const applyLineDeletes = useNotes((s) => s.applyLineDeletes);
  const applyLineFormat = useNotes((s) => s.applyLineFormat);
  const page = useNotes((s) => s.pages[pageId]);

  orderRef.current = order;
  selectedRef.current = selected;

  const clear = useCallback(() => {
    setSelected(new Set());
    anchorRef.current = null;
  }, []);

  const targetsOf = useCallback(() => {
    return orderRef.current
      .filter((id) => selectedRef.current.has(id))
      .map(parseLineId)
      .filter((item): item is LineTarget => Boolean(item));
  }, []);

  const copySelected = useCallback(async () => {
    if (!page || selectedRef.current.size === 0) return;
    const targets = targetsOf();
    const lines = targets.map((target) => targetText(page, target)).filter(Boolean);
    const plain = lines.join("\n");
    const src = targets.map((target) => targetImage(page, target)).find(Boolean);
    if (src) {
      await writeClipboardImage(src, plain);
      return;
    }
    if (!plain) return;
    const html = lines.map((line) => `<p>${line}</p>`).join("");
    await writeClipboard(plain, html);
  }, [page, targetsOf]);

  const formatSelected = useCallback(
    (fmt: LineFormat) => {
      const targets = targetsOf();
      if (!targets.length) return;
      applyLineFormat(pageId, targets, fmt);
    },
    [applyLineFormat, pageId, targetsOf],
  );

  useEffect(() => {
    clear();
  }, [pageId, clear]);

  useEffect(() => {
    function onDown(event: PointerEvent) {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-no-line-select]")) return;
      const lineEl = target.closest("[data-line-id]");
      const id = lineEl?.getAttribute("data-line-id");
      const gutter = Boolean(target.closest("[data-line-gutter]"));

      if (!id) {
        if (!target.closest("[data-keep-select]")) clear();
        return;
      }

      if (event.shiftKey) {
        event.preventDefault();
        const anchor = anchorRef.current ?? id;
        setSelected(new Set(rangeIds(orderRef.current, anchor, id)));
        return;
      }
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
        anchorRef.current = id;
        return;
      }

      dragRef.current = {
        startId: id,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        fromGutter: gutter,
        active: gutter,
      };
      if (gutter) {
        event.preventDefault();
        setSelected(new Set([id]));
        anchorRef.current = id;
        lineEl?.setPointerCapture(event.pointerId);
      }
    }

    function onMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const over = lineFromPoint(event.clientX, event.clientY);
      if (!drag.active) {
        const dist = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
        if (dist < 8) return;
        if (!over || over === drag.startId) return;
        drag.active = true;
        window.getSelection()?.removeAllRanges();
        const active = document.activeElement;
        if (active instanceof HTMLElement) active.blur();
      }
      if (!over) return;
      event.preventDefault();
      setSelected(new Set(rangeIds(orderRef.current, drag.startId, over)));
      anchorRef.current = drag.startId;
    }

    function onUp(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (!drag.active && !drag.fromGutter) {
        clear();
      }
      dragRef.current = null;
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        clear();
        return;
      }
      const mod = event.metaKey || event.ctrlKey;
      if (selectedRef.current.size === 0) return;
      if ((event.target as HTMLElement | null)?.closest("[data-no-line-select]")) return;
      if (mod && event.key.toLowerCase() === "c") {
        event.preventDefault();
        event.stopPropagation();
        void copySelected();
        return;
      }
      if (mod && event.key.toLowerCase() === "b") {
        event.preventDefault();
        formatSelected({ op: "bold" });
        return;
      }
      if (mod && event.key.toLowerCase() === "i") {
        event.preventDefault();
        formatSelected({ op: "italic" });
        return;
      }
      if (mod && event.key.toLowerCase() === "u") {
        event.preventDefault();
        formatSelected({ op: "underline" });
        return;
      }
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      event.preventDefault();
      event.stopPropagation();
      const targets = targetsOf();
      if (!targets.length) return;
      applyLineDeletes(pageId, targets);
      clear();
    }

    function onCopy(event: ClipboardEvent) {
      if (selectedRef.current.size === 0) return;
      if ((event.target as HTMLElement | null)?.closest("[data-no-line-select]")) return;
      const native = window.getSelection()?.toString();
      if (native) return;
      event.preventDefault();
      void copySelected();
    }

    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("copy", onCopy, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("copy", onCopy, true);
    };
  }, [applyLineDeletes, clear, copySelected, formatSelected, pageId, targetsOf]);

  const value = useMemo<LineSelectContextValue>(
    () => ({
      selected,
      order,
      isSelected: (id: string) => selected.has(id),
    }),
    [selected, order],
  );

  return (
    <LineSelectContext.Provider value={value}>
      {selected.size > 0 ? (
        <div
          data-keep-select="true"
          className="sticky top-0 z-20 mb-3 rounded-md border border-border bg-surface p-1 shadow-sheet"
        >
          <div className="flex flex-wrap items-center gap-1">
            <p className="px-2 text-xs text-muted">{selected.size} selected</p>
            <FormatToolbar
              marks={null}
              className="mt-0 border-0 bg-transparent p-0"
              onBold={() => formatSelected({ op: "bold" })}
              onItalic={() => formatSelected({ op: "italic" })}
              onUnderline={() => formatSelected({ op: "underline" })}
              onColor={(hex) => formatSelected({ op: "color", value: hex })}
              onHighlight={(hex) => formatSelected({ op: "highlight", value: hex })}
              onFont={(name) => formatSelected({ op: "font", value: name })}
              onSize={(css) => formatSelected({ op: "size", value: css })}
              onClear={() => formatSelected({ op: "clear" })}
            />
            <button
              type="button"
              className="h-8 rounded-sm px-2 text-xs text-muted hover:bg-hover hover:text-fg"
              onClick={() => void copySelected()}
            >
              Copy
            </button>
          </div>
        </div>
      ) : null}
      {children}
    </LineSelectContext.Provider>
  );
}

export function useLineSelected(id: string) {
  return useContext(LineSelectContext).isSelected(id);
}

export function LineRow({
  id,
  as: Tag = "div",
  className,
  children,
}: {
  id: string;
  as?: "div" | "li" | "tr";
  className?: string;
  children: ReactNode;
}) {
  const selected = useLineSelected(id);
  const gutter = Tag !== "tr" && (
    <span
      data-line-gutter="true"
      aria-hidden
      className="absolute -left-3 top-0 z-10 h-full w-3 cursor-ns-resize touch-none"
    />
  );
  return (
    <Tag
      data-line-id={id}
      aria-selected={selected}
      className={cn(
        "relative",
        selected && "bg-active shadow-[inset_3px_0_0_var(--color-primary)]",
        className,
      )}
    >
      {gutter}
      {children}
    </Tag>
  );
}
