import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type ConfirmOpts = {
  title?: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
};

type ConfirmFn = (opts?: ConfirmOpts) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<
    | (Required<Pick<ConfirmOpts, "title" | "body" | "confirmLabel">> & {
        danger: boolean;
        resolve: (value: boolean) => void;
      })
    | null
  >(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise((resolve) => {
      setOpen({
        title: opts?.title ?? "Are you sure you want to delete?",
        body: opts?.body ?? "It will go to Trash. You can restore it later or delete it forever.",
        confirmLabel: opts?.confirmLabel ?? "Delete",
        danger: Boolean(opts?.danger),
        resolve,
      });
    });
  }, []);

  const finish = useCallback((value: boolean) => {
    open?.resolve(value);
    setOpen(null);
  }, [open]);

  const value = useMemo(() => confirm, [confirm]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 border-0 bg-fg/40"
            onClick={() => finish(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="relative w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-sheet"
          >
            <h2 id="confirm-title" className="text-base font-semibold tracking-tight">
              {open.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{open.body}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => finish(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className={open.danger ? "bg-danger text-danger-fg hover:opacity-90" : undefined}
                onClick={() => finish(true)}
              >
                {open.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}
