const { chromium } = require("playwright");

/**
 * Script de debugging para inspeccionar la página de login de RNDC
 */
async function debugLogin() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  try {
    const loginUrl =
      process.env.RNDC_LOGIN_URL ||
      "https://rndc.mintransporte.gov.co/MenuPrincipal/tabid/204/language/es-MX/Default.aspx";

    console.log("📍 Navigating to:", loginUrl);

    await page.goto(loginUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // Esperar carga completa
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {
      console.log("⚠️  Page didn't reach networkidle, continuing anyway");
    });

    console.log("✅ Page loaded");
    console.log("📄 Current URL:", page.url());
    console.log("📝 Page title:", await page.title());

    // Tomar screenshot
    await page.screenshot({ path: "/downloads/debug-page.png" });
    console.log("📸 Screenshot saved to /downloads/debug-page.png");

    // Buscar campos de input
    console.log("\n🔍 Looking for input fields...");

    const allInputs = await page.$$eval("input", (inputs) =>
      inputs.map((input) => ({
        type: input.type,
        id: input.id,
        name: input.name,
        placeholder: input.placeholder,
        class: input.className,
      }))
    );

    console.log(`Found ${allInputs.length} input fields:`);
    allInputs.forEach((input, idx) => {
      console.log(`  ${idx + 1}. Type: ${input.type}`);
      if (input.id) console.log(`     ID: ${input.id}`);
      if (input.name) console.log(`     Name: ${input.name}`);
      if (input.placeholder) console.log(`     Placeholder: ${input.placeholder}`);
      if (input.class) console.log(`     Class: ${input.class}`);
      console.log("");
    });

    // Buscar botones
    console.log("\n🔍 Looking for buttons...");

    const allButtons = await page.$$eval(
      'button, input[type="submit"], input[type="button"]',
      (buttons) =>
        buttons.map((btn) => ({
          tag: btn.tagName,
          type: btn.type,
          id: btn.id,
          name: btn.name,
          text: btn.textContent?.trim() || btn.value,
          class: btn.className,
        }))
    );

    console.log(`Found ${allButtons.length} buttons:`);
    allButtons.forEach((btn, idx) => {
      console.log(`  ${idx + 1}. Tag: ${btn.tag}, Type: ${btn.type}`);
      if (btn.id) console.log(`     ID: ${btn.id}`);
      if (btn.name) console.log(`     Name: ${btn.name}`);
      if (btn.text) console.log(`     Text: ${btn.text}`);
      if (btn.class) console.log(`     Class: ${btn.class}`);
      console.log("");
    });

    // Buscar selectores
    console.log("\n🔍 Looking for select fields...");

    const allSelects = await page.$$eval("select", (selects) =>
      selects.map((select) => ({
        id: select.id,
        name: select.name,
        optionCount: select.options.length,
      }))
    );

    console.log(`Found ${allSelects.length} select fields:`);
    allSelects.forEach((select, idx) => {
      console.log(`  ${idx + 1}. ID: ${select.id || "N/A"}`);
      console.log(`     Name: ${select.name || "N/A"}`);
      console.log(`     Options: ${select.optionCount}`);
      console.log("");
    });

    // Guardar HTML completo
    const html = await page.content();
    const fs = require("fs");
    fs.writeFileSync("/downloads/debug-page.html", html, "utf-8");
    console.log("💾 Full HTML saved to /downloads/debug-page.html");

    console.log("\n✅ Debug completed successfully");
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

debugLogin();
