import { test, expect } from "@playwright/test";

test.describe("Búsqueda y Filtros", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
  });

  test("barra de búsqueda es visible en la página principal", async ({
    page,
  }) => {
    // PropertySearch renderiza un input de texto
    const searchInput = page.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible();
  });

  test("buscar por keyword muestra la vista de resultados", async ({
    page,
  }) => {
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill("departamento");
    // Usar el botón Buscar en lugar de Enter para mayor compatibilidad mobile
    await page.getByRole("button", { name: /^buscar$/i }).click();
    await expect(page.locator("h1")).toContainText(/resultado/i);
  });

  test("la URL se actualiza al buscar por keyword", async ({ page }) => {
    const searchInput = page.locator('input[type="text"]').first();
    // Usar pressSequentially para garantizar que React capture el onChange en mobile
    await searchInput.click();
    await searchInput.pressSequentially("casa", { delay: 30 });
    // Verificar que el input tiene el valor antes de buscar
    await expect(searchInput).toHaveValue("casa");
    await page.getByRole("button", { name: /^buscar$/i }).click();
    await expect(page).toHaveURL(/q=casa/);
  });

  test("la URL de búsqueda compartida restaura los filtros", async ({
    page,
  }) => {
    await page.goto("/?op=venta#busqueda");
    await page.waitForLoadState("load");
    await expect(page.locator("h1")).toContainText(/resultado/i);
    // Debe mostrar el badge de filtro activo
    await expect(page.locator("span", { hasText: /venta/i }).first()).toBeVisible();
  });

  test("filtro por operación 'venta' actualiza la URL", async ({ page }) => {
    await page.getByRole("button", { name: /ver ventas/i }).click();
    await expect(page).toHaveURL(/op=venta/);
  });

  test("filtro por operación 'alquiler' actualiza la URL", async ({ page }) => {
    await page.getByRole("button", { name: /ver alquileres/i }).click();
    await expect(page).toHaveURL(/op=alquiler/);
  });

  test("botón Limpiar regresa a la vista principal", async ({ page }) => {
    // Primero buscar algo
    await page.getByRole("button", { name: /ver ventas/i }).click();
    await expect(page.locator("h1")).toContainText(/resultado/i);

    // Limpiar
    const clearBtn = page.getByRole("button", { name: /limpiar/i });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Debe volver a la vista main (el hero debe ser visible)
    await expect(page.locator("section#inicio")).toBeVisible();
  });

  test("contador de resultados muestra número de propiedades", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /ver ventas/i }).click();
    // El contador de resultados tiene la clase text-[#a3a3a3] y contiene "propiedad"
    const counter = page.locator("p.uppercase").filter({ hasText: /propiedad/ });
    await expect(counter).toBeVisible();
  });

  test("selector de orden por precio está disponible", async ({ page }) => {
    await page.getByRole("button", { name: /ver ventas/i }).click();
    // El sort select tiene la clase h-8 (distinta de los filtros que tienen h-11)
    const sortSelect = page.locator("select.h-8");
    await expect(sortSelect).toBeVisible();
    await sortSelect.selectOption("price-asc");
    await expect(sortSelect).toHaveValue("price-asc");
    await sortSelect.selectOption("price-desc");
    await expect(sortSelect).toHaveValue("price-desc");
  });

  test("búsqueda sin resultados muestra mensaje vacío", async ({ page }) => {
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill("xyznotexists99999");
    await searchInput.press("Enter");
    await expect(
      page.getByText(/sin resultados/i)
    ).toBeVisible();
  });
});
