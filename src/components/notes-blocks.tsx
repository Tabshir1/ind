import { ImagePlus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AutoText, LineInput } from "@/components/field";
import { emptyFlow, FlowEditor } from "@/components/flowchart";
import { LineRow, lineIdBlock, lineIdKv, lineIdList, lineIdTable } from "@/components/line-select";
import { RichText } from "@/components/rich-text";
import { Button } from "@/components/ui/button";
import type { Block, ListItem } from "@/lib/notes-types";
import { compressImage, imageFromClipboard, imageFromSystemClipboard, normalizeListItems, stripHtml } from "@/lib/rich-text";
import { isEmptyText } from "@/lib/clone-notes";
import { cn } from "@/lib/utils";

function bid(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}`;
}

export function newBlock(type: Block["type"]): Block {
  switch (type) {
    case "p":
      return { id: bid("p"), type: "p", text: "" };
    case "h":
      return { id: bid("h"), type: "h", text: "" };
    case "ul":
      return { id: bid("ul"), type: "ul", items: [{ id: bid("li"), text: "", level: 0 }] };
    case "kv":
      return { id: bid("kv"), type: "kv", rows: [{ k: "Key", v: "Value" }] };
    case "table":
      return {
        id: bid("tbl"),
        type: "table",
        headers: ["A", "B"],
        rows: [
          ["", ""],
          ["", ""],
        ],
      };
    case "note":
      return { id: bid("note"), type: "note", text: "" };
    case "formula":
      return { id: bid("fx"), type: "formula", text: "" };
    case "image":
      return { id: bid("img"), type: "image", src: "", caption: "" };
    case "flow":
      return emptyFlow();
  }
}

export function BlockView({
  sectionId,
  block,
  onChange,
  onRemove,
  autoFocus,
}: {
  sectionId: string;
  block: Block;
  onChange: (block: Block) => void;
  onRemove: () => void;
  autoFocus?: boolean;
}) {
  const nested = block.type === "ul" || block.type === "kv" || block.type === "table";
  const body = (
    <BlockBody
      sectionId={sectionId}
      block={block}
      onChange={onChange}
      autoFocus={autoFocus}
      onRemove={onRemove}
    />
  );
  if (nested) return <div className="group/block relative">{body}</div>;
  return (
    <LineRow id={lineIdBlock(sectionId, block.id)} className="group/block">
      {body}
    </LineRow>
  );
}

function BlockBody({
  sectionId,
  block,
  onChange,
  autoFocus,
  onRemove,
}: {
  sectionId: string;
  block: Block;
  onChange: (block: Block) => void;
  autoFocus?: boolean;
  onRemove: () => void;
}) {
  if (block.type === "p") {
    return (
      <RichText
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
        placeholder="Write a note"
        aria-label="Paragraph"
        autoFocus={autoFocus}
        className="py-0.5 text-base leading-relaxed"
        onEmptyBackspace={onRemove}
      />
    );
  }
  if (block.type === "h") {
    return (
      <RichText
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
        placeholder="Heading"
        aria-label="Heading"
        autoFocus={autoFocus}
        className="py-1 text-base font-semibold tracking-tight"
        onEmptyBackspace={onRemove}
      />
    );
  }
  if (block.type === "note") {
    return (
      <div className="rounded-md bg-note px-3 py-2.5 shadow-[inset_3px_0_0_var(--color-primary)]">
        <RichText
          value={block.text}
          onChange={(text) => onChange({ ...block, text })}
          placeholder="Pearl or reminder"
          aria-label="Note"
          autoFocus={autoFocus}
          className="text-sm leading-relaxed"
          onEmptyBackspace={onRemove}
        />
      </div>
    );
  }
  if (block.type === "formula") {
    return (
      <div className="overflow-x-auto rounded-md bg-surface px-3 py-2">
        <AutoText
          value={block.text}
          onChange={(text) => onChange({ ...block, text })}
          placeholder="Formula"
          aria-label="Formula"
          className="font-mono text-sm leading-relaxed"
          onEmptyBackspace={onRemove}
        />
      </div>
    );
  }
  if (block.type === "ul") {
    return (
      <ListEditor
        sectionId={sectionId}
        block={block}
        onChange={onChange}
        autoFocus={autoFocus}
        onRemove={onRemove}
      />
    );
  }
  if (block.type === "image") {
    return <ImageEditor block={block} onChange={onChange} onRemove={onRemove} autoFocus={autoFocus} />;
  }
  if (block.type === "flow") {
    return <FlowEditor block={block} onChange={onChange} onRemove={onRemove} />;
  }
  if (block.type === "kv") {
    return (
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-80 border-collapse text-sm">
          <tbody>
            {block.rows.map((row, index) => (
              <LineRow
                key={index}
                as="tr"
                id={lineIdKv(sectionId, block.id, index)}
                className="border-b border-border last:border-0"
              >
                <th className="w-40 bg-hover px-3 py-2 text-left align-top font-medium">
                  <AutoText
                    value={row.k}
                    onChange={(k) => {
                      const rows = [...block.rows];
                      rows[index] = { ...row, k };
                      onChange({ ...block, rows });
                    }}
                    aria-label="Label"
                    onEmptyBackspace={() => {
                      if (!isEmptyText(row.k) || !isEmptyText(row.v)) return;
                      if (block.rows.length === 1) {
                        onRemove();
                        return;
                      }
                      onChange({ ...block, rows: block.rows.filter((_, i) => i !== index) });
                    }}
                  />
                </th>
                <td className="px-3 py-2 align-top">
                  <RichText
                    value={row.v}
                    onChange={(v) => {
                      const rows = [...block.rows];
                      rows[index] = { ...row, v };
                      onChange({ ...block, rows });
                    }}
                    aria-label="Value"
                    onEmptyBackspace={() => {
                      if (!isEmptyText(row.k) || !isEmptyText(row.v)) return;
                      if (block.rows.length === 1) {
                        onRemove();
                        return;
                      }
                      onChange({ ...block, rows: block.rows.filter((_, i) => i !== index) });
                    }}
                  />
                </td>
              </LineRow>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="px-3 py-2 text-sm text-subtle hover:text-fg"
          onClick={() => onChange({ ...block, rows: [...block.rows, { k: "", v: "" }] })}
        >
          Add row
        </button>
      </div>
    );
  }
  return <TableEditor sectionId={sectionId} block={block} onChange={onChange} onRemove={onRemove} />;
}

function ListEditor({
  sectionId,
  block,
  onChange,
  autoFocus,
  onRemove,
}: {
  sectionId: string;
  block: Extract<Block, { type: "ul" }>;
  onChange: (block: Block) => void;
  autoFocus?: boolean;
  onRemove: () => void;
}) {
  const items = normalizeListItems(block.items);
  const [focusId, setFocusId] = useState(autoFocus ? items[0]?.id : "");
  const [levelFor, setLevelFor] = useState<string | null>(null);

  function setItems(next: ListItem[], focus?: string) {
    onChange({ ...block, items: next });
    if (focus) setFocusId(focus);
  }

  function maxLevel(index: number) {
    if (index === 0) return 0;
    return Math.min(2, items[index - 1].level + 1);
  }

  return (
    <ul className="space-y-1">
      {items.map((item, index) => (
        <LineRow
          key={item.id}
          as="li"
          id={lineIdList(sectionId, block.id, item.id)}
          className="flex items-start gap-1"
          >
          <span className="flex min-w-0 flex-1 items-start gap-1" style={{ paddingLeft: item.level * 18 }}>
          <BulletLevel
            level={item.level}
            max={maxLevel(index)}
            open={levelFor === item.id}
            onOpen={() => setLevelFor(item.id)}
            onClose={() => setLevelFor(null)}
            onPick={(level) => {
              const next = [...items];
              next[index] = { ...item, level: Math.min(level, maxLevel(index)) };
              setItems(next, item.id);
              setLevelFor(null);
            }}
          />
          <RichText
            value={item.text}
            autoFocus={focusId === item.id}
            placeholder="Item"
            aria-label={`List item ${index + 1}`}
            className="text-base leading-relaxed"
            onChange={(text) => {
              const next = [...items];
              next[index] = { ...item, text };
              setItems(next);
            }}
            onPasteLines={(lines) => {
              const created: ListItem[] = lines.map((text) => ({
                id: bid("li"),
                text,
                level: item.level,
              }));
              const next = [...items];
              next.splice(index + 1, 0, ...created);
              setItems(next, created[created.length - 1]?.id);
            }}
            onEnter={() => {
              const created: ListItem = { id: bid("li"), text: "", level: item.level };
              const next = [...items];
              next.splice(index + 1, 0, created);
              setItems(next, created.id);
            }}
            onTab={(shift) => {
              const next = [...items];
              if (shift) {
                next[index] = { ...item, level: Math.max(0, item.level - 1) };
              } else {
                const prev = items[index - 1];
                if (!prev) return;
                next[index] = { ...item, level: Math.min(2, item.level + 1, prev.level + 1) };
              }
              setItems(next, item.id);
            }}
            onEmptyBackspace={() => {
              if (items.length === 1) {
                onRemove();
                return;
              }
              const next = items.filter((_, i) => i !== index);
              setItems(next, next[Math.max(0, index - 1)]?.id);
            }}
          />
          </span>
        </LineRow>
      ))}
      <li>
        <button
          type="button"
          className="ml-8 text-sm text-subtle hover:text-fg"
          onClick={() => {
            const created: ListItem = { id: bid("li"), text: "", level: 0 };
            setItems([...items, created], created.id);
          }}
        >
          Add item
        </button>
      </li>
    </ul>
  );
}

const LEVELS = [
  { level: 0, glyph: "•", label: "Level 1" },
  { level: 1, glyph: "◦", label: "Level 2" },
  { level: 2, glyph: "▪", label: "Level 3" },
] as const;

function BulletLevel({
  level,
  max,
  open,
  onOpen,
  onClose,
  onPick,
}: {
  level: number;
  max: number;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: (level: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const current = LEVELS[Math.min(2, Math.max(0, level))] ?? LEVELS[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Choose bullet level"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Bullet level"
        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-sm text-base leading-none text-muted hover:bg-hover hover:text-fg"
        onClick={() => (open ? onClose() : onOpen())}
      >
        {current.glyph}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-20 mt-1 min-w-36 rounded-md border border-border bg-surface py-1 shadow-sheet"
        >
          {LEVELS.map((item) => {
            const allowed = item.level <= max;
            return (
              <button
                key={item.level}
                type="button"
                role="menuitem"
                disabled={!allowed}
                aria-label={item.label}
                className={cn(
                  "flex h-9 w-full items-center gap-2 px-3 text-sm",
                  item.level === level ? "bg-active text-fg" : "text-fg hover:bg-hover",
                  !allowed && "cursor-not-allowed opacity-40 hover:bg-transparent",
                )}
                onClick={() => {
                  if (allowed) onPick(item.level);
                }}
              >
                <span className="w-8 text-left" style={{ paddingLeft: item.level * 8 }}>
                  {item.glyph}
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ImageEditor({
  block,
  onChange,
  onRemove,
  autoFocus,
}: {
  block: Extract<Block, { type: "image" }>;
  onChange: (block: Block) => void;
  onRemove: () => void;
  autoFocus?: boolean;
}) {
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) boxRef.current?.focus();
  }, [autoFocus]);

  async function onFile(file: Blob | undefined) {
    if (!file) return;
    setError("");
    try {
      const src = await compressImage(file);
      onChange({ ...block, src });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add picture");
    }
  }

  async function onPaste(event: React.ClipboardEvent) {
    const file = await imageFromClipboard(event.clipboardData);
    if (!file) return;
    event.preventDefault();
    event.stopPropagation();
    await onFile(file);
  }

  async function onAddClick() {
    const clip = await imageFromSystemClipboard();
    if (clip) {
      await onFile(clip);
      return;
    }
    inputRef.current?.click();
  }

  return (
    <div
      ref={boxRef}
      className="space-y-2"
      tabIndex={0}
      onPasteCapture={onPaste}
      onPaste={onPaste}
      onKeyDown={(event) => {
        if ((event.key === "Backspace" || event.key === "Delete") && event.target === event.currentTarget) {
          event.preventDefault();
          onRemove();
        }
      }}
    >
      {block.src ? (
        <img
          src={block.src}
          alt={stripHtml(block.caption) || "Note picture"}
          className="max-h-80 w-full rounded-md object-contain bg-surface"
        />
      ) : (
        <div
          role="button"
          tabIndex={0}
          contentEditable
          suppressContentEditableWarning
          aria-label="Paste or add picture"
          className={cn(
            "flex h-28 w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed text-sm outline-none",
            over ? "border-primary bg-hover text-fg" : "border-border-strong text-muted hover:bg-hover hover:text-fg",
          )}
          onClick={() => void onAddClick()}
          onPaste={onPaste}
          onInput={(event) => {
            event.currentTarget.textContent = "";
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setOver(false);
            const file = event.dataTransfer.files[0];
            if (file?.type.startsWith("image/")) void onFile(file);
            else void imageFromClipboard(event.dataTransfer).then((next) => next && onFile(next));
          }}
        >
          <ImagePlus className="pointer-events-none size-5" />
          <span className="pointer-events-none">Paste or click to add</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          void onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {block.src ? (
        <div className="flex gap-3">
          <button type="button" className="text-sm text-subtle hover:text-fg" onClick={() => void onAddClick()}>
            Replace
          </button>
        </div>
      ) : null}
      <RichText
        value={block.caption}
        onChange={(caption) => onChange({ ...block, caption })}
        placeholder="Caption"
        aria-label="Picture caption"
        className="text-sm text-muted"
        onEmptyBackspace={onRemove}
      />
    </div>
  );
}

function TableEditor({
  sectionId,
  block,
  onChange,
  onRemove,
}: {
  sectionId: string;
  block: Extract<Block, { type: "table" }>;
  onChange: (block: Block) => void;
  onRemove: () => void;
}) {
  function setHeader(index: number, value: string) {
    const headers = [...block.headers];
    headers[index] = value;
    onChange({ ...block, headers });
  }
  function setCell(r: number, c: number, value: string) {
    const rows = block.rows.map((row) => [...row]);
    rows[r][c] = value;
    onChange({ ...block, rows });
  }
  function addRow() {
    onChange({ ...block, rows: [...block.rows, block.headers.map(() => "")] });
  }
  function addCol() {
    onChange({
      ...block,
      headers: [...block.headers, ""],
      rows: block.rows.map((row) => [...row, ""]),
    });
  }
  function rowEmpty(index: number) {
    return block.rows[index]?.every((cell) => isEmptyText(cell));
  }
  function colEmpty(index: number) {
    return isEmptyText(block.headers[index] ?? "") && block.rows.every((row) => isEmptyText(row[index] ?? ""));
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-96 border-collapse text-sm">
        <thead>
          <tr className="bg-hover">
            {block.headers.map((header, c) => (
              <th key={c} className="border-b border-r border-border px-2 py-1.5 text-left font-medium last:border-r-0">
                <LineInput
                  value={header}
                  onChange={(value) => setHeader(c, value)}
                  aria-label={`Column ${c + 1}`}
                  onEmptyBackspace={() => {
                    if (!colEmpty(c)) return;
                    if (block.headers.length === 1) {
                      onRemove();
                      return;
                    }
                    onChange({
                      ...block,
                      headers: block.headers.filter((_, i) => i !== c),
                      rows: block.rows.map((row) => row.filter((_, i) => i !== c)),
                    });
                  }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, r) => (
            <LineRow
              key={r}
              as="tr"
              id={lineIdTable(sectionId, block.id, r)}
              className="border-b border-border last:border-0"
            >
              {row.map((cell, c) => (
                <td key={c} className="border-r border-border px-2 py-1.5 align-top last:border-r-0">
                  <RichText
                    value={cell}
                    onChange={(value) => setCell(r, c, value)}
                    aria-label={`Row ${r + 1} column ${c + 1}`}
                    className="text-sm leading-snug"
                    onEmptyBackspace={() => {
                      if (!rowEmpty(r)) return;
                      if (block.rows.length === 1) {
                        onRemove();
                        return;
                      }
                      onChange({ ...block, rows: block.rows.filter((_, i) => i !== r) });
                    }}
                  />
                </td>
              ))}
            </LineRow>
          ))}
        </tbody>
      </table>
      <div className="flex gap-3 px-3 py-2">
        <button type="button" className="text-sm text-subtle hover:text-fg" onClick={addRow}>
          Add row
        </button>
        <button type="button" className="text-sm text-subtle hover:text-fg" onClick={addCol}>
          Add column
        </button>
      </div>
    </div>
  );
}

const ADD_TYPES: { type: Block["type"]; label: string }[] = [
  { type: "p", label: "Text" },
  { type: "h", label: "Heading" },
  { type: "ul", label: "List" },
  { type: "kv", label: "Key / value" },
  { type: "table", label: "Table" },
  { type: "flow", label: "Flowchart" },
  { type: "image", label: "Picture" },
  { type: "formula", label: "Formula" },
  { type: "note", label: "Pearl" },
];

export function AddBlockBar({ onAdd }: { onAdd: (block: Block) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1 pt-2">
      <Plus className="size-3.5 text-subtle" />
      {ADD_TYPES.map((item) => (
        <Button
          key={item.type}
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-8 px-2 text-xs text-muted")}
          onClick={() => onAdd(newBlock(item.type))}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
