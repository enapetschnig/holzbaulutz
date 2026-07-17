import { supabase } from "@/integrations/supabase/client";

/**
 * Sammelt alle Beleg-IDs derselben Dokumentkette (Angebot → AB → Rechnung …),
 * ausgehend von einem beliebigen Knoten: erst per parent_invoice_id zur Wurzel
 * hochwandern, dann alle Nachfahren einsammeln. So kann der Material-Soll für
 * die GANZE Kette ersetzt werden — sonst hinterlässt jeder Beleg (z.B. Angebot
 * UND die daraus erzeugte Auftragsbestätigung) eigene Bedarf-Zeilen und der
 * Soll wird doppelt gezählt.
 */
async function collectChainIds(invoiceId: string): Promise<string[]> {
  // Zur Wurzel hoch — sowohl entlang parent_invoice_id (Umwandeln-Kette)
  // als auch entlang vorgaenger_id (Preis-REVISIONEN: AN…-R2 hängt über
  // vorgaenger_id am Original; ohne diesen Pfad würde der Bedarf des
  // Originals nie gefunden und nach einer Revision doppelt gezählt).
  let root = invoiceId;
  let cursor: string | null = invoiceId;
  for (let i = 0; i < 8 && cursor; i++) {
    const { data } = await supabase
      .from("invoices").select("id, parent_invoice_id, vorgaenger_id").eq("id", cursor).maybeSingle();
    if (!data) break;
    root = (data as any).id;
    cursor = (data as any).parent_invoice_id || (data as any).vorgaenger_id || null;
  }
  // Von der Wurzel alle Nachfahren einsammeln (Breitensuche über BEIDE
  // Verknüpfungen, bounded)
  const ids = new Set<string>([root]);
  let frontier = [root];
  for (let depth = 0; depth < 8 && frontier.length > 0; depth++) {
    const [kinder, revisionen] = await Promise.all([
      supabase.from("invoices").select("id").in("parent_invoice_id", frontier),
      (supabase as any).from("invoices").select("id").in("vorgaenger_id", frontier),
    ]);
    const next = [...(((kinder as any).data as any[]) || []), ...(((revisionen as any).data as any[]) || [])]
      .map(r => r.id).filter((id: string) => !ids.has(id));
    next.forEach((id: string) => ids.add(id));
    frontier = next;
  }
  ids.add(invoiceId);
  return Array.from(ids);
}

/**
 * Erzeugt die Projekt-Materialliste (Soll-Bedarf) aus einem Angebot.
 *
 * Logik nach dem Excel-Modell: Angebots-Positionen sind kalkulierte
 * Leistungen aus Material-Komponenten. Für die Materialliste wird jede
 * Material-Komponente aufgelöst: Bedarf = Positions-Menge x Menge/EH
 * (inkl. Verschnitt). Positionen ohne Komponenten (Legacy/frei) landen
 * als eigene Zeile. Reine Lohn-/Sonstiges-Anteile erscheinen nicht.
 *
 * Idempotent über die GANZE Dokumentkette: bestehende Bedarf-Zeilen aller
 * Belege derselben Kette (Angebot/AB/…) werden ersetzt, damit der Soll nie
 * doppelt gezählt wird. Läuft best effort — Fehler blockieren das Speichern
 * des Angebots nicht, werden aber sichtbar geloggt.
 */
export async function generateMaterialbedarfFromAngebot(invoiceId: string, projectId: string): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: items } = await supabase
    .from("invoice_items")
    .select("beschreibung, kurztext, menge, einheit, einzelpreis, ek_preis, arbeitszeit_minuten, ist_kalkuliert, kalkulation_template_id")
    .eq("invoice_id", invoiceId)
    .order("position");
  // Nur bei Ladefehler (items === null) nichts anfassen. Bei 0 Positionen
  // NICHT early-returnen: der alte Soll der Kette muss trotzdem gelöscht
  // werden (Angebot wurde leergeräumt) — der Insert entfällt dann von selbst.
  if (!items) return 0;

  // Komponenten aller verknüpften Positionen in einem Rutsch laden
  const templateIds = Array.from(new Set(
    items.map(i => (i as any).kalkulation_template_id).filter(Boolean)
  )) as string[];
  const componentsByTemplate: Record<string, any[]> = {};
  if (templateIds.length > 0) {
    const { data: comps } = await (supabase as any)
      .from("position_components")
      .select("position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, material:invoice_templates!material_template_id(ek_netto)")
      .in("position_template_id", templateIds)
      .limit(10000);
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
      // aber reine Lohn-/Leistungspositionen überspringen (kein Material).
      // Erkennung unabhängig von ist_kalkuliert: eine Positions-Einheit in
      // Stunden (Std/h) ODER hinterlegte Arbeitszeit ohne Material-EK ist Lohn
      // (Montage, Anfahrt/Regie, Baustelleneinrichtung, Entsorgung …) und
      // gehört nicht in den Material-Soll.
      const einheitLower = String(it.einheit || "").toLowerCase().trim();
      const istLohnEinheit = /^(std|std\.|h|stunde|stunden|std\/h)$/.test(einheitLower);
      const hatKeinMaterialEk = (Number((it as any).ek_preis) || 0) === 0;
      const hatArbeitszeit = (Number((it as any).arbeitszeit_minuten) || 0) > 0;
      const istNurLohn = (istLohnEinheit && hatKeinMaterialEk)
        || (hatKeinMaterialEk && hatArbeitszeit);
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

  // Idempotent über die GANZE Dokumentkette ersetzen: Bedarf-Zeilen ALLER
  // Belege derselben Kette (Angebot, daraus erzeugte Auftragsbestätigung, …)
  // entfernen, sonst zählt der Material-Soll doppelt. Danach nur die Zeilen
  // dieses Belegs neu schreiben — der zuletzt gespeicherte Beleg der Kette
  // ist die einzige aktive Soll-Quelle.
  const chainIds = await collectChainIds(invoiceId);
  await (supabase as any).from("material_entries")
    .delete().eq("typ", "bedarf").in("source_invoice_id", chainIds);
  if (rows.length > 0) {
    const { error } = await (supabase as any).from("material_entries").insert(rows);
    if (error) {
      console.error("Materialbedarf konnte nicht gespeichert werden:", error.message);
      throw new Error(`Materialbedarf: ${error.message}`);
    }
  }
  return rows.length;
}
