import type { Block, ListItem, Section } from "@/lib/notes-types";
import { normalizeListItems, stripHtml } from "@/lib/rich-text";

function nid(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function cloneBlock(block: Block): Block {
  const copy = structuredClone(block);
  copy.id = nid(block.type === "table" ? "tbl" : block.type === "image" ? "img" : block.type);
  if (copy.type === "ul") {
    copy.items = normalizeListItems(copy.items).map((item) => ({
      ...item,
      id: nid("li"),
    })) as ListItem[];
  }
  if (copy.type === "flow") {
    const ids = new Map<string, string>();
    copy.nodes = copy.nodes.map((node) => {
      const id = nid("fn");
      ids.set(node.id, id);
      return { ...node, id };
    });
    copy.edges = copy.edges.map((edge) => ({
      ...edge,
      id: nid("fe"),
      from: ids.get(edge.from) ?? edge.from,
      to: ids.get(edge.to) ?? edge.to,
    }));
  }
  return copy;
}

export function cloneSection(section: Section): Section {
  return {
    ...section,
    id: nid("sec"),
    blocks: section.blocks.map(cloneBlock),
  };
}

export function sectionPlainText(section: Section) {
  const lines = [section.title];
  for (const block of section.blocks) {
    if (block.type === "p" || block.type === "h" || block.type === "note" || block.type === "formula") {
      lines.push(stripHtml(block.text));
    } else if (block.type === "ul") {
      for (const item of normalizeListItems(block.items)) {
        const text = stripHtml(item.text);
        if (text) lines.push(`${"  ".repeat(item.level)}• ${text}`);
      }
    } else if (block.type === "kv") {
      for (const row of block.rows) lines.push(`${row.k}: ${stripHtml(row.v)}`);
    } else if (block.type === "table") {
      lines.push(block.headers.join("\t"));
      for (const row of block.rows) lines.push(row.map((cell) => stripHtml(cell)).join("\t"));
    } else if (block.type === "image") {
      if (block.caption) lines.push(stripHtml(block.caption));
    } else if (block.type === "flow") {
      for (const node of block.nodes) {
        if (node.text) lines.push(node.text);
      }
    }
  }
  return lines.filter((line) => line.trim()).join("\n");
}

export function isEmptyText(value: string) {
  return !value
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|\u200b/g, "")
    .trim();
}
