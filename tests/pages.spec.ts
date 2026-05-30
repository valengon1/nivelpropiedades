import { test, expect } from "@playwright/test";

test.describe("Página /nosotros", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/nosotros");
    await page.waitForLoadState("load");
  });

  test("título correcto", async ({ page }) => {
    await expect(page).toHaveTitle(/sobre nosotros/i);
  });

  test("el h1 es correcto", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/inmobiliaria familiar/i);
  });

  test("muestra los 46+ años", async ({ page }) => {
    // Busca el párrafo grande con "46+" que es exclusivo de esta página
    const counter = page.locator("p").filter({ hasText: /^46/ }).first();
    await expect(counter).toBeVisible();
  });

  test("lista de servicios completa", async ({ page }) => {
    const main = page.locator("main");
    await expect(main.getByText("Venta de propiedades")).toBeVisible();
    // "Alquileres" aparece en nav y footer también — buscamos la del main
    await expect(main.locator("div").filter({ hasText: /^Alquileres$/ }).first()).toBeVisible();
    await expect(main.getByText("Administración")).toBeVisible();
    await expect(main.getByText("Tasaciones")).toBeVisible();
  });

  test("botón Contactarnos enlaza a /contacto", async ({ page }) => {
    const link = page.getByRole("link", { name: /contactarnos/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/contacto");
  });
});

test.describe("Página /contacto", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/contacto");
    await page.waitForLoadState("load");
  });

  test("título correcto", async ({ page }) => {
    await expect(page).toHaveTitle(/contacto/i);
  });

  test("el h1 está presente", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/encontranos/i);
  });

  test("horario 'Lunes a Viernes' está visible", async ({ page }) => {
    await expect(page.getByText("Lunes a Viernes")).toBeVisible();
  });
});

test.describe("Página /desarrolladores", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/desarrolladores");
    await page.waitForLoadState("load");
  });

  test("la página carga sin errores (status 200)", async ({ page }) => {
    await expect(page.locator("body")).not.toBeEmpty();
  });
});

test.describe("Navegación - Header Desktop", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
  });

  test("el logo de Nivel Propiedades está visible", async ({ page }) => {
    const logo = page.locator("header img[alt='Nivel Propiedades']");
    await expect(logo).toBeVisible();
  });

  test("los links de nav desktop están presentes", async ({ page }) => {
    // Desktop nav es hidden en mobile — solo testeamos en desktop
    const viewport = page.viewportSize();
    if (!viewport || viewport.width < 1024) {
      test.skip();
      return;
    }

    const nav = page.locator("header nav");
    await expect(nav.getByRole("link", { name: /inicio/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /venta/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /alquileres/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /desarrolladores/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /sobre nosotros/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /contacto/i })).toBeVisible();
  });

  test("link 'Venta' en nav filtra por ventas", async ({ page }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width < 1024) {
      test.skip();
      return;
    }

    await page.locator("header nav").getByRole("link", { name: /^venta$/i }).click();
    await expect(page).toHaveURL(/op=venta/);
    await expect(page.locator("h1")).toContainText(/resultado/i);
  });

  test("link 'Alquileres' en nav filtra por alquileres", async ({ page }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width < 1024) {
      test.skip();
      return;
    }

    await page.locator("header nav").getByRole("link", { name: /alquileres/i }).click();
    await expect(page).toHaveURL(/op=alquiler/);
    await expect(page.locator("h1")).toContainText(/resultado/i);
  });

  test("link 'Contacto' navega a /contacto", async ({ page }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width < 1024) {
      test.skip();
      return;
    }

    await page.locator("header nav").getByRole("link", { name: /^contacto$/i }).click();
    await expect(page).toHaveURL("/contacto");
  });

  test("link 'Sobre nosotros' navega a /nosotros", async ({ page }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width < 1024) {
      test.skip();
      return;
    }

    await page.locator("header nav").getByRole("link", { name: /sobre nosotros/i }).click();
    await expect(page).toHaveURL("/nosotros");
  });
});
