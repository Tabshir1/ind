import { ChevronDown, Circle, Hash, Moon, Plus, Sun, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { DragHandle, DropLine, useDrag } from "@/components/drag-context";
import { AutoText } from "@/components/field";
import { Button } from "@/components/ui/button";
import type { Theme } from "@/lib/notes-types";
import { blockSearchText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import { useNotes } from "@/store/notes";

const THEMES: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "black", label: "Black", icon: Circle },
];

export function NotesSidebar({
  query,
  onQuery,
}: {
  query: string;
  onQuery: (value: string) => void;
}) {
  const groups = useNotes((s) => s.groups);
  const pages = useNotes((s) => s.pages);
  const activeId = useNotes((s) => s.activeId);
  const view = useNotes((s) => s.view);
  const theme = useNotes((s) => s.theme);
  const trash = useNotes((s) => s.trash);
  const setActive = useNotes((s) => s.setActive);
  const openTrash = useNotes((s) => s.openTrash);
  const toggleGroup = useNotes((s) => s.toggleGroup);
  const addPage = useNotes((s) => s.addPage);
  const addGroup = useNotes((s) => s.addGroup);
  const renameGroup = useNotes((s) => s.renameGroup);
  const removePage = useNotes((s) => s.removePage);
  const removeGroup = useNotes((s) => s.removeGroup);
  const setTheme = useNotes((s) => s.setTheme);
  const setSidebarOpen = useNotes((s) => s.setSidebarOpen);
  const setNavOpen = useNotes((s) => s.setNavOpen);
  const [draftGroup, setDraftGroup] = useState("");
  const confirm = useConfirm();
  const { drag } = useDrag();
  const searching = Boolean(query.trim());

  const q = query.trim().toLowerCase();
  const filtered = q
    ? groups
        .map((group) => ({
          ...group,
          open: true,
          pages: group.pages.filter((page) => {
            const doc = pages[page.id];
            const hay = [
              page.title,
              doc?.title,
              ...(doc?.sections.flatMap((s) => [
                s.title,
                ...s.blocks.map((b) => blockSearchText(b)),
              ]) ?? []),
            ]
              .join(" ")
              .toLowerCase();
            return hay.includes(q);
          }),
        }))
        .filter((group) => group.pages.length > 0)
    : groups;

  return (
    <div className="flex h-full flex-col bg-sidebar text-fg">
      <div className="flex h-14 items-center justify-between gap-2 px-3">
        <div>
          <p className="text-sm font-semibold tracking-tight">Bedside</p>
          <p className="text-xs text-muted">RT notes</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="hidden lg:inline-flex"
            aria-label="Hide topics"
            title="Hide topics"
            onClick={() => setNavOpen(false)}
          >
            <X className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="px-3 pb-3">
        <label className="sr-only" htmlFor="notes-search">
          Search notes
        </label>
        <input
          id="notes-search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search"
          suppressHydrationWarning
          className="h-9 w-full rounded-sm bg-hover px-3 text-sm text-fg outline-none placeholder:text-subtle"
        />
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {filtered.map((group, groupIndex) => {
          const groupOver =
            drag?.item.kind === "group" &&
            drag.over?.kind === "group-slot" &&
            drag.over.index === groupIndex;
          const groupAppend =
            drag?.item.kind === "page" &&
            drag.over?.kind === "page-slot" &&
            drag.over.groupId === group.id &&
            drag.over.index === 0 &&
            group.pages.length === 0;
          return (
            <div
              key={group.id}
              className="mb-3"
              data-drop-kind="group"
              data-id={group.id}
              data-index={groupIndex}
              data-page-count={group.pages.length}
            >
              <DropLine show={groupOver} />
              <div className="group/cat flex items-center gap-0.5">
                {!searching ? (
                  <DragHandle
                    item={{ kind: "group", id: group.id, title: group.title, index: groupIndex }}
                    label={`Move ${group.title}`}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-label={group.open ? `Collapse ${group.title}` : `Expand ${group.title}`}
                  className="grid size-8 shrink-0 place-items-center rounded-sm text-muted hover:bg-hover hover:text-fg"
                >
                  <ChevronDown
                    className={cn(
                      "size-3 shrink-0 transition-transform duration-150",
                      group.open ? "rotate-0" : "-rotate-90",
                    )}
                  />
                </button>
                <AutoText
                  value={group.title}
                  onChange={(title) => renameGroup(group.id, title)}
                  onBlur={(title) => renameGroup(group.id, title.trim() || "Untitled")}
                  aria-label="Category name"
                  className="min-w-0 flex-1 py-1 text-xs font-semibold uppercase tracking-wider"
                />
                <button
                  type="button"
                  aria-label={`Add page in ${group.title}`}
                  className="grid size-8 place-items-center rounded-sm text-subtle opacity-100 hover:bg-hover hover:text-fg lg:opacity-0 lg:group-hover/cat:opacity-100"
                  onClick={() => addPage(group.id, "New page")}
                >
                  <Plus className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${group.title}`}
                  className="grid size-8 place-items-center rounded-sm text-subtle opacity-100 hover:bg-hover hover:text-fg lg:opacity-0 lg:group-hover/cat:opacity-100"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Are you sure you want to delete?",
                      body: `“${group.title}” and its pages will go to Trash.`,
                    });
                    if (ok) removeGroup(group.id);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              {group.open ? (
                <ul className="mt-0.5">
                  {group.pages.map((page, pageIndex) => {
                    const active = page.id === activeId && view === "notes";
                    const slotBefore =
                      drag?.item.kind === "page" &&
                      drag.over?.kind === "page-slot" &&
                      drag.over.groupId === group.id &&
                      drag.over.index === pageIndex;
                    const sectionOver =
                      drag?.item.kind === "section" &&
                      drag.over?.kind === "page" &&
                      drag.over.pageId === page.id;
                    return (
                      <li key={page.id}>
                        <DropLine show={Boolean(slotBefore)} />
                        <div
                          className={cn(
                            "group/page relative flex items-center rounded-sm",
                            active ? "bg-active" : "hover:bg-hover",
                            sectionOver && "bg-active ring-1 ring-primary",
                          )}
                          data-drop-kind="page"
                          data-id={page.id}
                          data-group-id={group.id}
                          data-group-index={groupIndex}
                          data-index={pageIndex}
                          data-title={page.title}
                        >
                          {!searching ? (
                            <DragHandle
                              item={{
                                kind: "page",
                                id: page.id,
                                title: page.title,
                                groupId: group.id,
                                index: pageIndex,
                              }}
                              label={`Move ${page.title}`}
                            />
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setActive(page.id)}
                            className={cn(
                              "flex h-9 min-w-0 flex-1 items-center gap-2 pr-9 text-left text-sm",
                              active ? "font-medium text-fg" : "text-muted hover:text-fg",
                            )}
                          >
                            <Hash className="size-3.5 shrink-0 opacity-70" />
                            <span className="min-w-0 truncate">{page.title}</span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${page.title}`}
                            className={cn(
                              "absolute right-1 top-1 grid size-7 place-items-center rounded-sm text-subtle hover:bg-hover hover:text-fg",
                              active ? "opacity-100" : "opacity-0 group-hover/page:opacity-100",
                            )}
                            onClick={async () => {
                              const ok = await confirm({
                                title: "Are you sure you want to delete?",
                                body: `“${page.title}” will go to Trash.`,
                              });
                              if (ok) removePage(page.id);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                  <li
                    data-drop-kind="page-end"
                    data-group-id={group.id}
                    data-index={group.pages.length}
                    className="h-2"
                  >
                    <DropLine
                      show={
                        drag?.item.kind === "page" &&
                        drag.over?.kind === "page-slot" &&
                        drag.over.groupId === group.id &&
                        drag.over.index === group.pages.length
                      }
                    />
                  </li>
                </ul>
              ) : null}
              {groupAppend ? <DropLine show /> : null}
            </div>
          );
        })}
        {drag?.item.kind === "group" &&
        drag.over?.kind === "group-slot" &&
        drag.over.index === filtered.length ? (
          <DropLine show />
        ) : null}
        <div data-drop-kind="group-end" data-index={filtered.length} className="h-3" />

        <form
          className="mt-2 flex gap-1 px-1"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draftGroup.trim()) return;
            addGroup(draftGroup);
            setDraftGroup("");
          }}
        >
          <input
            value={draftGroup}
            onChange={(event) => setDraftGroup(event.target.value)}
            placeholder="New category"
            aria-label="New category name"
            suppressHydrationWarning
            className="h-9 w-full rounded-sm bg-hover px-2 text-sm text-fg outline-none placeholder:text-subtle"
          />
          <Button type="submit" variant="ghost" size="icon-sm" aria-label="Add category">
            <Plus className="size-4" />
          </Button>
        </form>
      </nav>

      <div className="border-t border-border p-2">
        <div className="flex gap-1">
          {THEMES.map((item) => {
            const Icon = item.icon;
            const on = theme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                aria-label={item.label}
                title={item.label}
                onClick={() => setTheme(item.id)}
                className={cn(
                  "flex h-9 flex-1 items-center justify-center gap-1 rounded-sm text-xs font-medium",
                  on ? "bg-active text-fg" : "text-muted hover:bg-hover hover:text-fg",
                )}
              >
                <Icon className={cn("size-3.5", item.id === "black" && "fill-current")} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={openTrash}
          className={cn(
            "mt-1 flex h-9 w-full items-center gap-2 rounded-sm px-2 text-sm",
            view === "trash" ? "bg-active font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg",
          )}
        >
          <Trash2 className="size-3.5" />
          <span className="flex-1 text-left">Trash</span>
          {trash.length > 0 ? <span className="text-xs tabular-nums text-subtle">{trash.length}</span> : null}
        </button>
      </div>
    </div>
  );
}
