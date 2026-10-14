# Verification record

Tested on Windows x64 on 2026-10-14 with Node v24.19.0, Rust 1.99.0 (MSVC), the installed Visual Studio 2022 C++ toolchain, Microsoft Edge, and bundled Noto fonts. The repository began empty.

## Automated checks

- v0.1.5: new checks cover header formatting and initial Hybrid fit at 1684 × 1054 and 960 × 640, menu hover switching, proportional resized thumbnails, collapsed margins/conditional numbering, confirmed designed/manuscript page deletion and undo, library-only artwork import, double-click/context-menu/drag placement, all-page background color/image propagation, undo/redo and Hybrid save/reopen/PDF export. Core checks cover deleting a portion of a flowing paragraph, explicit/empty page breaks, text preservation and undo, and optional chapter-background validation and portability.

- The v0.1.5 Hybrid PDF was independently checked with pypdf: both 432 × 648 pt pages include the requested background color and embedded picture. Poppler rendering of the manuscript page was visually compared with the editor.
- v0.1.4: all suites below rerun. New browser checks cover pane drag/keyboard resizing and remembered widths, Fit Page at 960 × 640 and 2000 × 1400, stable spread pairs with right-page editing, six-word text labels/property order, background fill/fit and undo, formatted page numbers, save/reopen and PDF export. The New Book initial view is checked for zero scroll and no overflow at both 1366 × 768 and 960 × 640.
- The new background/numbering PDF was independently checked with pypdf: two 612 × 396 pt pages, extracted labels VII/VIII and exactly one background image resource on the first page. A Poppler rendering was visually reviewed.
- TypeScript strict checking and Vite production build: passed.
- Core tests: 26 passed, covering all three style round-trips, unit conversion, invalid versions/geometry/references, crop-dependent PPI, exact text conservation across margins/type sizes, long Unicode words, structural breaks, Hybrid insert stability, overflow preservation, history, save serialization/failure recovery, editable source mapping across Unicode/lists/hard breaks, and completed PDF inspection. Added coverage checks legacy numbering defaults, missing background asset rejection, cover/contain geometry, background portability, physical numbering sides independent of starting number, and six-word names.
- Native Rust storage tests: 5 passed. Interrupted writes preserve original and recovery; invalid writes preserve original; creation refuses overwrite; portable copy round-trips; restoring a corrupt original preserves a valid backup.
- Browser workflows in headless Microsoft Edge: 24 passed, at 1366 × 768 plus 1000 × 960 and 1100 × 960 modal checks. Covered responsive New Book preview and unit conversion/cancel; picture-book object edits, save/reopen and downloaded PDF/report; Text-only and Hybrid manuscript reflow/save/reopen; and original PNG preservation through crop, effective-PPI recalculation and reopen. Additional checks cover fixed modal geometry and button order, keyboard focus trapping, long direct-page editing with per-character paper bounds, formatting and print-layout line positions, one-step resize undo and live horizontal/vertical glyph scale, unsaved/dirty Save/Discard/Cancel, cancellation and simulated save failures, concurrent edits during saving, and native close/window-control commands through a mocked Tauri IPC boundary. Preset checks independently compare all 15 options against the supplied workbook, apply every size, verify style defaults and descriptions, convert units, save/reopen physical dimensions, and check custom-only fields, full-width controls and removed content. The revised preset/custom dialog screenshots were visually reviewed. These tests do not prove OS window behavior or native picker interaction.
- Sample exports independently opened with pypdf and all pages rendered with Poppler. Page dimensions: Picture Book 612 × 612 pt; Text-only and Hybrid 432 × 648 pt. Text is extractable; all 24/16 repeated manuscript paragraphs were independently counted. Picture pages, the cropped PNG, the Hybrid interlude and manuscript pages were visually reviewed for margins, baselines, page numbers and clipping. `output/independent-pdf-checks.json` records checks of every page box/font descriptor, embedded image resources, and file hashes. No PDF/X or printer acceptance check was performed.
- Windows debug executable and optimized release executable built. Tauri produced the x64 NSIS installer successfully. Installer installation/uninstallation on a clean machine was not exercised.

## Native application observations

The compiled Tauri app launched on Windows, rendered its welcome screen, and exposed its controls to Windows accessibility. Ctrl+N opened New Book, its title field accepted text, and the native folder-selection dialog opened. Windows screenshot capture failed with `SetIsBorderRequired failed: No such interface supported (0x80004002)`; accessibility inspection remained available. Computer Use was stopped by the user's physical Escape key before a complete native create/save/reopen walkthrough. No further desktop input was issued after that interruption.

Native filesystem behavior is covered by Rust tests. Full native GUI save/open/export, shutdown recovery and offline installation remain acceptance work, and are not inferred from browser tests or a successful build.

## Observed layout performance

The sample generator measured the synchronous layout core, not typing latency or total UI rendering. See `output/performance.json` for the latest environment, timestamp and timings. An observed run laid out 400 paragraphs into 58 pages in 150 ms, and 1,800 paragraphs into 258 pages in 548 ms. These are observations from this machine, not performance guarantees. Glyph caching improved the original implementation; background/incremental layout remains necessary for fluid editing of large manuscripts.

Large-image memory stress, a 72-page illustration-heavy Hybrid fixture, IME composition, 125–200% Windows scaling, crash injection at arbitrary machine shutdown points, and independent ebook readers have not been tested.

## Samples

- `samples/picture-book.bookdesigner`: four independent pages; the first contains vector artwork and editable text, and the second demonstrates a cropped embedded PNG original.
- `samples/text-only.bookdesigner`: a structured chapter flowing across four pages at default settings.
- `samples/hybrid.bookdesigner`: flowing chapters separated by a designed interlude with a stable sequence reference.
- `output/pdf/`: generated PDF proofs and their JSON inspection reports.

## Windows acceptance checklist

1. Run the release executable with Vite stopped and networking unavailable. Create each style using a preset and custom dimensions, then save through the destination picker. Confirm creation never asks for a save location. Cancel New Book and confirm no files are created. Check that its native titlebar controls and window resizing are disabled, and restored on dismissal.
2. Import a PNG/JPEG, crop/rotate it, edit text, reorder layers, save, quit, reopen. Compare every source property and the PDF. Copy the `.bookdesigner` file to another folder and repeat.
3. Check Save/Discard/Cancel on close, New and Open for new and edited books, including cancelling the destination picker. Confirm Discard leaves the last saved file untouched. Use Save As to create a copy. Deny a write using a controlled test directory; confirm “Save failed,” intact original/backup, and the recoverable snapshot.
4. Stop the process during a controlled save, reopen, choose recovery and verify that no source text or image is lost. Declining recovery must leave its files intact.
5. Type/paste several pages of text. Undo/redo without changing the caret unexpectedly; check IME composition and keyboard shortcuts inside numeric and text controls.
6. Insert a Hybrid designed page before chapter two; grow chapter one and verify the interlude remains before chapter two.
7. Check effective PPI and overflow warnings, navigate to each affected object, and correct the condition.
8. Export a proof through the native save dialog. Inspect the saved PDF and sidecar report using an independent viewer.
9. Install and uninstall the NSIS package in a clean Windows VM, with and without WebView2 already installed. Confirm offline authoring after runtime installation and inspect behavior at common display scaling settings.

The CI workflow builds and tests on Windows and uploads artifacts when run; it has not been run on GitHub in this session.
