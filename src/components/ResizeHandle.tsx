import { useRef } from "react";

export function ResizeHandle({
  side,
  value,
  min,
  max,
  onChange,
}: {
  side: "left" | "right";
  value: number;
  min: number;
  max: number;
  onChange: (width: number) => void;
}) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const set = (width: number) => onChange(Math.max(min, Math.min(max, width)));
  return (
    <div
      className="pane-resizer"
      role="separator"
      aria-label={`Resize ${side} pane`}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}
      tabIndex={0}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        drag.current = { x: e.clientX, width: value };
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        if (drag.current)
          set(
            drag.current.width +
              (e.clientX - drag.current.x) * (side === "left" ? 1 : -1),
          );
      }}
      onPointerUp={(e) => {
        drag.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
      onKeyDown={(e) => {
        if (e.key === "Home") {
          set(min);
          e.preventDefault();
        } else if (e.key === "End") {
          set(max);
          e.preventDefault();
        } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          set(
            value +
              (e.key === "ArrowRight" ? 1 : -1) *
                (side === "left" ? 1 : -1) *
                (e.shiftKey ? 30 : 10),
          );
          e.preventDefault();
        }
      }}
    />
  );
}
