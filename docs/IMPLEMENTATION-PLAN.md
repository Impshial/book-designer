# Book Designer implementation plan

The supplied v0.1 brief is the product direction. This empty repository is being built in coherent, verifiable increments. A browser preview is a development surface; the deliverable is a Windows Tauri application.

1. Establish React/TypeScript/Vite and Tauri 2, reproducible dependencies and Windows build path.
2. Define a versioned, validated, portable model in points; keep originals inside the package. Add scoped native open/create/save/save-as, serialized atomic writes, backup/recovery, and recent projects.
3. Prove deterministic font-metric pagination and vector PDF from the same immutable layout. Test physical dimensions, text conservation, structural inserts, and output inspection early.
4. Build welcome and New Book, with all three book styles, style-filtered size presets, converting units, unsaved creation, reactive page preview and validation.
5. Integrate picture pages, Konva transforms, editable text, images/crop, layers, undo/redo, page management, guides and contextual properties.
6. Integrate structured manuscript writing and pagination, chapter navigation and stable Hybrid designed inserts. Add preflight and a clearly labeled generic PDF workflow.
7. Exercise storage failures, exported artifacts, browser interactions and Windows build/runtime. Supply samples, architecture, setup, license notes and an honest status matrix.
8. Continue the full product roadmap: richer typography and wrapping, semantic DOCX/EPUB, validated destination profiles, covers, edition management and color proofing. Each must be real before enabled in the UI.

## Consequential decisions

- Konva handles selection and transforms; its scene graph is never the project database.
- Tiptap's MIT core/StarterKit uses ProseMirror structured JSON. No commercial pagination or collaboration extensions.
- Embedded Noto fonts provide common metrics in preview and PDF; arbitrary system fonts are deferred until a reproducible font-resolution pipeline exists.
- A `.bookdesigner` file is a versioned JSON package with original image bytes as base64. This avoids archive extraction and path traversal; large-asset memory optimization and a binary package migration are later work.
- Generic PDF is an RGB draft export. No KDP/IngramSpark acceptance, PDF/X, CMYK, or color soft-proof claim is made.
- Native file operations authorize paths through native dialogs, rather than exposing unrestricted frontend filesystem access.
