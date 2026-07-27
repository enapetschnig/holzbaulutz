import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Clock, Mic, Square, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  type TaetigkeitEntry,
  parseStunden,
  fmtStunden,
} from "@/lib/berichtZeiten";

/**
 * Tätigkeitszeilen mit je Stunden — ersetzt die "von–bis + Pause"-Eingabe in
 * Bautages- und Regieberichten ("Aufräumen 1 h", "Stapler richten 2,5 h").
 * Aufbau bewusst identisch zum Material-Block derselben Formulare.
 *
 * Zusätzlich Diktat: "Eine Stunde aufräumen, zwei Stunden Stapler richten"
 * wird über parse-voice-taetigkeiten direkt in Zeilen umgewandelt.
 */

interface Props {
  value: TaetigkeitEntry[];
  onChange: (next: TaetigkeitEntry[]) => void;
}

export function TaetigkeitenEditor({ value, onChange }: Props) {
  const { toast } = useToast();
  const [aufnahme, setAufnahme] = useState<"idle" | "recording" | "processing">("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const gesamt = value.reduce((s, t) => s + parseStunden(t.stunden), 0);
  const zuViel = gesamt > 24;

  const add = () => {
    onChange([...value, { id: crypto.randomUUID(), text: "", stunden: "" }]);
    setTimeout(() => {
      const list = document.querySelector("[data-taetigkeiten-list]");
      list?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  };
  const update = (id: string, feld: "text" | "stunden", v: string) =>
    onChange(value.map(t => (t.id === id ? { ...t, [feld]: v } : t)));
  const remove = (id: string) =>
    onChange(value.length > 1 ? value.filter(t => t.id !== id) : value.map(t => ({ ...t, text: "", stunden: "" })));

  // ── Diktat ──────────────────────────────────────────────────────────────
  const starteAufnahme = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Format-Fallback wie im DictateButton: iOS/Safari kennt kein WebM,
      // dort liefert MediaRecorder mp4/aac (von Whisper ebenfalls gelesen).
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType });
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        await verarbeite(new Blob(chunksRef.current, { type: mimeType }));
      };
      rec.start();
      setAufnahme("recording");
    } catch {
      toast({ variant: "destructive", title: "Mikrofon nicht verfügbar", description: "Bitte die Mikrofon-Berechtigung erlauben." });
    }
  };

  const stoppeAufnahme = () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      setAufnahme("processing");
    }
  };

  const verarbeite = async (blob: Blob) => {
    try {
      if (blob.size < 1000) {
        toast({ variant: "destructive", title: "Zu kurz", description: "Bitte mindestens 2 Sekunden sprechen." });
        return;
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const { data, error } = await supabase.functions.invoke("parse-voice-taetigkeiten", {
        body: { audioBase64: btoa(binary), mimeType: blob.type },
      });
      if (error) throw error;
      const neue = (data?.items || []) as { text: string; stunden: number }[];
      if (neue.length === 0) {
        toast({
          variant: "destructive",
          title: "Nichts erkannt",
          description: data?.transcript
            ? `Verstanden: „${data.transcript}“ — daraus konnte keine Tätigkeit gelesen werden.`
            : "Bitte nochmal deutlich sprechen, zum Beispiel: Eine Stunde aufräumen.",
        });
        return;
      }
      // Leere Startzeile ersetzen, sonst anhängen
      const bestand = value.filter(t => t.text.trim() || parseStunden(t.stunden) > 0);
      onChange([
        ...bestand,
        ...neue.map(n => ({
          id: crypto.randomUUID(),
          text: n.text,
          stunden: n.stunden > 0 ? String(n.stunden).replace(".", ",") : "",
        })),
      ]);
      toast({
        title: `${neue.length} Tätigkeit${neue.length === 1 ? "" : "en"} übernommen`,
        description: data?.transcript ? `„${data.transcript}“` : undefined,
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Diktat fehlgeschlagen", description: e?.message || "Bitte nochmal versuchen." });
    } finally {
      setAufnahme("idle");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Tätigkeiten *
        </h3>
        <div className="flex gap-2">
          {aufnahme === "recording" ? (
            <Button type="button" variant="destructive" size="sm" onClick={stoppeAufnahme} className="gap-1.5">
              <Square className="h-3.5 w-3.5 fill-current" />
              Aufnahme stoppen
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={starteAufnahme}
              disabled={aufnahme === "processing"}
              className="gap-1.5"
              title="Tätigkeiten diktieren, zum Beispiel: Eine Stunde aufräumen, zwei Stunden Stapler richten"
            >
              {aufnahme === "processing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
              {aufnahme === "processing" ? "Wird erkannt…" : "Diktieren"}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="h-4 w-4 mr-1" />
            Tätigkeit
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {aufnahme === "recording"
          ? "🎙️ Sprich jetzt, z.B.: Eine Stunde aufräumen, zwei Stunden Stapler richten — dann auf Stoppen tippen."
          : "Was wurde gemacht und wie lange? Eintippen oder über Diktieren ansagen."}
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
