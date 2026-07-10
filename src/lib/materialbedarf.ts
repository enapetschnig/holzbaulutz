import { supabase } from "@/integrations/supabase/client";

/**
 * Erzeugt die Projekt-Materialliste (Soll-Bedarf) aus einem Angebot.
 *
 * Logik nach dem Excel-Modell: Angebots-Positionen sind kalkulierte
 * Leistungen aus Material-Komponenten. Für die Materialliste wird jede
 * Material-Komponente aufgelöst: Bedarf = Positions-Menge x Menge/EH
 * (inkl. Verschnitt). Positionen ohne Komponenten (Legacy/frei) landen
 * als eigene Zeile. Reine Lohn-/Sonstiges-Anteile erscheinen nicht.
 *
 * Idempotent: bestehende Bedarf-Zeilen dieses Angebots werden ersetzt
 * (source_invoice_id). Läuft best effort — Fehler blockieren das
 * Speichern des Angebots nicht.
 */
export async function generateMaterialbedarfFromAngebot(invoiceId: string, projectId: string): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: items } = await supabase
    .from("invoice_items")
    .select("beschreibung, kurztext, menge, einheit, einzelpreis, ek_preis, arbeitszeit_minuten, ist_kalkuliert, kalkulation_template_id")
    .eq("invoice_id", invoiceId)
    .order("position");
  if (!items || items.length === 0) return 0;

  // Komponenten aller verknüpften Positionen in einem Rutsch laden
  const templateIds = Array.from(new Set(
    items.map(i => (i as any).kalkulation_template_id).filter(Boolean)
  )) as string[];
  const componentsByTemplate: Record<string, any[]> = {};
  if (templateIds.length > 0) {
    const { data: comps } = await (supabase as any)
      .from("position_components")
      .select("position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, material:invoice_templates!material_template_id(ek_netto)")
      .in("position_template_id", templateIds);
    for (const c of ((comps as any[]) || [])) {
      (componentsByTemplate[c.position_template_id] = componentsByTemplate[c.position_template_id] || []).push(c);
    }
  }

  const rows: any[] = [];
  const heute = new Date().toISOString().slice(0, 10);
  for (const it of items) {
    const menge = Number(it.menge) || 0;
    if (menge <= 0) continue;
    const comps = componentsByTemplate[(it as any).kalkulation_template_id as string] || [];
    const matComps = comps.filter(c => c.typ === "material");
    if (matComps.length > 0) {
      // Komponenten auflösen: Bedarf inkl. Verschnitt
      for (const c of matComps) {
        const bedarfMenge = menge * (Number(c.menge_pro_einheit) || 0) * (1 + (Number(c.verschnitt_prozent) || 0) / 100);
        if (bedarfMenge <= 0) continue;
        rows.push({
          project_id: projectId,
          user_id: user.id,
          source_invoice_id: invoiceId,
          material: c.bezeichnung || "Material",
          menge: String(Math.round(bedarfMenge * 100) / 100),
          einheit: c.einheit || "Stk.",
          einzelpreis: Number(c.material?.ek_netto ?? c.preis) || 0,
          typ: "bedarf",
          datum: heute,
          notizen: `Aus Angebot: ${(it as any).kurztext || it.beschreibung}`,
        });
      }
    } else {
      // Legacy-Kalkulation oder freie Position: als Sammelzeile aufnehmen —
      // aber reine Lohn-Positionen (kein Material-EK) überspringen.
      const istNurLohn = !!(it as any).ist_kalkuliert
        && (Number((it as any).ek_preis) || 0) === 0
        && (Number((it as any).arbeitszeit_minuten) || 0) > 0;
      if (istNurLohn) continue;
      rows.push({
        project_id: projectId,
        user_id: user.id,
        source_invoice_id: invoiceId,
        material: (it as any).kurztext || it.beschreibung,
        menge: String(menge),
        einheit: it.einheit || "Stk.",
        einzelpreis: Number((it as any).ek_preis) || Number(it.einzelpreis) || 0,
        typ: "bedarf",
        datum: heute,
        notizen: "Aus Angebot (Position ohne Material-Komponenten)",
      });
    }
  }

  // Idempotent ersetzen
  await (supabase as any).from("material_entries").delete().eq("source_invoice_id", invoiceId);
  if (rows.length > 0) {
    const { error } = await (supabase as any).from("material_entries").insert(rows);
    if (error) {
      console.warn("Materialbedarf konnte nicht gespeichert werden:", error.message);
      return 0;
    }
  }
  return rows.length;
}
