import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X } from "lucide-react";

/**
 * Auswahlfeld, in dem man auch einen neuen Eintrag anlegen kann
 * (Produktgruppe, Lieferant …).
 *
 * Früher öffnete "+ Neu…" das graue Browser-Fenster (window.prompt). Das ist
 * in der installierten App (display: standalone) meist gar nicht sichtbar und
 * wird auch im Browser unterdrückt, sobald jemand einmal "weitere Dialoge
 * unterdrücken" angehakt hat — gemeldet am 31.08.2026: "kann keinen neuen
 * Lieferanten eingeben". Stattdessen klappt das Feld hier an Ort und Stelle
 * auf ein normales Eingabefeld um; das funktioniert überall gleich.
 */

interface Props {
  value: string;
  optionen: string[];
  onChange: (wert: string) => void;
  /** Text des Anlege-Eintrags, z.B. "+ Neuer Lieferant …" */
  neuLabel: string;
  /** Platzhalter im Eingabefeld, z.B. "Name des Lieferanten" */
  neuPlatzhalter: string;
  platzhalter?: string;
}

export function AuswahlMitNeu({
  value, optionen, onChange, neuLabel, neuPlatzhalter, platzhalter = "Wählen...",
}: Props) {
  const [neuModus, setNeuModus] = useState(false);
  const [entwurf, setEntwurf] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (neuModus) inputRef.current?.focus(); }, [neuModus]);

  const uebernehmen = () => {
    const wert = entwurf.trim();
    if (wert) {
      // Gibt es den Eintrag schon (nur andere Schreibweise)? Dann den
      // vorhandenen nehmen — sonst stünde er zweimal in der Liste.
      const vorhanden = optionen.find(o => o.toLowerCase() === wert.toLowerCase());
      onChange(vorhanden ?? wert);
    }
    setEntwurf("");
    setNeuModus(false);
  };

  const abbrechen = () => { setEntwurf(""); setNeuModus(false); };

  if (neuModus) {
    return (
      <div className="flex gap-1">
        <Input
          ref={inputRef}
          value={entwurf}
          onChange={(e) => setEntwurf(e.target.value)}
          placeholder={neuPlatzhalter}
          onKeyDown={(e) => {
            // Enter/Escape dürfen nicht am Feld vorbei den ganzen Dialog
            // treffen (Escape würde ihn schließen, Enter ihn abschicken).
            if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); uebernehmen(); }
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); abbrechen(); }
          }}
        />
        <Button type="button" size="icon" variant="ghost" className="shrink-0 text-primary"
          onClick={uebernehmen} disabled={!entwurf.trim()} title="Übernehmen">
          <Check className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="shrink-0 text-muted-foreground"
          onClick={abbrechen} title="Abbrechen">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Select
      value={value || "none"}
      onValueChange={(v) => {
        if (v === "_new") setNeuModus(true);
        else onChange(v === "none" ? "" : v);
      }}
    >
      <SelectTrigger><SelectValue placeholder={platzhalter} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">—</SelectItem>
        {optionen.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        <SelectItem value="_new" className="text-primary font-medium">{neuLabel}</SelectItem>
      </SelectContent>
    </Select>
  );
}
