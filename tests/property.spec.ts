import { test, expect } from "@playwright/test";

test.describe("Detalle de Propiedad", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
  });

  test("se muestran tarjetas de propiedades (o el placeholder)", async ({
    page,
  }) => {
    const section = page.locator("section#venta");
    await expect(section).toBeVisible();
    // Esperar a que el skeleton de carga desaparezca (los divs animate-pulse)
    await expect(section.locator(".animate-pulse").first()).not.toBeVisible({ timeout: 15000 });
    // Puede mostrar cards o el placeholder "Próximamente"
    const hasCards = await section.locator("article").count();
    const hasPlaceholder = await section.getByText(/próximamente/i).count();
    expect(hasCards + hasPlaceholder).toBeGreaterThan(0);
  });

  test("hacer clic en 'Ver propiedad' abre la vista de detalle", async ({
    page,
  }) => {
    const firstCard = page.locator("article").first();
    // Si no hay cards, saltar el test
    const count = await page.locator("article").count();
    if (count === 0) {
      test.skip();
      return;
    }

    await firstCard.getByRole("button", { name: /ver propiedad/i }).click();
    // La URL debe cambiar a #propiedad-X (IDs pueden ser UUIDs o numéricos)
    await expect(page).toHaveURL(/#propiedad-/);
  });

  test("vista de detalle carga con información de la propiedad", async ({
    page,
  }) => {
    const count = await page.locator("article").count();
    if (count === 0) {
      test.skip();
      return;
    }

    await page.locator("article").first().getByRole("button", { name: /ver propiedad/i }).click();
    await expect(page).toHaveURL(/#propiedad-/);

    // Debe haber un botón de volver
    await expect(
      page.getByRole("button", { name: /volver/i })
    ).toBeVisible();
  });

  test("botón Volver desde detalle regresa a la vista anterior", async ({
    page,
  }) => {
    const count = await page.locator("article").count();
    if (count === 0) {
      test.skip();
      return;
    }

    await page.locator("article").first().getByRole("button", { name: /ver propiedad/i }).click();
    await expect(page).toHaveURL(/#propiedad-/);

    await page.getByRole("button", { name: /volver/i }).click();

    // Debe regresar a la vista main o search
    await expect(page.locator("section#inicio").or(page.locator("h1").filter({ hasText: /resultado/i }))).toBeVisible();
  });

  test("URL directa a una propiedad abre la vista de detalle", async ({
    page,
  }) => {
    // Primero obtenemos el ID de la primera propiedad
    await page.goto("/");
    await page.waitForLoadState("load");
    const count = await page.locator("article").count();
    if (count === 0) {
      test.skip();
      return;
    }

    // Hacer clic y capturar la URL con el hash
    await page.locator("article").first().getByRole("button", { name: /ver propiedad/i }).click();
    const urlWithHash = page.url();
    const hashMatch = urlWithHash.match(/#(propiedad-[\w-]+)/);
    if (!hashMatch) {
      test.skip();
      return;
    }

    // Navegar directamente a esa URL (el hash es parte del fragmento, no la ruta)
    await page.goto(`/${hashMatch[0]}`);
    await page.waitForLoadState("load");
    await expect(page.getByRole("button", { name: /volver/i })).toBeVisible({ timeout: 10000 });
  });

  test("tarjeta tiene botón 'Consultar' con link de WhatsApp", async ({
    page,
  }) => {
    const count = await page.locator("article").count();
    if (count === 0) {
      test.skip();
      return;
    }

    const consultarLink = page
      .locator("article")
      .first()
      .getByRole("link", { name: /consultar/i });
    await expect(consultarLink).toBeVisible();
    const href = await consultarLink.getAttribute("href");
    expect(href).toContain("wa.me");
  });

  test("vista de búsqueda: click en card → detalle → volver regresa a búsqueda", async ({
    page,
  }) => {
    // Entrar a búsqueda
    await page.getByRole("button", { name: /ver ventas/i }).click();
    await expect(page.locator("h1")).toContainText(/resultado/i);

    const cards = await page.locator("article").count();
    if (cards === 0) {
      test.skip();
      return;
    }

    await page.locator("article").first().getByRole("button", { name: /ver propiedad/i }).click();
    await expect(page).toHaveURL(/#propiedad-/);

    await page.getByRole("button", { name: /volver/i }).click();

    // Debe regresar a la vista de búsqueda
    await expect(page.locator("h1")).toContainText(/resultado/i);
  });
});
