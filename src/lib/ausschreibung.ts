/**
 * Ausschreibungs-Import: ÖNORM-A-2063-Datenträger (.onlv) und
 * GAEB-DA-XML (.x81/.x82/.x83) einlesen und in Angebots-Positionen
 * umwandeln — Preise trägt der Nutzer danach im Angebots-Editor ein.
 *
 * Der Parser arbeitet namespace-agnostisch über localName, damit
 * verschiedene Schema-Versionen (A2063 2011/2015/2021, GAEB 3.1/3.2/3.3)
 * gleichermaßen funktionieren.
 */

export interface AusschreibungsPosition {
  /** LV-Nummer, z.B. "36.16.20A" (ÖNORM) oder "01.02.0010" (GAEB) */
  nr: string;
  kurztext: string;
  langtext: string;
  menge: number;
  einheit: string;
  /** Pfad der Gruppen-Überschriften (LG/ULG bzw. BoQ-Kategorien) */
  gruppe: string;
}

export interface AusschreibungsLV {
  bezeichnung: string;
  vorhaben?: string;
  auftraggeber?: string;
  quelle: "önorm" | "gaeb";
  positionen: AusschreibungsPosition[];
  /** Positionen ohne Menge (Vorbemerkungen/Vertragstexte) — nur gezählt. */
  uebersprungeneTextpositionen: number;
}

const ln = (e: Element) => e.localName || e.nodeName.replace(/^.*:/, "");

/** Kind-ELEMENTE (DOM-Level-2-sicher — funktioniert auch ohne .children). */
const alleKinder = (e: Element): Element[] =>
  Array.from(e.childNodes).filter(c => c.nodeType === 1) as Element[];

const kinder = (e: Element, name: string): Element[] =>
  alleKinder(e).filter(c => ln(c) === name);

const kind = (e: Element, name: string): Element | null => kinder(e, name)[0] || null;

/** Text eines Elements inkl. verschachtelter p/b/li — Absätze als Zeilen. */
const textVon = (e: Element | null): string => {
  if (!e) return "";
  const absaetze = kinder(e, "p");
  if (absaetze.length > 0) {
    return absaetze.map(p => (p.textContent || "").trim()).filter(Boolean).join("\n");
  }
  return (e.textContent || "").trim();
};

const zahl = (s: string | null | undefined): number => {
  const n = parseFloat(String(s ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Erkennt das Format und parst. Wirft Error mit verständlicher Meldung. */
export function parseAusschreibung(xmlText: string): AusschreibungsLV {
  // BOM entfernen (die Praxis-Dateien kommen mit UTF-8-BOM)
  const clean = xmlText.replace(/^﻿/, "");
  const doc = new DOMParser().parseFromString(clean, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Die Datei ist kein gültiges XML. Alte ÖNORM-B2063- oder GAEB-90-Datenträger (Textformat) werden nicht unterstützt — bitte als .onlv bzw. GAEB-XML exportieren.");
  }
  const root = doc.documentElement;
  const rootName = ln(root);
  if (rootName === "onlv") return parseOnlv(root);
  if (rootName === "GAEB") return parseGaeb(root);
  throw new Error(`Unbekanntes Format (Wurzelelement <${rootName}>). Unterstützt: ÖNORM A 2063 (.onlv) und GAEB DA XML (.x81/.x82/.x83).`);
}

// ── ÖNORM A 2063 (.onlv) ─────────────────────────────────────────────────────

function parseOnlv(root: Element): AusschreibungsLV {
  // <ausschreibungs-lv> (oder angebots-lv/vertrags-lv — gleiche Struktur)
  const lv = alleKinder(root).find(c => /-lv$/.test(ln(c)));
  if (!lv) throw new Error("Kein Leistungsverzeichnis in der Datei gefunden (<ausschreibungs-lv> fehlt).");

  const kenn = kind(lv, "kenndaten");
  const bezeichnung = textVon(kind(kenn || lv, "lvbezeichnung")) || "Ausschreibung";
  const vorhaben = textVon(kind(kenn || lv, "vorhaben"));
  const agFirma = kenn ? kind(kenn, "auftraggeber") : null;
  const agName = agFirma ? agFirma.getElementsByTagNameNS("*", "name")[0] : null;
  const auftraggeber = agName ? (agName.textContent || "").trim() : "";

  const positionen: AusschreibungsPosition[] = [];
  let uebersprungen = 0;

  const lgListe = lv.getElementsByTagNameNS("*", "lg");
  for (const lg of Array.from(lgListe)) {
    const lgNr = (lg as Element).getAttribute("nr") || "";
    const lgTitel = textVon(kind(kind(lg as Element, "lg-eigenschaften") || (lg as Element), "ueberschrift"));
    for (const ulg of kinder(kind(lg as Element, "ulg-liste") || (lg as Element), "ulg")) {
      const ulgNr = ulg.getAttribute("nr") || "";
      const ulgTitel = textVon(kind(kind(ulg, "ulg-eigenschaften") || ulg, "ueberschrift"));
      const gruppe = `${lgNr} ${lgTitel} › ${lgNr}.${ulgNr} ${ulgTitel}`.trim();
      const posListe = kind(ulg, "positionen");
      if (!posListe) continue;
      for (const gt of kinder(posListe, "grundtextnr")) {
        const gtNr = gt.getAttribute("nr") || "";
        // Gemeinsamer Grundtext gilt für alle Folgepositionen darunter
        const grundtext = textVon(kind(kind(gt, "grundtext") || gt, "langtext"));
        for (const pos of alleKinder(gt)) {
          const t = ln(pos);
          if (t !== "folgeposition" && t !== "ungeteilteposition") continue;
          const pe = kind(pos, "pos-eigenschaften");
          if (!pe) continue;
          const ft = pos.getAttribute("ftnr") || "";
          const nr = `${lgNr}.${ulgNr}.${gtNr}${ft}`;
          const stichwort = textVon(kind(pe, "stichwort"));
          const menge = zahl(textVon(kind(pe, "lvmenge")));
          const einheit = textVon(kind(pe, "einheit"));
          const eigenerText = textVon(kind(pe, "langtext"));
          if (!(menge > 0)) { uebersprungen++; continue; } // Vorbemerkungs-/Textpositionen
          positionen.push({
            nr,
            kurztext: stichwort || `Position ${nr}`,
            langtext: [grundtext, eigenerText].filter(Boolean).join("\n"),
            menge,
            einheit: einheit || "Stk.",
            gruppe,
          });
        }
      }
    }
  }

  return { bezeichnung, vorhaben, auftraggeber, quelle: "önorm", positionen, uebersprungeneTextpositionen: uebersprungen };
}

// ── GAEB DA XML (.x81/.x82/.x83) ─────────────────────────────────────────────

function parseGaeb(root: Element): AusschreibungsLV {
  const award = root.getElementsByTagNameNS("*", "Award")[0] as Element | undefined;
  const boq = (award || root).getElementsByTagNameNS("*", "BoQ")[0] as Element | undefined;
  if (!boq) throw new Error("Kein Leistungsverzeichnis (BoQ) in der GAEB-Datei gefunden.");

  const prjInfo = root.getElementsByTagNameNS("*", "PrjInfo")[0] as Element | undefined;
  const bezeichnung = prjInfo
    ? textVon(kind(prjInfo, "LblPrj")) || textVon(kind(prjInfo, "NamePrj")) || "GAEB-Ausschreibung"
    : "GAEB-Ausschreibung";

  const positionen: AusschreibungsPosition[] = [];
  let uebersprungen = 0;

  const walk = (el: Element, nrTeile: string[], titel: string[]) => {
    for (const c of alleKinder(el)) {
      const t = ln(c);
      if (t === "BoQBody") { walk(c, nrTeile, titel); continue; }
      if (t === "BoQCtgy") {
        const rno = c.getAttribute("RNoPart") || "";
        const lbl = textVon(kind(c, "LblTx"));
        walk(c, [...nrTeile, rno], lbl ? [...titel, lbl] : titel);
        continue;
      }
      if (t === "Itemlist") {
        for (const item of kinder(c, "Item")) {
          const rno = item.getAttribute("RNoPart") || "";
          const nr = [...nrTeile, rno].filter(Boolean).join(".");
          const menge = zahl(textVon(kind(item, "Qty")));
          const einheit = textVon(kind(item, "QU"));
          const desc = kind(item, "Description");
          let kurz = "", lang = "";
          if (desc) {
            const outline = desc.getElementsByTagNameNS("*", "OutlineText")[0] as Element | undefined;
            kurz = outline ? (outline.textContent || "").trim() : "";
            const complete = desc.getElementsByTagNameNS("*", "CompleteText")[0] as Element | undefined;
            if (complete) {
              const detail = complete.getElementsByTagNameNS("*", "DetailTxt")[0] as Element | undefined;
              lang = detail ? (detail.textContent || "").replace(/\s+\n/g, "\n").trim() : (complete.textContent || "").trim();
            }
          }
          if (!(menge > 0)) { uebersprungen++; continue; }
          positionen.push({
            nr,
            kurztext: kurz || lang.split("\n")[0]?.slice(0, 80) || `Position ${nr}`,
            langtext: lang,
            menge,
            einheit: einheit || "Stk.",
            gruppe: titel.join(" › "),
          });
        }
      }
    }
  };
  walk(boq, [], []);

  return { bezeichnung, quelle: "gaeb", positionen, uebersprungeneTextpositionen: uebersprungen };
}
