import { invoke, isTauri } from "@tauri-apps/api/core";
import { parseProject, serialize, type Project } from "../core/model";
export const native = isTauri();
export type StoredBook = { path: string; project: Project; recovered: boolean };
export type Recent = { path: string; title: string; modified: string };
export function recents(): Recent[] {
  try {
    return JSON.parse(localStorage.getItem("bd.recents") ?? "[]");
  } catch {
    return [];
  }
}
export function remember(path: string, p: Project) {
  try {
    localStorage.setItem(
      "bd.recents",
      JSON.stringify(
        [
          { path, title: p.title, modified: p.modified },
          ...recents().filter((x) => x.path !== path),
        ].slice(0, 8),
      ),
    );
  } catch {
    /* Recents are optional; saving is not. */
  }
}
export const chooseFolder = () =>
  native
    ? invoke<string | null>("choose_folder")
    : Promise.resolve("Browser preview library");
export async function createBook(folder: string, p: Project) {
  const data = serialize(p);
  let path: string;
  if (native)
    path = await invoke<string>("create_book", {
      folder,
      title: p.title,
      data,
    });
  else {
    path = `preview:${p.id}`;
    localStorage.setItem(path, data);
  }
  remember(path, p);
  return path;
}
export async function saveBook(path: string, p: Project) {
  const data = serialize(p);
  if (native) await invoke("save_book", { path, data });
  else {
    localStorage.setItem(path, data);
    localStorage.removeItem(`recovery:${path}`);
  }
  remember(path, p);
}
export async function writeRecovery(path: string, p: Project) {
  if (native) await invoke("write_recovery", { path, data: serialize(p) });
  else localStorage.setItem(`recovery:${path}`, serialize(p));
}
export async function discardRecovery(path: string) {
  if (native) await invoke("discard_recovery", { path });
  else localStorage.removeItem(`recovery:${path}`);
}
export async function saveAsBook(p: Project) {
  if (native) {
    const path = await invoke<string | null>("save_as_book", {
      title: p.title,
      data: serialize(p),
    });
    if (path) remember(path, p);
    return path;
  }
  download(
    new TextEncoder().encode(serialize(p)),
    `${p.title}.bookdesigner`,
    "application/json",
  );
  return createBook("", p);
}
export async function openBook(
  previewPath?: string,
): Promise<StoredBook | null> {
  if (!native) {
    if (previewPath) {
      const data = localStorage.getItem(previewPath);
      if (data) {
        const recovery = localStorage.getItem(`recovery:${previewPath}`);
        if (
          recovery &&
          parseProject(recovery).revision > parseProject(data).revision &&
          confirm("A newer recovery snapshot is available. Recover it?")
        )
          return {
            path: previewPath,
            project: parseProject(recovery),
            recovered: true,
          };
        return {
          path: previewPath,
          project: parseProject(data),
          recovered: false,
        };
      }
    }
    const file = await pickFile(".bookdesigner");
    if (!file) return null;
    const p = parseProject(await file.text());
    const path = await createBook("", p);
    return { path, project: p, recovered: false };
  }
  const opened = await invoke<{
    path: string;
    data: string;
    recovery: string | null;
    backup: string | null;
  } | null>("open_book");
  if (!opened) return null;
  let project: Project | undefined;
  let recovered = false;
  try {
    project = parseProject(opened.data);
  } catch {
    /* Offer verified recovery below. */
  }
  if (opened.recovery) {
    try {
      const recovery = parseProject(opened.recovery);
      if (!project || recovery.revision > project.revision) {
        if (
          !confirm(
            "A newer recovery snapshot is available. Recover it? Cancel leaves the project closed and keeps all recovery files.",
          )
        )
          return null;
        project = recovery;
        recovered = true;
      }
    } catch {
      /* Invalid recovery never replaces a valid original. */
    }
  }
  if (!project && opened.backup) {
    project = parseProject(opened.backup);
    recovered = true;
  }
  if (!project)
    throw new Error(
      "This project and its recovery files are invalid. The original files have not been changed.",
    );
  remember(opened.path, project);
  return { path: opened.path, project, recovered };
}
export function download(bytes: Uint8Array, name: string, type: string) {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function savePdf(
  title: string,
  bytes: Uint8Array,
  report: unknown,
) {
  if (native)
    return invoke<string | null>("export_pdf", {
      title,
      bytes: Array.from(bytes),
      report: JSON.stringify(report, null, 2),
    });
  download(bytes, `${title}-proof.pdf`, "application/pdf");
  download(
    new TextEncoder().encode(JSON.stringify(report, null, 2)),
    `${title}-proof.report.json`,
    "application/json",
  );
  return "Downloads";
}
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}
export class SaveQueue {
  private queue = Promise.resolve();
  run<T>(job: () => Promise<T>): Promise<T> {
    const next = this.queue.then(job);
    this.queue = next.then(
      () => {},
      () => {},
    );
    return next;
  }
}
