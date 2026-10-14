import { PageNumberSettings } from "./PageNumberSettings";
import {
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Copy,
  Trash2,
} from "lucide-react";
import {
  effectivePpi,
  getPageBackground,
  editPageBackground,
  applyBackgroundToAll,
  objectName,
  fromPoints,
  toPoints,
  SetupSchema,
  type BookObject,
  type Project,
  type PageSetup,
} from "../core/model";
import type { LayoutPage } from "../core/layout";
export function Inspector({
  p,
  page,
  selection,
  update,
  commit,
  select,
  duplicate,
  remove,
  width,
  backgroundImage,
}: {
  p: Project;
  page: LayoutPage;
  selection: string[];
  update: (changes: { id: string; patch: Partial<BookObject> }[]) => void;
  commit: (f: (draft: Project) => void) => void;
  select: (ids: string[]) => void;
  duplicate: () => void;
  remove: () => void;
  width: number;
  backgroundImage: () => void;
}) {
  const o = page.design?.objects.find((o) => o.id === selection[0]);
  const background = getPageBackground(p, page);
  const unit = p.setup.unit;
  const n = (v: number) => Number(fromPoints(v, unit).toFixed(3));
  const set = (patch: Partial<BookObject>) => {
    if (o) update([{ id: o.id, patch }]);
  };
  const field = (label: string, key: "x" | "y" | "width" | "height") => (
    <label>
      {label} ({unit})
      <input
        type="number"
        aria-label={`Object ${label.toLowerCase()}`}
        step="0.01"
        value={n(o![key])}
        disabled={o?.locked}
        onChange={(e) => {
          const value = toPoints(Number(e.target.value), unit);
          if (
            !Number.isFinite(value) ||
            ((key === "width" || key === "height") && value <= 0)
          )
            return;
          const patch: Partial<BookObject> = { [key]: value };
          if (o?.type === "image" && o.keepRatio) {
            if (key === "width") patch.height = (value * o.height) / o.width;
            if (key === "height") patch.width = (value * o.width) / o.height;
          }
          set(patch);
        }}
      />
    </label>
  );
  function changeSetup(patch: Partial<PageSetup>) {
    const s = { ...p.setup, ...patch };
    if (SetupSchema.safeParse(s).success)
      commit((d) => {
        d.setup = s;
      });
  }
  const reorder = (id: string, direction: number) =>
    commit((d) => {
      const pg = d.pages.find((x) => x.id === page.id)!;
      const i = pg.objects.findIndex((x) => x.id === id);
      const j = Math.max(0, Math.min(pg.objects.length - 1, i + direction));
      const [item] = pg.objects.splice(i, 1);
      pg.objects.splice(j, 0, item);
    });
  return (
    <aside className="inspector" style={{ width }}>
      <div className="panel-title">
        {o ? "Object properties" : "Book & page"}
        <span className="muted">{o?.type ?? "Settings"}</span>
      </div>
      <div className="inspector-scroll">
        {o ? (
          <>
            <label>
              Object name
              <input
                value={objectName(o)}
                readOnly={o.type === "text"}
                onChange={(e) => set({ name: e.target.value })}
              />
            </label>
            {o.type === "text" && (
              <>
                <div className="section-label">TYPOGRAPHY</div>
                <label>
                  Typeface
                  <select
                    value={o.font}
                    onChange={(e) =>
                      set({ font: e.target.value as "serif" | "sans" })
                    }
                  >
                    <option value="serif">Noto Serif</option>
                    <option value="sans">Noto Sans</option>
                  </select>
                </label>
                <div className="field-row">
                  <label>
                    Size (pt)
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={o.fontSize}
                      onChange={(e) =>
                        set({
                          fontSize: Math.max(
                            1,
                            Math.min(500, Number(e.target.value)),
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Line spacing
                    <input
                      type="number"
                      min={0.5}
                      max={4}
                      step={0.1}
                      value={o.lineHeight}
                      onChange={(e) =>
                        set({
                          lineHeight: Math.max(
                            0.5,
                            Math.min(4, Number(e.target.value)),
                          ),
                        })
                      }
                    />
                  </label>
                </div>
                <div className="button-row">
                  <button
                    className={o.bold ? "active" : ""}
                    onClick={() => set({ bold: !o.bold })}
                  >
                    <b>B</b>
                  </button>
                  <button
                    className={o.italic ? "active" : ""}
                    onClick={() => set({ italic: !o.italic })}
                  >
                    <i>I</i>
                  </button>
                  <select
                    aria-label="Text alignment"
                    value={o.align}
                    onChange={(e) =>
                      set({ align: e.target.value as BookObject["align"] })
                    }
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <label>
                  Complete text
                  <textarea
                    aria-label="Text box content"
                    rows={5}
                    value={o.text}
                    onChange={(e) => set({ text: e.target.value })}
                  />
                </label>
                <p className="hint">
                  The full text stays editable, even when the frame overflows.
                </p>
              </>
            )}
            {o.type !== "image" && (
              <div className="field-row">
                <label>
                  {o.type === "text" ? "Text color" : "Fill"}
                  <input
                    type="color"
                    value={o.fill}
                    onChange={(e) => set({ fill: e.target.value })}
                  />
                </label>
                <label>
                  Stroke
                  <input
                    type="color"
                    value={o.stroke}
                    onChange={(e) => set({ stroke: e.target.value })}
                  />
                </label>
                <label>
                  Width
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={o.strokeWidth}
                    onChange={(e) =>
                      set({ strokeWidth: Math.max(0, Number(e.target.value)) })
                    }
                  />
                </label>
              </div>
            )}
            <div className="section-label">POSITION & SIZE</div>
            <div className="field-row">
              {field("X", "x")}
              {field("Y", "y")}
            </div>
            <div className="field-row">
              {field("Width", "width")}
              {field("Height", "height")}
            </div>
            <div className="field-row">
              <label>
                Rotation (°)
                <input
                  type="number"
                  value={Number(o.rotation.toFixed(2))}
                  disabled={o.locked}
                  onChange={(e) => set({ rotation: Number(e.target.value) })}
                />
              </label>
              <label>
                Opacity (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(o.opacity * 100)}
                  onChange={(e) =>
                    set({
                      opacity:
                        Math.max(0, Math.min(100, Number(e.target.value))) /
                        100,
                    })
                  }
                />
              </label>
            </div>
            {o.type === "image" && o.assetId && (
              <>
                <div className="section-label">ILLUSTRATION</div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={o.keepRatio}
                    onChange={(e) => set({ keepRatio: e.target.checked })}
                  />
                  Keep proportions
                </label>
                <div className="quality">
                  <span
                    className={
                      effectivePpi(o, p.assets[o.assetId]) >= 300
                        ? "good"
                        : "warn"
                    }
                  >
                    ●
                  </span>
                  <strong>
                    {Math.round(effectivePpi(o, p.assets[o.assetId]))} PPI
                  </strong>
                  <span>
                    {effectivePpi(o, p.assets[o.assetId]) >= 300
                      ? "Excellent"
                      : effectivePpi(o, p.assets[o.assetId]) >= 150
                        ? "Acceptable"
                        : "Too low"}
                  </span>
                </div>
                <p className="hint">
                  From the cropped original at this print size. General
                  reference: 300 PPI.
                </p>
                <div className="section-label">CROP · ORIGINAL RETAINED</div>
                {(["x", "y", "width", "height"] as const).map((key) => (
                  <label key={key}>
                    Crop {key} (%)
                    <input
                      type="number"
                      min={key === "width" || key === "height" ? 1 : 0}
                      max={100}
                      step={1}
                      value={Math.round(o.crop[key] * 100)}
                      onChange={(e) => {
                        const value = Math.max(
                          key === "width" || key === "height" ? 0.01 : 0,
                          Math.min(1, Number(e.target.value) / 100),
                        );
                        const crop = { ...o.crop, [key]: value };
                        if (crop.x + crop.width > 1) {
                          if (key === "x") crop.width = 1 - crop.x;
                          else crop.x = 1 - crop.width;
                        }
                        if (crop.y + crop.height > 1) {
                          if (key === "y") crop.height = 1 - crop.y;
                          else crop.y = 1 - crop.height;
                        }
                        if (crop.width > 0 && crop.height > 0) set({ crop });
                      }}
                    />
                  </label>
                ))}
                <button
                  className="text-button"
                  onClick={() =>
                    set({ crop: { x: 0, y: 0, width: 1, height: 1 } })
                  }
                >
                  Reset crop
                </button>
                <label>
                  Alt text
                  <textarea
                    rows={2}
                    value={o.alt}
                    onChange={(e) => set({ alt: e.target.value })}
                  />
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={o.decorative}
                    onChange={(e) => set({ decorative: e.target.checked })}
                  />
                  Decorative artwork
                </label>
              </>
            )}
            <div className="button-row">
              <button title="Bring forward" onClick={() => reorder(o.id, 1)}>
                <ArrowUp size={15} />
              </button>
              <button title="Send backward" onClick={() => reorder(o.id, -1)}>
                <ArrowDown size={15} />
              </button>
              <button title="Duplicate object" onClick={duplicate}>
                <Copy size={15} />
              </button>
              <button
                title="Delete object"
                disabled={o.locked}
                onClick={remove}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </>
        ) : (
          <>
            <input
              className="book-title-input"
              aria-label="Title"
              placeholder="Book title"
              value={p.title}
              onChange={(e) => {
                if (e.target.value.trim())
                  commit((d) => {
                    d.title = e.target.value;
                  });
              }}
            />
            <input
              className="book-author-input"
              aria-label="Author"
              placeholder="Author"
              value={p.author}
              onChange={(e) =>
                commit((d) => {
                  d.author = e.target.value;
                })
              }
            />
            <div className="section-label">PAGE SETUP</div>
            <div className="dimension-summary">
              {n(p.setup.width)} × {n(p.setup.height)} {unit}
              <span>Finished page size</span>
            </div>
            <div className="field-row">
              <label>
                Width ({unit})
                <input
                  type="number"
                  step={0.1}
                  value={n(p.setup.width)}
                  onChange={(e) =>
                    changeSetup({
                      width: toPoints(Number(e.target.value), unit),
                    })
                  }
                />
              </label>
              <label>
                Height ({unit})
                <input
                  type="number"
                  step={0.1}
                  value={n(p.setup.height)}
                  onChange={(e) =>
                    changeSetup({
                      height: toPoints(Number(e.target.value), unit),
                    })
                  }
                />
              </label>
            </div>
            <details className="number-settings margin-settings">
              <summary>Margins ({unit})</summary>
              <div className="field-row four">
                {(["top", "bottom", "inside", "outside"] as const).map(
                  (key) => (
                    <label key={key}>
                      {key}
                      <input
                        type="number"
                        step={0.05}
                        min={0}
                        value={n(p.setup[key])}
                        onChange={(e) =>
                          changeSetup({
                            [key]: toPoints(Number(e.target.value), unit),
                          })
                        }
                      />
                    </label>
                  ),
                )}
              </div>
            </details>
            <label className="check">
              <input
                type="checkbox"
                checked={p.setup.numbering}
                onChange={(e) => changeSetup({ numbering: e.target.checked })}
              />
              Page numbers
            </label>
            {p.setup.numbering && (
              <PageNumberSettings setup={p.setup} change={changeSetup} />
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={!!p.setup.bleed}
                onChange={(e) =>
                  changeSetup({ bleed: e.target.checked ? 9 : 0 })
                }
              />
              Provisional bleed guides
            </label>
            {
              <section
                className="background-settings"
                aria-label="Page background settings"
              >
                {page.kind === "flow" && (
                  <p className="hint">
                    Background settings apply to this chapter’s text pages.
                  </p>
                )}
                <label>
                  Page background
                  <input
                    type="color"
                    value={background.background}
                    onChange={(e) =>
                      commit((d) => {
                        editPageBackground(d, page).background = e.target.value;
                      })
                    }
                  />
                </label>
                <button
                  className="secondary"
                  onClick={() =>
                    commit((d) => {
                      applyBackgroundToAll(d, background, "background");
                    })
                  }
                >
                  Apply background color to all pages
                </button>
                <button className="secondary" onClick={backgroundImage}>
                  {background.backgroundImage
                    ? "Replace background picture"
                    : "Choose background picture"}
                </button>
                {!!Object.keys(p.assets).length && (
                  <label>
                    Use existing artwork
                    <select
                      aria-label="Background artwork"
                      value={background.backgroundImage?.assetId ?? ""}
                      onChange={(e) =>
                        commit((d) => {
                          editPageBackground(d, page).backgroundImage = e.target
                            .value
                            ? { assetId: e.target.value, fit: "cover" }
                            : undefined;
                        })
                      }
                    >
                      <option value="">Color only</option>
                      {Object.values(p.assets).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {background.backgroundImage && (
                  <>
                    <label>
                      Background picture fit
                      <select
                        aria-label="Background picture fit"
                        value={background.backgroundImage.fit}
                        onChange={(e) =>
                          commit((d) => {
                            editPageBackground(d, page).backgroundImage!.fit = e
                              .target.value as "cover" | "contain";
                          })
                        }
                      >
                        <option value="cover">Fill page (crop edges)</option>
                        <option value="contain">Fit whole picture</option>
                      </select>
                    </label>
                    <button
                      className="secondary"
                      onClick={() =>
                        commit((d) => {
                          applyBackgroundToAll(
                            d,
                            background,
                            "backgroundImage",
                          );
                        })
                      }
                    >
                      Apply background picture to all pages
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        commit((d) => {
                          delete editPageBackground(d, page).backgroundImage;
                        })
                      }
                    >
                      Remove background picture
                    </button>
                  </>
                )}
              </section>
            }
            {p.style !== "picture" && (
              <>
                <div className="section-label">MANUSCRIPT TYPE</div>
                <label>
                  Typeface
                  <select
                    value={p.typography.font}
                    onChange={(e) =>
                      commit((d) => {
                        d.typography.font = e.target.value as "serif" | "sans";
                      })
                    }
                  >
                    <option value="serif">Noto Serif</option>
                    <option value="sans">Noto Sans</option>
                  </select>
                </label>
                <div className="field-row">
                  <label>
                    Size (pt)
                    <input
                      type="number"
                      min={6}
                      max={96}
                      value={p.typography.size}
                      onChange={(e) =>
                        commit((d) => {
                          d.typography.size = Math.max(
                            6,
                            Math.min(96, Number(e.target.value)),
                          );
                        })
                      }
                    />
                  </label>
                  <label>
                    Line spacing
                    <input
                      type="number"
                      min={1}
                      max={3}
                      step={0.1}
                      value={p.typography.lineHeight}
                      onChange={(e) =>
                        commit((d) => {
                          d.typography.lineHeight = Math.max(
                            1,
                            Math.min(3, Number(e.target.value)),
                          );
                        })
                      }
                    />
                  </label>
                </div>
              </>
            )}
            <p className="hint">
              All measurements remain fixed when you zoom. Choose an object to
              see its properties.
            </p>
          </>
        )}
        {!!page.design && (
          <>
            <div className="section-label layers-heading">
              LAYERS <span>{page.design.objects.length}</span>
            </div>
            <div className="layers">
              {[...page.design.objects].reverse().map((item) => (
                <div
                  key={item.id}
                  className={`layer-row ${selection.includes(item.id) ? "active" : ""}`}
                >
                  <button
                    className="layer-name"
                    onClick={() => select([item.id])}
                  >
                    <span>
                      {item.type === "text"
                        ? "T"
                        : item.type === "image"
                          ? "▧"
                          : "◇"}
                    </span>
                    {objectName(item)}
                  </button>
                  <button
                    className="icon"
                    aria-label={`${item.hidden ? "Show" : "Hide"} ${objectName(item)}`}
                    onClick={() =>
                      update([{ id: item.id, patch: { hidden: !item.hidden } }])
                    }
                  >
                    {item.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button
                    className="icon"
                    aria-label={`${item.locked ? "Unlock" : "Lock"} ${objectName(item)}`}
                    onClick={() =>
                      update([{ id: item.id, patch: { locked: !item.locked } }])
                    }
                  >
                    {item.locked ? <Lock size={13} /> : <Unlock size={13} />}
                  </button>
                </div>
              ))}
              {!page.design.objects.length && (
                <p className="hint">Add text or artwork to begin.</p>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
