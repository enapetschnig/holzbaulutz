import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Building2, Hammer, Pencil, TrendingUp, Wallet } from "lucide-react";
import { aggregateByDay, totalAutoSaldo, formatSaldo, SONDER_TAETIGKEITEN, stundenAufteilung, sonderzeitenText } from "@/lib/hoursAccounting";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { StundenEintragBearbeitenDialog } from "@/components/StundenEintragBearbeitenDialog";

type TimeEntry = {
  id: string;
  datum: string;
  taetigkeit: string;
  stunden: number;
  start_time: string | null;
  end_time: string | null;
  pause_minutes: number | null;
  location_type: string;
  notizen: string | null;
  projects: { name: string; plz: string } | null;
  project_id: string | null;
  nachgetragen_von?: string | null;
  nachgetragen_am?: string | null;
};

const MyHours = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [editId, setEditId] = useState<string | null>(null);
  // Stundenkonto-Saldo: live aus ALLEN time_entries des Mitarbeiters
  // berechnet (kein Stichtag), plus manuelle Korrekturen aus
  // time_accounts.balance_hours.
  const [autoSaldoAll, setAutoSaldoAll] = useState<number>(0);
  const [manualSaldo, setManualSaldo] = useState<number>(0);

  useEffect(() => {
    fetchEntries();
  }, [selectedMonth]);

  // Stundenkonto-Saldo laden (nicht abhängig vom angezeigten Monat —
  // der Saldo läuft über alle Daten, der Monat ist nur Anzeige-Filter).
  // Wird nach Update/Delete erneut aufgerufen, damit die Karte aktuell bleibt.
  const fetchSaldo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: acc }, { data: allEntries }] = await Promise.all([
      (supabase.from("time_accounts" as never) as any)
        .select("balance_hours").eq("user_id", user.id).maybeSingle(),
      supabase.from("time_entries")
        .select("datum, stunden, taetigkeit").eq("user_id", user.id),
    ]);
    setManualSaldo(Number((acc as any)?.balance_hours) || 0);
    setAutoSaldoAll(totalAutoSaldo((allEntries as any[]) || []));
  };

  useEffect(() => {
    fetchSaldo();
  }, []);

  // Tages-Aggregation des aktuell angezeigten Monats (für Tagessaldo-Spalte).
  const dayBalances = useMemo(() => aggregateByDay(entries as any), [entries]);
  // Gesamt = gearbeitet; Sonderzeiten (Urlaub/Krankenstand/Feiertag/ZA/
  // Weiterbildung) separat — sie sind keine Arbeitsstunden.
  const aufteilung = useMemo(() => stundenAufteilung(entries as any), [entries]);
  const totalHours = aufteilung.gearbeitet;
  const dayBalanceMap = useMemo(() => new Map(dayBalances.map(d => [d.datum, d])), [dayBalances]);
  const effektiv = autoSaldoAll + manualSaldo;

  const fetchEntries = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [year, month] = selectedMonth.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const { data } = await supabase
      .from("time_entries")
      .select("*, projects(name, plz)")
      .eq("user_id", user.id)
      .gte("datum", startDate)
      .lte("datum", endDate)
      .order("datum", { ascending: false });

    if (data) {
      setEntries(data as any);
    }
    setLoading(false);
  };

  // Bearbeiten/Löschen nur für Einträge im ECHTEN aktuellen Kalendermonat
  // (nicht im bloß angezeigten Monat — sonst wäre der Check immer wahr).
  const isCurrentMonth = (datum: string) => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return datum.startsWith(currentMonth);
  };

  // Sonderzeit-Einträge (Urlaub/Krankenstand/Zeitausgleich/Feiertag/
  // Weiterbildung) verändern Zeitkonto bzw. Saldo-Neutralität — Mitarbeiter
  // dürfen sie nicht selbst bearbeiten oder löschen.
  const isSpecialEntry = (taetigkeit: string) => SONDER_TAETIGKEITEN.has(taetigkeit);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p>Lädt...</p></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />Zurück
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-7xl space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-5 w-5" />
              Stundenkonto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Auto (aus Buchungen)</p>
                <p className={`text-xl font-bold ${autoSaldoAll > 0.005 ? "text-green-600" : autoSaldoAll < -0.005 ? "text-red-600" : ""}`}>
                  {formatSaldo(autoSaldoAll)} h
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Manuelle Korrektur</p>
                <p className={`text-xl font-bold ${manualSaldo > 0.005 ? "text-green-600" : manualSaldo < -0.005 ? "text-red-600" : ""}`}>
                  {formatSaldo(manualSaldo)} h
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Effektiver Saldo</p>
                <p className={`text-2xl font-extrabold ${effektiv > 0.005 ? "text-green-600" : effektiv < -0.005 ? "text-red-600" : ""}`}>
                  {formatSaldo(effektiv)} h
                </p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Plus = Überstunden-Guthaben · Minus = Nachzuholende Stunden. Urlaub, Krankenstand, Feiertag und Zeitausgleich werden neutral gerechnet.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Meine Stunden
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b">
              <div className="flex items-center gap-2">
                <Label htmlFor="month-select" className="text-sm font-medium">Monat:</Label>
                <Input
                  id="month-select"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="text-sm sm:text-base space-y-0.5">
                {(() => {
                  // Soll/Saldo des Monats aus der zentralen Tages-Aggregation —
                  // exakt dieselbe Logik wie das Stundenkonto oben: es zählen nur
                  // Tage MIT Buchung (kein Phantom-Minus für nicht gebuchte Tage),
                  // Sonderzeiten (Urlaub/Krankenstand/Feiertag/Zeitausgleich/
                  // Weiterbildung) werden neutral gerechnet (Soll 0, Saldo 0).
                  const sollTotal = dayBalances.reduce((s, d) => s + d.soll, 0);
                  const diff = dayBalances.reduce((s, d) => s + d.saldo, 0);
                  return (
                    <>
                      <div>
                        <span className="text-muted-foreground">Gearbeitet: </span>
                        <span className="font-bold text-lg text-primary">{totalHours.toFixed(2)} Std.</span>
                        <span className="text-muted-foreground ml-2">Soll: </span>
                        <span className="font-medium">{sollTotal.toFixed(2)} Std.</span>
                      </div>
                      {aufteilung.sonderGesamt > 0 && (
                        <div className="text-xs text-muted-foreground">
                          + {sonderzeitenText(aufteilung)} <span className="opacity-70">(zählen nicht als Arbeitsstunden)</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Saldo (Monat): </span>
                        <span className={`font-bold ${diff >= -0.005 ? "text-green-600" : "text-red-600"}`}>
                          {formatSaldo(diff)} Std.
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {entries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Keine Einträge für {new Date(selectedMonth + '-01').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
              </p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Ort</TableHead>
                      <TableHead>Projekt</TableHead>
                      <TableHead className="text-center">Von</TableHead>
                      <TableHead className="text-center">Bis</TableHead>
                      <TableHead className="text-center">Pause</TableHead>
                      <TableHead className="text-right">Stunden</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      // Group entries by date
                      const grouped = new Map<string, TimeEntry[]>();
                      entries.forEach(e => {
                        const list = grouped.get(e.datum) || [];
                        list.push(e);
                        grouped.set(e.datum, list);
                      });
                      const rows: React.ReactNode[] = [];
                      grouped.forEach((dayEntries, datum) => {
                        const dateObj = new Date(datum + "T12:00:00");
                        // Tagessaldo aus dem zentralen Helper — Sonderzeiten neutral.
                        const dayBal = dayBalanceMap.get(datum);
                        dayEntries.forEach((entry, idx) => {
                          rows.push(
                            <TableRow key={entry.id} className={idx > 0 ? "border-t-0" : ""}>
                              {idx === 0 ? (
                                <TableCell className="font-medium whitespace-nowrap text-sm align-top" rowSpan={dayEntries.length}>
                                  {dateObj.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}
                                </TableCell>
                              ) : null}
                              <TableCell className="text-sm">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{entry.location_type === 'werkstatt' ? '🏢 Firma' : '🏗️ Baustelle'}</span>
                                  {entry.nachgetragen_von && (
                                    <span
                                      className="inline-flex items-center px-1 py-0 text-[9px] rounded border border-amber-400 text-amber-700 bg-amber-50"
                                      title={`Von Admin nachgetragen${entry.nachgetragen_am ? ` am ${new Date(entry.nachgetragen_am).toLocaleDateString("de-DE")}` : ""}`}
                                    >
                                      nachgetragen
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{entry.projects?.name || '-'}</TableCell>
                              <TableCell className="text-center text-sm">{entry.start_time?.substring(0, 5) || '-'}</TableCell>
                              <TableCell className="text-center text-sm">{entry.end_time?.substring(0, 5) || '-'}</TableCell>
                              <TableCell className="text-center text-sm">{entry.pause_minutes ? `${entry.pause_minutes} Min` : '-'}</TableCell>
                              <TableCell className="text-right font-semibold">{entry.stunden.toFixed(2)} h</TableCell>
                              <TableCell className="text-right">
                                {idx === 0 && dayBal && Math.abs(dayBal.saldo) >= 0.005 ? (
                                  <span className={`font-medium ${dayBal.saldo > 0 ? "text-green-600" : "text-red-600"}`}>
                                    {formatSaldo(dayBal.saldo)} h
                                  </span>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditId(entry.id)}
                                  disabled={!isCurrentMonth(entry.datum) || isSpecialEntry(entry.taetigkeit)}
                                  title={isSpecialEntry(entry.taetigkeit) ? "Abwesenheits-/ZA-Einträge können nur vom Admin geändert werden" : undefined}
                                  className="h-7 w-7 p-0"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        });
                        // Day summary row (only if multiple entries)
                        if (dayEntries.length > 1) {
                          const dayTotal = dayBal?.ist ?? dayEntries.reduce((s, e) => s + (e.stunden || 0), 0);
                          const sollH = dayBal?.soll ?? 0;
                          const dayDiff = dayBal?.saldo ?? (dayTotal - sollH);
                          rows.push(
                            <TableRow key={`sum-${datum}`} className="bg-muted/30">
                              <TableCell colSpan={6} className="text-right text-xs text-muted-foreground py-1">
                                Tagesgesamt: <span className="font-medium text-foreground">{dayTotal.toFixed(2)} h</span>
                                {sollH > 0 && (
                                  <span className={`ml-2 ${dayDiff >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    ({dayDiff >= 0 ? "+" : ""}{dayDiff.toFixed(2)})
                                  </span>
                                )}
                              </TableCell>
                              <TableCell colSpan={2}></TableCell>
                            </TableRow>
                          );
                        }
                      });
                      return rows;
                    })()}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={6} className="text-right font-semibold">
                        Gesamt gearbeitet:
                        {aufteilung.sonderGesamt > 0 && <span className="block text-[10px] font-normal text-muted-foreground">+ {sonderzeitenText(aufteilung)}</span>}
                      </TableCell>
                      <TableCell className="text-right font-bold">{totalHours.toFixed(2)} h</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Bearbeiten (inkl. Datum) — gemeinsamer Dialog mit der Zeiterfassung */}
      <StundenEintragBearbeitenDialog
        entryId={editId}
        open={!!editId}
        onClose={() => setEditId(null)}
        onSaved={() => { fetchEntries(); fetchSaldo(); }}
      />
    </div>
  );
};

export default MyHours;
