# Dependencies and redistribution

Direct packages are pinned exactly in `package.json` and `Cargo.toml`; `pnpm-lock.yaml` and `src-tauri/Cargo.lock` retain transitive resolution. Installation used official npm/crates registries. Package APIs were checked against official docs and actual installed declarations, and licenses were read from installed package metadata.

| Component                                               | Version                    | License / use                                                                           |
| ------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| Tauri Rust / JS API / CLI                               | 2.12.4 / 2.12.3 / 2.12.2   | MIT OR Apache-2.0; native shell, IPC and packaging                                      |
| Tauri build / dialog                                    | 2.7.3 / 2.8.3              | MIT OR Apache-2.0; build support and native dialogs                                     |
| React / React DOM                                       | 19.3.0                     | MIT                                                                                     |
| Konva / React Konva                                     | 10.8.0 / 19.3.0            | MIT; canvas interaction and views                                                       |
| Tiptap Core, PM, React, StarterKit, TextAlign, UniqueID | 3.32.0                     | MIT; ProseMirror-based structured writing. No paid extensions.                          |
| pdf-lib / @pdf-lib/fontkit                              | 1.17.1 / 1.1.1             | MIT; real-text/vector PDF and embedded font metrics                                     |
| Zod                                                     | 4.6.7                      | MIT; portable project schema                                                            |
| Lucide React                                            | 1.56.0                     | ISC; interface icons                                                                    |
| Noto Sans / Noto Serif                                  | Bundled static TTFs        | SIL Open Font License 1.1. See `public/fonts/OFL.txt`. Eight regular/bold/italic faces. |
| serde / serde_json / tempfile                           | 1.0.229 / 1.0.154 / 3.27.0 | MIT OR Apache-2.0; serialization and atomic writes                                      |

Noto source: [official notofonts repository](https://github.com/notofonts/noto-fonts). The exact font bytes are committed, so future upstream changes do not change an existing build. Embedded font subsets are permitted by the OFL; retain its license when redistributing the bundled fonts.

Build/test dependencies include TypeScript, Vite, Vitest, Playwright, tsx, Prettier and their dependencies. NSIS is downloaded and hash-checked by Tauri for packaging. The installed application depends on Microsoft's WebView2 Runtime, governed by Microsoft's terms; the installer bootstraps it if needed. It is not a bundled Chromium distribution.

Poppler and Python/pypdf are used only for development artifact inspection and are **not shipped in the application**. No Ghostscript, commercial PDF SDK, proprietary editor extension, printer ICC profile or EPUBCheck is bundled. PDF/X, ICC conversion and EPUB validation require future implementation and distribution review.

The font and JavaScript dependency notices should accompany a distributable release. `scripts/dependency-notices.mjs` generates `public/THIRD-PARTY-NOTICES.txt` from installed package license files and pinned metadata. A full release compliance audit, code signing certificate and publication license for the application source remain product-owner decisions.
