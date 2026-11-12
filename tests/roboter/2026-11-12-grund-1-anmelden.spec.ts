// Grundablauf Anmelden (12.11.2026): jede Rolle kommt mit Benutzername + Passwort ins Dashboard, falsches Passwort
// und nicht freigeschaltete Konten nicht (Selbstregistrierung wartet auf Freigabe, zeiterfassung-und-rollen.md) –
// und ohne Anmeldung gibt die Datenbank nichts heraus.
import { expect, test } from "@playwright/test";
import { ANON, API, APP, PASSWORT, anmelden, konto, nurTestumgebung, wache, type Rolle } from "./grundtest-hilfe";

nurTestumgebung();

for (const rolle of ["administrator", "vorarbeiter", "mitarbeiter"] as Rolle[]) {
  test(`${rolle}: Anmelden mit Benutzername führt ins Dashboard`, async ({ page }) => {
    const w = wache(page);
    await anmelden(page, await konto(rolle));
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(rolle === "administrator" ? "Admin Dashboard" : "Mein Dashboard")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Zeiterfassung").first()).toBeVisible();
    await expect(page.getByText("Meine Stunden").first()).toBeVisible();
    await expect(page.getByText("Warten auf Freischaltung")).toHaveCount(0);
    // Mitarbeiter und Vorarbeiter sehen keine Zahlen – auch nicht die Kachel dazu.
    const kachel = page.getByText("Rechnungen & Angebote");
    if (rolle === "administrator") await expect(kachel.first()).toBeVisible();
    else await expect(kachel).toHaveCount(0);
    expect(w.abstuerze).toEqual([]);
    expect(w.abgelehnt).toEqual([]);
  });
}

test("Falsches Passwort: bleibt auf der Anmeldung, mit Meldung", async ({ page }) => {
  const k = await konto("mitarbeiter");
  await page.goto(`${APP}/auth`);
  await page.getByLabel("Benutzername oder E-Mail").fill(k.benutzer);
  await page.getByLabel("Passwort", { exact: true }).fill("falsch-falsch");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByText("Fehler beim Anmelden").first()).toBeVisible();
  await expect(page).toHaveURL(/\/auth/);
});

test("Ohne Anmeldung: jede Seite führt zur Anmeldung", async ({ page }) => {
  for (const pfad of ["/", "/time-tracking", "/my-hours", "/invoices", "/projects", "/bautagesberichte", "/disturbances", "/admin"]) {
    await page.goto(`${APP}${pfad}`);
    await expect(page, pfad).toHaveURL(/\/auth/);
  }
});

test("Ohne Anmeldung: die Datenbank gibt nichts heraus", async () => {
  for (const t of ["profiles", "employees", "customers", "projects", "invoices", "invoice_items", "invoice_templates",
    "invoice_payments", "time_entries", "purchase_invoices", "bautagesberichte", "disturbances", "user_roles",
    "app_settings", "number_ranges", "material_entries"]) {
    const r = await fetch(`${API}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: ANON } });
    const zeilen = r.ok ? await r.json() : [];
    expect(zeilen, t).toEqual([]);
  }
});

test("Noch nicht freigeschaltetes Konto wartet auf Freischaltung", async ({ page }) => {
  const k = await konto("inaktiv");
  await page.goto(`${APP}/auth`);
  await page.getByLabel("Benutzername oder E-Mail").fill(k.benutzer);
  await page.getByLabel("Passwort", { exact: true }).fill(PASSWORT);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByText("Warten auf Freischaltung").first()).toBeVisible({ timeout: 20_000 });
  await page.goto(`${APP}/time-tracking`);
  await expect(page.getByText("Warten auf Freischaltung").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Stunden erfassen" })).toHaveCount(0);
});
