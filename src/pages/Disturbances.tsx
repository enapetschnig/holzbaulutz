import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Zap, Plus, Calendar, Clock, User, Mail, Phone, MapPin, Filter, Search, ArrowLeft, X, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { DisturbanceForm } from "@/components/DisturbanceForm";

type Disturbance = {
  id: string;
  datum: string;
  start_time: string;
  end_time: string;
  pause_minutes: number;
  stunden: number;
  kunde_name: string;
  kunde_email: string | null;
  kunde_adresse: string | null;
  kunde_telefon: string | null;
  beschreibung: string;
  notizen: string | null;
  status: string;
  is_verrechnet: boolean;
  created_at: string;
  user_id: string;
  profile_vorname?: string;
  profile_nachname?: string;
};

const Disturbances = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [disturbances, setDisturbances] = useState<Disturbance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingDisturbance, setEditingDisturbance] = useState<Disturbance | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [prefillProjectId, setPrefillProjectId] = useState<string | null>(null);

  // Projekt-Link "Regieberichte · N": /disturbances?project=<project_id> → Liste filtern
  const projectFilter = searchParams.get("project");

  useEffect(() => {
    checkAuth();
    // Quick-Action aus Projekt: /disturbances?new=<project_id> → Dialog automatisch öffnen mit vorbelegtem Projekt
    const newProjectId = searchParams.get("new");
    if (newProjectId) {
      setPrefillProjectId(newProjectId);
      setShowForm(true);
    }
  }, []);

  // Neu laden, wenn der Projekt-Filter wechselt (z. B. Chip entfernt) —
  // der initiale Fetch läuft über checkAuth, daher hier erst nach dem Laden
  useEffect(() => {
    if (!loading) {
      fetchDisturbances();
    }
  }, [projectFilter]);

  const clearProjectFilter = () => {
    searchParams.delete("project");
    setSearchParams(searchParams, { replace: true });
  };

  // Alle Regiebericht-PDFs des gefilterten Projekts als ZIP herunterladen
  const [zipLoading, setZipLoading] = useState(false);
  const downloadAlleAlsZip = async () => {
    const mitPdf = disturbances.filter(d => (d as any).pdf_path);
    if (mitPdf.length === 0) {
      toast({ variant: "destructive", title: "Keine PDFs vorhanden", description: "Für diese Regieberichte wurden noch keine PDFs erstellt." });
      return;
    }
    setZipLoading(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      let ok = 0;
      for (const d of mitPdf) {
        const { data: signed } = await supabase.storage
          .from("regiebericht-pdfs")
          .createSignedUrl((d as any).pdf_path, 120);
        if (!signed?.signedUrl) continue;
        const res = await fetch(signed.signedUrl);
        if (!res.ok) continue;
        const datum = d.datum ? new Date(d.datum).toISOString().slice(0, 10) : "ohne-datum";
        const name = `Regiebericht_${datum}_${(d.kunde_name || "unbenannt").replace(/[^\wäöüÄÖÜß-]+/g, "_")}.pdf`;
        zip.file(name, await res.arrayBuffer());
        ok++;
      }
      if (ok === 0) throw new Error("Keine der PDF-Dateien konnte geladen werden.");
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "Regieberichte.zip"; a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Download gestartet", description: `${ok} Regiebericht${ok === 1 ? "" : "e"} als ZIP.${ok < mitPdf.length ? ` ${mitPdf.length - ok} PDFs konnten nicht geladen werden.` : ""}` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "ZIP-Download fehlgeschlagen", description: e?.message || "Unbekannter Fehler" });
    } finally {
      setZipLoading(false);
    }
  };

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    // Check if admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    setIsAdmin(roleData?.role === "administrator");
    fetchDisturbances();
  };

  const fetchDisturbances = async () => {
    setLoading(true);

    let query = supabase
      .from("disturbances")
      .select("*")
      .order("datum", { ascending: false });

    if (projectFilter) {
      query = query.eq("project_id", projectFilter);
    }

    const { data, error } = await query;

    if (error) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Störungen konnten nicht geladen werden",
      });
    } else {
      // Fetch profile names separately for admin view
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(d => d.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, vorname, nachname")
          .in("id", userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        const enrichedData = data.map(d => ({
          ...d,
          profile_vorname: profileMap.get(d.user_id)?.vorname || "",
          profile_nachname: profileMap.get(d.user_id)?.nachname || "",
        }));
        
        setDisturbances(enrichedData);
      } else {
        setDisturbances([]);
      }
    }
    setLoading(false);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingDisturbance(null);
    fetchDisturbances();
  };

  const getStatusBadge = (status: string, isVerrechnet?: boolean) => {
    if (isVerrechnet) {
      return <Badge className="bg-emerald-600 text-white">Verrechnet</Badge>;
    }
    switch (status) {
      case "offen":
        return <Badge variant="secondary">Offen</Badge>;
      case "gesendet":
        return <Badge className="bg-blue-500">Gesendet</Badge>;
      case "abgeschlossen":
        return <Badge className="bg-green-500">Abgeschlossen</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleToggleVerrechnet = async (e: React.MouseEvent, disturbanceId: string, currentValue: boolean) => {
    e.stopPropagation();
    
    const { error } = await supabase
      .from("disturbances")
      .update({ is_verrechnet: !currentValue })
      .eq("id", disturbanceId);
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Status konnte nicht geändert werden",
      });
    } else {
      fetchDisturbances();
    }
  };

  const filteredDisturbances = disturbances.filter((d) => {
    const matchesSearch =
      d.kunde_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.beschreibung.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.kunde_adresse?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    let matchesStatus = true;
    if (statusFilter === "verrechnet") {
      matchesStatus = d.is_verrechnet === true;
    } else if (statusFilter === "nicht_verrechnet") {
      matchesStatus = d.is_verrechnet === false;
    } else if (statusFilter !== "alle") {
      matchesStatus = d.status === statusFilter;
    }
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Regieberichte</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header with action button */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              Regieberichte
            </h1>
            <p className="text-muted-foreground">
              Service-Einsätze dokumentieren
            </p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Neuer Regiebericht
          </Button>
        </div>

        {/* Filter Section */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Suche nach Kunde, Beschreibung..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Status</SelectItem>
                  <SelectItem value="offen">Offen</SelectItem>
                  <SelectItem value="gesendet">Gesendet</SelectItem>
                  <SelectItem value="abgeschlossen">Abgeschlossen</SelectItem>
                  <SelectItem value="verrechnet">Verrechnet</SelectItem>
                  <SelectItem value="nicht_verrechnet">Nicht verrechnet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {projectFilter && (
              <div className="mt-3">
                <Badge variant="secondary" className="gap-1 pr-1">
                  Projekt-Filter aktiv
                  <button
                    type="button"
                    aria-label="Projekt-Filter aufheben"
                    className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    onClick={clearProjectFilter}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Projekt-Übersicht: Regiestunden je Person + Arbeiten + Sammel-Download.
            Regiestunden sind ein EIGENER Topf — sie zählen nicht zu den
            Projektstunden aus der Zeiterfassung. */}
        {projectFilter && disturbances.length > 0 && (() => {
          const gesamt = disturbances.reduce((s, d) => s + (Number(d.stunden) || 0), 0);
          const jePerson = new Map<string, { name: string; stunden: number; arbeiten: string[] }>();
          for (const d of disturbances) {
            const name = `${(d as any).profile_vorname || ""} ${(d as any).profile_nachname || ""}`.trim() || "Unbekannt";
            if (!jePerson.has(name)) jePerson.set(name, { name, stunden: 0, arbeiten: [] });
            const g = jePerson.get(name)!;
            g.stunden += Number(d.stunden) || 0;
            const arbeit = (d.beschreibung || "").split("\n")[0].trim();
            if (arbeit && !g.arbeiten.includes(arbeit)) g.arbeiten.push(arbeit);
          }
          return (
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Regiestunden auf diesem Projekt: {gesamt.toLocaleString("de-AT", { maximumFractionDigits: 1 })} Std.
                    <span className="text-sm font-normal text-muted-foreground">({disturbances.length} Bericht{disturbances.length === 1 ? "" : "e"})</span>
                  </span>
                  <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={downloadAlleAlsZip} disabled={zipLoading}>
                    {zipLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Alle PDFs (ZIP)
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1.5">
                  {[...jePerson.values()].sort((a, b) => b.stunden - a.stunden).map(p => (
                    <div key={p.name} className="flex items-baseline justify-between gap-3 text-sm border-b border-border/50 last:border-0 pb-1.5 last:pb-0">
                      <div className="min-w-0">
                        <span className="font-medium">{p.name}</span>
                        {p.arbeiten.length > 0 && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {p.arbeiten.slice(0, 3).join(" · ").slice(0, 90)}{p.arbeiten.length > 3 ? " …" : ""}
                          </span>
                        )}
                      </div>
                      <span className="font-mono tabular-nums shrink-0">{p.stunden.toLocaleString("de-AT", { maximumFractionDigits: 1 })} Std.</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Regiestunden zählen nicht zu den Projektstunden aus der Zeiterfassung — verrechnet werden sie über „Aus Regiebericht" in der Rechnung.
                </p>
              </CardContent>
            </Card>
          );
        })()}

        {/* Disturbances List */}
        {filteredDisturbances.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Keine Einträge gefunden</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "alle" || projectFilter
                  ? "Keine Einträge entsprechen Ihren Filterkriterien"
                  : "Erstellen Sie Ihren ersten Regiebericht"}
              </p>
              {!searchQuery && statusFilter === "alle" && !projectFilter && (
                <Button onClick={() => setShowForm(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Ersten Regiebericht erfassen
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredDisturbances.map((disturbance) => (
              <Card
                key={disturbance.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/disturbances/${disturbance.id}`)}
              >
                <CardContent className="pt-4">
                  <div className="flex flex-col sm:flex-row gap-4 justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {disturbance.kunde_name}
                          </h3>
                          {isAdmin && (disturbance.profile_vorname || disturbance.profile_nachname) && (
                            <p className="text-xs text-muted-foreground">
                              Erstellt von: {disturbance.profile_vorname} {disturbance.profile_nachname}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {getStatusBadge(disturbance.status, disturbance.is_verrechnet)}
                          {isAdmin && disturbance.status !== "offen" && (
                            <Button
                              variant={disturbance.is_verrechnet ? "secondary" : "outline"}
                              size="sm"
                              className="h-6 text-xs"
                              onClick={(e) => handleToggleVerrechnet(e, disturbance.id, disturbance.is_verrechnet)}
                            >
                              {disturbance.is_verrechnet ? "✓ Verrechnet" : "Verrechnen"}
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(disturbance.datum), "dd.MM.yyyy", { locale: de })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {disturbance.start_time.slice(0, 5)} - {disturbance.end_time.slice(0, 5)} ({disturbance.stunden.toFixed(1)}h)
                        </span>
                        {disturbance.kunde_adresse && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {disturbance.kunde_adresse}
                          </span>
                        )}
                      </div>

                      <p className="text-sm line-clamp-2">{disturbance.beschreibung}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Disturbance Form Dialog */}
      <DisturbanceForm
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setPrefillProjectId(null);
        }}
        onSuccess={handleFormSuccess}
        editData={editingDisturbance}
        prefillProjectId={prefillProjectId}
      />
    </div>
  );
};

export default Disturbances;
