import {
  effectivePpi,
  backgroundPlacement,
  isLeftPage,
  objectName,
  type Project,
} from "./model";
import { fonts, fontKey } from "./fonts";
import { layoutProject, textBoxLines } from "./layout";
export type Issue = {
  id: string;
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
  pageId?: string;
  objectId?: string;
};
export function preflight(p: Project): Issue[] {
  const issues: Issue[] = [];
  const pages = layoutProject(p);
  const unsupportedShaping =
    /[\u0300-\u036f\u0590-\u08ff\u0900-\u0fff\u1780-\u17ff\u200c-\u200f\u202a-\u202e\u2066-\u2069]/u;
  const checkShaping = (
    text: string,
    id: string,
    pageId: string,
    objectId?: string,
  ) => {
    if (
      unsupportedShaping.test(text) &&
      !issues.some((i) => i.id === `glyph-layout-${id}`)
    )
      issues.push({
        id: `glyph-layout-${id}`,
        severity: "error",
        title: "Complex text layout needs support",
        detail:
          "This version preserves the text but cannot yet export combining marks or scripts requiring shaping/bidirectional layout reliably.",
        pageId,
        objectId,
      });
  };
  for (const page of pages) {
    const background = page.design?.backgroundImage;
    if (background && p.assets[background.assetId]) {
      const asset = p.assets[background.assetId];
      const box = backgroundPlacement(asset, p.setup, background.fit);
      const ppi =
        Math.min(asset.width / box.width, asset.height / box.height) * 72;
      if (ppi < 300)
        issues.push({
          id: `ppi-background-${page.id}`,
          severity: ppi < 150 ? "error" : "warning",
          title: `${Math.round(ppi)} PPI · Background picture`,
          detail:
            "The background resolution is measured at its displayed size, including cropping. 300 PPI is a general design reference.",
          pageId: page.id,
        });
    }
    for (const o of page.design?.objects ?? []) {
      if (o.hidden) continue;
      const target = { pageId: page.id, objectId: o.id };
      if (o.type === "text") {
        checkShaping(o.text, o.id, page.id, o.id);
        if (
          textBoxLines(o).length * o.fontSize * o.lineHeight >
          o.height + 0.01
        )
          issues.push({
            id: `overflow-${o.id}`,
            severity: "error",
            title: "Text box overflows",
            detail: `“${objectName(o)}” contains text outside its frame. Enlarge it or reduce its type size. The full text is preserved.`,
            ...target,
          });
        const s = p.setup,
          left = isLeftPage(p, page.number) ? s.outside : s.inside + s.gutter,
          right = isLeftPage(p, page.number) ? s.inside + s.gutter : s.outside;
        const angle = (o.rotation * Math.PI) / 180;
        const corners = [
          [0, 0],
          [o.width, 0],
          [0, o.height],
          [o.width, o.height],
        ].map(([x, y]) => ({
          x: o.x + x * Math.cos(angle) - y * Math.sin(angle),
          y: o.y + x * Math.sin(angle) + y * Math.cos(angle),
        }));
        if (
          corners.some(
            (c) =>
              c.x < left ||
              c.y < s.top ||
              c.x > s.width - right ||
              c.y > s.height - s.bottom,
          )
        )
          issues.push({
            id: `safe-${o.id}`,
            severity: "warning",
            title: "Text outside the safe margin",
            detail: `Review “${objectName(o)}” near the trim or gutter.`,
            ...target,
          });
        const missing = fonts.missing(
          o.text,
          fontKey(o.font, o.bold, o.italic),
        );
        if (missing)
          issues.push({
            id: `glyph-${o.id}`,
            severity: "error",
            title: "Unsupported characters",
            detail: `The bundled font has no glyph for: ${[...new Set(missing)].join("")}`,
            ...target,
          });
      }
      if (o.type === "image" && o.assetId) {
        const a = p.assets[o.assetId];
        if (!a) continue;
        const ppi = effectivePpi(o, a);
        if (ppi < 300)
          issues.push({
            id: `ppi-${o.id}`,
            severity: ppi < 150 ? "error" : "warning",
            title: `${Math.round(ppi)} PPI · ${ppi < 150 ? "Too low" : "Review image resolution"}`,
            detail: `“${objectName(o)}” uses cropped source pixels at the placed size. 300 PPI is a general design reference, not a printer approval.`,
            ...target,
          });
        if (!o.alt && !o.decorative)
          issues.push({
            id: `alt-${o.id}`,
            severity: "info",
            title: "Add an image description",
            detail:
              "Alt text helps preserve the meaning of your artwork for accessible editions.",
            ...target,
          });
      }
    }
    for (const line of page.lines)
      for (const r of line.runs) {
        checkShaping(r.text, line.blockId, page.id);
        const missing = fonts.missing(r.text, r.font);
        if (missing && !issues.some((x) => x.id === `glyph-${line.blockId}`))
          issues.push({
            id: `glyph-${line.blockId}`,
            severity: "error",
            title: "Unsupported manuscript characters",
            detail: `The bundled font has no glyph for: ${[...new Set(missing)].join("")}`,
            pageId: page.id,
          });
      }
  }
  if (p.setup.bleed)
    issues.push({
      id: "bleed",
      severity: "warning",
      title: "Provisional bleed guides",
      detail:
        "The generic reading PDF exports at trim size. Bleed export and publisher-specific page boxes are not implemented.",
    });
  issues.push({
    id: "generic",
    severity: "info",
    title: "Generic RGB reading proof",
    detail:
      "This export does not verify PDF/X, CMYK, transparency flattening, printer acceptance, or color soft proofing.",
  });
  return issues;
}
