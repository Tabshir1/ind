# Bedside — RT notes

Your Respiratory Therapy notes app. Notes stay on this computer (browser storage). Nothing is uploaded.

## What you need

1. **Node.js 20 or newer**  
   Download: https://nodejs.org  
   During install, keep the option that says **Add to PATH**.
2. **VS Code** (optional, but handy)

## Run the app

1. Unzip this folder.
2. Open the `bedside-notes` folder in VS Code (**File → Open Folder**).
3. Open the Terminal in VS Code (**Terminal → New Terminal**).
4. Run:

```bash
npm install
npm run dev
```

5. A browser tab should open at http://localhost:5173  
   If it does not, copy that address into Chrome or Edge.

To stop the app, click the terminal and press `Ctrl+C`.

## Build a production copy

```bash
npm run build
npm run preview
```

`npm run build` creates a `dist` folder you can host anywhere static files work.

## Project layout

- `src/components` — sidebar, editor, flowchart, formatting
- `src/data/seed.ts` — your original RT notes
- `src/store/notes.ts` — save / undo / trash
- `src/styles.css` — light, dark, and black themes
- `index.html` — the page shell

This is a React + TypeScript + Vite + Tailwind app. You do not need to know those to run it.
