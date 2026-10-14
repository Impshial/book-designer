import { test, expect } from "@playwright/test";
test("original image bytes survive crop and project reopen", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create a new book" }).click();
  await page.getByLabel("Book title", { exact: true }).fill("Artwork proof");
  await page.getByLabel("Initial pages").fill("1");
  await page.getByRole("button", { name: "Create book", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Insert image", exact: true }).click();
  await (await chooser).setFiles("src-tauri/icons/icon.png");
  await expect(
    page.getByText("Original artwork copied into your project."),
  ).toBeVisible();
  await page.getByLabel("Object width").fill("1");
  await page.getByLabel("Crop width (%)").fill("50");
  await expect(page.locator(".quality strong")).toHaveText("128 PPI");
  await page.getByRole("button", { name: "Save book", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  const before = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem(
        Object.keys(localStorage).find((k) => k.startsWith("preview:"))!,
      )!,
    ),
  );
  expect(before.pages[0].objects[0].crop.width).toBe(0.5);
  const bytes = Object.values(before.assets)[0] as { data: string };
  expect(bytes.data.startsWith("iVBOR")).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: /Artwork proof/ }).click();
  const after = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem(
        Object.keys(localStorage).find((k) => k.startsWith("preview:"))!,
      )!,
    ),
  );
  expect(after).toEqual(before);
});
