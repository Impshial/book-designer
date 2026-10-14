import { useRef, useState } from "react";
import { useModal } from "./useModal";
export function SaveChanges({
  title,
  neverSaved,
  decide,
}: {
  title: string;
  neverSaved: boolean;
  decide: (choice: "save" | "discard" | "cancel") => Promise<boolean>;
}) {
  const ref = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useModal(ref);
  async function choose(choice: "save" | "discard" | "cancel") {
    setBusy(true);
    const ok = await decide(choice);
    setBusy(false);
    setFailed(!ok && choice !== "cancel");
  }
  return (
    <div
      className="modal-backdrop"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) void choose("cancel");
      }}
    >
      <section
        ref={ref}
        className="modal save-changes"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="save-changes-title"
        aria-describedby="save-changes-description"
      >
        <header className="modal-header">
          <h2 id="save-changes-title">
            {neverSaved ? "Save your new book?" : "Save your changes?"}
          </h2>
        </header>
        <div className="save-changes-body">
          <p id="save-changes-description">
            {neverSaved
              ? `“${title}” hasn’t been saved. Save it before leaving, or discard it if you don’t want to keep it.`
              : `“${title}” has changed since the last time you saved it. Would you like to save your changes?`}
          </p>
          {failed && (
            <p role="alert" className="error">
              The book wasn’t saved. Your work is still open. Try saving again
              or choose Cancel.
            </p>
          )}
        </div>
        <footer className="modal-footer">
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void choose("cancel")}
          >
            Cancel
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void choose("discard")}
          >
            Discard
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void choose("save")}
          >
            {busy ? "Please wait…" : "Save"}
          </button>
        </footer>
      </section>
    </div>
  );
}
