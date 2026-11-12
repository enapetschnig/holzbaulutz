// Gemeinsame Hilfen der Grundtests (12.11.2026). Laufen NUR gegen die Testumgebung (testumgebung.mjs start + daten),
// App gestartet mit VITE_SUPABASE_URL/VITE_SUPABASE_KEY auf die Testumgebung:
//   VITE_SUPABASE_URL=$TEST_API_URL VITE_SUPABASE_KEY=$TEST_ANON_KEY npx vite --port 55910 --strictPort
//   TEST_API_URL=… TEST_ANON_KEY=… TEST_SERVICE_ROLE_KEY=… TEST_APP_URL=http://127.0.0.1:55910 \
//   npx playwright test -c tests/roboter/playwright.config.ts
// Die Zeiterfassung speichert über die Edge Function create-team-time-entries; die Testumgebung startet keine
// Functions. Darum vorher (ohne --env-file, also ohne echte Secrets):
//   ln -sfn "$PWD/supabase/functions" ~/roboter/test/holzbaulutz/supabase/functions
//   supabase functions serve --workdir ~/roboter/test/holzbaulutz --no-verify-jwt
// Namen und Beträge aus den Echtdaten stehen nirgends; Eigenes trägt das Kennzeichen ZZTEST und verschwindet
// mit der ganzen Testdatenbank (testumgebung.mjs stop).
import { test, type Page } from "@playwright/test";

export const API = process.env.TEST_API_URL ?? "";
export const ANON = process.env.TEST_ANON_KEY ?? "";
export const DIENST = process.env.TEST_SERVICE_ROLE_KEY ?? "";
export const APP = process.env.TEST_APP_URL ?? "http://127.0.0.1:55910";
export const PASSWORT = "Test1234!x"; // festes Passwort nur der Testumgebung, kein echtes Konto

export type Rolle = "administrator" | "vorarbeiter" | "mitarbeiter";
export type Konto = { id: string; email: string; benutzer: string };

export function nurTestumgebung() {
  test.skip(!API || !ANON || !DIENST, "nur mit laufender Testumgebung (testumgebung.mjs start)");
  if (API && !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(API)) throw new Error("Nur gegen die lokale Testumgebung!");
  test.use({ serviceWorkers: "block" }); // PWA-Cache soll keine alte Fassung liefern
  // Zweite Sperre: Auch eine versehentlich gegen die echte Datenbank gebaute App erreicht sie nicht.
  test.beforeEach(async ({ context }) => {
    await context.route(/\.supabase\.(co|in)\//, (r) => r.abort("blockedbyclient"));
  });
}

export async function dienst<T = any>(pfad: string, methode = "GET", daten?: unknown): Promise<T> {
  const r = await fetch(`${API}${pfad}`, {
    method: methode,
    headers: { apikey: DIENST, Authorization: `Bearer ${DIENST}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: daten === undefined ? undefined : JSON.stringify(daten),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${methode} ${pfad}: ${r.status} ${t.slice(0, 300)}`);
  return (t ? JSON.parse(t) : null) as T;
}

/** Festes Test-Konto genau dieser Rolle (freigeschaltet); wird beim ersten Aufruf angelegt. */
export async function konto(rolle: Rolle | "inaktiv"): Promise<Konto> {
  const benutzer = `zztest.${rolle}`;
  const email = `${benutzer}@app.holzbau-lutz.at`; // so meldet die App Benutzernamen ohne @ an
  const { users } = await dienst<{ users: { id: string; email: string }[] }>("/auth/v1/admin/users?per_page=1000");
  let id = users.find((u) => u.email === email)?.id;
  if (!id) {
    id = (await dienst<{ id: string }>("/auth/v1/admin/users", "POST", {
      email, password: PASSWORT, email_confirm: true, user_metadata: { vorname: "ZZTEST", nachname: rolle },
    })).id;
  }
  await dienst(`/rest/v1/profiles?id=eq.${id}`, "PATCH", { vorname: "ZZTEST", nachname: rolle, is_active: rolle !== "inaktiv", must_change_password: false, anleitung_completed: true });
  await dienst(`/rest/v1/user_roles?user_id=eq.${id}`, "DELETE");
  if (rolle !== "inaktiv") await dienst("/rest/v1/user_roles", "POST", { user_id: id, role: rolle });
  return { id, email, benutzer };
}

/** Anmelden wie der Kunde: Benutzername + Passwort im Formular. */
export async function anmelden(page: Page, k: Konto) {
  await page.goto(`${APP}/auth`);
  // Der Vite-Dev-Server liefert die Seite nach Modul-Neuaufbau gelegentlich leer aus → einmal neu laden.
  const feld = page.getByLabel("Benutzername oder E-Mail");
  if (!(await feld.waitFor({ timeout: 15_000 }).then(() => true, () => false))) await page.reload();
  await feld.fill(k.benutzer);
  await page.getByLabel("Passwort", { exact: true }).fill(PASSWORT);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30_000 });
}

export async function zugriffstoken(k: Konto): Promise<string> {
  const r = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: k.email, password: PASSWORT }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("Anmeldung an der Testumgebung fehlgeschlagen");
  return j.access_token;
}

/** Abfrage mit den Rechten des Kontos (RLS greift) – für „darf die Rolle das?“ ohne Oberfläche. */
export async function alsKonto(k: Konto, pfad: string, methode = "GET", daten?: unknown) {
  const token = await zugriffstoken(k);
  return fetch(`${API}${pfad}`, {
    method: methode,
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: daten === undefined ? undefined : JSON.stringify(daten),
  });
}

/** Eigenes Projekt mit Kennzeichen ZZTEST, damit kein Fremdbestand verändert wird. */
export async function testProjekt(titel: string, status = "In Arbeit") {
  const marke = `ZZTEST ${titel} ${Date.now().toString(36)}`;
  const [p] = await dienst<{ id: string }[]>("/rest/v1/projects", "POST", { name: marke, plz: "6642", adresse: "Teststraße 1", status });
  return { projektId: p.id, marke };
}

/** Eigener Kunde mit Kennzeichen ZZTEST. */
export async function testKunde(admin: Konto) {
  const marke = `ZZTEST Kunde ${Date.now().toString(36)}`;
  await dienst("/rest/v1/customers", "POST", { user_id: admin.id, name: marke, plz: "6642", ort: "Testort", adresse: "Teststraße 1" });
  return marke;
}

/** Sammelt Abstürze und von der Datenbank abgelehnte Abfragen der Seite. */
export function wache(page: Page) {
  const abstuerze: string[] = [];
  const abgelehnt: string[] = [];
  page.on("pageerror", (e) => abstuerze.push(e.message));
  page.on("response", (r) => {
    if (r.url().includes("/rest/v1/") && r.status() >= 400) abgelehnt.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  return { abstuerze, abgelehnt };
}

/** Läuft eine Edge Function der Testumgebung? (sonst klare Meldung statt rätselhaftem Fehlschlag) */
export async function functionLaeuft(name: string): Promise<boolean> {
  const r = await fetch(`${API}/functions/v1/${name}`, { method: "OPTIONS" }).catch(() => null);
  return !!r && r.status < 500;
}

/** Ein Werktag (Mo–Do) in der Vergangenheit, je Lauf anders – damit Wiederholungen nicht mit alten Buchungen kollidieren. */
export function freierTag(): string {
  const d = new Date(Date.UTC(2024, 0, 1) + (Math.floor(Date.now() / 1000) % 600) * 86_400_000);
  while (d.getUTCDay() === 0 || d.getUTCDay() >= 5) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
