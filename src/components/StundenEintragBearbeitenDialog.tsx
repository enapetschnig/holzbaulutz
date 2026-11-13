import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SONDER_TAETIGKEITEN } from "@/lib/hoursAccounting";
import { PAUSE_OPTIONEN, uhrzeitAuswahl } from "@/lib/zeitraster";

/**
 * Eigenen Stundeneintrag bearbeiten – inkl. Datum (Wunsch Büro 13.11.2026:
 * „versehentlich den falschen Tag eingetragen und kann dies nicht mehr
 * ändern“). Gemeinsam genutzt von Zeiterfassung und „Meine Stunden“.
 *
 * Regeln (wie bisher in „Meine Stunden“):
 * - nur Einträge im aktuellen Kalendermonat, neues Datum ebenfalls,
 * - Abwesenheiten (Urlaub/Krank/ZA …) ändert nur der Admin,
 * - aus einem Bautages-/Regiebericht gespiegelte Stunden: Datum kommt aus
 *   dem Bericht und wird dort geändert,
 * - keine Überschneidung mit anderen Einträgen am (neuen) Tag, kein
 *   Verschieben auf einen Tag mit Urlaub/Krankenstand …
 */

type Eintrag = {
  id: string;
  user_id: string;
  datum: string;
  start_time: string | null;
  end_time: string | null;
  pause_minutes: number | null;
  stunden: number;
  taetigkeit: string | null;
  notizen: string | null;
  disturbance_id: string | null;
};

const aktuellerMonat = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export const istImAktuellenMonat = (datum: string) => datum.startsWith(aktuellerMonat());

const monatsGrenzen = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { min: format(first, "yyyy-MM-dd"), max: format(last, "yyyy-MM-dd") };
};

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const ausBericht = (e: Pick<Eintrag, "notizen" | "disturbance_id">) =>
  !!e.disturbance_id || (e.notizen || "").startsWith("Bautagesbericht-Zuordnung:");

interface Props {
  entryId: string | null;
  open: boolean;
  onClose: () => void;
  /** nach Speichern/Löschen; neuesDatum ist das gespeicherte Datum (bei Löschen null) */
  onSaved: (neuesDatum: string | null) => void;
}

export function StundenEintragBearbeitenDialog({ entryId, open, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [original, setOriginal] = useState<Eintrag | null>(null);
  const [form, setForm] = useState<Eintrag | null>(null);
  const [stundenText, setStundenText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !entryId) {
      setOriginal(null);
      setForm(null);
      return;
    }
    let abbruch = false;
    (async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("id, user_id, datum, start_time, end_time, pause_minutes, stunden, taetigkeit, notizen, disturbance_id")
        .eq("id", entryId)
        .maybeSingle();
      if (abbruch) return;
      if (error || !data) {
        toast({ variant: "destructive", title: "Fehler", description: "Eintrag konnte nicht geladen werden" });
        onClose();
        return;
      }
      const e = data as unknown as Eintrag;
      const norm: Eintrag = {
        ...e,
        start_time: e.start_time ? String(e.start_time).slice(0, 5) : null,
        end_time: e.end_time ? String(e.end_time).slice(0, 5) : null,
        pause_minutes: e.pause_minutes ?? 0,
      };
      setOriginal(norm);
      setForm(norm);
      setStundenText(String(Number(e.stunden || 0)).replace(".", ","));
    })();
    return () => { abbruch = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entryId]);

  const mitUhrzeit = !!(form?.start_time && form?.end_time);
  const berichtsEintrag = original ? ausBericht(original) : false;
  const gesperrt = original ? SONDER_TAETIGKEITEN.has(original.taetigkeit || "") || !istImAktuellenMonat(original.datum) : false;
  const { min, max } = monatsGrenzen();

  const berechneteStunden = (): number => {
    if (!form) return 0;
    if (mitUhrzeit) {
      return Math.max(0, (toMin(form.end_time!) - toMin(form.start_time!) - (form.pause_minutes || 0)) / 60);
    }
    const v = parseFloat(stundenText.replace(",", "."));
    return isNaN(v) ? 0 : v;
  };

  const speichern = async () => {
    if (!form || !original || saving) return;
    if (gesperrt) {
      toast({ variant: "destructive", title: "Nicht erlaubt", description: "Dieser Eintrag kann nur im Büro (Stundenauswertung) geändert werden" });
      return;
    }
    const taetigkeit = (form.taetigkeit || "").trim();
    if (Array.from(SONDER_TAETIGKEITEN).some(s => s.toLowerCase() === taetigkeit.toLowerCase())) {
      toast({ variant: "destructive", title: "Ungültige Tätigkeit", description: `"${taetigkeit}" ist für Abwesenheiten reserviert — bitte eine andere Bezeichnung wählen` });
      return;
    }
    const datumGeaendert = form.datum !== original.datum;
    if (datumGeaendert) {
      if (!form.datum || !istImAktuellenMonat(form.datum)) {
        toast({ variant: "destructive", title: "Datum nicht möglich", description: "Verschieben geht nur innerhalb des aktuellen Monats — ältere Tage ändert das Büro unter Stundenauswertung" });
        return;
      }
      if (berichtsEintrag) {
        toast({ variant: "destructive", title: "Datum im Bericht ändern", description: "Diese Stunden kommen aus einem Bericht — das Datum bitte im Bericht ändern" });
        return;
      }
    }

    let stunden: number;
    if (mitUhrzeit) {
      const s = toMin(form.start_time!);
      const e = toMin(form.end_time!);
      if (e <= s) {
        toast({ variant: "destructive", title: "Fehler", description: "Endzeit muss nach Startzeit liegen" });
        return;
      }
      const pause = form.pause_minutes || 0;
      if (pause >= e - s) {
        toast({ variant: "destructive", title: "Fehler", description: `Pause (${pause} Min.) ist länger als die Arbeitszeit (${e - s} Min.)` });
        return;
      }
      stunden = (e - s - pause) / 60;
    } else {
      stunden = berechneteStunden();
      if (stunden <= 0 || stunden > 24) {
        toast({ variant: "destructive", title: "Fehler", description: "Bitte Stunden zwischen 0,25 und 24 eingeben" });
        return;
      }
    }

    setSaving(true);
    // Andere Einträge am (neuen) Tag: Abwesenheit blockiert, Uhrzeiten dürfen
    // sich nicht überschneiden (gleiche Logik wie in der Zeiterfassung)
    const { data: andere, error: ladeFehler } = await supabase
      .from("time_entries")
      .select("id, start_time, end_time, taetigkeit")
      .eq("user_id", original.user_id)
      .eq("datum", form.datum)
      .neq("id", original.id);
    if (ladeFehler) {
      setSaving(false);
      toast({ variant: "destructive", title: "Fehler", description: "Einträge des Tages konnten nicht geprüft werden" });
      return;
    }
    const sonder = (andere || []).find((a: any) => SONDER_TAETIGKEITEN.has(a.taetigkeit || ""));
    if (sonder && datumGeaendert) {
      setSaving(false);
      toast({ variant: "destructive", title: "Tag blockiert", description: `Am ${format(parseISO(form.datum), "dd.MM.yyyy")} ist bereits ${sonder.taetigkeit} eingetragen` });
      return;
    }
    if (mitUhrzeit) {
      const s = toMin(form.start_time!);
      const e = toMin(form.end_time!);
      for (const a of (andere || []) as any[]) {
        if (!a.start_time || !a.end_time) continue;
        const aS = toMin(String(a.start_time).slice(0, 5));
        const aE = toMin(String(a.end_time).slice(0, 5));
        if (s < aE && e > aS) {
          setSaving(false);
          toast({ variant: "destructive", title: "Zeitüberschneidung", description: `Überschneidet sich mit Eintrag ${String(a.start_time).slice(0, 5)} - ${String(a.end_time).slice(0, 5)} am ${format(parseISO(form.datum), "dd.MM.yyyy")}` });
          return;
        }
      }
    }

    const { data: geaendert, error } = await supabase
      .from("time_entries")
      .update({
        datum: form.datum,
        taetigkeit: form.taetigkeit,
        start_time: mitUhrzeit ? form.start_time : original.start_time,
        end_time: mitUhrzeit ? form.end_time : original.end_time,
        pause_minutes: mitUhrzeit ? (form.pause_minutes || 0) : (original.pause_minutes || 0),
        stunden: Math.round(stunden * 100) / 100,
      } as any)
      .eq("id", original.id)
      .select("id");
    setSaving(false);

    if (error || !geaendert || geaendert.length === 0) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: error?.code === "23505"
          ? "Am gewählten Tag gibt es schon einen Eintrag mit derselben Beginnzeit"
          : "Eintrag konnte nicht gespeichert werden",
      });
      return;
    }
    toast({
      title: "Gespeichert",
      description: datumGeaendert
        ? `Eintrag auf ${format(parseISO(form.datum), "EEEE, dd.MM.yyyy", { locale: de })} verschoben`
        : "Eintrag wurde aktualisiert",
    });
    onSaved(form.datum);
    onClose();
  };

  const loeschen = async () => {
    if (!original || saving) return;
    if (gesperrt) {
      toast({ variant: "destructive", title: "Nicht erlaubt", description: "Dieser Eintrag kann nur im Büro (Stundenauswertung) geändert werden" });
      return;
    }
    if (!confirm("Möchtest du diesen Eintrag wirklich löschen?")) return;
    setSaving(true);
    const { error } = await supabase.from("time_entries").delete().eq("id", original.id);
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: "Eintrag konnte nicht gelöscht werden" });
      return;
    }
    toast({ title: "Gelöscht", description: "Eintrag wurde gelöscht" });
    onSaved(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stundeneintrag bearbeiten</DialogTitle>
          <DialogDescription>
            {original
              ? format(parseISO(original.datum), "EEEE, dd. MMMM yyyy", { locale: de })
              : "Lädt …"}
          </DialogDescription>
        </DialogHeader>
        {form && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-datum">Datum</Label>
              <Input
                id="edit-datum"
                type="date"
                value={form.datum}
                min={min}
                max={max}
                disabled={berichtsEintrag || gesperrt}
                onChange={(e) => setForm({ ...form, datum: e.target.value })}
              />
              {berichtsEintrag && (
                <p className="text-xs text-muted-foreground">Diese Stunden kommen aus einem Bericht – das Datum bitte im Bericht ändern.</p>
              )}
              {!berichtsEintrag && form.datum && form.datum !== original?.datum && (
                <p className="text-xs text-primary">
                  Wird verschoben auf {format(parseISO(form.datum), "EEEE, dd. MMMM yyyy", { locale: de })}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-taetigkeit">Tätigkeit</Label>
              <Input
                id="edit-taetigkeit"
                value={form.taetigkeit || ""}
                onChange={(e) => setForm({ ...form, taetigkeit: e.target.value })}
                placeholder="z.B. Dachstuhl montieren"
              />
            </div>

            {mitUhrzeit ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Von</Label>
                    <Select value={form.start_time!} onValueChange={(v) => setForm({ ...form, start_time: v })}>
                      <SelectTrigger aria-label="Von"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {uhrzeitAuswahl(form.start_time).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Bis</Label>
                    <Select value={form.end_time!} onValueChange={(v) => setForm({ ...form, end_time: v })}>
                      <SelectTrigger aria-label="Bis"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {uhrzeitAuswahl(form.end_time).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Pause</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {PAUSE_OPTIONEN.map(opt => (
                      <Button
                        key={opt.value}
                        type="button"
                        variant={(form.pause_minutes || 0) === opt.value ? "default" : "outline"}
                        size="sm"
                        className="h-9 text-xs"
                        onClick={() => setForm({ ...form, pause_minutes: opt.value })}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                  {!PAUSE_OPTIONEN.some(o => o.value === (form.pause_minutes || 0)) && (
                    <p className="text-xs text-muted-foreground">Aktuell: {form.pause_minutes} Min</p>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="edit-stunden">Stunden</Label>
                <Input
                  id="edit-stunden"
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="24"
                  inputMode="decimal"
                  value={stundenText.replace(",", ".")}
                  onChange={(e) => setStundenText(e.target.value)}
                  className="w-28"
                />
              </div>
            )}

            <div className="bg-muted/50 rounded px-3 py-2 flex items-center justify-between text-sm">
              <span>Stunden</span>
              <span className="font-bold">{berechneteStunden().toFixed(2)} h</span>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={speichern} className="flex-1" disabled={saving || gesperrt}>
                {saving ? "Wird gespeichert..." : "Speichern"}
              </Button>
              <Button variant="destructive" onClick={loeschen} className="flex-1" disabled={saving || gesperrt}>
                <Trash2 className="h-4 w-4 mr-2" />
                Löschen
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
