import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  createProject,
  defaultSetup,
  toPoints,
  fromPoints,
  parseProject,
  serialize,
  blankPage,
  newObject,
  effectivePpi,
  backgroundPlacement,
  defaultNumberStyle,
  objectName,
  type Asset,
  type RichNode,
} from "../src/core/model";
import { fonts, fontFiles, type FontKey } from "../src/core/fonts";
import {
  layoutProject,
  textBoxLines,
  pageNumberLine,
} from "../src/core/layout";
import { History } from "../src/core/history";
import { preflight } from "../src/core/preflight";
import { exportPdf } from "../src/core/pdf";
import { SaveQueue } from "../src/services/storage";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
beforeAll(() => {
  for (const [key, file] of Object.entries(fontFiles))
    fonts.add(
      key as FontKey,
      new Uint8Array(readFileSync(`public/fonts/${file}`)),
    );
});
const book = () =>
  createProject("text", "A test story", "Test author", defaultSetup("text"));
const manuscript = (text: string): RichNode => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      attrs: { id: "paragraph-1" },
      content: [{ type: "text", text }],
    },
  ],
});
it("maps printed lines back to editable source positions across lists, Unicode and hard breaks", () => {
  const p = book();
  p.setup.width = 200;
  p.chapters[0].document = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "A chapter" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "A 🦊 in the woods. ".repeat(25) },
          { type: "hardBreak" },
          { type: "text", text: "After a line break." },
        ],
      },
      { type: "paragraph" },
      {
        type: "orderedList",
        attrs: { start: 3 },
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "A long numbered item. ".repeat(20) },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  const doc = getSchema([StarterKit]).nodeFromJSON(p.chapters[0].document);
  const pages = layoutProject(p, fonts, 2);
  expect(pages[0].number).toBe(2);
  expect(pages.length).toBeGreaterThan(1);
  for (const pg of pages)
    for (const line of pg.lines) {
      const source = line.source!;
      const original = doc.textBetween(source.from, source.to, "", "\n");
      expect(source.prefix + original).toBe(
        line.runs.map((r) => r.text).join(""),
      );
      expect(doc.nodeAt(source.blockFrom)?.isTextblock).toBe(true);
    }
});
describe("physical geometry and packages", () => {
  it.each(["in", "mm", "cm"] as const)(
    "converts %s without changing the physical page",
    (unit) => {
      expect(toPoints(fromPoints(612, unit), unit)).toBeCloseTo(612, 10);
    },
  );
  it.each(["picture", "text", "hybrid"] as const)(
    "round trips %s including stable IDs and assets",
    (style) => {
      const p = createProject(style, "A book", "", defaultSetup(style), 3);
      expect(parseProject(serialize(p))).toEqual(p);
    },
  );
  it("rejects unknown future formats without mutation", () => {
    const p = book();
    expect(() => parseProject(JSON.stringify({ ...p, version: 2 }))).toThrow(
      "Cannot open",
    );
    expect(p.version).toBe(1);
  });
  it("rejects invalid geometry and missing artwork", () => {
    const p = book();
    p.setup.inside = 1000;
    expect(() => serialize(p)).toThrow();
    const picture = createProject(
      "picture",
      "A book",
      "",
      defaultSetup("picture"),
      1,
    );
    picture.pages[0].objects.push(newObject("image"));
    expect(() => serialize(picture)).toThrow("Missing artwork");
  });
  it("rejects duplicated or unreferenced chapter sequence items", () => {
    const p = book();
    p.sequence.push(p.sequence[0]);
    expect(() => serialize(p)).toThrow();
    p.sequence = [];
    expect(() => serialize(p)).toThrow();
  });
  it("uses crop pixels and placement for effective PPI", () => {
    const o = newObject("image");
    o.width = 144;
    o.height = 144;
    const asset = { width: 1200, height: 1200 } as Asset;
    expect(effectivePpi(o, asset)).toBe(600);
    o.crop.width = 0.5;
    expect(effectivePpi(o, asset)).toBe(300);
    o.width = 288;
    expect(effectivePpi(o, asset)).toBe(150);
  });
});
describe("canonical pagination", () => {
  it("conserves all text exactly once through margin and type changes", () => {
    const p = book();
    const original = Array.from({ length: 600 }, (_, i) => `word${i}`).join(
      " ",
    );
    p.chapters[0].document = manuscript(original);
    for (const size of [12, 18, 22]) {
      p.typography.size = size;
      for (const margin of [36, 72, 108]) {
        p.setup.inside = margin;
        const result = layoutProject(p);
        expect(result.length).toBeGreaterThan(1);
        expect(
          result
            .flatMap((pg) => pg.lines.flatMap((l) => l.runs.map((r) => r.text)))
            .join(""),
        ).toBe(original);
        for (const pg of result)
          expect(pg.lines.every((l) => Number.isFinite(l.y))).toBe(true);
      }
    }
  });
  it("splits a word wider than a page without losing Unicode characters", () => {
    const p = book();
    const text = "é".repeat(350);
    p.chapters[0].document = manuscript(text);
    expect(
      layoutProject(p)
        .flatMap((pg) => pg.lines.flatMap((l) => l.runs.map((r) => r.text)))
        .join(""),
    ).toBe(text);
  });
  it("keeps explicit empty pages from structural breaks", () => {
    const p = book();
    p.chapters[0].document = {
      type: "doc",
      content: [{ type: "horizontalRule" }, { type: "horizontalRule" }],
    };
    expect(layoutProject(p)).toHaveLength(3);
  });
  it("keeps a Hybrid design insert before its chapter when earlier text grows", () => {
    const p = createProject("hybrid", "Hybrid", "", defaultSetup("hybrid"));
    const second = {
      id: "second",
      title: "Second chapter",
      document: manuscript("Second chapter text"),
    };
    const insert = blankPage("Interlude");
    p.chapters.push(second);
    p.pages.push(insert);
    p.sequence.push(
      { kind: "design", id: insert.id },
      { kind: "chapter", id: second.id },
    );
    const before = layoutProject(p).findIndex((x) => x.id === insert.id);
    p.chapters[0].document = manuscript("Earlier text expands. ".repeat(1200));
    const layout = layoutProject(p),
      after = layout.findIndex((x) => x.id === insert.id);
    expect(after).toBeGreaterThan(before);
    expect(layout[after + 1].chapterId).toBe(second.id);
    expect(p.pages[0].id).toBe(insert.id);
  });
  it("reports textbox overflow without discarding the hidden text", () => {
    const p = createProject(
      "picture",
      "Overflow",
      "",
      defaultSetup("picture"),
      1,
    );
    const o = newObject("text");
    o.height = 12;
    o.text = "A lot of words ".repeat(30);
    p.pages[0].objects.push(o);
    expect(textBoxLines(o).length).toBeGreaterThan(1);
    expect(preflight(p).some((i) => i.id === `overflow-${o.id}`)).toBe(true);
    expect(parseProject(serialize(p)).pages[0].objects[0].text).toBe(o.text);
  });
});
describe("history and ordered persistence", () => {
  it("restores page removal and all object references as one operation", () => {
    const p = createProject(
      "picture",
      "History",
      "",
      defaultSetup("picture"),
      2,
    );
    const o = newObject("text");
    p.pages[0].objects.push(o);
    p.pages[0].readingOrder.push(o.id);
    const h = new History(p);
    h.commit((d) => {
      d.pages.splice(0, 1);
    });
    expect(h.current.pages.length).toBe(1);
    const restored = h.undo();
    expect(restored.pages[0]).toEqual(p.pages[0]);
    expect(restored.revision).toBeGreaterThan(p.revision);
    expect(h.redo().pages.length).toBe(1);
  });
  it("serializes saves and continues after a failure", async () => {
    const q = new SaveQueue();
    const order: number[] = [];
    const a = q.run(async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push(1);
      throw new Error("disk full");
    });
    const b = q.run(async () => {
      order.push(2);
      return "saved";
    });
    await expect(a).rejects.toThrow("disk full");
    expect(await b).toBe("saved");
    expect(order).toEqual([1, 2]);
  });
});
describe("completed PDF inspection", () => {
  it("exports the canonical page count, trim dimensions and embedded fonts from a snapshot", async () => {
    const p = book();
    p.chapters[0].document = manuscript(
      "A PDF proof with real text and exact dimensions. ".repeat(90),
    );
    const expected = layoutProject(p).length;
    const result = await exportPdf(p);
    expect(result.bytes.subarray(0, 5)).toEqual(
      new TextEncoder().encode("%PDF-"),
    );
    expect(result.report.pageCount).toBe(expected);
    expect(
      result.report.pageBoxes.every(
        (b) =>
          b.media.width === 432 &&
          b.media.height === 648 &&
          b.trim.width === 432,
      ),
    ).toBe(true);
    expect(result.report.fonts.references).toBeGreaterThan(0);
    expect(result.report.fonts.embedded).toBe(result.report.fonts.references);
    expect(result.report.revision).toBe(0);
    expect(p.revision).toBe(0);
  });
});

it("legacy projects keep number defaults and reject missing background assets", () => {
  const p = createProject("picture", "Legacy", "", defaultSetup("picture"), 1);
  expect(parseProject(serialize(p)).setup.numberStyle).toBeUndefined();
  const line = pageNumberLine(p, 3);
  expect(line.runs[0]).toMatchObject({
    text: "3",
    size: 9,
    font: "sans-regular",
    color: "#59665e",
  });
  p.pages[0].backgroundImage = { assetId: "missing", fit: "cover" };
  expect(() => serialize(p)).toThrow(/Missing background artwork/);
});

it("background placement preserves proportions for fill and fit and travels with the book", () => {
  const p = parseProject(
    readFileSync("samples/picture-book.bookdesigner", "utf8"),
  );
  const asset = Object.values(p.assets)[0];
  // An independent 2:1 source in a square page exercises both directions.
  const wide = { ...asset, width: 1200, height: 600 };
  expect(backgroundPlacement(wide, p.setup, "cover")).toEqual({
    x: -306,
    y: 0,
    width: 1224,
    height: 612,
  });
  expect(backgroundPlacement(wide, p.setup, "contain")).toEqual({
    x: 0,
    y: 153,
    width: 612,
    height: 306,
  });
  p.pages[0].backgroundImage = { assetId: asset.id, fit: "cover" };
  const reopened = parseProject(serialize(p));
  expect(reopened.pages[0].backgroundImage).toEqual(p.pages[0].backgroundImage);
  expect(reopened.assets[asset.id].data).toBe(asset.data);
  expect(
    preflight(reopened).some((i) => i.id === `ppi-background-${p.pages[0].id}`),
  ).toBe(true);
});

it("number formatting uses physical page sides even when the starting number changes", () => {
  const p = createProject("picture", "Numbers", "", defaultSetup("picture"), 2);
  p.setup.numberPosition = "outside";
  p.setup.numberStyle = {
    ...defaultNumberStyle,
    format: "ROMAN",
    start: 8,
    font: "serif",
    size: 18,
    color: "#552244",
    bold: true,
    vertical: "top",
  };
  const first = pageNumberLine(p, 1),
    second = pageNumberLine(p, 2);
  expect(first.runs[0]).toMatchObject({
    text: "VIII",
    font: "serif-bold",
    size: 18,
    color: "#552244",
  });
  expect(second.runs[0].text).toBe("IX");
  expect(first.x).toBe(p.setup.outside);
  expect(second.x + second.width).toBeCloseTo(p.setup.width - p.setup.outside);
  expect(first.y).toBeLessThan(p.setup.top);
  expect(parseProject(serialize(p)).setup.numberStyle).toEqual(
    p.setup.numberStyle,
  );
  p.setup.numberStyle.format = "roman";
  expect(pageNumberLine(p, 2).runs[0].text).toBe("ix");
});

it("text object names are derived from six whitespace-separated words", () => {
  const o = newObject("text");
  o.text = "  One\n two three   four five six seven. ";
  expect(objectName(o)).toBe("One two three four five six…");
  o.text = "One two three four five six";
  expect(objectName(o)).toBe(o.text);
  o.text = "";
  expect(objectName(o)).toBe("Empty text");
});
