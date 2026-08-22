import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Bold, Italic, Underline } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clipboardToHtml,
  exec,
  FONTS,
  HIGHLIGHTS,
  insertHtml,
  plainToHtml,
  sanitize,
  SIZES,
  TEXT_COLORS,
  toHtml,
} from "@/lib/rich-text";

type Marks = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  highlight: string;
  font: string;
  size: string;
};

function readMarks(): Marks {
  const color = document.queryCommandValue("foreColor");
  const highlight = document.queryCommandValue("hiliteColor") || document.queryCommandValue("backColor");
  const font = document.queryCommandValue("fontName").replace(/['"]/g, "");
  const size = document.queryCommandValue("fontSize");
  const sizeMap: Record<string, string> = { "2": "0.8125rem", "3": "1rem", "5": "1.25rem", "6": "1.5rem" };
  return {
    bold: document.queryCommandState("bold"),
    italic: document.queryCommandState("italic"),
    underline: document.queryCommandState("underline"),
    color,
    highlight,
    font,
    size: sizeMap[size] ?? "",
  };
}

function matchesColor(actual: string, hex: string) {
  const n = (s: string) => s.replace(/\s/g, "").toLowerCase();
  if (n(actual) === n(hex)) return true;
  const m = actual.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return false;
  const to = hex.replace("#", "");
  const rgb = [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("");
  return rgb === to;
}

function stripVisible(value: string) {
  return value.replace(/<br\s*\/?>/gi, "").replace(/<[^>]+>/g, "").replace(/&nbsp;|\u200b/g, "").trim();
}

function isCaretEmpty(el: HTMLDivElement | null) {
  if (!el) return false;
  return stripVisible(el.innerHTML) === "";
}

export function RichText({
  value,
  onChange,
  onEnter,
  onTab,
  onEmptyBackspace,
  onPasteLines,
  placeholder,
  className,
  autoFocus,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  onTab?: (shift: boolean) => void;
  onEmptyBackspace?: () => void;
  onPasteLines?: (lines: string[]) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(Boolean(autoFocus));
  const [marks, setMarks] = useState<Marks | null>(null);
  const empty = !stripVisible(value);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (focused && document.activeElement === el) return;
    const html = toHtml(value) || "";
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [value, focused]);

  useEffect(() => {
    if (!autoFocus) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }, [autoFocus]);

  useEffect(() => {
    if (!focused) return;
    const update = () => setMarks(readMarks());
    update();
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, [focused]);

  function emit() {
    const el = ref.current;
    if (!el) return;
    onChange(sanitize(el.innerHTML));
  }

  function apply(command: string, arg?: string) {
    ref.current?.focus();
    exec(command, arg);
    emit();
    setMarks(readMarks());
  }

  function applySize(css: string) {
    ref.current?.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    if (sel.isCollapsed) {
      const span = document.createElement("span");
      span.style.fontSize = css;
      span.appendChild(document.createTextNode("\u200b"));
      sel.getRangeAt(0).insertNode(span);
      const range = document.createRange();
      range.setStart(span.firstChild ?? span, 1);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      const wrapped = `<span style="font-size:${css}">${sel.toString()}</span>`;
      document.execCommand("insertHTML", false, wrapped);
    }
    emit();
    setMarks(readMarks());
  }

  function pasteClipboard(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const el = ref.current;
    if (!el) return;
    const plain = event.clipboardData.getData("text/plain") || "";
    const html = event.clipboardData.getData("text/html") || "";
    const lines = plain.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    if (onPasteLines && lines.length > 1) {
      insertHtml(el, plainToHtml(lines[0] ?? ""));
      onPasteLines(lines.slice(1));
      emit();
      return;
    }
    insertHtml(el, clipboardToHtml(html, plain));
    emit();
  }

  return (
    <div className="relative min-w-0 flex-1">
      {empty && !focused ? (
        <span className="pointer-events-none absolute left-0 top-0 text-subtle">{placeholder || "\u00a0"}</span>
      ) : null}
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        aria-placeholder={placeholder}
        contentEditable
        suppressContentEditableWarning
        suppressHydrationWarning
        className={cn(
          "rt min-h-6 w-full whitespace-pre-wrap break-words text-pretty text-fg outline-none",
          empty && !focused && "text-transparent",
          className,
        )}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          emit();
          setFocused(false);
        }}
        onInput={emit}
        onPaste={pasteClipboard}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
            event.preventDefault();
            apply("bold");
            return;
          }
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
            event.preventDefault();
            apply("italic");
            return;
          }
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "u") {
            event.preventDefault();
            apply("underline");
            return;
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (onEnter) {
              emit();
              onEnter();
              return;
            }
            insertHtml(event.currentTarget, "<br>");
            emit();
            return;
          }
          if (event.key === "Tab" && onTab) {
            event.preventDefault();
            emit();
            onTab(event.shiftKey);
            return;
          }
          if (event.key === "Backspace" && onEmptyBackspace && isCaretEmpty(ref.current)) {
            event.preventDefault();
            onEmptyBackspace();
          }
        }}
      />
      {focused ? (
        <FormatToolbar
          marks={marks}
          onBold={() => apply("bold")}
          onItalic={() => apply("italic")}
          onUnderline={() => apply("underline")}
          onColor={(hex) => apply("foreColor", hex)}
          onHighlight={(hex) => apply("hiliteColor", hex)}
          onFont={(name) => apply("fontName", name)}
          onSize={applySize}
          onClear={() => apply("removeFormat")}
        />
      ) : null}
    </div>
  );
}

export function FormatToolbar({
  marks,
  onBold,
  onItalic,
  onUnderline,
  onColor,
  onHighlight,
  onFont,
  onSize,
  onClear,
  className,
}: {
  marks: Marks | null;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onColor: (hex: string) => void;
  onHighlight: (hex: string) => void;
  onFont: (name: string) => void;
  onSize: (css: string) => void;
  onClear: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn("mt-1 flex flex-wrap items-center gap-0.5 rounded-md border border-border bg-surface p-1", className)}
      onMouseDown={(event) => event.preventDefault()}
      onPointerDown={(event) => event.preventDefault()}
    >
      <IconBtn label="Bold" active={Boolean(marks?.bold)} onClick={onBold}>
        <Bold className="size-3.5" />
      </IconBtn>
      <IconBtn label="Italic" active={Boolean(marks?.italic)} onClick={onItalic}>
        <Italic className="size-3.5" />
      </IconBtn>
      <IconBtn label="Underline" active={Boolean(marks?.underline)} onClick={onUnderline}>
        <Underline className="size-3.5" />
      </IconBtn>
      <Sep />
      {HIGHLIGHTS.map((item) => (
        <Swatch
          key={item.id}
          label={item.label}
          color={item.value}
          active={Boolean(marks?.highlight && matchesColor(marks.highlight, item.value))}
          onClick={() => onHighlight(item.value)}
          marker
        />
      ))}
      <NoneSwatch
        label="No highlight"
        active={Boolean(marks && !HIGHLIGHTS.some((item) => matchesColor(marks.highlight, item.value)))}
        onClick={() => onHighlight("transparent")}
      />
      <Sep />
      <NoneSwatch
        label="Default color"
        active={Boolean(marks && !TEXT_COLORS.some((item) => matchesColor(marks.color, item.value)))}
        onClick={() => onColor("inherit")}
        letter
      />
      {TEXT_COLORS.map((item) => (
        <Swatch
          key={item.id}
          label={item.label}
          color={item.value}
          active={Boolean(marks?.color && matchesColor(marks.color, item.value))}
          onClick={() => onColor(item.value)}
        />
      ))}
      <Sep />
      {SIZES.map((item) => (
        <button
          key={item.id}
          type="button"
          title={`Size ${item.label}`}
          aria-label={`Size ${item.label}`}
          onClick={() => onSize(item.value)}
          className={cn(
            "grid h-8 min-w-8 place-items-center rounded-sm px-1 text-xs font-medium",
            marks?.size === item.value ? "bg-active text-fg" : "text-muted hover:bg-hover hover:text-fg",
          )}
        >
          {item.label}
        </button>
      ))}
      <Sep />
      {FONTS.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.label}
          aria-label={`Font ${item.label}`}
          onClick={() => onFont(item.value)}
          className={cn(
            "h-8 rounded-sm px-1.5 text-xs",
            marks?.font.toLowerCase().includes(item.value.split(" ")[0].toLowerCase())
              ? "bg-active text-fg"
              : "text-muted hover:bg-hover hover:text-fg",
          )}
          style={{ fontFamily: item.value }}
        >
          {item.label}
        </button>
      ))}
      <button
        type="button"
        className="h-8 rounded-sm px-1.5 text-xs text-muted hover:bg-hover hover:text-fg"
        onClick={onClear}
      >
        Clear
      </button>
    </div>
  );
}

function IconBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-sm",
        active ? "bg-active text-fg" : "text-muted hover:bg-hover hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function Swatch({
  label,
  color,
  active,
  onClick,
  marker,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
  marker?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn("grid size-8 place-items-center rounded-sm", active && "bg-active")}
    >
      <span
        className="size-3.5 rounded-sm shadow-[inset_0_0_0_1px_rgb(0_0_0_/_0.15)]"
        style={marker ? { backgroundColor: color } : { backgroundColor: color }}
      />
    </button>
  );
}

function NoneSwatch({
  label,
  active,
  onClick,
  letter,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  letter?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn("grid size-8 place-items-center rounded-sm", active && "bg-active")}
    >
      <span className="relative grid size-3.5 place-items-center rounded-sm shadow-[inset_0_0_0_1px_rgb(0_0_0_/_0.25)]">
        {letter ? <span className="text-[9px] font-semibold leading-none">A</span> : null}
        <span className="absolute inset-0 m-auto h-px w-4 rotate-45 bg-danger" />
      </span>
    </button>
  );
}

function Sep() {
  return <span className="mx-0.5 h-5 w-px bg-border" />;
}
