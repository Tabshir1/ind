import { ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { AddBlockBar, BlockView } from "@/components/notes-blocks";
import { useConfirm } from "@/components/confirm-dialog";
import { DragHandle, DropLine, useDrag } from "@/components/drag-context";
import { AutoText } from "@/components/field";
import { lineIdBlock, lineIdKv, lineIdList, lineIdTable, LineSelectProvider } from "@/components/line-select";
import { OverflowMenu } from "@/components/overflow-menu";
import { Button } from "@/components/ui/button";
import { normalizeListItems } from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import { useNotes } from "@/store/notes";

export function NotesPage() {
  const activeId = useNotes((s) => s.activeId);
  const page = useNotes((s) => (activeId ? s.pages[activeId] : undefined));
  const renamePage = useNotes((s) => s.renamePage);
  const renameSection = useNotes((s) => s.renameSection);
  const toggleSection = useNotes((s) => s.toggleSection);
  const updateBlock = useNotes((s) => s.updateBlock);
  const addBlock = useNotes((s) => s.addBlock);
  const removeBlock = useNotes((s) => s.removeBlock);
  const addSection = useNotes((s) => s.addSection);
  const removeSection = useNotes((s) => s.removeSection);
  const duplicateSection = useNotes((s) => s.duplicateSection);
  const copySection = useNotes((s) => s.copySection);
  const pasteSection = useNotes((s) => s.pasteSection);
  const copiedSection = useNotes((s) => s.copiedSection);
  const confirm = useConfirm();
  const { drag } = useDrag();
  const [focusBlockId, setFocusBlockId] = useState("");

  const lineOrder = useMemo(() => {
    if (!page) return [];
    const ids: string[] = [];
    for (const section of page.sections) {
      if (!section.open) continue;
      for (const block of section.blocks) {
        if (block.type === "ul") {
          for (const item of normalizeListItems(block.items)) {
            ids.push(lineIdList(section.id, block.id, item.id));
          }
        } else if (block.type === "kv") {
          block.rows.forEach((_, index) => ids.push(lineIdKv(section.id, block.id, index)));
        } else if (block.type === "table") {
          block.rows.forEach((_, index) => ids.push(lineIdTable(section.id, block.id, index)));
        } else {
          ids.push(lineIdBlock(section.id, block.id));
        }
      }
    }
    return ids;
  }, [page]);

  if (!page) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <div>
          <p className="text-lg font-semibold">No page selected</p>
          <p className="mt-1 text-sm text-muted">Add a page from the sidebar, or open Trash.</p>
        </div>
      </div>
    );
  }

  return (
    <LineSelectProvider pageId={page.id} order={lineOrder}>
    <article className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <AutoText
        value={page.title}
        onChange={(title) => renamePage(page.id, title)}
        onBlur={(title) => renamePage(page.id, title.trim() || "Untitled")}
        aria-label="Page title"
        className="text-3xl font-semibold tracking-tight sm:text-4xl"
      />
      <p className="mt-1 text-sm text-muted">
        Click to edit. Drag the left edge to select lines, then format, copy, or Backspace.
      </p>

      <div className="mt-8 space-y-1">
        {page.sections.map((section, index) => {
          const slotBefore =
            drag?.item.kind === "section" &&
            drag.over?.kind === "section-slot" &&
            drag.over.pageId === page.id &&
            drag.over.index === index;
          const dragging = drag?.item.kind === "section" && drag.item.id === section.id;
          return (
            <div
              key={section.id}
              data-drop-kind="section"
              data-id={section.id}
              data-page-id={page.id}
              data-index={index}
            >
              <DropLine show={Boolean(slotBefore)} />
              <section className={cn("border-b border-border py-2", dragging && "opacity-40")}>
                <div className="flex items-start gap-0.5">
                  <DragHandle
                    item={{
                      kind: "section",
                      id: section.id,
                      title: section.title,
                      pageId: page.id,
                      index,
                    }}
                    label={`Move ${section.title}`}
                  />
                  <button
                    type="button"
                    aria-expanded={section.open}
                    aria-label={section.open ? "Collapse section" : "Expand section"}
                    className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-sm text-muted hover:bg-hover hover:text-fg"
                    onClick={() => toggleSection(page.id, section.id)}
                  >
                    <ChevronRight
                      className={cn(
                        "size-4 transition-transform duration-150 ease-out",
                        section.open && "rotate-90",
                      )}
                    />
                  </button>
                  <AutoText
                    value={section.title}
                    onChange={(title) => renameSection(page.id, section.id, title)}
                    onBlur={(title) => renameSection(page.id, section.id, title.trim() || "Untitled")}
                    aria-label="Section title"
                    className="flex-1 py-1.5 text-lg font-semibold tracking-tight"
                  />
                  <OverflowMenu
                    label={`Section options for ${section.title}`}
                    items={[
                      {
                        id: "duplicate",
                        label: "Duplicate",
                        onClick: () => duplicateSection(page.id, section.id),
                      },
                      {
                        id: "copy",
                        label: "Copy",
                        onClick: () => copySection(page.id, section.id),
                      },
                      {
                        id: "paste",
                        label: "Paste below",
                        hidden: !copiedSection,
                        onClick: () => pasteSection(page.id, section.id),
                      },
                      {
                        id: "delete",
                        label: "Delete",
                        danger: true,
                        onClick: async () => {
                          const ok = await confirm({
                            title: "Are you sure you want to delete?",
                            body: `“${section.title}” will go to Trash.`,
                          });
                          if (ok) removeSection(page.id, section.id);
                        },
                      },
                    ]}
                  />
                </div>

                {section.open ? (
                  <div className="space-y-3 pb-3 pl-10 pr-2">
                    {section.blocks.map((block) => (
                      <BlockView
                        key={block.id}
                        sectionId={section.id}
                        block={block}
                        autoFocus={block.id === focusBlockId}
                        onChange={(next) => updateBlock(page.id, section.id, next)}
                        onRemove={() => {
                          if (section.blocks.length <= 1) {
                            updateBlock(page.id, section.id, { id: block.id, type: "p", text: "" });
                            setFocusBlockId(block.id);
                            return;
                          }
                          const index = section.blocks.findIndex((item) => item.id === block.id);
                          const next = section.blocks[index - 1] ?? section.blocks[index + 1];
                          removeBlock(page.id, section.id, block.id);
                          if (next) setFocusBlockId(next.id);
                        }}
                      />
                    ))}
                    <AddBlockBar
                      onAdd={(block) => {
                        addBlock(page.id, section.id, block);
                        setFocusBlockId(block.id);
                      }}
                    />
                  </div>
                ) : (
                  <p className="pb-3 pl-10 text-sm text-subtle">
                    {section.blocks.length} {section.blocks.length === 1 ? "block" : "blocks"}
                  </p>
                )}
              </section>
            </div>
          );
        })}
        <div data-drop-kind="section-end" data-page-id={page.id} data-index={page.sections.length} className="h-3">
          <DropLine
            show={
              drag?.item.kind === "section" &&
              drag.over?.kind === "section-slot" &&
              drag.over.pageId === page.id &&
              drag.over.index === page.sections.length
            }
          />
        </div>
      </div>

      <div className="mt-4 pl-2">
        <Button type="button" variant="ghost" onClick={() => addSection(page.id)}>
          <Plus className="size-4" />
          New section
        </Button>
      </div>
    </article>
    </LineSelectProvider>
  );
}
