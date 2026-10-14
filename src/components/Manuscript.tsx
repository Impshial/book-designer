import { useEffect, useRef, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import UniqueID from "@tiptap/extension-unique-id";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Scissors,
} from "lucide-react";
import { type Project, type RichNode } from "../core/model";
import { pageNumberLine, type LayoutPage } from "../core/layout";
import { cssFont } from "../core/fonts";
import { pageEditing, PAGE_GAP } from "./pageEditing";
export function Manuscript({
  document,
  onChange,
  title,
  onTitle,
  project,
  chapterId,
  pages,
  selectedPage,
  onPage,
  zoom,
  guides,
  editable,
}: {
  document: RichNode;
  onChange: (doc: RichNode) => void;
  title: string;
  onTitle: (title: string) => void;
  project: Project;
  chapterId: string;
  pages: LayoutPage[];
  selectedPage: string;
  onPage: (index: number) => void;
  zoom: number;
  guides: boolean;
  editable: boolean;
}) {
  const change = useRef(onChange);
  change.current = onChange;
  const context = useRef({ project, chapterId, firstPage: pages[0].number });
  context.current = { project, chapterId, firstPage: pages[0].number };
  const pagination = useMemo(() => pageEditing(() => context.current), []);
  const root = useRef<HTMLElement>(null);
  const caretPage = useRef("");
  const navigate = useRef(onPage);
  navigate.current = onPage;
  const layoutSettings = JSON.stringify([
    project.setup,
    project.typography,
    pages[0].number,
  ]);
  const editor = useEditor({
    extensions: [
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
      pagination.extension,
    ],
    content: document,
    editorProps: {
      attributes: {
        class: "page-editor",
        "aria-label": "Manuscript text",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => change.current(editor.getJSON() as RichNode),
    onSelectionUpdate: ({ editor }) => {
      const pos = editor.state.selection.head;
      const page = [...pagination.pages()]
        .reverse()
        .find((pg) => pg.lines.some((l) => l.source!.from <= pos));
      if (page && caretPage.current !== page.id) {
        caretPage.current = page.id;
        navigate.current(page.number - 1);
      }
    },
  });
  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(document))
      editor.commands.setContent(document, { emitUpdate: false });
  }, [document, editor]);
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable, false);
    editor.view.dispatch(editor.state.tr.setMeta("page-settings", true));
  }, [editor, layoutSettings, editable]);
  useEffect(() => {
    if (caretPage.current === selectedPage) return;
    const target = root.current?.querySelector<HTMLElement>(
      `[data-page-id="${selectedPage}"]`,
    );
    const scroll = root.current?.closest(".canvas-scroll");
    if (target && scroll) {
      const toolbar =
        root.current
          ?.querySelector(".document-controls")
          ?.getBoundingClientRect().height ?? 0;
      scroll.scrollTop +=
        target.getBoundingClientRect().top -
        scroll.getBoundingClientRect().top -
        toolbar -
        15;
    }
  }, [selectedPage]);
  if (!editor) return null;
  return (
    <section
      className="document-editor"
      ref={root}
      style={{ width: Math.max(480, project.setup.width * zoom) }}
    >
      <div className="document-controls">
        <div className="writing-header">
          <input
            aria-label="Chapter title"
            value={title}
            onChange={(e) => onTitle(e.target.value)}
          />
        </div>
        <div className="writing-toolbar">
          <select
            aria-label="Paragraph style"
            value={
              editor.isActive("heading", { level: 1 })
                ? "1"
                : editor.isActive("heading", { level: 2 })
                  ? "2"
                  : "paragraph"
            }
            onChange={(e) => {
              if (e.target.value === "paragraph")
                editor.chain().focus().setParagraph().run();
              else
                editor
                  .chain()
                  .focus()
                  .toggleHeading({ level: Number(e.target.value) as 1 | 2 })
                  .run();
            }}
          >
            <option value="paragraph">Body text</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
          </select>
          {[
            [Bold, () => editor.chain().focus().toggleBold().run(), "Bold"],
            [
              Italic,
              () => editor.chain().focus().toggleItalic().run(),
              "Italic",
            ],
            [
              Underline,
              () => editor.chain().focus().toggleUnderline().run(),
              "Underline",
            ],
            [
              List,
              () => editor.chain().focus().toggleBulletList().run(),
              "Bulleted list",
            ],
            [
              ListOrdered,
              () => editor.chain().focus().toggleOrderedList().run(),
              "Numbered list",
            ],
            [
              AlignLeft,
              () => editor.chain().focus().setTextAlign("left").run(),
              "Align left",
            ],
            [
              AlignCenter,
              () => editor.chain().focus().setTextAlign("center").run(),
              "Align center",
            ],
            [
              AlignRight,
              () => editor.chain().focus().setTextAlign("right").run(),
              "Align right",
            ],
            [
              Scissors,
              () => editor.chain().focus().setHorizontalRule().run(),
              "Insert page break",
            ],
          ].map(([Icon, action, label]) => {
            const I = Icon as typeof Bold;
            return (
              <button
                key={String(label)}
                className="icon"
                title={String(label)}
                aria-label={String(label)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={action as () => void}
              >
                <I size={16} />
              </button>
            );
          })}
        </div>
      </div>
      <div
        className="editable-pages"
        style={{
          width: project.setup.width,
          height: pages.length * (project.setup.height + PAGE_GAP) - PAGE_GAP,
          zoom,
          fontFamily:
            project.typography.font === "serif" ? "Book Serif" : "Book Sans",
          fontSize: project.typography.size,
          lineHeight: project.typography.lineHeight,
        }}
      >
        <div className="page-sheets" aria-hidden="true">
          {pages.map((pg, index) => {
            const number = pageNumberLine(project, pg.number);
            return (
              <div
                key={pg.id}
                data-page-id={pg.id}
                className={`editor-paper ${guides ? "with-guides" : ""}`}
                style={{
                  top: index * (project.setup.height + PAGE_GAP),
                  width: project.setup.width,
                  height: project.setup.height,
                }}
              >
                {guides && (
                  <div
                    className="editor-safe"
                    style={{
                      top: project.setup.top,
                      bottom: project.setup.bottom,
                      left:
                        pg.number % 2
                          ? project.setup.inside + project.setup.gutter
                          : project.setup.outside,
                      width:
                        project.setup.width -
                        project.setup.inside -
                        project.setup.outside -
                        project.setup.gutter,
                    }}
                  />
                )}
                {project.setup.numbering && (
                  <svg
                    className="editor-page-numbers"
                    width={project.setup.width}
                    height={project.setup.height}
                  >
                    <text
                      x={number.x}
                      y={number.y}
                      fontFamily={cssFont(number.runs[0].font)}
                      fontSize={number.runs[0].size}
                      fontWeight={
                        number.runs[0].font.includes("bold") ? 700 : 400
                      }
                      fontStyle={
                        number.runs[0].font.includes("italic")
                          ? "italic"
                          : "normal"
                      }
                      fill={number.runs[0].color}
                    >
                      {number.runs[0].text}
                    </text>
                  </svg>
                )}
              </div>
            );
          })}
        </div>
        <EditorContent editor={editor} />
      </div>
    </section>
  );
}
