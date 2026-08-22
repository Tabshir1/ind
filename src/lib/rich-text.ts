import type { Block, ListItem, PageDoc } from "@/lib/notes-types";

export const TEXT_COLORS: { id: string; label: string; value: string }[] = [
  { id: "red", label: "Red", value: "#dc2626" },
  { id: "blue", label: "Blue", value: "#2563eb" },
  { id: "green", label: "Green", value: "#16a34a" },
  { id: "purple", label: "Purple", value: "#7c3aed" },
  { id: "yellow", label: "Yellow", value: "#ca8a04" },
  { id: "orange", label: "Orange", value: "#ea580c" },
];

export const HIGHLIGHTS: { id: string; label: string; value: string }[] = [
  { id: "yellow", label: "Yellow highlight", value: "#fde68a" },
  { id: "green", label: "Green highlight", value: "#bbf7d0" },
  { id: "blue", label: "Blue highlight", value: "#bfdbfe" },
];

export const FONTS: { id: string; label: string; value: string }[] = [
  { id: "sans", label: "Sans", value: "IBM Plex Sans" },
  { id: "serif", label: "Serif", value: "Source Serif 4" },
  { id: "mono", label: "Mono", value: "IBM Plex Mono" },
  { id: "soft", label: "Soft", value: "Nunito" },
];

export const SIZES: { id: string; label: string; value: string }[] = [
  { id: "s", label: "S", value: "0.8125rem" },
  { id: "m", label: "M", value: "1rem" },
  { id: "l", label: "L", value: "1.25rem" },
  { id: "xl", label: "XL", value: "1.5rem" },
];

const ALLOWED = new Set(["B", "STRONG", "I", "EM", "U", "SPAN", "BR", "FONT", "DIV"]);

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function toHtml(value: string) {
  if (!value) return "";
  if (/<[a-z][\s\S]*>/i.test(value)) return sanitize(value);
  return escapeHtml(value).replace(/\n/g, "<br>");
}

export function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function plainToHtml(text: string) {
  return escapeHtml(text).replace(/\r\n|\n|\r/g, "<br>");
}

export function htmlToPlain(html: string) {
  if (typeof document === "undefined") return stripHtml(html);
  const el = document.createElement("div");
  el.innerHTML = html;
  const text = el.innerText || el.textContent || "";
  return text.replace(/\u00a0/g, " ");
}

export function clipboardToHtml(html: string, plain: string) {
  const text = plain.replace(/^\uFEFF/, "");
  const bulky = /<(?:html|body|meta|o:p|w:|xmlns)/i.test(html);
  if (html && !bulky) {
    const cleaned = sanitize(html);
    if (stripHtml(cleaned)) return cleaned;
  }
  if (text) return plainToHtml(text);
  if (html) {
    const cleaned = sanitize(html);
    if (stripHtml(cleaned)) return cleaned;
  }
  return "";
}

export function insertHtml(el: HTMLElement, html: string) {
  el.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const inside =
    sel.rangeCount > 0 &&
    (el === sel.anchorNode || el.contains(sel.anchorNode));
  if (!inside) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const template = document.createElement("template");
  template.innerHTML = html || "";
  const frag = template.content;
  const last = frag.lastChild;
  range.insertNode(frag);
  const caret = document.createRange();
  if (last) caret.setStartAfter(last);
  else caret.setStart(range.startContainer, range.startOffset);
  caret.collapse(true);
  sel.removeAllRanges();
  sel.addRange(caret);
}

export type LineFormat =
  | { op: "bold" | "italic" | "underline" | "clear" }
  | { op: "color" | "highlight" | "font" | "size"; value: string };

function stripInlineStyle(html: string, prop: string) {
  if (typeof document === "undefined") return html;
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("[style]").forEach((node) => {
    const el = node as HTMLElement;
    el.style.removeProperty(prop);
    if (!el.getAttribute("style")) el.removeAttribute("style");
  });
  return template.innerHTML;
}

export function applyHtmlFormat(html: string, fmt: LineFormat) {
  const inner = html || "";
  if (fmt.op === "clear") return plainToHtml(htmlToPlain(inner));
  if (fmt.op === "bold") return `<b>${inner}</b>`;
  if (fmt.op === "italic") return `<i>${inner}</i>`;
  if (fmt.op === "underline") return `<u>${inner}</u>`;
  if (fmt.op === "color") {
    if (!fmt.value || fmt.value === "inherit") return stripInlineStyle(inner, "color");
    return `<span style="color:${fmt.value}">${inner}</span>`;
  }
  if (fmt.op === "highlight") {
    if (!fmt.value || fmt.value === "transparent") return stripInlineStyle(inner, "background-color");
    return `<span style="background-color:${fmt.value}">${inner}</span>`;
  }
  if (fmt.op === "font") return `<span style="font-family:${fmt.value}">${inner}</span>`;
  if (fmt.op === "size") return `<span style="font-size:${fmt.value}">${inner}</span>`;
  return inner;
}

export async function writeClipboard(plain: string, html?: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) return;
  try {
    if (html && "ClipboardItem" in window && navigator.clipboard.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([plain], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return;
    }
  } catch {
    /* use plain text */
  }
  await navigator.clipboard.writeText(plain);
}

function rgbToHex(input: string) {
  const m = input.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return input.replace(/\s/g, "").toLowerCase();
  const hex = [m[1], m[2], m[3]]
    .map((n) => Number(n).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

function closestColor(input: string, palette: { value: string }[]) {
  const hex = rgbToHex(input);
  const match = palette.find((item) => item.value.toLowerCase() === hex);
  return match?.value ?? "";
}

export function sanitize(html: string) {
  if (typeof document === "undefined") return html;
  const template = document.createElement("template");
  template.innerHTML = html;
  clean(template.content);
  return template.innerHTML;
}

function clean(node: ParentNode) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.parentNode?.removeChild(child);
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as HTMLElement;
    if (el.tagName === "DIV" || el.tagName === "P") {
      const br = document.createElement("br");
      el.after(br);
      while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el);
      el.remove();
      continue;
    }
    if (!ALLOWED.has(el.tagName)) {
      while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el);
      el.remove();
      continue;
    }
    if (el.tagName === "FONT") {
      const span = document.createElement("span");
      const face = el.getAttribute("face");
      const color = el.getAttribute("color");
      const size = el.getAttribute("size");
      if (face) span.style.fontFamily = face;
      if (color) span.style.color = color;
      if (size) {
        const map: Record<string, string> = { "2": "0.8125rem", "3": "1rem", "5": "1.25rem", "6": "1.5rem" };
        if (map[size]) span.style.fontSize = map[size];
      }
      while (el.firstChild) span.appendChild(el.firstChild);
      el.replaceWith(span);
      clean(span);
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      if (attr.name === "style") continue;
      el.removeAttribute(attr.name);
    }
    if (el.hasAttribute("style")) {
      const color = el.style.color;
      const bg = el.style.backgroundColor;
      const family = el.style.fontFamily;
      const size = el.style.fontSize;
      el.removeAttribute("style");
      if (color) {
        const next = closestColor(color, TEXT_COLORS);
        if (next) el.style.color = next;
      }
      if (bg) {
        const next = closestColor(bg, HIGHLIGHTS);
        if (next) el.style.backgroundColor = next;
      }
      if (family) {
        const face = FONTS.find((f) => family.toLowerCase().includes(f.value.toLowerCase().split(" ")[0].toLowerCase()));
        if (face) el.style.fontFamily = face.value;
      }
      if (size && SIZES.some((s) => s.value === size)) el.style.fontSize = size;
    }
    clean(el);
  }
}

export function exec(command: string, value?: string) {
  document.execCommand("styleWithCSS", false, "true");
  document.execCommand(command, false, value);
}

export function normalizeListItems(items: unknown): ListItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    return [{ id: "li-empty", text: "", level: 0 }];
  }
  return items.map((item, index) => {
    if (typeof item === "string") {
      return { id: `li-${index}`, text: item, level: 0 };
    }
    const rec = item as { id?: string; text?: string; level?: number };
    return {
      id: rec.id || `li-${index}`,
      text: rec.text ?? "",
      level: Math.min(2, Math.max(0, Number(rec.level) || 0)),
    };
  });
}

export function migratePages(pages: Record<string, PageDoc>): Record<string, PageDoc> {
  const next: Record<string, PageDoc> = {};
  for (const [id, page] of Object.entries(pages ?? {})) {
    next[id] = {
      ...page,
      sections: (page.sections ?? []).map((section) => ({
        ...section,
        blocks: (section.blocks ?? []).map((block) => migrateBlock(block)),
      })),
    };
  }
  return next;
}

function migrateBlock(block: Block): Block {
  if (block.type === "ul") {
    return { ...block, items: normalizeListItems(block.items) };
  }
  if (block.type === "image") {
    return { ...block, src: block.src ?? "", caption: block.caption ?? "" };
  }
  if (block.type === "flow") {
    return {
      ...block,
      nodes: Array.isArray(block.nodes) ? block.nodes : [],
      edges: Array.isArray(block.edges) ? block.edges : [],
    };
  }
  return block;
}

export function blockSearchText(block: Block): string {
  if (block.type === "p" || block.type === "h" || block.type === "note" || block.type === "formula") {
    return stripHtml(block.text);
  }
  if (block.type === "ul") {
    return normalizeListItems(block.items)
      .map((item) => stripHtml(item.text))
      .join(" ");
  }
  if (block.type === "kv") return block.rows.map((row) => `${row.k} ${stripHtml(row.v)}`).join(" ");
  if (block.type === "image") return block.caption;
  if (block.type === "flow") return block.nodes.map((node) => node.text).join(" ");
  if (block.type === "table") {
    return `${block.headers.join(" ")} ${block.rows.flat().map((cell) => stripHtml(cell)).join(" ")}`;
  }
  return "";
}

export async function compressImage(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1200;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read image");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  let quality = 0.72;
  let data = canvas.toDataURL("image/jpeg", quality);
  while (data.length > 550_000 && quality > 0.4) {
    quality -= 0.1;
    data = canvas.toDataURL("image/jpeg", quality);
  }
  if (data.length > 700_000) {
    throw new Error("Picture is too large. Try a smaller photo.");
  }
  return data;
}

function blobAsFile(blob: Blob, name = "paste") {
  const type = blob.type || "image/jpeg";
  const ext = type.split("/")[1] || "jpg";
  return blob instanceof File ? blob : new File([blob], `${name}.${ext}`, { type });
}

async function urlToImageFile(url: string) {
  if (!url) return null;
  if (!url.startsWith("data:image/") && !url.startsWith("blob:")) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    if (!blob.type.startsWith("image/") && !url.startsWith("data:image/")) return null;
    return blobAsFile(blob);
  } catch {
    return null;
  }
}

export async function imageFromClipboard(data: DataTransfer | null) {
  if (!data) return null;
  const files = Array.from(data.files ?? []);
  const fromFiles = files.find((file) => file.type.startsWith("image/"));
  if (fromFiles) return fromFiles;
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  const html = data.getData("text/html") || "";
  const src = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  if (src) {
    const file = await urlToImageFile(src);
    if (file) return file;
  }
  const plain = data.getData("text/plain") || "";
  if (plain.startsWith("data:image/")) return urlToImageFile(plain);
  return null;
}

export async function imageFromSystemClipboard() {
  if (typeof navigator === "undefined" || !navigator.clipboard?.read) return null;
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((name) => name.startsWith("image/"));
      if (!type) continue;
      return blobAsFile(await item.getType(type));
    }
  } catch {
    return null;
  }
  return null;
}

export async function writeClipboardImage(src: string, plain = "") {
  if (typeof navigator === "undefined" || !navigator.clipboard?.write) {
    if (plain) await writeClipboard(plain);
    return;
  }
  const file = await urlToImageFile(src);
  if (!file) {
    if (plain) await writeClipboard(plain);
    return;
  }
  const png = file.type === "image/png" ? file : await jpegToPng(file);
  const payload: Record<string, Blob | Promise<Blob>> = {
    "image/png": png,
  };
  if (plain) payload["text/plain"] = new Blob([plain], { type: "text/plain" });
  try {
    await navigator.clipboard.write([new ClipboardItem(payload)]);
  } catch {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": Promise.resolve(png) }),
      ]);
    } catch {
      if (plain) await writeClipboard(plain);
    }
  }
}

async function jpegToPng(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return blob;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob((next) => resolve(next), "image/png"));
  return png ?? blob;
}
