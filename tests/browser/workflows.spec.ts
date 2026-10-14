import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("new-book preview converts units and cancellation creates no project", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create a new book" }).click();
  await expect(
    page.getByRole("heading", { name: "Create a New Book", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Book title", { exact: true }).fill("Unit test book");
  await page.getByLabel("Size preset").selectOption("custom");
  await page.getByLabel("Measurement units").selectOption("mm");
  await expect(page.getByLabel("Page width")).toHaveValue("215.9");
  await page.getByLabel("Measurement units").selectOption("in");
  await expect(page.getByLabel("Page width")).toHaveValue("8.5");
  await page.getByRole("button", { name: "Advanced page setup" }).click();
  await page.getByLabel("Artwork reaches the page edge").check();
  await expect(page.locator(".mini-bleed")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        Object.keys(localStorage).filter((k) => k.startsWith("preview:"))
          .length,
    ),
  ).toBe(0);
});
test("picture book edits, saves, reopens and exports PDF", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.screenshot({ path: "test-results/welcome.png" });
  await page.getByRole("button", { name: "Create a new book" }).click();
  await page.getByLabel("Book title", { exact: true }).fill("A picture book");
  await page.getByLabel("Initial pages").fill("3");
  await page.screenshot({ path: "test-results/new-book.png" });
  await page.getByRole("button", { name: "Create book", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Go to page 3" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Insert text", exact: true }).click();
  await page
    .getByLabel("Text box content")
    .fill("A little story, with room to grow.");
  await page.getByLabel("Object width").fill("4");
  await page.getByRole("button", { name: "Insert shape", exact: true }).click();
  await page.getByLabel("Object name").fill("Garden shape");
  await page.getByRole("button", { name: "Save book", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  const stored = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) =>
      k.startsWith("preview:"),
    )!;
    return JSON.parse(localStorage.getItem(key)!);
  });
  expect(stored.pages[0].objects).toHaveLength(2);
  expect(stored.pages[0].objects[0].width).toBe(288);
  expect(stored.pages[0].objects[0].text).toContain("A little story");
  await page.screenshot({ path: "test-results/workspace.png" });
  await page.reload();
  await page.getByRole("button", { name: /A picture book/ }).click();
  await expect(
    page.locator(".layer-name").filter({ hasText: "Garden shape" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Publish", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Prepare your book." }),
  ).toBeVisible();
  const downloads: import("@playwright/test").Download[] = [];
  page.on("download", (d) => downloads.push(d));
  await page.getByRole("button", { name: "Export draft PDF" }).click();
  await expect(page.getByRole("status")).toContainText("Saved 3 pages");
  await expect.poll(() => downloads.length).toBe(2);
  const pdf = downloads.find((d) => d.suggestedFilename().endsWith(".pdf"))!;
  await pdf.saveAs(testInfo.outputPath("proof.pdf"));
  expect(
    readFileSync(testInfo.outputPath("proof.pdf")).subarray(0, 5).toString(),
  ).toBe("%PDF-");
  expect(errors).toEqual([]);
});
for (const style of ["Text Only", "Hybrid"])
  test(`${style} manuscript reflows and keeps text after reopening`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Create a new book" }).click();
    await page.getByRole("button", { name: new RegExp(`^${style}`) }).click();
    await page.getByLabel("Book title", { exact: true }).fill(`${style} test`);
    await page
      .getByRole("button", { name: "Create book", exact: true })
      .click();
    const manuscript = page.getByRole("textbox", { name: "Manuscript text" });
    await manuscript.fill("Mira found a door in the garden. ".repeat(140));
    await expect
      .poll(() => page.locator(".statusbar").textContent())
      .toContain("980 words");
    if (style === "Hybrid") {
      await page
        .getByRole("button", {
          name: "Designed page before chapter",
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: "Pages", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Go to page 1", exact: true }),
      ).toBeVisible();
    }
    await page.getByRole("button", { name: "Save book", exact: true }).click();
    await expect(page.locator(".save-status")).toHaveText("Saved");
    await page.reload();
    await page
      .getByRole("button", { name: new RegExp(`${style} test`) })
      .click();
    const stored = await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem(
          Object.keys(localStorage).find((k) => k.startsWith("preview:"))!,
        )!,
      ),
    );
    expect(stored.chapters[0].document.content[0].content[0].text).toBe(
      "Mira found a door in the garden. ".repeat(140),
    );
  });
