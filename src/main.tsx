import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { loadFonts } from "./core/fonts";
import "./styles.css";
const root = createRoot(document.getElementById("root")!);
root.render(
  <div className="loading">
    <span className="brand-icon">B</span>
    <p>Opening your book studio…</p>
  </div>,
);
loadFonts()
  .then(() =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
  .catch((error) =>
    root.render(
      <div className="loading">
        <h2>Book Designer could not load its fonts.</h2>
        <p>{String(error)}</p>
        <button onClick={() => location.reload()}>Try again</button>
      </div>,
    ),
  );
