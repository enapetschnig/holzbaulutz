// ============================================================================
// Holzbau Lutz — Positionen mit Material-Komponenten
// ----------------------------------------------------------------------------
// Nach Excel "Z_Kalkulation Vorlage 2026 Material und Positionen":
//   MATERIALIEN = flache Preisliste (Name, Einheit, EK) inkl. Stundensätze
//   POSITIONEN  = kalkulierte Leistungen aus Komponenten:
//     material : Menge/EH x EK x (1+Verschnitt%) x (1+Aufschlag%)
//     lohn     : Std/EH   x Stundensatz
//     sonstiges: Menge    x Betrag
//   Einzelpreis (VK) = Summe aller Komponenten-Zeilen.
// Die DB rechnet identisch (recompute_position_price + Trigger) — diese Lib
// ist der Client-Spiegel für die Live-Anzeige im Editor.
// ============================================================================

export type ComponentTyp = "material" | "lohn" | "sonstiges";

export interface PositionComponent {
  id?: string;
  material_template_id: string | null;
  typ: ComponentTyp;
  bezeichnung: string;
  einheit: string;
  menge_pro_einheit: number;
  /** material (ohne Verknüpfung): EK €/EH · lohn: €/h · sonstiges: € */
  preis: number;
  verschnitt_prozent: number;
  aufschlag_prozent: number;
  sort_order: number;
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Effektiver Stückpreis einer Komponente (EK live aus verknüpftem Material). */
export function componentPreis(c: PositionComponent, materialEk?: number | null): number {
  if (c.typ === "material" && c.material_template_id && materialEk !== undefined && materialEk !== null) {
    return num(materialEk);
  }
  return num(c.preis);
}

/** Zeilenkosten einer Komponente pro Einheit der Position. */
export function calcComponentZeile(c: PositionComponent, materialEk?: number | null): number {
  const menge = num(c.menge_pro_einheit);
  const preis = componentPreis(c, materialEk);
  if (c.typ === "material") {
    return r2(menge * preis * (1 + num(c.verschnitt_prozent) / 100) * (1 + num(c.aufschlag_prozent) / 100));
  }
  return r2(menge * preis); // lohn: Std x Satz · sonstiges: Menge x Betrag
}

export interface PositionPreis {
  material: number;
  lohn: number;
  sonstiges: number;
  einzelpreis: number;
  /** Lohnminuten pro Einheit (für Stundenabgleich) */
  minutenProEinheit: number;
}

/** Gesamtpreis einer Position aus ihren Komponenten. ekLookup: material_template_id -> ek_netto. */
export function calcPositionPreis(
  components: PositionComponent[],
  ekLookup?: Record<string, number>,
): PositionPreis {
  let material = 0, lohn = 0, sonstiges = 0, minuten = 0;
  for (const c of components) {
    const ek = c.material_template_id && ekLookup ? ekLookup[c.material_template_id] : undefined;
    const zeile = calcComponentZeile(c, ek);
    if (c.typ === "material") material += zeile;
    else if (c.typ === "lohn") { lohn += zeile; minuten += num(c.menge_pro_einheit) * 60; }
    else sonstiges += zeile;
  }
  return {
    material: r2(material),
    lohn: r2(lohn),
    sonstiges: r2(sonstiges),
    einzelpreis: r2(material + lohn + sonstiges),
    minutenProEinheit: Math.round(minuten * 10) / 10,
  };
}

const nf = (n: unknown) => num(n).toLocaleString("de-AT", { maximumFractionDigits: 3 });

/**
 * Lesbare Rechenformel einer Komponente — damit man pro Zeile sieht, WIE der
 * Betrag entsteht (wie beim Anklicken einer Excel-Zelle). Geteilt von
 * Komponenten-Editor und Excel-Gesamtansicht.
 */
export function componentFormula(c: PositionComponent, materialEk?: number | null): string {
  const menge = num(c.menge_pro_einheit);
  const preis = componentPreis(c, materialEk);
  if (c.typ === "lohn") return `${nf(menge)} Std × ${nf(preis)} €`;
  if (c.typ === "sonstiges") return `${nf(menge)} × ${nf(preis)} €`;
  const parts = [`${nf(menge)} × ${nf(preis)} €`];
  if (num(c.verschnitt_prozent) > 0) parts.push(`× ${nf(1 + num(c.verschnitt_prozent) / 100)} (Verschnitt)`);
  if (num(c.aufschlag_prozent) > 0) parts.push(`× ${nf(1 + num(c.aufschlag_prozent) / 100)} (Aufschlag)`);
  return parts.join(" ");
}

export const EMPTY_COMPONENT = (typ: ComponentTyp, sort: number): PositionComponent => ({
  material_template_id: null,
  typ,
  bezeichnung: typ === "lohn" ? "Arbeitszeit" : "",
  einheit: typ === "lohn" ? "h" : "",
  menge_pro_einheit: typ === "sonstiges" ? 1 : 0,
  preis: typ === "lohn" ? 54 : 0, // Facharbeiterstunde als Default
  verschnitt_prozent: 0,
  aufschlag_prozent: 0,
  sort_order: sort,
});
