# Book Designer

A standalone Windows book studio built with Tauri 2, React, TypeScript, Konva, and Tiptap. Local files and offline editing are the default. This is an early v0.1 implementation of the supplied product brief, not the completed six-milestone product.

## Run the Windows app

Built outputs from this workspace:

The latest delivery copies are in `output/windows/`: `Book-Designer-0.1.2-x64-Setup.exe`, `Book-Designer.exe`, and `SETUP.txt`.

- `src-tauri/target/release/book-designer.exe` — portable application; requires Microsoft Edge WebView2 Runtime.
- `src-tauri/target/release/bundle/nsis/Book Designer_0.1.2_x64-setup.exe` — Windows x64 installer. The installer can download WebView2 if absent; authoring and installed export work offline afterward.

The executable embeds the interface, fonts, and export engine. Node, Rust, a browser tab, and a running development server are not needed to use the release app. Builds are unsigned during development.

Start with **Create a new book** and choose Picture Book, Hybrid, or Text Only. Choose a size preset for that style or enter custom dimensions. Every new book starts unsaved; use **Save** when ready to choose its destination. Closing or replacing an unsaved or edited book offers **Save**, **Discard**, and **Cancel**. Open the samples under `samples/` for a quick tour.

## Working features

- Fixed-size New Book modal with 15 style-specific size presets, descriptive size labels, custom dimensions, converting units, margins, gutter, page numbering, provisional bleed and a live preview. Focus stays in the dialog; native minimize, maximize, close and resizing are disabled until it closes.
- Picture pages with text, PNG/JPEG originals, rectangles, ellipses, lines, transforms, crops, visibility/locks, stacking, multi-selection, basic groups, center alignment, undo and redo.
- Write directly on automatically paginated pages, with headings, lists, emphasis, alignment, page breaks and chapter navigation. A separate Print preview is available; there is no split writing/output pane. Picture-book text frames reflow without stretching glyphs during resizing.
- Hybrid designed pages inserted before chapters, with stable structural placement during reflow.
- Native save/open/Save As, explicit dirty state, atomic replacement, backup and automatic recovery snapshots for saved books, plus ordered save requests. Recovery never overwrites the last explicit save.
- Generic RGB draft PDF using the same layout as the editor, real text, embedded fonts, vector shapes and image clips. Completed-file inspection produces a sidecar report.

See [feature status](docs/FEATURE-STATUS.md) for exact limits. EPUB, DOCX, paragraph anchors/wrapping, covers, publisher profiles, and color proofing are not yet implemented.

## Development

Install Node.js 24 LTS, pnpm 11.25.0, stable Rust with the MSVC target, Visual Studio C++ Build Tools with the Windows SDK, and WebView2. Official [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/) describe the native toolchain.

```powershell
pnpm install --frozen-lockfile
pnpm desktop
```

The workspace used to create this project has a **project-local** Rust toolchain in `.tools/` (ignored by Git). On this machine, `scripts/dev.ps1` and `scripts/build-windows.ps1` configure it automatically; a normal installed toolchain also works.

```powershell
pnpm dev                 # browser development preview only
pnpm build               # TypeScript and production frontend
pnpm test                # model, layout, history, save queue, PDF tests
cargo test --manifest-path src-tauri/Cargo.toml --lib
pnpm fixtures            # sample projects, PDF proofs, performance observation
pnpm exec playwright test # requires the Vite dev server and Microsoft Edge
pnpm desktop:build       # standalone release and NSIS installer
```

Browser preview saves to that browser's local storage and downloads exported copies. It is explicitly labeled and is not a substitute for native storage testing. Large artwork should be tested in the desktop app.

## Project files and recovery

The single versioned JSON `.bookdesigner` file contains all original image bytes. Keep the `.bak` file for the previous valid saved version. A `.recovery` file holds edits since the last save or an interrupted save; reopening offers the newer snapshot. Discard removes that recovery snapshot and leaves the saved project intact. New books without a location stay in memory until saved. Copying the main project to another location copies its artwork too. Current package size limit: 220 MB; individual imported images: 70 MB.

## Documentation

- [Architecture and export approach](docs/ARCHITECTURE.md)
- [Feature status and remaining milestones](docs/FEATURE-STATUS.md)
- [Verification results and Windows checklist](docs/VERIFICATION.md)
- [Dependency and redistribution notes](docs/DEPENDENCIES.md)
- [Implementation plan](docs/IMPLEMENTATION-PLAN.md)

No printer acceptance or exact print-color simulation is claimed. The available PDF option is a draft reading proof, with limitations visible in the app and in the saved report.
