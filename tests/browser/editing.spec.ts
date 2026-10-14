import { test, expect, type Page } from "@playwright/test";

async function create(page: Page, style = "Text Only") {
  await page.goto("/");
  await page.getByRole("button", { name: "Create a new book" }).click();
  await page.getByRole("button", { name: new RegExp(`^${style}`) }).click();
  await page.getByLabel("Book title", { exact: true }).fill("Editing proof");
  if (style === "Picture Book")
    await page.getByLabel("Initial pages").fill("1");
  await page.getByRole("button", { name: "Create book", exact: true }).click();
}

test("new-book dimensions, choice order and focus stay fixed", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1000, height: 960 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button", { name: "Create a new book" }).click();
    const dialog = page.getByRole("dialog");
    const initial = await dialog.boundingBox();
    expect(
      await page.locator(".style-choice strong").allTextContents(),
    ).toEqual(["Picture Book", "Hybrid", "Text Only"]);
    for (const name of ["Hybrid", "Text Only", "Picture Book"]) {
      await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
      expect(await dialog.boundingBox()).toEqual(initial);
    }
    await page.getByRole("button", { name: "Advanced page setup" }).click();
    expect(await dialog.boundingBox()).toEqual(initial);
    await page.getByLabel("Book title", { exact: true }).fill("Start now");
    await expect(
      page.getByRole("button", { name: "Create book", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Create book", exact: true })
      .focus();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Close new book" }),
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(
      page.getByRole("button", { name: "Create book", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Control+n");
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(
      await page
        .locator(".app-header")
        .evaluate((el) => (el as HTMLElement).inert),
    ).toBe(false);
  }
});

test("long manuscripts edit on real pages and all lines stay inside the paper", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await create(page);
  const editor = page.getByRole("textbox", { name: "Manuscript text" });
  const story = "The fox followed the river through the forest. ".repeat(250);
  await editor.fill(story);
  await expect
    .poll(() => page.locator(".editor-paper").count())
    .toBeGreaterThan(3);
  await expect(page.locator(".page-canvas")).toHaveCount(0);
  await editor.press("Control+End");
  await page.keyboard.type("Last words.");
  await expect(editor).toContainText("Last words.");
  await page.getByRole("button", { name: "Save book", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  const geometry = await editor.evaluate((el) => {
    const papers = [...document.querySelectorAll(".editor-paper")].map((p) =>
      p.getBoundingClientRect(),
    );
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    const outside: { text: string; x: number; y: number }[] = [];
    let characters = 0;
    while ((node = walker.nextNode())) {
      for (let i = 0; i < (node.textContent?.length ?? 0); i++) {
        if (!node.textContent![i].trim()) continue;
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rect = range.getBoundingClientRect();
        characters++;
        if (
          !papers.some(
            (p) =>
              rect.top >= p.top &&
              rect.bottom <= p.bottom &&
              rect.left >= p.left &&
              rect.right <= p.right,
          )
        )
          outside.push({
            text: node.textContent!.slice(i, i + 20),
            x: rect.x,
            y: rect.y,
          });
      }
    }
    const scroll = document.querySelector(".canvas-scroll")!;
    return {
      outside: outside.slice(0, 5),
      characters,
      scroll: scroll.scrollTop,
      body: document.body.scrollHeight,
      viewport: innerHeight,
    };
  });
  expect(geometry.outside).toEqual([]);
  expect(geometry.characters).toBeGreaterThan(8000);
  expect(geometry.scroll).toBeGreaterThan(500);
  expect(geometry.body).toBeLessThanOrEqual(geometry.viewport);
  await expect(page.locator(".statusbar")).toContainText("Page 6 of 6");
  await page.screenshot({ path: "test-results/direct-page-editor.png" });
  await page
    .getByRole("button", { name: "Print preview", exact: true })
    .click();
  await expect(page.locator(".page-canvas")).toHaveCount(1);
  await page.getByRole("button", { name: "Edit pages", exact: true }).click();
  await expect(editor).toContainText("Last words.");
  expect(errors).toEqual([]);
});

test("formatting, paragraphs, hard breaks, lists and page navigation keep one editable document", async ({
  page,
}) => {
  await create(page);
  const editor = page.getByRole("textbox", { name: "Manuscript text" });
  await editor.click();
  await page.keyboard.type("The river road");
  await page.getByLabel("Paragraph style").selectOption("1");
  await editor.press("End");
  await editor.press("Enter");
  await page.keyboard.insertText("An ordinary paragraph. ".repeat(25));
  await editor.press("Shift+Enter");
  await page.keyboard.type("After a hard break.");
  await editor.press("Enter");
  await page
    .getByRole("button", { name: "Bulleted list", exact: true })
    .click();
  await page.keyboard.type("First item");
  await editor.press("Enter");
  await page.keyboard.type("Second item");
  await editor.press("Enter");
  await editor.press("Enter");
  await page
    .getByRole("button", { name: "Insert page break", exact: true })
    .click();
  await page.keyboard.type("A fresh page.");
  await expect(editor.locator("h1")).toHaveText("The river road");
  await expect(editor.locator("li")).toHaveCount(2);
  await expect(page.locator(".editor-paper")).toHaveCount(2);
  await page.getByRole("button", { name: "Save book", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  const alignment = await editor.evaluate(async (el) => {
    const module = "/src/core/layout.ts";
    const { layoutProject } = await import(/* @vite-ignore */ module);
    const p = JSON.parse(
      localStorage.getItem(
        Object.keys(localStorage).find((key) => key.startsWith("preview:"))!,
      )!,
    );
    const layout = layoutProject(p);
    const editor = (el as any).editor;
    const sheets = [...document.querySelectorAll(".editor-paper")].map((p) =>
      p.getBoundingClientRect(),
    );
    const zoom = sheets[0].width / p.setup.width;
    const failures: unknown[] = [];
    layout.forEach((pg: any, index: number) =>
      pg.lines.forEach((line: any) => {
        if (line.source.prefix || line.source.from === line.source.to) return;
        const rect = editor.view.coordsAtPos(line.source.from, 1);
        const x = (rect.left - sheets[index].left) / zoom;
        if (Math.abs(x - line.x) > 0.3)
          failures.push({
            x,
            expected: line.x,
            text: line.runs.map((r: any) => r.text).join(""),
          });
      }),
    );
    return failures;
  });
  expect(alignment).toEqual([]);
  await page.screenshot({ path: "test-results/formatted-pages.png" });
  const result = await editor.evaluate((el) => {
    const paragraphs = [...el.querySelectorAll("p,h1")].map((p) => ({
      text: p.textContent,
      top: p.getBoundingClientRect().top,
      bottom: p.getBoundingClientRect().bottom,
    }));
    return {
      paragraphs,
      markers: el.querySelectorAll(".page-list-marker").length,
    };
  });
  expect(result.markers).toBe(2);
  for (let i = 1; i < result.paragraphs.length; i++)
    expect(result.paragraphs[i].top).toBeGreaterThanOrEqual(
      result.paragraphs[i - 1].bottom - 1,
    );
  await page
    .getByRole("button", { name: "Previous page", exact: true })
    .click();
  await expect(editor.locator("h1")).toBeInViewport();
  await editor.press("Control+End");
  await page.keyboard.type(" More words");
  await page.keyboard.press("Control+z");
  await expect(editor).not.toContainText("More words");
  await page.keyboard.press("Control+y");
  await expect(editor).toContainText("More words");
});

test("text stays at the same scale during a frame resize and one undo restores geometry", async ({
  page,
}) => {
  await create(page, "Picture Book");
  await page.getByRole("button", { name: "Insert text", exact: true }).click();
  // Inspect the actual canvas nodes, including a live drag before mouseup.
  const state = async (anchorName = ".bottom-center") =>
    page.evaluate(async (anchorName) => {
      const Konva = (window as any).Konva;
      const stage = Konva.stages.find((s: any) => s.container().isConnected);
      const transformer = stage.findOne("Transformer");
      const text = stage.findOne(".text-content");
      const frame = text.getParent();
      const anchor = transformer.findOne(anchorName).getAbsolutePosition();
      const bounds = stage.container().getBoundingClientRect();
      return {
        sx: text.getAbsoluteScale().x,
        sy: text.getAbsoluteScale().y,
        height: frame.height(),
        width: frame.width(),
        clip: text.findOne("Group").clipWidth(),
        anchor: { x: bounds.x + anchor.x, y: bounds.y + anchor.y },
      };
    }, anchorName);
  const before = await state();
  await page.mouse.move(before.anchor.x, before.anchor.y);
  await page.mouse.down();
  await page.mouse.move(before.anchor.x, before.anchor.y + 160, { steps: 12 });
  const during = await state();
  expect(during.sx).toBeCloseTo(before.sx, 5);
  expect(during.sy).toBeCloseTo(before.sy, 5);
  await page.screenshot({ path: "test-results/resize-during-drag.png" });
  await page.mouse.up();
  expect((await state()).height).toBeGreaterThan(before.height + 100);
  await page.keyboard.press("Control+z");
  await page
    .getByRole("button", { name: "Your story starts here.", exact: false })
    .first()
    .click();
  expect((await state()).height).toBeCloseTo(before.height, 5);
  const side = await state(".middle-right");
  await page.mouse.move(side.anchor.x, side.anchor.y);
  await page.mouse.down();
  await page.mouse.move(side.anchor.x - 100, side.anchor.y, { steps: 12 });
  const narrow = await state(".middle-right");
  expect(narrow.clip).toBeLessThan(side.clip - 50);
  expect(narrow.sx).toBeCloseTo(before.sx, 5);
  expect(narrow.sy).toBeCloseTo(before.sy, 5);
  await page.mouse.up();
  await expect(page.getByLabel("Size (pt)")).toHaveValue("22");
});

test("unsaved and edited books offer Save, Discard and Cancel without automatic overwrite", async ({
  page,
}) => {
  await create(page);
  expect(
    await page.evaluate(
      () =>
        Object.keys(localStorage).filter((k) => k.startsWith("preview:"))
          .length,
    ),
  ).toBe(0);
  await expect(page.locator(".save-status")).toHaveText("Not saved yet");
  await page.keyboard.press("Control+n");
  await expect(page.getByRole("alertdialog")).toContainText(
    "hasn’t been saved",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Manuscript text" });
  await editor.fill("Keep this sentence.");
  await page.keyboard.press("Control+n");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Create a New Book");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await editor.fill("Discard this change.");
  await expect(page.locator(".save-status")).toHaveText("Unsaved changes");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).some((k) => k.startsWith("recovery:")),
      ),
    )
    .toBe(true);
  const saved = await page.evaluate(() =>
    localStorage.getItem(
      Object.keys(localStorage).find((k) => k.startsWith("preview:"))!,
    )!,
  );
  expect(saved).toContain("Keep this sentence.");
  expect(saved).not.toContain("Discard this change.");
  await page.keyboard.press("Control+n");
  await expect(page.getByRole("alertdialog")).toContainText(
    "changed since the last time",
  );
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((k) => k.startsWith("recovery:")),
    ),
  ).toBe(false);
});
