import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { ladeStundenabgleich, type Stundenabgleich } from "@/lib/stundenabgleich";

/**
 * Stundenabgleich auf der Startseite (Admin): pro aktivem Projekt Angebot
 * vs. gebucht. Die Regeln (alle angenommenen Angebote zusammen, Regie nur
 * wenn im Angebot) liegen in lib/stundenabgleich.ts — gleich wie in der
 * Projektübersicht.
 */

interface Zeile { projectId: string; name: string; a: Stundenabgleich }

export function StundenabgleichWidget() {
  const navigate = useNavigate();
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: projects } = await supabase
          .from("projects")
          .select("id, name, status")
          .not("status", "in", '("Abgeschlossen","abgeschlossen")')
          .order("created_at", { ascending: false })
          .limit(10);
        const projs = projects || [];
        if (projs.length === 0) { if (!cancelled) { setZeilen([]); setLoading(false); } return; }
        const abgleich = await ladeStundenabgleich(projs.map(p => p.id));
        const rows: Zeile[] = projs
          .map(p => ({ projectId: p.id, name: p.name, a: abgleich[p.id] }))
          .filter(r => r.a && (r.a.soll > 0 || r.a.ist > 0 || r.a.regieZusatz > 0));
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
        {zeilen.map(({ projectId, name, a }) => {
          const hatAngebot = a.soll > 0;
          const pctRaw = hatAngebot ? Math.round((a.ist / a.soll) * 100) : 0;
          const pct = Math.min(100, pctRaw);
          const ueber = hatAngebot && a.ist > a.soll;
          const knapp = hatAngebot && !ueber && pctRaw >= 80;
          const barFarbe = ueber ? "bg-destructive" : knapp ? "bg-amber-500" : "bg-green-600";
          return (
            <button
              key={projectId}
              type="button"
              onClick={() => navigate(`/projects/${projectId}`)}
              className="w-full text-left space-y-1 rounded-md p-2 -m-2 hover:bg-muted/50 transition-colors"
            >
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-sm font-medium truncate">{name}</span>
                <span className="flex items-center gap-2 shrink-0">
                  {hatAngebot && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold tabular-nums ${ueber ? "bg-destructive/10 text-destructive" : knapp ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                      {pctRaw}%
                    </span>
                  )}
                  <span className={`text-xs tabular-nums ${ueber ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                    {a.ist.toFixed(1)} / {hatAngebot ? a.soll.toFixed(1) : "–"} Std.
                  </span>
                </span>
              </div>
              {hatAngebot && (
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barFarbe}`} style={{ width: `${pct}%` }} />
                </div>
              )}
              <p className={`text-[11px] ${ueber ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                {hatAngebot
                  ? (ueber
                      ? `⚠️ ${(a.ist - a.soll).toFixed(1)} Std. über dem Angebot`
                      : `${(a.soll - a.ist).toFixed(1)} Std. verbleibend`)
                  : "Kein Angebot mit Stunden"}
                {a.regieImAngebot && a.gebuchtRegie > 0 && ` · davon ${a.gebuchtRegie.toFixed(1)} Regiestd.`}
                {a.regieZusatz > 0 && ` · + ${a.regieZusatz.toFixed(1)} Regiestd. zusätzlich (nicht im Angebot)`}
              </p>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
