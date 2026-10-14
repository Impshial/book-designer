import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { layoutProject, type LayoutPage, type TextLine } from "../core/layout";
import { fonts, fontKey } from "../core/fonts";
import type { Project, RichNode } from "../core/model";

export const PAGE_GAP = 32;
export type EditingContext = {
  project: Project;
  chapterId: string;
  firstPage: number;
};

// The editable document stays a single semantic ProseMirror document. Decorations
// only position its paragraphs and soft line breaks on the shared print layout;
// no page fragments, generated markers, or spacers enter saved/copyable content.
export function pageEditing(context: () => EditingContext) {
  let cacheDoc: ProseMirrorNode | undefined;
  let cacheSettings = "";
  let cache: DecorationSet;
  let pages: LayoutPage[] = [];
  function decorate(doc: ProseMirrorNode) {
    const { project: p, chapterId, firstPage } = context();
    const settings = JSON.stringify([p.setup, p.typography, firstPage]);
    if (doc === cacheDoc && settings === cacheSettings) return cache;
    const chapter = p.chapters.find((c) => c.id === chapterId)!;
    pages = layoutProject(
      {
        ...p,
        chapters: [{ ...chapter, document: doc.toJSON() as RichNode }],
        sequence: [{ kind: "chapter", id: chapterId }],
      },
      fonts,
      firstPage,
    );
    const groups = new Map<number, { line: TextLine; page: number }[]>();
    pages.forEach((page, index) =>
      page.lines.forEach((line) => {
        const key = line.source!.blockFrom;
        const group = groups.get(key) ?? [];
        group.push({ line, page: index });
        groups.set(key, group);
      }),
    );
    const decorations: Decoration[] = [];
    const width =
      p.setup.width - p.setup.inside - p.setup.outside - p.setup.gutter;
    for (const [pos, lines] of groups) {
      const first = lines[0].line;
      const size = first.runs[0]?.size ?? p.typography.size;
      const key = first.runs[0]?.font ?? fontKey(p.typography.font);
      const face = fonts.faces.get(key)!;
      const baseline =
        (first.height -
          ((face.ascent - face.descent) / face.unitsPerEm) * size) /
          2 +
        fonts.ascent(key, size);
      const left =
        pages[lines[0].page].number % 2
          ? p.setup.inside + p.setup.gutter
          : p.setup.outside;
      const top =
        lines[0].page * (p.setup.height + PAGE_GAP) + first.y - baseline;
      decorations.push(
        Decoration.node(pos, first.source!.blockTo, {
          class: "page-paragraph",
          style: `top:${top}px;left:${left}px;width:${width}px;font-size:${size}px;line-height:${first.height}px;min-height:${first.height}px;`,
        }),
      );
      lines.forEach(({ line, page }, index) => {
        const source = line.source!;
        const shift =
          (pages[page].number % 2
            ? p.setup.inside + p.setup.gutter
            : p.setup.outside) - left;
        if (source.to > source.from && shift)
          decorations.push(
            Decoration.inline(source.from, source.to, {
              style: `position:relative;left:${shift}px`,
            }),
          );
        if (index) {
          const previous = lines[index - 1];
          const gap =
            page * (p.setup.height + PAGE_GAP) +
            line.y -
            (previous.page * (p.setup.height + PAGE_GAP) + previous.line.y) -
            first.height;
          decorations.push(
            Decoration.widget(
              source.from,
              () => {
                const spacer = document.createElement("span");
                spacer.className = "page-line-break";
                spacer.style.height = `${Math.max(0, gap)}px`;
                spacer.setAttribute("aria-hidden", "true");
                return spacer;
              },
              {
                side: -1,
                key: `line-${pos}-${index}-${gap}`,
                ignoreSelection: true,
              },
            ),
          );
        }
        if (source.prefix)
          decorations.push(
            Decoration.widget(
              source.from,
              () => {
                const marker = document.createElement("span");
                marker.className = "page-list-marker";
                marker.dataset.prefix = source.prefix;
                marker.setAttribute("aria-hidden", "true");
                return marker;
              },
              {
                side: -2,
                key: `marker-${pos}-${source.prefix}`,
                ignoreSelection: true,
              },
            ),
          );
      });
    }
    cacheDoc = doc;
    cacheSettings = settings;
    cache = DecorationSet.create(doc, decorations);
    return cache;
  }
  return {
    pages: () => pages,
    extension: Extension.create({
      name: "pageEditing",
      addProseMirrorPlugins: () => [
        new Plugin({
          props: {
            decorations: (state) => decorate(state.doc),
            handleScrollToSelection(view) {
              const scroll = view.dom.closest(".canvas-scroll");
              if (!scroll) return false;
              const caret = view.coordsAtPos(view.state.selection.head);
              const bounds = scroll.getBoundingClientRect();
              const toolbar =
                scroll
                  .querySelector(".document-controls")
                  ?.getBoundingClientRect().height ?? 0;
              if (caret.bottom > bounds.bottom - 24)
                scroll.scrollTop += caret.bottom - bounds.bottom + 24;
              else if (caret.top < bounds.top + toolbar + 24)
                scroll.scrollTop += caret.top - bounds.top - toolbar - 24;
              return true;
            },
          },
        }),
      ],
    }),
  };
}
