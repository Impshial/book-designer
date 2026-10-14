import { useState, useRef } from "react";
import { useModal } from "./useModal";
import {
  X,
  ChevronDown,
  BookOpen,
  Feather,
  Image as ImageIcon,
  ArrowRight,
} from "lucide-react";
import {
  createProject,
  defaultSetup,
  fromPoints,
  toPoints,
  SetupSchema,
  type Project,
  type BookStyle,
  type Unit,
  type PageSetup,
} from "../core/model";
import {
  defaultSizePreset,
  sizePresetLabel,
  sizePresets,
} from "../core/sizePresets";
export const styleNames = {
  picture: "Picture Book",
  text: "Text Only",
  hybrid: "Hybrid",
};
const choices = [
  {
    id: "picture" as const,
    icon: ImageIcon,
    description: "A little art. A little magic. Compose every page.",
  },
  {
    id: "hybrid" as const,
    icon: BookOpen,
    description: "A flowing story, with room for designed pages.",
  },
  {
    id: "text" as const,
    icon: Feather,
    description: "Let your words flow naturally from page to page.",
  },
];
export function NewBook({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (p: Project) => Promise<void>;
}) {
  const modal = useRef<HTMLElement>(null);
  useModal(modal, true);
  const [style, setStyle] = useState<BookStyle>("picture"),
    [title, setTitle] = useState(""),
    [author, setAuthor] = useState(""),
    [setup, setSetup] = useState(() => {
      const setup = defaultSetup("picture");
      const unit = localStorage.getItem("bd.unit");
      if (unit === "in" || unit === "mm" || unit === "cm") setup.unit = unit;
      return setup;
    }),
    [count, setCount] = useState(32),
    [sizePreset, setSizePreset] = useState(defaultSizePreset("picture").id),
    [advanced, setAdvanced] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const set = (patch: Partial<PageSetup>) =>
    setSetup((s) => ({ ...s, ...patch }));
  const unit = setup.unit;
  const n = (value: number) => Number(fromPoints(value, unit).toFixed(3));
  const validation = SetupSchema.safeParse(setup);
  const valid =
    validation.success &&
    (style !== "picture" ||
      (count >= 1 && count <= 1000 && Number.isInteger(count))) &&
    title.trim().length > 0;
  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      localStorage.setItem("bd.unit", unit);
      await onCreate(createProject(style, title, author, setup, count));
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) onClose();
      }}
    >
      <section
        ref={modal}
        className="new-book modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-title"
      >
        <header className="modal-header">
          <h2 id="new-title">Create a New Book</h2>
          <button
            className="icon"
            aria-label="Close new book"
            onClick={onClose}
            disabled={busy}
          >
            <X size={19} />
          </button>
        </header>
        <div className="new-body">
          <div className="new-settings">
            <label className="field-label">
              What kind of book are you making?
            </label>
            <div className="style-choices">
              {choices.map((c) => (
                <button
                  key={c.id}
                  className={`style-choice ${style === c.id ? "active" : ""}`}
                  aria-pressed={style === c.id}
                  onClick={() => {
                    setStyle(c.id);
                    const preset = defaultSizePreset(c.id);
                    setSetup({
                      ...defaultSetup(c.id),
                      width: preset.width,
                      height: preset.height,
                      unit,
                    });
                    setSizePreset(preset.id);
                  }}
                >
                  <c.icon size={20} />
                  <strong>{styleNames[c.id]}</strong>
                  <small>{c.description}</small>
                </button>
              ))}
            </div>
            <div className="field-row">
              <label>
                Book title
                <input
                  autoFocus
                  value={title}
                  maxLength={240}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="An untold story"
                />
              </label>
              <label>
                Author <span className="muted">(optional)</span>
                <input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Your name"
                />
              </label>
            </div>
            <div className="new-size-fields">
              <label className="size-field">
                Book size
                <select
                  aria-label="Size preset"
                  value={sizePreset}
                  onChange={(e) => {
                    setSizePreset(e.target.value);
                    if (e.target.value !== "custom") {
                      const preset = sizePresets[style].find(
                        (option) => option.id === e.target.value,
                      )!;
                      set({ width: preset.width, height: preset.height });
                    }
                  }}
                >
                  {sizePresets[style].map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {sizePresetLabel(preset, unit)}
                    </option>
                  ))}
                  <option value="custom">Custom size</option>
                </select>
              </label>
              <label>
                Measurement units
                <select
                  value={unit}
                  onChange={(e) => set({ unit: e.target.value as Unit })}
                >
                  <option value="in">Inches (in)</option>
                  <option value="mm">Millimeters (mm)</option>
                  <option value="cm">Centimeters (cm)</option>
                </select>
              </label>
            </div>
            {sizePreset === "custom" && (
              <div className="field-row dimensions">
                <label>
                  Width ({unit})
                  <input
                    aria-label="Page width"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={n(setup.width)}
                    onChange={(e) =>
                      set({ width: toPoints(Number(e.target.value), unit) })
                    }
                  />
                </label>
                <span>×</span>
                <label>
                  Height ({unit})
                  <input
                    aria-label="Page height"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={n(setup.height)}
                    onChange={(e) =>
                      set({ height: toPoints(Number(e.target.value), unit) })
                    }
                  />
                </label>
              </div>
            )}
            <div className="new-details">
              <div className="new-page-settings">
                <div className="field-row">
                  <label>
                    Starting layout
                    <select disabled>
                      <option>Blank</option>
                    </select>
                  </label>
                  {style === "picture" ? (
                    <label>
                      Initial pages
                      <input
                        type="number"
                        aria-label="Initial pages"
                        min={1}
                        max={1000}
                        value={count}
                        onChange={(e) => setCount(Number(e.target.value))}
                      />
                    </label>
                  ) : (
                    <div className="flow-note">
                      <Feather size={17} />
                      <span>
                        One empty chapter.
                        <br />
                        Pages grow with your story.
                      </span>
                    </div>
                  )}
                </div>
                <button
                  className="disclosure"
                  onClick={() => setAdvanced(!advanced)}
                  aria-expanded={advanced}
                >
                  <ChevronDown
                    size={16}
                    style={{ transform: advanced ? "rotate(180deg)" : "" }}
                  />{" "}
                  Advanced page setup
                </button>
                {advanced && (
                  <div className="advanced">
                    <div className="field-row four">
                      {(["top", "bottom", "inside", "outside"] as const).map(
                        (key) => (
                          <label key={key}>
                            {key[0].toUpperCase() + key.slice(1)} ({unit})
                            <input
                              type="number"
                              min={0}
                              step="0.1"
                              value={n(setup[key])}
                              onChange={(e) =>
                                set({
                                  [key]: toPoints(Number(e.target.value), unit),
                                })
                              }
                            />
                          </label>
                        ),
                      )}
                    </div>
                    <div className="field-row">
                      <label>
                        Additional gutter ({unit})
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          value={n(setup.gutter)}
                          onChange={(e) =>
                            set({
                              gutter: toPoints(Number(e.target.value), unit),
                            })
                          }
                        />
                      </label>
                      <label>
                        Number placement
                        <select
                          value={setup.numberPosition}
                          onChange={(e) =>
                            set({
                              numberPosition: e.target.value as
                                "center" | "outside",
                            })
                          }
                        >
                          <option value="center">Bottom center</option>
                          <option value="outside">Bottom outside</option>
                        </select>
                      </label>
                    </div>
                    <p className="hint">
                      Gutter adds space to the inside margin at the binding.
                    </p>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={!!setup.bleed}
                        onChange={(e) =>
                          set({ bleed: e.target.checked ? 9 : 0 })
                        }
                      />
                      Artwork reaches the page edge
                    </label>
                    {!!setup.bleed && (
                      <p className="hint">
                        Provisional 0.125 in bleed guides. Extend artwork beyond
                        trim; final requirements depend on your printer.
                      </p>
                    )}
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={setup.numbering}
                        onChange={(e) => set({ numbering: e.target.checked })}
                      />
                      Show page numbers
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={setup.facing}
                        onChange={(e) => set({ facing: e.target.checked })}
                      />
                      Start with facing pages
                    </label>
                  </div>
                )}
                {!validation.success && (
                  <p className="error">{validation.error.issues[0].message}</p>
                )}
                {error && (
                  <p role="alert" className="error">
                    {error}
                  </p>
                )}
              </div>
              <aside className="new-preview">
                <span className="eyebrow">YOUR BOOK, AT A GLANCE</span>
                <div className="mini-area">
                  <div
                    className="mini-page"
                    style={{
                      aspectRatio: `${Math.max(setup.width, 1)} / ${Math.max(setup.height, 1)}`,
                      width: Math.min(
                        150,
                        (150 * Math.max(setup.width, 1)) /
                          Math.max(setup.height, 1),
                      ),
                    }}
                  >
                    <div
                      className="mini-safe"
                      style={{
                        top: `${(setup.top / setup.height) * 100}%`,
                        bottom: `${(setup.bottom / setup.height) * 100}%`,
                        left: `${((setup.inside + setup.gutter) / setup.width) * 100}%`,
                        right: `${(setup.outside / setup.width) * 100}%`,
                      }}
                    />
                    {!!setup.bleed && <div className="mini-bleed" />}
                    {setup.numbering && (
                      <span className={`mini-number ${setup.numberPosition}`}>
                        1
                      </span>
                    )}
                  </div>
                </div>
                <strong>{title || "Your next great story"}</strong>
                <p>
                  {n(setup.width)} × {n(setup.height)} {unit} ·{" "}
                  {styleNames[style]}
                </p>
                <div className="guide-key">
                  <span>
                    <i className="trim" /> Trim edge
                  </span>
                  <span>
                    <i className="safe" /> Safe margin
                  </span>
                  {!!setup.bleed && (
                    <span>
                      <i className="bleed" /> Provisional bleed
                    </span>
                  )}
                </div>
              </aside>
            </div>
          </div>
        </div>
        <footer className="modal-footer">
          <span>Your work stays on your computer.</span>
          <button className="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="primary"
            accessKey="c"
            title="Create book (Alt+C)"
            onClick={submit}
            disabled={!valid || busy}
          >
            {busy ? "Creating…" : "Create book"}
            <ArrowRight size={17} />
          </button>
        </footer>
      </section>
    </div>
  );
}
