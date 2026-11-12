// Grundablauf Angebot & Rechnung (12.11.2026, angebot-rechnung.md): Büro legt für einen Kunden ein Angebot an und
// lädt das PDF; eine Rechnung wird erst zwischengespeichert (ENTWURF ohne Nummer, zählt nirgends), dann ausgestellt
// (fortlaufende Nummer, Status offen, gesperrt) – Beträge mit 20 % USt, PDF lässt sich herunterladen.
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import { APP, anmelden, dienst, konto, nurTestumgebung, testKunde, wache } from "./grundtest-hilfe";

nurTestumgebung();

async function belegBefuellen(page: Page, typ: string, kunde: string, text: string, menge: string, preis: string) {
  await page.goto(`${APP}/invoices/new?typ=${typ}`);
  await page.getByRole("combobox").filter({ hasText: "Kunde auswählen..." }).click();
  await page.getByPlaceholder("Kunde suchen...").fill(kunde);
  await page.getByRole("option", { name: new RegExp(`^${kunde}`) }).click();
  const zeile = page.locator("tr").filter({ has: page.getByPlaceholder("Kurzbezeichnung") }).first();
  await zeile.getByPlaceholder("Kurzbezeichnung").fill(text);
  await zeile.getByPlaceholder("Kurzbezeichnung").press("Escape"); // Katalog-Vorschläge schließen
  const zahlen = zeile.locator("input:not([placeholder]), input[placeholder='0']").filter({ hasNot: page.locator("[type=checkbox]") });
  await zahlen.nth(0).fill(menge); // Menge
  await zahlen.nth(1).fill(preis); // Einzelpreis netto
  await zahlen.nth(1).blur();
}

async function pdfLaden(page: Page, knopf: RegExp) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("button", { name: knopf }).first().click(),
  ]);
  const inhalt = fs.readFileSync((await dl.path())!);
  return { name: dl.suggestedFilename(), inhalt };
}

const idAusUrl = (page: Page) => page.url().match(/invoices\/([0-9a-f-]{36})/)![1];

test("Büro: Angebot anlegen, speichern, PDF", async ({ page }) => {
  const admin = await konto("administrator");
  const kunde = await testKunde(admin);
  const w = wache(page);
  await anmelden(page, admin);

  await belegBefuellen(page, "angebot", kunde, "ZZTEST Dachstuhl abbinden", "10", "85");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForURL(/\/invoices\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const [a] = await dienst<any[]>(`/rest/v1/invoices?id=eq.${idAusUrl(page)}&select=*`);
  expect(a.typ).toBe("angebot");
  expect(a.kunde_name).toBe(kunde);
  expect(a.nummer).toBeTruthy();
  expect(Number(a.netto_summe)).toBeCloseTo(850, 2);
  expect(Number(a.mwst_betrag)).toBeCloseTo(170, 2);
  expect(Number(a.brutto_summe)).toBeCloseTo(1020, 2);
  const pos = await dienst<any[]>(`/rest/v1/invoice_items?invoice_id=eq.${a.id}&select=beschreibung,menge,einzelpreis`);
  expect(pos).toHaveLength(1);
  expect(pos[0].beschreibung).toBe("ZZTEST Dachstuhl abbinden");

  const pdf = await pdfLaden(page, /^PDF$/);
  expect(pdf.name).toContain(a.nummer);
  expect(pdf.inhalt.subarray(0, 4).toString()).toBe("%PDF");
  expect(pdf.inhalt.length).toBeGreaterThan(5000);

  await page.goto(`${APP}/invoices`);
  await page.getByRole("button", { name: "Angebote", exact: true }).click();
  await expect(page.getByText(a.nummer).first()).toBeVisible({ timeout: 20_000 });
  expect(w.abstuerze).toEqual([]);
});

test("Büro: Rechnung zwischenspeichern (ohne Nummer), dann ausstellen, PDF", async ({ page }) => {
  const admin = await konto("administrator");
  const kunde = await testKunde(admin);
  const w = wache(page);
  await anmelden(page, admin);

  await belegBefuellen(page, "rechnung", kunde, "ZZTEST Carport montiert", "2", "150");
  await page.getByRole("button", { name: "Zwischenspeichern" }).last().click();
  await page.waitForURL(/\/invoices\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await expect(page.getByText("Entwurf gespeichert").first()).toBeVisible();
  const id = idAusUrl(page);
  const [entwurf] = await dienst<any[]>(`/rest/v1/invoices?id=eq.${id}&select=*`);
  expect(entwurf.status).toBe("entwurf");
  expect(entwurf.nummer).toMatch(/^ENTWURF/);

  // Ausstellen fragt nach (window.confirm) und vergibt dann die fortlaufende Nummer.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Ausstellen" }).last().click();
  await expect(page.getByText("Rechnung ausgestellt").first()).toBeVisible({ timeout: 20_000 });
  const [r] = await dienst<any[]>(`/rest/v1/invoices?id=eq.${id}&select=*`);
  expect(r.status).toBe("offen");
  expect(r.nummer).not.toMatch(/^ENTWURF/);
  expect(Number(r.netto_summe)).toBeCloseTo(300, 2);
  expect(Number(r.mwst_betrag)).toBeCloseTo(60, 2);
  expect(Number(r.brutto_summe)).toBeCloseTo(360, 2);

  // Gesperrt: kein Zwischenspeichern mehr, aber PDF und E-Rechnung.
  await page.reload();
  await expect(page.getByRole("button", { name: "Zwischenspeichern" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "E-Rechnung (XML)" })).toBeVisible();
  const pdf = await pdfLaden(page, /PDF herunterladen/);
  expect(pdf.name).toContain(r.nummer);
  expect(pdf.inhalt.subarray(0, 4).toString()).toBe("%PDF");
  expect(pdf.inhalt.length).toBeGreaterThan(5000);

  await page.goto(`${APP}/invoices`);
  await expect(page.getByText(r.nummer).first()).toBeVisible({ timeout: 20_000 });
  expect(w.abstuerze).toEqual([]);
});

test("Echte Rechnung aus den anonymisierten Daten öffnet und liefert ein PDF", async ({ page }) => {
  const [rechnung] = await dienst<{ id: string; nummer: string }[]>(
    "/rest/v1/invoices?typ=eq.rechnung&status=neq.entwurf&kunde_name=not.like.ZZTEST*&order=created_at.desc&limit=1&select=id,nummer");
  test.skip(!rechnung, "keine Echtdaten geladen (testumgebung.mjs daten)");
  const w = wache(page);
  await anmelden(page, await konto("administrator"));
  await page.goto(`${APP}/invoices/${rechnung.id}`);
  const pdf = await pdfLaden(page, /PDF herunterladen/);
  expect(pdf.name).toContain(rechnung.nummer);
  expect(pdf.inhalt.subarray(0, 4).toString()).toBe("%PDF");
  expect(w.abstuerze).toEqual([]);
});
