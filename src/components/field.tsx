import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function AutoText({
  value,
  onChange,
  onBlur,
  className,
  placeholder,
  "aria-label": ariaLabel,
  onEmptyBackspace,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
  onEmptyBackspace?: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [focused, value]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 24)}px`;
  }, [draft]);

  return (
    <textarea
      ref={ref}
      value={draft}
      rows={1}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        onChange(next);
      }}
      onBlur={() => {
        onBlur?.(draft);
        setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Backspace" && !draft && (ref.current?.selectionStart ?? 0) === 0) {
          event.preventDefault();
          onEmptyBackspace?.();
        }
      }}
      className={cn(
        "block w-full resize-none overflow-hidden bg-transparent text-fg outline-none placeholder:text-subtle",
        className,
      )}
    />
  );
}

export function LineInput({
  value,
  onChange,
  onSubmit,
  className,
  placeholder,
  "aria-label": ariaLabel,
  onEmptyBackspace,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
  onEmptyBackspace?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    if (caretRef.current == null) {
      el.select();
    } else {
      el.setSelectionRange(caretRef.current, caretRef.current);
    }
  }, [editing]);

  if (!editing) {
    return (
      <div
        role="textbox"
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={() => setEditing(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setEditing(true);
          }
        }}
        className={cn("w-full cursor-text text-fg", !value && "text-subtle", className)}
      >
        {value || placeholder || "\u00a0"}
      </div>
    );
  }

  return (
    <input
      ref={ref}
      value={draft}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(event) => {
        caretRef.current = event.target.selectionStart;
        const next = event.target.value;
        setDraft(next);
        onChange(next);
      }}
      onBlur={() => {
        caretRef.current = null;
        onSubmit?.();
        setEditing(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Backspace" && !draft && (ref.current?.selectionStart ?? 0) === 0) {
          event.preventDefault();
          onEmptyBackspace?.();
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          onSubmit?.();
          setEditing(false);
        }
      }}
      className={cn("w-full bg-transparent text-fg outline-none placeholder:text-subtle", className)}
    />
  );
}
