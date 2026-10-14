import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

async function create(page: Page, count = 5) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create a new book" }).click();
  await page
    .getByLabel("Book title", { exact: true })
    .fill("Picture workspace");
  await page.getByLabel("Initial pages").fill(String(count));
  await page.getByRole("button", { name: "Create book", exact: true }).click();
}
async function fits(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const scroll = document.querySelector(".canvas-scroll")!;
        const viewport = scroll.getBoundingClientRect();
        return (
          [...document.querySelectorAll(".spread .page-canvas")].every((el) => {
            const r = el.getBoundingClientRect();
            return (
              r.left >= viewport.left &&
              r.right <= viewport.right &&
              r.top >= viewport.top &&
              r.bottom <= viewport.bottom
            );
          }) &&
          scroll.scrollWidth <= scroll.clientWidth &&
          scroll.scrollHeight <= scroll.clientHeight
        );
      }),
    )
    .toBe(true);
}
async function stored(page: Page) {
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

test("fit follows resizable panes and facing pages keep stable pairs with the right page active", async ({
  page,
}) => {
  await create(page);
  await page.getByRole("button", { name: "Fit page", exact: true }).click();
  await fits(page);
  const left = page.getByRole("separator", { name: "Resize left pane" });
  const before = (await page.locator(".navigation").boundingBox())!.width;
  const handle = (await left.boundingBox())!;
  await page.mouse.move(handle.x + 3, handle.y + 100);
  await page.mouse.down();
  await page.mouse.move(handle.x + 83, handle.y + 100, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => (await page.locator(".navigation").boundingBox())!.width)
    .toBeGreaterThan(before + 70);
  const right = page.getByRole("separator", { name: "Resize right pane" });
  const beforeRight = (await page.locator(".inspector").boundingBox())!.width;
  await right.focus();
  await right.press("Shift+ArrowLeft");
  await expect
    .poll(async () => (await page.locator(".inspector").boundingBox())!.width)
    .toBeCloseTo(beforeRight + 30, 0);
  await fits(page);
  await page.getByRole("button", { name: "Single page", exact: true }).click();
  await page.getByRole("button", { name: "Go to page 2", exact: true }).click();
  expect(
    await page
      .locator(".spread .page-wrap")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-page-number"))),
  ).toEqual(["1", "2"]);
  await expect(page.locator('.page-wrap[aria-current="page"]')).toHaveAttribute(
    "data-page-number",
    "2",
  );
  await fits(page);
  await page.getByRole("button", { name: "Insert text", exact: true }).click();
  await page
    .getByLabel("Text box content")
    .fill("This belongs to the right hand page");
  const saved = await stored(page);
  expect(saved.pages[0].objects).toHaveLength(0);
  expect(saved.pages[1].objects[0].text).toBe(
    "This belongs to the right hand page",
  );
  await page.getByRole("button", { name: "Go to page 4", exact: true }).click();
  expect(
    await page
      .locator(".spread .page-wrap")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-page-number"))),
  ).toEqual(["3", "4"]);
  await page.getByRole("button", { name: "Go to page 5", exact: true }).click();
  await expect(page.locator(".spread .page-wrap")).toHaveCount(1);
  await fits(page);
  await page.setViewportSize({ width: 960, height: 640 });
  await fits(page);
  await page.screenshot({ path: "test-results/picture-fit-small.png" });
  await page.reload();
  await page.getByRole("button", { name: /Picture workspace/ }).click();
  await expect(left).toHaveAttribute(
    "aria-valuenow",
    String(Math.round(Math.min(before + 80, 960 * 0.3))),
  );
  await page.setViewportSize({ width: 2000, height: 1400 });
  await page.getByRole("button", { name: "Fit page", exact: true }).click();
  await fits(page);
  await expect
    .poll(() =>
      page
        .locator(".zoom-control > span")
        .innerText()
        .then((v) => parseInt(v)),
    )
    .toBeGreaterThan(150);
});

test("text labels follow six words and typography and color precede geometry", async ({
  page,
}) => {
  await create(page, 1);
  await page.getByRole("button", { name: "Insert text", exact: true }).click();
  await page
    .getByLabel("Text box content")
    .fill("One two three four five six seven eight");
  await expect(page.getByLabel("Object name")).toHaveValue(
    "One two three four five six…",
  );
  await expect(page.locator(".layer-name")).toContainText(
    "One two three four five six…",
  );
  const positions = await page.evaluate(() => {
    const text = [...document.querySelectorAll(".inspector .section-label")];
    const color = document.querySelector<HTMLInputElement>(
      '.inspector input[type="color"]',
    )!;
    return {
      type: text
        .find((e) => e.textContent === "TYPOGRAPHY")!
        .getBoundingClientRect().top,
      color: color.getBoundingClientRect().top,
      geometry: text
        .find((e) => e.textContent === "POSITION & SIZE")!
        .getBoundingClientRect().top,
    };
  });
  expect(positions.type).toBeLessThan(positions.color);
  expect(positions.color).toBeLessThan(positions.geometry);
  await page.getByLabel("Text box content").fill("Short text");
  await expect(page.getByLabel("Object name")).toHaveValue("Short text");
  const saved = await stored(page);
  expect(saved.pages[0].objects[0].name).toBe("Short text");
  await page.screenshot({ path: "test-results/picture-typography.png" });
});

test("background pictures and expandable number formatting survive save, reopen and PDF export", async ({
  page,
}, info) => {
  await create(page, 2);
  await page.getByLabel("Height (in)", { exact: true }).fill("5.5");
  await page.getByLabel("Page numbers", { exact: true }).check();
  await page.getByText("Page number formatting", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Number format", exact: true })
    .selectOption("ROMAN");
  await page.getByLabel("Start at", { exact: true }).fill("7");
  await page.getByLabel("Number typeface").selectOption("serif");
  await page.getByLabel("Number size (pt)").fill("18");
  await page.getByLabel("Number color").fill("#552244");
  await page.getByLabel("Bold numbers").check();
  await page
    .getByRole("combobox", { name: "Placement", exact: true })
    .selectOption("top");
  await page.getByLabel("Page number alignment").selectOption("outside");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose background picture" }).click();
  await (await chooser).setFiles("src-tauri/icons/icon.png");
  await expect(
    page.getByRole("button", { name: "Replace background picture" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const K = (window as any).Konva;
        const s = K.stages.find((s: any) => s.container().isConnected);
        return s.findOne(".page-background")?.width();
      }),
    )
    .toBeCloseTo(612, 0);
  await page.getByLabel("Background picture fit").selectOption("contain");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const K = (window as any).Konva;
        return K.stages
          .find((s: any) => s.container().isConnected)
          .findOne(".page-background")
          ?.width();
      }),
    )
    .toBeCloseTo(396, 0);
  const saved = await stored(page);
  expect(saved.pages[0].objects).toHaveLength(0);
  expect(saved.pages[0].backgroundImage.fit).toBe("contain");
  expect(saved.assets[saved.pages[0].backgroundImage.assetId].data).toBe(
    readFileSync("src-tauri/icons/icon.png").toString("base64"),
  );
  expect(saved.setup.numberStyle).toMatchObject({
    start: 7,
    format: "ROMAN",
    font: "serif",
    size: 18,
    bold: true,
    color: "#552244",
    vertical: "top",
  });
  await page.getByRole("button", { name: "Remove background picture" }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Replace background picture" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Picture workspace/ }).click();
  await expect(page.getByLabel("Background picture fit")).toHaveValue(
    "contain",
  );
  await page.getByText("Page number formatting", { exact: true }).click();
  await expect(page.getByLabel("Number size (pt)")).toHaveValue("18");
  await page.screenshot({
    path: "test-results/picture-background-numbers.png",
  });
  await page
    .getByRole("button", { name: "Publish", exact: true })
    .last()
    .click();
  const downloads: import("@playwright/test").Download[] = [];
  page.on("download", (d) => downloads.push(d));
  await page.getByRole("button", { name: "Export draft PDF" }).click();
  await expect(page.getByRole("status")).toContainText("Saved 2 pages");
  await expect.poll(() => downloads.length).toBe(2);
  await downloads
    .find((d) => d.suggestedFilename().endsWith(".pdf"))!
    .saveAs("test-results/picture-background-numbers.pdf");
});
