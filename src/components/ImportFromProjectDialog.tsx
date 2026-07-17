import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Package, FolderOpen } from "lucide-react";

interface ImportItem {
  beschreibung: string;
  menge: number;
  einheit: string;
  einzelpreis: number;
  selected: boolean;
  source: "zeit" | "material";
  detail?: string;
  /** Gewählte Stundensatz-Art (Facharbeiter/Regie/Lehrling …) für Zeit-Zeilen */
  satzId?: string;
  /** Zeit-Zeilen: die einzelnen Zeitbuchungen dahinter — jede einzeln
   *  an-/abwählbar; die Menge der Position folgt der Auswahl. */
  buchungen?: { id: string; datum: string; stunden: number; taetigkeit: string; selected: boolean }[];
}

export interface Stundensatz {
  id: string;
  name: string;
  satz: number;
}

interface ImportFromProjectDialogProps {
  open: boolean;
  onClose: () => void;
  projectId?: string | null;
  customerId?: string | null;
  mode?: "zeit" | "material" | "alle";
  /** Stundensätze aus dem Katalog (Facharbeiter, Regie, Lehrling …) zum
   *  Verrechnen der importierten Zeiten. */
  stundensaetze?: Stundensatz[];
  onImport: (items: { beschreibung: string; menge: number; einheit: string; einzelpreis: number }[]) => void;
}

export function ImportFromProjectDialog({
  open, onClose, projectId, customerId, mode = "alle", stundensaetze = [], onImport,
}: ImportFromProjectDialogProps) {
  const [items, setItems] = useState<ImportItem[]>([]);
  const [loading, setLoading] = useState(false);
  // Regiestunden des Projekts (eigener Topf!) — nur zur Info, verrechnet
  // wird Regie über den eigenen "Aus Regiebericht"-Import.
  const [regieInfo, setRegieInfo] = useState<{ stunden: number; anzahl: number; unverrechnet: number } | null>(null);
  const [tab, setTab] = useState<"zeit" | "material">(mode === "material" ? "material" : "zeit");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [localProjectId, setLocalProjectId] = useState<string | null>(projectId ?? null);

  // Wenn von außen kein Projekt gesetzt ist, laden wir die Liste für Auswahl
  useEffect(() => {
    if (!open) return;
    setLocalProjectId(projectId ?? null);
    if (!projectId) {
      // Abgeschlossene Projekte MITLADEN (Schlussrechnung nach Projektende!) —
      // sie werden im Dropdown markiert und ans Ende sortiert.
      let q = supabase.from("projects").select("id, name, status").order("name");
      if (customerId) q = q.eq("customer_id", customerId) as any;
      q.then(({ data }) => {
        const rows = ((data as any[]) || []);
        const istAbgeschlossen = (s: unknown) => String(s || "").toLowerCase() === "abgeschlossen";
        setProjects([
          ...rows.filter(r => !istAbgeschlossen(r.status)),
          ...rows.filter(r => istAbgeschlossen(r.status)).map(r => ({ ...r, name: `${r.name} (abgeschlossen)` })),
        ]);
      });
    }
  }, [open, projectId, customerId]);

  useEffect(() => {
    if (open && localProjectId) fetchAll();
    else if (open) setItems([]);
  }, [open, localProjectId]);

  const fetchAll = async () => {
    if (!localProjectId) return;
    setLoading(true);

    const [timeItems, materialItems, regieRes] = await Promise.all([
      mode === "material" ? Promise.resolve([]) : fetchTimeEntries(localProjectId),
      mode === "zeit" ? Promise.resolve([]) : fetchMaterialEntries(localProjectId),
      mode === "material"
        ? Promise.resolve({ data: null })
        : (supabase as any).from("disturbances").select("stunden, is_verrechnet").eq("project_id", localProjectId),
    ]);

    const regieRows = ((regieRes as any)?.data as any[]) || [];
    setRegieInfo(regieRows.length > 0 ? {
      stunden: Math.round(regieRows.reduce((s, d) => s + (Number(d.stunden) || 0), 0) * 10) / 10,
      anzahl: regieRows.length,
      unverrechnet: regieRows.filter(d => !d.is_verrechnet).length,
    } : null);

    setItems([...timeItems, ...materialItems]);
    setLoading(false);
  };

  const fetchTimeEntries = async (pid: string): Promise<ImportItem[]> => {
    const { data } = await supabase
      .from("time_entries")
      .select("id, user_id, stunden, taetigkeit, datum")
      .eq("project_id", pid)
      .order("datum", { ascending: true });

    if (!data || data.length === 0) return [];

    const userIds = [...new Set(data.map(e => e.user_id))];
    const [{ data: profiles }, { data: employees }] = await Promise.all([
      (supabase.from("profiles" as never) as any).select("id, vorname, nachname, hidden").in("id", userIds),
      supabase.from("employees").select("user_id, stundenlohn, position").in("user_id", userIds),
    ]);
    // Hidden User (Admin/Inhaber) nicht als Position aufführen
    const visibleProfiles = ((profiles as any[]) || []).filter((p: any) => !p.hidden);

    // Kein stiller 45-€-Default: fehlender/0-Stundenlohn bleibt 0 und wird in
    // der Zeile sichtbar gemacht — der Nutzer wählt dann einen Stundensatz
    // über „Verrechnen als".
    const empMap = new Map(
      (employees || []).map((e: any) => [e.user_id, { satz: Number(e.stundenlohn) || 0, rolle: e.position || "Monteur" }])
    );

    const profileMap = new Map(
      visibleProfiles.map((p: any) => {
        const emp = empMap.get(p.id) || { satz: 0, rolle: "Monteur" };
        return [p.id, { name: `${p.vorname} ${p.nachname}`, satz: emp.satz, rolle: emp.rolle }];
      })
    );

    // Group by user (hidden User werden ausgefiltert) — inkl. der einzelnen
    // Zeitbuchungen, damit man gezielt an-/abwählen kann, WELCHE Arbeitszeiten
    // verrechnet werden.
    const visibleIds = new Set(visibleProfiles.map((p: any) => p.id));
    const groups = new Map<string, { stunden: number; taetigkeiten: Set<string>; buchungen: { id: string; datum: string; stunden: number; taetigkeit: string; selected: boolean }[] }>();
    data.forEach((e: any) => {
      const uid = e.user_id;
      if (!visibleIds.has(uid)) return; // hidden User überspringen
      if (!groups.has(uid)) groups.set(uid, { stunden: 0, taetigkeiten: new Set(), buchungen: [] });
      const g = groups.get(uid)!;
      g.stunden += Number(e.stunden);
      if (e.taetigkeit) g.taetigkeiten.add(e.taetigkeit);
      g.buchungen.push({
        id: e.id, datum: e.datum || "", stunden: Number(e.stunden) || 0,
        taetigkeit: e.taetigkeit || "", selected: true,
      });
    });

    return Array.from(groups.entries()).map(([uid, g]) => {
      const p = profileMap.get(uid) || { name: "Unbekannt", satz: 0, rolle: "Monteur" };
      const taetigkeiten = Array.from(g.taetigkeiten).slice(0, 3).join(", ");
      return {
        beschreibung: `Arbeitszeit ${p.name}${taetigkeiten ? ` (${taetigkeiten})` : ""}`,
        menge: Math.round(g.stunden * 100) / 100,
        einheit: "Std.",
        einzelpreis: p.satz,
        selected: g.stunden > 0,
        source: "zeit" as const,
        detail: `${p.rolle} · ${g.stunden.toFixed(1)} Std.${p.satz > 0 ? "" : " · Kein Stundenlohn hinterlegt — bitte Stundensatz wählen"}`,
        buchungen: g.buchungen,
      };
    });
  };

  const fetchMaterialEntries = async (pid: string): Promise<ImportItem[]> => {
    // 1a. Lieferschein-Einträge (bisheriger Weg): Lieferscheine des Projekts →
    // material_entries über lieferschein_id (project_id kann dort NULL sein).
    const { data: lsData } = await supabase
      .from("lieferscheine")
      .select("id, name")
      .eq("project_id", pid);

    const lsIds = ((lsData as any[]) || []).map(l => l.id);

    const [lsEntries, direktEntries] = await Promise.all([
      lsIds.length > 0
        ? supabase
            .from("material_entries")
            .select("id, material, menge, einheit, typ, lieferschein_id, einzelpreis")
            .in("lieferschein_id", lsIds)
            .then(({ data }) => ((data as any[]) || []))
        : Promise.resolve([] as any[]),
      // 1b. Direkt am Projekt erfasster Ist-Verbrauch (ohne Lieferschein).
      // 'bedarf' ist der SOLL aus dem Angebot und darf NICHT als Ist
      // fakturiert werden — deshalb nur entnahme/rueckgabe/verbrauch.
      supabase
        .from("material_entries")
        .select("id, material, menge, einheit, typ, lieferschein_id, einzelpreis")
        .eq("project_id", pid)
        .in("typ", ["entnahme", "rueckgabe", "verbrauch"])
        .then(({ data }) => ((data as any[]) || [])),
    ]);

    // Beide Quellen zusammenführen — eine Zeile kann project_id UND
    // lieferschein_id gesetzt haben und darf nur einmal zählen (Dedupe per id).
    const seenIds = new Set<string>();
    const entries: any[] = [];
    for (const e of [...lsEntries, ...direktEntries]) {
      if (seenIds.has(e.id)) continue;
      seenIds.add(e.id);
      entries.push(e);
    }

    if (entries.length === 0) return [];

    // 2. Load Angebot prices for this project — Referenz-Angebot nach Status
    // priorisiert (angenommen > verrechnet > offen > entwurf), innerhalb
    // desselben Status das neueste Datum. Abgelehnte/stornierte zählen nicht.
    const { data: angebote } = await supabase.from("invoices")
      .select("id, status, datum").eq("project_id", pid).eq("typ", "angebot")
      .not("status", "in", '("storniert","abgelehnt")')
      // Archivierte Vorgänger-Revisionen (Original nach Preis-Update) ausschließen
      .or("archiviert.is.null,archiviert.eq.false")
      .order("datum", { ascending: false });
    const statusRang: Record<string, number> = { angenommen: 0, verrechnet: 1, offen: 2, entwurf: 3 };
    const referenzAngebot = ((angebote as any[]) || []).slice().sort((a, b) => {
      const diff = (statusRang[a.status] ?? 4) - (statusRang[b.status] ?? 4);
      if (diff !== 0) return diff;
      return String(b.datum || "").localeCompare(String(a.datum || ""));
    })[0];
    let angebotMap = new Map<string, { einzelpreis: number; menge: number; einheit: string }>();
    if (referenzAngebot) {
      const { data: angebotItems } = await supabase.from("invoice_items")
        .select("beschreibung, kurztext, menge, einheit, einzelpreis")
        .eq("invoice_id", referenzAngebot.id);
      if (angebotItems) {
        angebotItems.forEach(ai => {
          const key = ((ai as any).kurztext || ai.beschreibung).toLowerCase().trim();
          angebotMap.set(key, { einzelpreis: Number(ai.einzelpreis), menge: Number(ai.menge), einheit: ai.einheit || "Stk." });
        });
      }
    }

    // 3. Aggregate material entries (Lieferscheine + direkt erfasste Buchungen)
    const map = new Map<string, {
      material: string; einheit: string; entnommen: number; zurueck: number;
      storedPreis: number; ausLieferschein: boolean; direktErfasst: boolean;
    }>();
    entries.forEach(e => {
      const key = e.material.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          material: e.material, einheit: e.einheit || "Stk.", entnommen: 0, zurueck: 0,
          storedPreis: 0, ausLieferschein: false, direktErfasst: false,
        });
      }
      const s = map.get(key)!;
      const menge = parseFloat(e.menge || "0") || 0;
      // 'verbrauch' zählt wie 'entnahme'; 'bedarf' (Soll) zählt nie als Ist
      if (e.typ === "entnahme" || e.typ === "verbrauch") s.entnommen += menge;
      else if (e.typ === "rueckgabe") s.zurueck += menge;
      // Quelle merken für den detail-Text
      if (e.lieferschein_id) s.ausLieferschein = true;
      else s.direktErfasst = true;
      // Track best stored price (from catalog or Angebot)
      const ep = Number((e as any).einzelpreis) || 0;
      if (ep > 0 && s.storedPreis === 0) s.storedPreis = ep;
    });

    return Array.from(map.values())
      .filter(s => s.entnommen - s.zurueck > 0)
      .map(s => {
        const verbraucht = Math.round((s.entnommen - s.zurueck) * 100) / 100;
        const angebot = angebotMap.get(s.material.toLowerCase().trim());
        const quelle = s.ausLieferschein && s.direktErfasst
          ? "aus Lieferscheinen + direkt erfasst"
          : s.ausLieferschein ? "aus Lieferscheinen" : "direkt erfasst";
        return {
          beschreibung: s.material,
          menge: verbraucht,
          einheit: s.einheit,
          einzelpreis: angebot?.einzelpreis || s.storedPreis || 0,
          selected: true,
          source: "material" as const,
          detail: angebot
            ? `Angebot: ${angebot.menge} ${angebot.einheit} · Verbraucht: ${verbraucht} ${s.einheit} (${quelle}) · Preis aus Angebot`
            : `Verbraucht: ${verbraucht} ${s.einheit} (${quelle}) · Kein Angebotspreis`,
        };
      })
      .sort((a, b) => a.beschreibung.localeCompare(b.beschreibung));
  };

  const toggle = (idx: number) => {
    setItems(prev => prev.map((m, i) => i === idx ? { ...m, selected: !m.selected } : m));
  };

  /** Einzelne Zeitbuchung an-/abwählen — die Positions-Menge (Std.) folgt
   *  automatisch der Summe der angehakten Buchungen. */
  const toggleBuchung = (idx: number, buchungId: string) => {
    setItems(prev => prev.map((m, i) => {
      if (i !== idx || !m.buchungen) return m;
      const buchungen = m.buchungen.map(b => b.id === buchungId ? { ...b, selected: !b.selected } : b);
      const stunden = buchungen.filter(b => b.selected).reduce((s, b) => s + b.stunden, 0);
      return {
        ...m,
        buchungen,
        menge: Math.round(stunden * 100) / 100,
        selected: stunden > 0 ? m.selected : false,
      };
    }));
  };

  const updateField = (idx: number, field: "menge" | "einzelpreis" | "einheit" | "beschreibung", val: any) => {
    setItems(prev => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m));
  };

  /** Zeit-Zeile als Stundensatz-Art verrechnen: setzt Preis, Beschreibung und
   *  Einheit passend zum gewählten Satz (Facharbeiter/Regie/Lehrling …). */
  const setRate = (idx: number, s: Stundensatz) => {
    setItems(prev => prev.map((m, i) => i === idx
      ? { ...m, satzId: s.id, einzelpreis: s.satz, beschreibung: s.name, einheit: "Std." }
      : m));
  };

  const handleImport = () => {
    const selected = items
      .filter(m => m.selected)
      .map(m => ({
        beschreibung: m.beschreibung,
        menge: m.menge,
        einheit: m.einheit,
        einzelpreis: m.einzelpreis,
      }));
    onImport(selected);
  };

  const zeitItems = items.filter(i => i.source === "zeit");
  const matItems = items.filter(i => i.source === "material");
  const selected = items.filter(i => i.selected);
  const total = selected.reduce((s, i) => s + i.menge * i.einzelpreis, 0);

  const renderItem = (item: ImportItem, globalIdx: number) => (
    <div key={globalIdx} className={`p-3 rounded-lg border ${item.selected ? "bg-primary/5 border-primary/30" : "bg-muted/30"}`}>
      <div className="flex items-center gap-3">
        <Checkbox checked={item.selected} onCheckedChange={() => toggle(globalIdx)} />
        <div className="flex-1 min-w-0">
          <Input
            value={item.beschreibung}
            onChange={(e) => updateField(globalIdx, "beschreibung", e.target.value)}
            className="font-medium text-sm h-8 mb-1"
          />
          <p className="text-xs text-muted-foreground">{item.detail}</p>
        </div>
      </div>
      {item.selected && (
        <div className="mt-2 ml-9 space-y-2">
          {/* Einzelne Zeitbuchungen an-/abwählen — so bestimmst du genau,
              WELCHE Arbeitszeiten verrechnet werden; die Std.-Menge folgt. */}
          {item.source === "zeit" && item.buchungen && item.buchungen.length > 0 && (
            <div className="rounded-md border bg-background/60 divide-y">
              {item.buchungen.map(b => (
                <label key={b.id} className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={b.selected} onCheckedChange={() => toggleBuchung(globalIdx, b.id)} />
                  <span className="w-16 shrink-0 text-muted-foreground">
                    {b.datum ? new Date(b.datum).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" }) : "–"}
                  </span>
                  <span className="flex-1 truncate">{b.taetigkeit || "Arbeitszeit"}</span>
                  <span className="font-mono tabular-nums shrink-0">{b.stunden.toFixed(1)} h</span>
                </label>
              ))}
            </div>
          )}
          {/* Stundensatz-Art wählen (Facharbeiter / Regie / Lehrling …) —
              setzt Preis + Bezeichnung passend zum Katalog. */}
          {item.source === "zeit" && stundensaetze.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-24 shrink-0">Verrechnen als</span>
              <Select
                value={item.satzId || ""}
                onValueChange={(id) => {
                  const s = stundensaetze.find(x => x.id === id);
                  if (s) setRate(globalIdx, s);
                }}
              >
                <SelectTrigger className="h-8 flex-1">
                  <SelectValue placeholder="Stundensatz wählen (Facharbeiter, Regie, Lehrling …)" />
                </SelectTrigger>
                <SelectContent>
                  {stundensaetze.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} — € {s.satz.toFixed(2)}/h</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={item.menge}
                onChange={(e) => updateField(globalIdx, "menge", Number(e.target.value))}
                className="w-20 h-8 text-right text-sm"
                min={0}
                step={1}
              />
              <span className="text-xs text-muted-foreground w-10">{item.einheit}</span>
            </div>
            <span className="text-xs text-muted-foreground">×</span>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={item.einzelpreis}
                onChange={(e) => updateField(globalIdx, "einzelpreis", Number(e.target.value))}
                className="w-24 h-8 text-right text-sm"
                min={0}
                step={0.01}
                placeholder="0.00"
              />
              <span className="text-xs text-muted-foreground">€/{item.einheit}</span>
            </div>
            <span className="text-sm font-medium ml-auto">
              = € {(item.menge * item.einzelpreis).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  const title = mode === "zeit"
    ? "Arbeitszeiten aus Projekt importieren"
    : mode === "material"
      ? "Material aus Projekt importieren"
      : "Aus Projekt importieren";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Projekt-Auswahl — nur wenn von außen keins vorgegeben */}
        {!projectId && (
          <div className="space-y-1.5">
            <Label>Projekt</Label>
            <Select
              value={localProjectId || ""}
              onValueChange={(v) => setLocalProjectId(v)}
            >
              <SelectTrigger><SelectValue placeholder="Projekt auswählen…" /></SelectTrigger>
              <SelectContent>
                {projects.length === 0 && (
                  <SelectItem value="_none" disabled>Keine Projekte gefunden</SelectItem>
                )}
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {mode !== "zeit" && (
          <p className="text-sm text-muted-foreground bg-blue-50 border border-blue-200 rounded-md p-2">
            Materialien aus dem Ist-Verbrauch (Lieferscheine und direkt am Projekt erfasste Buchungen) — die Verbrauchsmengen ersetzen die Angebotspositionen, Preise werden aus dem Angebot übernommen.
          </p>
        )}
        {mode === "zeit" && (
          <p className="text-sm text-muted-foreground bg-blue-50 border border-blue-200 rounded-md p-2">
            Hake an, <b>welche Zeitbuchungen</b> verrechnet werden — die Stunden-Menge folgt der
            Auswahl. Je Mitarbeiter wählst du die Stundensatz-Art (Facharbeiter, Regie, Lehrling …);
            Menge und Preis bleiben danach anpassbar.
          </p>
        )}

        {/* Laufende Gesamtsumme OBEN — auf einen Blick prüfen, ob es passt */}
        {localProjectId && items.length > 0 && (
          <div className="sticky top-0 z-10 flex items-center justify-between rounded-md border bg-background shadow-sm px-3 py-2">
            <span className="text-sm text-muted-foreground">
              Ausgewählt: <b className="text-foreground">{selected.length}</b> Position{selected.length === 1 ? "" : "en"}
              {selected.some(i => i.source === "zeit") && (
                <> · <b className="text-foreground tabular-nums">
                  {selected.filter(i => i.source === "zeit").reduce((s, i) => s + i.menge, 0).toFixed(1)} Std.
                </b></>
              )}
            </span>
            <span className="font-bold tabular-nums">€ {total.toFixed(2)}</span>
          </div>
        )}

        {/* Regiestunden sind ein EIGENER Topf — hier nur zur Übersicht,
            verrechnet werden sie über „Aus Regiebericht". */}
        {mode !== "material" && localProjectId && regieInfo && (
          <p className="text-xs text-muted-foreground rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5">
            ⏱️ Zusätzlich auf diesem Projekt: <b className="text-foreground">{regieInfo.stunden.toLocaleString("de-AT")} Regiestunden</b> aus {regieInfo.anzahl} Regiebericht{regieInfo.anzahl === 1 ? "" : "en"}
            {regieInfo.unverrechnet > 0 && <> — davon <b className="text-amber-800">{regieInfo.unverrechnet} noch nicht verrechnet</b></>}.
            Regieleistungen importierst du über den Knopf „Aus Regiebericht".
          </p>
        )}

        {!localProjectId ? (
          <p className="text-center py-8 text-muted-foreground">
            Bitte zuerst ein Projekt auswählen.
          </p>
        ) : loading ? (
          <p className="text-center py-8 text-muted-foreground">Lädt Projektdaten...</p>
        ) : items.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            {mode === "zeit"
              ? "Keine Arbeitszeiten auf diesem Projekt gebucht."
              : mode === "material"
                ? "Kein Materialverbrauch für dieses Projekt erfasst."
                : "Keine Arbeitszeiten oder kein Materialverbrauch für dieses Projekt gefunden."}
          </p>
        ) : (
          <>
            {mode === "alle" ? (
              <Tabs value={tab} onValueChange={(v) => setTab(v as "zeit" | "material")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="zeit" className="gap-2">
                    <Clock className="w-4 h-4" />
                    Arbeitszeit ({zeitItems.length})
                  </TabsTrigger>
                  <TabsTrigger value="material" className="gap-2">
                    <Package className="w-4 h-4" />
                    Material ({matItems.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="zeit" className="space-y-2 mt-3">
                  {zeitItems.length === 0 ? (
                    <p className="text-center py-6 text-muted-foreground text-sm">Keine Arbeitszeiten gebucht</p>
                  ) : (
                    zeitItems.map((item) => {
                      const globalIdx = items.indexOf(item);
                      return renderItem(item, globalIdx);
                    })
                  )}
                </TabsContent>

                <TabsContent value="material" className="space-y-2 mt-3">
                  {matItems.length === 0 ? (
                    <p className="text-center py-6 text-muted-foreground text-sm">Kein Materialverbrauch erfasst</p>
                  ) : (
                    matItems.map((item) => {
                      const globalIdx = items.indexOf(item);
                      return renderItem(item, globalIdx);
                    })
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-2 mt-1">
                {(mode === "zeit" ? zeitItems : matItems).map((item) => {
                  const globalIdx = items.indexOf(item);
                  return renderItem(item, globalIdx);
                })}
              </div>
            )}

            {/* Summary */}
            <div className="flex items-center justify-between pt-3 border-t text-sm">
              <span className="text-muted-foreground">
                {selected.length} Positionen ausgewählt
              </span>
              <span className="font-bold">Gesamt: € {total.toFixed(2)}</span>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleImport} disabled={selected.length === 0} className="gap-2">
            <FolderOpen className="w-4 h-4" />
            {selected.length > 0 ? `${selected.length} Positionen importieren` : "Importieren"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
