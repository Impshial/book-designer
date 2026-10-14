import { useEffect, type RefObject } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { native } from "../services/storage";

// Serialize window changes so a rapidly closed/reopened modal cannot restore
// window controls belonging to the next modal.
let windowQueue = Promise.resolve();
export function useModal(
  ref: RefObject<HTMLElement | null>,
  lockWindow = false,
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const backdrop = element.closest(".modal-backdrop")!;
    const siblings = Array.from(backdrop.parentElement!.children).filter(
      (s) => s !== backdrop,
    ) as HTMLElement[];
    const previousInert = siblings.map((s) => s.inert);
    siblings.forEach((s) => {
      s.inert = true;
    });
    const focusable = () =>
      Array.from(
        element.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length > 0);
    (
      element.querySelector<HTMLElement>("input:not([readonly])") ??
      focusable()[0]
    )?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0],
        last = items.at(-1);
      if (!items.length) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    element.addEventListener("keydown", trap);
    let restore: (() => Promise<void>) | undefined;
    if (lockWindow && native) {
      windowQueue = windowQueue
        .then(async () => {
          const win = getCurrentWindow();
          const [resize, minimize, maximize, close] = await Promise.all([
            win.isResizable(),
            win.isMinimizable(),
            win.isMaximizable(),
            win.isClosable(),
          ]);
          restore = async () => {
            await win.setResizable(resize);
            await Promise.all([
              win.setMinimizable(minimize),
              win.setMaximizable(maximize),
              win.setClosable(close),
            ]);
          };
          await Promise.all([
            win.setMinimizable(false),
            win.setMaximizable(false),
            win.setClosable(false),
          ]);
          await win.setResizable(false);
        })
        .catch((error) =>
          console.error("Could not lock window controls", error),
        );
    }
    return () => {
      element.removeEventListener("keydown", trap);
      siblings.forEach((s, i) => {
        s.inert = previousInert[i];
      });
      previousFocus?.focus();
      if (lockWindow && native)
        windowQueue = windowQueue
          .then(() => restore?.())
          .catch((error) =>
            console.error("Could not restore window controls", error),
          );
    };
  }, [lockWindow, ref]);
}
