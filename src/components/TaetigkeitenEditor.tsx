import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Clock } from "lucide-react";
import {
  type TaetigkeitEntry,
  parseStunden,
  fmtStunden,
} from "@/lib/berichtZeiten";

/**
 * Tätigkeitszeilen mit je Stunden — ersetzt die "von–bis + Pause"-Eingabe in
 * Bautages- und Regieberichten ("Aufräumen 1 h", "Stapler richten 2,5 h").
 * Aufbau bewusst identisch zum Material-Block derselben Formulare.
 */

interface Props {
  value: TaetigkeitEntry[];
  onChange: (next: TaetigkeitEntry[]) => void;
}

export function TaetigkeitenEditor({ value, onChange }: Props) {
  const gesamt = value.reduce((s, t) => s + parseStunden(t.stunden), 0);
  const zuViel = gesamt > 24;

  const add = () => {
    onChange([...value, { id: crypto.randomUUID(), text: "", stunden: "" }]);
    // Neue Zeile in den Blick holen (gleiches Muster wie bei den Materialien)
    setTimeout(() => {
      const list = document.querySelector("[data-taetigkeiten-list]");
      list?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  };
  const update = (id: string, feld: "text" | "stunden", v: string) =>
    onChange(value.map(t => (t.id === id ? { ...t, [feld]: v } : t)));
  const remove = (id: string) =>
    onChange(value.length > 1 ? value.filter(t => t.id !== id) : value.map(t => ({ ...t, text: "", stunden: "" })));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Tätigkeiten *
        </h3>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4 mr-1" />
          Tätigkeit
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Was wurde gemacht und wie lange? z.B. „Aufräumen — 1", „Stapler richten — 2,5"
      </p>

      <div className="space-y-2" data-taetigkeiten-list>
        {value.map((t) => (
          <div key={t.id} className="flex gap-2 items-start">
            <Input
              placeholder="Tätigkeit"
              value={t.text}
              onChange={(e) => update(t.id, "text", e.target.value)}
              className="flex-1"
            />
            <div className="flex items-center gap-1 shrink-0">
              <Input
                // bewusst text + inputMode: type="number" schluckt je nach
                // Locale das Komma bei "2,5"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={t.stunden}
                onChange={(e) => update(t.id, "stunden", e.target.value)}
                className="w-20 text-right"
              />
              <span className="text-sm text-muted-foreground">h</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(t.id)}
              className="text-destructive hover:text-destructive shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className={`rounded-md px-3 py-2 text-center ${zuViel ? "bg-destructive/10" : "bg-muted"}`}>
        <span className="text-sm text-muted-foreground">Gesamt: </span>
        <span className={`font-bold ${zuViel ? "text-destructive" : "text-primary"}`}>
          {fmtStunden(gesamt)} h
        </span>
        {zuViel && <p className="text-xs text-destructive mt-0.5">Mehr als 24 Stunden pro Tag sind nicht möglich.</p>}
      </div>
    </div>
  );
}
