export type ListItem = {
  id: string;
  text: string;
  level: number;
};

export type FlowNode = {
  id: string;
  text: string;
  x: number;
  y: number;
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
};

export type Block =
  | { id: string; type: "p"; text: string }
  | { id: string; type: "h"; text: string }
  | { id: string; type: "ul"; items: ListItem[] }
  | { id: string; type: "kv"; rows: { k: string; v: string }[] }
  | { id: string; type: "table"; headers: string[]; rows: string[][] }
  | { id: string; type: "note"; text: string }
  | { id: string; type: "formula"; text: string }
  | { id: string; type: "image"; src: string; caption: string }
  | { id: string; type: "flow"; nodes: FlowNode[]; edges: FlowEdge[] };

export type Section = {
  id: string;
  title: string;
  open: boolean;
  blocks: Block[];
};

export type Page = {
  id: string;
  title: string;
};

export type Group = {
  id: string;
  title: string;
  open: boolean;
  pages: Page[];
};

export type PageDoc = {
  id: string;
  title: string;
  sections: Section[];
};

export type NotesData = {
  groups: Group[];
  pages: Record<string, PageDoc>;
};

export type LineTarget =
  | { kind: "block"; sectionId: string; blockId: string }
  | { kind: "list-item"; sectionId: string; blockId: string; itemId: string }
  | { kind: "kv-row"; sectionId: string; blockId: string; index: number }
  | { kind: "table-row"; sectionId: string; blockId: string; index: number };

export type Theme = "light" | "dark" | "black";


export type TrashItem =
  | {
      id: string;
      kind: "group";
      title: string;
      deletedAt: number;
      index: number;
      group: Group;
      docs: Record<string, PageDoc>;
    }
  | {
      id: string;
      kind: "page";
      title: string;
      deletedAt: number;
      groupId: string;
      index: number;
      page: Page;
      doc: PageDoc;
    }
  | {
      id: string;
      kind: "section";
      title: string;
      deletedAt: number;
      pageId: string;
      index: number;
      section: Section;
    }
  | {
      id: string;
      kind: "block";
      title: string;
      deletedAt: number;
      pageId: string;
      sectionId: string;
      index: number;
      block: Block;
    };
