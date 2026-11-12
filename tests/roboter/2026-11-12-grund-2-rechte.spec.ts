// Grundablauf Rechte (12.11.2026): Was jede Rolle sehen darf, steht in role_permissions (Admin pflegt das im Reiter
// „Berechtigungen“). Die Oberfläche muss sich genau daran halten – und die Datenbank muss die feste Kundenregel
// „Mitarbeiter sehen keine Zahlen“ (Christoph: „kein betriebswissen“, RLS seit 17.07.2026) auch ohne Oberfläche durchsetzen.
import { expect, test } from "@playwright/test";
import { APP, alsKonto, anmelden, dienst, freierTag, konto, nurTestumgebung, wache, type Rolle } from "./grundtest-hilfe";

nurTestumgebung();

const SEITEN: Record<string, string> = {
  rechnungen: "/invoices",
  admin: "/admin",
  stundenauswertung: "/hours-report",
  plantafel: "/schedule",
  regieberichte: "/disturbances",
  bautagesberichte: "/bautagesberichte",
  kunden: "/customers",
  materialien: "/materials",
  eingangsrechnungen: "/eingangsrechnungen",
};

for (const rolle of ["administrator", "vorarbeiter", "mitarbeiter"] as Rolle[]) {
  test(`${rolle}: jede Seite genau nach role_permissions`, async ({ page }) => {
    const rechte = await dienst<{ feature: string; can_view: boolean }[]>(`/rest/v1/role_permissions?role=eq.${rolle}&select=feature,can_view`);
    const darf = (f: string) => rechte.find((r) => r.feature === f)?.can_view === true;
    const w = wache(page);
    await anmelden(page, await konto(rolle));
    for (const [feature, pfad] of Object.entries(SEITEN)) {
      await page.goto(`${APP}${pfad}`);
      await page.waitForLoadState("networkidle").catch(() => {});
      const gesperrt = page.getByText("Du hast keine Berechtigung für diesen Bereich.");
      if (darf(feature)) {
        await page.waitForTimeout(500);
        await expect(gesperrt, `${rolle} ${pfad} sollte offen sein`).toHaveCount(0);
        await expect(page, `${rolle} ${pfad}`).not.toHaveURL(/\/auth/);
      } else {
        await expect(gesperrt, `${rolle} ${pfad} sollte gesperrt sein`).toBeVisible();
      }
    }
    expect(w.abstuerze).toEqual([]);
  });
}

test("Feste Kundenregeln stehen so in role_permissions", async () => {
  const alle = await dienst<{ role: string; feature: string; can_view: boolean }[]>("/rest/v1/role_permissions?select=role,feature,can_view");
  const darf = (r: string, f: string) => alle.find((x) => x.role === r && x.feature === f)?.can_view === true;
  for (const f of Object.keys(SEITEN)) expect(darf("administrator", f), `administrator ${f}`).toBe(true);
  // Mitarbeiter: nur Zeiterfassung, Regie- und Bautagesberichte – nichts mit Zahlen.
  for (const f of ["rechnungen", "admin", "stundenauswertung", "materialien", "eingangsrechnungen"]) {
    expect(darf("mitarbeiter", f), `mitarbeiter ${f}`).toBe(false);
  }
  for (const f of ["rechnungen", "admin", "stundenauswertung", "materialien"]) {
    expect(darf("vorarbeiter", f), `vorarbeiter ${f}`).toBe(false);
  }
  for (const f of ["zeiterfassung", "meine_stunden", "regieberichte", "bautagesberichte"]) {
    expect(darf("mitarbeiter", f), `mitarbeiter ${f}`).toBe(true);
    expect(darf("vorarbeiter", f), `vorarbeiter ${f}`).toBe(true);
  }
});

test("Mitarbeiter am Handy: Zeiterfassung und Berichte sichtbar, keine Rechnungen/Materialien/Admin", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(/\.supabase\.(co|in)\//, (r) => r.abort("blockedbyclient"));
  const page = await ctx.newPage();
  await anmelden(page, await konto("mitarbeiter"));
  for (const t of ["Zeiterfassung", "Meine Stunden", "Regieberichte", "Bautagesberichte"]) await expect(page.getByText(t).first()).toBeVisible();
  for (const t of ["Rechnungen & Angebote", "Admin-Bereich", "Eingangsrechnungen", "Offene Posten", "Stundenabgleich"]) await expect(page.getByText(t)).toHaveCount(0);
  await ctx.close();
});

test("Datenbank: Mitarbeiter sieht keine Zahlen und nur eigene Stunden, kann sich nicht zum Admin machen", async () => {
  const ma = await konto("mitarbeiter");
  const admin = await konto("administrator");
  const fremd = await dienst<{ id: string }[]>("/rest/v1/time_entries", "POST", {
    user_id: admin.id, datum: freierTag(), stunden: 2, taetigkeit: "ZZTEST fremd", start_time: "07:00", end_time: "09:00",
  });
  const [re] = await dienst<{ id: string }[]>("/rest/v1/invoices", "POST", {
    user_id: admin.id, typ: "rechnung", nummer: `ZZTEST-${Date.now().toString(36)}`, laufnummer: 990000 + (Date.now() % 9000), kunde_name: "ZZTEST Kunde", status: "entwurf",
  });

  // Geld- und Betriebszahlen: leer für den Mitarbeiter (obwohl Daten da sind).
  for (const t of ["invoices", "invoice_items", "invoice_payments", "mahnung_history", "number_ranges", "invoice_templates",
    "position_components", "material_entries", "purchase_invoices"]) {
    const r = await alsKonto(ma, `/rest/v1/${t}?select=*&limit=5`);
    expect(r.ok ? await r.json() : [], t).toEqual([]);
  }
  expect(await (await alsKonto(admin, `/rest/v1/invoices?id=eq.${re.id}&select=id`)).json()).toHaveLength(1);
  // app_settings: nur die harmlose Whitelist (Einheiten), keine Bankdaten, kein Lohnnebenkosten-Faktor.
  const settings = await (await alsKonto(ma, "/rest/v1/app_settings?select=key")).json();
  expect(settings.map((s: { key: string }) => s.key).filter((k: string) => k !== "einheiten")).toEqual([]);
  // Material am Projekt: über die Ansicht ja, aber ohne Preis.
  const material = await (await alsKonto(ma, "/rest/v1/material_entries_ansicht?select=einzelpreis&limit=200")).json();
  expect(material.every((m: { einzelpreis: unknown }) => m.einzelpreis === null)).toBe(true);

  // Stunden: nur die eigenen.
  const stunden = await (await alsKonto(ma, "/rest/v1/time_entries?select=user_id")).json();
  expect(stunden.every((s: { user_id: string }) => s.user_id === ma.id)).toBe(true);
  expect(await (await alsKonto(ma, `/rest/v1/time_entries?id=eq.${fremd[0].id}&select=id`)).json()).toEqual([]);

  // Rechte ausweiten oder sich selbst eine Rolle geben geht nicht.
  await alsKonto(ma, "/rest/v1/user_roles", "POST", { user_id: ma.id, role: "administrator" });
  await alsKonto(ma, "/rest/v1/role_permissions?role=eq.mitarbeiter&feature=eq.rechnungen", "PATCH", { can_view: true });
  const rollen = await dienst<{ role: string }[]>(`/rest/v1/user_roles?user_id=eq.${ma.id}&select=role`);
  expect(rollen.map((r) => r.role)).toEqual(["mitarbeiter"]);
  const [p] = await dienst<{ can_view: boolean }[]>("/rest/v1/role_permissions?role=eq.mitarbeiter&feature=eq.rechnungen&select=can_view");
  expect(p.can_view).toBe(false);

  // Fremde Stunden ändern oder löschen geht nicht.
  await alsKonto(ma, `/rest/v1/time_entries?id=eq.${fremd[0].id}`, "PATCH", { stunden: 99 });
  await alsKonto(ma, `/rest/v1/time_entries?id=eq.${fremd[0].id}`, "DELETE");
  const [nachher] = await dienst<{ stunden: number }[]>(`/rest/v1/time_entries?id=eq.${fremd[0].id}&select=stunden`);
  expect(Number(nachher.stunden)).toBe(2);

  await dienst(`/rest/v1/time_entries?id=eq.${fremd[0].id}`, "DELETE");
  await dienst(`/rest/v1/invoices?id=eq.${re.id}`, "DELETE");
});
