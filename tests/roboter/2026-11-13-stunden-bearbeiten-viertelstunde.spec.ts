// Wünsche Büro 13.11.2026: (1) Stundeneintrag in der Zeiterfassung nachträglich bearbeiten, v. a. den falschen Tag
// korrigieren; (2) Beginn/Ende und Mittagspause im Viertelstunden-Takt. Mitarbeiter bucht 07:15–11:45 mit 15 Min
// Pause (= 4,25 h), verschiebt den Eintrag über den Stift bei „Bereits gebuchte Zeiten“ auf einen anderen Tag und
// ändert dort die Pause auf 45 Min; auf einen Tag mit Urlaub lässt er sich nicht verschieben.
import { expect, test, type Page } from "@playwright/test";
import { APP, anmelden, dienst, functionLaeuft, konto, nurTestumgebung, testProjekt, wache } from "./grundtest-hilfe";

nurTestumgebung();

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function waehle(page: Page, feld: string, wert: string) {
  await page.locator(`label:has-text('${feld}') + button`).first().click();
  await page.getByRole("option", { name: wert, exact: true }).click();
}

test("Zeiterfassung: Viertelstunden buchen, Eintrag auf anderen Tag verschieben und Pause ändern", async ({ page }) => {
  expect(await functionLaeuft("create-team-time-entries"), "Edge Functions nicht gestartet – siehe grundtest-hilfe.ts").toBe(true);
  const ma = await konto("mitarbeiter");
  const { marke } = await testProjekt("Verschieben");
  const heute = new Date();
  const tag = iso(heute); // die Zeiterfassung wählt heute vor
  // Ziel- und Urlaubstag im selben Monat (Verschieben geht nur innerhalb des aktuellen Monats)
  const d1 = new Date(heute); d1.setDate(heute.getDate() <= 2 ? heute.getDate() + 1 : heute.getDate() - 1);
  const d2 = new Date(heute); d2.setDate(heute.getDate() <= 2 ? heute.getDate() + 2 : heute.getDate() - 2);
  const ziel = iso(d1);
  const urlaubTag = iso(d2);
  for (const t of [tag, ziel, urlaubTag]) await dienst(`/rest/v1/time_entries?user_id=eq.${ma.id}&datum=eq.${t}`, "DELETE");
  await dienst("/rest/v1/time_entries", "POST", {
    user_id: ma.id, datum: urlaubTag, taetigkeit: "Urlaub", stunden: 8, start_time: "07:30", end_time: "16:30", pause_minutes: 60, location_type: "baustelle",
  });
  const w = wache(page);
  await anmelden(page, ma);

  // (2) Viertelstunden: 07:15 – 11:45, 15 Min Pause = 4,25 h
  await page.goto(`${APP}/time-tracking`);
  await page.getByRole("combobox").filter({ hasText: "Projekt auswählen" }).click();
  await page.getByRole("option", { name: new RegExp(marke) }).click();
  await waehle(page, "Beginn", "07:15");
  await waehle(page, "Ende", "11:45");
  await page.getByRole("button", { name: "15 Min", exact: true }).click();
  await expect(page.getByText("Gesamt zu buchen").locator("..")).toContainText("4.25 h");
  await page.getByRole("button", { name: "Stunden erfassen" }).click();
  await expect(page.getByText("Eintrag/Einträge gespeichert").first()).toBeVisible({ timeout: 20_000 });
  let e = await dienst<any[]>(`/rest/v1/time_entries?user_id=eq.${ma.id}&datum=eq.${tag}&select=*`);
  expect(e).toHaveLength(1);
  expect(Number(e[0].stunden)).toBe(4.25);
  expect(e[0].pause_minutes).toBe(15);
  const id = e[0].id;

  // (1) Auf einen Urlaubstag verschieben → abgelehnt
  await page.getByRole("button", { name: "Eintrag bearbeiten" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Datum")).toHaveValue(tag);
  await dialog.getByLabel("Datum").fill(urlaubTag);
  await dialog.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Tag blockiert").first()).toBeVisible();
  expect((await dienst<any[]>(`/rest/v1/time_entries?id=eq.${id}&select=datum`))[0].datum).toBe(tag);

  // (1) Auf den richtigen Tag verschieben und Pause auf 45 Min → 3,75 h
  await dialog.getByLabel("Datum").fill(ziel);
  await dialog.getByRole("button", { name: "45 Min", exact: true }).click();
  await expect(dialog).toContainText("3.75 h");
  await dialog.getByRole("button", { name: "Speichern" }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 }); // schließt erst nach erfolgreichem Speichern
  await expect(page.getByText(/auf .* verschoben/).first()).toBeVisible();
  await expect(page.getByText("Noch keine Einträge für diesen Tag")).toBeVisible();
  e = await dienst<any[]>(`/rest/v1/time_entries?id=eq.${id}&select=*`);
  expect(e[0].datum).toBe(ziel);
  expect(e[0].pause_minutes).toBe(45);
  expect(Number(e[0].stunden)).toBe(3.75);
  expect(e[0].start_time.slice(0, 5)).toBe("07:15");

  // Unter „Meine Stunden“ öffnet der Stift denselben Dialog mit dem Datum
  await page.goto(`${APP}/my-hours`);
  const zeile = page.getByRole("row").filter({ hasText: marke });
  await expect(zeile).toContainText("3.75 h", { timeout: 20_000 });
  await zeile.getByRole("button").click();
  await expect(page.getByRole("dialog").getByLabel("Datum")).toHaveValue(ziel);

  expect(w.abstuerze).toEqual([]);
  expect(w.abgelehnt).toEqual([]);
});

// Nachprüfung 13.11.: Teilzeit-Abwesenheit blockiert das Verschieben nicht; ein altes Pausenfenster
// (pause_start/pause_end) wird beim Ändern der Pause entfernt, sonst zeigt die Stundenauswertung die alte Pause.
test("Bearbeiten: auf Tag mit Teilzeit-Abwesenheit verschieben, altes Pausenfenster fällt weg", async ({ page }) => {
  const ma = await konto("mitarbeiter");
  const heute = new Date();
  const tag = iso(heute);
  const d1 = new Date(heute); d1.setDate(heute.getDate() <= 3 ? heute.getDate() + 3 : heute.getDate() - 3);
  const ziel = iso(d1);
  for (const t of [tag, ziel]) await dienst(`/rest/v1/time_entries?user_id=eq.${ma.id}&datum=eq.${t}`, "DELETE");
  const [alt] = await dienst<any[]>("/rest/v1/time_entries", "POST", {
    user_id: ma.id, datum: tag, taetigkeit: "ZZTEST Altbestand", stunden: 8, start_time: "07:00", end_time: "16:00",
    pause_minutes: 60, pause_start: "12:00", pause_end: "13:00", location_type: "werkstatt",
  });
  await dienst("/rest/v1/time_entries", "POST", {
    user_id: ma.id, datum: ziel, taetigkeit: "Zeitausgleich", stunden: 1.5, start_time: "16:30", end_time: "18:00",
    pause_minutes: 0, location_type: "werkstatt", is_full_day: false,
  });
  const w = wache(page);
  await anmelden(page, ma);
  await page.goto(`${APP}/time-tracking`);
  await page.getByRole("button", { name: "Eintrag bearbeiten" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Datum").fill(ziel);
  await dialog.getByRole("button", { name: "30 Min", exact: true }).click();
  await dialog.getByRole("button", { name: "Speichern" }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 }); // schließt erst nach erfolgreichem Speichern
  await expect(page.getByText(/auf .* verschoben/).first()).toBeVisible();
  const [e] = await dienst<any[]>(`/rest/v1/time_entries?id=eq.${alt.id}&select=*`);
  expect(e.datum).toBe(ziel);
  expect(e.pause_minutes).toBe(30);
  expect(Number(e.stunden)).toBe(8.5);
  expect(e.pause_start).toBeNull();
  expect(e.pause_end).toBeNull();
  expect(w.abstuerze).toEqual([]);
  expect(w.abgelehnt).toEqual([]);
});
