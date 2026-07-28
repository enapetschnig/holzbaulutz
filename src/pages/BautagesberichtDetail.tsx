import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ClipboardList, Clock, User, Mail, Phone, MapPin, Edit, Trash2, Package, ArrowLeft, Users, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { BautagesberichtForm } from "@/components/BautagesberichtForm";
import { parseTaetigkeiten, zeitraum, fmtStunden } from "@/lib/berichtZeiten";
import { BautagesberichtPhotos } from "@/components/BautagesberichtPhotos";

type Bautagesbericht = {
  id: string;
  datum: string;
  start_time: string | null;
  end_time: string | null;
  taetigkeiten?: unknown;
  location_type?: string | null;
  pause_minutes: number;
  stunden: number;
  kunde_name: string;
  kunde_email: string | null;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_ort: string | null;
  kunde_telefon: string | null;
  beschreibung: string;
  notizen: string | null;
  status: string;
  is_verrechnet: boolean;
  pdf_path: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  profile_vorname?: string;
  profile_nachname?: string;
};

type Worker = {
  user_id: string;
  is_main: boolean;
  vorname: string;
  nachname: string;
};

type Material = {
  id: string;
  material: string;
  menge: string | null;
  einheit: string | null;
  notizen: string | null;
};

const BautagesberichtDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bericht, setBericht] = useState<Bautagesbericht | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAuthAndFetch();
  }, [id]);

  const checkAuthAndFetch = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    setCurrentUserId(session.user.id);

    // Check if admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    setIsAdmin(roleData?.role === "administrator");
    fetchBericht();
  };

  const fetchBericht = async () => {
    if (!id) return;

    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("bautagesberichte")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bautagesbericht konnte nicht geladen werden",
      });
      navigate("/bautagesberichte");
    } else {
      // Fetch profile name
      const { data: profile } = await supabase
        .from("profiles")
        .select("vorname, nachname")
        .eq("id", data.user_id)
        .single();

      setBericht({
        ...(data as Bautagesbericht),
        profile_vorname: profile?.vorname || "",
        profile_nachname: profile?.nachname || "",
      });

      // Fetch workers
      const { data: workersData } = await (supabase as any)
        .from("bautagesbericht_workers")
        .select("user_id, is_main")
        .eq("bautagesbericht_id", id);

      if (workersData && workersData.length > 0) {
        const workerIds = workersData.map((w: any) => w.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, vorname, nachname")
          .in("id", workerIds);

        const workersWithNames: Worker[] = workersData.map((w: any) => {
          const workerProfile = profiles?.find((p) => p.id === w.user_id);
          return {
            user_id: w.user_id,
            is_main: w.is_main,
            vorname: workerProfile?.vorname || "",
            nachname: workerProfile?.nachname || "",
          };
        });
        setWorkers(workersWithNames);
      } else {
        setWorkers([]);
      }

      // Fetch materials (read-only; Bearbeitung erfolgt über das Formular)
      const { data: materialsData } = await (supabase as any)
        .from("bautagesbericht_materials")
        .select("id, material, menge, einheit, notizen")
        .eq("bautagesbericht_id", id)
        .order("created_at", { ascending: true });

      setMaterials((materialsData || []) as Material[]);

    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!bericht) return;

    setDeleting(true);

    // Delete the bautagesbericht (workers/materials/photos cascade)
    const { error } = await (supabase as any)
      .from("bautagesberichte")
      .delete()
      .eq("id", bericht.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bautagesbericht konnte nicht gelöscht werden",
      });
    } else {
      toast({
        title: "Erfolg",
        description: "Bautagesbericht wurde gelöscht",
      });
      navigate("/bautagesberichte");
    }
    setDeleting(false);
  };

  const handleEditSuccess = () => {
    setShowEditForm(false);
    fetchBericht();
  };

  const handleDownloadPdf = async () => {
    if (!bericht?.pdf_path) return;

    const { data, error } = await supabase.storage
      .from("bautagesbericht-pdfs")
      .createSignedUrl(bericht.pdf_path, 300);

    if (error || !data?.signedUrl) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "PDF konnte nicht geladen werden",
      });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const getStatusBadge = (status: string, isVerrechnet?: boolean) => {
    if (isVerrechnet) {
      return <Badge className="bg-emerald-600 text-white text-base px-3 py-1">Verrechnet</Badge>;
    }
    switch (status) {
      case "erstellt":
        return <Badge variant="secondary">Erstellt</Badge>;
      case "offen":
        return <Badge variant="secondary" className="text-base px-3 py-1">Offen</Badge>;
      case "gesendet":
        return <Badge className="bg-blue-500 text-base px-3 py-1">Gesendet</Badge>;
      case "abgeschlossen":
        return <Badge className="bg-green-500 text-base px-3 py-1">Abgeschlossen</Badge>;
      default:
        return <Badge variant="outline" className="text-base px-3 py-1">{status}</Badge>;
    }
  };

  const handleToggleVerrechnet = async () => {
    if (!bericht) return;

    const { error } = await (supabase as any)
      .from("bautagesberichte")
      .update({ is_verrechnet: !bericht.is_verrechnet })
      .eq("id", bericht.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Status konnte nicht geändert werden",
      });
    } else {
      fetchBericht();
    }
  };

  const canEdit = bericht && (currentUserId === bericht.user_id || isAdmin);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!bericht) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/bautagesberichte")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-lg font-semibold">Bautagesbericht nicht gefunden</h1>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 text-center">
          <p>Der angeforderte Bautagesbericht konnte nicht gefunden werden.</p>
          <Button onClick={() => navigate("/bautagesberichte")} className="mt-4">
            Zurück zur Übersicht
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/bautagesberichte")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Bautagesbericht Details</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Header with status and actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
          <div className="flex items-center gap-4">
            <ClipboardList className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">{bericht.kunde_name}</h1>
              <p className="text-muted-foreground">
                {format(new Date(bericht.datum), "EEEE, dd. MMMM yyyy", { locale: de })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {getStatusBadge(bericht.status, bericht.is_verrechnet)}
            {bericht.pdf_path && (
              <Button variant="outline" size="sm" className="gap-1" onClick={handleDownloadPdf}>
                <FileDown className="h-4 w-4" />
                PDF
              </Button>
            )}
            {isAdmin && bericht.status !== "offen" && (
              <Button
                variant={bericht.is_verrechnet ? "secondary" : "outline"}
                size="sm"
                onClick={handleToggleVerrechnet}
              >
                {bericht.is_verrechnet ? "✓ Verrechnet" : "Als verrechnet markieren"}
              </Button>
            )}
            {canEdit && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowEditForm(true)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Bearbeiten
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={deleting}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Löschen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Bautagesbericht löschen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Diese Aktion kann nicht rückgängig gemacht werden. Der Bautagesbericht und alle zugehörigen Materialien und Fotos werden endgültig gelöscht.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                        Löschen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>

        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Kundendaten
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{bericht.kunde_name}</p>
            </div>
            {bericht.kunde_email && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-4 w-4" /> E-Mail
                </p>
                <a href={`mailto:${bericht.kunde_email}`} className="font-medium text-primary hover:underline">
                  {bericht.kunde_email}
                </a>
              </div>
            )}
            {bericht.kunde_telefon && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-4 w-4" /> Telefon
                </p>
                <a href={`tel:${bericht.kunde_telefon}`} className="font-medium text-primary hover:underline">
                  {bericht.kunde_telefon}
                </a>
              </div>
            )}
            {bericht.kunde_adresse && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-4 w-4" /> Adresse
                </p>
                <p className="font-medium">{bericht.kunde_adresse}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Time Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Arbeitszeit
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Datum</p>
              <p className="font-medium">
                {format(new Date(bericht.datum), "dd.MM.yyyy", { locale: de })}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {zeitraum(bericht.start_time, bericht.end_time) ? "Arbeitszeit" : "Arbeitsort"}
              </p>
              <p className="font-medium">
                {zeitraum(bericht.start_time, bericht.end_time)
                  ?? (bericht.location_type === "werkstatt" ? "🏢 Firma" : "🏗️ Baustelle")}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Gesamtstunden</p>
              <p className="font-medium text-lg text-primary">{fmtStunden(bericht.stunden)} h</p>
            </div>
            {bericht.pause_minutes > 0 && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Pause</p>
                <p className="font-medium">{bericht.pause_minutes} Minuten</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tätigkeiten */}
        {parseTaetigkeiten(bericht.taetigkeiten).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Tätigkeiten
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {parseTaetigkeiten(bericht.taetigkeiten).map((t, i) => (
                <div key={i} className="flex justify-between gap-3 border-b border-border/50 last:border-0 py-1.5">
                  <span>{t.text}</span>
                  <span className="font-mono tabular-nums shrink-0">{fmtStunden(t.stunden)} h</span>
                </div>
              ))}
              <div className="flex justify-between gap-3 pt-2 font-semibold">
                <span>Gesamt</span>
                <span className="font-mono tabular-nums">{fmtStunden(bericht.stunden)} h</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Work Description */}
        <Card>
          <CardHeader>
            <CardTitle>Durchgeführte Arbeiten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="whitespace-pre-wrap">{bericht.beschreibung}</p>
            </div>
            {bericht.notizen && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Notizen</p>
                  <p className="whitespace-pre-wrap text-sm">{bericht.notizen}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Workers Section */}
        {workers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Beteiligte Mitarbeiter
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {workers.map((worker) => (
                  <Badge
                    key={worker.user_id}
                    variant={worker.is_main ? "default" : "secondary"}
                    className="text-sm py-1 px-3"
                  >
                    {worker.vorname} {worker.nachname}
                    {worker.is_main && " (Ersteller)"}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {workers.length} Mitarbeiter waren an diesem Einsatz beteiligt.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Photos Section */}
        <BautagesberichtPhotos
          bautagesberichtId={bericht.id}
          canEdit={canEdit || false}
        />

        {/* Materials Section (read-only; Bearbeitung im Formular) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Verwendete Materialien
            </CardTitle>
          </CardHeader>
          <CardContent>
            {materials.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Keine Materialien erfasst</p>
              </div>
            ) : (
              <ul className="text-sm space-y-2">
                {materials.map((material) => (
                  <li key={material.id} className="flex gap-2">
                    <span>•</span>
                    <span>
                      {material.menge && `${material.menge} ${material.einheit || ""} `}
                      {material.material}
                      {material.notizen && (
                        <span className="text-muted-foreground"> ({material.notizen})</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        {isAdmin && (bericht.profile_vorname || bericht.profile_nachname) && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>Erfasst von: {bericht.profile_vorname} {bericht.profile_nachname}</span>
                <span>Erstellt: {format(new Date(bericht.created_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
                <span>Zuletzt aktualisiert: {format(new Date(bericht.updated_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Edit Form Dialog */}
      <BautagesberichtForm
        open={showEditForm}
        onOpenChange={setShowEditForm}
        onSuccess={handleEditSuccess}
        editData={bericht}
      />

    </div>
  );
};

export default BautagesberichtDetail;
