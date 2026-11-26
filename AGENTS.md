# Agent Instructions — Tawreeda Demo

1. **Read Project Context First:** At the start of every new conversation—before answering any question about the project or editing any file—read `PROJECT_CONTEXT.md` in the repository root. Use its file map to go straight to the relevant module instead of scanning the whole codebase.
2. **Keep `PROJECT_CONTEXT.md` Up to Date:** Whenever you add, remove, rename, or modify files, exports, dependencies, data shapes, `localStorage` keys, URL params, or UI/event patterns, update `PROJECT_CONTEXT.md` in the same task before finishing.
3. **Preserve Core Project Constraints:**
   - Pure static files for GitHub Pages (zero build step, zero `npm`/library/binary installs).
   - Native ES Modules with relative paths and explicit `.js` extensions (`./...`).
   - No circular imports: trigger re-renders via `requestRender()` from `./state.js`, never by importing `js/app.js`.
