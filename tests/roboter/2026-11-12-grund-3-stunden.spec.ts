// Grundablauf Stunden erfassen (12.11.2026): Mitarbeiter bucht auf ein Projekt (Baustelle) und in die Firma,
// die Buchungen stehen richtig in der Datenbank und unter „Meine Stunden“ (gespeichert wird über die Edge Function
// create-team-time-entries – die Testumgebung braucht dafür `supabase functions serve`, siehe grundtest-hilfe.ts);
// eine überschneidende Buchung wird abgelehnt; abgeschlossene Projekte stehen nicht zur Auswahl.
import { expect, test, type Page } from "@playwright/test";
import { APP, anmelden, dienst, functionLaeuft, konto, nurTestumgebung, testProjekt, wache } from "./grundtest-hilfe";

nurTestumgebung();

async function block(page: Page, von: string, bis: string, pause: string) {
  await page.locator("label:has-text('Beginn') + button").click();
  await page.getByRole("option", { name: von, exact: true }).click();
  await page.locator("label:has-text('Ende') + button").click();
  await page.getByRole("option", { name: bis, exact: true }).click();
  await page.getByRole("button", { name: pause, exact: true }).click();
}

test("Mitarbeiter: Stunden auf Projekt und Firma buchen, in Meine Stunden sehen, keine Überschneidung", async ({ page }) => {
  expect(await functionLaeuft("create-team-time-entries"), "Edge Functions nicht gestartet – siehe grundtest-hilfe.ts").toBe(true);
  const ma = await konto("mitarbeiter");
  const { projektId, marke } = await testProjekt("Stunden");
  const tag = new Date().toISOString().slice(0, 10); // so wählt die Zeiterfassung den Tag vor
  await dienst(`/rest/v1/time_entries?user_id=eq.${ma.id}&datum=eq.${tag}`, "DELETE"); // Reste früherer Läufe
  const w = wache(page);
  await anmelden(page, ma);

  const aufProjekt = async () => {
    await page.goto(`${APP}/time-tracking`);
    await page.getByRole("combobox").filter({ hasText: "Projekt auswählen" }).click();
    await page.getByRole("option", { name: new RegExp(marke) }).click();
    await page.getByPlaceholder("z.B. Montage, Aufmaß...").fill(`${marke} Dachstuhl`);
    await block(page, "07:30", "12:00", "Keine");
    await expect(page.getByText("Gesamt zu buchen").locator("..")).toContainText("4.50 h");
    await page.getByRole("button", { name: "Stunden erfassen" }).click();
  };

  await aufProjekt();
  await expect(page.getByText("Eintrag/Einträge gespeichert").first()).toBeVisible({ timeout: 20_000 });
  let eintraege = await dienst<any[]>(`/rest/v1/time_entries?user_id=eq.${ma.id}&datum=eq.${tag}&select=*`);
  expect(eintraege).toHaveLength(1);
  expect(eintraege[0].project_id).toBe(projektId);
  expect(eintraege[0].location_type).toBe("baustelle");
  expect(Number(eintraege[0].stunden)).toBe(4.5);
  expect(eintraege[0].start_time.slice(0, 5)).toBe("07:30");
  expect(eintraege[0].end_time.slice(0, 5)).toBe("12:00");

  // Nachmittag in der Firma (intern, kein Projekt) – mit 30 Min Pause.
  await page.goto(`${APP}/time-tracking`);
  await page.getByText("🏢 Firma").click();
  await block(page, "12:00", "16:30", "30 Min");
  await expect(page.getByText("Gesamt zu buchen").locator("..")).toContainText("4.00 h");
  await page.getByRole("button", { name: "Stunden erfassen" }).click();
  await expect(page.getByText("Eintrag/Einträge gespeichert").first()).toBeVisible({ timeout: 20_000 });
  eintraege = await dienst<any[]>(`/rest/v1/time_entries?user_id=eq.${ma.id}&datum=eq.${tag}&select=*&order=start_time`);
  expect(eintraege).toHaveLength(2);
  expect(eintraege[1].location_type).toBe("werkstatt"); // heißt in der Oberfläche „Firma“
  expect(eintraege[1].project_id).toBeNull();
  expect(Number(eintraege[1].stunden)).toBe(4);
  expect(eintraege[1].pause_minutes).toBe(30);

  await page.goto(`${APP}/my-hours`);
  const zeile = page.getByRole("row").filter({ hasText: marke });
  await expect(zeile).toHaveCount(1, { timeout: 20_000 });
  for (const teil of ["07:30", "12:00", "4.50 h"]) await expect(zeile).toContainText(teil);

  // Gleiche Zeit nochmal buchen → abgelehnt, es bleibt bei zwei Einträgen.
  await aufProjekt();
  await expect(page.getByText("Zeitüberschneidung").first()).toBeVisible();
  expect(await dienst<any[]>(`/rest/v1/time_entries?user_id=eq.${ma.id}&datum=eq.${tag}&select=id`)).toHaveLength(2);
  expect(w.abstuerze).toEqual([]);
  expect(w.abgelehnt).toEqual([]);
});

test("Zeiterfassung: abgeschlossene Projekte stehen nicht zur Auswahl", async ({ page }) => {
  const offen = await testProjekt("Laufend");
  const fertig = await testProjekt("Fertig", "Abgeschlossen");
  await anmelden(page, await konto("mitarbeiter"));
  await page.goto(`${APP}/time-tracking`);
  await page.getByRole("combobox").filter({ hasText: "Projekt auswählen" }).click();
  await expect(page.getByRole("option", { name: new RegExp(offen.marke) })).toBeVisible();
  await expect(page.getByRole("option", { name: new RegExp(fertig.marke) })).toHaveCount(0);
});
