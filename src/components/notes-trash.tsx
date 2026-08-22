import { RotateCcw, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { TrashItem } from "@/lib/notes-types";
import { useNotes } from "@/store/notes";

function kindLabel(kind: TrashItem["kind"]) {
  if (kind === "group") return "Category";
  if (kind === "page") return "Page";
  if (kind === "section") return "Section";
  return "Block";
}

function timeLabel(stamp: number) {
  const delta = Date.now() - stamp;
  if (delta < 60_000) return "Just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} min ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} h ago`;
  return new Date(stamp).toLocaleDateString();
}

export function NotesTrash() {
  const trash = useNotes((s) => s.trash);
  const restoreTrash = useNotes((s) => s.restoreTrash);
  const purgeTrash = useNotes((s) => s.purgeTrash);
  const emptyTrash = useNotes((s) => s.emptyTrash);
  const confirm = useConfirm();

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Trash</h1>
          <p className="mt-1 text-sm text-muted">
            Restore a note, or delete it forever. Nothing leaves this device.
          </p>
        </div>
        {trash.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={async () => {
              const ok = await confirm({
                title: "Are you sure you want to delete?",
                body: "Everything in Trash will be permanently deleted. This cannot be undone.",
                confirmLabel: "Empty trash",
                danger: true,
              });
              if (ok) emptyTrash();
            }}
          >
            Empty
          </Button>
        ) : null}
      </div>

      {trash.length === 0 ? (
        <p className="mt-10 text-sm text-muted">Trash is empty.</p>
      ) : (
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {trash.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted">
                  {kindLabel(item.kind)} · {timeLabel(item.deletedAt)}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => restoreTrash(item.id)}>
                <RotateCcw className="size-3.5" />
                Restore
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${item.title} forever`}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Are you sure you want to delete?",
                    body: "This will permanently delete the item. It cannot be restored.",
                    confirmLabel: "Delete forever",
                    danger: true,
                  });
                  if (ok) purgeTrash(item.id);
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
