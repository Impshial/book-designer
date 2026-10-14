import fontkit from "@pdf-lib/fontkit";
import type { FontFamily } from "./model";
export type FontKey =
  `${FontFamily}-${"regular" | "bold" | "italic" | "bolditalic"}`;
export const fontFiles: Record<FontKey, string> = {
  "serif-regular": "NotoSerif-Regular.ttf",
  "serif-bold": "NotoSerif-Bold.ttf",
  "serif-italic": "NotoSerif-Italic.ttf",
  "serif-bolditalic": "NotoSerif-BoldItalic.ttf",
  "sans-regular": "NotoSans-Regular.ttf",
  "sans-bold": "NotoSans-Bold.ttf",
  "sans-italic": "NotoSans-Italic.ttf",
  "sans-bolditalic": "NotoSans-BoldItalic.ttf",
};
export const fontKey = (
  family: FontFamily,
  bold = false,
  italic = false,
): FontKey =>
  `${family}-${bold ? (italic ? "bolditalic" : "bold") : italic ? "italic" : "regular"}`;
export const cssFont = (key: FontKey) =>
  key.startsWith("serif") ? "Book Serif" : "Book Sans";
export class Fonts {
  data = new Map<FontKey, Uint8Array>();
  faces = new Map<FontKey, any>();
  add(key: FontKey, bytes: Uint8Array) {
    this.data.set(key, bytes);
    this.faces.set(key, fontkit.create(bytes));
  }
  private advances = new Map<string, number>();
  measure(text: string, key: FontKey, size: number) {
    const f = this.faces.get(key);
    if (!f) throw new Error("Bundled fonts have not loaded.");
    let width = 0;
    for (const char of text) {
      const k = key + char;
      let advance = this.advances.get(k);
      if (advance === undefined) {
        advance =
          f.glyphForCodePoint(char.codePointAt(0)).advanceWidth / f.unitsPerEm;
        this.advances.set(k, advance);
      }
      width += advance;
    }
    return width * size;
  }
  ascent(key: FontKey, size: number) {
    const f = this.faces.get(key);
    return (f.ascent / f.unitsPerEm) * size;
  }
  missing(text: string, key: FontKey) {
    const f = this.faces.get(key);
    return [...text]
      .filter((c) => c.trim() && !f.hasGlyphForCodePoint(c.codePointAt(0)))
      .join("");
  }
}
export const fonts = new Fonts();
export async function loadFonts() {
  await Promise.all(
    Object.entries(fontFiles).map(async ([key, file]) => {
      const r = await fetch(`/fonts/${file}`);
      if (!r.ok) throw new Error(`Cannot load bundled font ${file}.`);
      const b = new Uint8Array(await r.arrayBuffer());
      fonts.add(key as FontKey, b);
      const bold = key.includes("bold"),
        italic = key.includes("italic");
      const face = new FontFace(cssFont(key as FontKey), b, {
        weight: bold ? "700" : "400",
        style: italic ? "italic" : "normal",
      });
      await face.load();
      document.fonts.add(face);
    }),
  );
}
