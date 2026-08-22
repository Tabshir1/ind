import { Menu, PanelLeft, PanelLeftClose, Redo2, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { DragProvider } from "@/components/drag-context";
import { NotesPage } from "@/components/notes-page";
import { NotesSidebar } from "@/components/notes-sidebar";
import { NotesTrash } from "@/components/notes-trash";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNotes } from "@/store/notes";

function applyTheme(theme: "light" | "dark" | "black") {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("black", theme === "black");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "black" ? "#000000" : theme === "dark" ? "#1e1f22" : "#f3f3f1");
  }
}

function NotesShell() {
  const [query, setQuery] = useState("");
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const theme = useNotes((s) => s.theme);
  const sidebarOpen = useNotes((s) => s.sidebarOpen);
  const setSidebarOpen = useNotes((s) => s.setSidebarOpen);
  const navOpen = useNotes((s) => s.navOpen);
  const setNavOpen = useNotes((s) => s.setNavOpen);
  const navWidth = useNotes((s) => s.navWidth);
  const setNavWidth = useNotes((s) => s.setNavWidth);
  const view = useNotes((s) => s.view);
  const lastTrashId = useNotes((s) => s.lastTrashId);
  const undoTrash = useNotes((s) => s.undoTrash);
  const dismissUndo = useNotes((s) => s.dismissUndo);
  const openTrash = useNotes((s) => s.openTrash);
  const undo = useNotes((s) => s.undo);
  const redo = useNotes((s) => s.redo);
  const canUndo = useNotes((s) => s.past.length > 0);
  const canRedo = useNotes((s) => s.future.length > 0);
  const resize = useRef<{ x: number; w: number } | null>(null);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem("bedside-notes-v2")) {
        const raw = window.localStorage.getItem("bedside-notes-v1");
        if (raw) {
          const theme = JSON.parse(raw).state?.theme;
          if (theme === "light" || theme === "dark" || theme === "black") {
            window.sessionStorage.setItem("bedside-carry-theme", theme);
          }
        }
      }
    } catch {
      /* ignore */
    }
    void Promise.resolve(useNotes.persist.rehydrate()).then(() => {
      const theme = window.sessionStorage.getItem("bedside-carry-theme");
      if (theme === "light" || theme === "dark" || theme === "black") {
        useNotes.getState().setTheme(theme);
        window.sessionStorage.removeItem("bedside-carry-theme");
      }
    });
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        useNotes.getState().redo();
        return;
      }
      if (key === "z") {
        event.preventDefault();
        useNotes.getState().undo();
        return;
      }
      if (key === "y") {
        event.preventDefault();
        useNotes.getState().redo();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    if (!lastTrashId) return;
    const timer = window.setTimeout(() => dismissUndo(), 6000);
    return () => window.clearTimeout(timer);
  }, [lastTrashId, dismissUndo]);

  return (
    <div className="flex h-dvh bg-bg text-fg">
      {navOpen ? (
        <aside
          className="relative hidden h-full min-w-0 shrink-0 overflow-hidden border-r border-border lg:block"
          style={{ width: dragWidth ?? navWidth }}
        >
          <NotesSidebar query={query} onQuery={setQuery} />
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            title="Drag to resize"
            className="absolute top-0 right-0 z-20 h-full w-2 cursor-col-resize touch-none hover:bg-primary/30"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              resize.current = { x: event.clientX, w: dragWidth ?? navWidth };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const start = resize.current;
              if (!start) return;
              setDragWidth(Math.min(520, Math.max(80, start.w + event.clientX - start.x)));
            }}
            onPointerUp={(event) => {
              const start = resize.current;
              resize.current = null;
              const next = start ? start.w + event.clientX - start.x : (dragWidth ?? navWidth);
              setDragWidth(null);
              if (next < 120) {
                setNavOpen(false);
                return;
              }
              setNavWidth(next);
            }}
            onPointerCancel={() => {
              resize.current = null;
              setDragWidth(null);
            }}
          />
        </aside>
      ) : null}

      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 border-0 bg-fg/40"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative h-full w-72 max-w-xs border-r border-border">
            <NotesSidebar query={query} onQuery={setQuery} />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-bg px-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={navOpen ? "Hide topics" : "Show topics"}
            title={navOpen ? "Hide topics" : "Show topics"}
            className="hidden lg:inline-flex"
            onClick={() => setNavOpen(!navOpen)}
          >
            {navOpen ? <PanelLeftClose className="size-5" /> : <PanelLeft className="size-5" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Open menu"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <p className="min-w-0 truncate text-sm font-semibold lg:hidden">Bedside</p>
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Undo"
              title="Undo"
              disabled={!canUndo}
              onClick={undo}
            >
              <Undo2 className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Redo"
              title="Redo"
              disabled={!canRedo}
              onClick={redo}
            >
              <Redo2 className="size-4" />
            </Button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {view === "trash" ? <NotesTrash /> : <NotesPage />}
        </div>
      </div>

      {lastTrashId ? (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg">
          <span>Moved to Trash</span>
          <Button type="button" variant="ghost" size="sm" onClick={undoTrash}>
            <Undo2 className="size-3.5" />
            Undo
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={openTrash}>
            Open
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function NotesApp() {
  return (
    <ConfirmProvider>
      <DragProvider>
        <NotesShell />
      </DragProvider>
    </ConfirmProvider>
  );
}
