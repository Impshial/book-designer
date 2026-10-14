import {
  defaultNumberStyle,
  type NumberStyle,
  type PageSetup,
} from "../core/model";

export function PageNumberSettings({
  setup,
  change,
}: {
  setup: PageSetup;
  change: (patch: Partial<PageSetup>) => void;
}) {
  const style = setup.numberStyle ?? defaultNumberStyle;
  const set = (patch: Partial<NumberStyle>) =>
    change({ numberStyle: { ...style, ...patch } });
  return (
    <details className="number-settings">
      <summary>Page number formatting</summary>
      <label>
        Number format
        <select
          value={style.format}
          onChange={(e) =>
            set({ format: e.target.value as NumberStyle["format"] })
          }
        >
          <option value="decimal">1, 2, 3</option>
          <option value="roman">i, ii, iii</option>
          <option value="ROMAN">I, II, III</option>
        </select>
      </label>
      <label>
        Start at
        <input
          type="number"
          min={1}
          max={9999}
          value={style.start}
          onChange={(e) => set({ start: Number(e.target.value) })}
        />
      </label>
      <div className="field-row">
        <label>
          Placement
          <select
            value={style.vertical}
            onChange={(e) =>
              set({ vertical: e.target.value as NumberStyle["vertical"] })
            }
          >
            <option value="bottom">Bottom</option>
            <option value="top">Top</option>
          </select>
        </label>
        <label>
          Alignment
          <select
            aria-label="Page number alignment"
            value={setup.numberPosition}
            onChange={(e) =>
              change({
                numberPosition: e.target.value as PageSetup["numberPosition"],
              })
            }
          >
            <option value="center">Center</option>
            <option value="outside">Outside</option>
          </select>
        </label>
      </div>
      <label>
        Number typeface
        <select
          value={style.font}
          onChange={(e) => set({ font: e.target.value as NumberStyle["font"] })}
        >
          <option value="sans">Noto Sans</option>
          <option value="serif">Noto Serif</option>
        </select>
      </label>
      <div className="field-row">
        <label>
          Number size (pt)
          <input
            type="number"
            min={6}
            max={72}
            value={style.size}
            onChange={(e) => set({ size: Number(e.target.value) })}
          />
        </label>
        <label>
          Number color
          <input
            type="color"
            value={style.color}
            onChange={(e) => set({ color: e.target.value })}
          />
        </label>
      </div>
      <div className="field-row">
        <label className="check">
          <input
            type="checkbox"
            checked={style.bold}
            onChange={(e) => set({ bold: e.target.checked })}
          />
          Bold numbers
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={style.italic}
            onChange={(e) => set({ italic: e.target.checked })}
          />
          Italic numbers
        </label>
      </div>
    </details>
  );
}
