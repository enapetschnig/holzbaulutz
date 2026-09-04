import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { istArbeitszeitZeile } from "@/lib/stunden";

/**
 * Materialliste aus einem Angebot: löst die Material-Komponenten aller
 * kalkulierten Positionen auf (Bedarf = Positions-Menge × Menge/EH inkl.
 * Verschnitt), fasst gleiches Material zusammen und erzeugt daraus ein
 * PDF (interne Arbeitsliste — ohne Preise für die Baustelle geeignet? Nein:
 * bewusst MIT EK-Preisen als interne Einkaufshilfe, siehe Spalten).
 */

export interface MaterialZeile {
  material: string;
  menge: number;
  einheit: string;
  /** EK je Einheit (falls bekannt) — interne Info für den Einkauf */
  ek: number;
  /** Aus welchen Positionen der Bedarf stammt */
  quellen: string[];
}

export async function sammleMaterialliste(invoiceId: string): Promise<MaterialZeile[]> {
  const { data: items } = await supabase
    .from("invoice_items")
    .select("beschreibung, kurztext, menge, einheit, einzelpreis, ek_preis, arbeitszeit_minuten, kalkulation_template_id, mwst_exempt, eventual")
    .eq("invoice_id", invoiceId)
    .order("position");
  if (!items) return [];

  const templateIds = Array.from(new Set(
    items.map(i => (i as any).kalkulation_template_id).filter(Boolean),
  )) as string[];
  const componentsByTemplate: Record<string, any[]> = {};
  // Katalog-Stammdaten der verknüpften Positionen: Ein Katalog-MATERIAL
  // (art = "material") hat keine Komponenten — es IST das Material. Ohne
  // diese Info fiel es früher in den Legacy-Zweig und wurde dort mangels
  // ek_preis auf der Position verworfen (Meldung 03.09.: „Materialliste
  // erfasst nur die Materialien, die nicht vom Katalog kommen").
  type Tpl = { art: string | null; ist_stundensatz: boolean | null; ek_netto: number | null; einheit: string | null; kurzbezeichnung: string | null; name: string | null };
  const templateById: Record<string, Tpl> = {};
  if (templateIds.length > 0) {
    const [{ data: comps }, { data: tpls }] = await Promise.all([
      (supabase as any)
        .from("position_components")
        .select("position_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, material:invoice_templates!material_template_id(ek_netto)")
        .in("position_template_id", templateIds)
        .limit(10000),
      (supabase as any)
        .from("invoice_templates")
        .select("id, art, ist_stundensatz, ek_netto, einheit, kurzbezeichnung, name")
        .in("id", templateIds),
    ]);
    for (const c of ((comps as any[]) || [])) {
      (componentsByTemplate[c.position_template_id] = componentsByTemplate[c.position_template_id] || []).push(c);
    }
    for (const t of ((tpls as any[]) || [])) templateById[t.id] = t;
  }

  // Gleiches Material zusammenfassen (Name + Einheit)
  const map = new Map<string, MaterialZeile>();
  const add = (material: string, menge: number, einheit: string, ek: number, quelle: string) => {
    if (!(menge > 0)) return;
    const key = `${material.toLowerCase().trim()}|${einheit.toLowerCase().trim()}`;
    const vorhanden = map.get(key);
    if (vorhanden) {
      vorhanden.menge = Math.round((vorhanden.menge + menge) * 100) / 100;
      if (quelle && !vorhanden.quellen.includes(quelle)) vorhanden.quellen.push(quelle);
      if (!vorhanden.ek && ek) vorhanden.ek = ek;
    } else {
      map.set(key, { material, menge: Math.round(menge * 100) / 100, einheit, ek, quellen: quelle ? [quelle] : [] });
    }
  };

  for (const it of items) {
    if ((it as any).mwst_exempt) continue; // Abzugszeilen
    if ((it as any).eventual) continue;    // Eventualposition: nicht beauftragt, nichts einkaufen
    const menge = Number(it.menge) || 0;
    if (menge <= 0) continue;
    const text = (it as any).kurztext || it.beschreibung || "";
    const quelle = text.slice(0, 60);
    const tpl = templateById[(it as any).kalkulation_template_id as string];
    // Eigene Arbeitsstunden (Regiestunde, Facharbeiterstunde …) sind kein Material
    if (tpl?.ist_stundensatz || istArbeitszeitZeile(text, it.einheit)) continue;
    const comps = componentsByTemplate[(it as any).kalkulation_template_id as string] || [];
    const matComps = comps.filter(c => c.typ === "material");
    if (matComps.length > 0) {
      for (const c of matComps) {
        const bedarf = menge * (Number(c.menge_pro_einheit) || 0) * (1 + (Number(c.verschnitt_prozent) || 0) / 100);
        add(c.bezeichnung || "Material", bedarf, c.einheit || "Stk.", Number(c.material?.ek_netto ?? c.preis) || 0, quelle);
      }
    } else if (tpl && tpl.art === "material") {
      // Katalog-Material direkt als Angebotsposition: Bedarf = Angebotsmenge,
      // EK aktuell aus dem Katalog (auf der Position steht nur der VK).
      add(tpl.kurzbezeichnung || tpl.name || text || "Material", menge, it.einheit || tpl.einheit || "Stk.",
        Number(tpl.ek_netto) || Number((it as any).ek_preis) || 0, "");
    } else {
      // Freie/Legacy-Position: reine Lohn-Zeilen überspringen (kein Material)
      const einheitLower = String(it.einheit || "").toLowerCase().trim();
      const istLohnEinheit = /^(std|std\.|h|stunde|stunden)$/.test(einheitLower);
      const hatKeinMaterialEk = (Number((it as any).ek_preis) || 0) === 0;
      const hatArbeitszeit = (Number((it as any).arbeitszeit_minuten) || 0) > 0;
      if ((istLohnEinheit && hatKeinMaterialEk) || (hatKeinMaterialEk && hatArbeitszeit)) continue;
      if (hatKeinMaterialEk) continue; // ohne EK keine sinnvolle Materialzeile
      add(quelle || "Material", menge, it.einheit || "Stk.", Number((it as any).ek_preis) || 0, "");
    }
  }

  return [...map.values()].sort((a, b) => a.material.localeCompare(b.material, "de"));
}

/** Erzeugt das Materiallisten-PDF und liefert es als Blob. */
export function generateMateriallistePdf(
  kopf: { nummer: string; kunde_name: string; datum: string; projektName?: string | null },
  zeilen: MaterialZeile[],
  logoUri?: string,
): Blob {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  if (logoUri) {
    try {
      const props = (doc as any).getImageProperties(logoUri);
      const h = 20;
      const w = h * (props.width / props.height);
      doc.addImage(logoUri, "PNG", pageWidth - 14 - w, y, w, h);
    } catch { /* Logo optional */ }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Materialliste", 14, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  const datumStr = kopf.datum ? new Date(kopf.datum + "T12:00:00").toLocaleDateString("de-AT") : "";
  doc.text(`Angebot ${kopf.nummer} · ${kopf.kunde_name}${kopf.projektName ? ` · Projekt: ${kopf.projektName}` : ""} · ${datumStr}`, 14, y + 15);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: y + 22,
    head: [["Material", "Menge", "Einheit", "EK/EH", "Verwendet in"]],
    body: zeilen.map(z => [
      z.material,
      z.menge.toLocaleString("de-AT", { maximumFractionDigits: 2 }),
      z.einheit,
      z.ek > 0 ? `€ ${z.ek.toFixed(2)}` : "–",
      z.quellen.slice(0, 2).join(", ") + (z.quellen.length > 2 ? " …" : ""),
    ]),
    styles: { fontSize: 8.5, cellPadding: 1.8 },
    headStyles: { fillColor: [14, 90, 68], fontSize: 9 },
    columnStyles: {
      1: { halign: "right", cellWidth: 20 },
      2: { cellWidth: 18 },
      3: { halign: "right", cellWidth: 20 },
      4: { textColor: [120, 120, 120], fontSize: 7.5 },
    },
  });

  const endY = (doc as any).lastAutoTable?.finalY || y + 30;
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text(
    `Interne Liste (inkl. Verschnitt) — erzeugt am ${new Date().toLocaleDateString("de-AT")}. Mengen aus der Kalkulation des Angebots.`,
    14, Math.min(endY + 8, doc.internal.pageSize.getHeight() - 10),
  );

  return doc.output("blob");
}
