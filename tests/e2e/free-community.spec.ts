import { expect, test } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { captureBrowserDiagnostics } from "./diagnostics";

async function latestEmail(kind: string) {
  const directory = resolve(process.cwd(), process.env.EMAIL_FILE_DIR ?? ".local-email-e2e");
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const files = (await readdir(directory).catch(() => [])).filter((file) => file.includes(kind)).sort();
    const latest = files.at(-1);
    if (latest) return JSON.parse(await readFile(resolve(directory, latest), "utf8")) as { url: string };
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`No ${kind} email was written`);
}

test("public landing and complete verified-member journey use real app boundaries", async ({ page }) => {
  const assertCleanBrowser = captureBrowserDiagnostics(page, test.info());
  const email = `member-${Date.now()}@example.com`;
  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tu lugar en Sociedad Paralela.");
    expect(await page.locator("body").evaluate((element) => getComputedStyle(element).fontSize)).toBe("18px");
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    const reducedDuration = await page.locator(".lp-copy").evaluate((element) => parseFloat(getComputedStyle(element).animationDuration));
    expect(reducedDuration).toBeLessThanOrEqual(0.00001);

    await page.getByRole("link", { name: "Abrir cuenta gratis" }).click();
    await page.getByLabel("Nombre").fill("Miembro Local");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Clave").fill("correct horse battery staple");
    await page.getByRole("button", { name: "Crear identidad" }).click();
    await expect(page).toHaveURL(/verificacion-pendiente/);
    await expect(page.getByText("Email enviado")).toBeVisible();

    const verification = await latestEmail("verification");
    await page.goto(verification.url);
    await expect(page).toHaveURL(/cuenta-verificada/);
    await page.getByRole("link", { name: "Ingresar" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Clave").fill("correct horse battery staple");
    await page.getByRole("button", { name: "Ingresar" }).click();

    await expect(page).toHaveURL(/comunidad/);
    await expect(page.getByRole("heading", { name: "Ya estás dentro." })).toBeVisible();
    await expect(page.getByText(/Sociedad Paralela existe para que humanos y agentes construyan/)).toBeVisible();
    await expect(page.content()).resolves.not.toContain("server-only-token-sentinel");
    await expect(page.content()).resolves.not.toContain("aos.markenetica.com");

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/ingresar/);
    await page.goto("/comunidad");
    await expect(page).toHaveURL(/ingresar\?next=%2Fcomunidad|ingresar\?next=\/comunidad/);
  } finally {
    await assertCleanBrowser();
  }
});

test("anonymous protected route redirects and recovery stays generic", async ({ page }) => {
  const assertCleanBrowser = captureBrowserDiagnostics(page, test.info());
  try {
    await page.goto("/comunidad");
    await expect(page).toHaveURL(/ingresar/);
    await page.goto("/recuperar");
    await page.getByLabel("Email").fill(`missing-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Solicitar enlace" }).click();
    await expect(page).toHaveURL(/recuperacion-solicitada/);
    await expect(page.getByText("Esta respuesta es igual para todos los intentos.")).toBeVisible();
  } finally {
    await assertCleanBrowser();
  }
});
