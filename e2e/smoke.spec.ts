import { expect, test } from "@playwright/test";

const WEB = "http://localhost:3000";
const ADMIN = "http://localhost:3001";

test.describe("web", () => {
  test("home renders in the default locale and in the RTL locale", async ({ page }) => {
    await page.goto(`${WEB}/en`);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto(`${WEB}/fa`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  });

  test("examples list loads from the mock API", async ({ page }) => {
    await page.goto(`${WEB}/en/examples`);
    await expect(page.getByRole("list").getByRole("listitem").first()).toBeVisible();
  });

  test("a protected page redirects to sign-in, and signing in opens it", async ({ page }) => {
    await page.goto(`${WEB}/en/account`);
    await expect(page).toHaveURL(/\/en\/login\?next=/);
    await page.getByLabel("Email").fill("user@example.com");
    await page.getByLabel("Password", { exact: true }).fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/account$/);
    await expect(page.getByText("user@example.com")).toBeVisible();
  });
});

test.describe("admin", () => {
  test("sign in, see the examples table, create and delete an entry", async ({ page }) => {
    await page.goto(`${ADMIN}/examples`);
    await expect(page).toHaveURL(/\/login\?next=/);
    await page.getByLabel("Email").fill("admin@example.com");
    await page.getByLabel("Password", { exact: true }).fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/examples$/);
    await expect(page.getByRole("table")).toBeVisible();

    await page.getByRole("button", { name: "New example" }).click();
    await page.getByLabel("Title").fill("Created by smoke test");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("cell", { name: "Created by smoke test" })).toBeVisible();

    const row = page.getByRole("row", { name: /Created by smoke test/ });
    await row.getByRole("button", { name: "Actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("cell", { name: "Created by smoke test" })).toHaveCount(0);
  });
});
