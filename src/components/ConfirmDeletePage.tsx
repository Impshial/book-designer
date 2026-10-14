import { useRef } from "react";
import { useModal } from "./useModal";

export function ConfirmDeletePage({
  number,
  flow,
  confirm,
  cancel,
}: {
  number: number;
  flow: boolean;
  confirm: () => void;
  cancel: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useModal(ref);
  return (
    <div
      className="modal-backdrop"
      onKeyDown={(e) => {
        if (e.key === "Escape") cancel();
      }}
    >
      <section
        ref={ref}
        className="modal save-changes"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-page-title"
        aria-describedby="delete-page-description"
      >
        <header className="modal-header">
          <h2 id="delete-page-title">Delete page {number}?</h2>
        </header>
        <div className="save-changes-body">
          <p id="delete-page-description">
            {flow
              ? "The text on this page will be deleted and the remaining manuscript will reflow."
              : "This page and all of its objects will be deleted."}{" "}
            You can undo this action.
          </p>
        </div>
        <footer className="modal-footer">
          <button className="secondary" onClick={cancel}>
            Cancel
          </button>
          <button className="primary" onClick={confirm}>
            Delete page
          </button>
        </footer>
      </section>
    </div>
  );
}
