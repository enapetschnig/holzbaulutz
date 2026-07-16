import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Euro, AlertTriangle, FileClock } from "lucide-react";

/**
 * Offene-Posten-Widget fürs Admin-Dashboard — beantwortet auf einen Blick
 * "Wo steht Geld aus?": offene Forderungen, davon überfällig, und Angebote
 * die demnächst ablaufen. Jede Kachel ist klickbar und führt in die
 * (gefilterte) Rechnungs-/Angebotsliste. Reine Lese-Ansicht.
 */
const INVOICE_LIKE = new Set(["rechnung", "anzahlungsrechnung", "schlussrechnung"]);

const fmt = (n: number) => n.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function OffenePostenWidget() {
  const navigate = useNavigate();
  const [offen, setOffen] = useState(0);
  const [offenCount, setOffenCount] = useState(0);
  const [ueberfaellig, setUeberfaellig] = useState(0);
  const [ueberfaelligCount, setUeberfaelligCount] = useState(0);
  const [ablaufend, setAblaufend] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const heute = new Date().toISOString().slice(0, 10);
      const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("invoices")
        .select("typ, status, brutto_summe, bezahlt_betrag, faellig_am, gueltig_bis, archiviert")
        .in("status", ["offen", "teilbezahlt"]);
      if (cancelled) return;
      let offenSum = 0, offenN = 0, ufSum = 0, ufN = 0;
      for (const i of ((data as any[]) || [])) {
        if (i.archiviert) continue;
        if (!INVOICE_LIKE.has(i.typ)) continue;
        const rest = Math.round((Number(i.brutto_summe) - Number(i.bezahlt_betrag || 0)) * 100) / 100;
        if (rest <= 0) continue;
        offenSum += rest; offenN++;
        if (i.faellig_am && i.faellig_am < heute) { ufSum += rest; ufN++; }
      }
      // Angebote, die in den nächsten 14 Tagen ablaufen (offen/angenommen)
      const { count: ablCount } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("typ", "angebot")
        .in("status", ["offen", "angenommen"])
        .gte("gueltig_bis", heute)
        .lte("gueltig_bis", in14);
      if (cancelled) return;
      setOffen(offenSum); setOffenCount(offenN);
      setUeberfaellig(ufSum); setUeberfaelligCount(ufN);
      setAblaufend(ablCount ?? 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;

  const Kachel = ({ icon, label, wert, sub, tone, onClick }: any) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 text-left rounded-lg border p-3 transition-colors hover:bg-muted/50 ${tone}`}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">{icon}{label}</div>
      <div className="text-lg font-bold tabular-nums">{wert}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </button>
  );

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Kachel
            icon={<Euro className="w-3.5 h-3.5" />}
            label="Offene Forderungen"
            wert={`€ ${fmt(offen)}`}
            sub={`${offenCount} Rechnung${offenCount === 1 ? "" : "en"}`}
            tone=""
            onClick={() => navigate("/invoices")}
          />
          <Kachel
            icon={<AlertTriangle className={`w-3.5 h-3.5 ${ueberfaellig > 0 ? "text-destructive" : ""}`} />}
            label="Davon überfällig"
            wert={<span className={ueberfaellig > 0 ? "text-destructive" : ""}>€ {fmt(ueberfaellig)}</span>}
            sub={`${ueberfaelligCount} überfällig`}
            tone={ueberfaellig > 0 ? "border-destructive/40 bg-destructive/5" : ""}
            onClick={() => navigate("/invoices")}
          />
          <Kachel
            icon={<FileClock className={`w-3.5 h-3.5 ${ablaufend > 0 ? "text-amber-600" : ""}`} />}
            label="Angebote laufen ab"
            wert={<span className={ablaufend > 0 ? "text-amber-700" : ""}>{ablaufend}</span>}
            sub="in den nächsten 14 Tagen"
            tone={ablaufend > 0 ? "border-amber-300 bg-amber-50" : ""}
            onClick={() => navigate("/invoices?typ=angebot")}
          />
        </div>
      </CardContent>
    </Card>
  );
}
