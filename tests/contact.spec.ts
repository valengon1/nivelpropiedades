import { test, expect } from "@playwright/test";

test.describe("Formulario de Contacto (home)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    // Scroll a la sección de contacto
    await page.locator("section#contacto").scrollIntoViewIfNeeded();
  });

  test("el formulario de contacto es visible", async ({ page }) => {
    const form = page.locator("section#contacto form");
    await expect(form).toBeVisible();
  });

  test("campo Nombre está presente y es requerido", async ({ page }) => {
    const input = page.locator("#formName");
    await expect(input).toBeVisible();
    const required = await input.getAttribute("required");
    expect(required).not.toBeNull();
  });

  test("campo Teléfono está presente y es requerido", async ({ page }) => {
    const input = page.locator("#formPhone");
    await expect(input).toBeVisible();
    const required = await input.getAttribute("required");
    expect(required).not.toBeNull();
  });

  test("campo Email está presente (opcional)", async ({ page }) => {
    const input = page.locator("#formEmail");
    await expect(input).toBeVisible();
    const required = await input.getAttribute("required");
    expect(required).toBeNull();
  });

  test("select Motivo está presente y es requerido", async ({ page }) => {
    const select = page.locator("#formReason");
    await expect(select).toBeVisible();
    const required = await select.getAttribute("required");
    expect(required).not.toBeNull();
  });

  test("campo Mensaje está presente (opcional)", async ({ page }) => {
    const textarea = page.locator("#formMessage");
    await expect(textarea).toBeVisible();
  });

  test("botón Enviar consulta está presente", async ({ page }) => {
    const btn = page.locator("section#contacto button[type='submit']");
    await expect(btn).toBeVisible();
    await expect(btn).toContainText(/enviar/i);
  });

  test("la validación HTML impide envío sin nombre", async ({ page }) => {
    const submitBtn = page.locator("section#contacto button[type='submit']");
    await submitBtn.click();

    // El campo nombre debe mostrar validación nativa del browser
    const nameInput = page.locator("#formName");
    const isValid = await nameInput.evaluate(
      (el: HTMLInputElement) => el.validity.valid
    );
    expect(isValid).toBe(false);
  });

  test("la validación HTML impide envío sin motivo seleccionado", async ({
    page,
  }) => {
    await page.locator("#formName").fill("Test Usuario");
    await page.locator("#formPhone").fill("1122334455");

    const submitBtn = page.locator("section#contacto button[type='submit']");
    await submitBtn.click();

    const reasonSelect = page.locator("#formReason");
    const isValid = await reasonSelect.evaluate(
      (el: HTMLSelectElement) => el.validity.valid
    );
    expect(isValid).toBe(false);
  });

  test("el select Motivo tiene las opciones correctas", async ({ page }) => {
    const select = page.locator("#formReason");
    const options = await select.locator("option").allTextContents();
    expect(options).toContain("Quiero vender");
    expect(options).toContain("Quiero tasar");
    expect(options).toContain("Busco propiedad para comprar");
    expect(options).toContain("Busco propiedad para alquilar");
  });

  test("la sección de contacto muestra info correcta", async ({ page }) => {
    const section = page.locator("section#contacto");
    await expect(section).toContainText("Av. Gaona 2422");
    await expect(section).toContainText("4654-0122");
    await expect(section).toContainText("nivelconsultas@gmail.com");
  });
});

test.describe("Página /contacto", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/contacto");
    await page.waitForLoadState("load");
  });

  test("la página de contacto carga correctamente", async ({ page }) => {
    await expect(page).toHaveTitle(/contacto/i);
    await expect(page.locator("h1")).toContainText(/encontranos/i);
  });

  test("muestra los datos de contacto", async ({ page }) => {
    const main = page.locator("main");
    await expect(main.getByText("11 6683-8275").first()).toBeVisible();
    await expect(main.getByText("4654-0122").first()).toBeVisible();
    await expect(main.getByText("nivelconsultas@gmail.com").first()).toBeVisible();
    await expect(main.getByText(/Av. Gaona 2422/).first()).toBeVisible();
  });

  test("muestra los horarios de atención", async ({ page }) => {
    await expect(page.getByText(/lunes a viernes/i)).toBeVisible();
    await expect(page.getByText(/10:00/i)).toBeVisible();
  });

  test("el mapa de Google Maps está presente", async ({ page }) => {
    const map = page.locator("iframe[title*='Ubicación']");
    await expect(map).toBeVisible();
  });

  test("el link de WhatsApp apunta al número correcto", async ({ page }) => {
    const waLink = page.locator("a[href*='wa.me']").first();
    await expect(waLink).toBeVisible();
    const href = await waLink.getAttribute("href");
    expect(href).toContain("5491166838275");
  });
});
