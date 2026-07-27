import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, User, Mail, Phone, FileText, Package, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DictateButton } from "@/components/DictateButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEinheiten } from "@/hooks/useEinheiten";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TaetigkeitenEditor } from "@/components/TaetigkeitenEditor";
import {
  type TaetigkeitEntry,
  entriesToTaetigkeiten,
  taetigkeitenToEntries,
  parseTaetigkeiten,
  summeStunden,
  taetigkeitenAlsText,
} from "@/lib/berichtZeiten";
import { format } from "date-fns";
import { MultiEmployeeSelect } from "@/components/MultiEmployeeSelect";
import { CustomerSelect } from "@/components/CustomerSelect";

type MaterialEntry = {
  id: string;
  material: string;
  menge: string;
  einheit: string;
};

type BautagesberichtFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editData?: {
    id: string;
    datum: string;
    start_time: string | null;
    end_time: string | null;
    pause_minutes: number;
    taetigkeiten?: unknown;
    location_type?: string | null;
    kunde_name: string;
    kunde_email: string | null;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_ort: string | null;
    kunde_telefon: string | null;
    beschreibung: string;
    notizen: string | null;
    project_id?: string | null;
    customer_id?: string | null;
  } | null;
  /** Wenn gesetzt: Projekt beim Öffnen des Formulars vorselektieren (Quick-Action aus ProjectOverview) */
  prefillProjectId?: string | null;
};

export const BautagesberichtForm = ({ open, onOpenChange, onSuccess, editData, prefillProjectId }: BautagesberichtFormProps) => {
  const { toast } = useToast();
  const einheiten = useEinheiten();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  // Tätigkeitszeilen statt von-bis: "Aufräumen 1 h", "Stapler richten 2,5 h"
  const [taetigkeiten, setTaetigkeiten] = useState<TaetigkeitEntry[]>(
    [{ id: crypto.randomUUID(), text: "", stunden: "" }],
  );
  // Arbeitsort wie in der Zeiterfassung — Werkstattarbeit ist nicht direkt
  // verrechenbar und läuft deshalb ohne Projekt.
  const [arbeitsort, setArbeitsort] = useState<"baustelle" | "werkstatt">("baustelle");

  const [formData, setFormData] = useState({
    datum: format(new Date(), "yyyy-MM-dd"),
    kundeName: "",
    kundeEmail: "",
    kundeAdresse: "",
    kundePlz: "",
    kundeOrt: "",
    kundeTelefon: "",
    beschreibung: "",
    notizen: "",
  });

  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [materials, setMaterials] = useState<MaterialEntry[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<{id: string; name: string; customer_id: string | null}[]>([]);

  useEffect(() => {
    if (!open) {
      setSelectedCustomerId(null);
      setSelectedProjectId(null);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      supabase.from("projects").select("id, name, customer_id").not("status", "eq", "Abgeschlossen").order("name")
        .then(({ data }) => {
          if (data) {
            setProjects(data);
            // Prefill-Projekt aus Quick-Action (ProjectOverview): Kunde auto-füllen
            if (prefillProjectId && !editData) {
              setSelectedProjectId(prefillProjectId);
              const p = data.find((x) => x.id === prefillProjectId);
              if (p?.customer_id) {
                supabase.from("customers")
                  .select("id, name, adresse, plz, ort, email, telefon")
                  .eq("id", p.customer_id).single()
                  .then(({ data: cust }) => {
                    if (cust) {
                      setSelectedCustomerId(cust.id);
                      setFormData((prev) => ({
                        ...prev,
                        kundeName: cust.name,
                        kundeEmail: cust.email || "",
                        kundeAdresse: cust.adresse || "",
                        kundePlz: cust.plz || "",
                        kundeOrt: cust.ort || "",
                        kundeTelefon: cust.telefon || "",
                      }));
                    }
                  });
              }
            }
          }
        });
    }
  }, [open, prefillProjectId, editData]);

  useEffect(() => {
    if (editData) {
      setTaetigkeiten(taetigkeitenToEntries(parseTaetigkeiten(editData.taetigkeiten)));
      setArbeitsort(editData.location_type === "werkstatt" ? "werkstatt" : "baustelle");
      setFormData({
        datum: editData.datum,
        kundeName: editData.kunde_name,
        kundeEmail: editData.kunde_email || "",
        kundeAdresse: editData.kunde_adresse || "",
        kundePlz: editData.kunde_plz || "",
        kundeOrt: editData.kunde_ort || "",
        kundeTelefon: editData.kunde_telefon || "",
        beschreibung: editData.beschreibung,
        notizen: editData.notizen || "",
      });
      // Projekt-/Kundenverknüpfung aus dem Bericht übernehmen — sonst würde
      // jede Bearbeitung project_id/customer_id auf null zurücksetzen.
      setSelectedProjectId(editData.project_id ?? null);
      setSelectedCustomerId(editData.customer_id ?? null);
      // Load existing workers and materials when editing
      loadExistingWorkers(editData.id);
      loadExistingMaterials(editData.id);
    } else {
      // Reset form for new entry
      setTaetigkeiten([{ id: crypto.randomUUID(), text: "", stunden: "" }]);
      setArbeitsort("baustelle");
      setFormData({
        datum: format(new Date(), "yyyy-MM-dd"),
        kundeName: "",
        kundeEmail: "",
        kundeAdresse: "",
        kundePlz: "",
        kundeOrt: "",
        kundeTelefon: "",
        beschreibung: "",
        notizen: "",
      });
      setSelectedEmployees([]);
      setMaterials([]);
    }
  }, [editData, open]);

  const loadExistingWorkers = async (bautagesberichtId: string) => {
    const { data } = await (supabase as any)
      .from("bautagesbericht_workers")
      .select("user_id, is_main")
      .eq("bautagesbericht_id", bautagesberichtId);

    if (data) {
      // Only load non-main workers (main is the creator)
      const additionalWorkers = data.filter((w: any) => !w.is_main).map((w: any) => w.user_id);
      setSelectedEmployees(additionalWorkers);
    }
  };

  const loadExistingMaterials = async (bautagesberichtId: string) => {
    const { data } = await (supabase as any)
      .from("bautagesbericht_materials")
      .select("id, material, menge, einheit")
      .eq("bautagesbericht_id", bautagesberichtId);

    if (data) {
      setMaterials(data.map((m: any) => ({
        id: m.id,
        material: m.material,
        menge: m.menge || "",
        einheit: m.einheit || "Stk.",
      })));
    }
  };

  /** Berichtsstunden = Summe der Tätigkeitszeilen. */
  const calculateHours = (): number => summeStunden(entriesToTaetigkeiten(taetigkeiten));

  const addMaterial = () => {
    setMaterials([...materials, { id: crypto.randomUUID(), material: "", menge: "", einheit: "Stk." }]);
    // Auto-scroll to new material after render
    setTimeout(() => {
      const container = document.querySelector('[data-materials-list]');
      if (container) container.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
  };

  const removeMaterial = (id: string) => {
    setMaterials(materials.filter(m => m.id !== id));
  };

  const updateMaterial = (id: string, field: "material" | "menge" | "einheit", value: string) => {
    setMaterials(materials.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  /**
   * Zeitspiegelung: bautagesberichte haben keinen FK in time_entries,
   * daher werden gespiegelte Einträge über einen Notiz-Marker
   * ("Bautagesbericht-Zuordnung: <id>") identifiziert und beim
   * Aktualisieren zunächst (best effort, RLS-beschränkt) entfernt.
   */
  // PDF sofort erzeugen und ablegen (Bericht + Projektordner) — OHNE
  // Unterschrift und OHNE E-Mail. Fehler sind nicht fatal (Bericht ist da).
  const erzeugePdf = async (bericht: any, userId: string) => {
    try {
      const ids = [userId, ...selectedEmployees];
      const { data: profs } = await supabase.from("profiles").select("id, vorname, nachname").in("id", ids);
      const nameVon = (id: string) => {
        const p = (profs || []).find((x: any) => x.id === id);
        return p ? `${p.vorname} ${p.nachname}`.trim() : "";
      };
      const technicianNames = ids.map(nameVon).filter(Boolean);
      const { error } = await supabase.functions.invoke("send-bautagesbericht-report", {
        body: {
          bautagesbericht: bericht,
          materials: materials.filter(m => m.material.trim()).map(m => ({
            material: m.material.trim(), menge: m.menge?.trim?.() || m.menge || null, einheit: m.einheit || "Stk.",
          })),
          technicianNames,
          photos: [],
          pdfOnly: true,
        },
      });
      if (error) console.warn("Bautagesbericht-PDF konnte nicht erzeugt werden:", error.message);
    } catch (e: any) {
      console.warn("Bautagesbericht-PDF konnte nicht erzeugt werden:", e?.message);
    }
  };

  const buildTimeEntries = (bautagesberichtId: string, userId: string, stunden: number) => {
    const allWorkerIds = [userId, ...selectedEmployees];
    return allWorkerIds.map(workerId => ({
      user_id: workerId,
      datum: formData.datum,
      // Keine Uhrzeiten mehr — es werden nur Stunden erfasst. Erfundene
      // Zeiten würden Überschneidungswarnungen gegen Fiktion auslösen.
      start_time: null,
      end_time: null,
      pause_minutes: 0,
      stunden,
      taetigkeit: `${arbeitsort === "werkstatt" ? "Werkstatt" : "Bautagesbericht"}: ${(formData.beschreibung.trim() || taetigkeitenAlsText(entriesToTaetigkeiten(taetigkeiten))).substring(0, 100)}`,
      location_type: arbeitsort,
      // Projektbezug übernehmen, damit die gespiegelten Stunden in der
      // Projekt-Zeitauswertung auftauchen. Werkstattarbeit ist nicht direkt
      // verrechenbar und läuft deshalb bewusst ohne Projekt.
      project_id: arbeitsort === "werkstatt" ? null : (selectedProjectId || null),
      disturbance_id: null,
      notizen: `Bautagesbericht-Zuordnung: ${bautagesberichtId}`,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const zeilen = entriesToTaetigkeiten(taetigkeiten);
    if (zeilen.length === 0) {
      toast({ variant: "destructive", title: "Tätigkeiten fehlen", description: "Bitte mindestens eine Tätigkeit mit Stunden eintragen." });
      return;
    }
    // > 24 h/Tag lehnt die DB bei der Zeiten-Spiegelung ab (time_entries_stunden_nonneg)
    if (summeStunden(zeilen) > 24) {
      toast({ variant: "destructive", title: "Zu viele Stunden", description: "Die Summe der Tätigkeiten darf 24 Stunden pro Tag nicht überschreiten." });
      return;
    }
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ variant: "destructive", title: "Fehler", description: "Sie müssen angemeldet sein" });
      setSaving(false);
      return;
    }

    // Validation — bei Werkstattarbeit gibt es keinen Kunden
    const istWerkstatt = arbeitsort === "werkstatt";
    if (!istWerkstatt && !formData.kundeName.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Kundenname ist erforderlich" });
      setSaving(false);
      return;
    }

    const stunden = summeStunden(zeilen);
    // Beschreibung ist NOT NULL und wird von Liste/PDF gelesen — bei leerem
    // Feld aus den Tätigkeitszeilen ableiten, damit niemand doppelt tippt.
    const beschreibungText = formData.beschreibung.trim() || taetigkeitenAlsText(zeilen);

    const berichtData = {
      user_id: user.id,
      datum: formData.datum,
      // Keine Uhrzeit-Erfassung mehr — Spalten bleiben für den Altbestand
      start_time: null,
      end_time: null,
      pause_minutes: 0,
      stunden,
      taetigkeiten: zeilen,
      location_type: arbeitsort,
      kunde_name: istWerkstatt ? "Werkstatt (intern)" : formData.kundeName.trim(),
      kunde_email: istWerkstatt ? null : (formData.kundeEmail.trim() || null),
      kunde_adresse: istWerkstatt ? null : (formData.kundeAdresse.trim() || null),
      kunde_plz: istWerkstatt ? null : (formData.kundePlz.trim() || null),
      kunde_ort: istWerkstatt ? null : (formData.kundeOrt.trim() || null),
      kunde_telefon: istWerkstatt ? null : (formData.kundeTelefon.trim() || null),
      beschreibung: beschreibungText,
      notizen: formData.notizen.trim() || null,
      // Werkstattarbeit läuft ohne Projekt/Kunde — sie ist nicht direkt verrechenbar
      project_id: istWerkstatt ? null : (selectedProjectId || null),
      customer_id: istWerkstatt ? null : (selectedCustomerId || null),
    };

    if (editData) {
      // Update existing
      const { error } = await (supabase as any)
        .from("bautagesberichte")
        .update(berichtData)
        .eq("id", editData.id);

      if (error) {
        toast({ variant: "destructive", title: "Fehler", description: "Bautagesbericht konnte nicht aktualisiert werden" });
        setSaving(false);
        return;
      }

      // Update workers
      await updateBerichtWorkers(editData.id, user.id, selectedEmployees);

      // Update materials
      await updateMaterials(editData.id, user.id);

      // Zeiteinträge für alle Mitarbeiter synchronisieren: das Löschen der
      // alten gespiegelten Einträge läuft SERVER-seitig in der Edge-Function
      // (Service Role) über den Notiz-Marker — ein client-seitiger Delete würde
      // die Einträge von Kollegen wegen RLS NICHT löschen und ihre Stunden bei
      // jeder Bearbeitung duplizieren.
      // Beim Bearbeiten gehören die gespiegelten Zeiten weiterhin dem
      // URSPRÜNGLICHEN Ersteller — nicht dem (Admin-)Bearbeiter.
      const timeEntries = buildTimeEntries(editData.id, (editData as any).user_id || user.id, stunden);
      const { data: syncData, error: syncError } = await supabase.functions.invoke("create-team-time-entries", {
        body: {
          entries: timeEntries,
          deleteByNotizen: `Bautagesbericht-Zuordnung: ${editData.id}`,
          bestEffort: true,
        },
      });
      if (syncError || (syncData as any)?.success === false) {
        // Nicht fatal: der Bericht IST gespeichert — nur die gespiegelten
        // Zeiten fehlen (z.B. weil der Zeitblock schon erfasst war).
        toast({
          title: "Bericht gespeichert — Hinweis zu den Zeiten",
          description: (syncData as any)?.error || "Die Zeiten konnten nicht (vollständig) gespiegelt werden — ggf. sind sie bereits in der Zeiterfassung erfasst.",
        });
      } else {
        toast({ title: "Erfolg", description: "Bautagesbericht wurde aktualisiert" });
      }
      // PDF mit dem neuen Stand ablegen
      await erzeugePdf({ ...berichtData, id: editData.id }, user.id);
    } else {
      // Create new bautagesbericht
      const { data: newBericht, error } = await (supabase as any)
        .from("bautagesberichte")
        .insert({ ...berichtData, status: "erstellt" })
        .select()
        .single();

      if (error || !newBericht) {
        toast({ variant: "destructive", title: "Fehler", description: "Bautagesbericht konnte nicht erstellt werden" });
        setSaving(false);
        return;
      }

      // Add main worker entry
      await (supabase as any).from("bautagesbericht_workers").insert({
        bautagesbericht_id: newBericht.id,
        user_id: user.id,
        is_main: true,
      });

      // Add worker entries for additional workers
      for (const workerId of selectedEmployees) {
        await (supabase as any).from("bautagesbericht_workers").insert({
          bautagesbericht_id: newBericht.id,
          user_id: workerId,
          is_main: false,
        });
      }

      // Create materials
      const validMaterials = materials.filter(m => m.material.trim());
      if (validMaterials.length > 0) {
        await (supabase as any).from("bautagesbericht_materials").insert(
          validMaterials.map(m => ({
            bautagesbericht_id: newBericht.id,
            user_id: user.id,
            material: m.material.trim(),
            menge: m.menge.trim() || null,
            einheit: m.einheit || "Stk.",
          }))
        );
      }

      // Automatisch Zeiteinträge für alle beteiligten Mitarbeiter anlegen
      // Nutzt Edge Function (Service Role) damit auch für andere User inserted werden kann
      const timeEntries = buildTimeEntries(newBericht.id, user.id, stunden);
      const { data: syncData, error: syncError } = await supabase.functions.invoke("create-team-time-entries", {
        body: { entries: timeEntries, bestEffort: true },
      });
      if (syncError || (syncData as any)?.success === false) {
        // Nicht fatal: der Bericht IST angelegt — nur die gespiegelten
        // Zeiten fehlen (z.B. Zeitblock bereits in der Zeiterfassung).
        toast({
          title: "Bericht erstellt — Hinweis zu den Zeiten",
          description: (syncData as any)?.error || "Die Zeiten konnten nicht (vollständig) gespiegelt werden — ggf. sind sie bereits in der Zeiterfassung erfasst.",
        });
      } else {
        toast({ title: "Erfolg", description: "Bautagesbericht wurde erfasst" });
      }

      // PDF erzeugen + im Bericht/Projektordner ablegen — ohne Unterschrift.
      await erzeugePdf({ ...berichtData, id: newBericht.id }, user.id);

      setSaving(false);
      onOpenChange(false);
      // Keine Unterschrift nötig — direkt zur Detailansicht.
      navigate(`/bautagesberichte/${newBericht.id}`);
      return;
    }

    setSaving(false);
    onSuccess();
  };

  const updateBerichtWorkers = async (bautagesberichtId: string, mainUserId: string, newWorkerIds: string[]) => {
    // Get current workers
    const { data: currentWorkers } = await (supabase as any)
      .from("bautagesbericht_workers")
      .select("user_id, is_main")
      .eq("bautagesbericht_id", bautagesberichtId);

    const currentNonMainIds = ((currentWorkers || []) as { user_id: string; is_main: boolean }[])
      .filter(w => !w.is_main)
      .map(w => w.user_id);

    // Workers to add
    const toAdd = newWorkerIds.filter(id => !currentNonMainIds.includes(id));

    // Workers to remove
    const toRemove = currentNonMainIds.filter(id => !newWorkerIds.includes(id));

    // Remove workers
    for (const workerId of toRemove) {
      await (supabase as any)
        .from("bautagesbericht_workers")
        .delete()
        .eq("bautagesbericht_id", bautagesberichtId)
        .eq("user_id", workerId);
    }

    // Add new workers
    for (const workerId of toAdd) {
      await (supabase as any).from("bautagesbericht_workers").insert({
        bautagesbericht_id: bautagesberichtId,
        user_id: workerId,
        is_main: false,
      });
    }
  };

  const updateMaterials = async (bautagesberichtId: string, userId: string) => {
    // Delete existing materials
    await (supabase as any)
      .from("bautagesbericht_materials")
      .delete()
      .eq("bautagesbericht_id", bautagesberichtId);

    // Add new materials
    const validMaterials = materials.filter(m => m.material.trim());
    if (validMaterials.length > 0) {
      await (supabase as any).from("bautagesbericht_materials").insert(
        validMaterials.map(m => ({
          bautagesbericht_id: bautagesberichtId,
          user_id: userId,
          material: m.material.trim(),
          menge: m.menge.trim() || null,
          einheit: m.einheit || "Stk.",
        }))
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {editData ? "Bautagesbericht bearbeiten" : "Neuen Bautagesbericht erfassen"}
          </DialogTitle>
          <DialogDescription>
            Dokumentieren Sie die täglichen Arbeiten auf der Baustelle.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Date and Time Section */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Datum & Arbeitsort
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="datum">Datum</Label>
                <Input
                  id="datum"
                  type="date"
                  value={formData.datum}
                  onChange={(e) => setFormData({ ...formData, datum: e.target.value })}
                  required
                />
              </div>
              {/* Arbeitsort wie in der Zeiterfassung — Werkstattarbeit läuft
                  ohne Projekt/Kunde und ist damit nicht direkt verrechenbar. */}
              <div className="col-span-2 space-y-2">
                <Label>Arbeitsort</Label>
                <RadioGroup
                  value={arbeitsort}
                  onValueChange={(v: "baustelle" | "werkstatt") => setArbeitsort(v)}
                  className="grid grid-cols-2 gap-3"
                >
                  <div>
                    <RadioGroupItem value="baustelle" id="btb-ort-baustelle" className="peer sr-only" />
                    <Label htmlFor="btb-ort-baustelle" className="flex h-12 cursor-pointer items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent peer-data-[state=checked]:border-primary text-sm">
                      🏗️ Baustelle
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="werkstatt" id="btb-ort-werkstatt" className="peer sr-only" />
                    <Label htmlFor="btb-ort-werkstatt" className="flex h-12 cursor-pointer items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent peer-data-[state=checked]:border-primary text-sm">
                      🏢 Werkstatt
                    </Label>
                  </div>
                </RadioGroup>
                {arbeitsort === "werkstatt" && (
                  <p className="text-xs text-muted-foreground">
                    Werkstattarbeit wird ohne Projekt und Kunde erfasst — die Stunden zählen nicht auf ein Projekt.
                  </p>
                )}
              </div>
            </div>

          </div>

          {/* Projekt-Zuordnung — bei Werkstattarbeit ausgeblendet */}
          {arbeitsort === "baustelle" && (
          <div className="space-y-2">
            <p className="text-xs rounded-md border border-blue-200 bg-blue-50 text-blue-900 px-2 py-1.5">
              💡 Bitte zuerst das <b>Projekt auswählen</b> — der Kunde wird dann automatisch übernommen.
            </p>
            <Label>Projekt</Label>
            <Select value={selectedProjectId || "none"} onValueChange={async (v) => {
              const projId = v === "none" ? null : v;
              setSelectedProjectId(projId);
              if (projId) {
                const project = projects.find(p => p.id === projId);
                if (project?.customer_id) {
                  const { data: cust } = await supabase.from("customers")
                    .select("id, name, adresse, plz, ort, email, telefon")
                    .eq("id", project.customer_id).single();
                  if (cust) {
                    setSelectedCustomerId(cust.id);
                    setFormData(prev => ({
                      ...prev,
                      kundeName: cust.name,
                      kundeEmail: cust.email || "",
                      kundeAdresse: cust.adresse || "",
                      kundePlz: cust.plz || "",
                      kundeOrt: cust.ort || "",
                      kundeTelefon: cust.telefon || "",
                    }));
                  }
                }
              }
            }}>
              <SelectTrigger><SelectValue placeholder="Kein Projekt" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Projekt</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}

          {/* Customer Section — bei Werkstattarbeit ausgeblendet */}
          {arbeitsort === "baustelle" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Kundendaten
              </h3>
              <div className="w-[260px]">
                <CustomerSelect
                  value={selectedCustomerId}
                  onChange={(id, customer) => {
                    setSelectedCustomerId(id);
                    if (customer) {
                      setFormData(prev => ({
                        ...prev,
                        kundeName: customer.name,
                        kundeEmail: customer.email || "",
                        kundeAdresse: customer.adresse || "",
                        kundePlz: customer.plz || "",
                        kundeOrt: customer.ort || "",
                        kundeTelefon: customer.telefon || "",
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev,
                        kundeName: "",
                        kundeEmail: "",
                        kundeAdresse: "",
                        kundePlz: "",
                        kundeOrt: "",
                        kundeTelefon: "",
                      }));
                    }
                  }}
                  placeholder="Kunde auswählen"
                />
              </div>
            </div>
            {formData.kundeName ? (
              <div className="rounded-lg border p-3 bg-muted/30 space-y-1 text-sm">
                <div className="font-medium">{formData.kundeName}</div>
                {formData.kundeAdresse && <div className="text-muted-foreground">{formData.kundeAdresse}</div>}
                {(formData.kundePlz || formData.kundeOrt) && <div className="text-muted-foreground">{formData.kundePlz} {formData.kundeOrt}</div>}
                <div className="flex gap-4">
                  {formData.kundeEmail && <span className="text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{formData.kundeEmail}</span>}
                  {formData.kundeTelefon && <span className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{formData.kundeTelefon}</span>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Bitte wählen Sie oben einen Kunden aus oder erstellen Sie einen neuen.</p>
            )}
          </div>
          )}

          {/* Tätigkeiten — nach Projekt/Kunde, damit erst der Auftrag steht */}
          <TaetigkeitenEditor value={taetigkeiten} onChange={setTaetigkeiten} />

          {/* Multi-Employee Selection — ohne Uhrzeiten entfällt die
              Überschneidungs-Warnung (der Guard in der Komponente greift). */}
          <MultiEmployeeSelect
            selectedEmployees={selectedEmployees}
            onSelectionChange={setSelectedEmployees}
            date={formData.datum}
          />

          {/* Work Description Section */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Arbeitsdetails
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="beschreibung">Durchgeführte Arbeit *</Label>
                  <DictateButton value={formData.beschreibung} onResult={(t) => setFormData({ ...formData, beschreibung: t })} />
                </div>
                <Textarea
                  id="beschreibung"
                  value={formData.beschreibung}
                  onChange={(e) => setFormData({ ...formData, beschreibung: e.target.value })}
                  placeholder="Beschreiben Sie die durchgeführten Arbeiten..."
                  rows={4}
                  required
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="notizen">Notizen (optional)</Label>
                  <DictateButton value={formData.notizen} onResult={(t) => setFormData({ ...formData, notizen: t })} />
                </div>
                <Textarea
                  id="notizen"
                  value={formData.notizen}
                  onChange={(e) => setFormData({ ...formData, notizen: e.target.value })}
                  placeholder="Zusätzliche Bemerkungen..."
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Materials Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Verwendetes Material (optional)
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={addMaterial}>
                <Plus className="h-4 w-4 mr-1" />
                Material
              </Button>
            </div>

            {materials.length > 0 && (
              <div className="space-y-2" data-materials-list>
                {materials.map((mat) => (
                  <div key={mat.id} className="flex gap-2 items-start">
                    <Input
                      placeholder="Material"
                      value={mat.material}
                      onChange={(e) => updateMaterial(mat.id, "material", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Menge"
                      value={mat.menge}
                      onChange={(e) => updateMaterial(mat.id, "menge", e.target.value)}
                      className="w-20"
                      type="number"
                      step="0.1"
                    />
                    <Select value={mat.einheit} onValueChange={(v) => updateMaterial(mat.id, "einheit", v)}>
                      <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {einheiten.map(e => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMaterial(mat.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
        </div>

        {/* Sticky Actions */}
        <div className="flex gap-3 justify-end pt-4 border-t bg-background flex-shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={(e) => {
            e.preventDefault();
            const form = document.querySelector('form');
            if (form) form.requestSubmit();
          }} disabled={saving}>
            {saving ? "Speichern..." : editData ? "Aktualisieren" : "Bautagesbericht erfassen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
