import { useState } from "react";
import {
  X,
  Download,
  CheckCircle2,
  AlertTriangle,
  Info,
  FileText,
  ChevronRight,
} from "lucide-react";
import type { Project } from "../core/model";
import { preflight, type Issue } from "../core/preflight";
import { exportPdf } from "../core/pdf";
import { savePdf } from "../services/storage";
export function Publish({
  p,
  onClose,
  onIssue,
}: {
  p: Project;
  onClose: () => void;
  onIssue: (issue: Issue) => void;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const issues = preflight(p);
  const review = issues.filter((i) => i.severity !== "info");
  async function run() {
    setBusy(true);
    setError("");
    try {
      const result = await exportPdf(p);
      const destination = await savePdf(p.title, result.bytes, result.report);
      if (destination)
        setMessage(
          `Saved ${result.report.pageCount} pages. Inspected ${result.report.fonts.embedded} embedded font references. PDF and validation report: ${destination}`,
        );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="publish modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-title"
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">FROM YOUR DESK TO THE WORLD</span>
            <h2 id="publish-title">Prepare your book.</h2>
          </div>
          <button aria-label="Close publish" className="icon" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        <div className="publish-body">
          <aside>
            <button className="export-option active">
              <FileText />
              <span>
                <strong>Reading proof PDF</strong>
                <small>Generic RGB · individual pages</small>
              </span>
              <ChevronRight size={16} />
            </button>
            <div className="section-label">COMING IN LATER MILESTONES</div>
            {[
              "KDP print",
              "IngramSpark print",
              "Reflowable EPUB",
              "Fixed-layout EPUB",
              "Publisher package",
              "Wraparound cover",
            ].map((x) => (
              <button key={x} className="export-option unavailable" disabled>
                <span>
                  {x}
                  <small>Not yet implemented</small>
                </span>
              </button>
            ))}
          </aside>
          <div className="preflight">
            <div className="preflight-heading">
              {review.length ? (
                <AlertTriangle size={25} />
              ) : (
                <CheckCircle2 size={25} />
              )}
              <div>
                <h3>
                  {review.length
                    ? `${review.length} things to review`
                    : "Local layout checks passed"}
                </h3>
                <p>Review your pages before sharing a reading proof.</p>
              </div>
            </div>
            {issues.map((issue) => (
              <button
                className={`issue ${issue.severity}`}
                key={issue.id}
                onClick={() => {
                  if (issue.pageId) onIssue(issue);
                }}
              >
                {issue.severity === "info" ? (
                  <Info size={17} />
                ) : (
                  <AlertTriangle size={17} />
                )}
                <span>
                  <strong>{issue.title}</strong>
                  <small>{issue.detail}</small>
                </span>
                {issue.pageId && <ChevronRight size={15} />}
              </button>
            ))}
            <div className="export-note">
              <strong>A useful proof, with clear limits.</strong>
              <p>
                Text stays text and artwork keeps its original resolution. This
                RGB PDF exports at the finished page size. Printer
                specifications, color proofing, and bleed output are not
                verified.
              </p>
              <p>
                Fonts and page boxes are inspected in the completed file. A
                report is saved beside it.
              </p>
            </div>
            {message && (
              <p className="success" role="status">
                {message}
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
        <footer className="modal-footer">
          <span>Export uses a snapshot of revision {p.revision}.</span>
          <button className="secondary" onClick={onClose}>
            Back to book
          </button>
          <button
            className="primary"
            onClick={run}
            disabled={busy || issues.some((i) => i.id.startsWith("glyph-"))}
          >
            <Download size={17} />
            {busy ? "Preparing PDF…" : "Export draft PDF"}
          </button>
        </footer>
      </section>
    </div>
  );
}
