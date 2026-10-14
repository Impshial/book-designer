import { fromPoints, toPoints, type BookStyle, type Unit } from "./model";

export type SizePreset = {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  default?: boolean;
};

const inches = (
  id: string,
  name: string,
  width: number,
  height: number,
  description: string,
  recommended = false,
): SizePreset => ({
  id,
  name,
  description,
  width: toPoints(width, "in"),
  height: toPoints(height, "in"),
  default: recommended,
});

// User-supplied book-size-presets.xlsx, "Book sizes"!A7:J21.
// Keep source order and exact inch dimensions. International A5 is a separate
// category in the workbook; New Book intentionally shows only the chosen style.
export const sizePresets: Record<BookStyle, readonly SizePreset[]> = {
  picture: [
    inches("small-square", "Small Square", 8, 8, "Compact illustrated books"),
    inches(
      "standard-square",
      "Standard Square",
      8.5,
      8.5,
      "Recommended size for picture books",
      true,
    ),
    inches(
      "portrait",
      "Portrait",
      8,
      10,
      "Full-page illustrations with room for text",
    ),
    inches(
      "large-portrait",
      "Large Portrait",
      8.5,
      11,
      "Larger artwork, educational and activity books",
    ),
    inches(
      "small-landscape",
      "Small Landscape",
      8.25,
      6,
      "Compact horizontal compositions",
    ),
    inches(
      "landscape",
      "Landscape",
      10,
      8,
      "Wide scenes and illustrated storytelling",
    ),
  ],
  hybrid: [
    inches(
      "compact-chapter-book",
      "Compact Chapter Book",
      5.5,
      8.5,
      "Mostly text with occasional illustrations",
    ),
    inches(
      "standard-illustrated-book",
      "Standard Illustrated Book",
      6,
      9,
      "Recommended balance of text and illustrations",
      true,
    ),
    inches(
      "large-illustrated-book",
      "Large Illustrated Book",
      7,
      10,
      "Frequent illustrations and larger type",
    ),
    inches(
      "wide-portrait",
      "Wide Portrait",
      7.5,
      9.25,
      "More horizontal room for text and pictures",
    ),
    inches(
      "full-page-illustrated",
      "Full-Page Illustrated",
      8,
      10,
      "Similar emphasis on artwork and text",
    ),
  ],
  text: [
    inches(
      "small-paperback",
      "Small Paperback",
      5,
      8,
      "Compact novels and shorter books",
    ),
    inches(
      "medium-paperback",
      "Medium Paperback",
      5.25,
      8,
      "Established fiction format between 5 and 5.5 in",
    ),
    inches(
      "trade-paperback",
      "Trade Paperback",
      5.5,
      8.5,
      "General fiction in a smaller format",
    ),
    inches(
      "large-trade-paperback",
      "Large Trade Paperback",
      6,
      9,
      "Recommended starting size for novels",
      true,
    ),
  ],
};

export const defaultSizePreset = (style: BookStyle) =>
  sizePresets[style].find((preset) => preset.default)!;

export function sizePresetLabel(preset: SizePreset, unit: Unit) {
  const format = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: unit === "mm" ? 1 : unit === "in" ? 2 : 3,
  });
  return `${preset.name} - ${format.format(fromPoints(preset.width, unit))} x ${format.format(fromPoints(preset.height, unit))} - ${preset.description}`;
}
