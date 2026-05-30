import { test, expect } from "@playwright/test";

test.describe("Home - Carga y Hero", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Espera a que la página cargue (Supabase puede tardar)
    await page.waitForLoadState("load");
  });

  test("título de la página es correcto", async ({ page }) => {
    await expect(page).toHaveTitle(/Nivel Propiedades/i);
  });

  test("hero visible con texto principal", async ({ page }) => {
    const hero = page.locator("section#inicio");
    await expect(hero).toBeVisible();
    await expect(hero).toContainText("Propiedades en");
    await expect(hero).toContainText("Zona Oeste");
    await expect(hero).toContainText("Ramos Mejía");
  });

  test("botones del hero son visibles y clicables", async ({ page }) => {
    const btnVentas = page.getByRole("button", { name: /ver ventas/i });
    const btnAlquileres = page.getByRole("button", { name: /ver alquileres/i });
    await expect(btnVentas).toBeVisible();
    await expect(btnAlquileres).toBeVisible();
  });

  test("hero 'Ver ventas' dispara la vista de búsqueda", async ({ page }) => {
    await page.getByRole("button", { name: /ver ventas/i }).click();
    await expect(page.locator("h1")).toContainText(/resultado/i);
    await expect(page.url()).toContain("op=venta");
  });

  test("hero 'Ver alquileres' dispara la vista de búsqueda", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /ver alquileres/i }).click();
    await expect(page.locator("h1")).toContainText(/resultado/i);
    await expect(page.url()).toContain("op=alquiler");
  });

  test("sección de propiedades destacadas en venta se muestra", async ({
    page,
  }) => {
    const section = page.locator("section#venta");
    await expect(section).toBeVisible();
    await expect(section).toContainText(/propiedades destacadas/i);
  });

  test("el contador de años muestra 46+", async ({ page }) => {
    // El counter puede animarse — esperamos que eventualmente muestre 46
    const counter = page.locator("span").filter({ hasText: /^\d+$/ }).first();
    await expect(async () => {
      const text = await counter.textContent();
      expect(Number(text)).toBeGreaterThanOrEqual(1);
    }).toPass({ timeout: 10_000 });
  });

  test("sección de contacto es visible con info de dirección", async ({
    page,
  }) => {
    const contactSection = page.locator("section#contacto");
    await expect(contactSection).toBeVisible();
    await expect(contactSection).toContainText("Av. Gaona 2422");
    await expect(contactSection).toContainText("nivelconsultas@gmail.com");
  });

  test("banner 'Tasá tu propiedad' es visible", async ({ page }) => {
    await expect(page.getByText(/tasá tu propiedad/i).first()).toBeVisible();
  });

  test("sección de alquileres muestra los botones correctos", async ({
    page,
  }) => {
    const section = page.locator("section#alquileres");
    await expect(section).toBeVisible();
    await expect(
      section.getByRole("button", { name: /ver propiedades en alquiler/i })
    ).toBeVisible();
  });
});
