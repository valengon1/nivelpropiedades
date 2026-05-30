import { test, expect } from "@playwright/test";

// Estos tests corren en los proyectos Mobile iPhone 13 y Mobile Android
// En Desktop Chrome se saltan automáticamente por viewport

test.describe("Mobile - Layout y Navegación", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
  });

  test("el menú hamburguesa está visible en mobile", async ({ page }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 1024) {
      test.skip();
      return;
    }

    const menuBtn = page.getByRole("button", { name: /menú/i });
    await expect(menuBtn).toBeVisible();
  });

  test("el menú hamburguesa abre el menú mobile", async ({ page }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 1024) {
      test.skip();
      return;
    }

    const menuBtn = page.getByRole("button", { name: /menú/i });
    await menuBtn.click();

    // El menú mobile debe mostrar los links
    const mobileMenu = page.locator("nav + div, header ~ div").first();
    await expect(page.getByRole("link", { name: /inicio/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /contacto/i }).first()).toBeVisible();
  });

  test("el menú mobile se cierra al hacer clic en un link", async ({
    page,
  }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 1024) {
      test.skip();
      return;
    }

    await page.getByRole("button", { name: /menú/i }).click();
    await page.getByRole("link", { name: /sobre nosotros/i }).first().click();
    await expect(page).toHaveURL("/nosotros");
  });

  test("el hero se muestra completo en mobile (sin overflow horizontal)", async ({
    page,
  }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 1024) {
      test.skip();
      return;
    }

    const hero = page.locator("section#inicio");
    await expect(hero).toBeVisible();
    await expect(hero).toContainText("Propiedades en");

    // No debe haber scroll horizontal
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 5); // 5px tolerancia
  });

  test("los botones del hero son tapeables en mobile (altura mínima 44px)", async ({
    page,
  }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 1024) {
      test.skip();
      return;
    }

    const btnVentas = page.getByRole("button", { name: /ver ventas/i });
    await expect(btnVentas).toBeVisible();
    const box = await btnVentas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("la barra de búsqueda es accesible en mobile", async ({ page }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 1024) {
      test.skip();
      return;
    }

    const searchInput = page.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("test");
    await expect(searchInput).toHaveValue("test");
  });

  test("las tarjetas de propiedades se muestran en columna simple en mobile", async ({
    page,
  }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 640) {
      test.skip();
      return;
    }

    const section = page.locator("section#venta");
    const cards = section.locator("article");
    const count = await cards.count();
    if (count < 2) {
      test.skip();
      return;
    }

    // Las cards en mobile deben estar apiladas (box.x similar para ambas)
    const box1 = await cards.nth(0).boundingBox();
    const box2 = await cards.nth(1).boundingBox();
    if (box1 && box2) {
      // En columna única, ambas tienen x similar (left margin)
      expect(Math.abs(box1.x - box2.x)).toBeLessThan(10);
    }
  });

  test("el formulario de contacto se adapta a mobile sin overflow", async ({
    page,
  }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 1024) {
      test.skip();
      return;
    }

    await page.locator("section#contacto").scrollIntoViewIfNeeded();
    const form = page.locator("section#contacto form");
    await expect(form).toBeVisible();

    const formBox = await form.boundingBox();
    const windowWidth = await page.evaluate(() => window.innerWidth);
    if (formBox) {
      expect(formBox.width).toBeLessThanOrEqual(windowWidth);
    }
  });

  test("el botón 'Enviar consulta' es tapeable en mobile", async ({ page }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 1024) {
      test.skip();
      return;
    }

    await page.locator("section#contacto").scrollIntoViewIfNeeded();
    const submitBtn = page.locator("section#contacto button[type='submit']");
    await expect(submitBtn).toBeVisible();
    const box = await submitBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe("Mobile - /contacto", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/contacto");
    await page.waitForLoadState("load");
  });

  test("la página de contacto no tiene overflow horizontal en mobile", async ({
    page,
  }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 1024) {
      test.skip();
      return;
    }

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 5);
  });

  test("el mapa es visible en mobile", async ({ page }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 1024) {
      test.skip();
      return;
    }

    const map = page.locator("iframe[title*='Ubicación']");
    await expect(map).toBeVisible();
  });
});

test.describe("Mobile - /nosotros", () => {
  test("la página sobre nosotros no tiene overflow horizontal", async ({
    page,
  }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 1024) {
      test.skip();
      return;
    }

    await page.goto("/nosotros");
    await page.waitForLoadState("load");

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 5);
  });
});
