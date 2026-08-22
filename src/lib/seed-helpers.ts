import type { Block, ListItem, Section } from "@/lib/notes-types";

let n = 0;
export const nid = (p = "n") => `${p}-${++n}`;

export const p = (text: string): Block => ({ id: nid("p"), type: "p", text });
export const h = (text: string): Block => ({ id: nid("h"), type: "h", text });
export const ul = (...items: string[]): Block => ({
  id: nid("ul"),
  type: "ul",
  items: items.map((text) => ({ id: nid("li"), text, level: 0 } satisfies ListItem)),
});
export const uln = (...items: [string, number?][]): Block => ({
  id: nid("ul"),
  type: "ul",
  items: items.map(([text, level]) => ({ id: nid("li"), text, level: level ?? 0 } satisfies ListItem)),
});
export const kv = (rows: [string, string][]): Block => ({
  id: nid("kv"),
  type: "kv",
  rows: rows.map(([k, v]) => ({ k, v })),
});
export const table = (headers: string[], rows: string[][]): Block => ({
  id: nid("tbl"),
  type: "table",
  headers,
  rows,
});
export const note = (text: string): Block => ({ id: nid("note"), type: "note", text });
export const formula = (text: string): Block => ({ id: nid("fx"), type: "formula", text });

export const section = (title: string, blocks: Block[], open = true): Section => ({
  id: nid("sec"),
  title,
  open,
  blocks,
});
