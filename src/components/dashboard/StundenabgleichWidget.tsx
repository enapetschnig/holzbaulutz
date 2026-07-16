import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { istArbeitszeitZeile } from "@/lib/stunden";

/**
 * Stundenabgleich auf der Startseite (Admin): pro aktivem Projekt die im
 * Angebot kalkulierten Lohnstunden (Σ arbeitszeit_minuten × Menge des
 * jüngsten nicht stornierten Angebots) gegen die tatsächlich gebuchten
 * Stunden (time_entries) stellen.
 */

interface Zeile {
  projectId: string;
  name: string;
  angeboten: number; // Stunden laut Angebot
  gebucht: number;   // gebuchte Stunden
}

export function StundenabgleichWidget() {
  const navigate = useNavigate();
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Aktive Projekte (nicht abgeschlossen)
        const { data: projects } = await supabase
          .from("projects")
          .select("id, name, status")
          .not("status", "in", '("Abgeschlossen","abgeschlossen")')
          .order("created_at", { ascending: false })
          .limit(10);
        const projs = projects || [];
        if (projs.length === 0) { if (!cancelled) { setZeilen([]); setLoading(false); } return; }
        const ids = projs.map(p => p.id);

        // Gebuchte Stunden je Projekt (eine Abfrage)
        const { data: entries } = await supabase
          .from("time_entries")
          .select("project_id, stunden")
          .in("project_id", ids);
        const gebuchtMap: Record<string, number> = {};
        for (const e of (entries || [])) {
          if (!e.project_id) continue;
          gebuchtMap[e.project_id] = (gebuchtMap[e.project_id] || 0) + (Number(e.stunden) || 0);
        }

        // Referenz-Angebot je Projekt → Lohnminuten. Nach Status priorisiert
        // (angenommen > verrechnet > offen > entwurf), innerhalb desselben
        // Status das neueste Datum — abgelehnte/stornierte zählen nicht, sonst
        // verdrängt ein Entwurf/abgelehntes Angebot das angenommene.
        const { data: angebote } = await supabase
          .from("invoices")
          .select("id, project_id, datum, status")
          .in("project_id", ids)
          .eq("typ", "angebot")
          .not("status", "in", '("storniert","abgelehnt")')
          // Archivierte Vorgänger-Revisionen ausschließen
          .or("archiviert.is.null,archiviert.eq.false")
          .order("datum", { ascending: false });
        const statusRang: Record<string, number> = { angenommen: 0, verrechnet: 1, offen: 2, entwurf: 3 };
        const angebotByProject: Record<string, { id: string; rang: number }> = {};
        for (const a of (angebote || [])) {
          if (!a.project_id) continue;
          const rang = statusRang[(a as any).status] ?? 4;
          const bisher = angebotByProject[a.project_id];
          // Liste ist datum-absteigend → der erste Treffer je Rang ist der neueste
          if (!bisher || rang < bisher.rang) angebotByProject[a.project_id] = { id: a.id, rang };
        }
        const angebotIds = Object.values(angebotByProject).map(x => x.id);
        const angebotenMap: Record<string, number> = {};
        if (angebotIds.length > 0) {
          const { data: items } = await supabase
            .from("invoice_items")
            .select("invoice_id, menge, einheit, arbeitszeit_minuten, kurztext, beschreibung")
            .in("invoice_id", angebotIds);
          // Zwei Stufen (wie in der Projekt-Ansicht): explizite Stunden-Posten
          // (z.B. "Facharbeiterstunde × 25 Std") zählen als Soll; nur wenn es
          // keine gibt, fällt das Soll auf die kalkulierte Arbeitszeit der
          // Positionen zurück (interne Preisbasis).
          const explizitByInvoice: Record<string, number> = {};
          const kalkMinByInvoice: Record<string, number> = {};
          for (const it of ((items || []) as any[])) {
            const menge = Number(it.menge) || 0;
            if (istArbeitszeitZeile(it.kurztext || it.beschreibung, it.einheit)) {
              explizitByInvoice[it.invoice_id] = (explizitByInvoice[it.invoice_id] || 0) + menge;
            }
            kalkMinByInvoice[it.invoice_id] = (kalkMinByInvoice[it.invoice_id] || 0)
              + (Number(it.arbeitszeit_minuten) || 0) * menge;
          }
          for (const [pid, ref] of Object.entries(angebotByProject)) {
            const explizit = explizitByInvoice[ref.id] || 0;
            const kalk = (kalkMinByInvoice[ref.id] || 0) / 60;
            angebotenMap[pid] = Math.round((explizit > 0 ? explizit : kalk) * 10) / 10;
          }
        }

        const rows: Zeile[] = projs
          .map(p => ({
            projectId: p.id,
            name: p.name,
            angeboten: angebotenMap[p.id] || 0,
            gebucht: Math.round((gebuchtMap[p.id] || 0) * 10) / 10,
          }))
          .filter(r => r.angeboten > 0 || r.gebucht > 0);
        if (!cancelled) setZeilen(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading || zeilen.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Stundenabgleich — Angebot vs. gebucht
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {zeilen.map(z => {
          const hatAngebot = z.angeboten > 0;
          const pctRaw = hatAngebot ? Math.round((z.gebucht / z.angeboten) * 100) : 0;
          const pct = Math.min(100, pctRaw);
          const ueber = hatAngebot && z.gebucht > z.angeboten;
          const knapp = hatAngebot && !ueber && pctRaw >= 80;
          const barFarbe = ueber ? "bg-destructive" : knapp ? "bg-amber-500" : "bg-green-600";
          return (
            <button
              key={z.projectId}
              type="button"
              onClick={() => navigate(`/projects/${z.projectId}`)}
              className="w-full text-left space-y-1 rounded-md p-2 -m-2 hover:bg-muted/50 transition-colors"
            >
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-sm font-medium truncate">{z.name}</span>
                <span className="flex items-center gap-2 shrink-0">
                  {hatAngebot && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold tabular-nums ${ueber ? "bg-destructive/10 text-destructive" : knapp ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                      {pctRaw}%
                    </span>
                  )}
                  <span className={`text-xs tabular-nums ${ueber ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                    {z.gebucht.toFixed(1)} / {hatAngebot ? z.angeboten.toFixed(1) : "–"} Std.
                  </span>
                </span>
              </div>
              {hatAngebot && (
                <>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barFarbe}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className={`text-[11px] ${ueber ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {ueber
                      ? `⚠️ ${(z.gebucht - z.angeboten).toFixed(1)} Std. über dem Angebot`
                      : `${(z.angeboten - z.gebucht).toFixed(1)} Std. verbleibend`}
                  </p>
                </>
              )}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
