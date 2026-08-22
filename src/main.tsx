import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { NotesApp } from "@/components/notes-app";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <NotesApp />
  </StrictMode>,
);
