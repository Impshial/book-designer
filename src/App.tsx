import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Plus,
  FolderOpen,
  ArrowRight,
  MousePointer2,
  Type,
  Image as ImageIcon,
  Square,
  Minus,
  ZoomIn,
  Hand,
  Undo2,
  Redo2,
  Save,
  Upload,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelRightClose,
  Check,
  AlertCircle,
  MoreHorizontal,
  Copy,
  Trash2,
  Search,
  Layers,
  Feather,
  X,
  AlignHorizontalJustifyCenter,
  Group as GroupIcon,
  Maximize,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  blankPage,
  backgroundPlacement,
  objectName,
  emptyDoc,
  newObject,
  uid,
  wordCount,
  fromPoints,
  type Project,
  type BookObject,
  type Asset,
  type RichNode,
} from "./core/model";
import { History } from "./core/history";
import { layoutProject, pageNumberLine, type LayoutPage } from "./core/layout";
import { NewBook, styleNames } from "./components/NewBook";
import { PageCanvas } from "./components/PageCanvas";
import { Manuscript } from "./components/Manuscript";
import { SaveChanges } from "./components/SaveChanges";
import { Inspector } from "./components/Inspector";
import { ResizeHandle } from "./components/ResizeHandle";
import { cssFont } from "./core/fonts";
import { Publish } from "./components/Publish";
import * as storage from "./services/storage";

function Thumbnail({ p, page }: { p: Project; page: LayoutPage }) {
  const background = page.design?.backgroundImage;
  const asset = background ? p.assets[background.assetId] : undefined;
  const number = p.setup.numbering ? pageNumberLine(p, page.number) : undefined;
  return (
    <svg viewBox={`0 0 ${p.setup.width} ${p.setup.height}`} aria-hidden="true">
      <rect
        width="100%"
        height="100%"
        fill={page.design?.background ?? "white"}
      />
      {background && asset && (
        <image
          href={`data:${asset.mime};base64,${asset.data}`}
          {...backgroundPlacement(asset, p.setup, background.fit)}
          preserveAspectRatio="none"
        />
      )}
      {page.design?.objects
        .filter((o) => !o.hidden)
        .map((o) => (
          <g
            key={o.id}
            transform={`translate(${o.x} ${o.y}) rotate(${o.rotation})`}
            opacity={o.opacity}
          >
            {o.type === "image" && o.assetId ? (
              <svg
                width={o.width}
                height={o.height}
                viewBox={`${o.crop.x * p.assets[o.assetId].width} ${o.crop.y * p.assets[o.assetId].height} ${o.crop.width * p.assets[o.assetId].width} ${o.crop.height * p.assets[o.assetId].height}`}
                preserveAspectRatio="none"
              >
                <image
                  href={`data:${p.assets[o.assetId].mime};base64,${p.assets[o.assetId].data}`}
                  width={p.assets[o.assetId].width}
                  height={p.assets[o.assetId].height}
                />
              </svg>
            ) : o.type === "text" ? (
              <text
                y={o.fontSize}
                fontSize={o.fontSize}
                fontFamily="Book Serif"
                fill={o.fill}
              >
                {o.text.slice(0, 35)}
              </text>
            ) : o.type === "ellipse" ? (
              <ellipse
                cx={o.width / 2}
                cy={o.height / 2}
                rx={o.width / 2}
                ry={o.height / 2}
                fill={o.fill}
              />
            ) : (
              <rect width={o.width} height={o.height} fill={o.fill} />
            )}
          </g>
        ))}
      {page.lines.map((l, i) => (
        <rect
          key={i}
          x={l.x}
          y={l.y - 4}
          width={Math.min(l.width, p.setup.width - 72)}
          height={3}
          fill="#b6bcb5"
        />
      ))}
      {number && (
        <text
          x={number.x}
          y={number.y}
          fontSize={number.runs[0].size}
          fill={number.runs[0].color}
          fontFamily={cssFont(number.runs[0].font)}
          fontWeight={number.runs[0].font.includes("bold") ? 700 : 400}
          fontStyle={
            number.runs[0].font.includes("italic") ? "italic" : "normal"
          }
        >
          {number.runs[0].text}
        </text>
      )}
    </svg>
  );
}
export default function App() {
  const [p, setProject] = useState<Project | null>(null),
    history = useRef<History | null>(null),
    [path, setPath] = useState(""),
    [savedRevision, setSavedRevision] = useState(-1),
    [saveState, setSaveState] = useState("Saved"),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const [showNew, setShowNew] = useState(false),
    [showPublish, setShowPublish] = useState(false),
    [showHelp, setShowHelp] = useState(false),
    [showFind, setShowFind] = useState(false),
    [find, setFind] = useState(""),
    [replacement, setReplacement] = useState("");
  const [pageIndex, setPageIndex] = useState(0),
    [selection, setSelection] = useState<string[]>([]),
    [zoom, setZoom] = useState(0.8),
    [guides, setGuides] = useState(true),
    [facing, setFacing] = useState(false),
    [writing, setWriting] = useState(true),
    [pan, setPan] = useState(false),
    [left, setLeft] = useState(true),
    [right, setRight] = useState(true),
    [tab, setTab] = useState("pages"),
    [menu, setMenu] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [editText, setEditText] = useState("");
  const [ready, setReady] = useState(false);
  const savedWidth = (key: string, fallback: number) => {
    try {
      const value = Number(localStorage.getItem(key));
      return Number.isFinite(value) && value >= 160 && value <= 520
        ? value
        : fallback;
    } catch {
      return fallback;
    }
  };
  const [leftWidth, setLeftWidth] = useState(() =>
    savedWidth("bd.leftWidth", 204),
  );
  const [rightWidth, setRightWidth] = useState(() =>
    savedWidth("bd.rightWidth", 258),
  );
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [fitToPage, setFitToPage] = useState(true);
  const canvasScroll = useRef<HTMLDivElement>(null);
  const maxLeft = Math.min(420, windowWidth * 0.3),
    maxRight = Math.min(520, windowWidth * 0.35);
  const navigationWidth = Math.max(160, Math.min(leftWidth, maxLeft)),
    inspectorWidth = Math.max(240, Math.min(rightWidth, maxRight));
  useEffect(() => {
    const resized = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", resized);
    return () => window.removeEventListener("resize", resized);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("bd.leftWidth", String(leftWidth));
      localStorage.setItem("bd.rightWidth", String(rightWidth));
    } catch {
      /* Workspace preferences are optional. */
    }
  }, [leftWidth, rightWidth]);
  const changeZoom = (value: number) => {
    setFitToPage(false);
    setZoom(value);
  };
  const toggleFacing = () => {
    setFacing((value) => !value);
    setFitToPage(true);
  };
  const [leavePrompt, setLeavePrompt] = useState<{
    title: string;
    neverSaved: boolean;
  } | null>(null);
  const pendingLeave = useRef<{
    promise: Promise<boolean>;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const saving = useRef<Promise<boolean> | null>(null);
  const savedProject = useRef<Project | null>(null);
  function isDirty(project: Project | null, location: string) {
    if (!project) return false;
    if (!location || !savedProject.current) return true;
    const content = (book: Project) =>
      JSON.stringify({ ...book, revision: 0, modified: "" });
    return content(project) !== content(savedProject.current);
  }
  const clipboard = useRef<BookObject[]>([]),
    queue = useRef(new storage.SaveQueue()),
    latest = useRef({ p, path, savedRevision }),
    workspace = useRef<HTMLDivElement>(null);
  latest.current = { p, path, savedRevision };
  const pages = useMemo(() => (p ? layoutProject(p) : []), [p]);
  const page = pages[Math.min(pageIndex, pages.length - 1)];
  const spreadStart = facing
    ? Math.floor(Math.min(pageIndex, pages.length - 1) / 2) * 2
    : pageIndex;
  const visiblePages = pages.slice(spreadStart, spreadStart + (facing ? 2 : 1));
  const activeChapter =
    p?.chapters.find((c) => c.id === page?.chapterId) ?? p?.chapters[0];
  const commit = (f: (draft: Project) => void, mergeKey = "") => {
    if (history.current) {
      setProject(history.current.commit(f, mergeKey));
      setSaveState("Unsaved changes");
    }
  };
  const undo = () => {
    if (history.current) {
      setProject(history.current.undo());
      setSelection([]);
      setSaveState("Unsaved changes");
    }
  };
  const redo = () => {
    if (history.current) {
      setProject(history.current.redo());
      setSelection([]);
      setSaveState("Unsaved changes");
    }
  };
  function load(project: Project, location: string, recovered = false) {
    history.current = new History(project);
    setProject(project);
    setPath(location);
    savedProject.current = recovered || !location ? null : project;
    setSavedRevision(recovered || !location ? -1 : project.revision);
    setSaveState(
      !location
        ? "Not saved yet"
        : recovered
          ? "Recovered · unsaved changes"
          : "Saved",
    );
    setSelection([]);
    setPageIndex(0);
    setFacing(project.setup.facing);
    setFitToPage(project.style === "picture");
    setTab(project.style === "picture" ? "pages" : "chapters");
    setShowNew(false);
    clipboard.current = [];
    setError("");
    setReady(true);
  }
  async function save(copy = false): Promise<boolean> {
    if (saving.current) return saving.current;
    const snap = latest.current;
    if (!snap.p) return true;
    history.current?.breakGroup();
    setSaveState("Saving…");
    const job = queue.current.run(async () => {
      try {
        let location = snap.path;
        if (copy || !location) {
          location = (await storage.saveAsBook(snap.p!)) ?? "";
          if (!location) {
            setSaveState(snap.path ? "Unsaved changes" : "Not saved yet");
            return false;
          }
        } else await storage.saveBook(location, snap.p!);
        if (copy && snap.path && snap.path !== location)
          await storage.discardRecovery(snap.path);
        if (latest.current.p?.id === snap.p!.id) {
          savedProject.current = snap.p;
          setPath(location);
          latest.current.path = location;
          latest.current.savedRevision = snap.p!.revision;
          setSavedRevision(snap.p!.revision);
          setSaveState(
            latest.current.p?.revision === snap.p!.revision
              ? "Saved"
              : "Unsaved changes",
          );
        }
        return true;
      } catch (e) {
        setSaveState("Save failed");
        setError(String(e));
        return false;
      }
    });
    saving.current = job;
    try {
      return await job;
    } finally {
      saving.current = null;
    }
  }
  async function saveAs() {
    return save(true);
  }
  async function confirmLeave(): Promise<boolean> {
    if (pendingLeave.current) return pendingLeave.current.promise;
    if (saving.current && !(await saving.current)) return false;
    const snap = latest.current;
    if (!isDirty(snap.p, snap.path)) return true;
    let resolve!: (ok: boolean) => void;
    const promise = new Promise<boolean>((done) => {
      resolve = done;
    });
    pendingLeave.current = { promise, resolve };
    setLeavePrompt({ title: snap.p!.title, neverSaved: !snap.path });
    return promise;
  }
  async function decideLeave(choice: "save" | "discard" | "cancel") {
    if (
      choice === "save" &&
      (!(await save()) || isDirty(latest.current.p, latest.current.path))
    )
      return false;
    if (choice === "discard" && latest.current.path) {
      try {
        await queue.current.run(() =>
          storage.discardRecovery(latest.current.path),
        );
      } catch (e) {
        setError(String(e));
        return false;
      }
    }
    pendingLeave.current?.resolve(choice !== "cancel");
    pendingLeave.current = null;
    setLeavePrompt(null);
    return true;
  }
  async function open(recent?: string) {
    if (!(await confirmLeave())) return;
    try {
      const result = await storage.openBook(recent);
      if (result) load(result.project, result.path, result.recovered);
    } catch (e) {
      setError(String(e));
    }
  }
  async function newBook() {
    if (await confirmLeave()) setShowNew(true);
  }
  useEffect(() => {
    const dirty = isDirty(p, path);
    if (!saving.current)
      setSaveState(
        !path && p ? "Not saved yet" : dirty ? "Unsaved changes" : "Saved",
      );
    if (p && path && dirty && !leavePrompt) {
      const timer = setTimeout(() => {
        void queue.current
          .run(() => storage.writeRecovery(path, p))
          .catch((e) => {
            setError(`Recovery could not be written: ${e}`);
          });
      }, 1200);
      return () => clearTimeout(timer);
    }
    if (p && path && !dirty)
      void queue.current
        .run(() => storage.discardRecovery(path))
        .catch((e) => setError(String(e)));
  }, [p, path, savedRevision, leavePrompt]);
  useEffect(() => {
    if (pageIndex >= pages.length) setPageIndex(Math.max(0, pages.length - 1));
  }, [pages.length, pageIndex]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const s = latest.current;
      if (!storage.native && isDirty(s.p, s.path)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  useEffect(() => {
    if (!storage.native) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    getCurrentWindow()
      .onCloseRequested(async (e) => {
        e.preventDefault();
        if (document.querySelector('[role="dialog"], [role="alertdialog"]'))
          return;
        if (await confirmLeave()) await getCurrentWindow().destroy();
      })
      .then((u) => {
        if (cancelled) u();
        else unlisten = u;
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
  useEffect(() => {
    if (storage.native)
      void getCurrentWindow().setTitle(
        p
          ? `${isDirty(p, path) ? "* " : ""}${p.title} — Book Designer`
          : "Book Designer",
      );
  }, [p, path, savedRevision]);
  function updatePage(
    pageId: string,
    changes: { id: string; patch: Partial<BookObject> }[],
  ) {
    commit((d) => {
      const pg = d.pages.find((x) => x.id === pageId);
      for (const change of changes) {
        const o = pg?.objects.find((x) => x.id === change.id);
        if (o) {
          Object.assign(o, change.patch);
          if (o.type === "text") o.name = objectName(o);
        }
      }
    });
  }
  function update(changes: { id: string; patch: Partial<BookObject> }[]) {
    if (page?.design) updatePage(page.id, changes);
  }
  function insert(type: BookObject["type"]) {
    if (!page?.design) {
      setToast("Insert a designed page to compose freeform objects.");
      return;
    }
    const object = newObject(type);
    commit((d) => {
      const pg = d.pages.find((x) => x.id === page.id)!;
      pg.objects.push(object);
      pg.readingOrder.push(object.id);
    });
    setSelection([object.id]);
  }
  async function importImage(
    file?: File,
    existing?: Asset,
    background = false,
  ) {
    if (!p || !page?.design) {
      setToast("Choose a designed page to add artwork.");
      return;
    }
    const targetId = page.id;
    try {
      let asset = existing;
      if (!asset) {
        const picked = file ?? (await storage.pickFile("image/png,image/jpeg"));
        if (!picked) return;
        if (picked.size > 70_000_000)
          throw new Error(
            "Please choose an image smaller than 70 MB for this version.",
          );
        const bytes = new Uint8Array(await picked.arrayBuffer());
        const png =
          bytes[0] === 137 &&
          bytes[1] === 80 &&
          bytes[2] === 78 &&
          bytes[3] === 71;
        const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        if (!png && !jpeg)
          throw new Error(
            "PNG and JPEG images are supported. Convert SVG or TIFF to PNG first.",
          );
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(picked);
        });
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () =>
            reject(new Error("This image could not be decoded."));
          img.src = `data:${png ? "image/png" : "image/jpeg"};base64,${data}`;
        });
        asset = {
          id: uid(),
          name: picked.name,
          mime: png ? "image/png" : "image/jpeg",
          data,
          width: img.naturalWidth,
          height: img.naturalHeight,
          colorAssumption:
            "Original bytes retained; display assumes sRGB when untagged.",
        };
      }
      const a = asset;
      if (latest.current.p?.id !== p.id) return;
      if (background) {
        commit((d) => {
          const pg = d.pages.find((x) => x.id === targetId);
          if (pg) {
            d.assets[a.id] = a;
            pg.backgroundImage = { assetId: a.id, fit: "cover" };
          }
        });
        setSelection([]);
        return;
      }
      const o = newObject("image");
      o.name = a.name;
      o.assetId = a.id;
      o.width = Math.min(300, p.setup.width - 72);
      o.height = (o.width * a.height) / a.width;
      if (o.height > p.setup.height - 72) {
        o.height = p.setup.height - 72;
        o.width = (o.height * a.width) / a.height;
      }
      commit((d) => {
        d.assets[a.id] = a;
        const pg = d.pages.find((x) => x.id === targetId);
        if (pg) {
          pg.objects.push(o);
          pg.readingOrder.push(o.id);
        }
      });
      setSelection([o.id]);
      setToast("Original artwork copied into your project.");
    } catch (e) {
      setError(String(e));
    }
  }
  function remove() {
    if (!page?.design) return;
    commit((d) => {
      const pg = d.pages.find((x) => x.id === page.id)!;
      const ids = new Set(
        pg.objects
          .filter((o) => selection.includes(o.id) && !o.locked)
          .map((o) => o.id),
      );
      pg.objects = pg.objects.filter((o) => !ids.has(o.id));
      pg.readingOrder = pg.readingOrder.filter((id) => !ids.has(id));
    });
    setSelection([]);
  }
  function paste(objects = clipboard.current) {
    if (!page?.design || !objects.length) return;
    const groupIds = new Map<string, string>();
    const cloned = structuredClone(objects).map((o) => {
      if (o.group && !groupIds.has(o.group)) groupIds.set(o.group, uid());
      return {
        ...o,
        id: uid(),
        x: o.x + 12,
        y: o.y + 12,
        locked: false,
        group: o.group ? groupIds.get(o.group) : undefined,
      };
    });
    commit((d) => {
      const pg = d.pages.find((x) => x.id === page.id)!;
      pg.objects.push(...cloned);
      pg.readingOrder.push(...cloned.map((o) => o.id));
    });
    setSelection(cloned.map((o) => o.id));
  }
  function duplicate() {
    paste(page?.design?.objects.filter((o) => selection.includes(o.id)) ?? []);
  }
  function groupSelection(ungroup = false) {
    const group = uid();
    update(
      (page?.design?.objects ?? [])
        .filter((o) => selection.includes(o.id) && !o.locked)
        .map((o) => ({
          id: o.id,
          patch: { group: ungroup ? undefined : group },
        })),
    );
  }
  function alignSelection() {
    if (!p) return;
    update(
      (page?.design?.objects ?? [])
        .filter((o) => selection.includes(o.id) && !o.locked)
        .map((o) => ({
          id: o.id,
          patch: { x: (p.setup.width - o.width) / 2 },
        })),
    );
  }
  function addPage(duplicatePage = false) {
    if (!p) return;
    const pg =
      duplicatePage && page.design
        ? structuredClone(page.design)
        : blankPage("Designed page");
    pg.id = uid();
    const mapping = new Map<string, string>();
    pg.objects.forEach((o) => {
      const old = o.id;
      o.id = uid();
      mapping.set(old, o.id);
      if (o.group) {
        if (!mapping.has(o.group)) mapping.set(o.group, uid());
        o.group = mapping.get(o.group);
      }
    });
    pg.readingOrder = pg.readingOrder
      .map((id) => mapping.get(id)!)
      .filter(Boolean);
    commit((d) => {
      if (d.style === "picture") {
        const at = d.pages.findIndex((x) => x.id === page.id) + 1;
        d.pages.splice(at, 0, pg);
      } else {
        const at = d.sequence.findIndex(
          (x) => x.id === (page.chapterId ?? page.id),
        );
        d.pages.push(pg);
        d.sequence.splice(Math.max(at, 0), 0, { kind: "design", id: pg.id });
      }
    });
    setSelection([]);
    if (p.style === "picture") setPageIndex(pageIndex + 1);
    setTab("pages");
  }
  function deletePage() {
    if (!p || !page.design || (p.style === "picture" && p.pages.length <= 1))
      return;
    if (
      !confirm(
        "Delete this designed page and its objects? You can undo this action.",
      )
    )
      return;
    commit((d) => {
      d.pages = d.pages.filter((x) => x.id !== page.id);
      d.sequence = d.sequence.filter((x) => x.id !== page.id);
    });
    setSelection([]);
  }
  function movePage(direction: number) {
    if (!p || !page.design) return;
    const id = page.id;
    commit((d) => {
      const items = d.style === "picture" ? d.pages : d.sequence;
      const i = items.findIndex((x) => x.id === id),
        j = Math.max(0, Math.min(items.length - 1, i + direction));
      const [item] = items.splice(i, 1);
      (items as typeof items).splice(j, 0, item as never);
    });
    if (p.style === "picture")
      setPageIndex(
        Math.max(0, Math.min(pages.length - 1, pageIndex + direction)),
      );
  }
  function addChapter() {
    if (!p || p.style === "picture") return;
    const c = {
      id: uid(),
      title: `Chapter ${p.chapters.length + 1}`,
      document: emptyDoc(),
    };
    commit((d) => {
      d.chapters.push(c);
      d.sequence.push({ kind: "chapter", id: c.id });
    });
    setTab("chapters");
    setPageIndex(pages.length);
  }
  async function importText() {
    if (!p || p.style === "picture") return;
    try {
      const file = await storage.pickFile(".txt,text/plain");
      if (!file) return;
      const text = await file.text();
      if (text.length > 2_000_000)
        throw new Error(
          "This text file is too large for the current importer.",
        );
      const c = {
        id: uid(),
        title: file.name.replace(/\.txt$/i, ""),
        document: {
          type: "doc",
          content: text
            .replace(/\r\n?/g, "\n")
            .split(/\n\s*\n/)
            .map((t) => ({
              type: "paragraph",
              attrs: { id: uid() },
              content: t ? [{ type: "text", text: t }] : [],
            })),
        } as RichNode,
      };
      commit((d) => {
        d.chapters.push(c);
        d.sequence.push({ kind: "chapter", id: c.id });
      });
      setToast("Imported as a new chapter. The source file is unchanged.");
    } catch (e) {
      setError(String(e));
    }
  }
  function applyFit() {
    if (!p || !canvasScroll.current) return;
    const scroll = canvasScroll.current,
      style = getComputedStyle(scroll);
    const horizontal =
      parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const vertical =
      parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const writingPage = writing && page?.kind === "flow";
    const count = writingPage ? 1 : Math.max(1, visiblePages.length);
    const pad = !writingPage && guides ? 36 : 0;
    const caption = writingPage
      ? 100
      : (scroll.querySelector(".page-caption")?.getBoundingClientRect()
          .height ?? 17);
    const availableWidth =
      scroll.clientWidth - horizontal - pad * count - (count - 1) * 3 - 2;
    const availableHeight = scroll.clientHeight - vertical - pad - caption - 2;
    setZoom(
      Math.max(
        0.01,
        Math.min(
          availableWidth / (p.setup.width * count),
          availableHeight / p.setup.height,
        ),
      ),
    );
  }
  function fit() {
    setFitToPage(true);
    applyFit();
    canvasScroll.current?.scrollTo({ left: 0, top: 0 });
  }
  useEffect(() => {
    if (!p || !fitToPage || !canvasScroll.current) return;
    const observer = new ResizeObserver(() => applyFit());
    observer.observe(canvasScroll.current);
    applyFit();
    return () => observer.disconnect();
  }, [
    p?.id,
    p?.setup.width,
    p?.setup.height,
    fitToPage,
    facing,
    guides,
    writing,
    page?.kind,
    visiblePages.length,
  ]);
  useEffect(() => {
    if (ready) {
      if (p?.style !== "picture" && workspace.current)
        setZoom(
          Math.max(
            0.5,
            Math.min(
              1.25,
              (workspace.current.getBoundingClientRect().width - 80) /
                p!.setup.width,
            ),
          ),
        );
      else fit();
      setReady(false);
    }
  }, [ready]);
  function replaceAll() {
    if (!find || !p) return;
    let count = 0;
    const replace = (text: string) => {
      count += text.split(find).length - 1;
      return text.split(find).join(replacement);
    };
    commit((d) => {
      const visit = (n: RichNode) => {
        if (n.text !== undefined) n.text = replace(n.text);
        n.content?.forEach(visit);
      };
      d.chapters.forEach((c) => visit(c.document));
      d.pages.forEach((pg) =>
        pg.objects.forEach((o) => {
          if (o.type === "text") {
            o.text = replace(o.text);
            o.name = objectName(o);
          }
        }),
      );
    });
    setToast(`Replaced ${count} matches. Undo restores the original text.`);
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"], [role="alertdialog"]'))
        return;
      const target = e.target as HTMLElement;
      const typing =
        target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void (e.shiftKey ? saveAs() : save());
        return;
      }
      if (ctrl && e.key.toLowerCase() === "n") {
        e.preventDefault();
        void newBook();
        return;
      }
      if (ctrl && e.key.toLowerCase() === "o") {
        e.preventDefault();
        void open();
        return;
      }
      if (ctrl && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setShowFind(true);
        return;
      }
      if (
        ctrl &&
        (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")
      ) {
        if (typing && !target.isContentEditable) return;
        e.preventDefault();
        (e.key.toLowerCase() === "y" || e.shiftKey ? redo : undo)();
        return;
      }
      if (e.key === "Escape") {
        setSelection([]);
        setMenu("");
        return;
      }
      if (typing || !page?.design) return;
      if (ctrl && e.key.toLowerCase() === "c") {
        e.preventDefault();
        clipboard.current = structuredClone(
          page.design.objects.filter((o) => selection.includes(o.id)),
        );
      }
      if (ctrl && e.key.toLowerCase() === "x") {
        e.preventDefault();
        clipboard.current = structuredClone(
          page.design.objects.filter((o) => selection.includes(o.id)),
        );
        remove();
      }
      if (ctrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        paste();
      }
      if (ctrl && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      }
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        update(
          page.design.objects
            .filter((o) => selection.includes(o.id) && !o.locked)
            .map((o) => ({
              id: o.id,
              patch: {
                x:
                  o.x +
                  (e.key === "ArrowLeft"
                    ? -step
                    : e.key === "ArrowRight"
                      ? step
                      : 0),
                y:
                  o.y +
                  (e.key === "ArrowUp"
                    ? -step
                    : e.key === "ArrowDown"
                      ? step
                      : 0),
              },
            })),
        );
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  const menuItems: Record<
    string,
    {
      label: string;
      action: () => void;
      disabled?: boolean;
      shortcut?: string;
    }[]
  > = {
    File: [
      { label: "New book…", action: () => void newBook(), shortcut: "Ctrl+N" },
      { label: "Open book…", action: () => void open(), shortcut: "Ctrl+O" },
      {
        label: "Save",
        action: () => void save(),
        disabled: !p,
        shortcut: "Ctrl+S",
      },
      {
        label: "Save a copy…",
        action: () => void saveAs(),
        disabled: !p,
        shortcut: "Ctrl+Shift+S",
      },
      {
        label: "Import TXT manuscript…",
        action: () => void importText(),
        disabled: !p || p.style === "picture",
      },
      {
        label: "Welcome screen",
        action: () =>
          void confirmLeave().then((ok) => {
            if (ok) {
              setProject(null);
              history.current = null;
            }
          }),
        disabled: !p,
      },
    ],
    Edit: [
      {
        label: "Group selection",
        action: () => groupSelection(),
        disabled: selection.length < 2,
      },
      {
        label: "Ungroup selection",
        action: () => groupSelection(true),
        disabled: !selection.length,
      },
      {
        label: "Center selection on page",
        action: alignSelection,
        disabled: !selection.length,
      },
      {
        label: "Undo",
        action: undo,
        disabled: !history.current?.canUndo,
        shortcut: "Ctrl+Z",
      },
      {
        label: "Redo",
        action: redo,
        disabled: !history.current?.canRedo,
        shortcut: "Ctrl+Y",
      },
      {
        label: "Duplicate selection",
        action: duplicate,
        disabled: !selection.length,
      },
      {
        label: "Delete selection",
        action: remove,
        disabled: !selection.length,
      },
      {
        label: "Find and replace…",
        action: () => setShowFind(true),
        disabled: !p,
      },
    ],
    Insert: [
      {
        label: "Text box",
        action: () => insert("text"),
        disabled: !page?.design,
      },
      {
        label: "Image…",
        action: () => void importImage(),
        disabled: !page?.design,
      },
      {
        label: "Rectangle",
        action: () => insert("rect"),
        disabled: !page?.design,
      },
      {
        label: "Ellipse",
        action: () => insert("ellipse"),
        disabled: !page?.design,
      },
      { label: "Line", action: () => insert("line"), disabled: !page?.design },
      {
        label:
          p?.style === "hybrid" ? "Designed page before chapter" : "New page",
        action: () => addPage(),
        disabled: !p || p.style === "text",
      },
      {
        label: "New chapter",
        action: addChapter,
        disabled: !p || p.style === "picture",
      },
    ],
    View: [
      {
        label: guides ? "Hide guides" : "Show guides",
        action: () => setGuides(!guides),
      },
      { label: "Fit page", action: fit, disabled: !p },
      {
        label: facing ? "Single page" : "Facing pages",
        action: toggleFacing,
      },
      {
        label: writing ? "Print preview" : "Edit pages",
        action: () => setWriting(!writing),
        disabled: !p || p.style === "picture",
      },
      {
        label: "Restore workspace",
        action: () => {
          setLeft(true);
          setRight(true);
          setWriting(true);
          setGuides(true);
          setFacing(false);
          setLeftWidth(204);
          setRightWidth(258);
          setFitToPage(true);
        },
      },
    ],
    Book: [
      {
        label: "Add page",
        action: () => addPage(),
        disabled: !p || p.style === "text",
      },
      {
        label: "Duplicate page",
        action: () => addPage(true),
        disabled: !page?.design,
      },
      {
        label: "Delete page",
        action: deletePage,
        disabled:
          !page?.design || (p?.style === "picture" && p.pages.length === 1),
      },
      {
        label: "Move page earlier",
        action: () => movePage(-1),
        disabled: !page?.design,
      },
      {
        label: "Move page later",
        action: () => movePage(1),
        disabled: !page?.design,
      },
      {
        label: "Book settings",
        action: () => {
          setSelection([]);
          setRight(true);
        },
      },
    ],
    Publish: [
      {
        label: "Prepare reading proof…",
        action: () => setShowPublish(true),
        disabled: !p,
      },
    ],
    Help: [
      { label: "About & keyboard shortcuts", action: () => setShowHelp(true) },
    ],
  };
  const editingObject = page?.design?.objects.find((o) => o.id === editing);
  const renderPage = (pg: LayoutPage) => (
    <div
      className={`page-wrap ${pg.id === page.id ? "active" : ""}`}
      key={pg.id}
      data-page-number={pg.number}
      aria-current={pg.id === page.id ? "page" : undefined}
      onMouseDownCapture={() => {
        if (pg.id !== page.id) {
          setPageIndex(pages.findIndex((x) => x.id === pg.id));
          setSelection([]);
        }
      }}
    >
      <div className="page-caption">
        <span>{pg.kind === "design" ? "DESIGNED PAGE" : pg.chapterTitle}</span>
        <span>{String(pg.number).padStart(2, "0")}</span>
      </div>
      <PageCanvas
        p={p!}
        page={pg}
        zoom={zoom}
        guides={guides}
        selection={pg.id === page.id ? selection : []}
        onSelect={(ids) => {
          setPageIndex(pages.findIndex((x) => x.id === pg.id));
          setSelection(ids);
        }}
        onUpdate={(changes) => updatePage(pg.id, changes)}
        onEdit={(id) => {
          const o = pg.design?.objects.find((o) => o.id === id);
          if (o) {
            setEditing(id);
            setEditText(o.text);
          }
        }}
        interactive={!pan}
      />
    </div>
  );
  return (
    <div className="app">
      <header className="app-header">
        <button
          className="brand"
          onClick={() => {
            if (!p) setShowNew(true);
          }}
        >
          <span className="brand-icon">
            <BookOpen size={20} />
          </span>
          <strong>Book Designer</strong>
        </button>
        <nav className="menubar" aria-label="Application menus">
          {Object.keys(menuItems).map((name) => (
            <div key={name} className="menu-container">
              <button
                className={menu === name ? "active" : ""}
                onClick={() => setMenu(menu === name ? "" : name)}
              >
                {name}
              </button>
              {menu === name && (
                <>
                  <div className="menu-dismiss" onClick={() => setMenu("")} />
                  <div className="dropdown">
                    {menuItems[name].map((item) => (
                      <button
                        key={item.label}
                        disabled={item.disabled}
                        onClick={() => {
                          setMenu("");
                          item.action();
                        }}
                      >
                        {item.label}
                        <kbd>{item.shortcut}</kbd>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </nav>
        <div className="header-right">
          <span className="version">EARLY ACCESS · 0.1.4</span>
          {p && (
            <button
              className="primary small"
              onClick={() => setShowPublish(true)}
            >
              <Upload size={15} />
              Publish
            </button>
          )}
        </div>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}
      {!p ? (
        <main className="welcome">
          <div className="welcome-copy">
            <h1>
              Every story deserves
              <br />a beautiful home.
            </h1>
            <div className="welcome-actions">
              <button className="primary" onClick={() => setShowNew(true)}>
                <Plus size={18} />
                Create a new book
                <ArrowRight size={18} />
              </button>
              <button className="secondary" onClick={() => void open()}>
                <FolderOpen size={18} />
                Open a book
              </button>
            </div>
          </div>
          <section className="recent" aria-labelledby="recent-projects-title">
            <h2 className="section-label" id="recent-projects-title">
              RECENT PROJECTS
            </h2>
            {storage.recents().length ? (
              storage.recents().map((r) => (
                <button key={r.path} onClick={() => void open(r.path)}>
                  <BookOpen size={19} />
                  <span>
                    <strong>{r.title}</strong>
                    <small>
                      {new Date(r.modified).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              ))
            ) : (
              <p>Your books will appear here. Let’s start with a blank page.</p>
            )}
          </section>
          <div className="welcome-bottom">
            <span>IMAGINE. WRITE. DESIGN.</span>
            <span>One project. All the possibilities.</span>
          </div>
        </main>
      ) : (
        <>
          <div className="document-bar">
            <div className="document-info">
              <BookOpen size={19} />
              <strong>{p.title}</strong>
              <span>{styleNames[p.style]}</span>
            </div>
            <div className="toolbar">
              <button
                className="icon"
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
                disabled={!history.current?.canUndo}
                onClick={undo}
              >
                <Undo2 size={17} />
              </button>
              <button
                className="icon"
                aria-label="Redo"
                title="Redo (Ctrl+Y)"
                disabled={!history.current?.canRedo}
                onClick={redo}
              >
                <Redo2 size={17} />
              </button>
              <span className="divider" />
              <button
                className="icon"
                aria-label="Save book"
                title="Save (Ctrl+S)"
                onClick={() => void save()}
              >
                <Save size={17} />
              </button>
              <button
                className="text-button"
                onClick={() => setGuides(!guides)}
              >
                {guides ? <Check size={14} /> : null}Guides
              </button>
              <button className="text-button" onClick={toggleFacing}>
                {facing ? "Facing pages" : "Single page"}
              </button>
              <span className="divider" />
              <button
                className="icon"
                aria-label="Toggle navigation panel"
                onClick={() => setLeft(!left)}
              >
                <PanelLeftClose size={17} />
              </button>
              <button
                className="icon"
                aria-label="Toggle properties panel"
                onClick={() => setRight(!right)}
              >
                <PanelRightClose size={17} />
              </button>
            </div>
          </div>
          <div className="workspace">
            <aside className="tool-strip">
              {[
                [
                  MousePointer2,
                  "Select",
                  () => {
                    setPan(false);
                    setSelection([]);
                  },
                  false,
                ],
                [Type, "Insert text", () => insert("text"), !page?.design],
                [
                  ImageIcon,
                  "Insert image",
                  () => void importImage(),
                  !page?.design,
                ],
                [Square, "Insert shape", () => insert("rect"), !page?.design],
                [Minus, "Insert line", () => insert("line"), !page?.design],
                [ZoomIn, "Zoom in", () => changeZoom(zoom + 0.1), false],
                [Hand, "Hand / pan", () => setPan(!pan), false],
              ].map(([Icon, label, action, disabled], i) => {
                const I = Icon as typeof Type;
                return (
                  <button
                    key={String(label)}
                    className={i === (pan ? 6 : 0) ? "active" : ""}
                    title={String(label)}
                    aria-label={String(label)}
                    disabled={Boolean(disabled)}
                    onClick={action as () => void}
                  >
                    <I size={19} />
                  </button>
                );
              })}
              <div className="strip-bottom">
                <button
                  title="Find and replace"
                  aria-label="Find and replace"
                  onClick={() => setShowFind(true)}
                >
                  <Search size={18} />
                </button>
              </div>
            </aside>
            {left && (
              <aside className="navigation" style={{ width: navigationWidth }}>
                <div className="nav-tabs">
                  {["pages", "chapters", "assets"].map((t) => (
                    <button
                      key={t}
                      className={tab === t ? "active" : ""}
                      onClick={() => setTab(t)}
                    >
                      {t[0].toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="nav-content">
                  {tab === "pages" ? (
                    <>
                      <div className="panel-subtitle">
                        <span>{pages.length} PAGES</span>
                        <button
                          title="Add page"
                          aria-label="Add page"
                          disabled={p.style === "text"}
                          onClick={() => addPage()}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <div className="thumbnails">
                        {pages.map((pg, i) => (
                          <button
                            className={`thumbnail ${i === pageIndex ? "active" : ""}`}
                            key={pg.id}
                            onClick={() => {
                              setPageIndex(i);
                              setSelection([]);
                            }}
                            aria-label={`Go to page ${i + 1}`}
                          >
                            <div className="thumbnail-paper">
                              <Thumbnail p={p} page={pg} />
                            </div>
                            <span>
                              {i + 1}
                              <small>
                                {pg.kind === "design" ? "Designed" : "Text"}
                              </small>
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : tab === "chapters" ? (
                    <>
                      <div className="panel-subtitle">
                        <span>YOUR MANUSCRIPT</span>
                        <button
                          aria-label="Add chapter"
                          disabled={p.style === "picture"}
                          onClick={addChapter}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      {p.chapters.map((c, i) => (
                        <button
                          className={`chapter-item ${page.chapterId === c.id ? "active" : ""}`}
                          key={c.id}
                          onClick={() => {
                            setPageIndex(
                              pages.findIndex((pg) => pg.chapterId === c.id),
                            );
                            setSelection([]);
                          }}
                        >
                          <span>{String(i + 1).padStart(2, "0")}</span>
                          <strong>{c.title}</strong>
                        </button>
                      ))}
                      {p.style === "picture" && (
                        <p className="empty-note">
                          Picture books are composed one page at a time. Your
                          pages are in the Pages tab.
                        </p>
                      )}
                      {p.style === "hybrid" && (
                        <button
                          className="add-designed"
                          onClick={() => addPage()}
                        >
                          <Plus size={15} />
                          Designed page before chapter
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="panel-subtitle">
                        <span>ORIGINAL ARTWORK</span>
                        <button
                          aria-label="Import artwork"
                          disabled={!page?.design}
                          onClick={() => void importImage()}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      {Object.values(p.assets).map((a) => (
                        <button
                          key={a.id}
                          className="asset-card"
                          onClick={() => void importImage(undefined, a)}
                        >
                          <img src={`data:${a.mime};base64,${a.data}`} alt="" />
                          <strong>{a.name}</strong>
                          <small>
                            {a.width} × {a.height} px
                          </small>
                        </button>
                      ))}
                      {!Object.keys(p.assets).length && (
                        <div className="empty-note">
                          <ImageIcon size={30} />
                          <p>A home for your illustrations.</p>
                          <small>
                            Import PNG or JPEG artwork. Original files travel
                            with your book.
                          </small>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="nav-footer">
                  <span className="green-dot" />{" "}
                  {storage.native ? "LOCAL PROJECT" : "BROWSER PREVIEW"}
                </div>
              </aside>
            )}
            {left && (
              <ResizeHandle
                side="left"
                value={navigationWidth}
                min={160}
                max={maxLeft}
                onChange={setLeftWidth}
              />
            )}
            <main
              className="canvas-workspace"
              ref={workspace}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) void importImage(file);
              }}
              onPaste={(e) => {
                if (e.clipboardData.files.length) {
                  e.preventDefault();
                  void importImage(e.clipboardData.files[0]);
                }
              }}
            >
              <div className="workspace-topline">
                <span>
                  {p.style === "picture"
                    ? "THE PAGE STUDIO"
                    : page.kind === "design"
                      ? "DESIGNED PAGE"
                      : "THE WRITING ROOM"}
                </span>
                <div>
                  <button className="text-button" onClick={fit}>
                    <Maximize size={13} />
                    Fit page
                  </button>
                  {page.kind === "flow" && (
                    <button
                      className="text-button"
                      onClick={() => setWriting(!writing)}
                    >
                      <Feather size={13} />
                      {writing ? "Print preview" : "Edit pages"}
                    </button>
                  )}
                </div>
              </div>
              <div
                className={`canvas-scroll ${pan ? "panning" : ""}`}
                ref={canvasScroll}
                onMouseDown={(e) => {
                  if (!pan || e.button !== 0) return;
                  const scroll = e.currentTarget,
                    startX = e.clientX,
                    startY = e.clientY,
                    left = scroll.scrollLeft,
                    top = scroll.scrollTop;
                  const move = (event: MouseEvent) => {
                    scroll.scrollLeft = left + startX - event.clientX;
                    scroll.scrollTop = top + startY - event.clientY;
                  };
                  const stop = () => {
                    window.removeEventListener("mousemove", move);
                    window.removeEventListener("mouseup", stop);
                  };
                  window.addEventListener("mousemove", move);
                  window.addEventListener("mouseup", stop);
                  e.preventDefault();
                }}
              >
                <div className="canvas-content">
                  {p.style !== "picture" &&
                    page.kind === "flow" &&
                    writing &&
                    activeChapter && (
                      <Manuscript
                        key={activeChapter.id}
                        document={activeChapter.document}
                        title={activeChapter.title}
                        project={p}
                        chapterId={activeChapter.id}
                        pages={pages.filter(
                          (pg) => pg.chapterId === activeChapter.id,
                        )}
                        selectedPage={page.id}
                        onPage={setPageIndex}
                        zoom={zoom}
                        guides={guides}
                        editable={!pan}
                        onTitle={(title) =>
                          commit((d) => {
                            d.chapters.find(
                              (c) => c.id === activeChapter.id,
                            )!.title = title;
                          })
                        }
                        onChange={(doc) =>
                          commit((d) => {
                            d.chapters.find(
                              (c) => c.id === activeChapter.id,
                            )!.document = doc;
                          }, `manuscript-${activeChapter.id}`)
                        }
                      />
                    )}
                  {!(writing && page.kind === "flow") && (
                    <div className={`spread ${facing ? "facing" : ""}`}>
                      {visiblePages.map((pg) => renderPage(pg))}
                    </div>
                  )}
                </div>
              </div>
              <div className="canvas-bottomline">
                <span>{guides ? "— Trim edge     ··· Safe margin" : ""}</span>
                <span>
                  {page.design
                    ? "Double-click text to edit · Alt-drag bypasses snapping"
                    : writing
                      ? "Type directly on the page · Pages grow with your story"
                      : "Print preview · Choose Edit pages to write"}
                </span>
              </div>
            </main>
            {right && (
              <ResizeHandle
                side="right"
                value={inspectorWidth}
                min={240}
                max={maxRight}
                onChange={setRightWidth}
              />
            )}
            {right && (
              <Inspector
                width={inspectorWidth}
                backgroundImage={() =>
                  void importImage(undefined, undefined, true)
                }
                p={p}
                page={page}
                selection={selection}
                update={update}
                commit={commit}
                select={setSelection}
                duplicate={duplicate}
                remove={remove}
              />
            )}
          </div>
          <footer className="statusbar">
            <div>
              <button
                aria-label="Previous page"
                disabled={pageIndex === 0}
                onClick={() => {
                  setPageIndex(pageIndex - 1);
                  setSelection([]);
                }}
              >
                <ChevronLeft size={15} />
              </button>
              <span>
                Page <b>{pageIndex + 1}</b> of {pages.length}
              </span>
              <button
                aria-label="Next page"
                disabled={pageIndex >= pages.length - 1}
                onClick={() => {
                  setPageIndex(pageIndex + 1);
                  setSelection([]);
                }}
              >
                <ChevronRight size={15} />
              </button>
              <span className="divider" />
              <span>{wordCount(p).toLocaleString()} words</span>
              <span className="geometry">
                {Number(fromPoints(p.setup.width, p.setup.unit).toFixed(2))} ×{" "}
                {Number(fromPoints(p.setup.height, p.setup.unit).toFixed(2))}{" "}
                {p.setup.unit}
              </span>
            </div>
            <div
              className={saveState === "Save failed" ? "error" : "save-status"}
            >
              {saveState === "Saved" ? (
                <Check size={13} />
              ) : (
                <span className="status-dot" />
              )}
              {saveState}
            </div>
            <div className="zoom-control">
              <button
                aria-label="Zoom out"
                onClick={() => changeZoom(Math.max(0.01, zoom - 0.1))}
              >
                <Minus size={14} />
              </button>
              <input
                aria-label="Zoom"
                type="range"
                min={15}
                max={200}
                value={zoom * 100}
                onChange={(e) => changeZoom(Number(e.target.value) / 100)}
              />
              <button
                aria-label="Zoom in"
                onClick={() => changeZoom(zoom + 0.1)}
              >
                <Plus size={14} />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
            </div>
          </footer>
        </>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {showNew && (
        <NewBook
          onClose={() => setShowNew(false)}
          onCreate={async (project) => {
            load(project, "");
          }}
        />
      )}
      {leavePrompt && <SaveChanges {...leavePrompt} decide={decideLeave} />}
      {showPublish && p && (
        <Publish
          p={p}
          onClose={() => setShowPublish(false)}
          onIssue={(issue) => {
            const index = pages.findIndex((pg) => pg.id === issue.pageId);
            if (index >= 0) setPageIndex(index);
            setSelection(issue.objectId ? [issue.objectId] : []);
            setRight(true);
            setShowPublish(false);
          }}
        />
      )}
      {editingObject && (
        <div className="modal-backdrop">
          <section
            className="modal text-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Edit text box"
          >
            <header className="modal-header">
              <div>
                <span className="eyebrow">EDITABLE TEXT</span>
                <h2>{editingObject.name}</h2>
              </div>
              <Type size={22} />
            </header>
            <textarea
              autoFocus
              aria-label="Edit full text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              style={{
                fontFamily:
                  editingObject.font === "serif" ? "Book Serif" : "Book Sans",
                fontSize: Math.min(editingObject.fontSize, 36),
              }}
            />
            <p className="hint">
              All text is preserved. The page frame controls how much is
              visible.
            </p>
            <footer className="modal-footer">
              <button className="secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => {
                  update([{ id: editingObject.id, patch: { text: editText } }]);
                  setEditing(null);
                }}
              >
                Apply text
              </button>
            </footer>
          </section>
        </div>
      )}
      {showFind && (
        <div className="modal-backdrop">
          <section
            className="modal small-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Find and replace"
          >
            <header className="modal-header">
              <h2>Find & replace</h2>
              <button
                className="icon"
                aria-label="Close find"
                onClick={() => setShowFind(false)}
              >
                <X size={18} />
              </button>
            </header>
            <label>
              Find
              <input
                autoFocus
                value={find}
                onChange={(e) => setFind(e.target.value)}
              />
            </label>
            <label>
              Replace with
              <input
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
              />
            </label>
            <p className="hint">
              Case-sensitive matches within text runs and text boxes.
              Replacements are one undoable operation.
            </p>
            <footer className="modal-footer">
              <button
                className="primary"
                disabled={!p || !find}
                onClick={replaceAll}
              >
                Replace all
              </button>
            </footer>
          </section>
        </div>
      )}
      {showHelp && (
        <div className="modal-backdrop">
          <section
            className="modal small-modal"
            role="dialog"
            aria-modal="true"
            aria-label="About Book Designer"
          >
            <header className="modal-header">
              <h2>Book Designer</h2>
              <button
                className="icon"
                aria-label="Close help"
                onClick={() => setShowHelp(false)}
              >
                <X size={18} />
              </button>
            </header>
            <p>An offline book studio. Version 0.1.4.</p>
            <p>
              Ctrl+N new · Ctrl+O open · Ctrl+S save
              <br />
              Ctrl+Shift+S save copy · Ctrl+Z undo · Ctrl+Y redo
              <br />
              Ctrl+C / X / V copy, cut, paste objects
              <br />
              Arrows nudge · Shift+arrows move 10 pt
              <br />
              Shift+click multi-select · Alt+drag bypass snap
            </p>
            <p>
              PNG/JPEG originals are embedded in your project. Save keeps a
              backup beside your book.
            </p>
            <p className="hint">
              Hybrid supports stable designed-page inserts. Paragraph-anchored
              artwork, wrapping, EPUB, DOCX, covers, publisher profiles, and
              color soft proofing are upcoming milestones.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
