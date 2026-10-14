import { test, expect } from "@playwright/test";
import source from "../fixtures/book-size-presets.json" with { type: "json" };

for (const [style, workbookStyle] of [
  ["Picture Book", "Picture Book"],
  ["Hybrid", "Hybrid"],
  ["Text Only", "Text-only / Novel"],
]) {
  test(`${style} lists only its workbook presets and applies their exact dimensions`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Create a new book" }).click();
    await page.getByRole("button", { name: new RegExp(`^${style}`) }).click();
    const rows = source.filter((row) => row.style === workbookStyle);
    const preset = page.getByLabel("Size preset");
    const options = preset.locator("option");
    expect(await options.allTextContents()).toEqual([
      ...rows.map(
        (row) =>
          `${row.name} - ${row.widthInches} x ${row.heightInches} - ${row.name === "Standard Square" ? "Recommended size for picture books" : row.description}`,
      ),
      "Custom size",
    ]);
    await expect(preset.locator("option:checked")).toContainText(
      rows.find((row) => row.default)!.name,
    );
    await expect(page.getByLabel("Page width")).toHaveCount(0);
    await expect(page.getByLabel("Page height")).toHaveCount(0);
    for (let index = 0; index < rows.length; index++) {
      await preset.selectOption({ index });
      await preset.selectOption("custom");
      await expect(page.getByLabel("Page width")).toHaveValue(
        String(rows[index].widthInches),
      );
      await expect(page.getByLabel("Page height")).toHaveValue(
        String(rows[index].heightInches),
      );
    }
    await preset.selectOption({ index: rows.length - 1 });
    const selection = await preset.inputValue();
    await page.getByLabel("Measurement units").selectOption("mm");
    await expect(preset).toHaveValue(selection);
    const last = rows.at(-1)!;
    const mm = (value: number) => Number((value * 25.4).toFixed(1));
    await expect(preset.locator("option:checked")).toContainText(
      `${mm(last.widthInches)} x ${mm(last.heightInches)}`,
    );
    await page
      .getByLabel("Book title", { exact: true })
      .fill(`${style} preset`);
    await page
      .getByRole("button", { name: "Create book", exact: true })
      .click();
    await expect(page.locator(".save-status")).toHaveText("Not saved yet");
    expect(
      await page.evaluate(
        () =>
          Object.keys(localStorage).filter((key) => key.startsWith("preview:"))
            .length,
      ),
    ).toBe(0);
    await page.getByRole("button", { name: "Save book", exact: true }).click();
    await expect(page.locator(".save-status")).toHaveText("Saved");
    const setup = await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem(
            Object.keys(localStorage).find((key) =>
              key.startsWith("preview:"),
            )!,
          )!,
        ).setup,
    );
    expect(setup.width).toBeCloseTo(last.widthInches * 72, 8);
    expect(setup.height).toBeCloseTo(last.heightInches * 72, 8);
    expect(setup.unit).toBe("mm");
  });
}

test("custom size, simplified content and full-width controls work in the modal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 960 });
  await page.goto("/");
  await page.getByRole("button", { name: "Create a new book" }).click();
  const dialog = page.getByRole("dialog", { name: "Create a New Book" });
  await expect(
    dialog.getByText(
      /Save location|A NEW BEGINNING|One page is one side|The size of one interior page|A blank page, full of possibility|You can change these settings later/,
    ),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", {
      name: /Browse|Landscape|Portrait|Save later/,
    }),
  ).toHaveCount(0);
  const sizeBox = (await page.getByLabel("Size preset").boundingBox())!;
  const unitsBox = (await page.getByLabel("Measurement units").boundingBox())!;
  const formBox = (await page.locator(".new-settings").boundingBox())!;
  expect(sizeBox.width).toBeGreaterThan(formBox.width - 80);
  expect(unitsBox.y).toBeGreaterThan(sizeBox.y + sizeBox.height);
  const bounds = await dialog.boundingBox();
  await page.getByLabel("Size preset").selectOption("custom");
  expect(await dialog.boundingBox()).toEqual(bounds);
  await page.getByLabel("Book title", { exact: true }).fill("Custom page");
  await page.getByLabel("Page width").fill("7.6");
  await page.getByLabel("Page height").fill("9.4");
  await page.getByLabel("Measurement units").selectOption("mm");
  await expect(page.getByLabel("Page width")).toHaveValue("193.04");
  await expect(page.getByLabel("Page height")).toHaveValue("238.76");
  await page.getByLabel("Measurement units").selectOption("in");
  await page.getByLabel("Page width").fill("");
  await expect(
    page.getByRole("button", { name: "Create book", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Page width").fill("7.6");
  await expect(
    page.getByRole("button", { name: "Create book", exact: true }),
  ).toBeEnabled();
  await page.screenshot({ path: "test-results/new-book-custom.png" });
  await page.getByLabel("Initial pages").fill("0");
  await page.getByRole("button", { name: /^Hybrid/ }).click();
  await expect(page.getByLabel("Size preset")).toHaveValue(
    "standard-illustrated-book",
  );
  await expect(page.getByLabel("Page width")).toHaveCount(0);
  await expect(page.getByLabel("Book title", { exact: true })).toHaveValue(
    "Custom page",
  );
  await expect(
    page.getByRole("button", { name: "Create book", exact: true }),
  ).toBeEnabled();
  await page.screenshot({ path: "test-results/new-book-presets.png" });
});
