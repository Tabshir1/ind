import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_PAGE_ID, SEED } from "@/data/seed";
import type {
  Block,
  Group,
  LineTarget,
  NotesData,
  Page,
  PageDoc,
  Section,
  Theme,
  TrashItem,
} from "@/lib/notes-types";
import { cloneSection, sectionPlainText } from "@/lib/clone-notes";
import { applyHtmlFormat, migratePages, normalizeListItems, stripHtml, writeClipboard, type LineFormat } from "@/lib/rich-text";

type Snap = {
  groups: Group[];
  pages: Record<string, PageDoc>;
  activeId: string;
  trash: TrashItem[];
  view: "notes" | "trash";
};

type NotesState = NotesData & {
  activeId: string;
  view: "notes" | "trash";
  theme: Theme;
  sidebarOpen: boolean;
  navOpen: boolean;
  navWidth: number;
  trash: TrashItem[];
  lastTrashId: string | null;
  past: Snap[];
  future: Snap[];
  copiedSection: Section | null;
  setActive: (id: string) => void;
  openTrash: () => void;
  setTheme: (theme: Theme) => void;
  setSidebarOpen: (open: boolean) => void;
  setNavOpen: (open: boolean) => void;
  setNavWidth: (width: number) => void;
  toggleGroup: (id: string) => void;
  toggleSection: (pageId: string, sectionId: string) => void;
  renameGroup: (id: string, title: string) => void;
  renamePage: (id: string, title: string) => void;
  renameSection: (pageId: string, sectionId: string, title: string) => void;
  updateBlock: (pageId: string, sectionId: string, block: Block) => void;
  addBlock: (pageId: string, sectionId: string, block: Block) => void;
  removeBlock: (pageId: string, sectionId: string, blockId: string) => void;
  applyLineDeletes: (pageId: string, targets: LineTarget[]) => void;
  applyLineFormat: (pageId: string, targets: LineTarget[], fmt: LineFormat) => void;
  addSection: (pageId: string) => void;
  removeSection: (pageId: string, sectionId: string) => void;
  duplicateSection: (pageId: string, sectionId: string) => void;
  copySection: (pageId: string, sectionId: string) => void;
  pasteSection: (pageId: string, afterSectionId: string) => void;
  addPage: (groupId: string, title: string) => string;
  removePage: (pageId: string) => void;
  addGroup: (title: string) => void;
  removeGroup: (groupId: string) => void;
  moveGroup: (fromIndex: number, toSlot: number) => void;
  movePage: (pageId: string, toGroupId: string, toSlot: number) => void;
  moveSection: (sectionId: string, fromPageId: string, toPageId: string, toSlot: number) => void;
  restoreTrash: (id: string) => void;
  purgeTrash: (id: string) => void;
  emptyTrash: () => void;
  undoTrash: () => void;
  dismissUndo: () => void;
  undo: () => void;
  redo: () => void;
};

export function newId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneSeed(): NotesData {
  return structuredClone(SEED);
}

function blockLabel(block: Block): string {
  if (block.type === "p" || block.type === "h" || block.type === "note" || block.type === "formula") {
    return stripHtml(block.text).slice(0, 48) || "Block";
  }
  if (block.type === "ul") {
    const hit = normalizeListItems(block.items).find((item) => stripHtml(item.text));
    return stripHtml(hit?.text ?? "").slice(0, 48) || "List";
  }
  if (block.type === "image") return stripHtml(block.caption).slice(0, 48) || "Picture";
  if (block.type === "flow") return "Flowchart";
  if (block.type === "kv") return "Key / value";
  return "Table";
}

function moveInList<T>(list: T[], from: number, toSlot: number): T[] {
  if (from < 0 || from >= list.length) return list;
  if (toSlot === from || toSlot === from + 1) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  const insert = toSlot > from ? toSlot - 1 : toSlot;
  next.splice(Math.max(0, Math.min(insert, next.length)), 0, item);
  return next;
}

const memoryStorage: Record<string, string> = {};

const durableStorage = createJSONStorage(() => ({
  getItem: (name) => {
    if (typeof window === "undefined") return memoryStorage[name] ?? null;
    return window.localStorage.getItem(name);
  },
  setItem: (name, value) => {
    if (typeof window === "undefined") {
      memoryStorage[name] = value;
      return;
    }
    window.localStorage.setItem(name, value);
  },
  removeItem: (name) => {
    if (typeof window === "undefined") {
      delete memoryStorage[name];
      return;
    }
    window.localStorage.removeItem(name);
  },
}));

function patchPage(state: NotesState, pageId: string, fn: (page: PageDoc) => PageDoc) {
  const page = state.pages[pageId];
  if (!page) return {};
  return { pages: { ...state.pages, [pageId]: fn(page) } };
}

function findPageHome(groups: Group[], pageId: string) {
  for (const group of groups) {
    const index = group.pages.findIndex((page) => page.id === pageId);
    if (index >= 0) return { group, index };
  }
  return null;
}

function snapshot(state: NotesState): Snap {
  return {
    groups: structuredClone(state.groups),
    pages: structuredClone(state.pages),
    activeId: state.activeId,
    trash: structuredClone(state.trash),
    view: state.view,
  };
}

let coalescing = false;
let coalesceTimer: ReturnType<typeof setTimeout> | null = null;

function applyHistory(
  get: () => NotesState,
  set: (partial: Partial<NotesState>) => void,
  patch: Partial<NotesState>,
  coalesce = false,
) {
  const state = get();
  if (coalesce) {
    if (!coalescing) {
      coalescing = true;
      set({
        past: [...state.past.slice(-39), snapshot(state)],
        future: [],
        ...patch,
      });
    } else {
      set(patch);
    }
    if (coalesceTimer) clearTimeout(coalesceTimer);
    coalesceTimer = setTimeout(() => {
      coalescing = false;
    }, 450);
    return;
  }
  coalescing = false;
  if (coalesceTimer) clearTimeout(coalesceTimer);
  set({
    past: [...state.past.slice(-39), snapshot(state)],
    future: [],
    ...patch,
  });
}

export const useNotes = create<NotesState>()(
  persist(
    (set, get) => ({
      ...cloneSeed(),
      activeId: DEFAULT_PAGE_ID,
      view: "notes",
      theme: "light",
      sidebarOpen: false,
      navOpen: true,
      navWidth: 240,
      trash: [],
      lastTrashId: null,
      past: [],
      future: [],
      copiedSection: null,
      setActive: (id) => set({ activeId: id, view: "notes", sidebarOpen: false }),
      openTrash: () => set({ view: "trash", sidebarOpen: false }),
      setTheme: (theme) => set({ theme }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setNavOpen: (navOpen) => set({ navOpen }),
      setNavWidth: (navWidth) => set({ navWidth: Math.min(480, Math.max(180, Math.round(navWidth))) }),
      toggleGroup: (id) =>
        set({
          groups: get().groups.map((g) => (g.id === id ? { ...g, open: !g.open } : g)),
        }),
      toggleSection: (pageId, sectionId) =>
        set(
          patchPage(get(), pageId, (page) => ({
            ...page,
            sections: page.sections.map((s) => (s.id === sectionId ? { ...s, open: !s.open } : s)),
          })),
        ),
      renameGroup: (id, title) => {
        applyHistory(get, set, {
          groups: get().groups.map((g) => (g.id === id ? { ...g, title } : g)),
        }, true);
      },
      renamePage: (id, title) => {
        const state = get();
        const page = state.pages[id];
        if (!page) return;
        applyHistory(
          get,
          set,
          {
            pages: { ...state.pages, [id]: { ...page, title } },
            groups: state.groups.map((g) => ({
              ...g,
              pages: g.pages.map((p) => (p.id === id ? { ...p, title } : p)),
            })),
          },
          true,
        );
      },
      renameSection: (pageId, sectionId, title) => {
        applyHistory(
          get,
          set,
          patchPage(get(), pageId, (page) => ({
            ...page,
            sections: page.sections.map((s) => (s.id === sectionId ? { ...s, title } : s)),
          })),
          true,
        );
      },
      updateBlock: (pageId, sectionId, block) =>
        applyHistory(
          get,
          set,
          patchPage(get(), pageId, (page) => ({
            ...page,
            sections: page.sections.map((s) =>
              s.id === sectionId
                ? { ...s, blocks: s.blocks.map((b) => (b.id === block.id ? block : b)) }
                : s,
            ),
          })),
          true,
        ),
      addBlock: (pageId, sectionId, block) =>
        applyHistory(
          get,
          set,
          patchPage(get(), pageId, (page) => ({
            ...page,
            sections: page.sections.map((s) =>
              s.id === sectionId ? { ...s, blocks: [...s.blocks, block] } : s,
            ),
          })),
        ),
      removeBlock: (pageId, sectionId, blockId) => {
        applyHistory(
          get,
          set,
          patchPage(get(), pageId, (page) => ({
            ...page,
            sections: page.sections.map((s) =>
              s.id === sectionId ? { ...s, blocks: s.blocks.filter((b) => b.id !== blockId) } : s,
            ),
          })),
        );
      },
      applyLineDeletes: (pageId, targets) => {
        if (!targets.length) return;
        applyHistory(
          get,
          set,
          patchPage(get(), pageId, (page) => {
            const grouped = new Map<string, LineTarget[]>();
            for (const target of targets) {
              const list = grouped.get(target.sectionId) ?? [];
              list.push(target);
              grouped.set(target.sectionId, list);
            }
            return {
              ...page,
              sections: page.sections.map((section) => {
                const hits = grouped.get(section.id);
                if (!hits) return section;
                const dropBlocks = new Set(
                  hits.filter((item) => item.kind === "block").map((item) => item.blockId),
                );
                const dropList = new Map<string, Set<string>>();
                const dropKv = new Map<string, Set<number>>();
                const dropTable = new Map<string, Set<number>>();
                for (const hit of hits) {
                  if (hit.kind === "list-item") {
                    const set = dropList.get(hit.blockId) ?? new Set();
                    set.add(hit.itemId);
                    dropList.set(hit.blockId, set);
                  }
                  if (hit.kind === "kv-row") {
                    const set = dropKv.get(hit.blockId) ?? new Set();
                    set.add(hit.index);
                    dropKv.set(hit.blockId, set);
                  }
                  if (hit.kind === "table-row") {
                    const set = dropTable.get(hit.blockId) ?? new Set();
                    set.add(hit.index);
                    dropTable.set(hit.blockId, set);
                  }
                }
                const nextBlocks: Block[] = [];
                for (const block of section.blocks) {
                  if (dropBlocks.has(block.id)) continue;
                  if (block.type === "ul") {
                    const remove = dropList.get(block.id);
                    if (remove) {
                      const items = normalizeListItems(block.items).filter((item) => !remove.has(item.id));
                      if (!items.length) continue;
                      nextBlocks.push({ ...block, items });
                      continue;
                    }
                  }
                  if (block.type === "kv") {
                    const remove = dropKv.get(block.id);
                    if (remove) {
                      const rows = block.rows.filter((_, index) => !remove.has(index));
                      if (!rows.length) continue;
                      nextBlocks.push({ ...block, rows });
                      continue;
                    }
                  }
                  if (block.type === "table") {
                    const remove = dropTable.get(block.id);
                    if (remove) {
                      const rows = block.rows.filter((_, index) => !remove.has(index));
                      if (!rows.length) continue;
                      nextBlocks.push({ ...block, rows });
                      continue;
                    }
                  }
                  nextBlocks.push(block);
                }
                return {
                  ...section,
                  blocks: nextBlocks.length
                    ? nextBlocks
                    : [{ id: newId("p"), type: "p", text: "" }],
                };
              }),
            };
          }),
        );
      },
      applyLineFormat: (pageId, targets, fmt) => {
        if (!targets.length) return;
        applyHistory(
          get,
          set,
          patchPage(get(), pageId, (page) => {
            const grouped = new Map<string, LineTarget[]>();
            for (const target of targets) {
              const list = grouped.get(target.sectionId) ?? [];
              list.push(target);
              grouped.set(target.sectionId, list);
            }
            return {
              ...page,
              sections: page.sections.map((section) => {
                const hits = grouped.get(section.id);
                if (!hits) return section;
                const whole = new Set(hits.filter((item) => item.kind === "block").map((item) => item.blockId));
                const listHits = new Map<string, Set<string>>();
                const kvHits = new Map<string, Set<number>>();
                const tableHits = new Map<string, Set<number>>();
                for (const hit of hits) {
                  if (hit.kind === "list-item") {
                    const set = listHits.get(hit.blockId) ?? new Set();
                    set.add(hit.itemId);
                    listHits.set(hit.blockId, set);
                  }
                  if (hit.kind === "kv-row") {
                    const set = kvHits.get(hit.blockId) ?? new Set();
                    set.add(hit.index);
                    kvHits.set(hit.blockId, set);
                  }
                  if (hit.kind === "table-row") {
                    const set = tableHits.get(hit.blockId) ?? new Set();
                    set.add(hit.index);
                    tableHits.set(hit.blockId, set);
                  }
                }
                return {
                  ...section,
                  blocks: section.blocks.map((block) => {
                    if (
                      whole.has(block.id) &&
                      (block.type === "p" || block.type === "h" || block.type === "note")
                    ) {
                      return { ...block, text: applyHtmlFormat(block.text, fmt) };
                    }
                    if (whole.has(block.id) && block.type === "image") {
                      return { ...block, caption: applyHtmlFormat(block.caption, fmt) };
                    }
                    if (block.type === "ul") {
                      const ids = listHits.get(block.id);
                      if (!ids) return block;
                      return {
                        ...block,
                        items: normalizeListItems(block.items).map((item) =>
                          ids.has(item.id) ? { ...item, text: applyHtmlFormat(item.text, fmt) } : item,
                        ),
                      };
                    }
                    if (block.type === "kv") {
                      const rows = kvHits.get(block.id);
                      if (!rows) return block;
                      return {
                        ...block,
                        rows: block.rows.map((row, index) =>
                          rows.has(index) ? { ...row, v: applyHtmlFormat(row.v, fmt) } : row,
                        ),
                      };
                    }
                    if (block.type === "table") {
                      const rows = tableHits.get(block.id);
                      if (!rows) return block;
                      return {
                        ...block,
                        rows: block.rows.map((row, index) =>
                          rows.has(index) ? row.map((cell) => applyHtmlFormat(cell, fmt)) : row,
                        ),
                      };
                    }
                    return block;
                  }),
                };
              }),
            };
          }),
        );
      },
      addSection: (pageId) => {
        const section: Section = {
          id: newId("sec"),
          title: "New section",
          open: true,
          blocks: [{ id: newId("p"), type: "p", text: "" }],
        };
        applyHistory(
          get,
          set,
          patchPage(get(), pageId, (page) => ({
            ...page,
            sections: [...page.sections, section],
          })),
        );
      },
      removeSection: (pageId, sectionId) => {
        const page = get().pages[pageId];
        if (!page) return;
        const index = page.sections.findIndex((s) => s.id === sectionId);
        if (index < 0) return;
        const section = page.sections[index];
        const item: TrashItem = {
          id: newId("trash"),
          kind: "section",
          title: section.title || "Section",
          deletedAt: Date.now(),
          pageId,
          index,
          section,
        };
        applyHistory(get, set, {
          ...patchPage(get(), pageId, (p) => ({
            ...p,
            sections: p.sections.filter((s) => s.id !== sectionId),
          })),
          trash: [item, ...get().trash],
          lastTrashId: item.id,
        });
      },
      duplicateSection: (pageId, sectionId) => {
        const page = get().pages[pageId];
        if (!page) return;
        const index = page.sections.findIndex((s) => s.id === sectionId);
        if (index < 0) return;
        const copy = cloneSection(page.sections[index]);
        applyHistory(
          get,
          set,
          patchPage(get(), pageId, (p) => ({
            ...p,
            sections: [...p.sections.slice(0, index + 1), copy, ...p.sections.slice(index + 1)],
          })),
        );
      },
      copySection: (pageId, sectionId) => {
        const page = get().pages[pageId];
        const section = page?.sections.find((s) => s.id === sectionId);
        if (!section) return;
        const copy = cloneSection(section);
        set({ copiedSection: copy });
        const plain = sectionPlainText(section);
        void writeClipboard(plain, `<pre>${plain}</pre>`);
      },
      pasteSection: (pageId, afterSectionId) => {
        const copied = get().copiedSection;
        const page = get().pages[pageId];
        if (!copied || !page) return;
        const index = page.sections.findIndex((s) => s.id === afterSectionId);
        const insertAt = index < 0 ? page.sections.length : index + 1;
        const copy = cloneSection(copied);
        applyHistory(
          get,
          set,
          patchPage(get(), pageId, (p) => ({
            ...p,
            sections: [...p.sections.slice(0, insertAt), copy, ...p.sections.slice(insertAt)],
          })),
        );
      },
      addPage: (groupId, title) => {
        const id = newId("page");
        const name = title.trim() || "New page";
        const doc: PageDoc = {
          id,
          title: name,
          sections: [
            {
              id: newId("sec"),
              title: "Notes",
              open: true,
              blocks: [{ id: newId("p"), type: "p", text: "" }],
            },
          ],
        };
        const state = get();
        applyHistory(get, set, {
          pages: { ...state.pages, [id]: doc },
          groups: state.groups.map((g) =>
            g.id === groupId ? { ...g, open: true, pages: [...g.pages, { id, title: name }] } : g,
          ),
          activeId: id,
          view: "notes",
          sidebarOpen: false,
        });
        return id;
      },
      removePage: (pageId) => {
        const state = get();
        const doc = state.pages[pageId];
        const home = findPageHome(state.groups, pageId);
        if (!doc || !home) return;
        const nav = home.group.pages[home.index];
        const pages = { ...state.pages };
        delete pages[pageId];
        const groups = state.groups.map((g) =>
          g.id === home.group.id ? { ...g, pages: g.pages.filter((p) => p.id !== pageId) } : g,
        );
        const fallback = groups.flatMap((g) => g.pages).find((p) => p.id !== pageId)?.id ?? "";
        const item: TrashItem = {
          id: newId("trash"),
          kind: "page",
          title: nav.title || "Page",
          deletedAt: Date.now(),
          groupId: home.group.id,
          index: home.index,
          page: nav,
          doc,
        };
        applyHistory(get, set, {
          pages,
          groups,
          activeId: state.activeId === pageId ? fallback : state.activeId,
          view: state.activeId === pageId ? (fallback ? "notes" : "trash") : state.view,
          trash: [item, ...state.trash],
          lastTrashId: item.id,
        });
      },
      addGroup: (title) => {
        const group: Group = {
          id: newId("g"),
          title: title.trim() || "New category",
          open: true,
          pages: [],
        };
        applyHistory(get, set, { groups: [...get().groups, group] });
      },
      removeGroup: (groupId) => {
        const state = get();
        const index = state.groups.findIndex((g) => g.id === groupId);
        if (index < 0) return;
        const group = state.groups[index];
        const docs: Record<string, PageDoc> = {};
        const pages = { ...state.pages };
        for (const p of group.pages) {
          if (pages[p.id]) {
            docs[p.id] = pages[p.id];
            delete pages[p.id];
          }
        }
        const groups = state.groups.filter((g) => g.id !== groupId);
        const fallback = groups.flatMap((g) => g.pages)[0]?.id ?? "";
        const item: TrashItem = {
          id: newId("trash"),
          kind: "group",
          title: group.title || "Category",
          deletedAt: Date.now(),
          index,
          group,
          docs,
        };
        const lostActive = group.pages.some((p) => p.id === state.activeId);
        applyHistory(get, set, {
          groups,
          pages,
          activeId: lostActive ? fallback : state.activeId,
          view: lostActive ? (fallback ? "notes" : "trash") : state.view,
          trash: [item, ...state.trash],
          lastTrashId: item.id,
        });
      },
      moveGroup: (fromIndex, toSlot) => {
        applyHistory(get, set, { groups: moveInList(get().groups, fromIndex, toSlot) });
      },
      movePage: (pageId, toGroupId, toSlot) => {
        const state = get();
        const home = findPageHome(state.groups, pageId);
        const dest = state.groups.find((g) => g.id === toGroupId);
        if (!home || !dest) return;
        const page = home.group.pages[home.index];
        if (home.group.id === toGroupId) {
          applyHistory(get, set, {
            groups: state.groups.map((g) =>
              g.id === toGroupId ? { ...g, pages: moveInList(g.pages, home.index, toSlot) } : g,
            ),
          });
          return;
        }
        applyHistory(get, set, {
          groups: state.groups.map((g) => {
            if (g.id === home.group.id) {
              return { ...g, pages: g.pages.filter((p) => p.id !== pageId) };
            }
            if (g.id === toGroupId) {
              const pages = [...g.pages];
              const insert = Math.max(0, Math.min(toSlot, pages.length));
              pages.splice(insert, 0, page);
              return { ...g, open: true, pages };
            }
            return g;
          }),
        });
      },
      moveSection: (sectionId, fromPageId, toPageId, toSlot) => {
        const state = get();
        const from = state.pages[fromPageId];
        const to = state.pages[toPageId];
        if (!from || !to) return;
        const fromIndex = from.sections.findIndex((s) => s.id === sectionId);
        if (fromIndex < 0) return;
        const section = from.sections[fromIndex];
        if (fromPageId === toPageId) {
          applyHistory(
            get,
            set,
            patchPage(state, fromPageId, (page) => ({
              ...page,
              sections: moveInList(page.sections, fromIndex, toSlot),
            })),
          );
          return;
        }
        const destSections = [...to.sections];
        const insert = Math.max(0, Math.min(toSlot, destSections.length));
        destSections.splice(insert, 0, { ...section, open: true });
        applyHistory(get, set, {
          pages: {
            ...state.pages,
            [fromPageId]: { ...from, sections: from.sections.filter((s) => s.id !== sectionId) },
            [toPageId]: { ...to, sections: destSections },
          },
          activeId: toPageId,
          view: "notes",
        });
      },
      restoreTrash: (id) => {
        const state = get();
        const item = state.trash.find((t) => t.id === id);
        if (!item) return;
        const trash = state.trash.filter((t) => t.id !== id);
        if (item.kind === "block") {
          const page = state.pages[item.pageId];
          const section = page?.sections.find((s) => s.id === item.sectionId);
          if (!page || !section) return set({ trash, lastTrashId: null });
          const blocks = [...section.blocks];
          const index = Math.min(item.index, blocks.length);
          blocks.splice(index, 0, item.block);
          applyHistory(get, set, {
            ...patchPage(state, item.pageId, (p) => ({
              ...p,
              sections: p.sections.map((s) => (s.id === item.sectionId ? { ...s, blocks } : s)),
            })),
            trash,
            lastTrashId: null,
            activeId: item.pageId,
            view: "notes",
          });
          return;
        }
        if (item.kind === "section") {
          const page = state.pages[item.pageId];
          if (!page) return set({ trash, lastTrashId: null });
          const sections = [...page.sections];
          sections.splice(Math.min(item.index, sections.length), 0, item.section);
          applyHistory(get, set, {
            pages: { ...state.pages, [item.pageId]: { ...page, sections } },
            trash,
            lastTrashId: null,
            activeId: item.pageId,
            view: "notes",
          });
          return;
        }
        if (item.kind === "page") {
          const groupExists = state.groups.some((g) => g.id === item.groupId);
          const targetId = groupExists ? item.groupId : state.groups[0]?.id;
          if (!targetId) return set({ trash, lastTrashId: null });
          applyHistory(get, set, {
            pages: { ...state.pages, [item.doc.id]: item.doc },
            groups: state.groups.map((g) => {
              if (g.id !== targetId) return g;
              const pages = [...g.pages];
              const index = groupExists ? Math.min(item.index, pages.length) : pages.length;
              pages.splice(index, 0, item.page);
              return { ...g, open: true, pages };
            }),
            trash,
            lastTrashId: null,
            activeId: item.doc.id,
            view: "notes",
          });
          return;
        }
        const groups = [...state.groups];
        groups.splice(Math.min(item.index, groups.length), 0, item.group);
        applyHistory(get, set, {
          groups,
          pages: { ...state.pages, ...item.docs },
          trash,
          lastTrashId: null,
          activeId: item.group.pages[0]?.id ?? state.activeId,
          view: item.group.pages[0] ? "notes" : state.view,
        });
      },
      purgeTrash: (id) =>
        applyHistory(get, set, {
          trash: get().trash.filter((t) => t.id !== id),
          lastTrashId: get().lastTrashId === id ? null : get().lastTrashId,
        }),
      emptyTrash: () => applyHistory(get, set, { trash: [], lastTrashId: null }),
      undoTrash: () => {
        const id = get().lastTrashId;
        if (id) get().restoreTrash(id);
      },
      dismissUndo: () => set({ lastTrashId: null }),
      undo: () => {
        const state = get();
        if (!state.past.length) return;
        coalescing = false;
        const prev = state.past[state.past.length - 1];
        set({
          groups: prev.groups,
          pages: prev.pages,
          activeId: prev.activeId,
          trash: prev.trash,
          view: prev.view,
          past: state.past.slice(0, -1),
          future: [...state.future, snapshot(state)],
          lastTrashId: null,
        });
      },
      redo: () => {
        const state = get();
        if (!state.future.length) return;
        coalescing = false;
        const next = state.future[state.future.length - 1];
        set({
          groups: next.groups,
          pages: next.pages,
          activeId: next.activeId,
          trash: next.trash,
          view: next.view,
          past: [...state.past, snapshot(state)],
          future: state.future.slice(0, -1),
          lastTrashId: null,
        });
      },
    }),
    {
      name: "bedside-notes-v2",
      storage: durableStorage,
      skipHydration: true,
      partialize: (s) => ({
        groups: s.groups,
        pages: s.pages,
        activeId: s.activeId,
        theme: s.theme,
        trash: s.trash,
        navOpen: s.navOpen,
        navWidth: s.navWidth,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<NotesState>;
        const theme: Theme = p.theme === "dark" || p.theme === "black" || p.theme === "light" ? p.theme : current.theme;
        return {
          ...current,
          ...p,
          theme,
          navOpen: p.navOpen !== false,
          navWidth: typeof p.navWidth === "number" ? Math.min(480, Math.max(180, p.navWidth)) : current.navWidth,
          pages: p.pages ? migratePages(p.pages) : current.pages,
          past: [],
          future: [],
          copiedSection: null,
          trash: Array.isArray(p.trash) ? p.trash : [],
          view: "notes" as const,
        };
      },
    },
  ),
);
