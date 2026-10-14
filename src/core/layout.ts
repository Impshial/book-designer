import { fonts, fontKey, type FontKey, type Fonts } from "./fonts";
import {
  defaultNumberStyle,
  isLeftPage,
  type Project,
  type RichNode,
  type BookObject,
  type DesignPage,
} from "./model";
export type Run = {
  text: string;
  font: FontKey;
  size: number;
  color: string;
  underline?: boolean;
};
export type LayoutRun = Run & { x: number; width: number };
export type TextLine = {
  runs: LayoutRun[];
  x: number;
  y: number;
  height: number;
  width: number;
  blockId: string;
  // ProseMirror positions in the chapter; generated list markers are excluded.
  source?: {
    from: number;
    to: number;
    blockFrom: number;
    blockTo: number;
    prefix: string;
  };
};
export type LayoutPage = {
  id: string;
  kind: "design" | "flow";
  design?: DesignPage;
  chapterId?: string;
  chapterTitle?: string;
  lines: TextLine[];
  number: number;
  sourceRange?: { from: number; to: number };
};
export function pageNumberLine(p: Project, number: number): TextLine {
  const style = p.setup.numberStyle ?? defaultNumberStyle;
  const value = number + style.start - 1;
  let text = String(value);
  if (style.format !== "decimal") {
    let remaining = value;
    text = "";
    for (const [amount, symbol] of [
      [1000, "M"],
      [900, "CM"],
      [500, "D"],
      [400, "CD"],
      [100, "C"],
      [90, "XC"],
      [50, "L"],
      [40, "XL"],
      [10, "X"],
      [9, "IX"],
      [5, "V"],
      [4, "IV"],
      [1, "I"],
    ] as const)
      while (remaining >= amount) {
        text += symbol;
        remaining -= amount;
      }
    if (style.format === "roman") text = text.toLowerCase();
  }
  const size = style.size,
    font = fontKey(style.font, style.bold, style.italic),
    width = fonts.measure(text, font, size);
  const onLeft = isLeftPage(p, number);
  const x =
    p.setup.numberPosition === "center"
      ? (p.setup.width - width) / 2
      : onLeft
        ? p.setup.outside
        : p.setup.width - p.setup.outside - width;
  const metrics = {
    ascent: fonts.ascent(font, size),
    descent: fonts.descent(font, size),
  };
  const y =
    style.vertical === "top"
      ? Math.max(
          metrics.ascent,
          p.setup.top / 2 + (metrics.ascent + metrics.descent) / 2,
        )
      : p.setup.height - Math.max(-metrics.descent, p.setup.bottom / 2);
  return {
    x: Math.max(0, Math.min(p.setup.width - width, x)),
    y,
    width,
    height: size * 1.3,
    blockId: `number-${number}`,
    runs: [{ text, font, size, color: style.color, x: 0, width }],
  };
}
export function wrapRuns(
  runs: Run[],
  width: number,
  metrics: Fonts = fonts,
): LayoutRun[][] {
  const lines: LayoutRun[][] = [[]];
  let x = 0;
  const push = (run: Run, text: string) => {
    const w = metrics.measure(text, run.font, run.size);
    const line = lines.at(-1)!;
    const last = line.at(-1);
    if (
      last &&
      last.font === run.font &&
      last.size === run.size &&
      last.color === run.color &&
      last.underline === run.underline
    ) {
      last.text += text;
      last.width += w;
    } else line.push({ ...run, text, x, width: w });
    x += w;
  };
  const newline = () => {
    lines.push([]);
    x = 0;
  };
  for (const r of runs)
    for (const token of r.text.split(/(\n|[^\S\n]+|[^\s]+)/u).filter(Boolean)) {
      if (token === "\n") {
        newline();
        continue;
      }
      const w = metrics.measure(token, r.font, r.size);
      if (x > 0 && x + w > width && token.trim()) newline();
      if (w > width) {
        for (const ch of token) {
          const cw = metrics.measure(ch, r.font, r.size);
          if (x > 0 && x + cw > width) newline();
          push(r, ch);
        }
      } else push(r, token);
    }
  return lines;
}
function inline(
  node: RichNode,
  font: "serif" | "sans",
  size: number,
  bold = false,
): Run[] {
  if (node.type === "hardBreak")
    return [{ text: "\n", font: fontKey(font), size, color: "#26352f" }];
  if (node.text !== undefined)
    return [
      {
        text: node.text,
        font: fontKey(
          font,
          bold || !!node.marks?.some((m) => m.type === "bold"),
          !!node.marks?.some((m) => m.type === "italic"),
        ),
        size,
        color: "#26352f",
        underline: node.marks?.some((m) => m.type === "underline"),
      },
    ];
  return (node.content ?? []).flatMap((n) => inline(n, font, size, bold));
}
type Block = {
  id: string;
  runs: Run[];
  heading: boolean;
  align: string;
  breakBefore: boolean;
  from: number;
  to: number;
  prefix: string;
};
const nodeSize = (n: RichNode): number =>
  n.text !== undefined
    ? n.text.length
    : n.content
      ? 2 + n.content.reduce((sum, child) => sum + nodeSize(child), 0)
      : n.type === "paragraph" || n.type === "heading"
        ? 2
        : 1;
export function blocks(doc: RichNode, p: Project): Block[] {
  let counter = 0;
  const result: Block[] = [];
  function visit(n: RichNode, pos = -1, prefix = "") {
    if (n.type === "paragraph" || n.type === "heading") {
      const heading = n.type === "heading",
        size = heading
          ? p.typography.size *
            ({ 1: 2, 2: 1.5, 3: 1.2 }[Number(n.attrs?.level) as 1 | 2 | 3] ??
              1.2)
          : p.typography.size;
      const runs = inline(n, p.typography.font, size, heading);
      if (prefix)
        runs.unshift({
          text: prefix,
          font: fontKey(p.typography.font),
          size,
          color: "#26352f",
        });
      result.push({
        id: String(n.attrs?.id ?? `block-${counter++}`),
        runs,
        heading,
        align: String(n.attrs?.textAlign ?? "left"),
        breakBefore: false,
        from: pos + 1,
        to: pos + nodeSize(n) - 1,
        prefix,
      });
    } else if (n.type === "horizontalRule")
      result.push({
        id: `break-${counter++}`,
        runs: [],
        heading: false,
        align: "left",
        breakBefore: true,
        from: pos,
        to: pos + 1,
        prefix: "",
      });
    else {
      let childPos = pos + 1;
      (n.content ?? []).forEach((c, i) => {
        visit(
          c,
          childPos,
          n.type === "bulletList"
            ? "• "
            : n.type === "orderedList"
              ? `${Number(n.attrs?.start ?? 1) + i}. `
              : prefix,
        );
        childPos += nodeSize(c);
      });
    }
  }
  visit(doc);
  return result;
}
export function textBoxLines(
  o: BookObject,
  metrics: Fonts = fonts,
): TextLine[] {
  const lines = wrapRuns(
    [
      {
        text: o.text,
        font: fontKey(o.font, o.bold, o.italic),
        size: o.fontSize,
        color: o.fill,
      },
    ],
    o.width,
    metrics,
  );
  const h = o.fontSize * o.lineHeight;
  return lines.map((runs, i) => {
    const width = runs.reduce((s, r) => s + r.width, 0);
    return {
      runs,
      x:
        o.align === "center"
          ? (o.width - width) / 2
          : o.align === "right"
            ? o.width - width
            : 0,
      y: i * h + metrics.ascent(fontKey(o.font, o.bold, o.italic), o.fontSize),
      height: h,
      width,
      blockId: o.id,
    };
  });
}
export function layoutProject(
  p: Project,
  metrics: Fonts = fonts,
  firstPageNumber = 1,
): LayoutPage[] {
  const pages: LayoutPage[] = [];
  const addDesign = (d: DesignPage) =>
    pages.push({
      id: d.id,
      kind: "design",
      design: d,
      lines: [],
      number: pages.length + firstPageNumber,
    });
  if (p.style === "picture") {
    p.pages.forEach(addDesign);
    return pages;
  }
  const s = p.setup;
  const width = s.width - s.inside - s.outside - s.gutter;
  for (const item of p.sequence) {
    if (item.kind === "design") {
      const d = p.pages.find((x) => x.id === item.id);
      if (d) addDesign(d);
      continue;
    }
    const chapter = p.chapters.find((x) => x.id === item.id);
    if (!chapter) continue;
    let page: LayoutPage;
    let y = s.top;
    let pageIndex = 0;
    const nextPage = (from: number) => {
      if (page) page.sourceRange!.to = from;
      page = {
        sourceRange: { from, to: nodeSize(chapter.document) - 2 },
        id: `${chapter.id}:${pageIndex++}`,
        kind: "flow",
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        lines: [],
        number: pages.length + firstPageNumber,
      };
      pages.push(page);
      y = s.top;
    };
    nextPage(0);
    for (const b of blocks(chapter.document, p)) {
      if (b.breakBefore) {
        nextPage(b.to);
        continue;
      }
      const size = b.runs[0]?.size ?? p.typography.size;
      const h = size * p.typography.lineHeight;
      const lines = wrapRuns(b.runs, width, metrics);
      const raw = b.runs.map((r) => r.text).join("");
      let consumed = 0;
      if (
        y > s.top &&
        y +
          h *
            (b.heading
              ? Math.min(lines.length + 2, 4)
              : Math.min(lines.length, 2)) >
          s.height - s.bottom
      )
        nextPage(b.from - 1);
      for (let i = 0; i < lines.length; i++) {
        const from = b.from + Math.max(0, consumed - b.prefix.length);
        if (y + h > s.height - s.bottom && page!.lines.length)
          nextPage(i ? from : b.from - 1);
        // Keep two final paragraph lines together when there is room on a fresh page.
        if (
          i === lines.length - 2 &&
          y > s.top &&
          y + 2 * h > s.height - s.bottom &&
          2 * h <= s.height - s.top - s.bottom
        )
          nextPage(i ? from : b.from - 1);
        const runs = lines[i],
          lineWidth = runs.reduce((a, r) => a + r.width, 0);
        consumed += runs.reduce((sum, r) => sum + r.text.length, 0);
        const to = b.from + Math.max(0, consumed - b.prefix.length);
        if (raw[consumed] === "\n") consumed++;
        const left = page!.number % 2 ? s.inside + s.gutter : s.outside;
        page!.lines.push({
          runs,
          x:
            left +
            (b.align === "center"
              ? (width - lineWidth) / 2
              : b.align === "right"
                ? width - lineWidth
                : 0),
          y:
            y +
            metrics.ascent(runs[0]?.font ?? fontKey(p.typography.font), size),
          height: h,
          width: lineWidth,
          blockId: b.id,
          source: {
            from,
            to,
            blockFrom: b.from - 1,
            blockTo: b.to + 1,
            prefix: i === 0 ? b.prefix : "",
          },
        });
        y += h;
      }
      y += p.typography.paragraphSpace;
    }
  }
  return pages;
}
