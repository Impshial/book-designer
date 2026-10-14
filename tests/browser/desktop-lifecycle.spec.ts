import { test, expect, type Page } from "@playwright/test";

// Exercise the desktop IPC boundary without opening native windows or dialogs.
async function desktop(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    const callbacks = new Map<number, (event: unknown) => unknown>();
    const listeners = new Map<number, string>();
    let next = 1;
    w.isTauri = true;
    w.desktopTest = {
      flags: {
        resizable: true,
        minimizable: true,
        maximizable: true,
        closable: true,
      },
      mode: "cancel",
      saved: "",
      recovery: "",
      destroyed: 0,
      calls: [],
    };
    w.__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: "main" },
        currentWebview: { label: "main" },
      },
      transformCallback: (callback: (event: unknown) => unknown) => {
        const id = next++;
        callbacks.set(id, callback);
        return id;
      },
      unregisterCallback: (id: number) => callbacks.delete(id),
      invoke: async (cmd: string, args: any) => {
        const t = w.desktopTest;
        t.calls.push(cmd);
        if (cmd === "plugin:event|listen") {
          listeners.set(args.handler, args.event);
          return args.handler;
        }
        if (cmd === "plugin:event|unlisten") {
          listeners.delete(args.eventId);
          return;
        }
        for (const key of Object.keys(t.flags)) {
          if (cmd === `plugin:window|is_${key}`) return t.flags[key];
          if (cmd === `plugin:window|set_${key}`) {
            t.flags[key] = args.value;
            return;
          }
        }
        if (cmd === "plugin:window|destroy") {
          t.destroyed++;
          return;
        }
        if (cmd === "write_recovery") {
          t.recovery = args.data;
          return;
        }
        if (cmd === "discard_recovery") {
          t.recovery = "";
          return;
        }
        if (cmd === "save_as_book" || cmd === "save_book") {
          if (t.mode === "cancel") return null;
          if (t.mode === "fail")
            throw new Error("Simulated disk write failure");
          if (t.mode === "delay")
            await new Promise<void>((resolve) => {
              t.finishSave = resolve;
            });
          t.saved = args.data;
          t.recovery = "";
          return "C:\\Books\\Editing.bookdesigner";
        }
      },
    };
    w.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
      unregisterListener: (_event: unknown, id: number) => listeners.delete(id),
    };
    w.desktopTest.close = () => {
      for (const [id, event] of listeners)
        if (event === "tauri://close-requested")
          void callbacks.get(id)?.({ event, id, payload: null });
    };
  });
  await page.goto("/");
}

test("New Book locks and restores native controls and blocks close requests", async ({
  page,
}) => {
  await desktop(page);
  await page.getByRole("button", { name: "Create a new book" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).desktopTest.flags))
    .toEqual({
      resizable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
    });
  await page.evaluate(() => {
    (window as any).desktopTest.close();
  });
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => (window as any).desktopTest.destroyed)).toBe(
    0,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).desktopTest.flags))
    .toEqual({
      resizable: true,
      minimizable: true,
      maximizable: true,
      closable: true,
    });
});

test("cancelled or failed first save never closes the book; discard keeps the saved version", async ({
  page,
}) => {
  await desktop(page);
  await page.getByRole("button", { name: "Create a new book" }).click();
  await page.getByRole("button", { name: /^Text Only/ }).click();
  await page
    .getByLabel("Book title", { exact: true })
    .fill("Desktop lifecycle");
  await page.getByRole("button", { name: "Create book", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Manuscript text" });
  await editor.fill("The saved story.");
  await page.evaluate(() => {
    (window as any).desktopTest.close();
  });
  await expect(page.getByRole("alertdialog")).toContainText(
    "hasn’t been saved",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText("wasn’t saved");
  expect(await page.evaluate(() => (window as any).desktopTest.destroyed)).toBe(
    0,
  );
  await page.evaluate(() => {
    (window as any).desktopTest.mode = "fail";
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeEnabled();
  expect(await page.evaluate(() => (window as any).desktopTest.destroyed)).toBe(
    0,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(editor).toContainText("The saved story.");
  await page.evaluate(() => {
    (window as any).desktopTest.mode = "ok";
  });
  await page.keyboard.press("Control+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await editor.fill("An unwanted change.");
  await expect
    .poll(() => page.evaluate(() => (window as any).desktopTest.recovery))
    .toContain("unwanted");
  await page.evaluate(() => {
    (window as any).desktopTest.close();
  });
  await expect(page.getByRole("alertdialog")).toContainText(
    "changed since the last time",
  );
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).desktopTest.destroyed))
    .toBe(1);
  const disk = await page.evaluate(() => ({
    saved: (window as any).desktopTest.saved,
    recovery: (window as any).desktopTest.recovery,
  }));
  expect(disk.saved).toContain("The saved story.");
  expect(disk.saved).not.toContain("unwanted");
  expect(disk.recovery).toBe("");
});

test("edits made during a save remain dirty and undo can return to the saved content", async ({
  page,
}) => {
  await desktop(page);
  await page.getByRole("button", { name: "Create a new book" }).click();
  await page.getByRole("button", { name: /^Text Only/ }).click();
  await page.getByLabel("Book title", { exact: true }).fill("Save in progress");
  await page.getByRole("button", { name: "Create book", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Manuscript text" });
  await editor.fill("First revision.");
  await page.evaluate(() => {
    (window as any).desktopTest.mode = "delay";
  });
  await page.keyboard.press("Control+s");
  await expect(page.locator(".save-status")).toHaveText("Saving…");
  await expect
    .poll(() =>
      page.evaluate(() => typeof (window as any).desktopTest.finishSave),
    )
    .toBe("function");
  await editor.fill("A later revision.");
  await page.evaluate(() => {
    (window as any).desktopTest.finishSave();
  });
  await expect(page.locator(".save-status")).toHaveText("Unsaved changes");
  expect(
    await page.evaluate(() => (window as any).desktopTest.saved),
  ).toContain("First revision.");
  await editor.press("Control+z");
  await expect(editor).toHaveText("First revision.");
  await expect(page.locator(".save-status")).toHaveText("Saved");
});
