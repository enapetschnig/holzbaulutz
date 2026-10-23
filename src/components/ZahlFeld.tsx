import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * Zahlenfeld für Menge/Preis, in das man auch MINUS und Komma tippen kann.
 *
 * Ein kontrolliertes <input type="number"> setzt ein angefangenes "-"
 * sofort auf 0 zurück (der Browser meldet "" für ungültige Zwischenstände,
 * React schreibt dann den alten Wert hinein) — deshalb ließ sich kein
 * negativer Betrag eintippen (Holzbau Lutz 23.10.2026). Hier wird der Text
 * lokal gehalten und erst bei einer gültigen Zahl weitergegeben.
 * Pfeil hoch/runter zählt um `step` wie beim Zahlenfeld.
 */

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "step"> {
  value: number;
  onChange: (n: number) => void;
  step?: number;
}

const anzeigen = (n: number) => (Number.isFinite(n) ? String(n).replace(".", ",") : "");

/** "1.234,5" / "1234.5" / "-12,30" → Zahl; ungültig/unfertig → null */
function parseZahl(text: string): number | null {
  let t = text.replace(/\s/g, "");
  if (!t || t === "-" || t === "," || t === "." || t === "-," || t === "-.") return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function ZahlFeld({ value, onChange, step = 1, onBlur, onFocus, onKeyDown, ...rest }: Props) {
  const [text, setText] = useState(anzeigen(value));
  const fokus = useRef(false);

  // Von außen geänderte Werte übernehmen — aber nicht mitten im Tippen.
  useEffect(() => {
    if (!fokus.current) setText(anzeigen(value));
  }, [value]);

  return (
    <Input
      {...rest}
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={(e) => { fokus.current = true; onFocus?.(e); }}
      onBlur={(e) => {
        fokus.current = false;
        const n = parseZahl(text);
        setText(anzeigen(n ?? value));
        onBlur?.(e);
      }}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d,.\-\s]/g, "");
        setText(t);
        const n = parseZahl(t);
        if (n !== null) onChange(n);
        else if (t.trim() === "") onChange(0);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const basis = parseZahl(text) ?? value ?? 0;
          const n = Math.round((basis + (e.key === "ArrowUp" ? step : -step)) * 1000) / 1000;
          setText(anzeigen(n));
          onChange(n);
        }
        onKeyDown?.(e);
      }}
    />
  );
}
