import { test, expect, type Page } from "@playwright/test";

async function create(page: Page, style = "Picture Book") {
  await page.goto("/");
  await page.getByRole("button", { name: "Create a new book" }).click();
  await page.getByRole("button", { name: new RegExp(`^${style}`) }).click();
  await page.getByLabel("Book title", { exact: true }).fill("Refinement proof");
  if (style === "Picture Book")
    await page.getByLabel("Initial pages").fill("3");
  await page.getByRole("button", { name: "Create book", exact: true }).click();
}
async function saved(page: Page) {
  await page.getByRole("button", { name: "Save book", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  return page.evaluate(() =>
    JSON.parse(
      localStorage.getItem(
        Object.keys(localStorage).find((k) => k.startsWith("preview:"))!,
      )!,
    ),
  );
}

test("new hybrid fits vertically with working formatting controls in the header", async ({
  page,
}) => {
  await create(page, "Hybrid");
  for (const viewport of [
    { width: 1684, height: 1054 },
    { width: 960, height: 640 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const scroll = document.querySelector(".canvas-scroll")!;
          const paper = document
            .querySelector(".editor-paper")!
            .getBoundingClientRect();
          const bounds = scroll.getBoundingClientRect();
          return (
            scroll.scrollHeight <= scroll.clientHeight &&
            scroll.scrollWidth <= scroll.clientWidth &&
            paper.top >= bounds.top &&
            paper.bottom <= bounds.bottom &&
            paper.left >= bounds.left &&
            paper.right <= bounds.right
          );
        }),
      )
      .toBe(true);
    await expect(page.locator(".document-bar .writing-toolbar")).toBeVisible();
    await expect(page.locator(".canvas-scroll .document-controls")).toHaveCount(
      0,
    );
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  const editor = page.getByRole("textbox", { name: "Manuscript text" });
  await editor.fill("Header formatting works");
  await editor.press("Control+a");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await expect(editor.locator("strong")).toHaveText("Header formatting works");
  await page.screenshot({ path: "test-results/hybrid-header-fit.png" });
});

test("menus track hover, inspector disclosures are conditional, and thumbnails retain proportions", async ({
  page,
}) => {
  await create(page);
  await expect(page.locator(".app-header .brand-icon")).not.toHaveRole(
    "button",
  );
  await expect(page.locator(".app-header")).not.toContainText("Book Designer");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).hover();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }).last(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Book", exact: true }).hover();
  await expect(page.locator(".dropdown")).toContainText("Duplicate page");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "File", exact: true }).hover();
  await expect(page.locator(".dropdown")).toHaveCount(0);
  await expect(page.locator(".margin-settings")).not.toHaveAttribute("open");
  await expect(
    page.getByText("Page number formatting", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Page numbers", { exact: true }).check();
  await expect(
    page.getByText("Page number formatting", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Page numbers", { exact: true }).uncheck();
  await expect(
    page.getByText("Page number formatting", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".book-meta")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }),
  ).toHaveValue("Refinement proof");
  await page.getByLabel("Height (in)", { exact: true }).fill("11");
  const resize = page.getByRole("separator", { name: "Resize left pane" });
  for (const key of ["Home", "End"]) {
    await resize.focus();
    await resize.press(key);
    const ratio = await page
      .locator(".thumbnail svg")
      .first()
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.width / r.height;
      });
    expect(ratio).toBeCloseTo(8.5 / 11, 2);
  }
  expect(
    (await page.getByLabel("Page background", { exact: true }).boundingBox())!
      .height,
  ).toBeGreaterThanOrEqual(40);
});

test("left pane deletes designed and manuscript pages only after confirmation and supports undo", async ({
  page,
}) => {
  await create(page);
  await page
    .getByRole("button", { name: "Delete page 2", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toContainText("Delete page 2?");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".thumbnail")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Delete page 2", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete page", exact: true })
    .click();
  await expect(page.locator(".thumbnail")).toHaveCount(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".thumbnail")).toHaveCount(3);
  await page.reload();
  await create(page, "Hybrid");
  const editor = page.getByRole("textbox", { name: "Manuscript text" });
  await editor.fill("Keep the first page.");
  await editor.press("Control+End");
  await page
    .getByRole("button", { name: "Insert page break", exact: true })
    .click();
  await page.keyboard.type("Remove the second page.");
  await page.getByRole("button", { name: "Pages", exact: true }).click();
  await expect(page.locator(".thumbnail")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Delete page 2", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "remaining manuscript will reflow",
  );
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete page", exact: true })
    .click();
  await expect(page.locator(".thumbnail")).toHaveCount(1);
  await expect(editor).toContainText("Keep the first page.");
  await expect(editor).not.toContainText("Remove the second page.");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".thumbnail")).toHaveCount(2);
  await expect(editor).toContainText("Remove the second page.");
});

test("asset library requires deliberate placement and backgrounds apply across hybrid pages with undo", async ({
  page,
}) => {
  await create(page, "Hybrid");
  await page.getByRole("button", { name: "Assets", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Import artwork", exact: true })
    .click();
  await (await chooser).setFiles("src-tauri/icons/icon.png");
  await expect(page.locator(".asset-card")).toHaveCount(1);
  let book = await saved(page);
  expect(Object.keys(book.assets)).toHaveLength(1);
  expect(book.pages).toHaveLength(0);
  await page.getByRole("button", { name: "Pages", exact: true }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Go to page 1", exact: true }).click();
  await page.getByRole("button", { name: "Assets", exact: true }).click();
  const asset = page.locator(".asset-card");
  await asset.click();
  expect((await saved(page)).pages[0].objects).toHaveLength(0);
  await asset.dblclick();
  expect((await saved(page)).pages[0].objects).toHaveLength(1);
  await asset.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Add to page" }).click();
  expect((await saved(page)).pages[0].objects).toHaveLength(2);
  await asset.dragTo(page.locator(".page-canvas"));
  expect((await saved(page)).pages[0].objects).toHaveLength(3);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Background artwork", exact: true })
    .selectOption({ index: 1 });
  await page
    .getByLabel("Background picture fit", { exact: true })
    .selectOption("contain");
  await page
    .getByRole("button", { name: "Apply background picture to all pages" })
    .click();
  book = await saved(page);
  expect(book.chapters[0].pageBackground.backgroundImage).toEqual(
    book.pages[0].backgroundImage,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await saved(page)).chapters[0].pageBackground).toBeUndefined();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.getByLabel("Page background", { exact: true }).fill("#d9e8cb");
  await page
    .getByRole("button", { name: "Apply background color to all pages" })
    .click();
  book = await saved(page);
  expect(book.chapters[0].pageBackground.background).toBe("#d9e8cb");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await saved(page)).chapters[0].pageBackground.background).toBe(
    "#ffffff",
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await saved(page);
  await page.reload();
  await page.getByRole("button", { name: /Refinement proof/ }).click();
  await page.getByRole("button", { name: "Pages", exact: true }).click();
  await page.getByRole("button", { name: "Go to page 2", exact: true }).click();
  await expect(page.getByLabel("Page background", { exact: true })).toHaveValue(
    "#d9e8cb",
  );
  await expect(
    page.getByLabel("Background picture fit", { exact: true }),
  ).toHaveValue("contain");
  await expect(page.locator(".editor-paper")).toHaveCSS(
    "background-color",
    "rgb(217, 232, 203)",
  );
  await page.screenshot({
    path: "test-results/hybrid-background-settings.png",
  });
  await page
    .getByRole("button", { name: "Publish", exact: true })
    .last()
    .click();
  const download = page.waitForEvent("download", (d) =>
    d.suggestedFilename().endsWith(".pdf"),
  );
  await page
    .getByRole("button", { name: "Export draft PDF", exact: true })
    .click();
  await (await download).saveAs("test-results/hybrid-all-backgrounds.pdf");
});
