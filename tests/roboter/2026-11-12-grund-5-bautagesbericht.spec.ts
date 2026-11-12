// Grundablauf Bautagesbericht (12.11.2026, berichte-regie-bautagesbericht.md): Mitarbeiter erfasst am Handy einen
// Bericht mit Projekt und Stunden je Tätigkeit (keine Uhrzeiten, keine Unterschrift). Gespeichert wird der Bericht,
// die Stunden landen ohne erfundene Uhrzeiten in der Zeiterfassung, das PDF wird automatisch erzeugt (Edge Function
// send-bautagesbericht-report, pdfOnly – keine Mail) und im Projektordner abgelegt; alle Aktiven sehen alle Berichte.
import { expect, test } from "@playwright/test";
import { API, APP, DIENST, alsKonto, anmelden, dienst, functionLaeuft, konto, nurTestumgebung, wache } from "./grundtest-hilfe";

nurTestumgebung();

test("Mitarbeiter am Handy: Bautagesbericht mit Tätigkeiten, Stunden gespiegelt, PDF im Projektordner", async ({ browser }) => {
  expect(await functionLaeuft("send-bautagesbericht-report"), "Edge Functions nicht gestartet – siehe grundtest-hilfe.ts").toBe(true);
  const ma = await konto("mitarbeiter");
  const admin = await konto("administrator");
  const marke = `ZZTEST Baustelle ${Date.now().toString(36)}`;
  const [kunde] = await dienst<{ id: string }[]>("/rest/v1/customers", "POST", { user_id: admin.id, name: `${marke} Kunde`, plz: "6642", ort: "Testort", adresse: "Teststraße 1" });
  const [projekt] = await dienst<{ id: string }[]>("/rest/v1/projects", "POST", { name: marke, plz: "6642", adresse: "Teststraße 1", status: "In Arbeit", customer_id: kunde.id });

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(/\.supabase\.(co|in)\//, (r) => r.abort("blockedbyclient"));
  const page = await ctx.newPage();
  const w = wache(page);
  await anmelden(page, ma);

  await page.goto(`${APP}/bautagesberichte`);
  await page.getByRole("button", { name: "Neuer Bautagesbericht" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").filter({ hasText: "Kein Projekt" }).click();
  await page.getByRole("option", { name: marke, exact: true }).click();
  // Kunde kommt aus dem Projekt.
  await expect(dialog.getByText(`${marke} Kunde`).first()).toBeVisible({ timeout: 10_000 });

  const zeilen = dialog.getByPlaceholder("Tätigkeit");
  await zeilen.first().fill("ZZTEST Sparren verlegt");
  await dialog.getByPlaceholder("0").first().fill("2,5");
  await dialog.getByRole("button", { name: "Tätigkeit", exact: true }).click();
  await zeilen.nth(1).fill("ZZTEST aufräumen");
  await dialog.getByPlaceholder("0").nth(1).fill("1");
  await dialog.getByLabel("Durchgeführte Arbeit *").fill(`${marke}: Dachstuhl`); // Pflichtfeld
  await page.getByRole("button", { name: "Bautagesbericht erfassen" }).click();
  await page.waitForURL(/\/bautagesberichte\/[0-9a-f-]{36}/, { timeout: 60_000 });
  const id = page.url().match(/bautagesberichte\/([0-9a-f-]{36})/)![1];

  const [b] = await dienst<any[]>(`/rest/v1/bautagesberichte?id=eq.${id}&select=*`);
  expect(b.user_id).toBe(ma.id);
  expect(b.project_id).toBe(projekt.id);
  expect(b.kunde_name).toBe(`${marke} Kunde`);
  expect(Number(b.stunden)).toBe(3.5);
  expect(b.start_time).toBeNull(); // keine erfundenen Uhrzeiten
  expect(b.taetigkeiten.map((t: { text: string; stunden: number }) => [t.text, Number(t.stunden)]))
    .toEqual([["ZZTEST Sparren verlegt", 2.5], ["ZZTEST aufräumen", 1]]);

  // Stunden in der Zeiterfassung gespiegelt – aufs Projekt, ohne Uhrzeit.
  const zeit = await dienst<any[]>(`/rest/v1/time_entries?user_id=eq.${ma.id}&datum=eq.${b.datum}&project_id=eq.${projekt.id}&select=*`);
  expect(zeit).toHaveLength(1);
  expect(Number(zeit[0].stunden)).toBe(3.5);
  expect(zeit[0].start_time).toBeNull();

  // PDF erzeugt: am Bericht und im Projektordner.
  expect(b.pdf_path).toBeTruthy();
  const holen = (bucket: string, pfad: string) =>
    fetch(`${API}/storage/v1/object/${bucket}/${pfad}`, { headers: { apikey: DIENST, Authorization: `Bearer ${DIENST}` } });
  const datei = await holen("bautagesbericht-pdfs", b.pdf_path);
  expect(datei.ok).toBe(true);
  const inhalt = Buffer.from(await datei.arrayBuffer());
  expect(inhalt.subarray(0, 4).toString()).toBe("%PDF");
  expect(inhalt.length).toBeGreaterThan(3000);
  const ordner = await (await fetch(`${API}/storage/v1/object/list/project-reports`, {
    method: "POST", headers: { apikey: DIENST, Authorization: `Bearer ${DIENST}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: `${projekt.id}/bautagesberichte/`, limit: 10 }),
  })).json();
  expect(ordner.filter((o: { name: string }) => o.name.endsWith(".pdf"))).toHaveLength(1);

  await page.goto(`${APP}/bautagesberichte`);
  await expect(page.getByText(`${marke} Kunde`).first()).toBeVisible({ timeout: 20_000 });
  expect(w.abstuerze).toEqual([]);
  await ctx.close();
});

test("Bautagesberichte: alle Aktiven sehen alle Berichte, ändern nur die eigenen", async () => {
  const ma = await konto("mitarbeiter");
  const va = await konto("vorarbeiter");
  const [b] = await dienst<{ id: string }[]>("/rest/v1/bautagesberichte", "POST", {
    user_id: va.id, datum: "2024-03-05", stunden: 2, kunde_name: "ZZTEST Fremdbericht", beschreibung: "ZZTEST fremd",
    taetigkeiten: [{ text: "ZZTEST fremd", stunden: 2 }],
  });
  expect(await (await alsKonto(ma, `/rest/v1/bautagesberichte?id=eq.${b.id}&select=id`)).json()).toHaveLength(1);
  await alsKonto(ma, `/rest/v1/bautagesberichte?id=eq.${b.id}`, "PATCH", { beschreibung: "ZZTEST geändert" });
  await alsKonto(ma, `/rest/v1/bautagesberichte?id=eq.${b.id}`, "DELETE");
  const [nachher] = await dienst<any[]>(`/rest/v1/bautagesberichte?id=eq.${b.id}&select=beschreibung`);
  expect(nachher.beschreibung).toBe("ZZTEST fremd");
  await dienst(`/rest/v1/bautagesberichte?id=eq.${b.id}`, "DELETE");
});
