import { z } from "zod";

export const uid = () => crypto.randomUUID();
export const Units = z.enum(["in", "mm", "cm"]);
export type Unit = z.infer<typeof Units>;
export type BookStyle = "picture" | "text" | "hybrid";
export const unitsPerInch = { in: 1, mm: 25.4, cm: 2.54 };
export const toPoints = (n: number, unit: Unit) =>
  (n * 72) / unitsPerInch[unit];
export const fromPoints = (n: number, unit: Unit) =>
  (n / 72) * unitsPerInch[unit];
const finite = z.number().finite();
const positive = finite.positive();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const SetupSchema = z
  .object({
    width: positive.max(14400),
    height: positive.max(14400),
    unit: Units,
    top: finite.min(0),
    bottom: finite.min(0),
    inside: finite.min(0),
    outside: finite.min(0),
    gutter: finite.min(0),
    bleed: finite.min(0).max(72),
    numbering: z.boolean(),
    numberPosition: z.enum(["center", "outside"]),
    facing: z.boolean(),
  })
  .refine(
    (s) =>
      s.width - s.inside - s.outside - s.gutter >= 36 &&
      s.height - s.top - s.bottom >= 48,
    "Margins must leave at least 0.5 × 0.67 inches for content.",
  );
export type PageSetup = z.infer<typeof SetupSchema>;
export const FontSchema = z.enum(["serif", "sans"]);
export type FontFamily = z.infer<typeof FontSchema>;
export const ObjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.enum(["text", "image", "rect", "ellipse", "line"]),
    x: finite,
    y: finite,
    width: positive,
    height: positive,
    rotation: finite,
    opacity: finite.min(0).max(1),
    fill: color,
    stroke: color,
    strokeWidth: finite.min(0),
    locked: z.boolean(),
    hidden: z.boolean(),
    group: z.string().optional(),
    text: z.string(),
    font: FontSchema,
    fontSize: positive.max(500),
    bold: z.boolean(),
    italic: z.boolean(),
    align: z.enum(["left", "center", "right"]),
    lineHeight: positive.max(4),
    assetId: z.string().optional(),
    crop: z.object({
      x: finite.min(0).max(1),
      y: finite.min(0).max(1),
      width: positive.max(1),
      height: positive.max(1),
    }),
    alt: z.string(),
    decorative: z.boolean(),
    keepRatio: z.boolean(),
  })
  .refine(
    (o) =>
      o.crop.x + o.crop.width <= 1.000001 &&
      o.crop.y + o.crop.height <= 1.000001,
    "Crop exceeds image bounds.",
  );
export type BookObject = z.infer<typeof ObjectSchema>;
export const PageSchema = z.object({
  id: z.string(),
  name: z.string(),
  background: color,
  objects: z.array(ObjectSchema),
  readingOrder: z.array(z.string()),
});
export type DesignPage = z.infer<typeof PageSchema>;
export type RichNode = {
  type: string;
  attrs?: Record<string, unknown>;
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichNode[];
};
const RichNodeSchema: z.ZodType<RichNode> = z.lazy(() =>
  z.object({
    type: z.enum([
      "doc",
      "paragraph",
      "heading",
      "text",
      "hardBreak",
      "bulletList",
      "orderedList",
      "listItem",
      "blockquote",
      "horizontalRule",
    ]),
    attrs: z.record(z.string(), z.unknown()).optional(),
    text: z.string().optional(),
    marks: z
      .array(
        z.object({
          type: z.enum(["bold", "italic", "underline", "strike", "code"]),
          attrs: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .optional(),
    content: z.array(RichNodeSchema).optional(),
  }),
);
const AssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  mime: z.enum(["image/png", "image/jpeg"]),
  data: z
    .string()
    .max(100_000_000)
    .regex(/^[A-Za-z0-9+/]*={0,2}$/),
  width: positive.max(50000),
  height: positive.max(50000),
  colorAssumption: z.literal(
    "Original bytes retained; display assumes sRGB when untagged.",
  ),
});
export type Asset = z.infer<typeof AssetSchema>;
export const ProjectSchema = z
  .object({
    format: z.literal("book-designer"),
    version: z.literal(1),
    id: z.string(),
    revision: z.number().int().min(0),
    created: z.string(),
    modified: z.string(),
    title: z.string().min(1).max(240),
    author: z.string(),
    language: z.string(),
    description: z.string(),
    style: z.enum(["picture", "text", "hybrid"]),
    setup: SetupSchema,
    pages: z.array(PageSchema).max(5000),
    chapters: z.array(
      z.object({ id: z.string(), title: z.string(), document: RichNodeSchema }),
    ),
    sequence: z.array(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("chapter"), id: z.string() }),
        z.object({ kind: z.literal("design"), id: z.string() }),
      ]),
    ),
    assets: z.record(z.string(), AssetSchema),
    typography: z.object({
      font: FontSchema,
      size: positive.max(96),
      lineHeight: positive.min(1).max(3),
      paragraphSpace: finite.min(0).max(72),
    }),
    editions: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        target: z.literal("generic-pdf"),
        profileVersion: z.literal("generic-rgb-draft-1"),
      }),
    ),
  })
  .superRefine((p, ctx) => {
    const ids = [
      ...p.pages.map((x) => x.id),
      ...p.chapters.map((x) => x.id),
      ...p.pages.flatMap((x) => x.objects.map((o) => o.id)),
    ];
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        message: "Duplicate content identifiers.",
      });
    if (p.style === "picture" && p.pages.length === 0)
      ctx.addIssue({
        code: "custom",
        message: "A picture book needs at least one page.",
      });
    if (p.style !== "picture" && p.chapters.length === 0)
      ctx.addIssue({
        code: "custom",
        message: "A manuscript needs at least one chapter.",
      });
    const seen = new Set<string>();
    for (const s of p.sequence) {
      if (
        seen.has(s.id) ||
        !(s.kind === "chapter" ? p.chapters : p.pages).some(
          (x) => x.id === s.id,
        )
      )
        ctx.addIssue({ code: "custom", message: "Invalid document sequence." });
      seen.add(s.id);
    }
    if (
      p.style !== "picture" &&
      [...p.chapters, ...p.pages].some((x) => !seen.has(x.id))
    )
      ctx.addIssue({
        code: "custom",
        message: "Content missing from document sequence.",
      });
    for (const [id, a] of Object.entries(p.assets))
      if (id !== a.id)
        ctx.addIssue({ code: "custom", message: "Asset key mismatch." });
    for (const page of p.pages)
      for (const o of page.objects)
        if (o.type === "image" && (!o.assetId || !p.assets[o.assetId]))
          ctx.addIssue({
            code: "custom",
            message: `Missing artwork for ${o.name}.`,
          });
  });
export type Project = z.infer<typeof ProjectSchema>;
export const defaultSetup = (style: BookStyle): PageSetup => ({
  width: style === "picture" ? 612 : 432,
  height: style === "picture" ? 612 : 648,
  unit: "in",
  top: 36,
  bottom: 36,
  inside: 36,
  outside: 36,
  gutter: 0,
  bleed: 0,
  numbering: style !== "picture",
  numberPosition: "center",
  facing: false,
});
export const blankPage = (name = "Untitled page"): DesignPage => ({
  id: uid(),
  name,
  background: "#ffffff",
  objects: [],
  readingOrder: [],
});
export const emptyDoc = (): RichNode => ({
  type: "doc",
  content: [{ type: "paragraph", attrs: { id: uid() } }],
});
export function createProject(
  style: BookStyle,
  title: string,
  author: string,
  setup: PageSetup,
  count = 32,
): Project {
  const now = new Date().toISOString();
  const chapter = { id: uid(), title: "Chapter 1", document: emptyDoc() };
  return ProjectSchema.parse({
    format: "book-designer",
    version: 1,
    id: uid(),
    revision: 0,
    created: now,
    modified: now,
    title: title.trim(),
    author,
    language: "en",
    description: "",
    style,
    setup,
    pages:
      style === "picture"
        ? Array.from({ length: count }, (_, i) => blankPage(`Page ${i + 1}`))
        : [],
    chapters: style === "picture" ? [] : [chapter],
    sequence: style === "picture" ? [] : [{ kind: "chapter", id: chapter.id }],
    assets: {},
    typography: { font: "serif", size: 12, lineHeight: 1.5, paragraphSpace: 8 },
    editions: [
      {
        id: uid(),
        name: "Reading proof",
        target: "generic-pdf",
        profileVersion: "generic-rgb-draft-1",
      },
    ],
  });
}
export function newObject(
  type: BookObject["type"],
  x = 54,
  y = 54,
): BookObject {
  return {
    id: uid(),
    name: {
      text: "Text box",
      image: "Illustration",
      rect: "Rectangle",
      ellipse: "Ellipse",
      line: "Line",
    }[type],
    type,
    x,
    y,
    width: type === "text" ? 260 : 160,
    height: type === "text" ? 100 : type === "line" ? 2 : 160,
    rotation: 0,
    opacity: 1,
    fill: type === "text" ? "#263e38" : "#c6d8cc",
    stroke: "#526c61",
    strokeWidth: type === "line" ? 2 : 0,
    locked: false,
    hidden: false,
    text: type === "text" ? "Your story starts here." : "",
    font: "serif",
    fontSize: 22,
    bold: false,
    italic: false,
    align: "left",
    lineHeight: 1.4,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    alt: "",
    decorative: false,
    keepRatio: true,
  };
}
export function parseProject(text: string): Project {
  if (text.length > 220_000_000)
    throw new Error("This project exceeds the current 220 MB package limit.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(
      "This is not a readable Book Designer project. The original file has not been changed.",
    );
  }
  const stack: { node: unknown; depth: number }[] = [{ node: raw, depth: 0 }];
  let visited = 0;
  while (stack.length) {
    const { node, depth } = stack.pop()!;
    if (depth > 100 || ++visited > 500000)
      throw new Error("Project structure exceeds supported complexity.");
    if (node && typeof node === "object")
      for (const value of Object.values(node))
        if (value && typeof value === "object")
          stack.push({ node: value, depth: depth + 1 });
  }
  const result = ProjectSchema.safeParse(raw);
  if (!result.success)
    throw new Error(
      `Cannot open project: ${result.error.issues
        .slice(0, 3)
        .map((x) => x.message)
        .join(" ")}`,
    );
  return result.data;
}
export const serialize = (p: Project) => JSON.stringify(ProjectSchema.parse(p));
export const plainText = (node: RichNode): string =>
  node.text ??
  (node.content ?? [])
    .map(plainText)
    .join(
      ["doc", "bulletList", "orderedList", "listItem"].includes(node.type)
        ? "\n"
        : "",
    );
export const wordCount = (p: Project) =>
  [
    ...p.chapters.map((c) => plainText(c.document)),
    ...p.pages.flatMap((pg) =>
      pg.objects.filter((o) => o.type === "text").map((o) => o.text),
    ),
  ]
    .join(" ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean).length;
export const effectivePpi = (o: BookObject, a: Asset) =>
  Math.min(
    (a.width * o.crop.width) / (o.width / 72),
    (a.height * o.crop.height) / (o.height / 72),
  );
