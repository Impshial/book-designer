import {
  PDFDocument,
  rgb,
  degrees,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
  rectangle,
  clip,
  endPath,
  PDFName,
  PDFDict,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { fonts, type FontKey } from "./fonts";
import {
  layoutProject,
  textBoxLines,
  pageNumberLine,
  type TextLine,
} from "./layout";
import {
  type Project,
  serialize,
  parseProject,
  backgroundPlacement,
} from "./model";
import { preflight } from "./preflight";
const ink = (hex: string) =>
  rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  );
export async function exportPdf(source: Project) {
  const p = parseProject(serialize(source));
  const layout = layoutProject(p);
  const issues = preflight(p);
  if (issues.some((i) => i.id.startsWith("glyph-")))
    throw new Error(
      "Replace unsupported characters before PDF export. See preflight for their locations.",
    );
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(p.title);
  pdf.setAuthor(p.author);
  pdf.setCreator("Book Designer 0.1 · generic RGB proof");
  pdf.setSubject(`Project ${p.id}, revision ${p.revision}`);
  const embedded = new Map();
  for (const [key, data] of fonts.data)
    embedded.set(
      key,
      await pdf.embedFont(data, {
        subset: true,
        features: { kern: false, liga: false },
      }),
    );
  const images = new Map();
  for (const a of Object.values(p.assets))
    images.set(
      a.id,
      a.mime === "image/png"
        ? await pdf.embedPng(a.data)
        : await pdf.embedJpg(a.data),
    );
  for (const item of layout) {
    const page = pdf.addPage([p.setup.width, p.setup.height]);
    page.setTrimBox(0, 0, p.setup.width, p.setup.height);
    page.setCropBox(0, 0, p.setup.width, p.setup.height);
    const text = (lines: TextLine[], localHeight: number, opacity = 1) => {
      for (const line of lines)
        for (const r of line.runs) {
          page.drawText(r.text, {
            x: line.x + r.x,
            y: localHeight - line.y,
            font: embedded.get(r.font),
            size: r.size,
            color: ink(r.color),
            opacity,
          });
          if (r.underline)
            page.drawLine({
              start: { x: line.x + r.x, y: localHeight - line.y - 1.5 },
              end: { x: line.x + r.x + r.width, y: localHeight - line.y - 1.5 },
              thickness: 0.6,
              color: ink(r.color),
              opacity,
            });
        }
    };
    if (item.kind === "flow") text(item.lines, p.setup.height);
    else if (item.design) {
      page.drawRectangle({
        x: 0,
        y: 0,
        width: p.setup.width,
        height: p.setup.height,
        color: ink(item.design.background),
      });
      const background = item.design.backgroundImage;
      if (background) {
        const asset = p.assets[background.assetId];
        const box = backgroundPlacement(asset, p.setup, background.fit);
        page.pushOperators(
          pushGraphicsState(),
          rectangle(0, 0, p.setup.width, p.setup.height),
          clip(),
          endPath(),
        );
        page.drawImage(images.get(asset.id), {
          x: box.x,
          y: p.setup.height - box.y - box.height,
          width: box.width,
          height: box.height,
        });
        page.pushOperators(popGraphicsState());
      }
      for (const o of item.design.objects) {
        if (o.hidden) continue;
        const angle = (-o.rotation * Math.PI) / 180,
          c = Math.cos(angle),
          s = Math.sin(angle);
        page.pushOperators(
          pushGraphicsState(),
          concatTransformationMatrix(c, s, -s, c, o.x, p.setup.height - o.y),
        );
        const opts = {
          color: ink(o.fill),
          borderColor: ink(o.stroke),
          borderWidth: o.strokeWidth,
          opacity: o.opacity,
          borderOpacity: o.opacity,
        };
        if (o.type === "text") {
          page.pushOperators(
            pushGraphicsState(),
            rectangle(0, -o.height, o.width, o.height),
            clip(),
            endPath(),
          );
          text(textBoxLines(o), 0, o.opacity);
          page.pushOperators(popGraphicsState());
        } else if (o.type === "rect")
          page.drawRectangle({
            x: 0,
            y: -o.height,
            width: o.width,
            height: o.height,
            ...opts,
          });
        else if (o.type === "ellipse")
          page.drawEllipse({
            x: o.width / 2,
            y: -o.height / 2,
            xScale: o.width / 2,
            yScale: o.height / 2,
            ...opts,
          });
        else if (o.type === "line")
          page.drawLine({
            start: { x: 0, y: 0 },
            end: { x: o.width, y: -o.height },
            color: ink(o.stroke),
            thickness: o.strokeWidth || 1,
            opacity: o.opacity,
          });
        else if (o.type === "image" && o.assetId) {
          const image = images.get(o.assetId);
          if (image) {
            const w = o.width / o.crop.width,
              h = o.height / o.crop.height;
            page.pushOperators(
              pushGraphicsState(),
              rectangle(0, -o.height, o.width, o.height),
              clip(),
              endPath(),
            );
            page.drawImage(image, {
              x: -o.crop.x * w,
              y: -h + o.crop.y * h,
              width: w,
              height: h,
              opacity: o.opacity,
            });
            page.pushOperators(popGraphicsState());
          }
        }
        page.pushOperators(popGraphicsState());
      }
    }
    if (p.setup.numbering)
      text([pageNumberLine(p, item.number)], p.setup.height);
  }
  const bytes = await pdf.save();
  // Reopen the completed bytes and inspect their page boxes and font descriptors.
  const inspected = await PDFDocument.load(bytes);
  let fontCount = 0,
    embeddedFontCount = 0;
  for (const pg of inspected.getPages()) {
    const f = pg.node.Resources()?.lookup(PDFName.of("Font"), PDFDict);
    if (f)
      for (const [, ref] of f.entries()) {
        const fd = inspected.context.lookup(ref, PDFDict);
        const descendants = fd.lookup(PDFName.of("DescendantFonts"));
        const base =
          descendants && "get" in descendants
            ? inspected.context.lookup((descendants as any).get(0), PDFDict)
            : fd;
        const desc = base.lookup(PDFName.of("FontDescriptor"), PDFDict);
        fontCount++;
        if (
          desc &&
          (desc.has(PDFName.of("FontFile2")) ||
            desc.has(PDFName.of("FontFile3")))
        )
          embeddedFontCount++;
      }
  }
  const report = {
    exported: new Date().toISOString(),
    projectId: p.id,
    revision: p.revision,
    profile: "generic-rgb-draft-1",
    status: "draft",
    pageCount: inspected.getPageCount(),
    pageBoxes: inspected.getPages().map((pg) => ({
      media: pg.getMediaBox(),
      trim: pg.getTrimBox(),
      crop: pg.getCropBox(),
    })),
    fonts: { references: fontCount, embedded: embeddedFontCount },
    issues,
    limitations: [
      "RGB only; no output ICC profile.",
      "No PDF/X or destination validation.",
      "Pages export at trim size; provisional bleed is not exported.",
      "No complex-script shaping, tagged PDF, or transparency flattening.",
    ],
  };
  return { bytes, report, layout };
}
