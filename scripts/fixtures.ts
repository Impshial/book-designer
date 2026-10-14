import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  createProject,
  defaultSetup,
  newObject,
  blankPage,
  serialize,
  uid,
  type RichNode,
} from "../src/core/model";
import { fonts, fontFiles, type FontKey } from "../src/core/fonts";
import { exportPdf } from "../src/core/pdf";
import { layoutProject } from "../src/core/layout";
for (const [key, file] of Object.entries(fontFiles))
  fonts.add(
    key as FontKey,
    new Uint8Array(readFileSync(`public/fonts/${file}`)),
  );
mkdirSync("samples", { recursive: true });
mkdirSync("output/pdf", { recursive: true });
const picture = createProject(
  "picture",
  "Somewhere Wonder Begins",
  "Book Designer",
  defaultSetup("picture"),
  4,
);
const cover = picture.pages[0];
cover.background = "#eef0df";
const title = newObject("text", 58, 58);
Object.assign(title, {
  text: "Somewhere\nwonder begins.",
  fontSize: 40,
  height: 140,
  width: 480,
  fill: "#355844",
  name: "Story title",
});
cover.objects.push(title);
const sun = newObject("ellipse", 400, 210);
Object.assign(sun, {
  width: 94,
  height: 94,
  fill: "#dbb477",
  name: "Afternoon sun",
});
cover.objects.push(sun);
const hill = newObject("ellipse", -100, 350);
Object.assign(hill, {
  width: 800,
  height: 420,
  fill: "#a5b790",
  name: "Distant hillside",
});
cover.objects.push(hill);
const front = newObject("ellipse", 120, 410);
Object.assign(front, {
  width: 700,
  height: 320,
  fill: "#54755b",
  name: "Near hillside",
});
cover.objects.push(front);
const footer = newObject("text", 58, 550);
Object.assign(footer, {
  text: "A SMALL STORY ABOUT BIG POSSIBILITIES",
  font: "sans",
  fontSize: 10,
  height: 25,
  width: 480,
  fill: "#f5f3dc",
  name: "Subtitle",
});
cover.objects.push(footer);
cover.readingOrder = [title.id, footer.id];
const originalId = uid();
picture.assets[originalId] = {
  id: originalId,
  name: "Book Designer mark.png",
  mime: "image/png",
  data: readFileSync("src-tauri/icons/icon.png").toString("base64"),
  width: 256,
  height: 256,
  colorAssumption:
    "Original bytes retained; display assumes sRGB when untagged.",
};
const original = newObject("image", 58, 80);
Object.assign(original, {
  name: "Cropped original artwork",
  assetId: originalId,
  width: 45,
  height: 45,
  crop: { x: 0.12, y: 0.12, width: 0.76, height: 0.76 },
  alt: "An open book on a green square.",
});
picture.pages[1].objects.push(original);
const portableText = newObject("text", 58, 160);
Object.assign(portableText, {
  text: "Made to travel.\n\nThe original image is inside this project. Cropping changes its view, and copying the project preserves every source pixel.",
  fontSize: 19,
  width: 470,
  height: 220,
  name: "Portable artwork note",
});
picture.pages[1].objects.push(portableText);
picture.pages[1].readingOrder = [original.id, portableText.id];
const para =
  "Mira found the little door at the edge of the garden. It was no taller than a teacup, painted the green of new leaves. She crouched beside it and listened. On the other side, someone was humming a song she almost remembered.";
const doc = (count: number): RichNode => ({
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { id: uid(), level: 1 },
      content: [{ type: "text", text: "The little door" }],
    },
    ...Array.from({ length: count }, () => ({
      type: "paragraph",
      attrs: { id: uid() },
      content: [{ type: "text", text: para }],
    })),
  ],
});
const text = createProject(
  "text",
  "The Little Door",
  "Book Designer",
  defaultSetup("text"),
);
text.chapters[0].title = "The little door";
text.chapters[0].document = doc(24);
const hybrid = createProject(
  "hybrid",
  "A Garden Between Chapters",
  "Book Designer",
  defaultSetup("hybrid"),
);
hybrid.chapters[0].document = doc(8);
const interlude = blankPage("A quiet interlude");
interlude.background = "#edf1df";
const quote = newObject("text", 50, 210);
Object.assign(quote, {
  text: "Every garden holds\na door to somewhere.",
  fontSize: 26,
  width: 330,
  height: 180,
  align: "center",
  italic: true,
});
interlude.objects.push(quote);
interlude.readingOrder = [quote.id];
hybrid.pages.push(interlude);
const second = { id: uid(), title: "Beyond the wall", document: doc(8) };
hybrid.chapters.push(second);
hybrid.sequence.push(
  { kind: "design", id: interlude.id },
  { kind: "chapter", id: second.id },
);
for (const [name, p] of [
  ["picture-book", picture],
  ["text-only", text],
  ["hybrid", hybrid],
] as const) {
  writeFileSync(`samples/${name}.bookdesigner`, serialize(p));
  const result = await exportPdf(p);
  writeFileSync(`output/pdf/${name}-proof.pdf`, result.bytes);
  writeFileSync(
    `output/pdf/${name}-proof.report.json`,
    JSON.stringify(result.report, null, 2),
  );
  console.log(
    `${name}: ${result.report.pageCount} pages, ${result.report.fonts.embedded}/${result.report.fonts.references} font references embedded`,
  );
}
const performance = [];
for (const count of [400, 1800]) {
  const p = createProject(
    "text",
    "Performance fixture",
    "",
    defaultSetup("text"),
  );
  p.chapters[0].document = doc(count);
  const start = performanceNow();
  const layout = layoutProject(p);
  performance.push({
    paragraphs: count,
    pages: layout.length,
    layoutMs: Math.round(performanceNow() - start),
  });
}
function performanceNow() {
  return globalThis.performance.now();
}
writeFileSync(
  "output/performance.json",
  JSON.stringify(
    {
      environment: process.platform,
      node: process.version,
      observed: new Date().toISOString(),
      results: performance,
    },
    null,
    2,
  ),
);
console.log(performance);
