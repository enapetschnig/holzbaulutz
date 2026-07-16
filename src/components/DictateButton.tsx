import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  /** Aktueller Text im Feld */
  value: string;
  /** Neuer Text nach Diktat (geschliffen + angehängt wenn bereits Text da war) */
  onResult: (text: string) => void;
  /** Optional: kleinere Variante (Icon-only) */
  compact?: boolean;
  /** Optional: Custom Label */
  label?: string;
  /** Disabled während Formular-Save */
  disabled?: boolean;
  className?: string;
}

/**
 * Diktier-Button mit Spracheingabe → Whisper-Transkription → GPT-4o-mini Polish.
 *
 * Erster Klick: Aufnahme starten (rotes Mic, pulsierend).
 * Zweiter Klick: Aufnahme stoppen → Text wird geschliffen und angehängt/ersetzt.
 */
export function DictateButton({ value, onResult, compact, label = "Diktieren", disabled, className = "" }: Props) {
  const { toast } = useToast();
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup bei Unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      // Prefer webm/opus (kleine Dateien, von Whisper unterstützt)
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setState("processing");
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          if (blob.size < 1000) {
            toast({ variant: "destructive", title: "Zu kurz", description: "Bitte mindestens 2 Sekunden sprechen." });
            setState("idle");
            return;
          }

          const form = new FormData();
          form.append("audio", blob, "dictation.webm");
          form.append("mode", "polish");

          const { data, error } = await supabase.functions.invoke("polish-text", {
            body: form,
          });

          if (error) {
            // Echte Fehlermeldung aus dem Function-Body ziehen (statt "non-2xx")
            const body = await (error as any).context?.json?.().catch(() => null);
            throw new Error(body?.error || error.message);
          }
          if (data?.error) throw new Error(data.error);
          if (!data?.text) throw new Error("Keine Antwort");

          // Anhängen macht der CLIENT — der bestehende Text bleibt garantiert
          // unverändert, das Diktat kommt als neuer Absatz dazu.
          const neu = String(data.text).trim();
          const ergebnis = value.trim() ? `${value.replace(/\s+$/, "")}\n${neu}` : neu;
          onResult(ergebnis);
          // Dem Nutzer ZEIGEN, was verstanden wurde — so fällt eine falsche
          // Erkennung sofort auf.
          toast({
            title: "Diktat übernommen",
            description: `„${neu.length > 120 ? neu.slice(0, 120) + "…" : neu}"`,
          });
        } catch (err: any) {
          toast({ variant: "destructive", title: "Diktier-Fehler", description: err.message });
        } finally {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
          }
          setState("idle");
        }
      };

      recorder.start();
      setState("recording");
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast({
          variant: "destructive",
          title: "Mikrofon blockiert",
          description: "Bitte in den Browser-Einstellungen Mikrofon-Zugriff für diese Seite erlauben.",
        });
      } else {
        toast({ variant: "destructive", title: "Mikrofon-Fehler", description: err.message });
      }
      setState("idle");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleClick = () => {
    if (state === "idle") startRecording();
    else if (state === "recording") stopRecording();
  };

  const isActive = state === "recording" || state === "processing";

  if (compact) {
    return (
      <Button
        type="button"
        variant={state === "recording" ? "destructive" : "ghost"}
        size="icon"
        onClick={handleClick}
        disabled={disabled || state === "processing"}
        className={`h-8 w-8 ${state === "recording" ? "animate-pulse" : ""} ${className}`}
        title={state === "recording" ? "Aufnahme stoppen" : "Diktieren"}
      >
        {state === "processing" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === "recording" ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={state === "recording" ? "destructive" : "outline"}
      size="sm"
      onClick={handleClick}
      disabled={disabled || state === "processing"}
      className={`gap-1.5 ${state === "recording" ? "animate-pulse" : ""} ${className}`}
    >
      {state === "processing" ? (
        <><Loader2 className="h-4 w-4 animate-spin" /> Verarbeite...</>
      ) : state === "recording" ? (
        <><MicOff className="h-4 w-4" /> Stop</>
      ) : (
        <><Sparkles className="h-3.5 w-3.5 text-orange-500" /> {label}</>
      )}
    </Button>
  );
}
