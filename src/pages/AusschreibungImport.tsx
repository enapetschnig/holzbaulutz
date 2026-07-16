import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { FileUp, FileText, ClipboardList, ArrowRight } from "lucide-react";
import { parseAusschreibung, type AusschreibungsLV } from "@/lib/ausschreibung";

/**
 * Ausschreibung importieren: ÖNORM-A-2063-Datenträger (.onlv) oder
 * GAEB-DA-XML (.x81/.x82/.x83) einlesen → Positionen prüfen/auswählen →
 * als neues Angebot übernehmen, wo nur noch die PREISE einzutragen sind.
 */

export default function AusschreibungImport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lv, setLv] = useState<AusschreibungsLV | null>(null);
  const [dateiname, setDateiname] = useState("");
  const [abgewaehlt, setAbgewaehlt] = useState<Set<string>>(new Set());

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const geparst = parseAusschreibung(text);
      if (geparst.positionen.length === 0) {
        toast({ variant: "destructive", title: "Keine Positionen gefunden", description: "Die Datei enthält keine Positionen mit Mengenangabe." });
        return;
      }
      setLv(geparst);
      setDateiname(file.name);
      setAbgewaehlt(new Set());
      toast({
        title: "Ausschreibung eingelesen",
        description: `${geparst.positionen.length} Positionen aus „${geparst.bezeichnung}" (${geparst.quelle === "önorm" ? "ÖNORM A 2063" : "GAEB DA XML"})`,
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Datei konnte nicht gelesen werden", description: e?.message || "Unbekannter Fehler" });
    }
  };

  const toggle = (nr: string) => {
    setAbgewaehlt(prev => {
      const next = new Set(prev);
      if (next.has(nr)) next.delete(nr); else next.add(nr);
      return next;
    });
  };

  const gewaehlte = (lv?.positionen || []).filter(p => !abgewaehlt.has(p.nr));

  const alsAngebot = () => {
    if (!lv || gewaehlte.length === 0) return;
    // Übergabe an den Angebots-Editor via sessionStorage — der Editor liest
    // den Schlüssel beim Anlegen eines neuen Angebots und leert ihn.
    sessionStorage.setItem("ausschreibung_import", JSON.stringify({
      bezeichnung: lv.bezeichnung,
      vorhaben: lv.vorhaben || "",
      auftraggeber: lv.auftraggeber || "",
      quelle: lv.quelle,
      dateiname,
      positionen: gewaehlte,
    }));
    navigate("/invoices/new?typ=angebot&ausschreibung=1");
  };

  // Positionen nach Gruppe (LG/ULG) für die Anzeige bündeln
  const gruppen: { titel: string; positionen: typeof gewaehlte }[] = [];
  for (const p of (lv?.positionen || [])) {
    const g = gruppen.find(x => x.titel === p.gruppe);
    if (g) g.positionen.push(p); else gruppen.push({ titel: p.gruppe, positionen: [p] });
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Ausschreibung importieren" backPath="/invoices" />
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              ÖNORM- / GAEB-Datenträger einlesen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Unterstützt: <b>ÖNORM A 2063</b> (.onlv) und <b>GAEB DA XML</b> (.x81, .x82, .x83).
              Die Positionen (LV-Nummer, Kurz-/Langtext, Menge, Einheit) werden übernommen —
              du musst danach im Angebot <b>nur noch die Preise eintragen</b>.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".onlv,.x81,.x82,.x83,.xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.currentTarget.value = "";
              }}
            />
            <Button onClick={() => fileRef.current?.click()} className="gap-2">
              <FileUp className="w-4 h-4" />
              Datei auswählen (.onlv / GAEB-XML)
            </Button>
            {dateiname && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> {dateiname}
                {lv && lv.uebersprungeneTextpositionen > 0 && (
                  <span> · {lv.uebersprungeneTextpositionen} Vorbemerkungs-/Textpositionen ohne Menge wurden übersprungen</span>
                )}
              </p>
            )}
          </CardContent>
        </Card>

        {lv && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>
                  {lv.bezeichnung}
                  {lv.auftraggeber && <span className="text-sm font-normal text-muted-foreground"> · AG: {lv.auftraggeber}</span>}
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {gewaehlte.length} von {lv.positionen.length} Positionen gewählt
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {gruppen.map(g => (
                <div key={g.titel}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{g.titel}</p>
                  <div className="rounded-md border divide-y">
                    {g.positionen.map(p => (
                      <label key={p.nr} className={`flex items-start gap-3 p-2.5 cursor-pointer hover:bg-muted/40 ${abgewaehlt.has(p.nr) ? "opacity-50" : ""}`}>
                        <Checkbox className="mt-0.5" checked={!abgewaehlt.has(p.nr)} onCheckedChange={() => toggle(p.nr)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            <span className="font-mono text-xs text-muted-foreground mr-2">{p.nr}</span>
                            {p.kurztext}
                          </p>
                          {p.langtext && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 whitespace-pre-line">{p.langtext}</p>
                          )}
                        </div>
                        <span className="text-sm font-mono tabular-nums shrink-0">
                          {p.menge.toLocaleString("de-AT")} {p.einheit}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex justify-end pt-1">
                <Button onClick={alsAngebot} disabled={gewaehlte.length === 0} className="gap-2">
                  <ArrowRight className="w-4 h-4" />
                  {gewaehlte.length} Positionen als Angebot anlegen — Preise dann eintragen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
