import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import UniqueID from "@tiptap/extension-unique-id";
import { Transform } from "@tiptap/pm/transform";
import type { Project, RichNode } from "./model";
import type { LayoutPage } from "./layout";

export function manuscriptExtensions() {
  return [
    StarterKit.configure({
      undoRedo: false,
      link: false,
      codeBlock: false,
      code: false,
      strike: false,
    }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    UniqueID.configure({
      types: ["heading", "paragraph"],
      attributeName: "id",
    }),
  ];
}

export function deleteManuscriptPage(project: Project, page: LayoutPage) {
  const chapter = project.chapters.find((c) => c.id === page.chapterId);
  if (!chapter || !page.sourceRange) return;
  const doc = getSchema(manuscriptExtensions()).nodeFromJSON(chapter.document);
  let { from, to } = page.sourceRange;
  if (from === 0 && to === doc.content.size && project.chapters.length > 1) {
    project.chapters = project.chapters.filter((c) => c.id !== chapter.id);
    project.sequence = project.sequence.filter((s) => s.id !== chapter.id);
    return;
  }
  // Removing the final page also removes the explicit break that led into it.
  if (
    to === doc.content.size &&
    from > 0 &&
    doc.nodeAt(from - 1)?.type.name === "horizontalRule"
  )
    from--;
  chapter.document = new Transform(doc)
    .deleteRange(from, to)
    .doc.toJSON() as RichNode;
}
