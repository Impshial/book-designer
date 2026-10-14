# Architecture

Book Designer is an offline Tauri 2 Windows application. Its React/Vite interface is embedded in the executable for release builds. WebView2 is the Windows rendering runtime; the application does not run a web server or require a subscription. Development uses Vite on loopback only.

## Authoritative source

`src/core/model.ts` defines a Zod-validated version-1 project. Every physical measurement is a point (72 points/inch). Unit changes convert display values, while zoom transforms only the renderer. IDs identify pages, chapters, objects, originals, and structural sequence entries. Manuscript documents are semantic ProseMirror JSON. Automatically generated manuscript pages never enter the saved document.

A `.bookdesigner` file is JSON containing metadata, page setup, typography, chapters, designed pages, sequence, artwork originals, transforms, crop fractions, alt text, reading order, and the generic output edition. PNG/JPEG original bytes are base64, so copying one file preserves artwork. No archive extraction or source-file links are involved. There is a 220 MB package limit and 70 MB per-image import limit in this initial implementation. Originals are immutable; display decoding and crop are nondestructive. Color metadata survives in the original bytes but is not yet parsed or managed.

Future format migrations must preserve the source and explicitly add a migration path. Version 1 rejects unknown versions rather than guessing. Missing image references and duplicate structural IDs are rejected. It does not silently convert between book styles.

## Editing and history

Konva supplies picking, marquee selection, transforms, and a selection overlay. React draws views of model objects, not serialized Konva nodes. Locked objects cannot be dragged, transformed, nudged, or deleted. The layers list is keyboard accessible. Double-click opens a normal text editing dialog with caret and clipboard support; an in-place transform-aligned editor remains future work.

Tiptap's MIT StarterKit supplies structured manuscript editing. Its separate history is disabled, and transactions enter the project history. Consecutive manuscript transactions coalesce within 650 ms; page and object operations remain separate. Immutable original asset strings are shared across up to 80 history entries. Large-document history and incremental pagination still need optimization.

Text Only and Hybrid chapter editing use one contenteditable ProseMirror document laid out directly across page sheets. The canonical layout supplies source positions and line geometry. `pageEditing.ts` applies paragraph positions and generated line-gap decorations; these never enter the document, clipboard serialization, or project file. The same bundled metrics and disabled kerning/ligatures are used for editing, canvas preview and PDF. Chapter navigation, a sticky formatting bar and a single workspace scroll area keep long text accessible. Live picture-book text transforms cancel the parent scale for glyphs and recompute wrapping inside the resized frame; geometry enters history only at drag end.

Hybrid `sequence` entries explicitly alternate chapters and designed pages. An insert stays before its chapter when earlier text grows. Paragraph-anchored artwork and wrap exclusion areas are not implemented and have no enabled controls.

## Canonical layout and export

`layout.ts` consumes the model and metrics from eight bundled Noto Serif/Sans font faces. It emits page records containing line runs, baseline positions, glyph advances, and stable block IDs. Basic heading keep-with-next and two-line paragraph split rules are deterministic. Explicit breaks are separate from generated boundaries. Chapters start on new pages. Complex shaping, hyphenation, arbitrary font resolution, inline artwork, and running headings are not implemented.

Canvas text is drawn from those exact baseline positions and advance widths. PDF uses the same layout snapshot and embeds subsets of the same fonts. Kerning and ligatures are deliberately disabled in this initial pipeline. PNG/JPEG bytes, clipping, scale, object rotation, vector shapes, alpha, backgrounds, and text remain separate output primitives. Guides, selection handles, and overflow badges are not exported. Numbering uses the same point-based placement.

PDF export is a generic RGB **draft reading proof** at trim size. It is not PDF/X, a CMYK proof, tagged PDF, or a verified publisher package. Provisional bleed guides do not create export bleed. An immutable validated snapshot prevents an edit from mixing revisions in one output. The completed PDF is reopened to inspect page boxes, page count and font descriptors; the report includes its project revision and limitations. Poppler and pypdf independently inspect sample outputs during development.

## Native storage boundary

Custom Rust commands own all project file access. Dialog-selected folders and files become session grants; the frontend does not receive a general filesystem permission. New Book creates an unsaved project in memory without filesystem access. The first explicit Save opens the native destination picker. Manual saves and debounced recovery writes share a promise queue, while native commands reject stale saves for a granted path. Background recovery writes touch only the `.recovery` sidecar. Explicit save replaces the project; Discard removes recovery without changing the project. Dirty comparison excludes revision/timestamp metadata so Undo back to the saved content becomes clean. Save cancellation or failure keeps the book open. New/Open/Welcome and native close requests share a Save/Discard/Cancel guard.

New Book has viewport-bounded fixed dimensions and internal settings scrolling. Its focus trap makes surrounding application content inert, and serialized Tauri window calls temporarily disable native resizing and minimize/maximize/close controls, restoring the previous values on dismissal. Native close events are also blocked while a dialog is open.

Saving validates the package header, writes and syncs a complete sibling `.recovery` snapshot, preserves the old valid project in `.bak`, then atomically replaces the destination with a synced tempfile. A successful replacement removes the recovery snapshot. A failed replacement leaves the old project and recovery snapshot intact. A corrupt original does not overwrite a good backup. Rust tests inject failure after writing recovery. These tests cover process interruption semantics, not hardware power loss or network filesystem guarantees.

The JSON schema is checked before use in the frontend; native code independently checks format, version, identity, revision, and package size. CSP permits only bundled scripts/fonts and local image data. No network API is used for editing or export.

## References checked during implementation

- [Tauri architecture](https://v2.tauri.app/start/), [Rust commands](https://v2.tauri.app/develop/calling-rust/), [native dialogs](https://v2.tauri.app/plugin/dialog/)
- [Konva overview](https://konvajs.org/docs/overview.html): chosen for React integration, interaction primitives and separating scene views from persistence.
- [Tiptap React setup](https://tiptap.dev/docs/editor/getting-started/install/react): selected for the ProseMirror document model and MIT extensions. No commercial pagination extension is used.
- [pdf-lib](https://pdf-lib.js.org/): vector/text output, embedded custom fonts and page box APIs. Destination-specific standards require additional inspection and an appropriate output engine.

Dependency versions and license fields were also checked in the installed official packages. No KDP or IngramSpark requirements are claimed or hard-coded in this version.
