import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, Trash2, Save, Download, Copy, ArrowRightLeft, AlertTriangle, Package, Ban, FileDown, TrendingUp, Eye, Import, FileText, Printer, Star, ChevronUp, ChevronDown, X, Pencil, Undo2, MapPin, Calculator, RefreshCw, Lock, Link2, Clock3 } from "lucide-react";
import { KatalogKalkulationPopover } from "@/components/KatalogKalkulationPopover";
import { StundenlohnAnpassenDialog, neuerEinzelpreis, type StundenlohnUpdate } from "@/components/StundenlohnAnpassenDialog";
import { istArbeitszeitZeile } from "@/lib/stunden";
import { erzeugeEbInterfaceXml } from "@/lib/erechnung";
import { InvoicePdfPreview } from "@/components/InvoicePdfPreview";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { KalkulationFields } from "@/components/KalkulationFields";
import { calcEinzelpreis, type KalkulationInput } from "@/lib/kalkulation";
import { calcComponentZeile, calcPositionPreis, componentFormula, type PositionComponent } from "@/lib/positionen";
import { ImportMaterialsDialog } from "@/components/ImportMaterialsDialog";
import { ImportFromProjectDialog } from "@/components/ImportFromProjectDialog";
import { ImportFromOfferDialog } from "@/components/ImportFromOfferDialog";
import { useEinheiten } from "@/hooks/useEinheiten";
import { ImportDisturbanceToInvoiceDialog } from "@/components/ImportDisturbanceToInvoiceDialog";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { format, addMonths, parseISO } from "date-fns";
import { type InvoiceLayoutSettings, DEFAULT_LAYOUT, parseLayoutSettings } from "@/lib/invoiceLayoutTypes";
import { loadInvoiceLogo } from "@/lib/logoLoader";
import { PageHeader } from "@/components/PageHeader";
import { CustomerSelect, type CustomerData } from "@/components/CustomerSelect";
import { CustomerEditDialog } from "@/components/CustomerEditDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getDocConfig } from "@/lib/documentTypes";
import { EXECUTING_COMPANIES } from "@/lib/executingCompanies";

interface InvoiceItem {
  id?: string;
  position: number;
  beschreibung: string;
  kurztext?: string;
  langtext?: string;
  menge: number;
  einheit: string;
  einzelpreis: number;
  rabatt_prozent?: number;
  produktnummer?: string;
  gesamtpreis: number;
  // Wenn true, ist gesamtpreis bereits BRUTTO und wird aus der MwSt-
  // Berechnung ausgenommen (Anzahlungs-Abzüge in Schlussrechnungen).
  mwst_exempt?: boolean;
  // Set-Summary: wenn gesetzt, ist diese Zeile eine Material-Set-Summary.
  // Das PDF/HTML rendert weiterhin nur die Zeile — der Snapshot ist nur
  // für interne Nachkalkulation im Rechnungs-Editor sichtbar.
  set_template_id?: string | null;
  set_snapshot?: any;
  // Kalkulation (Excel-Modell): wenn ist_kalkuliert, wird einzelpreis aus
  // EK + Verschnitt + Aufschlag + Lohn + Zuschlägen berechnet und ist im
  // Angebot pro Position anpassbar (zusätzlich greift der Dokument-Override).
  ist_kalkuliert?: boolean;
  kalkulation_template_id?: string | null;
  /** Eingefrorene Katalog-Kalkulation bei Übernahme (Komponenten + VK) —
   *  macht nachvollziehbar, was intern aus dem Katalog kam, und erlaubt
   *  das Wiederherstellen des ursprünglichen Stands. */
  kalkulation_snapshot?: any;
  ek_preis?: number;
  verschnitt_prozent?: number;
  aufschlag_prozent?: number;
  befestigung_preis?: number;
  sonstiges_preis?: number;
  arbeitszeit_minuten?: number;
  stundensatz?: number;
  /** Katalog-VK-Snapshot beim Einfügen (Stale-Referenz) */
  katalog_vk?: number;
}

interface InvoiceData {
  typ: string;
  nummer: string;
  laufnummer: number;
  jahr: number;
  status: string;
  kunde_name: string;
  kunde_anrede: string;
  kunde_titel: string;
  kunde_adresse: string;
  kunde_plz: string;
  kunde_ort: string;
  kunde_land: string;
  kunde_email: string;
  kunde_telefon: string;
  kunde_uid: string;
  kundennummer: string;
  reverse_charge: boolean;
  datum: string;
  faellig_am: string;
  leistungsdatum: string;
  leistungsdatum_bis: string;
  // Gutschrift-Verrechnung (Migration 20260511000000)
  verrechnet_mit_invoice_id: string | null;
  verrechnet_am: string;
  // Allgemeine Angaben (Angebot + AB) — siehe src/lib/allgemeineAngaben.ts.
  // Der Toggle steuert, ob die Tabelle im PDF/HTML überhaupt erscheint.
  // Felder werden auch bei aktiv=false weiter gespeichert, damit beim
  // erneuten Aktivieren die Werte noch da sind.
  allgemeine_angaben_aktiv: boolean;
  leistungsbeschreibung: string;
  ausfuehrungsort: string;
  ausfuehrungs_kw: string;
  ausfuehrende_firma: string;
  ausfuehrende_firma_freitext: string;
  zahlungsbedingungen: string;
  notizen: string;
  betreff: string;
  mwst_satz: number;
  project_id: string | null;
  bezahlt_betrag: number;
  customer_id: string | null;
  gueltig_bis: string;
  rabatt_prozent: number;
  rabatt_betrag: number;
  mahnstufe: number;
  skonto_prozent: number;
  skonto_tage: number;
  storno_nummer: string;
  storno_datum: string;
  storno_grund: string;
  // Dokument-Genealogie + Anzahlung
  parent_invoice_id?: string | null;
  anzahlung_prozent?: number | null;
  anzahlung_betrag?: number | null;
  // Ansprechpartner pro Dokument (Sachbearbeiter).
  // employee_id = Referenz auf employees, daraus wird Name/Tel/Email
  // als Snapshot in die Freitext-Felder geschrieben (stabile Historie).
  ansprechpartner_employee_id?: string | null;
  ansprechpartner_name?: string;
  ansprechpartner_telefon?: string;
  ansprechpartner_email?: string;
  // Dokumentweiter Aufschlag-Override: überschreibt den Material-Aufschlag
  // ALLER kalkulierten Positionen (NULL = jede Position nutzt ihren eigenen).
  kalkulation_aufschlag_override?: number | null;
}

interface TemplateItem {
  id: string;
  name: string;
  beschreibung: string;
  einheit: string;
  einzelpreis: number;
  kategorie: string;
  ist_favorit?: boolean;
  ist_set?: boolean;
}

interface StoredPdf {
  name: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  entwurf: "bg-muted text-muted-foreground",
  offen: "bg-blue-100 text-blue-800",
  bezahlt: "bg-green-100 text-green-800",
  teilbezahlt: "bg-yellow-100 text-yellow-800",
  storniert: "bg-red-100 text-red-800",
  abgelehnt: "bg-red-100 text-red-800",
  angenommen: "bg-[#0E5A44]/10 text-[#0E5A44] border border-[#0E5A44]/20",
  verrechnet: "bg-purple-100 text-purple-800",
};

const statusLabels: Record<string, string> = {
  entwurf: "Entwurf",
  offen: "Offen",
  bezahlt: "Bezahlt",
  teilbezahlt: "Teilbezahlt",
  storniert: "Storniert",
  abgelehnt: "Abgelehnt",
  angenommen: "Angenommen",
  verrechnet: "Verrechnet",
};

/**
 * Mappt einen Netto-Tage-Wert (aus customers.nettofrist) auf einen der
 * Dropdown-Werte. Treffer auf Standard-Optionen (0/7/14/30/60) werden
 * direkt übernommen; alles andere landet auf "individuell", sodass
 * faellig_am manuell gesetzt werden muss.
 */
function nettofristToDropdown(nettofrist: number): string {
  if (nettofrist <= 0) return "sofort";
  if ([7, 14, 30, 60].includes(nettofrist)) return `${nettofrist} Tage`;
  return "individuell";
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isNew = id === "new" || !id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const einheiten = useEinheiten();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  // Synchrones Reentrancy-Guard für handleSave (setState ist async)
  const savingRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);

  // Warnung bei Schließen/Reload mit ungespeicherten Änderungen
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
  const [invoiceId, setInvoiceId] = useState<string | null>(isNew ? null : id || null);
  const [items, setItems] = useState<InvoiceItem[]>([
    { position: 1, beschreibung: "", menge: 1, einheit: "Stk.", einzelpreis: 0, gesamtpreis: 0 },
  ]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  // Aktive Mitarbeiter als Pool für den Ansprechpartner-Picker
  const [employees, setEmployees] = useState<{ id: string; vorname: string; nachname: string; telefon: string | null; email: string | null; position: string | null }[]>([]);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  // Picker-Filter: Positionen (Standard) / Materialien / Alle
  const [templateArtFilter, setTemplateArtFilter] = useState<"position" | "material" | "arbeitszeit" | "alle">("position");
  const [templateFilter, setTemplateFilter] = useState("alle");
  const [autocompleteIdx, setAutocompleteIdx] = useState<number | null>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [templateMengen, setTemplateMengen] = useState<Record<string, number>>({});
  const [addedFromDialog, setAddedFromDialog] = useState<{ name: string; menge: number; einheit: string }[]>([]);
  // Kalkulation hinter den Positionen (für die aufklappbare Ansicht im Katalog-Picker)
  const [catalogComponents, setCatalogComponents] = useState<Record<string, (PositionComponent & { liveEk: number | null })[]>>({});
  const [catalogComponentsLoaded, setCatalogComponentsLoaded] = useState(false);
  const [expandedCatalog, setExpandedCatalog] = useState<Set<string>>(new Set());
  const [storedPdfs, setStoredPdfs] = useState<StoredPdf[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSaved, setPreviewSaved] = useState(false);
  const [importMaterialsOpen, setImportMaterialsOpen] = useState(false);
  const [importRegieOpen, setImportRegieOpen] = useState(false);
  const [customerEditOpen, setCustomerEditOpen] = useState(false);
  // Bezugs-Picker bei Standalone-Gutschrift: Liste der bestehenden
  // Rechnungen für die Vorlagen-Auswahl. Lazy-loaded nur bei
  // isNew + typ=gutschrift, um den Initial-Fetch nicht zu verteuern.
  const [projectRechnungen, setProjectRechnungen] = useState<Array<{ id: string; nummer: string; kunde_name: string; datum: string }>>([]);
  // Bezugs-Info zur parent invoice — für PDF/Preview-Render der
  // Zeile "Bezug: Rechnung RE_2026_005 vom 27.04.2026". Wird bei
  // parent_invoice_id-Wechsel async nachgeladen.
  const [parentRefInfo, setParentRefInfo] = useState<{ nummer: string; datum: string } | null>(null);
  // Gutschrift-Verrechnungs-Dialog (Phase 1+4)
  const [verrechnungDialogOpen, setVerrechnungDialogOpen] = useState(false);
  const [verrechnungDate, setVerrechnungDate] = useState<string>("");
  const [verrechnungZielInvoice, setVerrechnungZielInvoice] = useState<string>("_none");
  const [verrechnungZielOptions, setVerrechnungZielOptions] = useState<Array<{ id: string; nummer: string; brutto_summe: number; bezahlt_betrag: number; status: string }>>([]);
  const [verrechnungSaving, setVerrechnungSaving] = useState(false);
  const [fromAngebotId, setFromAngebotId] = useState<string | null>(null);
  // Nummer des Quellbelegs (für den Entwurf-Hinweis nach "Umwandeln in…")
  const [convertSourceNummer, setConvertSourceNummer] = useState<string>("");
  // Revisions-Verknüpfung: Vorgänger (Original) bzw. Nachfolger (neuere Fassung)
  const [revisionInfo, setRevisionInfo] = useState<{ revision: number; vorgaenger?: { id: string; nummer: string } | null; nachfolger?: { id: string; nummer: string } | null }>({ revision: 1 });
  const [importOfferOpen, setImportOfferOpen] = useState(false);
  const [importTimeOpen, setImportTimeOpen] = useState(false);
  const [stundenlohnOpen, setStundenlohnOpen] = useState(false);
  const [createProjectDialogOpen, setCreateProjectDialogOpen] = useState(false);
  const [stornoDialogOpen, setStornoDialogOpen] = useState(false);
  const [stornoGrund, setStornoGrund] = useState("");
  // Umwandlungs-Dialoge
  const [anzahlungDialogOpen, setAnzahlungDialogOpen] = useState(false);
  const [anzahlungProzentInput, setAnzahlungProzentInput] = useState<string>("30");
  const [anzahlungBetragInput, setAnzahlungBetragInput] = useState<string>("");
  // Welches Feld hat der User zuletzt angefasst? Bestimmt, ob wir mit
  // Prozent oder Fix-Betrag in die URL/Ladelogik gehen.
  const [anzahlungMode, setAnzahlungMode] = useState<"prozent" | "betrag">("prozent");
  // Summe bereits ausgestellter Anzahlungen zum gleichen Auftrag (für Kumulations-Check)
  const [bestehendeAnzahlungenNetto, setBestehendeAnzahlungenNetto] = useState<number>(0);
  // Kumulierte Folge-AR: IDs der bisherigen ARs + Wurzel-Auftrag (Angebot/AB)
  const [anzahlungAbzugIds, setAnzahlungAbzugIds] = useState<string[]>([]);
  const [anzahlungRootId, setAnzahlungRootId] = useState<string | null>(null);
  // Basis (Netto des Wurzel-Auftrags) — bei "AR aus AR" ist nettoSumme nur das
  // Delta der aktuellen AR und damit die falsche Bezugsgröße für %/Rest.
  const [anzahlungBasisNetto, setAnzahlungBasisNetto] = useState<number | null>(null);
  // Dokumenten-Kette: Root (Angebot/AB) + alle abgeleiteten Dokumente. Zeigt
  // auf der Detailseite an, wo im Workflow wir sind, und macht Navigation
  // zwischen verknüpften Dokumenten möglich.
  interface ChainDoc { id: string; typ: string; nummer: string | null; datum: string | null; brutto_summe: number; status: string; }
  const [chainRoot, setChainRoot] = useState<ChainDoc | null>(null);
  const [chainChildren, setChainChildren] = useState<ChainDoc[]>([]);
  const [invoiceLayout, setInvoiceLayout] = useState<InvoiceLayoutSettings>(DEFAULT_LAYOUT);
  const [newProjectName, setNewProjectName] = useState("");

  // Payment tracking
  interface Payment { id: string; betrag: number; datum: string; notizen: string | null; }
  const [payments, setPayments] = useState<Payment[]>([]);
  const [mahnungen, setMahnungen] = useState<{ mahnstufe: number; created_at: string }[]>([]);
  const [newPaymentAmount, setNewPaymentAmount] = useState("");
  const [newPaymentDate, setNewPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newPaymentNote, setNewPaymentNote] = useState("");
  const defaultTyp = searchParams.get("typ") || "rechnung";
  const defaultProjectId = searchParams.get("project") || null;

  const [form, setForm] = useState<InvoiceData>({
    typ: defaultTyp,
    nummer: "",
    laufnummer: 0,
    jahr: new Date().getFullYear(),
    status: defaultTyp === "rechnung" ? "offen" : "entwurf",
    kunde_name: "",
    kunde_anrede: "",
    kunde_titel: "",
    kunde_adresse: "",
    kunde_plz: "",
    kunde_ort: "",
    kunde_land: "Österreich",
    kunde_email: "",
    kunde_telefon: "",
    kunde_uid: "",
    kundennummer: "",
    reverse_charge: false,
    datum: format(new Date(), "yyyy-MM-dd"),
    faellig_am: format(new Date(Date.now() + 14 * 86400000), "yyyy-MM-dd"),
    leistungsdatum: format(new Date(), "yyyy-MM-dd"),
    leistungsdatum_bis: "",
    verrechnet_mit_invoice_id: null,
    verrechnet_am: "",
    allgemeine_angaben_aktiv: false,
    leistungsbeschreibung: "",
    ausfuehrungsort: "",
    ausfuehrungs_kw: "",
    ausfuehrende_firma: "",
    ausfuehrende_firma_freitext: "",
    zahlungsbedingungen: "14 Tage",
    notizen: "",
    betreff: "",
    mwst_satz: 20,
    project_id: defaultProjectId,
    bezahlt_betrag: 0,
    customer_id: null,
    gueltig_bis: defaultTyp === "angebot" ? format(addMonths(new Date(), 1), "yyyy-MM-dd") : "",
    rabatt_prozent: 0,
    rabatt_betrag: 0,
    kalkulation_aufschlag_override: null,
    mahnstufe: 0,
    skonto_prozent: 0,
    skonto_tage: 0,
    storno_nummer: "",
    storno_datum: "",
    storno_grund: "",
    ansprechpartner_employee_id: null,
    ansprechpartner_name: "",
    ansprechpartner_telefon: "",
    ansprechpartner_email: "",
  });

  // Locked = already saved (not draft) — can only view, download, storno/delete
  // ALLE ausgestellten Rechnungstypen (Rechnung, Anzahlungs-, Schlussrechnung)
  // sind nach dem Ausstellen gesperrt — einheitliches Modell "ausgestellt =
  // unveränderbar (nur Zahlung/Mahnung/Gutschrift/Storno)". Angebote bleiben
  // editierbar.
  const LOCKED_TYPES = ["rechnung", "anzahlungsrechnung", "schlussrechnung"];
  const isLocked = !isNew && id !== "new" && !!invoiceId && LOCKED_TYPES.includes(form.typ);
  const isKundeLocked = isLocked;

  // Angebot→Rechnung Vergleichs-Dialog
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertItems, setConvertItems] = useState<{ beschreibung: string; kurztext: string; langtext: string; einheit: string; einzelpreis: number; angebotMenge: number; verbrauchtMenge: number; rechnungMenge: number; selected: boolean; isExtra: boolean }[]>([]);

  // Parent-Rechnung-Lookup für Bezugs-Block im PDF/Preview. Wird bei
  // jeder parent_invoice_id-Änderung getriggert. Speichert nummer+datum
  // (formatiert) im State, damit das InvoicePdfPreview-formData
  // synchron mit der Vorschau ist (sonst sähe die Vorschau den Bezug
  // nicht, weil sie nur den form-State spreaded).
  // Ausschreibungs-Import (ÖNORM/GAEB): Positionen aus dem Import-Screen
  // übernehmen — Preise trägt der Nutzer hier ein. Einmalig beim Anlegen.
  useEffect(() => {
    if (!isNew || searchParams.get("ausschreibung") !== "1") return;
    const raw = sessionStorage.getItem("ausschreibung_import");
    if (!raw) return;
    sessionStorage.removeItem("ausschreibung_import");
    try {
      const lv = JSON.parse(raw);
      const positionen = (lv.positionen || []) as any[];
      if (positionen.length === 0) return;
      setItems(positionen.map((p, idx) => ({
        position: idx + 1,
        beschreibung: p.kurztext || "",
        kurztext: p.kurztext || "",
        langtext: p.langtext || "",
        menge: Number(p.menge) || 1,
        einheit: p.einheit || "Stk.",
        einzelpreis: 0,
        rabatt_prozent: 0,
        gesamtpreis: 0,
        produktnummer: p.nr || "",
      })) as InvoiceItem[]);
      setForm(f => ({
        ...f,
        betreff: f.betreff || `Angebot ${lv.bezeichnung || "Ausschreibung"}${lv.vorhaben ? ` — ${lv.vorhaben}` : ""}`,
        kunde_name: f.kunde_name || lv.auftraggeber || "",
      }));
      toast({
        title: "Ausschreibung übernommen",
        description: `${positionen.length} Positionen aus ${lv.dateiname || "dem Datenträger"} — jetzt nur noch die Preise eintragen.`,
      });
    } catch { /* defekter Storage-Eintrag — ignorieren */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const pid = form.parent_invoice_id;
    if (!pid) {
      setParentRefInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("invoices").select("nummer, datum").eq("id", pid).maybeSingle();
      if (cancelled) return;
      if (data) {
        const datum = (data as any).datum
          ? new Date((data as any).datum + "T12:00:00").toLocaleDateString("de-AT")
          : "";
        setParentRefInfo({ nummer: (data as any).nummer || "", datum });
      } else {
        setParentRefInfo(null);
      }
    })();
    return () => { cancelled = true; };
  }, [form.parent_invoice_id]);

  // Quelldokument (Rechnung/Angebot/AB) in den Form-State laden —
  // wird sowohl vom URL-`from_doc`-Pfad (useEffect bei Mount) als auch
  // vom Gutschrift-Bezugs-Picker aufgerufen. Single Source of Truth,
  // damit Kunde + Positionen + Bezug in BEIDEN Pfaden identisch
  // vorbefüllt werden. Anzahlungs-/Schlussrechnung-Spezialfälle nur
  // beim URL-Pfad (per opts) — beim Gutschrift-Picker nicht relevant.
  const loadFromSourceDoc = async (
    fromDocId: string,
    targetTyp: string,
    opts?: {
      anzahlungProzent?: number | null;
      anzahlungBetrag?: number | null;
      abzugIds?: string[];
      /** Duplikat-Modus: unabhängige Kopie — KEIN parent_invoice_id,
       *  Original wird beim Speichern NICHT als "verrechnet" markiert. */
      duplicate?: boolean;
    },
  ): Promise<boolean> => {
    try {
      const [invRes, itemsRes] = await Promise.all([
        supabase.from("invoices").select("*").eq("id", fromDocId).maybeSingle(),
        supabase.from("invoice_items").select("*").eq("invoice_id", fromDocId).order("position"),
      ]);
      const data: any = invRes.data;
      if (!data) return false;
      setForm(prev => ({
        ...prev,
        typ: targetTyp,
        kunde_name: data.kunde_name || "",
        kunde_adresse: data.kunde_adresse || "",
        kunde_plz: data.kunde_plz || "",
        kunde_ort: data.kunde_ort || "",
        kunde_land: data.kunde_land || "Österreich",
        kunde_email: data.kunde_email || "",
        kunde_telefon: data.kunde_telefon || "",
        kunde_uid: data.kunde_uid || "",
        customer_id: data.customer_id || null,
        project_id: data.project_id || null,
        leistungsdatum: data.leistungsdatum || "",
        leistungsdatum_bis: data.leistungsdatum_bis || "",
        allgemeine_angaben_aktiv: !!data.allgemeine_angaben_aktiv,
        leistungsbeschreibung: data.leistungsbeschreibung || "",
        ausfuehrungsort: data.ausfuehrungsort || "",
        ausfuehrungs_kw: data.ausfuehrungs_kw || "",
        ausfuehrende_firma: data.ausfuehrende_firma || "",
        ausfuehrende_firma_freitext: data.ausfuehrende_firma_freitext || "",
        zahlungsbedingungen: data.zahlungsbedingungen || "",
        notizen: data.notizen || "",
        betreff: data.betreff || "",
        mwst_satz: Number(data.mwst_satz) || 20,
        // Anzahlungsrechnung: die Positionen werden unten durch EINE Pauschal-
        // zeile (Anzahlungsbetrag = bereits der geschuldete Netto) ersetzt.
        // Ein Global-Rabatt vom Quell-Angebot darf hier NICHT nochmals greifen,
        // sonst wird der Rabatt auf einem Steuerbeleg doppelt abgezogen.
        rabatt_prozent: targetTyp === "anzahlungsrechnung" ? 0 : (Number(data.rabatt_prozent) || 0),
        rabatt_betrag: targetTyp === "anzahlungsrechnung" ? 0 : (Number(data.rabatt_betrag) || 0),
        kalkulation_aufschlag_override: (data as any).kalkulation_aufschlag_override ?? null,
        skonto_prozent: Number(data.skonto_prozent) || 0,
        skonto_tage: Number(data.skonto_tage) || 0,
        kunde_anrede: data.kunde_anrede || "",
        kunde_titel: data.kunde_titel || "",
        reverse_charge: !!data.reverse_charge,
        kundennummer: data.kundennummer || "",
        ansprechpartner_employee_id: data.ansprechpartner_employee_id || null,
        ansprechpartner_name: data.ansprechpartner_name || "",
        ansprechpartner_telefon: data.ansprechpartner_telefon || "",
        ansprechpartner_email: data.ansprechpartner_email || "",
        anzahlung_prozent: opts?.anzahlungProzent ?? null,
        anzahlung_betrag: opts?.anzahlungBetrag ?? null,
        // Duplikat: unabhängige Kopie ohne Beleg-Verknüpfung
        parent_invoice_id: opts?.duplicate ? null : fromDocId,
      } as any));

      const srcItems = (itemsRes.data || []) as any[];
      let nextItems: InvoiceItem[] = srcItems.map((it, idx) => ({
        position: idx + 1,
        beschreibung: it.beschreibung || "",
        kurztext: it.kurztext || it.beschreibung || "",
        langtext: it.langtext || "",
        menge: Number(it.menge) || 1,
        einheit: it.einheit || "Stk.",
        einzelpreis: Number(it.einzelpreis) || 0,
        rabatt_prozent: Number(it.rabatt_prozent) || 0,
        gesamtpreis: Number(it.gesamtpreis) || 0,
        produktnummer: (it as any).produktnummer || "",
        mwst_exempt: !!(it as any).mwst_exempt,
        set_template_id: it.set_template_id || null,
        set_snapshot: it.set_snapshot || null,
        // Kalkulations-Snapshot + Katalog-Verknüpfung mitnehmen, damit die
        // "Preise aktualisieren"-Funktion auch nach Angebot→Rechnung greift.
        ist_kalkuliert: !!(it as any).ist_kalkuliert,
        kalkulation_template_id: (it as any).kalkulation_template_id || null,
        kalkulation_snapshot: (it as any).kalkulation_snapshot || null,
        katalog_vk: Number((it as any).katalog_vk) || undefined,
        ek_preis: Number((it as any).ek_preis) || 0,
        verschnitt_prozent: Number((it as any).verschnitt_prozent) || 0,
        aufschlag_prozent: Number((it as any).aufschlag_prozent) || 0,
        befestigung_preis: Number((it as any).befestigung_preis) || 0,
        sonstiges_preis: Number((it as any).sonstiges_preis) || 0,
        arbeitszeit_minuten: Number((it as any).arbeitszeit_minuten) || 0,
        stundensatz: Number((it as any).stundensatz) || 52,
      }));

      // Anzahlungsrechnung: Zeile mit dem Anzahlungsbetrag (Delta).
      // KUMULIERT (Folge-AR, opts.abzugIds gesetzt): positive Zeile zeigt den
      // kumulierten Leistungsstand, darunter werden alle bisherigen ARs als
      // negative NETTO-Zeilen abgezogen. Netto/MwSt/Brutto der Rechnung
      // entsprechen damit weiterhin exakt dem DELTA — die Summen-Logik
      // (auch für spätere SR/Folge-ARs) bleibt konsistent.
      if (targetTyp === "anzahlungsrechnung" && (opts?.anzahlungBetrag || opts?.anzahlungProzent)) {
        // Basis für die Prozent-Anzahlung ist der TATSÄCHLICH geschuldete Netto
        // des Quelldokuments (nach Global-Rabatt), nicht die Summe der Roh-
        // Positionen. Sonst würde z.B. "10% Anzahlung" auf den Betrag VOR
        // Rabatt gerechnet und wäre zu hoch.
        const rohNetto = nextItems.reduce((s, it) => s + it.gesamtpreis, 0);
        const gesamtNetto = Number(data.netto_summe) || rohNetto;
        const quellNummer = data.nummer || "Auftragsbestätigung";
        let anzBetrag: number;
        let labelKurz: string;
        let labelLang: string;
        if (opts?.anzahlungBetrag) {
          anzBetrag = Number(opts.anzahlungBetrag);
          labelKurz = "Anzahlung";
          labelLang = `Anzahlung gemäß ${quellNummer}`;
        } else {
          const prozent = Number(opts?.anzahlungProzent);
          anzBetrag = gesamtNetto * (prozent / 100);
          labelKurz = `Anzahlung ${prozent}%`;
          labelLang = `Anzahlung ${prozent}% gemäß ${quellNummer}`;
        }
        anzBetrag = Math.round(anzBetrag * 100) / 100;

        // Bisherige Anzahlungen zum selben Auftrag (kumulierte Folge-AR)
        let vorherigeARs: any[] = [];
        if (opts?.abzugIds && opts.abzugIds.length > 0) {
          const { data: prev } = await supabase
            .from("invoices")
            .select("id, nummer, netto_summe, datum")
            .in("id", opts.abzugIds);
          vorherigeARs = (prev as any[]) || [];
        }

        if (vorherigeARs.length > 0) {
          const bisherNetto = vorherigeARs.reduce((s, a) => s + (Number(a.netto_summe) || 0), 0);
          const kumuliertNetto = Math.round((bisherNetto + anzBetrag) * 100) / 100;
          const kumProzent = gesamtNetto > 0 ? Math.round((kumuliertNetto / gesamtNetto) * 1000) / 10 : 0;
          nextItems = [{
            position: 1,
            beschreibung: `Leistungsstand kumuliert${kumProzent > 0 ? ` ${kumProzent}%` : ""} gemäß ${quellNummer}`,
            kurztext: `Leistungsstand kumuliert`,
            langtext: "",
            menge: 1,
            einheit: "pausch.",
            einzelpreis: kumuliertNetto,
            rabatt_prozent: 0,
            gesamtpreis: kumuliertNetto,
          }];
          vorherigeARs
            .sort((a, b) => String(a.datum).localeCompare(String(b.datum)))
            .forEach((abz, i) => {
              const netto = Number(abz.netto_summe) || 0;
              // Abzug als negative MENGE (nicht negativer Preis) — der
              // DB-Check invoice_items_preis_nonneg erlaubt negative
              // Einzelpreise nur für mwst_exempt-Zeilen (SR-Brutto-Abzüge).
              nextItems.push({
                position: i + 2,
                beschreibung: `abzüglich ${i + 1}. Anzahlungsrechnung ${abz.nummer} vom ${new Date(abz.datum + "T12:00:00").toLocaleDateString("de-AT")} (netto)`,
                kurztext: `Abzug ${abz.nummer}`,
                langtext: "",
                menge: -1,
                einheit: "pausch.",
                einzelpreis: netto,
                rabatt_prozent: 0,
                gesamtpreis: -netto,
              });
            });
        } else {
          nextItems = [{
            position: 1,
            beschreibung: labelLang,
            kurztext: labelKurz,
            langtext: "",
            menge: 1,
            einheit: "pausch.",
            einzelpreis: anzBetrag,
            rabatt_prozent: 0,
            gesamtpreis: anzBetrag,
          }];
        }
      }

      // Schlussrechnung: Anzahlungen als negative BRUTTO-Zeilen anhängen.
      // § 11 UStG (Endrechnung): Die vereinnahmten Teilentgelte UND die darauf
      // entfallenden Steuerbeträge sind abzusetzen — deshalb weist die
      // Abzugszeile die in der Anzahlung enthaltene USt explizit aus.
      if (targetTyp === "schlussrechnung" && opts?.abzugIds && opts.abzugIds.length > 0) {
        const { data: abzugInvs } = await supabase
          .from("invoices")
          .select("id, nummer, netto_summe, brutto_summe, mwst_betrag, mwst_satz, datum")
          .in("id", opts.abzugIds);
        ((abzugInvs as any[]) || []).forEach((abz) => {
          const brutto = Number(abz.brutto_summe) || 0;
          const ustBetrag = Number(abz.mwst_betrag) || 0;
          const ustSatz = Number(abz.mwst_satz) || 20;
          nextItems.push({
            position: nextItems.length + 1,
            beschreibung: `Abzug Anzahlungsrechnung ${abz.nummer} vom ${new Date(abz.datum + "T12:00:00").toLocaleDateString("de-AT")} (brutto, darin enthaltene ${ustSatz}% USt: € ${ustBetrag.toFixed(2)})`,
            kurztext: `Abzug ${abz.nummer}`,
            langtext: "",
            menge: 1,
            einheit: "pausch.",
            einzelpreis: -brutto,
            rabatt_prozent: 0,
            gesamtpreis: -brutto,
            mwst_exempt: true,
          });
        });
      }

      if (nextItems.length > 0) setItems(nextItems);
      // Duplikat: Original NICHT als Quelle merken (würde es beim Speichern
      // sonst fälschlich auf "verrechnet" setzen)
      setFromAngebotId(opts?.duplicate ? null : fromDocId);
      setConvertSourceNummer(opts?.duplicate ? "" : (data.nummer || ""));
      return true;
    } catch (err) {
      console.error("Konversion fehlgeschlagen:", err);
      toast({ variant: "destructive", title: "Konversion fehlgeschlagen", description: "Quelldokument konnte nicht geladen werden" });
      return false;
    }
  };

  // Lazy-Load der Rechnungen für den Bezugs-Picker — nur bei neuer
  // Standalone-Gutschrift. Bei Convert (form.parent_invoice_id gesetzt)
  // brauchen wir die Liste nicht.
  useEffect(() => {
    if (!isNew || form.typ !== "gutschrift" || form.parent_invoice_id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, nummer, kunde_name, datum")
        .in("typ", ["rechnung", "anzahlungsrechnung", "schlussrechnung"])
        .neq("status", "storniert")
        .order("datum", { ascending: false })
        .limit(100);
      if (cancelled) return;
      setProjectRechnungen(((data as any[]) || []).map(d => ({
        id: d.id,
        nummer: d.nummer || "",
        kunde_name: d.kunde_name || "",
        datum: d.datum || "",
      })));
    })();
    return () => { cancelled = true; };
  }, [isNew, form.typ, form.parent_invoice_id]);

  useEffect(() => {
    fetchProjects();
    fetchTemplates();
    fetchEmployees();
    // Load invoice layout settings + default betreff
    supabase.from("app_settings").select("key, value").in("key", ["invoice_layout", "default_betreff_rechnung", "default_betreff_angebot"]).then(({ data }) => {
      if (data) {
        for (const row of data) {
          if (row.key === "invoice_layout") setInvoiceLayout(parseLayoutSettings(row.value));
          if (isNew && row.key === "default_betreff_rechnung" && defaultTyp === "rechnung" && row.value) {
            setForm(prev => prev.betreff ? prev : { ...prev, betreff: row.value });
          }
          if (isNew && row.key === "default_betreff_angebot" && defaultTyp === "angebot" && row.value) {
            setForm(prev => prev.betreff ? prev : { ...prev, betreff: row.value });
          }
        }
      }
    });
    if (!isNew && id) {
      loadInvoice(id);
      loadStoredPdfs(id);
      loadPayments(id);
      loadMahnungen();
    }
    // Auto-open regiebericht import if disturbance_id is in URL
    const distId = searchParams.get("disturbance_id");
    if (distId && isNew) {
      setImportRegieOpen(true);
    }

    // Load data from source document — unterstützt alte (`from_angebot`)
    // und neue (`from_doc`) URL-Parameter. Zusätzlich:
    //   anzahlung_prozent=<p>   → füllt anzahlung_prozent beim neuen Dokument
    //   abzug_ids=<id,id,…>    → zieht Anzahlungen als negative Positionen ab
    const fromDocId = searchParams.get("from_doc") || searchParams.get("from_angebot");
    const targetTyp = searchParams.get("typ") || "rechnung";
    const anzahlungProzentParam = searchParams.get("anzahlung_prozent");
    const anzahlungBetragParam = searchParams.get("anzahlung_betrag");
    const abzugIdsParam = searchParams.get("abzug_ids");
    // cancelled-Flag: wenn der Effect während eines async-Loads teardown wird
    // (z.B. Navigation / id-Wechsel), überschreiben wir nicht mehr den Form-State
    // und risikieren damit keinen User-Input wegzubügeln.
    let cancelled = false;
    if (isNew && fromDocId && fromDocId !== "true") {
      (async () => {
        if (cancelled) return;
        await loadFromSourceDoc(fromDocId, targetTyp, {
          anzahlungProzent: anzahlungProzentParam ? Number(anzahlungProzentParam) : null,
          anzahlungBetrag: anzahlungBetragParam ? Number(anzahlungBetragParam) : null,
          abzugIds: abzugIdsParam ? abzugIdsParam.split(",").filter(Boolean) : undefined,
          duplicate: searchParams.get("duplicate") === "1",
        });
      })();
    } else if (isNew && defaultProjectId) {
      // Kein from_doc, aber ?project=... → Projekt + Kunden
      // automatisch ins Formular übernehmen (aus dem Projekt heraus gestartet).
      (async () => {
        try {
          const { data: projFull } = await (supabase.from("projects" as never) as any)
            .select("customer_id, adresse, plz, ort")
            .eq("id", defaultProjectId)
            .maybeSingle();
          if (cancelled) return;
          // Ausführungsort vorbefüllen aus der Projekt-Adresse — nur
          // wenn der User noch nichts eingetragen hat (überschreibt nichts).
          if (projFull) {
            const projAdresse = [
              (projFull as any).adresse,
              [(projFull as any).plz, (projFull as any).ort].filter(Boolean).join(" "),
            ].filter(Boolean).join("\n");
            if (projAdresse) {
              setForm(prev => prev.ausfuehrungsort
                ? prev
                : ({ ...prev, ausfuehrungsort: projAdresse } as any));
            }
          }
          if (!projFull?.customer_id) return;
          // Kundendaten laden
          const { data: cust } = await supabase
            .from("customers")
            .select("id, name, anrede, titel, uid_nummer, adresse, plz, ort, land, email, telefon, kundennummer, ansprechpartner, skonto_prozent, skonto_tage, nettofrist")
            .eq("id", projFull.customer_id)
            .maybeSingle();
          if (cancelled || !cust) return;
          setForm(prev => ({
            ...prev,
            customer_id: cust.id,
            kunde_name: cust.name,
            kunde_adresse: cust.adresse || "",
            kunde_plz: cust.plz || "",
            kunde_ort: cust.ort || "",
            kunde_land: cust.land || "Österreich",
            kunde_email: cust.email || "",
            kunde_telefon: cust.telefon || "",
            kunde_uid: cust.uid_nummer || "",
            kunde_anrede: (cust as any).anrede || "",
            kunde_titel: (cust as any).titel || "",
            kundennummer: cust.kundennummer || "",
            // Ansprechpartner wird NICHT mehr aus customers übernommen —
            // er ist seit der Umstellung der Sachbearbeiter und
            // wird im Dokument-Formular explizit aus der Mitarbeiter-
            // Liste gewählt.
            skonto_prozent: Number(cust.skonto_prozent) || 0,
            skonto_tage: Number(cust.skonto_tage) || 0,
          } as any));
          const nettofrist = Number((cust as any).nettofrist) || 0;
          if (defaultTyp === "rechnung") {
            const zb = nettofristToDropdown(nettofrist);
            setForm(prev => ({ ...prev, zahlungsbedingungen: zb }));
            // "individuell" fängt der useEffect nicht ab — faellig_am
            // hier direkt setzen, damit die Rechnung sofort konsistent ist.
            if (zb === "individuell" && nettofrist > 0) {
              const due = new Date(new Date().toISOString().split("T")[0] + "T12:00:00");
              due.setDate(due.getDate() + nettofrist);
              setForm(prev => ({ ...prev, faellig_am: format(due, "yyyy-MM-dd") }));
            }
          }
        } catch (err) {
          console.error("Projekt-Prefill fehlgeschlagen:", err);
        }
      })();
    }
    return () => { cancelled = true; };
  }, [id]);


  const fetchEmployees = async () => {
    // Aktive Mitarbeiter laden für den Ansprechpartner-Dropdown. `aktiv`
    // ist die kanonische Quelle (wird per Trigger aus profiles.is_active
    // synchronisiert) — `austritt_datum` filtert nicht alle Fälle.
    const { data } = await supabase
      .from("employees")
      .select("id, vorname, nachname, telefon, email, position")
      .eq("aktiv", true)
      .order("vorname");
    setEmployees(((data as any[]) || []).map(e => ({
      id: e.id,
      vorname: e.vorname || "",
      nachname: e.nachname || "",
      telefon: e.telefon || null,
      email: e.email || null,
      position: e.position || null,
    })));
  };

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("id, name, customer_id").not("status", "eq", "Abgeschlossen").order("name");
    if (data) setProjects(data);
  };

  const fetchTemplates = async () => {
    const { data } = await supabase.from("invoice_templates").select("*").order("kategorie, name").limit(5000);
    if (data) setTemplates(data.map(t => ({ ...t, einzelpreis: Number(t.einzelpreis), ist_favorit: (t as any).ist_favorit || false })));
  };

  const loadStoredPdfs = async (invId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.storage.from("invoice-pdfs").list(`${user.id}/${invId}`);
    if (data) setStoredPdfs(data.map(f => ({ name: f.name, created_at: f.created_at || "" })));
  };

  const loadInvoice = async (invoiceId: string) => {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (error || !data) {
      toast({ variant: "destructive", title: "Fehler", description: "Rechnung nicht gefunden" });
      navigate("/invoices");
      return;
    }

    // Revisions-Nachbarn laden (Angebots-Preisstände): Vorgänger = Original,
    // Nachfolger = neuere Fassung, die dieses Angebot ersetzt hat.
    {
      const revision = Number((data as any).revision) || 1;
      let vorgaenger: { id: string; nummer: string } | null = null;
      let nachfolger: { id: string; nummer: string } | null = null;
      if ((data as any).vorgaenger_id) {
        const { data: v } = await supabase.from("invoices").select("id, nummer").eq("id", (data as any).vorgaenger_id).maybeSingle();
        if (v) vorgaenger = v as any;
      }
      const { data: n } = await (supabase as any).from("invoices").select("id, nummer").eq("vorgaenger_id", invoiceId).maybeSingle();
      if (n) nachfolger = n as any;
      setRevisionInfo({ revision, vorgaenger, nachfolger });
    }

    setForm({
      typ: data.typ,
      nummer: data.nummer,
      laufnummer: data.laufnummer,
      jahr: data.jahr,
      status: data.status,
      kunde_name: data.kunde_name,
      kunde_adresse: data.kunde_adresse || "",
      kunde_plz: data.kunde_plz || "",
      kunde_ort: data.kunde_ort || "",
      kunde_land: data.kunde_land || "Österreich",
      kunde_email: data.kunde_email || "",
      kunde_telefon: data.kunde_telefon || "",
      kunde_uid: data.kunde_uid || "",
      datum: data.datum,
      faellig_am: data.faellig_am || "",
      leistungsdatum: data.leistungsdatum || "",
      leistungsdatum_bis: (data as any).leistungsdatum_bis || "",
      verrechnet_mit_invoice_id: (data as any).verrechnet_mit_invoice_id || null,
      verrechnet_am: (data as any).verrechnet_am || "",
      allgemeine_angaben_aktiv: !!(data as any).allgemeine_angaben_aktiv,
      leistungsbeschreibung: (data as any).leistungsbeschreibung || "",
      ausfuehrungsort: (data as any).ausfuehrungsort || "",
      ausfuehrungs_kw: (data as any).ausfuehrungs_kw || "",
      ausfuehrende_firma: (data as any).ausfuehrende_firma || "",
      ausfuehrende_firma_freitext: (data as any).ausfuehrende_firma_freitext || "",
      // Altdaten auf die neuen Dropdown-Werte mappen. Sofort/prompt und
      // die Standard-Tage bleiben erhalten; alles andere (Freitext,
      // ungültige Werte, krumme Tage wie "20 Tage") landet auf
      // "individuell", damit der User die Altrechnung nicht aus
      // Versehen verfälscht.
      zahlungsbedingungen: (() => {
        const raw = (data.zahlungsbedingungen || "").trim();
        if (!raw) return "";
        if (/sofort|umgehend|prompt/i.test(raw)) return "sofort";
        const standard = ["7 Tage", "14 Tage", "30 Tage", "60 Tage"];
        if (standard.includes(raw)) return raw;
        return "individuell";
      })(),
      notizen: data.notizen || "",
      betreff: (data as any).betreff || "",
      mwst_satz: Number(data.mwst_satz),
      project_id: data.project_id,
      bezahlt_betrag: Number(data.bezahlt_betrag) || 0,
      customer_id: (data as any).customer_id || null,
      gueltig_bis: (data as any).gueltig_bis || "",
      rabatt_prozent: Number((data as any).rabatt_prozent) || 0,
      rabatt_betrag: Number((data as any).rabatt_betrag) || 0,
      mahnstufe: Number((data as any).mahnstufe) || 0,
      skonto_prozent: Number((data as any).skonto_prozent) || 0,
      skonto_tage: Number((data as any).skonto_tage) || 0,
      storno_nummer: (data as any).storno_nummer || "",
      storno_datum: (data as any).storno_datum || "",
      storno_grund: (data as any).storno_grund || "",
      kunde_anrede: (data as any).kunde_anrede || "",
      kunde_titel: (data as any).kunde_titel || "",
      reverse_charge: (data as any).reverse_charge || false,
      kundennummer: (data as any).kundennummer || "",
      ansprechpartner_employee_id: (data as any).ansprechpartner_employee_id || null,
      ansprechpartner_name: (data as any).ansprechpartner_name || "",
      ansprechpartner_telefon: (data as any).ansprechpartner_telefon || "",
      ansprechpartner_email: (data as any).ansprechpartner_email || "",
      // Wichtig für die Dokumenten-Genealogie: ohne das fällt der
      // Schlussrechnung-Loader auf die AR selbst zurück und die Original-
      // Positionen aus dem Angebot/AB werden nicht übernommen.
      parent_invoice_id: (data as any).parent_invoice_id || null,
      anzahlung_prozent: (data as any).anzahlung_prozent != null ? Number((data as any).anzahlung_prozent) : null,
      anzahlung_betrag: (data as any).anzahlung_betrag != null ? Number((data as any).anzahlung_betrag) : null,
    } as any);

    const { data: itemsData } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("position");

    if (itemsData && itemsData.length > 0) {
      setItems(itemsData.map(it => ({
        id: it.id,
        position: it.position,
        beschreibung: it.beschreibung,
        kurztext: (it as any).kurztext || it.beschreibung,
        langtext: (it as any).langtext || "",
        menge: Number(it.menge),
        einheit: it.einheit || "Stk.",
        einzelpreis: Number(it.einzelpreis),
        rabatt_prozent: Number((it as any).rabatt_prozent) || 0,
        produktnummer: (it as any).produktnummer || "",
        gesamtpreis: Number(it.gesamtpreis),
        mwst_exempt: !!(it as any).mwst_exempt,
        set_template_id: (it as any).set_template_id || null,
        set_snapshot: (it as any).set_snapshot || null,
        ist_kalkuliert: !!(it as any).ist_kalkuliert,
        kalkulation_template_id: (it as any).kalkulation_template_id || null,
        kalkulation_snapshot: (it as any).kalkulation_snapshot || null,
        katalog_vk: Number((it as any).katalog_vk) || undefined,
        ek_preis: Number((it as any).ek_preis) || 0,
        verschnitt_prozent: Number((it as any).verschnitt_prozent) || 0,
        aufschlag_prozent: Number((it as any).aufschlag_prozent) || 0,
        befestigung_preis: Number((it as any).befestigung_preis) || 0,
        sonstiges_preis: Number((it as any).sonstiges_preis) || 0,
        arbeitszeit_minuten: Number((it as any).arbeitszeit_minuten) || 0,
        stundensatz: Number((it as any).stundensatz) || 52,
      })));
    }

    // Defensiv: wenn auf der Rechnung keine UID gesetzt ist, aber ein
    // Customer verknüpft ist und dort eine UID hinterlegt ist, ziehen wir
    // sie nach. Greift typischerweise bei alten Rechnungen, bei denen die
    // UID damals beim Kunden fehlte und später ergänzt wurde.
    if (!((data as any).kunde_uid || "").trim() && (data as any).customer_id) {
      const { data: cust } = await supabase
        .from("customers")
        .select("uid_nummer, kundentyp")
        .eq("id", (data as any).customer_id)
        .maybeSingle();
      const liveUid = ((cust as any)?.uid_nummer || "").trim();
      if (liveUid) {
        setForm(prev => ({ ...prev, kunde_uid: liveUid } as any));
      }
    }

    // Dokumenten-Kette laden: zur Root-Ahnung (Angebot/AB) hochwandern,
    // dann alle direkten Kinder dieser Root laden. So sieht der User auf
    // jeder AR/SR, zu welchem Auftrag sie gehört und welche Geschwister
    // es gibt — und kann direkt dorthin navigieren.
    let rootId = invoiceId;
    let parentHop: string | null = (data as any).parent_invoice_id || null;
    // Hochwandern — begrenzt auf 5 Hops um Endlosschleifen durch inkonsistente
    // Daten (sollte nie passieren, aber Safety-Net) zu verhindern.
    for (let i = 0; i < 5 && parentHop; i++) {
      rootId = parentHop;
      const { data: hop } = await supabase
        .from("invoices")
        .select("parent_invoice_id")
        .eq("id", parentHop)
        .maybeSingle();
      parentHop = (hop as any)?.parent_invoice_id || null;
    }
    const [rootRes, childrenRes] = await Promise.all([
      supabase
        .from("invoices")
        .select("id, typ, nummer, datum, brutto_summe, status")
        .eq("id", rootId)
        .maybeSingle(),
      supabase
        .from("invoices")
        .select("id, typ, nummer, datum, brutto_summe, status")
        .eq("parent_invoice_id", rootId)
        .order("datum", { ascending: true }),
    ]);
    setChainRoot(rootRes.data ? (rootRes.data as ChainDoc) : null);
    setChainChildren(((childrenRes.data as any[]) || []) as ChainDoc[]);

    setLoading(false);
  };

  const updateField = (field: keyof InvoiceData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (!loading) setIsDirty(true);
  };

  // Helper: merge imported items into existing list, replacing empty first row
  const mergeItems = (prev: InvoiceItem[], newItems: InvoiceItem[]): InvoiceItem[] => {
    // Check if first row is empty (default state)
    const firstEmpty = prev.length === 1 && !prev[0].beschreibung.trim() && prev[0].einzelpreis === 0;
    const base = firstEmpty ? [] : [...prev];
    // Gleiche Position schon vorhanden? Dann MENGE addieren statt eine
    // Doppel-Zeile anzulegen (z.B. 8× "Facharbeiterstunde" aus dem Katalog
    // → EINE Zeile mit Menge 8). Gleich = selbe Katalog-Verknüpfung bzw.
    // selber Text + Einheit + Einzelpreis; Abzugs-/gesperrte Zeilen nie.
    const passtZusammen = (a: InvoiceItem, b: InvoiceItem) =>
      !a.mwst_exempt && !b.mwst_exempt &&
      (a.kalkulation_template_id && b.kalkulation_template_id
        ? a.kalkulation_template_id === b.kalkulation_template_id
        : (a.kurztext || a.beschreibung || "").trim().toLowerCase() === (b.kurztext || b.beschreibung || "").trim().toLowerCase()
          && (a.einheit || "") === (b.einheit || "")
          && Math.abs((Number(a.einzelpreis) || 0) - (Number(b.einzelpreis) || 0)) < 0.005
          && !!(a.kurztext || a.beschreibung || "").trim());
    for (const neu of newItems) {
      const vorhanden = base.find(x => passtZusammen(x, neu));
      if (vorhanden) {
        vorhanden.menge = Math.round(((Number(vorhanden.menge) || 0) + (Number(neu.menge) || 0)) * 100) / 100;
        const r = Number(vorhanden.rabatt_prozent) || 0;
        vorhanden.gesamtpreis = Math.round(vorhanden.menge * (Number(vorhanden.einzelpreis) || 0) * (1 - r / 100) * 100) / 100;
      } else {
        base.push(neu);
      }
    }
    return base.map((item, idx) => ({ ...item, position: idx + 1 }));
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      position: prev.length + 1,
      beschreibung: "",
      kurztext: "",
      langtext: "",
      menge: 1,
      einheit: "Stk.",
      einzelpreis: 0,
      rabatt_prozent: 0,
      gesamtpreis: 0,
    }]);
    if (!loading) setIsDirty(true);
  };

  // "Stundenlohn anpassen" (nur dieses Dokument): Dialog liefert die
  // Satz-Änderungen, hier werden die Zeilenpreise nachgerechnet.
  const handleStundenlohnApply = (updates: StundenlohnUpdate[]) => {
    if (updates.length === 0) { setStundenlohnOpen(false); return; }
    setItems(prev => {
      const arr = [...prev];
      for (const u of updates) {
        const it = arr[u.itemIndex];
        if (!it) continue;
        if (u.quelle === "kalkuliert") {
          // Legacy-Kalkulation: Satz setzen + Einzelpreis über die Formel
          const eff = docAufschlagOverride ?? (Number(it.aufschlag_prozent) || 0);
          const ep = calcEinzelpreis({
            ek_preis: Number(it.ek_preis) || 0,
            verschnitt_prozent: Number(it.verschnitt_prozent) || 0,
            aufschlag_prozent: eff,
            befestigung_preis: Number(it.befestigung_preis) || 0,
            sonstiges_preis: Number(it.sonstiges_preis) || 0,
            arbeitszeit_minuten: Number(it.arbeitszeit_minuten) || 0,
            stundensatz: u.neuerSatz,
          });
          arr[u.itemIndex] = { ...it, stundensatz: u.neuerSatz, einzelpreis: ep };
        } else {
          const ep = neuerEinzelpreis(it as any, { itemIndex: u.itemIndex, quelle: u.quelle, stundenProEinheit: u.stundenProEinheit }, u.alterSatz, u.neuerSatz);
          arr[u.itemIndex] = { ...it, einzelpreis: ep };
        }
        const m = Number(arr[u.itemIndex].menge) || 0;
        const r = Number(arr[u.itemIndex].rabatt_prozent) || 0;
        arr[u.itemIndex].gesamtpreis = Math.round(m * arr[u.itemIndex].einzelpreis * (1 - r / 100) * 100) / 100;
      }
      return arr;
    });
    if (!loading) setIsDirty(true);
    setStundenlohnOpen(false);
    const positionen = [...new Set(updates.map(u => u.itemIndex))].length;
    toast({
      title: "Stundenlohn angepasst",
      description: `${positionen} Position${positionen === 1 ? "" : "en"} in diesem Dokument aktualisiert — der Katalog bleibt unverändert.`,
    });
  };


  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, position: i + 1 })));
    if (!loading) setIsDirty(true);
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    setItems(prev => {
      const arr = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= arr.length) return prev;
      [arr[index], arr[targetIndex]] = [arr[targetIndex], arr[index]];
      return arr.map((item, i) => ({ ...item, position: i + 1 }));
    });
    if (!loading) setIsDirty(true);
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    // Positionsänderungen sind die häufigste Bearbeitung — ohne Dirty-Flag
    // gäbe es beim Verlassen keine "Ungespeicherte Änderungen"-Warnung.
    if (!loading) setIsDirty(true);
    setItems(prev => {
      const updated = [...prev];
      // Sanitize numeric fields: NaN, Infinity, negative → 0
      if (field === "menge" || field === "einzelpreis") {
        const n = Number(value);
        value = isFinite(n) && n >= 0 ? n : 0;
      }
      if (field === "rabatt_prozent") {
        const n = Number(value);
        value = isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
      }
      (updated[index] as any)[field] = value;
      if (field === "menge" || field === "einzelpreis" || field === "rabatt_prozent") {
        const m = Number(updated[index].menge) || 0;
        const p = Number(updated[index].einzelpreis) || 0;
        const r = Number(updated[index].rabatt_prozent) || 0;
        const total = m * p * (1 - r / 100);
        updated[index].gesamtpreis = isFinite(total) ? Math.round(total * 100) / 100 : 0;
      }
      return updated;
    });
  };

  // ── Kalkulation ───────────────────────────────────────────────────────────
  // Effektiver Material-Aufschlag einer Position: greift der Dokument-Override,
  // gilt dieser, sonst der positionseigene Aufschlag.
  const docAufschlagOverride =
    form.kalkulation_aufschlag_override === null || form.kalkulation_aufschlag_override === undefined
      ? null : Number(form.kalkulation_aufschlag_override);

  const computeItemTotal = (it: InvoiceItem): number => {
    const m = Number(it.menge) || 0;
    const r = Number(it.rabatt_prozent) || 0;
    const t = m * (Number(it.einzelpreis) || 0) * (1 - r / 100);
    return isFinite(t) ? Math.round(t * 100) / 100 : 0;
  };

  // Setzt die Kalkulationsfelder einer Position und berechnet Einzel-/Gesamtpreis neu.
  const applyItemKalkulation = (index: number, kalk: KalkulationInput) => {
    setItems(prev => {
      const updated = [...prev];
      const eff = docAufschlagOverride ?? kalk.aufschlag_prozent;
      const ep = calcEinzelpreis({ ...kalk, aufschlag_prozent: eff });
      updated[index] = {
        ...updated[index],
        ist_kalkuliert: true,
        ek_preis: kalk.ek_preis,
        verschnitt_prozent: kalk.verschnitt_prozent,
        aufschlag_prozent: kalk.aufschlag_prozent,
        befestigung_preis: kalk.befestigung_preis,
        sonstiges_preis: kalk.sonstiges_preis,
        arbeitszeit_minuten: kalk.arbeitszeit_minuten,
        stundensatz: kalk.stundensatz,
        einzelpreis: ep,
      };
      updated[index].gesamtpreis = computeItemTotal(updated[index]);
      return updated;
    });
  };

  // Dokumentweiter Aufschlag-Override: setzt den Wert und rechnet ALLE
  // kalkulierten Positionen neu (Ergebnis direkt im Angebot sichtbar).
  const setDocAufschlagOverride = (raw: string) => {
    const val = raw.trim() === "" ? null : Number(raw.replace(",", "."));
    const override = val === null || !isFinite(val) ? null : val;
    setForm(f => ({ ...f, kalkulation_aufschlag_override: override }));
    setItems(prev => prev.map(it => {
      if (!it.ist_kalkuliert) return it;
      const eff = override ?? (Number(it.aufschlag_prozent) || 0);
      const ep = calcEinzelpreis({
        ek_preis: Number(it.ek_preis) || 0,
        verschnitt_prozent: Number(it.verschnitt_prozent) || 0,
        aufschlag_prozent: eff,
        befestigung_preis: Number(it.befestigung_preis) || 0,
        sonstiges_preis: Number(it.sonstiges_preis) || 0,
        arbeitszeit_minuten: Number(it.arbeitszeit_minuten) || 0,
        stundensatz: Number(it.stundensatz) || 52,
      });
      const next = { ...it, einzelpreis: ep };
      next.gesamtpreis = computeItemTotal(next);
      return next;
    }));
  };

  // ── Kalkulation: Preise aus dem Materialkatalog aktualisieren ──────────────
  // Löst das "6-Monate-später"-Problem: ein Angebot speichert pro Position einen
  // Kalkulations-Snapshot (stabil). Steigt später der Material-EK im Katalog,
  // zieht dieser Knopf die AKTUELLE Material-Kalkulation je verknüpfter Position
  // (kalkulation_template_id) neu — explizit und nachvollziehbar (alt→neu).
  const [kalkRefreshing, setKalkRefreshing] = useState(false);
  // Wurden in dieser Sitzung Preise per "Preise aktualisieren" auf den
  // aktuellen Katalogstand gezogen? Dann speichert das nächste Speichern ein
  // GESPEICHERTES Angebot automatisch als neue Revision (AN…-R2) und lässt
  // das Original unangetastet (archiviert, Vorgänger-Verweis).
  const [kalkRefreshApplied, setKalkRefreshApplied] = useState(false);
  const [staleKalkCount, setStaleKalkCount] = useState(0);
  // Welche Positionen sind betroffen (Name + alt→neu) — für den Banner
  const [staleKalkDetails, setStaleKalkDetails] = useState<{ pos: number; name: string; alt: number; neu: number }[]>([]);

  const fetchCatalogKalk = useCallback(async (): Promise<Record<string, any>> => {
    const ids = Array.from(new Set(
      items.filter(it => it.kalkulation_template_id)
        .map(it => it.kalkulation_template_id as string)
    ));
    if (ids.length === 0) return {};
    const { data } = await supabase
      .from("invoice_templates")
      .select("id, ek_netto, vk_netto, netto_preis, einzelpreis, verschnitt_prozent, aufschlag_prozent, befestigung_preis, sonstiges_preis, arbeitszeit_minuten, stundensatz, ist_kalkuliert")
      .in("id", ids);
    const map: Record<string, any> = {};
    for (const t of (data || [])) map[(t as any).id] = t;
    return map;
  }, [items]);

  const kalkFromTemplate = (t: any) => ({
    ek_preis: Number(t.ek_netto) || 0,
    verschnitt_prozent: Number(t.verschnitt_prozent) || 0,
    aufschlag_prozent: Number(t.aufschlag_prozent) || 0,
    befestigung_preis: Number(t.befestigung_preis) || 0,
    sonstiges_preis: Number(t.sonstiges_preis) || 0,
    arbeitszeit_minuten: Number(t.arbeitszeit_minuten) || 0,
    stundensatz: Number(t.stundensatz) || 52,
  });

  // Soll-Einzelpreis einer verknüpften Position laut Katalog:
  // - alte Einzel-Kalkulation (item.ist_kalkuliert): Formel mit Doc-Override
  // - Komponenten-Positionen & Materialien: aktueller Katalog-VK
  //   (die DB hält vk_netto per Trigger aus den Komponenten aktuell)
  const expectedEpFromCatalog = (it: any, t: any): number => {
    if (it.ist_kalkuliert && t.ist_kalkuliert) {
      const k = kalkFromTemplate(t);
      return calcEinzelpreis({ ...k, aufschlag_prozent: docAufschlagOverride ?? k.aufschlag_prozent });
    }
    return Number(t.vk_netto ?? t.netto_preis) || Number(t.einzelpreis) || 0;
  };

  const refreshKalkulationFromCatalog = async () => {
    setKalkRefreshing(true);
    try {
      const map = await fetchCatalogKalk();
      if (Object.keys(map).length === 0) {
        toast({ title: "Keine verknüpften Materialien", description: "Es gibt keine kalkulierten Positionen mit Katalog-Verknüpfung." });
        return;
      }
      let changed = 0;
      let oldTotal = 0, newTotal = 0;
      const next = items.map(it => {
        if (!it.kalkulation_template_id || !map[it.kalkulation_template_id]) return it;
        const t = map[it.kalkulation_template_id];
        const ep = expectedEpFromCatalog(it, t);
        oldTotal += Number(it.einzelpreis) || 0;
        newTotal += ep;
        if (Math.abs(ep - (Number(it.einzelpreis) || 0)) > 0.005) changed++;
        // Alte Einzel-Kalkulation: Snapshot-Felder mitziehen. Komponenten-
        // Positionen/Materialien: nur EP + Lohnminuten (für Stundenabgleich).
        const updated = it.ist_kalkuliert && t.ist_kalkuliert
          ? { ...it, ...kalkFromTemplate(t), einzelpreis: ep, katalog_vk: ep }
          : { ...it, einzelpreis: ep, katalog_vk: ep, arbeitszeit_minuten: Number(t.arbeitszeit_minuten) || 0 };
        updated.gesamtpreis = computeItemTotal(updated);
        return updated;
      });
      setItems(next);
      setStaleKalkCount(0);
      if (changed === 0) {
        toast({ title: "Preise sind aktuell", description: "Alle kalkulierten Positionen entsprechen bereits dem Materialkatalog." });
      } else {
        setKalkRefreshApplied(true);
        const istGespeichertesAngebot = form.typ === "angebot" && !isNew && !!invoiceId;
        toast({
          title: `${changed} Position(en) aktualisiert`,
          description: `Einzelpreise gesamt: € ${oldTotal.toFixed(2)} → € ${newTotal.toFixed(2)}. ${istGespeichertesAngebot ? "Beim Speichern entsteht automatisch eine neue Version — das ursprüngliche Angebot bleibt erhalten." : "Zum Übernehmen speichern."}`,
        });
      }
    } finally {
      setKalkRefreshing(false);
    }
  };

  // Stale-Check: beim Laden/Ändern der verknüpften Positionen prüfen, ob der
  // Materialkatalog inzwischen abweicht (Banner-Hinweis). Schlüssel ist die
  // Menge der verknüpften Template-IDs — läuft nicht bei jeder Preis-Eingabe.
  const linkedTemplateKey = useMemo(() => items
    .filter(it => it.kalkulation_template_id)
    .map(it => it.kalkulation_template_id).join(","), [items]);

  useEffect(() => {
    let cancelled = false;
    if (isLocked || !linkedTemplateKey) { setStaleKalkCount(0); return; }
    (async () => {
      const map = await fetchCatalogKalk();
      if (cancelled) return;
      let stale = 0;
      const details: { pos: number; name: string; alt: number; neu: number }[] = [];
      items.forEach((it, idx) => {
        if (it.kalkulation_template_id && map[it.kalkulation_template_id]) {
          const ep = expectedEpFromCatalog(it, map[it.kalkulation_template_id]);
          // Referenz ist der KATALOG-Snapshot vom Einfügen (katalog_vk) —
          // nicht der aktuelle Zeilenpreis. Ein bewusst verhandelter Preis
          // ist KEINE Katalog-Änderung. Fallback für Alt-Zeilen ohne
          // Snapshot: bisheriges Verhalten (Vergleich mit einzelpreis).
          const referenz = Number((it as any).katalog_vk);
          const basis = Number.isFinite(referenz) && referenz > 0 ? referenz : (Number(it.einzelpreis) || 0);
          if (Math.abs(ep - basis) > 0.005) {
            stale++;
            details.push({ pos: idx + 1, name: it.kurztext || it.beschreibung || `Position ${idx + 1}`, alt: Number(it.einzelpreis) || 0, neu: ep });
          }
        }
      });
      setStaleKalkCount(stale);
      setStaleKalkDetails(details);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedTemplateKey, docAufschlagOverride, isLocked]);

  // Fehlende Kalkulations-Snapshots nachziehen: Jede Katalog-Position friert
  // beim Einfügen ihre Kalkulation (Komponenten + VK + Arbeitszeit) ein —
  // so bleibt nachvollziehbar, was intern aus dem Katalog kam, und der
  // ursprüngliche Stand ist wiederherstellbar. Läuft zentral über die Items
  // (deckt Autocomplete, Katalog-Picker und Alt-Zeilen gleichermaßen ab).
  const fehlendeSnapshotKey = useMemo(() => [...new Set(
    items.filter(it => it.kalkulation_template_id && !it.kalkulation_snapshot)
      .map(it => it.kalkulation_template_id as string),
  )].sort().join(","), [items]);

  useEffect(() => {
    if (!fehlendeSnapshotKey) return;
    let cancelled = false;
    (async () => {
      const ids = fehlendeSnapshotKey.split(",");
      const [tRes, cRes] = await Promise.all([
        (supabase as any).from("invoice_templates")
          .select("id, kurzbezeichnung, name, vk_netto, arbeitszeit_minuten")
          .in("id", ids),
        (supabase as any).from("position_components")
          .select("position_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order")
          .in("position_template_id", ids)
          .order("sort_order"),
      ]);
      if (cancelled) return;
      const comps: Record<string, any[]> = {};
      for (const c of ((cRes.data as any[]) || [])) {
        (comps[c.position_template_id] = comps[c.position_template_id] || []).push({
          typ: c.typ, bezeichnung: c.bezeichnung, einheit: c.einheit,
          menge_pro_einheit: Number(c.menge_pro_einheit) || 0, preis: Number(c.preis) || 0,
          verschnitt_prozent: Number(c.verschnitt_prozent) || 0, aufschlag_prozent: Number(c.aufschlag_prozent) || 0,
        });
      }
      const snapByTemplate: Record<string, any> = {};
      for (const t of ((tRes.data as any[]) || [])) {
        snapByTemplate[t.id] = {
          template_id: t.id,
          name: t.kurzbezeichnung || t.name,
          vk_netto: Number(t.vk_netto) || 0,
          arbeitszeit_minuten: Number(t.arbeitszeit_minuten) || 0,
          stand: new Date().toISOString(),
          komponenten: comps[t.id] || [],
        };
      }
      // Kein setIsDirty: das ist eine interne Anreicherung, keine User-Änderung.
      setItems(prev => prev.map(it =>
        it.kalkulation_template_id && !it.kalkulation_snapshot && snapByTemplate[it.kalkulation_template_id]
          ? { ...it, kalkulation_snapshot: snapByTemplate[it.kalkulation_template_id] }
          : it,
      ));
    })();
    return () => { cancelled = true; };
  }, [fehlendeSnapshotKey]);

  // Auto-Sync zahlungsbedingungen → faellig_am. Immer wenn der User die
  // Zahlungsfrist (Dropdown) oder das Rechnungsdatum ändert, rechnen wir
  // das Fälligkeitsdatum neu aus. Einzige Ausnahme: "individuell" — dort
  // darf der User das faellig_am-Feld direkt editieren und wir greifen
  // nicht ein.
  useEffect(() => {
    if (form.typ !== "rechnung") return;
    const zb = (form.zahlungsbedingungen || "").trim();
    if (!zb || zb === "individuell") return;
    if (!form.datum) return;
    let days: number | null = null;
    if (/sofort|umgehend|prompt/i.test(zb)) days = 0;
    else {
      const m = zb.match(/(\d+)/);
      if (m) days = parseInt(m[1]);
    }
    if (days === null) return;
    const due = new Date(form.datum + "T12:00:00");
    due.setDate(due.getDate() + days);
    const nextFaellig = format(due, "yyyy-MM-dd");
    if (nextFaellig !== form.faellig_am) {
      setForm(prev => ({ ...prev, faellig_am: nextFaellig }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.zahlungsbedingungen, form.datum, form.typ]);

  // Kalkulation (Komponenten) der Positionen laden, sobald der Katalog-Picker
  // erstmals geöffnet wird — für die aufklappbare "Kalkulation dahinter"-Ansicht.
  useEffect(() => {
    if (!templateDialogOpen || catalogComponentsLoaded) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("position_components")
        .select("position_template_id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order, material:invoice_templates!material_template_id(ek_netto)")
        .order("sort_order")
        .limit(10000);
      if (cancelled) return;
      const map: Record<string, (PositionComponent & { liveEk: number | null })[]> = {};
      for (const c of ((data as any[]) || [])) {
        (map[c.position_template_id] = map[c.position_template_id] || []).push({
          material_template_id: c.material_template_id,
          typ: c.typ,
          bezeichnung: c.bezeichnung,
          einheit: c.einheit,
          menge_pro_einheit: Number(c.menge_pro_einheit) || 0,
          preis: Number(c.preis) || 0,
          verschnitt_prozent: Number(c.verschnitt_prozent) || 0,
          aufschlag_prozent: Number(c.aufschlag_prozent) || 0,
          sort_order: Number(c.sort_order) || 0,
          liveEk: c.material ? Number(c.material.ek_netto) : null,
        });
      }
      setCatalogComponents(map);
      setCatalogComponentsLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [templateDialogOpen, catalogComponentsLoaded]);

  // Calculations with discount — round to 2 decimal places to avoid floating-point issues.
  // mwst_exempt-Zeilen enthalten bereits Brutto (z.B. Anzahlungs-Abzüge)
  // und werden separat verrechnet, damit die MwSt der Anzahlung nicht mit
  // dem aktuellen Satz neu berechnet wird.
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const exemptBrutto = r2(items.filter(it => it.mwst_exempt).reduce((sum, it) => sum + Number(it.gesamtpreis || 0), 0));
  const positionenNetto = r2(items.filter(it => !it.mwst_exempt).reduce((sum, it) => sum + Number(it.gesamtpreis || 0), 0));
  const rabattWert = r2(form.rabatt_prozent > 0
    ? positionenNetto * (form.rabatt_prozent / 100)
    : form.rabatt_betrag);
  const nettoSumme = r2(positionenNetto - rabattWert);
  // Bei Reverse Charge (§ 19 Abs. 1a) schuldet der Empfänger die USt — wir
  // weisen keine USt aus, der Rechnungsbetrag = Netto (konsistent mit dem PDF
  // und dem Zahlungsabgleich).
  const mwstBetrag = (form as any).reverse_charge ? 0 : r2(nettoSumme * (form.mwst_satz / 100));
  const bruttoSumme = r2(nettoSumme + mwstBetrag + exemptBrutto);
  const restBetrag = r2(bruttoSumme - form.bezahlt_betrag);

  // Angebote sind löschbar (anders als ausgestellte Rechnungen), aber nur
  // GESPEICHERTE und solange sie nicht verrechnet/storniert sind — sonst
  // zeigt der Editor einen Löschen-Button für ein Dokument, das es noch
  // gar nicht gibt bzw. dessen Belegkette erhalten bleiben muss.
  const canDelete = form.typ === "angebot" && !isNew && !!invoiceId
    && form.status !== "verrechnet" && form.status !== "storniert";
  // Stornieren ist für alle rechnungs-artigen Dokumente möglich
  // (Rechnung, Anzahlungsrechnung, Schlussrechnung, Gutschrift) —
  // AT-Rechtsvorschrift: ein Rechnungsbeleg muss stornierbar sein.
  const _cancelableTypes = new Set(["rechnung", "anzahlungsrechnung", "schlussrechnung", "gutschrift"]);
  const canCancel = !isNew && !!invoiceId && id !== "new" && _cancelableTypes.has(form.typ) && form.status !== "storniert";

  const handleSave = async (): Promise<boolean> => {
    // Double-click protection: setState ist NICHT synchron — zusätzlich ein
    // Ref als echtes Reentrancy-Guard, sonst könnten zwei schnelle Klicks zwei
    // next_document_number-RPCs (= zwei Belegnummern) auslösen.
    if (saving || savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    try {

    if (!form.kunde_name.trim()) {
      setSaving(false);
      toast({ variant: "destructive", title: "Fehler", description: "Kundenname ist erforderlich" });
      return false;
    }
    // Validate ALL items, not just the first
    const validItems = items.filter(item => item.beschreibung.trim());
    if (validItems.length === 0) {
      toast({ variant: "destructive", title: "Fehler", description: "Mindestens eine Position mit Beschreibung ist erforderlich" });
      return false;
    }
    // INTEGRITÄT: Zeilen ohne Beschreibung werden beim Speichern verworfen —
    // hätte so eine Zeile einen Betrag, stünde auf dem Beleg eine Summe, die
    // nicht der Positionssumme entspricht (und der Zahlungs-QR wäre falsch).
    const phantomIdx = items.findIndex(item => !item.beschreibung.trim() && Math.abs(Number(item.gesamtpreis) || 0) > 0.005);
    if (phantomIdx >= 0) {
      toast({ variant: "destructive", title: "Position ohne Beschreibung", description: `Position ${phantomIdx + 1} hat einen Betrag, aber keine Beschreibung — bitte Beschreibung ergänzen oder Zeile löschen.` });
      return false;
    }

    // AUSSTELLUNGS-BESTÄTIGUNG: Das erste Speichern einer Rechnung/AR/SR ist
    // kein "Zwischenspeichern" — es vergibt die fortlaufende Nummer und sperrt
    // den Beleg. Das muss dem Nutzer bewusst sein, BEVOR es passiert.
    if ((isNew || !invoiceId) && LOCKED_TYPES.includes(form.typ)) {
      const _label = getDocConfig(form.typ).label;
      const ok = window.confirm(
        `${_label} jetzt ausstellen?\n\n` +
        `Es wird eine fortlaufende Belegnummer vergeben. Danach ist der Beleg nicht mehr bearbeitbar — ` +
        `möglich bleiben: Zahlung erfassen, Mahnung, Gutschrift und Storno.`
      );
      if (!ok) return false;
    }

    // Rechnungsbetrag muss > 0 sein (außer bei Entwürfen).
    // bruttoSumme ist die korrekt berechnete Anzeige-Summe: mwst_exempt-Zeilen
    // (z.B. Anzahlungs-Abzüge) bekommen KEINE MwSt und der Global-Rabatt ist
    // berücksichtigt — daher dieselbe Größe für die Validierung verwenden.
    const saveBrutto = bruttoSumme;
    if (saveBrutto <= 0 && form.status !== "entwurf") {
      toast({ variant: "destructive", title: "Fehler", description: "Rechnungsbetrag muss größer als €0,00 sein" });
      return false;
    }

    // Skonto-Prozent muss zwischen 0 und 100 sein
    if (form.skonto_prozent < 0 || form.skonto_prozent > 100) {
      toast({ variant: "destructive", title: "Ungültiger Skonto", description: "Skonto muss zwischen 0% und 100% liegen" });
      return false;
    }

    // Rabatt-Prozent muss zwischen 0 und 100 sein
    if ((form.rabatt_prozent ?? 0) < 0 || (form.rabatt_prozent ?? 0) > 100) {
      toast({ variant: "destructive", title: "Ungültiger Rabatt", description: "Rabatt muss zwischen 0% und 100% liegen" });
      return false;
    }

    // Rabatt-Betrag: negativ wäre ein UNSICHTBARER Aufschlag (die Rabatt-Zeile
    // im Footer erscheint nur bei > 0) — ablehnen.
    if ((form.rabatt_betrag ?? 0) < 0) {
      toast({ variant: "destructive", title: "Ungültiger Rabatt", description: "Rabatt-Betrag darf nicht negativ sein" });
      return false;
    }
    // Rabatt-Betrag (Global-Rabatt €) darf die nicht-steuerbefreite Positions-
    // Netto-Summe nicht überschreiten. positionenNetto (oben) schließt
    // mwst_exempt-Zeilen bereits aus.
    if (form.rabatt_betrag > positionenNetto) {
      toast({ variant: "destructive", title: "Ungültiger Rabatt", description: `Rabatt-Betrag (€${form.rabatt_betrag.toFixed(2)}) darf die Netto-Summe (€${positionenNetto.toFixed(2)}) nicht überschreiten` });
      return false;
    }

    // Pro-Position Rabatt prüfen
    const invalidRabatt = items.find(i => (i.rabatt_prozent ?? 0) < 0 || (i.rabatt_prozent ?? 0) > 100);
    if (invalidRabatt) {
      toast({ variant: "destructive", title: "Ungültiger Positions-Rabatt", description: "Rabatt pro Position muss zwischen 0% und 100% liegen" });
      return false;
    }

    // Reverse Charge: UID-Nummer des Kunden ist Pflicht (§ 19 UStG)
    if ((form as any).reverse_charge && !form.kunde_uid?.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Bei Reverse Charge ist die UID-Nummer des Kunden Pflicht" });
      return false;
    }
    // Firmen-UID (§ 11 UStG): bei Reverse Charge zwingend, bei jeder Rechnung
    // > 400 € (keine Kleinbetragsrechnung) als Pflichtangabe stark empfohlen.
    {
      const docCfg = getDocConfig(form.typ);
      const isReverse = !!(form as any).reverse_charge;
      const needsUid = isReverse || (docCfg.isInvoiceLike && bruttoSumme > 400);
      if (needsUid) {
        const { data: firmenUidSetting } = await supabase.from("app_settings").select("value").eq("key", "firmen_uid").maybeSingle();
        if (!firmenUidSetting?.value?.trim()) {
          if (isReverse) {
            toast({ variant: "destructive", title: "Eigene UID fehlt", description: "Bei Reverse Charge ist die UID-Nummer des Ausstellers Pflicht. Bitte im Admin-Bereich → Rechnungslayout konfigurieren." });
            return false;
          }
          // Normale Rechnung: nicht blockieren, aber deutlich auf die
          // finanzamtsrechtliche Pflichtangabe hinweisen.
          toast({ variant: "destructive", title: "Firmen-UID fehlt", description: "Für eine finanzamtskonforme Rechnung muss die UID-Nummer der Firma hinterlegt sein (Admin → Rechnungslayout). Die Rechnung wird trotzdem gespeichert." });
        }
      }
    }

    // § 11 UStG verlangt einen Leistungstag/-zeitraum auf der Rechnung.
    // Wenn der User nichts eingibt, fällt der Leistungszeitraum-von
    // automatisch auf das Rechnungsdatum (form.datum) — siehe Renderer.
    // Daher hier kein harter Pflicht-Check mehr.

    // Firmen-UID > 400 € wird bereits oben geprüft (Warnung, aber Speichern
    // wird NICHT blockiert — der frühere harte Block hier stand im Widerspruch
    // zu jener Zusage und verhinderte bei noch nicht hinterlegter Firmen-UID
    // praktisch jede reale Rechnung). Nur die Empfänger-UID > 10.000 € bleibt
    // eine harte Pflicht.
    if (form.typ === "rechnung" && saveBrutto > 10000 && !form.kunde_uid?.trim()) {
      toast({ variant: "destructive", title: "Kunden-UID fehlt", description: "Bei Rechnungen über €10.000 ist die UID-Nummer des Empfängers gesetzlich vorgeschrieben." });
      setSaving(false);
      return false;
    }

    // setSaving(true) bereits am Anfang gesetzt — kein erneuter Aufruf nötig
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ variant: "destructive", title: "Fehler", description: "Nicht angemeldet" });
      setSaving(false);
      return false;
    }

    try {
      let savedId = invoiceId;
      let customerId = form.customer_id;

      // AUTOMATISCHE ANGEBOTS-REVISION: Wurden auf einem GESPEICHERTEN Angebot
      // die Preise per "Preise aktualisieren" auf den Katalogstand gezogen,
      // wird NICHT das Original überschrieben. Stattdessen: neues Angebot
      // "Basis-Nr-R<n>" mit Vorgänger-Verweis; das Original bleibt archiviert
      // und unverändert erhalten (Baubetriebs-Praxis: alter und neuer
      // Preisstand müssen beide nachvollziehbar bleiben).
      const revisionVonId = (kalkRefreshApplied && form.typ === "angebot" && savedId && !isNew) ? savedId : null;
      if (revisionVonId) savedId = null; // → unten den Insert-Pfad nehmen

      // Auto-create customer if no customer_id is set (never overwrite existing customer master data)
      if (form.kunde_name.trim()) {
        if (customerId) {
          // Customer already linked – keep as-is, invoice stores its own snapshot
        } else {
          // Check for existing customer with same name + PLZ (duplicate protection)
          let custQuery = supabase.from("customers").select("id").ilike("name", form.kunde_name.trim());
          if (form.kunde_plz?.trim()) custQuery = custQuery.eq("plz", form.kunde_plz.trim());
          const { data: existingCust } = await custQuery.limit(1).maybeSingle();

          if (existingCust) {
            customerId = existingCust.id;
          } else {
            const { data: newCust, error: custErr } = await supabase.from("customers").insert({
              user_id: user.id,
              name: form.kunde_name,
              adresse: form.kunde_adresse || null,
              plz: form.kunde_plz || null,
              ort: form.kunde_ort || null,
              land: form.kunde_land || null,
              email: form.kunde_email || null,
              telefon: form.kunde_telefon || null,
              uid_nummer: form.kunde_uid || null,
            }).select("id").single();
            if (custErr) {
              // Stammkunde konnte nicht angelegt werden — Rechnung/Angebot
              // trotzdem speichern (eigener Kunden-Snapshot bleibt erhalten).
              console.warn("Kunde nicht als Stammkunde angelegt:", custErr.message);
            } else if (newCust) {
              customerId = newCust.id;
            }
          }
          updateField("customer_id", customerId);
        }
      }

      // Rechnungen sind immer mindestens "offen", Angebote behalten ihren
      // Status (auch "entwurf"). Anzahlungs- und Schlussrechnungen sind
      // ebenfalls gestellte Belege → beim ersten Ausstellen (noch "entwurf")
      // auf "offen" setzen, damit sie als offene Forderung zählen; einen
      // bereits gesetzten Zahl-/Storno-Status (teilbezahlt/bezahlt/storniert)
      // NICHT überschreiben.
      const _invoiceLikeForStatus = new Set(["anzahlungsrechnung", "schlussrechnung"]);
      const saveStatus = form.typ === "rechnung"
        ? "offen"
        : _invoiceLikeForStatus.has(form.typ) && (!form.status || form.status === "entwurf")
          ? "offen"
          : (form.status || "offen");

      // Defensive Parent-Normalisierung: für AR/SR muss parent_invoice_id
      // auf einen echten Positionsträger (Angebot oder AB) zeigen — niemals
      // auf eine andere Rechnung oder AR. Wenn der Form-State einen
      // "verkürzten" Parent hat (z.B. durch manuelle Manipulation oder
      // ältere Daten), wandern wir hoch und korrigieren das vor dem Save.
      let normalizedParentId: string | null = (form as any).parent_invoice_id || null;
      if (normalizedParentId && (form.typ === "anzahlungsrechnung" || form.typ === "schlussrechnung")) {
        let cursor: string | null = normalizedParentId;
        for (let i = 0; i < 5 && cursor; i++) {
          const { data: parentRow } = await supabase
            .from("invoices")
            .select("id, typ, parent_invoice_id")
            .eq("id", cursor)
            .maybeSingle();
          const pt = (parentRow as any)?.typ;
          if (pt === "angebot" || pt === "auftragsbestaetigung") {
            normalizedParentId = cursor;
            break;
          }
          cursor = (parentRow as any)?.parent_invoice_id || null;
        }
      }

      const invoicePayload: any = {
        status: saveStatus,
        kunde_name: form.kunde_name,
        kunde_adresse: form.kunde_adresse || null,
        kunde_plz: form.kunde_plz || null,
        kunde_ort: form.kunde_ort || null,
        kunde_land: form.kunde_land || null,
        kunde_email: form.kunde_email || null,
        kunde_telefon: form.kunde_telefon || null,
        kunde_uid: form.kunde_uid || null,
        kunde_anrede: (form as any).kunde_anrede || null,
        kunde_titel: (form as any).kunde_titel || null,
        reverse_charge: (form as any).reverse_charge || false,
        datum: form.datum,
        faellig_am: form.faellig_am || null,
        leistungsdatum: form.leistungsdatum || null,
        zahlungsbedingungen: form.zahlungsbedingungen || null,
        notizen: form.notizen || null,
        betreff: form.betreff || null,
        netto_summe: nettoSumme,
        mwst_satz: form.mwst_satz,
        mwst_betrag: mwstBetrag,
        brutto_summe: bruttoSumme,
        project_id: form.project_id || null,
        bezahlt_betrag: form.bezahlt_betrag,
        customer_id: customerId || null,
        gueltig_bis: form.gueltig_bis || null,
        rabatt_prozent: form.rabatt_prozent,
        rabatt_betrag: form.rabatt_betrag,
        kalkulation_aufschlag_override: form.kalkulation_aufschlag_override ?? null,
        mahnstufe: form.mahnstufe,
        skonto_prozent: form.skonto_prozent || 0,
        skonto_tage: form.skonto_tage || 0,
        kundennummer: (form as any).kundennummer || null,
        parent_invoice_id: normalizedParentId,
        anzahlung_prozent: (form as any).anzahlung_prozent ?? null,
        anzahlung_betrag: (form as any).anzahlung_betrag ?? null,
        ansprechpartner_employee_id: (form as any).ansprechpartner_employee_id || null,
        ansprechpartner_name: (form as any).ansprechpartner_name?.trim() || null,
        ansprechpartner_telefon: (form as any).ansprechpartner_telefon?.trim() || null,
        ansprechpartner_email: (form as any).ansprechpartner_email?.trim() || null,
      };

      // leistungsdatum_bis nur mitschicken, wenn der User es befüllt hat —
      // ältere DB-Stände ohne die Migration 20260503100000 haben die
      // Spalte nicht und PostgREST würde sonst mit Schema-Cache-Fehler
      // ablehnen. Bei vorhandener Spalte funktioniert es trotzdem.
      if (form.leistungsdatum_bis) {
        invoicePayload.leistungsdatum_bis = form.leistungsdatum_bis;
      }
      // Allgemeine Angaben (Migration 20260509100000) — gleiche Retry-
      // Logik. Nur befüllte Felder mitschicken, damit ältere DB-Stände
      // ohne die Spalten weiter funktionieren.
      const aaFields: Array<keyof InvoiceData> = [
        "leistungsbeschreibung",
        "ausfuehrungsort",
        "ausfuehrungs_kw",
        "ausfuehrende_firma",
        "ausfuehrende_firma_freitext",
      ];
      for (const f of aaFields) {
        const v = (form as any)[f];
        if (v && String(v).trim()) (invoicePayload as any)[f] = String(v).trim();
      }
      // Toggle (Migration 20260509200000) — boolean immer mitschicken
      // (auch false), damit beim Toggeln-und-Speichern der State
      // korrekt persistiert wird.
      (invoicePayload as any).allgemeine_angaben_aktiv = !!form.allgemeine_angaben_aktiv;

      // Gutschrift-Verrechnung (Migration 20260511000000) — nur
      // mitschicken, wenn überhaupt gesetzt.
      if (form.verrechnet_mit_invoice_id) {
        (invoicePayload as any).verrechnet_mit_invoice_id = form.verrechnet_mit_invoice_id;
      }
      if (form.verrechnet_am) {
        (invoicePayload as any).verrechnet_am = form.verrechnet_am;
      }

      // Defensive Retry: wenn eine der neuen Spalten (noch) fehlt,
      // einmal ohne sie erneut speichern, damit der User trotz
      // fehlender Migration weiter arbeiten kann. Erfasst sowohl
      // leistungsdatum_bis als auch die Allgemeine-Angaben-Felder,
      // den allgemeine_angaben_aktiv-Toggle und die Gutschrift-
      // Verrechnungs-Felder.
      const allTolerantCols = [
        "leistungsdatum_bis", "allgemeine_angaben_aktiv",
        "verrechnet_mit_invoice_id", "verrechnet_am",
        ...aaFields,
      ];
      const isSchemaCacheMiss = (err: any) =>
        typeof err?.message === "string" &&
        allTolerantCols.some((col) => err.message.includes(col)) &&
        /(schema cache|column .* does not exist)/i.test(err.message);
      const stripTolerantCols = (payload: any) => {
        const next: any = { ...payload };
        for (const col of allTolerantCols) delete next[col];
        return next;
      };

      if (isNew || !savedId) {
        let nummer: string;
        let laufnummer: number;
        let revisionExtras: any = {};
        if (revisionVonId) {
          // Revision: KEINE neue Belegnummer ziehen — Basis-Nummer + "-R<n>",
          // damit Kunde und Buchhaltung den Zusammenhang sofort sehen.
          const { data: alt } = await supabase
            .from("invoices")
            .select("nummer, laufnummer, revision" as any)
            .eq("id", revisionVonId)
            .maybeSingle();
          const altNummer = String((alt as any)?.nummer || form.nummer || "");
          const basis = altNummer.replace(/-R\d+$/, "");
          const neueRevision = (Number((alt as any)?.revision) || 1) + 1;
          nummer = `${basis}-R${neueRevision}`;
          laufnummer = Number((alt as any)?.laufnummer) || 1;
          revisionExtras = { revision: neueRevision, vorgaenger_id: revisionVonId };
        } else {
          const { data: numData, error: numError } = await supabase.rpc("next_document_number" as never, {
            p_typ: form.typ,
            p_jahr: form.jahr,
          } as never);

          if (numError) throw numError;
          nummer = numData as string;
          laufnummer = parseInt((nummer.match(/(\d+)$/) || ["", "1"])[1]) || 1;
        }

        const insertOnce = async (payload: any) => supabase
          .from("invoices")
          .insert({ user_id: user.id, typ: form.typ, nummer, laufnummer, jahr: form.jahr, ...revisionExtras, ...payload, ...(revisionVonId ? { status: "offen" } : {}) })
          .select("id, nummer")
          .single();

        let { data: insertData, error: insertError } = await insertOnce(invoicePayload);
        if (insertError && isSchemaCacheMiss(insertError)) {
          ({ data: insertData, error: insertError } = await insertOnce(stripTolerantCols(invoicePayload)));
        }

        if (insertError) throw insertError;
        savedId = insertData!.id;
        setInvoiceId(savedId);
        updateField("nummer", insertData!.nummer);
      } else {
        const updateOnce = async (payload: any) => supabase
          .from("invoices")
          .update(payload)
          .eq("id", savedId);

        let { error: updateError } = await updateOnce(invoicePayload);
        if (updateError && isSchemaCacheMiss(updateError)) {
          ({ error: updateError } = await updateOnce(stripTolerantCols(invoicePayload)));
        }

        if (updateError) throw updateError;
      }

      await supabase.from("invoice_items").delete().eq("invoice_id", savedId!);

      // Filter empty items before saving
      const validItems = items.filter(item => item.beschreibung.trim());
      const itemsToInsert = validItems.map((item, idx) => ({
        invoice_id: savedId!,
        position: idx + 1,
        beschreibung: item.beschreibung,
        kurztext: item.kurztext || item.beschreibung,
        langtext: item.langtext || null,
        menge: item.menge,
        einheit: item.einheit,
        einzelpreis: item.einzelpreis,
        gesamtpreis: item.gesamtpreis,
        produktnummer: item.produktnummer || null,
        rabatt_prozent: item.rabatt_prozent || 0,
        mwst_exempt: item.mwst_exempt || false,
        set_template_id: item.set_template_id || null,
        set_snapshot: item.set_snapshot || null,
        ist_kalkuliert: item.ist_kalkuliert || false,
        kalkulation_template_id: item.kalkulation_template_id || null,
        kalkulation_snapshot: item.kalkulation_snapshot || null,
        katalog_vk: (item as any).katalog_vk ?? null,
        ek_preis: item.ek_preis || 0,
        verschnitt_prozent: item.verschnitt_prozent || 0,
        aufschlag_prozent: item.aufschlag_prozent || 0,
        befestigung_preis: item.befestigung_preis || 0,
        sonstiges_preis: item.sonstiges_preis || 0,
        arbeitszeit_minuten: item.arbeitszeit_minuten || 0,
        stundensatz: item.stundensatz || 52,
      }));

      const { error: itemsError } = await supabase.from("invoice_items").insert(itemsToInsert);
      if (itemsError) throw itemsError;

      // Update form status to reflect saved state
      if (form.status === "entwurf") {
        updateField("status", saveStatus);
      }

      // Mark original Angebot as "verrechnet" when saving the converted Rechnung
      // Wenn eine rechnungs-artige Konvertierung gespeichert wurde
      // (Rechnung / AR / SR), alle Angebot-/AB-Vorfahren in der Kette
      // auf "verrechnet" setzen. Wir wandern per parent_invoice_id hoch
      // (max. 5 Hops als Safety-Net gegen Datenfehler) und markieren
      // jeden Angebot-/AB-Knoten. Zwischenknoten vom Typ Rechnung oder
      // AR werden dabei einfach übersprungen (ihr Status behält seine
      // eigene Bedeutung: offen/teilbezahlt/bezahlt).
      const _invoiceLikeTypesForVerrechnet = new Set(["rechnung", "anzahlungsrechnung", "schlussrechnung"]);
      if (fromAngebotId && _invoiceLikeTypesForVerrechnet.has(form.typ)) {
        let hopCursor: string | null = fromAngebotId;
        for (let i = 0; i < 5 && hopCursor; i++) {
          const { data: hop } = await supabase
            .from("invoices")
            .select("id, typ, status, parent_invoice_id")
            .eq("id", hopCursor)
            .maybeSingle();
          const hopTyp = (hop as any)?.typ;
          if (hopTyp === "angebot" || hopTyp === "auftragsbestaetigung") {
            if ((hop as any)?.status !== "verrechnet" && (hop as any)?.status !== "storniert") {
              await supabase.from("invoices").update({ status: "verrechnet" }).eq("id", hopCursor);
            }
          }
          hopCursor = (hop as any)?.parent_invoice_id || null;
        }
        setFromAngebotId(null);
      }

      setIsDirty(false);

      if (revisionVonId && savedId) {
        // Revision-Nacharbeiten: Original archivieren (bleibt unverändert
        // abrufbar) und dessen Material-Soll entfernen — die neue Revision
        // erzeugt ihren eigenen Soll gleich unten.
        await supabase.from("invoices").update({ archiviert: true }).eq("id", revisionVonId);
        await (supabase as any).from("material_entries")
          .delete().eq("typ", "bedarf").eq("source_invoice_id", revisionVonId);
        setKalkRefreshApplied(false);
        toast({
          title: "Neue Version erstellt",
          description: `Angebot ${form.nummer || ""} bleibt als Original erhalten (Archiv) — die aktualisierte Fassung wurde als eigenes Angebot gespeichert.`,
        });
      } else {
        setKalkRefreshApplied(false);
        const _lbl = getDocConfig(form.typ).label;
        const _quelle = convertSourceNummer && LOCKED_TYPES.includes(form.typ)
          ? ` Angebot ${convertSourceNummer} wurde als „verrechnet" (in Rechnung überführt) markiert.`
          : "";
        toast({
          title: LOCKED_TYPES.includes(form.typ) && isNew ? `${_lbl} ausgestellt` : "Gespeichert",
          description: `${_lbl} ${form.nummer ? form.nummer + " " : ""}wurde gespeichert.${_quelle}`,
        });
      }

      // Wenn Projekt zugeordnet → PDF zusätzlich in den Projektordner ablegen
      if (savedId && form.project_id) {
        void uploadInvoicePdfToProjectFolder(savedId);
      }
      // Angebot mit Projekt → Projekt-Materialliste (Soll-Bedarf) neu erzeugen.
      // Best effort: Fehler blockieren das Speichern nicht.
      if (savedId && form.project_id && getDocConfig(form.typ).isAngebotLike) {
        const pid = form.project_id;
        const sid = savedId;
        void import("@/lib/materialbedarf")
          .then(({ generateMaterialbedarfFromAngebot }) => generateMaterialbedarfFromAngebot(sid, pid))
          .catch((err) => {
            // Best effort — blockiert das Speichern nicht, aber der Fehler wird
            // sichtbar gemacht, damit eine stehengebliebene/leere Materialliste
            // nicht unbemerkt bleibt.
            toast({ variant: "destructive", title: "Materialliste nicht aktualisiert", description: err?.message || "Der Material-Soll konnte nicht neu erzeugt werden." });
          });
      }

      if ((isNew || revisionVonId) && !previewOpen) {
        navigate(`/invoices/${savedId}`, { replace: true });
      } else if (isNew || revisionVonId) {
        // Preview is open — don't navigate (would lose state), just update URL silently
        window.history.replaceState(null, "", `/invoices/${savedId}`);
      }

      setSaving(false);
      return true;
    } catch (err: any) {
      console.error("Fehler beim Speichern:", err);
      toast({ variant: "destructive", title: "Fehler", description: err.message || "Speichern fehlgeschlagen" });
      setSaving(false);
      return false;
    }
    } finally {
      // Garantie: der Speichern-Button bleibt NIE hängen — auch wenn eine
      // Validierung oben früh mit `return false` abbricht.
      savingRef.current = false;
      setSaving(false);
    }
  };

  /**
   * Erzeugt client-seitig das Rechnungs-/Angebots-PDF und legt es im Projekt-
   * Ordner ab (project-reports/<project_id>/rechnungen/ oder /angebote/).
   * Wird nach jedem Save aufgerufen, wenn die Rechnung/das Angebot einem
   * Projekt zugeordnet ist — non-blocking.
   */
  const uploadInvoicePdfToProjectFolder = async (invId: string) => {
    if (!form.project_id) return;
    try {
      const [{ generateInvoicePdf }, { loadInvoiceLogo }, { uploadProjectPdf }, { generateEpcQrCode }] =
        await Promise.all([
          import("@/lib/pdfGenerator"),
          import("@/lib/logoLoader"),
          import("@/lib/pdfUploader"),
          import("@/lib/invoiceHtml"),
        ]);

      // Bankdaten + UID aus Einstellungen laden
      const { data: bankSettings } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["bank_kontoinhaber", "bank_iban", "bank_bic", "firmen_uid"]);
      const bank = { kontoinhaber: "", iban: "", bic: "" };
      let firmenUid = "";
      bankSettings?.forEach((s: any) => {
        if (s.key === "bank_kontoinhaber") bank.kontoinhaber = s.value;
        if (s.key === "bank_iban") bank.iban = s.value;
        if (s.key === "bank_bic") bank.bic = s.value;
        if (s.key === "firmen_uid") firmenUid = s.value || "";
      });

      const logoUri = await loadInvoiceLogo();
      const invoiceForPdf = await buildInvoiceForPdf();
      // EPC-QR-Code (GiroCode) wie im Download-/Print-Pfad
      let qrDataUri: string | undefined;
      const isInvoiceLike = ["rechnung", "anzahlungsrechnung", "schlussrechnung"].includes(form.typ);
      if (isInvoiceLike && bank.iban && bank.bic && bank.kontoinhaber && bruttoSumme > 0) {
        try {
          qrDataUri = await generateEpcQrCode(bruttoSumme, form.nummer || "", bank);
        } catch { /* optional */ }
      }
      const pdfBlob = await generateInvoicePdf(
        invoiceForPdf,
        items as any,
        bank,
        logoUri,
        qrDataUri,
        firmenUid,
        invoiceLayout,
      );

      const basename = `${form.typ === "rechnung" ? "Rechnung" : "Angebot"}-${form.nummer || invId.slice(0, 8)}-${form.datum}`;
      await uploadProjectPdf({
        projectId: form.project_id,
        category: form.typ === "angebot" ? "angebote" : "rechnungen",
        basename,
        blob: pdfBlob,
      });
    } catch (err: any) {
      // Vite/Rollup Chunk-Hash-Mismatch nach Deploy → reload
      if (err?.message?.includes("Failed to fetch dynamically imported module")) {
        window.location.reload();
        return;
      }
      console.warn("PDF-Upload in Projektordner fehlgeschlagen:", err);
    }
  };

  const handlePreview = () => {
    // Open preview directly — don't save automatically
    setPreviewSaved(!isNew && !!invoiceId && form.typ === "rechnung" && form.status !== "entwurf");
    setPreviewOpen(true);
  };

  const handleSaveFromPreview = async () => {
    const success = await handleSave();
    if (success) {
      setPreviewSaved(true);
      toast({ title: "Gespeichert" });
    }
  };

  // Payment functions
  const loadPayments = async (invId: string) => {
    const { data } = await supabase
      .from("invoice_payments")
      .select("*")
      .eq("invoice_id", invId)
      .order("datum");
    if (data) setPayments(data);
  };

  const loadMahnungen = async () => {
    if (!invoiceId) return;
    const { data } = await supabase
      .from("mahnung_history")
      .select("mahnstufe, created_at")
      .eq("invoice_id", invoiceId)
      .order("created_at");
    if (data) setMahnungen(data);
  };

  const addPayment = async () => {
    if (!invoiceId) return;
    // Leereingabe = voller Restbetrag; eine EXPLIZITE "0" darf NICHT zum
    // Restbetrag werden (Number('0') ist falsy!), sondern wird abgelehnt.
    const raw = String(newPaymentAmount ?? "").trim();
    let betrag = Math.round((raw === "" ? restBetrag : Number(raw)) * 100) / 100;
    if (!Number.isFinite(betrag)) {
      toast({ variant: "destructive", title: "Ungültiger Betrag", description: "Bitte einen gültigen Zahlungsbetrag eingeben." });
      return;
    }
    // M-7: Negative oder 0-Zahlungen ablehnen mit Toast (nicht silent)
    if (betrag < 0) {
      toast({ variant: "destructive", title: "Ungültiger Betrag", description: "Zahlungsbetrag darf nicht negativ sein." });
      return;
    }
    if (betrag === 0) {
      toast({ variant: "destructive", title: "Betrag fehlt", description: "Bitte einen Zahlungsbetrag eingeben." });
      return;
    }

    // M-6: Überzahlung ablehnen mit Toast
    const maxBetrag = Math.round((bruttoSumme - form.bezahlt_betrag) * 100) / 100;
    if (betrag > maxBetrag) {
      toast({ variant: "destructive", title: "Betrag zu hoch", description: `Maximal € ${maxBetrag.toFixed(2)} offen` });
      return;
    }

    const { error } = await supabase.from("invoice_payments").insert({
      invoice_id: invoiceId,
      betrag,
      datum: newPaymentDate,
      notizen: newPaymentNote.trim() || null,
    });

    if (error) {
      toast({ variant: "destructive", title: "Fehler" });
      return;
    }

    // Update bezahlt_betrag on invoice
    const newTotal = Math.round((form.bezahlt_betrag + betrag) * 100) / 100;
    // Preserve storno status — don't override with payment status
    const newStatus = form.status === "storniert" ? "storniert" : (newTotal >= Math.round(bruttoSumme * 100) / 100 ? "bezahlt" : "teilbezahlt");
    await supabase.from("invoices").update({ bezahlt_betrag: newTotal, status: newStatus }).eq("id", invoiceId);
    updateField("bezahlt_betrag", newTotal);
    updateField("status", newStatus);

    setNewPaymentAmount("");
    setNewPaymentNote("");
    setNewPaymentDate(format(new Date(), "yyyy-MM-dd"));
    loadPayments(invoiceId);
    toast({ title: "Zahlung erfasst", description: `€ ${betrag.toFixed(2)} am ${newPaymentDate}` });
  };

  const deletePayment = async (paymentId: string) => {
    if (!invoiceId) return;
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;

    await supabase.from("invoice_payments").delete().eq("id", paymentId);
    const newTotal = Math.round(Math.max(0, form.bezahlt_betrag - Number(payment.betrag)) * 100) / 100;
    // Don't overwrite storniert status
    const newStatus = form.status === "storniert" ? "storniert" : newTotal <= 0 ? "offen" : newTotal >= Math.round(bruttoSumme * 100) / 100 ? "bezahlt" : "teilbezahlt";
    await supabase.from("invoices").update({ bezahlt_betrag: newTotal, status: newStatus }).eq("id", invoiceId);
    updateField("bezahlt_betrag", newTotal);
    updateField("status", newStatus);
    loadPayments(invoiceId);
    toast({ title: "Zahlung gelöscht" });
  };

  /**
   * Baut das Invoice-Objekt für die PDF/HTML-Generierung — mit allen
   * Override-Texten (custom_intro_text / custom_closing_text /
   * custom_anzahlung_hinweis) und mit den live-berechneten Summen
   * (brutto/netto/mwst). Der pure form-State enthält diese Werte
   * nicht; ohne diesen Helper landet im PDF "0,00 €" als Summe.
   */
  const buildInvoiceForPdf = async (): Promise<any> => {
    const { loadDocumentTexts, applyDocumentTextsToInvoice } = await import("@/lib/documentTextsLoader");
    const docTexts = await loadDocumentTexts(form.typ);
    const tageMatch = (form.zahlungsbedingungen || "").match(/\d+/);
    // Kundentyp für PDF-Renderer mitliefern — Geschäftskunden zeigen
    // keine "Anrede" über dem Firmennamen (verhindert "Firma\nFirma X"-
    // Doppelung in der Anschrift). Fallback: leerer String.
    let kundeKundentyp = "";
    if (form.customer_id) {
      try {
        const { data: cust } = await (supabase.from("customers" as any) as any)
          .select("kundentyp")
          .eq("id", form.customer_id)
          .maybeSingle();
        kundeKundentyp = (cust as any)?.kundentyp || "";
      } catch { /* ignore — heuristik im Renderer fängt das ab */ }
    }
    const enriched: any = {
      ...form,
      kunde_kundentyp: kundeKundentyp,
      netto_summe: nettoSumme,
      mwst_betrag: mwstBetrag,
      brutto_summe: bruttoSumme,
    };
    const extraVars: Record<string, string | number | null | undefined> = {
      tage: tageMatch ? Number(tageMatch[0]) : 14,
    };
    // Quell-Dokument für AB / Anzahlungs-/Schluss-Rechnung laden — die
    // Platzhalter {{angebot_nr}} / {{angebot_datum}} (in der AB-Vorlage)
    // bzw. {{rechnung_nr}} / {{rechnung_datum}} (analog für AR/SR)
    // sollen auf das parent invoice zeigen, NICHT auf das aktuelle
    // Dokument. parent_invoice_id wird beim Konvertieren in
    // setForm(...) gesetzt (siehe oben, fromDoc-Pfad).
    const parentId = (form as any).parent_invoice_id;
    if (parentId) {
      try {
        const { data: parent } = await supabase
          .from("invoices")
          .select("nummer, datum")
          .eq("id", parentId)
          .maybeSingle();
        if (parent) {
          const parentNr = (parent as any).nummer || "";
          const parentDatumIso = (parent as any).datum;
          const parentDatum = parentDatumIso
            ? new Date(parentDatumIso + "T12:00:00").toLocaleDateString("de-AT")
            : "";
          // Sowohl angebot_* als auch rechnung_* setzen — die jeweilige
          // Vorlage nutzt nur eine Variante, die andere bleibt unbenutzt.
          extraVars.angebot_nr = parentNr;
          extraVars.angebot_datum = parentDatum;
          extraVars.rechnung_nr = parentNr;
          extraVars.rechnung_datum = parentDatum;
          // Werte zusätzlich am enriched-Objekt anhängen, damit der
          // PDF-/HTML-Renderer einen sichtbaren Bezugs-Block für
          // Gutschriften rendern kann (ohne dass der User den
          // Platzhalter manuell in den Closing-Text packen muss).
          enriched._parent_nummer = parentNr;
          enriched._parent_datum = parentDatum;
        }
      } catch { /* tolerant — Default aus invoice.datum greift dann */ }
    }
    return applyDocumentTextsToInvoice(enriched, docTexts, extraVars);
  };

  /** Erzeugt das Rechnungs-PDF client-side (jsPDF). Lädt Bank+UID+Logo+Layout
   *  aus den Einstellungen. Liefert einen Blob zurück. */
  const buildInvoicePdfBlob = async (): Promise<Blob> => {
    const [{ generateInvoicePdf }, { loadInvoiceLogo }, { generateEpcQrCode }] = await Promise.all([
      import("@/lib/pdfGenerator"),
      import("@/lib/logoLoader"),
      import("@/lib/invoiceHtml"),
    ]);

    const { data: bankSettings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["bank_kontoinhaber", "bank_iban", "bank_bic", "firmen_uid"]);
    const bank = { kontoinhaber: "", iban: "", bic: "" };
    let firmenUid = "";
    bankSettings?.forEach((s: any) => {
      if (s.key === "bank_kontoinhaber") bank.kontoinhaber = s.value;
      if (s.key === "bank_iban") bank.iban = s.value;
      if (s.key === "bank_bic") bank.bic = s.value;
      if (s.key === "firmen_uid") firmenUid = s.value || "";
    });

    const logoUri = await loadInvoiceLogo();
    const invoiceForPdf = await buildInvoiceForPdf();
    // EPC-QR-Code (GiroCode) nur für rechnungs-artige Dokumente, wenn Bank-
    // Daten vollständig sind. Verwendungszweck = Rechnungsnummer (kommt aus
    // dem Renderer als Unstructured Reference an die Banking-App).
    let qrDataUri: string | undefined;
    const isInvoiceLike = ["rechnung", "anzahlungsrechnung", "schlussrechnung"].includes(form.typ);
    if (isInvoiceLike && bank.iban && bank.bic && bank.kontoinhaber && bruttoSumme > 0) {
      try {
        qrDataUri = await generateEpcQrCode(bruttoSumme, form.nummer || "", bank);
      } catch { /* QR optional — Render geht ohne weiter */ }
    }
    return generateInvoicePdf(
      invoiceForPdf,
      items as any,
      bank,
      logoUri,
      qrDataUri,
      firmenUid,
      invoiceLayout,
    );
  };

  // E-Rechnung (ebInterface 6.1, ÖNORM-konformes XML) herunterladen —
  // nur für gespeicherte Rechnungen mit Nummer.
  const handleERechnungDownload = async () => {
    try {
      const [settingsRes, kundeRes] = await Promise.all([
        supabase.from("app_settings").select("key, value").in("key", ["bank_kontoinhaber", "bank_iban", "bank_bic", "firmen_uid"]),
        form.customer_id
          ? (supabase as any).from("customers").select("uid_nummer, email").eq("id", form.customer_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const s: Record<string, string> = {};
      (settingsRes.data || []).forEach((r: any) => { s[r.key] = r.value; });
      const { xml, hinweise } = erzeugeEbInterfaceXml({
        nummer: form.nummer,
        datum: form.datum,
        faellig_am: form.faellig_am || null,
        typ: form.typ,
        ust_satz: Number(form.mwst_satz) || 20,
        rabatt_prozent: Number(form.rabatt_prozent) || 0,
        rabatt_euro: Number((form as any).rabatt_betrag) || 0,
        betreff: form.betreff || "",
        zahlungsbedingungen: form.zahlungsbedingungen || "",
        kunde: {
          name: form.kunde_name,
          adresse: form.kunde_adresse,
          plz: form.kunde_plz,
          ort: form.kunde_ort,
          email: form.kunde_email || (kundeRes as any)?.data?.email || "",
          uid: (kundeRes as any)?.data?.uid_nummer || null,
        },
        firma: {
          name: "Holzbau Lutz OG",
          strasse: "Am Sportplatz 3",
          plz: "6642",
          ort: "Stanzach",
          email: "info@holzbau-lutz.at",
          uid: s.firmen_uid || "ATU67426948",
          iban: s.bank_iban,
          bic: s.bank_bic,
          kontoinhaber: s.bank_kontoinhaber,
        },
        zeilen: items.map(it => ({
          position: it.position,
          beschreibung: it.kurztext || it.beschreibung || "",
          menge: Number(it.menge) || 0,
          einheit: it.einheit,
          einzelpreis: Number(it.einzelpreis) || 0,
          rabatt_prozent: Number(it.rabatt_prozent) || 0,
          gesamtpreis: Number(it.gesamtpreis) || 0,
          mwst_exempt: !!it.mwst_exempt,
        })),
      });
      const blob = new Blob([xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `E-Rechnung_${form.nummer}.xml`; a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "E-Rechnung erstellt",
        description: hinweise.length > 0 ? hinweise.join(" ") : `ebInterface 6.1 — E-Rechnung_${form.nummer}.xml`,
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "E-Rechnung fehlgeschlagen", description: e?.message || "Unbekannter Fehler" });
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoiceId) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte zuerst speichern" });
      return;
    }
    try {
      const pdfBlob = await buildInvoicePdfBlob();

      // Datei direkt herunterladen
      const fileName = `${form.nummer || "Dokument"}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Zusätzlich ins Archiv hochladen (best effort, blockiert den Download nicht)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.storage
            .from("invoice-pdfs")
            .upload(`${user.id}/${invoiceId}/${fileName}`, pdfBlob, { upsert: true, contentType: "application/pdf" });
          loadStoredPdfs(invoiceId);
        }
      } catch { /* ignore archive errors */ }

      toast({ title: "PDF erzeugt", description: fileName });
    } catch (err: any) {
      console.error("PDF-Fehler:", err);
      toast({ variant: "destructive", title: "PDF-Fehler", description: err.message || "PDF konnte nicht erstellt werden" });
    }
  };

  const handlePrintPdf = async () => {
    if (!invoiceId) return;
    try {
      const pdfBlob = await buildInvoicePdfBlob();
      const url = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(url, "_blank");
      // Browser öffnet das PDF direkt mit eingebautem Viewer → Druck via Ctrl/Cmd+P
      // URL erst nach 60s freigeben, damit der Tab Zeit zum Laden hat.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      if (!printWindow) {
        toast({ variant: "destructive", title: "Popup blockiert", description: "Bitte Popups für diese Seite erlauben." });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Drucken fehlgeschlagen", description: err.message });
    }
  };

  const handleDownloadStoredPdf = async (fileName: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !invoiceId) return;

    const { data } = await supabase.storage
      .from("invoice-pdfs")
      .download(`${user.id}/${invoiceId}/${fileName}`);

    if (data) {
      const text = await data.text();
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(text);
        printWindow.document.close();
      }
    }
  };

  const handleDuplicate = () => {
    if (!invoiceId) return;
    // Duplikat als UNGESPEICHERTER Entwurf über den from_doc-Flow: Kunde +
    // Positionen + Kalkulationsfelder werden vorbefüllt, aber es wird KEINE
    // Belegnummer gezogen und nichts gesperrt — Nummer/Status entstehen erst
    // beim regulären Speichern. (Vorher: sofortiger Insert → gesperrte
    // Rechnung mit verbrauchter Nummer, die sich nur stornieren ließ.)
    navigate(`/invoices/new?typ=${form.typ}&from_doc=${invoiceId}&duplicate=1`);
    toast({ title: "Duplikat erstellt", description: "Als Entwurf geladen — Nummer wird beim Speichern vergeben." });
  };

  const handleConvertToInvoice = async () => {
    if (!invoiceId) return;
    // Fallback: erzeuge immer eine normale Rechnung aus Angebot
    navigate(`/invoices/new?typ=rechnung&from_doc=${invoiceId}`);
  };

  // Umwandlung zu beliebigem Ziel-Dokumenttyp. options steuern Extras
  // (Anzahlungs-Prozent, Abzüge von Anzahlungen).
  const handleConvertTo = (
    targetTyp: string,
    options?: { anzahlung_prozent?: number; anzahlung_betrag?: number; abzug_ids?: string[]; from_doc_id?: string },
  ) => {
    const sourceId = options?.from_doc_id || invoiceId;
    if (!sourceId) return;
    // Die Umwandlung lädt die GESPEICHERTE Version aus der DB — ungespeicherte
    // Änderungen (z.B. gerade angepasste Preise) würden im neuen Beleg fehlen.
    // react-router löst kein beforeunload aus, daher hier explizit warnen.
    if (isDirty) {
      const ok = window.confirm("Es gibt ungespeicherte Änderungen — sie würden im neuen Dokument FEHLEN.\n\nZuerst speichern (Abbrechen) oder ohne die Änderungen umwandeln (OK)?");
      if (!ok) return;
    }
    const params = new URLSearchParams({ typ: targetTyp, from_doc: sourceId });
    if (options?.anzahlung_prozent != null) params.set("anzahlung_prozent", String(options.anzahlung_prozent));
    if (options?.anzahlung_betrag != null) params.set("anzahlung_betrag", String(options.anzahlung_betrag));
    if (options?.abzug_ids?.length) params.set("abzug_ids", options.abzug_ids.join(","));
    navigate(`/invoices/new?${params.toString()}`);
  };

  const handleDelete = async () => {
    if (!invoiceId) return;
    try {
      // Vorab prüfen, ob Folgedokumente (AB/AR/SR) auf dieses Dokument verweisen
      // — dann ist die Löschung durch FK RESTRICT eh blockiert, und wir können
      // einen aussagekräftigen Fehler statt generischer DB-Meldung zeigen.
      const { data: children, count } = await supabase
        .from("invoices")
        .select("nummer, typ", { count: "exact", head: false })
        .eq("parent_invoice_id", invoiceId)
        .limit(3);
      if ((count ?? 0) > 0) {
        const beispiele = (children as any[] || []).map(c => c.nummer).filter(Boolean).join(", ");
        toast({
          variant: "destructive",
          title: "Löschen nicht möglich",
          description: `Zu diesem Dokument existieren bereits Folgedokumente (${beispiele}${(count ?? 0) > 3 ? ", …" : ""}). Lösche oder storniere diese zuerst.`,
          duration: 9000,
        });
        return;
      }
      await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
      const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
      if (error) throw error;
      toast({ title: "Gelöscht", description: `${form.typ === "rechnung" ? "Rechnung" : "Angebot"} wurde gelöscht` });
      navigate("/invoices");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message || "Löschen fehlgeschlagen" });
    }
  };

  // Gutschrift-Verrechnung: öffnet den Dialog, lädt vorab alle offenen
  // Rechnungen desselben Kunden, damit der User wählen kann, gegen
  // welche Rechnung verrechnet wird (optional). Bei Save Status auf
  // "verrechnet" + verrechnet_am + (optional) verrechnet_mit_invoice_id;
  // außerdem den bezahlt_betrag der Ziel-Rechnung entsprechend erhöhen.
  const openVerrechnungDialog = async () => {
    setVerrechnungDate(new Date().toISOString().slice(0, 10));
    // Vorauswahl: wenn die Gutschrift schon mit einer Rechnung verknüpft
    // ist (über Convert oder Picker), diese als Default im Dropdown.
    // Sonst "_none" (= Auszahlung).
    setVerrechnungZielInvoice(form.parent_invoice_id || "_none");
    setVerrechnungZielOptions([]);
    if (form.customer_id) {
      const { data } = await supabase
        .from("invoices")
        .select("id, nummer, brutto_summe, bezahlt_betrag, status")
        .eq("customer_id", form.customer_id)
        .in("typ", ["rechnung", "anzahlungsrechnung", "schlussrechnung"])
        .in("status", ["offen", "teilbezahlt"])
        .order("datum", { ascending: false });
      let options = ((data as any[]) || []).map(d => ({
        id: d.id,
        nummer: d.nummer || "",
        brutto_summe: Number(d.brutto_summe) || 0,
        bezahlt_betrag: Number(d.bezahlt_betrag) || 0,
        status: d.status,
      }));
      // Wenn parent_invoice_id existiert aber nicht in der offenen Liste
      // ist (z. B. weil schon bezahlt), trotzdem hinzufügen, damit die
      // Vorauswahl sichtbar bleibt.
      if (form.parent_invoice_id && !options.some(o => o.id === form.parent_invoice_id)) {
        const { data: parent } = await supabase
          .from("invoices")
          .select("id, nummer, brutto_summe, bezahlt_betrag, status")
          .eq("id", form.parent_invoice_id)
          .maybeSingle();
        if (parent) {
          options = [{
            id: (parent as any).id,
            nummer: (parent as any).nummer || "",
            brutto_summe: Number((parent as any).brutto_summe) || 0,
            bezahlt_betrag: Number((parent as any).bezahlt_betrag) || 0,
            status: (parent as any).status || "",
          }, ...options];
        }
      }
      setVerrechnungZielOptions(options);
    }
    setVerrechnungDialogOpen(true);
  };

  const handleVerrechnungSave = async () => {
    if (!invoiceId) return;
    setVerrechnungSaving(true);
    try {
      const zielId = verrechnungZielInvoice !== "_none" ? verrechnungZielInvoice : null;
      // Gutschrift selbst aktualisieren
      const { error: gErr } = await supabase
        .from("invoices")
        .update({
          status: "verrechnet",
          verrechnet_am: verrechnungDate || new Date().toISOString().slice(0, 10),
          verrechnet_mit_invoice_id: zielId,
        } as any)
        .eq("id", invoiceId);
      if (gErr) throw gErr;

      // Wenn eine Ziel-Rechnung gewählt wurde: bezahlt_betrag um Gutschrift-
      // Brutto erhöhen (capped auf brutto_summe der Rechnung).
      if (zielId) {
        const ziel = verrechnungZielOptions.find(o => o.id === zielId);
        if (ziel) {
          const gutschriftBrutto = Math.abs(Number(bruttoSumme) || Number(form.brutto_summe) || 0);
          const restRechnung = Math.max(0, ziel.brutto_summe - ziel.bezahlt_betrag);
          const angerechnet = Math.min(gutschriftBrutto, restRechnung);
          const neuerBezahlt = Math.round((ziel.bezahlt_betrag + angerechnet) * 100) / 100;
          const neuerStatus = neuerBezahlt >= Math.round(ziel.brutto_summe * 100) / 100
            ? "bezahlt"
            : neuerBezahlt > 0 ? "teilbezahlt" : "offen";
          await supabase
            .from("invoices")
            .update({ bezahlt_betrag: neuerBezahlt, status: neuerStatus })
            .eq("id", zielId);
        }
      }

      // Lokalen State aktualisieren, damit UI sofort den neuen Stand zeigt
      setForm(prev => ({
        ...prev,
        status: "verrechnet",
        verrechnet_am: verrechnungDate || new Date().toISOString().slice(0, 10),
        verrechnet_mit_invoice_id: zielId,
      } as any));
      setVerrechnungDialogOpen(false);
      toast({ title: "Gutschrift verrechnet", description: zielId ? "Mit Rechnung verknüpft." : "Auszahlung verbucht." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    } finally {
      setVerrechnungSaving(false);
    }
  };

  // Storno-Helper: generisch für Rechnung, Anzahlungsrechnung, Schlussrechnung,
  // Gutschrift UND Auftragsbestätigung. Grund + PDF-Label sind parametrierbar;
  // Defaults erhalten die bisherige Rechnungs-Semantik.
  const handleCancel = async (opts?: { grund?: string; docTypeLabel?: string }) => {
    if (!invoiceId) return;
    const stornoGrund = (opts?.grund?.trim()) || "Storniert durch Benutzer";
    const docTypeLabel = opts?.docTypeLabel || "Rechnung";
    try {
      const stornoNummer = `S-${form.nummer || invoiceId.substring(0, 8)}`;
      const stornoDatum = new Date().toISOString().split("T")[0];

      // Wenn die zu stornierende Doku eine VERRECHNETE GUTSCHRIFT ist,
      // muss der bei der Verrechnung gebuchte Betrag auf der Ziel-
      // Rechnung wieder zurückgerollt werden — sonst zeigt die Rechnung
      // weiterhin den verrechneten Betrag als "bezahlt" obwohl die
      // Gutschrift weg ist (Branchenstandard: sevDesk/Lexoffice machen
      // den Rollback automatisch).
      if (form.typ === "gutschrift" && form.status === "verrechnet" && form.verrechnet_mit_invoice_id) {
        try {
          const { data: targetInv } = await supabase
            .from("invoices")
            .select("brutto_summe, bezahlt_betrag, status")
            .eq("id", form.verrechnet_mit_invoice_id)
            .maybeSingle();
          if (targetInv) {
            const gutschriftBrutto = Math.abs(Number(bruttoSumme) || 0);
            const altBezahlt = Number((targetInv as any).bezahlt_betrag) || 0;
            // Die Verrechnung hat höchstens min(GS-Brutto, damaliger Rest)
            // angerechnet — echte Zahlungseingänge (invoice_payments) dürfen
            // beim Rollback NIE mit ausradiert werden: Untergrenze = Σ payments.
            const { data: pays } = await supabase
              .from("invoice_payments").select("betrag")
              .eq("invoice_id", form.verrechnet_mit_invoice_id);
            const paymentsSum = Math.round(((pays as any[]) || []).reduce((s, p) => s + (Number(p.betrag) || 0), 0) * 100) / 100;
            const neuBezahlt = Math.max(paymentsSum, Math.max(0, Math.round((altBezahlt - gutschriftBrutto) * 100) / 100));
            const targetBrutto = Number((targetInv as any).brutto_summe) || 0;
            const altStatus = (targetInv as any).status;
            // Status nur neu berechnen wenn nicht storniert
            const neuStatus = altStatus === "storniert"
              ? "storniert"
              : neuBezahlt <= 0
                ? "offen"
                : neuBezahlt >= Math.round(targetBrutto * 100) / 100
                  ? "bezahlt"
                  : "teilbezahlt";
            await supabase
              .from("invoices")
              .update({ bezahlt_betrag: neuBezahlt, status: neuStatus })
              .eq("id", form.verrechnet_mit_invoice_id);
          }
        } catch (rollbackErr: any) {
          // Rollback-Fehler nicht fatal — der Storno der Gutschrift soll
          // trotzdem laufen. User wird informiert.
          console.error("Rollback der Gutschrift-Verrechnung fehlgeschlagen:", rollbackErr);
          toast({ variant: "destructive", title: "Rollback-Warnung", description: "Verrechnung auf der Quell-Rechnung konnte nicht zurückgesetzt werden — bitte manuell prüfen." });
        }
      }

      // bezahlt_betrag beim Storno auf 0 — sonst bleibt der Teilzahlungs-
      // Wert stehen und verzerrt Umsatz-/Offen-Statistiken.
      const { error } = await supabase.from("invoices").update({
        status: "storniert",
        storno_nummer: stornoNummer,
        storno_datum: stornoDatum,
        storno_grund: stornoGrund,
        bezahlt_betrag: 0,
      }).eq("id", invoiceId);
      if (error) throw error;
      setForm(prev => ({ ...prev, status: "storniert", storno_nummer: stornoNummer, storno_datum: stornoDatum, storno_grund: stornoGrund, bezahlt_betrag: 0 }));

      // Stornobeleg sofort erstellen und herunterladen
      try {
        const { generateStornoPdf } = await import("@/lib/pdfGenerator");
        const logoUri = await loadInvoiceLogo();
        const { data: bankSettings1 } = await supabase.from("app_settings").select("key, value").in("key", ["bank_kontoinhaber", "bank_iban", "bank_bic"]);
        const bank1 = { kontoinhaber: "", iban: "", bic: "" };
        bankSettings1?.forEach((s: any) => {
          if (s.key === "bank_kontoinhaber") bank1.kontoinhaber = s.value;
          if (s.key === "bank_iban") bank1.iban = s.value;
          if (s.key === "bank_bic") bank1.bic = s.value;
        });
        const pdfBlob = generateStornoPdf(
          { nummer: form.nummer, kunde_name: form.kunde_name, brutto_summe: bruttoSumme, datum: form.datum },
          stornoNummer, stornoDatum, stornoGrund,
          bank1, logoUri, invoiceLayout, docTypeLabel
        );
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a"); a.href = url; a.download = `Storno_${stornoNummer}.pdf`; a.click();
        URL.revokeObjectURL(url);
      } catch (pdfErr) {
        console.error("Storno-PDF Fehler:", pdfErr);
      }

      toast({ title: `${docTypeLabel} storniert`, description: `Stornobeleg ${stornoNummer} wurde erstellt` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message || "Stornierung fehlgeschlagen" });
    }
  };

  // ========= AB-Aktion: Aufheben (Delete oder Storno, kontextabhängig) =========
  type FollowupDoc = { id: string; typ: string; nummer: string; status: string };

  const getFollowupDocs = async (parentId: string): Promise<FollowupDoc[]> => {
    const { data } = await supabase
      .from("invoices")
      .select("id, typ, nummer, status")
      .eq("parent_invoice_id", parentId)
      .neq("status", "storniert")
      .order("datum", { ascending: true });
    return (data as FollowupDoc[]) || [];
  };

  const [abActionOpen, setAbActionOpen] = useState(false);
  const [abActionLoading, setAbActionLoading] = useState(false);
  const [abCanHardDelete, setAbCanHardDelete] = useState(false);
  const [abFollowups, setAbFollowups] = useState<FollowupDoc[]>([]);
  const [abStornoGrund, setAbStornoGrund] = useState("Auftrag aufgehoben");

  const openAbActionDialog = async () => {
    if (!invoiceId) return;
    setAbActionLoading(true);
    try {
      const followups = await getFollowupDocs(invoiceId);
      const canHard = form.status === "entwurf" && followups.length === 0;
      setAbCanHardDelete(canHard);
      setAbFollowups(followups);
      setAbStornoGrund("Auftrag aufgehoben");
      setAbActionOpen(true);
    } finally {
      setAbActionLoading(false);
    }
  };

  const handleHardDeleteAb = async () => {
    if (!invoiceId) return;
    try {
      // invoice_items werden via ON DELETE CASCADE automatisch entfernt
      const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
      if (error) throw error;
      toast({ title: "Gelöscht", description: `${typLabel} ${form.nummer || ""} wurde endgültig entfernt.` });
      navigate("/invoices");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message || "Löschen fehlgeschlagen" });
    }
  };

  const confirmAbAction = async () => {
    setAbActionOpen(false);
    if (abCanHardDelete) {
      await handleHardDeleteAb();
    } else {
      await handleCancel({ grund: abStornoGrund, docTypeLabel: "Auftragsbestätigung" });
    }
  };

  const canAbAction =
    !isNew && !!invoiceId && id !== "new"
    && form.typ === "auftragsbestaetigung"
    && form.status !== "storniert";

  const handleMahnstufeUp = async () => {
    if (!invoiceId) return;
    if (bruttoSumme <= 0) {
      toast({ variant: "destructive", title: "Nicht möglich", description: "Mahnung kann nicht für Rechnungen mit €0,00 erstellt werden" });
      return;
    }
    if (form.mahnstufe >= 3) {
      toast({ variant: "destructive", title: "Maximum erreicht", description: "Mahnstufe 3 (Letzte Mahnung) ist das Maximum" });
      return;
    }
    const newStufe = form.mahnstufe + 1;
    try {
      const { error } = await supabase.from("invoices").update({ mahnstufe: newStufe }).eq("id", invoiceId);
      if (error) throw error;
      updateField("mahnstufe", newStufe);
      toast({ title: "Mahnstufe erhöht", description: `Mahnstufe ist jetzt ${newStufe}` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    }
  };

  if (loading) return <div className="text-center py-8">Lädt...</div>;

  const typLabel = getDocConfig(form.typ).label;
  // Grammatik-Artikel für "Neue/Neuer/Neues X erstellen":
  //   Neues Angebot | Neuer Lieferschein | sonst: Neue <typ>
  const typArticle = form.typ === "angebot" ? "Neues" : form.typ === "lieferschein" ? "Neuer" : "Neue";

  const groupedTemplates = templates.reduce<Record<string, TemplateItem[]>>((acc, t) => {
    (acc[t.kategorie] = acc[t.kategorie] || []).push(t);
    return acc;
  }, {});

  // Stundensätze aus dem Materialkatalog (Facharbeiter, Regie, Lehrling, Kran,
  // LKW/Hiab, Maschine …) — zum Verrechnen importierter Projektzeiten.
  const stundensaetze = templates
    // Echte eigene Lohn-/Gerätesätze: explizit als Arbeitszeit/Stundensatz
    // gekennzeichnete Katalog-Artikel (ist_stundensatz).
    .filter(t => (t as any).art === "material" && (t as any).ist_stundensatz === true)
    .map(t => ({
      id: t.id,
      name: (t as any).kurzbezeichnung || t.name,
      satz: Number((t as any).ek_netto ?? (t as any).netto_preis ?? t.einzelpreis) || 0,
    }))
    .filter(s => s.satz > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Stornierte Rechnung: Nur Stornobeleg anzeigen
  if (form.status === "storniert" && !isNew && invoiceId) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-[800px]">
          <PageHeader title={`Storno: ${form.nummer}`} backPath="/invoices" />
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6 text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-2">
                  <Ban className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-red-700">Rechnung storniert</h2>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Rechnungsnummer: <strong>{form.nummer}</strong></p>
                  <p>Kunde: <strong>{form.kunde_name}</strong></p>
                  <p>Bruttobetrag: <strong>€ {bruttoSumme.toFixed(2)}</strong></p>
                  {form.storno_nummer && <p>Stornonummer: <strong>{form.storno_nummer}</strong></p>}
                  {form.storno_datum && <p>Storniert am: <strong>{new Date(form.storno_datum + "T12:00:00").toLocaleDateString("de-AT")}</strong></p>}
                  {form.storno_grund && <p>Grund: <strong>{form.storno_grund}</strong></p>}
                </div>
                <div className="flex justify-center gap-3 pt-4">
                  <Button variant="outline" onClick={() => navigate("/invoices")}>Zurück</Button>
                  <Button variant="default" className="gap-2" onClick={async () => {
                    try {
                      // Always load fresh from DB to ensure data is available
                      const { data: freshInv } = await supabase.from("invoices")
                        .select("storno_nummer, storno_datum, storno_grund, nummer, kunde_name, brutto_summe, datum")
                        .eq("id", invoiceId).single();
                      if (!freshInv?.storno_nummer) {
                        toast({ variant: "destructive", title: "Kein Stornobeleg vorhanden" });
                        return;
                      }
                      const { generateStornoPdf } = await import("@/lib/pdfGenerator");
                      const logoUri = await loadInvoiceLogo();
                      const { data: bankSettings2 } = await supabase.from("app_settings").select("key, value").in("key", ["bank_kontoinhaber", "bank_iban", "bank_bic"]);
                      const bank2 = { kontoinhaber: "", iban: "", bic: "" };
                      bankSettings2?.forEach((s: any) => {
                        if (s.key === "bank_kontoinhaber") bank2.kontoinhaber = s.value;
                        if (s.key === "bank_iban") bank2.iban = s.value;
                        if (s.key === "bank_bic") bank2.bic = s.value;
                      });
                      const pdfBlob = generateStornoPdf(
                        { nummer: freshInv.nummer, kunde_name: freshInv.kunde_name, brutto_summe: Number(freshInv.brutto_summe), datum: freshInv.datum },
                        freshInv.storno_nummer, freshInv.storno_datum || freshInv.datum, freshInv.storno_grund || "",
                        bank2, logoUri, invoiceLayout
                      );
                      const url = URL.createObjectURL(pdfBlob);
                      const a = document.createElement("a"); a.href = url; a.download = `Storno_${freshInv.storno_nummer}.pdf`; a.click();
                      URL.revokeObjectURL(url);
                    } catch (e) { console.error(e); toast({ variant: "destructive", title: "Fehler beim Erstellen" }); }
                  }}>
                    <Download className="w-4 h-4" />
                    Stornobeleg herunterladen
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-[1600px]">
        <PageHeader
          title={isNew ? `${typArticle} ${typLabel} erstellen` : `${typLabel} ${form.nummer}`}
          backPath="/invoices"
        />

        <div className="space-y-6">
          {/* Dokumenten-Kette: Root (Angebot/AB) + alle abgeleiteten Dokumente */}
          {!isNew && chainRoot && (chainRoot.id !== invoiceId || chainChildren.length > 0) && (
            <Card className="border-blue-200 bg-blue-50/40">
              <CardContent className="pt-4 pb-3">
                <div className="text-xs font-medium text-blue-900 uppercase tracking-wide mb-2">Auftrag</div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {/* Root */}
                  <button
                    type="button"
                    onClick={() => { if (chainRoot.id !== invoiceId) navigate(`/invoices/${chainRoot.id}`); }}
                    disabled={chainRoot.id === invoiceId}
                    className={`flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-xs transition-colors ${
                      chainRoot.id === invoiceId
                        ? "border-blue-400 bg-blue-100 text-blue-900 ring-1 ring-blue-400"
                        : "border-blue-200 bg-white hover:bg-blue-100 text-blue-900"
                    }`}
                  >
                    <span className="text-[10px] uppercase text-blue-600">{getDocConfig(chainRoot.typ).shortLabel}</span>
                    <span>{chainRoot.nummer || "—"}</span>
                  </button>
                  {chainChildren.length > 0 && <span className="text-blue-600">→</span>}
                  {chainChildren.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { if (c.id !== invoiceId) navigate(`/invoices/${c.id}`); }}
                      disabled={c.id === invoiceId}
                      className={`flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-xs transition-colors ${
                        c.id === invoiceId
                          ? "border-blue-400 bg-blue-100 text-blue-900 ring-1 ring-blue-400"
                          : c.status === "storniert"
                            ? "border-red-200 bg-white text-red-700 line-through opacity-70 hover:opacity-100"
                            : "border-blue-200 bg-white hover:bg-blue-100 text-blue-900"
                      }`}
                      title={`${getDocConfig(c.typ).label} ${c.nummer || ""} — € ${Number(c.brutto_summe).toFixed(2)} brutto, Status ${c.status}`}
                    >
                      <span className="text-[10px] uppercase text-blue-600">{getDocConfig(c.typ).shortLabel}</span>
                      <span>{c.nummer || "—"}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Entwurf-Hinweis: aus einem Angebot umgewandelt, aber noch NICHT
              ausgestellt — verhindert das Missverständnis "Umwandeln = fertig". */}
          {isNew && fromAngebotId && LOCKED_TYPES.includes(form.typ) && (
            <div className="flex items-start gap-2 rounded-md border border-blue-300 bg-blue-50 px-3 py-2.5 text-sm text-blue-900">
              <FileText className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
              <span>
                <b>Entwurf</b> aus {convertSourceNummer ? `Angebot ${convertSourceNummer}` : "dem Quellbeleg"} —
                die {getDocConfig(form.typ).label} wird erst mit <b>„Speichern"</b> ausgestellt
                (Nummer wird dabei vergeben, das Angebot als „verrechnet" markiert).
              </span>
            </div>
          )}

          {/* Revisions-Verknüpfung: neuere Fassung ↔ Original sichtbar machen */}
          {!isNew && revisionInfo.nachfolger && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                <b>Alter Preisstand:</b> Dieses Angebot wurde durch{" "}
                <button type="button" className="underline font-semibold" onClick={() => navigate(`/invoices/${revisionInfo.nachfolger!.id}`)}>
                  {revisionInfo.nachfolger.nummer}
                </button>{" "}
                ersetzt (Preise aktualisiert). Es bleibt als Original erhalten — zum Weiterarbeiten bitte die neue Fassung verwenden.
              </span>
            </div>
          )}
          {!isNew && revisionInfo.vorgaenger && (
            <div className="flex items-start gap-2 rounded-md border border-blue-300 bg-blue-50 px-3 py-2.5 text-sm text-blue-900">
              <FileText className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
              <span>
                <b>Revision {revisionInfo.revision}:</b> Aktualisierter Preisstand — ersetzt{" "}
                <button type="button" className="underline font-semibold" onClick={() => navigate(`/invoices/${revisionInfo.vorgaenger!.id}`)}>
                  {revisionInfo.vorgaenger.nummer}
                </button>{" "}
                (Original bleibt im Archiv erhalten).
              </span>
            </div>
          )}

          {/* Gesperrt-Erklärung: ausgestellter Beleg — sagen WARUM gesperrt
              und was noch möglich ist (sonst wirken die toten Felder kaputt). */}
          {isLocked && form.status !== "storniert" && (
            <div className="flex items-start gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
              <Lock className="h-4 w-4 shrink-0 mt-0.5 text-slate-500" />
              <span>
                Diese {getDocConfig(form.typ).label} wurde <b>ausgestellt</b> und ist nicht mehr bearbeitbar
                (gesetzliche Belegsicherheit). Weiterhin möglich: <b>Zahlung erfassen</b> (unten),
                <b> Mahnung</b>, <b>Gutschrift</b> (Umwandeln-Menü), <b>Storno</b> und <b>Duplizieren</b> als Entwurf.
              </span>
            </div>
          )}

          {/* Status & Actions */}
          {!isNew && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="outline" className="text-lg px-4 py-1 font-mono">{form.nummer}</Badge>
                    <Badge className={statusColors[form.status] || ""}>
                      {statusLabels[form.status] || form.status}
                    </Badge>
                    {/* Status direkt HIER wechselbar — der nächste Schritt nach dem
                        Versenden ("Kunde hat angenommen") darf nicht nur im
                        unscheinbaren Listen-Dropdown versteckt sein. */}
                    {form.typ === "angebot" && !["verrechnet", "storniert"].includes(form.status) && !revisionInfo.nachfolger && (
                      <Select
                        value={form.status}
                        onValueChange={async (neu) => {
                          if (neu === form.status || !invoiceId) return;
                          const { error } = await supabase.from("invoices").update({ status: neu }).eq("id", invoiceId);
                          if (error) { toast({ variant: "destructive", title: "Fehler", description: error.message }); return; }
                          updateField("status", neu);
                          if (neu === "angenommen") {
                            toast({ title: "Angebot angenommen 🎉", description: form.project_id ? "Projekt ist bereits verknüpft." : "Lege jetzt das Projekt zur Baustelle an." });
                            if (!form.project_id) setCreateProjectDialogOpen(true);
                          } else {
                            toast({ title: "Status geändert", description: statusLabels[neu] || neu });
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 w-[170px] text-sm">
                          <SelectValue placeholder="Status ändern…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entwurf">Entwurf</SelectItem>
                          <SelectItem value="offen">Offen (versendet)</SelectItem>
                          <SelectItem value="angenommen">✓ Angenommen</SelectItem>
                          <SelectItem value="abgelehnt">✗ Abgelehnt</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {form.mahnstufe > 0 && (
                      <Badge variant="destructive">
                        {form.mahnstufe === 1 ? "Zahlungserinnerung" : `${form.mahnstufe}. Mahnung`}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["rechnung", "anzahlungsrechnung", "schlussrechnung"].includes(form.typ) && (form.status === "offen" || form.status === "teilbezahlt") && bruttoSumme > 0 && (
                      <Select onValueChange={async (stufe) => {
                        const mahnstufe = parseInt(stufe);
                        // Warnung bei teilbezahlten Rechnungen — offener Restbetrag wird gemahnt
                        if (form.bezahlt_betrag > 0 && form.bezahlt_betrag < bruttoSumme) {
                          const offen = bruttoSumme - form.bezahlt_betrag;
                          const ok = window.confirm(
                            `⚠️ Diese Rechnung ist bereits teilbezahlt.\n\n` +
                            `Brutto: € ${bruttoSumme.toFixed(2)}\n` +
                            `Bezahlt: € ${form.bezahlt_betrag.toFixed(2)}\n` +
                            `Offen: € ${offen.toFixed(2)}\n\n` +
                            `Die Mahnung wird den OFFENEN Betrag (€ ${offen.toFixed(2)}) mahnen. Fortfahren?`
                          );
                          if (!ok) return;
                        }
                        try {
                          // Update mahnstufe in DB + save history
                          await supabase.from("invoices").update({ mahnstufe }).eq("id", invoiceId);
                          await supabase.from("mahnung_history").insert({ invoice_id: invoiceId, mahnstufe });
                          updateField("mahnstufe", mahnstufe);
                          loadMahnungen();
                          // Generate Mahnung PDF
                          const logoUri = await loadInvoiceLogo();
                          const { data: bankSettings } = await supabase.from("app_settings").select("key, value").in("key", ["bank_kontoinhaber", "bank_iban", "bank_bic"]);
                          const bank = { kontoinhaber: "", iban: "", bic: "" };
                          bankSettings?.forEach((s: any) => {
                            if (s.key === "bank_kontoinhaber") bank.kontoinhaber = s.value;
                            if (s.key === "bank_iban") bank.iban = s.value;
                            if (s.key === "bank_bic") bank.bic = s.value;
                          });
                          const { generateMahnungPdf } = await import("@/lib/pdfGenerator");
                          const { loadMahnungSettings } = await import("@/lib/mahnungSettings");
                          const mahnSettings = await loadMahnungSettings();
                          const pdfBlob = generateMahnungPdf(
                            { nummer: form.nummer, datum: form.datum, faellig_am: form.faellig_am, kunde_name: form.kunde_name, kunde_adresse: form.kunde_adresse, kunde_plz: form.kunde_plz, kunde_ort: form.kunde_ort, brutto_summe: bruttoSumme, bezahlt_betrag: form.bezahlt_betrag },
                            mahnstufe, 0, bank, logoUri, invoiceLayout, mahnSettings
                          );
                          const url = URL.createObjectURL(pdfBlob);
                          const a = document.createElement("a"); a.href = url;
                          const stufeLabel = mahnSettings.stufen[Math.min(Math.max(mahnstufe, 1), 3) - 1].titel;
                          a.download = `${stufeLabel}_${form.nummer}.pdf`; a.click();
                          URL.revokeObjectURL(url);
                          toast({ title: `${stufeLabel} erstellt`, description: "PDF wurde heruntergeladen" });
                        } catch (err: any) {
                          toast({ variant: "destructive", title: "Fehler", description: err.message });
                        }
                      }}>
                        <SelectTrigger className="w-[220px] h-9 text-sm">
                          <SelectValue placeholder="Mahnung erstellen..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Zahlungserinnerung (1. Stufe)</SelectItem>
                          <SelectItem value="2">2. Mahnung</SelectItem>
                          <SelectItem value="3">3. Mahnung (Letzte)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {/* Umwandeln-Menü: zeigt basierend auf aktuellem typ die erlaubten Ziele.
                        Auch bei "verrechnet" sichtbar (nur Folge-AR/SR) — sonst gäbe es nach
                        der 1. Anzahlungsrechnung am Auftrag keinen Weg zur Schlussrechnung.
                        Ersetzte Original-Angebote (alte Revision) bieten KEIN Umwandeln an. */}
                    {!isNew && form.status !== "abgelehnt" && form.status !== "storniert" && !revisionInfo.nachfolger && (() => {
                      const t = form.typ;
                      const istVerrechnet = form.status === "verrechnet";
                      // Vom Angebot aus darf man direkt in jeden Rechnungstyp
                      // umwandeln — der Umweg über AB ist optional, nicht Pflicht.
                      const allow = {
                        auftragsbestaetigung: t === "angebot" && !istVerrechnet,
                        rechnung: (t === "angebot" || t === "auftragsbestaetigung") && !istVerrechnet,
                        // Folge-AR aus AR = kumulierte Anzahlungsrechnung
                        anzahlungsrechnung: t === "angebot" || t === "auftragsbestaetigung" || t === "anzahlungsrechnung",
                        schlussrechnung: t === "angebot" || t === "auftragsbestaetigung" || t === "anzahlungsrechnung",
                        // Gutschrift kann zu jeder rechnungs-artigen Doku angelegt
                        // werden — Kunde + Items + parent_invoice_id werden via
                        // bestehendem from_doc-Pfad automatisch übernommen.
                        gutschrift: t === "rechnung" || t === "anzahlungsrechnung" || t === "schlussrechnung",
                      };
                      if (!Object.values(allow).some(Boolean)) return null;
                      return (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="default" size="sm" className="gap-1.5">
                              <ArrowRightLeft className="w-4 h-4" />
                              Umwandeln in...
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {allow.auftragsbestaetigung && (
                              <DropdownMenuItem onClick={() => handleConvertTo("auftragsbestaetigung")}>
                                Auftragsbestätigung
                              </DropdownMenuItem>
                            )}
                            {allow.rechnung && (
                              <DropdownMenuItem onClick={() => handleConvertTo("rechnung")}>
                                Rechnung
                              </DropdownMenuItem>
                            )}
                            {allow.anzahlungsrechnung && (
                              <DropdownMenuItem onClick={async () => {
                                // Bereits bestehende nicht-stornierte Anzahlungen zum selben Auftrag
                                // laden (Kumulations-Check + kumulierte Abzugszeilen der Folge-AR).
                                // Die Wurzel (Angebot/AB) FRISCH aus der DB ermitteln — wie beim
                                // SR-Handler — damit auch "AR aus AR" korrekt am Auftrag hängt.
                                if (invoiceId) {
                                  let rootId = invoiceId;
                                  let cursor: string | null = invoiceId;
                                  let cursorTyp = form.typ;
                                  for (let hops = 0; hops < 6 && cursorTyp === "anzahlungsrechnung" && cursor; hops++) {
                                    const { data: row } = await supabase
                                      .from("invoices")
                                      .select("parent_invoice_id")
                                      .eq("id", cursor)
                                      .maybeSingle();
                                    const parent = (row as any)?.parent_invoice_id || null;
                                    if (!parent) break;
                                    rootId = parent;
                                    cursor = parent;
                                    const { data: parentRow } = await supabase
                                      .from("invoices")
                                      .select("typ")
                                      .eq("id", parent)
                                      .maybeSingle();
                                    cursorTyp = (parentRow as any)?.typ || "";
                                  }
                                  const { data: existingAnz } = await supabase
                                    .from("invoices")
                                    .select("id, netto_summe")
                                    .eq("parent_invoice_id", rootId)
                                    .eq("typ", "anzahlungsrechnung")
                                    .neq("status", "storniert");
                                  const rows = ((existingAnz as any[]) || []);
                                  // Sicherheitsnetz: aktuelles Dokument ist selbst eine AR,
                                  // hängt aber (noch) nicht am Root → trotzdem mitzählen.
                                  if (form.typ === "anzahlungsrechnung" && form.status !== "storniert" && !rows.some(r => r.id === invoiceId)) {
                                    rows.push({ id: invoiceId, netto_summe: nettoSumme });
                                  }
                                  const sum = rows.reduce((s, r) => s + (Number(r.netto_summe) || 0), 0);
                                  setBestehendeAnzahlungenNetto(sum);
                                  setAnzahlungAbzugIds(rows.map(r => r.id));
                                  setAnzahlungRootId(rootId);
                                  // Basis = Netto des Wurzel-Auftrags (bei AR-aus-AR ≠ aktuelles Dokument)
                                  if (rootId !== invoiceId) {
                                    const { data: rootInv } = await supabase
                                      .from("invoices")
                                      .select("netto_summe")
                                      .eq("id", rootId)
                                      .maybeSingle();
                                    setAnzahlungBasisNetto(Number((rootInv as any)?.netto_summe) || null);
                                  } else {
                                    setAnzahlungBasisNetto(null);
                                  }
                                } else {
                                  setBestehendeAnzahlungenNetto(0);
                                  setAnzahlungAbzugIds([]);
                                  setAnzahlungRootId(null);
                                  setAnzahlungBasisNetto(null);
                                }
                                setAnzahlungProzentInput("30");
                                setAnzahlungBetragInput((nettoSumme * 0.3).toFixed(2));
                                setAnzahlungMode("prozent");
                                setAnzahlungDialogOpen(true);
                              }}>
                                Anzahlungsrechnung…
                              </DropdownMenuItem>
                            )}
                            {allow.schlussrechnung && (
                              <DropdownMenuItem onClick={async () => {
                                // Schlussrechnung = ALLE Originalpositionen des Auftrags
                                // (Angebot/AB) + automatischer Abzug aller Anzahlungs-
                                // rechnungen zum selben Auftrag.
                                //
                                // Die Root (Positionsträger) ermitteln wir FRISCH aus der
                                // DB — unabhängig vom Form-State — indem wir von hier aus
                                // entlang parent_invoice_id hochwandern bis zum ersten
                                // Dokument, das KEIN "anzahlungsrechnung" ist (also
                                // Angebot oder AB). Das macht die Logik robust gegen
                                // stale Form-Daten und gegen verschachtelte Ketten.
                                if (!invoiceId) return;
                                let rootId = invoiceId;
                                let cursor: string | null = invoiceId;
                                let cursorTyp = form.typ;
                                for (let hops = 0; hops < 6 && cursorTyp === "anzahlungsrechnung" && cursor; hops++) {
                                  const { data: row } = await supabase
                                    .from("invoices")
                                    .select("parent_invoice_id")
                                    .eq("id", cursor)
                                    .maybeSingle();
                                  const parent = (row as any)?.parent_invoice_id || null;
                                  if (!parent) break;
                                  rootId = parent;
                                  cursor = parent;
                                  // Typ des Parents holen, um zu entscheiden, ob wir weiter hoch gehen
                                  const { data: parentRow } = await supabase
                                    .from("invoices")
                                    .select("typ")
                                    .eq("id", parent)
                                    .maybeSingle();
                                  cursorTyp = (parentRow as any)?.typ || "";
                                }

                                // Guard: existiert bereits eine nicht-stornierte Schlussrechnung
                                // zum selben Auftrag? Dann abbrechen — sonst hätten wir parallele
                                // SRs mit identischen Abzügen.
                                const { data: existingSR } = await supabase
                                  .from("invoices")
                                  .select("id, nummer, status")
                                  .eq("parent_invoice_id", rootId)
                                  .eq("typ", "schlussrechnung")
                                  .neq("status", "storniert")
                                  .limit(1);
                                if (existingSR && existingSR.length > 0) {
                                  toast({
                                    variant: "destructive",
                                    title: "Schlussrechnung existiert bereits",
                                    description: `Zu diesem Auftrag gibt es schon die Schlussrechnung ${(existingSR[0] as any).nummer || ""}. Storniere sie zuerst, falls du sie neu erstellen willst.`,
                                  });
                                  return;
                                }

                                // Alle nicht-stornierten Anzahlungen zum gleichen Auftrag finden
                                const { data } = await supabase
                                  .from("invoices")
                                  .select("id, status")
                                  .eq("parent_invoice_id", rootId)
                                  .eq("typ", "anzahlungsrechnung")
                                  .neq("status", "storniert");
                                const ids = ((data as any[]) || []).map(r => r.id);
                                // Sicherheitsnetz: aktuelles Dokument ist eine nicht-stornierte
                                // Anzahlungsrechnung, die (z.B. durch inkonsistente
                                // parent_invoice_id) nicht in der Liste steht → trotzdem abziehen.
                                if (form.typ === "anzahlungsrechnung" && form.status !== "storniert" && !ids.includes(invoiceId)) {
                                  ids.push(invoiceId);
                                }
                                handleConvertTo("schlussrechnung", { abzug_ids: ids, from_doc_id: rootId });
                              }}>
                                Schlussrechnung
                              </DropdownMenuItem>
                            )}
                            {allow.gutschrift && (
                              <DropdownMenuItem onClick={() => handleConvertTo("gutschrift")}>
                                <Undo2 className="w-4 h-4 mr-2" />
                                Gutschrift zu dieser Rechnung
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      );
                    })()}
                    <Button onClick={handleDuplicate} variant="outline" size="sm" className="gap-1.5">
                      <Copy className="w-4 h-4" />
                      Duplizieren
                    </Button>
                    {/* Gutschrift: nur wenn noch nicht verrechnet/storniert */}
                    {!isNew && form.typ === "gutschrift" && form.status !== "verrechnet" && form.status !== "storniert" && (
                      <Button onClick={openVerrechnungDialog} variant="default" size="sm" className="gap-1.5">
                        <Undo2 className="w-4 h-4" />
                        Als verrechnet markieren
                      </Button>
                    )}
                    {canCancel && (
                      // EIN einheitlicher Storno-Weg: öffnet denselben Dialog wie
                      // der Fußzeilen-Button (race-sichere Storno-Nummer, Pflicht-
                      // Grund, Bezahlt-Warnung, Storno-PDF, Gutschrift-Rollback).
                      <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setStornoDialogOpen(true)}>
                        <Ban className="w-4 h-4" />
                        Stornieren
                      </Button>
                    )}
                    {canDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" className="gap-1.5">
                            <Trash2 className="w-4 h-4" />
                            Löschen
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5 text-destructive" />
                              {typLabel} löschen?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {typLabel} {form.nummer} und alle Positionen werden dauerhaft gelöscht.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Endgültig löschen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    {canAbAction && (
                      <>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-1.5"
                          onClick={openAbActionDialog}
                          disabled={abActionLoading}
                        >
                          <Ban className="w-4 h-4" />
                          Auftrag aufheben
                        </Button>
                        <AlertDialog open={abActionOpen} onOpenChange={setAbActionOpen}>
                          <AlertDialogContent className="max-w-lg">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-destructive" />
                                {abCanHardDelete ? "Auftragsbestätigung endgültig löschen?" : "Auftrag stornieren?"}
                              </AlertDialogTitle>
                              <AlertDialogDescription asChild>
                                <div className="space-y-3">
                                  {abCanHardDelete ? (
                                    <p>
                                      Die Auftragsbestätigung {form.nummer} ist im Status „Entwurf" und hat keine
                                      Folgedokumente. Sie wird <b>unwiderruflich entfernt</b>, inkl. aller Positionen.
                                      Kein Storno-Beleg nötig.
                                    </p>
                                  ) : (
                                    <>
                                      <p>
                                        Die Auftragsbestätigung {form.nummer} wird als <b>storniert</b> markiert
                                        und ein Storno-PDF wird automatisch erzeugt & heruntergeladen.
                                      </p>
                                      {abFollowups.length > 0 && (
                                        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                                          <p className="font-medium text-destructive mb-1">
                                            ⚠ Es existieren {abFollowups.length} Folgedokument{abFollowups.length === 1 ? "" : "e"}:
                                          </p>
                                          <ul className="text-foreground space-y-0.5">
                                            {abFollowups.map(f => (
                                              <li key={f.id} className="text-xs">
                                                • <span className="font-mono">{f.nummer}</span> ({f.typ} · {f.status})
                                              </li>
                                            ))}
                                          </ul>
                                          <p className="text-xs text-muted-foreground mt-2">
                                            Diese bleiben unberührt. Bei Bedarf musst du sie separat stornieren.
                                          </p>
                                        </div>
                                      )}
                                      <div className="space-y-1.5">
                                        <Label htmlFor="ab-storno-grund">Grund der Stornierung</Label>
                                        <Textarea
                                          id="ab-storno-grund"
                                          rows={2}
                                          value={abStornoGrund}
                                          onChange={(e) => setAbStornoGrund(e.target.value)}
                                        />
                                      </div>
                                    </>
                                  )}
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={confirmAbAction}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {abCanHardDelete ? "Endgültig löschen" : "Stornieren & PDF erzeugen"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Zahlungsverlauf */}
          {!isNew && ["rechnung", "anzahlungsrechnung", "schlussrechnung"].includes(form.typ) && form.status !== "storniert" && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">Zahlungsverlauf</CardTitle>
                  <div className="flex items-center gap-4 text-sm">
                    <span>Brutto: <strong>€ {bruttoSumme.toFixed(2)}</strong></span>
                    <span>Bezahlt: <strong className="text-green-600">€ {form.bezahlt_betrag.toFixed(2)}</strong></span>
                    <span>Offen: <strong className={restBetrag > 0 ? "text-orange-600" : "text-green-600"}>€ {restBetrag.toFixed(2)}</strong></span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Existing payments */}
                {payments.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-green-700">€ {Number(p.betrag).toFixed(2)}</span>
                          <span className="text-sm text-muted-foreground">{format(parseISO(p.datum), "dd.MM.yyyy")}</span>
                          {p.notizen && <span className="text-xs text-muted-foreground italic">{p.notizen}</span>}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => deletePayment(p.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add payment form */}
                {restBetrag > 0 && (
                  <div className="flex items-end gap-3 pt-2 border-t">
                    <div>
                      <Label className="text-xs">Betrag €</Label>
                      <Input
                        type="number"
                        value={newPaymentAmount}
                        onChange={(e) => setNewPaymentAmount(e.target.value)}
                        placeholder={restBetrag.toFixed(2)}
                        min={0}
                        step={0.01}
                        className="w-32"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Datum</Label>
                      <Input
                        type="date"
                        value={newPaymentDate}
                        onChange={(e) => setNewPaymentDate(e.target.value)}
                        className="w-40"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Notiz (optional)</Label>
                      <Input
                        value={newPaymentNote}
                        onChange={(e) => setNewPaymentNote(e.target.value)}
                        placeholder="z.B. Überweisung"
                        className="w-40"
                      />
                    </div>
                    <Button size="sm" onClick={addPayment} className="gap-1">
                      <Plus className="w-3.5 h-3.5" />
                      Zahlung
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Mahnungs-Übersicht */}
          {!isNew && ["rechnung", "anzahlungsrechnung", "schlussrechnung"].includes(form.typ) && mahnungen.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Mahnungen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {mahnungen.map((m, idx) => {
                    const label = m.mahnstufe === 1 ? "Zahlungserinnerung" : m.mahnstufe === 2 ? "2. Mahnung" : "3. Mahnung (Letzte)";
                    const dateTime = new Date(m.created_at);
                    const dateStr = dateTime.toLocaleDateString("de-AT");
                    const timeStr = dateTime.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-md border">
                        <div className="flex items-center gap-3">
                          <Badge variant={m.mahnstufe >= 3 ? "destructive" : "outline"} className="text-xs">
                            Stufe {m.mahnstufe}
                          </Badge>
                          <div>
                            <span className="text-sm font-medium">{label}</span>
                            <p className="text-xs text-muted-foreground">{dateStr} um {timeStr} Uhr</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="gap-1" onClick={async () => {
                          try {
                            const logoUri = await loadInvoiceLogo();
                            const { data: bankSettings } = await supabase.from("app_settings").select("key, value").in("key", ["bank_kontoinhaber", "bank_iban", "bank_bic"]);
                            const bank = { kontoinhaber: "", iban: "", bic: "" };
                            bankSettings?.forEach((s: any) => {
                              if (s.key === "bank_kontoinhaber") bank.kontoinhaber = s.value;
                              if (s.key === "bank_iban") bank.iban = s.value;
                              if (s.key === "bank_bic") bank.bic = s.value;
                            });
                            const { generateMahnungPdf } = await import("@/lib/pdfGenerator");
                            const { loadMahnungSettings } = await import("@/lib/mahnungSettings");
                            const mahnSettings = await loadMahnungSettings();
                            const pdfBlob = generateMahnungPdf(
                              { nummer: form.nummer, datum: form.datum, faellig_am: form.faellig_am, kunde_name: form.kunde_name, kunde_adresse: form.kunde_adresse, kunde_plz: form.kunde_plz, kunde_ort: form.kunde_ort, brutto_summe: bruttoSumme, bezahlt_betrag: form.bezahlt_betrag },
                              m.mahnstufe, 0, bank, logoUri, invoiceLayout, mahnSettings
                            );
                            const url = URL.createObjectURL(pdfBlob);
                            const a = document.createElement("a"); a.href = url; a.download = `${label}_${form.nummer}.pdf`; a.click();
                            URL.revokeObjectURL(url);
                          } catch {}
                        }}>
                          <Download className="w-4 h-4" />
                          PDF
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Projekt-Auswahl: bei Rechnung + Angebot/AB, vor den Kundendaten.
              Bei Angebot/AB nötig, damit der "Aus Projekt übernehmen"-Button
              in den Allgemeinen Angaben den Ausführungsort ziehen kann. */}
          {!isLocked && (form.typ === "rechnung" || getDocConfig(form.typ).isAngebotLike) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Projekt (optional)</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={form.project_id || "none"} onValueChange={async (v) => {
                  const projectId = v === "none" ? null : v;
                  updateField("project_id", projectId);
                  if (projectId) {
                    // Projekt-Details laden (nur für customer_id).
                    const { data: projFull } = await (supabase.from("projects" as never) as any)
                      .select("customer_id")
                      .eq("id", projectId)
                      .maybeSingle();
                    const custId = projFull?.customer_id || (projects.find(p => p.id === projectId) as any)?.customer_id;
                    if (custId) {
                      const { data: cust } = await supabase
                        .from("customers")
                        .select("id, name, anrede, titel, uid_nummer, adresse, plz, ort, land, email, telefon, kundennummer, ansprechpartner, skonto_prozent, skonto_tage, nettofrist")
                        .eq("id", custId)
                        .single();
                      if (cust) {
                        setForm(prev => ({
                          ...prev,
                          customer_id: cust.id,
                          kunde_name: cust.name,
                          kunde_adresse: cust.adresse || "",
                          kunde_plz: cust.plz || "",
                          kunde_ort: cust.ort || "",
                          kunde_land: cust.land || "Österreich",
                          kunde_email: cust.email || "",
                          kunde_telefon: cust.telefon || "",
                          kunde_uid: cust.uid_nummer || "",
                          kunde_anrede: cust.anrede || "",
                          kunde_titel: cust.titel || "",
                          kundennummer: cust.kundennummer || "",
                          // Ansprechpartner wird beim Kunden-Wechsel NICHT
                          // übernommen — er ist der Sachbearbeiter und
                          // wird separat im Formular gewählt.
                          skonto_prozent: Number(cust.skonto_prozent) || 0,
                          skonto_tage: Number(cust.skonto_tage) || 0,
                        } as any));
                        const custNettofrist = Number(cust.nettofrist) || 0;
                        const zb = nettofristToDropdown(custNettofrist);
                        updateField("zahlungsbedingungen", zb);
                        // Bei "individuell" muss faellig_am explizit gesetzt
                        // werden (der Sync-useEffect rührt "individuell" nicht
                        // an). Für Standard-Dropdown-Werte übernimmt der
                        // useEffect die Berechnung automatisch.
                        if (zb === "individuell" && custNettofrist > 0 && form.datum) {
                          const due = new Date(form.datum + "T12:00:00");
                          due.setDate(due.getDate() + custNettofrist);
                          updateField("faellig_am", due.toISOString().split("T")[0]);
                        }
                        toast({ title: "Projektdaten übernommen", description: cust.name });
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
                {form.project_id && form.customer_id && (
                  <p className="text-xs text-green-600 mt-2">Kundendaten wurden automatisch vom Projekt übernommen</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Projekt-Anzeige bei gespeicherten Dokumenten */}
          {form.project_id && (isLocked || isKundeLocked) && (() => {
            const proj = projects.find(p => p.id === form.project_id);
            return proj ? (
              <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 rounded-md p-2.5">
                <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="text-muted-foreground">Projekt:</span>
                <span className="font-medium">{proj.name}</span>
              </div>
            ) : null;
          })()}

          {/* Gutschrift: optionaler Bezug auf bestehende Rechnung — nur bei
              neuer Standalone-Gutschrift sichtbar. Bei Convert-Pfad
              (from_doc) ist parent_invoice_id schon gesetzt und der
              Bezugs-Block versteckt sich. */}
          {isNew && form.typ === "gutschrift" && !form.parent_invoice_id && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Bezug auf Rechnung (optional)</CardTitle>
                <CardDescription>
                  Wählen Sie eine bestehende Rechnung, deren Daten als Vorlage
                  übernommen werden. Kundendaten und Positionen werden vorbefüllt;
                  Sie können danach Positionen löschen oder Mengen anpassen.
                  Wenn Sie nichts wählen, legen Sie eine eigenständige Gutschrift an.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  onValueChange={async (id) => {
                    if (id && id !== "_none") {
                      // Direkt in den Form-State laden — Kunde +
                      // Positionen + parent_invoice_id werden sofort
                      // gesetzt, ohne Navigation. Vorteil gegenüber
                      // navigate(...) mit ?from_doc=: das useEffect bei
                      // Mount feuert nicht erneut, weil sich `id`
                      // (Route-Param) nicht ändert.
                      await loadFromSourceDoc(id, "gutschrift");
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Rechnung wählen oder leer lassen für Standalone-Gutschrift" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectRechnungen.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nummer} · {r.kunde_name} · {new Date(r.datum + "T12:00:00").toLocaleDateString("de-AT")}
                      </SelectItem>
                    ))}
                    {projectRechnungen.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        Lädt verfügbare Rechnungen…
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Kundendaten — locked nach Speichern nur bei Rechnungen, bei Angeboten editierbar */}
          <Card className={isKundeLocked ? "opacity-80" : ""}>
            <fieldset disabled={isKundeLocked}>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Kundendaten</CardTitle>
                <CustomerSelect
                  value={form.customer_id || null}
                  onChange={async (id, customer) => {
                    if (!customer) {
                      setForm(prev => ({
                        ...prev,
                        customer_id: null,
                        kunde_name: "",
                        kunde_adresse: "",
                        kunde_plz: "",
                        kunde_ort: "",
                        kunde_land: "Österreich",
                        kunde_email: "",
                        kunde_telefon: "",
                        kunde_uid: "",
                        kunde_anrede: "",
                        kunde_titel: "",
                        kundennummer: "",
                      } as any));
                      return;
                    }
                    const updates: any = {
                      customer_id: customer.id,
                      kunde_name: customer.name,
                      kunde_adresse: customer.adresse || "",
                      kunde_plz: customer.plz || "",
                      kunde_ort: customer.ort || "",
                      kunde_land: customer.land || "Österreich",
                      kunde_email: customer.email || "",
                      kunde_telefon: customer.telefon || "",
                      kunde_uid: customer.uid_nummer || "",
                      kunde_anrede: customer.anrede || "",
                      kunde_titel: customer.titel || "",
                      kundennummer: customer.kundennummer || "",
                      // Ansprechpartner wird NICHT aus den Kundendaten übernommen —
                      // er ist der Sachbearbeiter und wird pro Dokument aus
                      // der Mitarbeiter-Liste gewählt.
                    };
                    // Übernehme Skonto + Zahlungsfrist vom Kunden (nur bei Rechnungen)
                    const hints: string[] = [];
                    if (form.typ === "rechnung") {
                      const { data: fullCust } = await supabase.from("customers").select("skonto_prozent, skonto_tage, nettofrist").eq("id", customer.id).single();
                      if (fullCust) {
                        const custSkonto = Number(fullCust.skonto_prozent) || 0;
                        const custSkontoTage = Number(fullCust.skonto_tage) || 0;
                        const custNettofrist = Number(fullCust.nettofrist) || 0;
                        if (custSkonto > 0) {
                          updates.skonto_prozent = custSkonto;
                          updates.skonto_tage = custSkontoTage;
                          hints.push(`Skonto: ${custSkonto}% / ${custSkontoTage} Tage`);
                        }
                        const zb = nettofristToDropdown(custNettofrist);
                        updates.zahlungsbedingungen = zb;
                        if (zb === "individuell" && custNettofrist > 0 && form.datum) {
                          const due = new Date(form.datum + "T12:00:00");
                          due.setDate(due.getDate() + custNettofrist);
                          updates.faellig_am = due.toISOString().split("T")[0];
                        }
                        if (custNettofrist > 0) {
                          hints.push(`Zahlungsfrist: ${custNettofrist} Tage`);
                        }
                      }
                    }
                    setForm(prev => ({ ...prev, ...updates }));
                    if (hints.length > 0) {
                      toast({ title: "Kundeneinstellungen übernommen", description: hints.join(" · ") });
                    }
                    // Hinweis bei Geschäftskunde ohne UID — die UID ist für
                    // den Empfänger-Block am PDF wichtig (Reverse-Charge,
                    // B2B-Nachweis). Besser jetzt darauf hinweisen, als
                    // später eine UID-lose Rechnung zu drucken.
                    if ((customer as any).kundentyp === "geschaeftskunde" && !(customer.uid_nummer || "").trim()) {
                      toast({
                        variant: "destructive",
                        title: "UID fehlt",
                        description: `${customer.name} ist ein Geschäftskunde, hat aber keine UID-Nummer hinterlegt. Bitte im Kunden-Datensatz ergänzen — sie erscheint sonst nicht im Rechnungs-Adressfeld.`,
                        duration: 8000,
                      });
                    }
                  }}
                />
              </div>
              {form.customer_id && (
                <p className="text-xs text-muted-foreground mt-1">
                  Verknüpft mit bestehendem Kunden • <button className="underline" onClick={() => {
                    setForm(prev => ({
                      ...prev,
                      customer_id: null,
                      kunde_name: "",
                      kunde_adresse: "",
                      kunde_plz: "",
                      kunde_ort: "",
                      kunde_land: "Österreich",
                      kunde_email: "",
                      kunde_telefon: "",
                      kunde_uid: "",
                      kunde_anrede: "",
                      kunde_titel: "",
                      kundennummer: "",
                    } as any));
                  }}>Verknüpfung lösen</button>
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {form.kunde_name ? (
                <div className="rounded-lg border p-3 bg-muted/30 space-y-1 text-sm relative">
                  {!isKundeLocked && (
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      {form.customer_id && (
                        <button
                          type="button"
                          className="rounded-full p-1 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          title="Kundendaten bearbeiten"
                          onClick={() => setCustomerEditOpen(true)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded-full p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Kunde entfernen"
                        onClick={() => {
                          setForm(prev => ({
                            ...prev,
                            customer_id: null,
                            kunde_name: "",
                            kunde_adresse: "",
                            kunde_plz: "",
                            kunde_ort: "",
                            kunde_land: "Österreich",
                            kunde_email: "",
                            kunde_telefon: "",
                            kunde_uid: "",
                            kunde_anrede: "",
                            kunde_titel: "",
                            kundennummer: "",
                          } as any));
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <div className="font-medium text-base pr-16">
                    {(form as any).kunde_anrede && <span className="text-muted-foreground">{(form as any).kunde_anrede} </span>}
                    {(form as any).kunde_titel && <span className="text-muted-foreground">{(form as any).kunde_titel} </span>}
                    {form.kunde_name}
                  </div>
                  {form.kunde_adresse && <div className="text-muted-foreground">{form.kunde_adresse}</div>}
                  {(form.kunde_plz || form.kunde_ort) && <div className="text-muted-foreground">{form.kunde_plz} {form.kunde_ort} {form.kunde_land && form.kunde_land !== "Österreich" ? `· ${form.kunde_land}` : ""}</div>}
                  <div className="flex gap-4 mt-1">
                    {form.kunde_email && <span className="text-muted-foreground">{form.kunde_email}</span>}
                    {form.kunde_telefon && <span className="text-muted-foreground">{form.kunde_telefon}</span>}
                  </div>
                  {form.kunde_uid && <div className="text-muted-foreground">UID: {form.kunde_uid}</div>}
                  {(form as any).kundennummer && <div className="text-muted-foreground">Kundennr.: {(form as any).kundennummer}</div>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Kein Kunde ausgewählt. Wählen Sie oben einen Kunden aus.</p>
              )}
              {/* Ansprechpartner (Sachbearbeiter) pro Dokument */}
              <div className="mt-3 p-3 rounded-lg bg-muted/30 border space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Ihr Ansprechpartner (erscheint rechts oben im PDF)
                </p>
                <Select
                  value={(form as any).ansprechpartner_employee_id || "__none__"}
                  disabled={isLocked}
                  onValueChange={(val) => {
                    if (val === "__none__") {
                      // "Keiner" leert auch die Freitext-Felder, damit im
                      // PDF gar kein Ansprechpartner erscheint.
                      setForm(prev => ({
                        ...prev,
                        ansprechpartner_employee_id: null,
                        ansprechpartner_name: "",
                        ansprechpartner_telefon: "",
                        ansprechpartner_email: "",
                      } as any));
                      if (!loading) setIsDirty(true);
                      return;
                    }
                    if (val === "__manual__") {
                      // Manuelle Eingabe: Dropdown-Referenz löschen, aber
                      // Freitext-Felder lassen wie sie sind, sodass der
                      // User sie editieren kann.
                      setForm(prev => ({
                        ...prev,
                        ansprechpartner_employee_id: null,
                      } as any));
                      if (!loading) setIsDirty(true);
                      return;
                    }
                    const emp = employees.find(e => e.id === val);
                    if (!emp) return;
                    setForm(prev => ({
                      ...prev,
                      ansprechpartner_employee_id: emp.id,
                      ansprechpartner_name: `${emp.vorname} ${emp.nachname}`.trim(),
                      ansprechpartner_telefon: emp.telefon || "",
                      ansprechpartner_email: emp.email || "",
                    } as any));
                    if (!loading) setIsDirty(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Mitarbeiter auswählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">— Keiner (im PDF ausblenden)</span>
                    </SelectItem>
                    <SelectItem value="__manual__">
                      <span className="text-muted-foreground">— Manuell eingeben…</span>
                    </SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.vorname} {emp.nachname}
                        {emp.position ? <span className="text-muted-foreground ml-1">— {emp.position}</span> : null}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Freitext-Felder: immer editierbar (nur gesperrt, wenn die
                    ganze Rechnung locked ist). Bei Mitarbeiter-Auswahl werden
                    die Werte übernommen, können aber danach überschrieben
                    werden — die Employee-ID wird dabei automatisch gelöst,
                    damit später klar ist, dass es ein angepasster Snapshot
                    und keine Live-Referenz auf den Mitarbeiter mehr ist. */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input
                    value={(form as any).ansprechpartner_name || ""}
                    onChange={(e) => {
                      updateField("ansprechpartner_name" as any, e.target.value);
                      if ((form as any).ansprechpartner_employee_id) {
                        updateField("ansprechpartner_employee_id" as any, null);
                      }
                    }}
                    placeholder="Name"
                    disabled={isLocked}
                  />
                  <Input
                    value={(form as any).ansprechpartner_telefon || ""}
                    onChange={(e) => {
                      updateField("ansprechpartner_telefon" as any, e.target.value);
                      if ((form as any).ansprechpartner_employee_id) {
                        updateField("ansprechpartner_employee_id" as any, null);
                      }
                    }}
                    placeholder="Telefon"
                    type="tel"
                    disabled={isLocked}
                  />
                  <Input
                    value={(form as any).ansprechpartner_email || ""}
                    onChange={(e) => {
                      updateField("ansprechpartner_email" as any, e.target.value);
                      if ((form as any).ansprechpartner_employee_id) {
                        updateField("ansprechpartner_employee_id" as any, null);
                      }
                    }}
                    placeholder="E-Mail"
                    type="email"
                    disabled={isLocked}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Bei Mitarbeiter-Auswahl vorbefüllt, jederzeit editierbar. Leer lassen, wenn auf dem PDF kein Ansprechpartner erscheinen soll.
                </p>
              </div>

              {/* Zahlungseinstellungen (vom Kunden) */}
              {form.typ === "rechnung" && (form.skonto_prozent > 0 || form.skonto_tage > 0 || (form as any).zahlungsbedingungen) && (
                <div className="mt-3 p-3 rounded-lg bg-muted/30 border">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Zahlungseinstellungen vom Kunden</p>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    {form.skonto_prozent > 0 && (
                      <div><span className="text-muted-foreground">Skonto:</span> <strong>{form.skonto_prozent}%</strong></div>
                    )}
                    {form.skonto_tage > 0 && (
                      <div><span className="text-muted-foreground">Skonto-Tage:</span> <strong>{form.skonto_tage}</strong></div>
                    )}
                    {form.zahlungsbedingungen && (
                      <div><span className="text-muted-foreground">Zahlungsfrist:</span> <strong>{form.zahlungsbedingungen}</strong></div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
            </fieldset>
          </Card>

          {/* Rechnungsdetails */}
          <Card className={isLocked ? "opacity-80" : ""}>
            <fieldset disabled={isLocked}>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Datum</Label>
                  <Input type="date" value={form.datum} onChange={(e) => updateField("datum", e.target.value)} />
                </div>
                {getDocConfig(form.typ).showLeistungsdatum && (
                  <div className="md:col-span-2">
                    <Label>Leistungszeitraum</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={form.leistungsdatum || form.datum}
                        onChange={(e) => updateField("leistungsdatum", e.target.value)}
                        placeholder="von"
                      />
                      <Input
                        type="date"
                        value={(form as any).leistungsdatum_bis || ""}
                        onChange={(e) => updateField("leistungsdatum_bis" as any, e.target.value)}
                        placeholder="bis (optional)"
                        min={form.leistungsdatum || form.datum || undefined}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Beginnt automatisch am Rechnungsdatum. Enddatum nur ausfüllen, wenn die Leistung über mehrere Tage erbracht wurde.
                    </p>
                  </div>
                )}
                {form.typ === "rechnung" && (
                  <div>
                    <Label>Fällig am</Label>
                    <Input
                      type="date"
                      value={form.faellig_am}
                      onChange={(e) => updateField("faellig_am", e.target.value)}
                      disabled={form.zahlungsbedingungen !== "individuell"}
                    />
                    {form.zahlungsbedingungen !== "individuell" && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Automatisch aus Rechnungsdatum + Zahlungsfrist berechnet.
                      </p>
                    )}
                  </div>
                )}
                {form.typ === "angebot" && (
                  <div>
                    <Label>Gültig bis</Label>
                    <Input type="date" value={form.gueltig_bis} onChange={(e) => updateField("gueltig_bis", e.target.value)} />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {form.typ === "rechnung" && (
                  <div>
                    <Label>Zahlungsfrist</Label>
                    <Select
                      value={form.zahlungsbedingungen || "14 Tage"}
                      onValueChange={(v) => {
                        // Dropdown ist Single Source of Truth. "individuell"
                        // schaltet das faellig_am-Feld frei; alle anderen Werte
                        // rechnen faellig_am automatisch über den useEffect-
                        // Sync weiter unten aus.
                        updateField("zahlungsbedingungen", v);
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sofort">Sofort fällig</SelectItem>
                        <SelectItem value="7 Tage">7 Tage</SelectItem>
                        <SelectItem value="14 Tage">14 Tage</SelectItem>
                        <SelectItem value="30 Tage">30 Tage</SelectItem>
                        <SelectItem value="60 Tage">60 Tage</SelectItem>
                        <SelectItem value="individuell">Individuelles Datum…</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {form.typ === "rechnung" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Skonto %</Label>
                      <Input
                        type="number"
                        value={form.skonto_prozent || ""}
                        onChange={(e) => updateField("skonto_prozent", Math.min(100, Math.max(0, Number(e.target.value))))}
                        placeholder="z.B. 2"
                        min={0}
                        max={100}
                        step={0.5}
                      />
                    </div>
                    <div>
                      <Label>Skonto Tage</Label>
                      <Input
                        type="number"
                        value={form.skonto_tage || ""}
                        onChange={(e) => updateField("skonto_tage", Number(e.target.value))}
                        placeholder="z.B. 10"
                        min={0}
                      />
                    </div>
                    {form.skonto_prozent > 0 && form.skonto_tage > 0 && (
                      <p className="col-span-2 text-xs text-muted-foreground">
                        Bei Zahlung bis {form.datum ? format(new Date(new Date(form.datum).getTime() + form.skonto_tage * 86400000), "dd.MM.yyyy") : "–"}:
                        {" "}€ {(bruttoSumme * (1 - form.skonto_prozent / 100)).toFixed(2)} ({form.skonto_prozent}% Skonto)
                      </p>
                    )}
                  </div>
                )}
                {/* Projekt-Auswahl ist jetzt oben als eigene Card */}
              </div>
              {form.typ === "rechnung" && (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <input
                    type="checkbox"
                    id="reverse_charge"
                    checked={(form as any).reverse_charge || false}
                    onChange={(e) => {
                      updateField("reverse_charge" as any, e.target.checked);
                      if (e.target.checked) {
                        updateField("mwst_satz", 0);
                      } else {
                        updateField("mwst_satz", 20);
                      }
                    }}
                    className="rounded"
                  />
                  <div>
                    <Label htmlFor="reverse_charge" className="cursor-pointer font-medium">Reverse Charge – Bauleistungen (§ 19 Abs. 1a UStG)</Label>
                    <p className="text-xs text-muted-foreground">Steuerschuld geht auf den Leistungsempfänger über – MwSt auf der Rechnung entfällt. UID des Kunden ist Pflicht.</p>
                  </div>
                </div>
              )}
              {(form as any).reverse_charge && !form.kunde_uid && (
                <p className="text-xs text-red-600 font-medium">UID-Nummer des Kunden ist bei Reverse Charge Pflicht!</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>MwSt-Satz (%)</Label>
                  <Select value={String(form.mwst_satz)} onValueChange={(v) => updateField("mwst_satz", Number(v))} disabled={(form as any).reverse_charge}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20% (Normalsteuersatz)</SelectItem>
                      <SelectItem value="13">13% (ermäßigt)</SelectItem>
                      <SelectItem value="10">10% (ermäßigt)</SelectItem>
                      <SelectItem value="0">0% (steuerfrei)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Rabatt (%)</Label>
                  <Input
                    type="number"
                    value={form.rabatt_prozent}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(0, Number(e.target.value)));
                      updateField("rabatt_prozent", val);
                      if (val > 0) updateField("rabatt_betrag", 0);
                    }}
                    min={0}
                    max={100}
                    step={0.5}
                    className="w-32"
                  />
                </div>
                <div>
                  <Label>Rabatt (€)</Label>
                  <Input
                    type="number"
                    value={form.rabatt_betrag}
                    onChange={(e) => {
                      // Negativ wäre ein unsichtbarer Aufschlag → clampen
                      const val = Math.max(0, Number(e.target.value));
                      updateField("rabatt_betrag", val);
                      if (val > 0) updateField("rabatt_prozent", 0);
                    }}
                    min={0}
                    step={0.01}
                    className="w-32"
                    disabled={form.rabatt_prozent > 0}
                  />
                </div>
                {items.some(it => it.ist_kalkuliert) && (
                  <div>
                    <Label className="flex items-center gap-1">
                      <Calculator className="w-3.5 h-3.5" /> Aufschlag-Override (%)
                    </Label>
                    <Input
                      type="number"
                      value={form.kalkulation_aufschlag_override ?? ""}
                      placeholder="je Position"
                      onChange={(e) => setDocAufschlagOverride(e.target.value)}
                      min={0}
                      step={0.5}
                      className="w-32"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-[16rem]">
                      Überschreibt den Material-Aufschlag aller kalkulierten Positionen — leer = jede Position nutzt ihren eigenen.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
            </fieldset>
          </Card>

          {/* Betreff */}
          <Card className={isLocked ? "opacity-80" : ""}>
            <fieldset disabled={isLocked}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Betreff</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.betreff}
                onChange={(e) => updateField("betreff", e.target.value)}
                placeholder="z.B. Badezimmer-Sanierung EG — Angebot gemäß Besprechung vom..."
                rows={2}
                className="resize-none"
              />
            </CardContent>
            </fieldset>
          </Card>

          {/* Allgemeine Angaben — nur bei Angebot + Auftragsbestätigung.
              Toggle steuert, ob die Tabelle im PDF/HTML überhaupt
              erscheint. Felder bleiben in der DB persistiert auch wenn
              Toggle off — beim Wieder-Aktivieren sind die Werte da. */}
          {getDocConfig(form.typ).isAngebotLike && (
            <Card className={isLocked ? "opacity-80" : ""}>
              <fieldset disabled={isLocked}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Allgemeine Angaben</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Switch
                    id="allgemeine-angaben-aktiv"
                    checked={form.allgemeine_angaben_aktiv}
                    onCheckedChange={(v) => updateField("allgemeine_angaben_aktiv", v)}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="allgemeine-angaben-aktiv" className="cursor-pointer">
                      Allgemeine Angaben auf PDF anzeigen
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Wenn aktiv, erscheint zwischen Betreff und Positionen eine Tabelle
                      mit Leistungsbeschreibung, Ausführungsort, Ausführungszeitraum und
                      ausführender Firma.
                    </p>
                  </div>
                </div>

                {form.allgemeine_angaben_aktiv && (
                  <div className="space-y-3 pt-3 border-t">
                    <div>
                      <Label>Leistungsbeschreibung</Label>
                      <Textarea
                        rows={2}
                        value={form.leistungsbeschreibung}
                        onChange={(e) => updateField("leistungsbeschreibung", e.target.value)}
                        placeholder="z. B. Stiegenrenovierung lt. Besprechung"
                        className="resize-none"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <Label>Ausführungsort</Label>
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={!(form.kunde_adresse || form.kunde_plz || form.kunde_ort)}
                          title="Adresse des Kunden als Ausführungsort einfügen (überschreibt aktuellen Wert)"
                          onClick={() => {
                            const adr = [
                              form.kunde_adresse,
                              [form.kunde_plz, form.kunde_ort].filter(Boolean).join(" "),
                            ].filter(Boolean).join("\n");
                            if (!adr.trim()) { toast({ title: "Kunde hat keine Adresse hinterlegt" }); return; }
                            updateField("ausfuehrungsort", adr);
                            toast({ title: "Kundenadresse übernommen" });
                          }}
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          Kundenadresse übernehmen
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={!form.project_id}
                          title={form.project_id
                            ? "Adresse aus zugeordnetem Projekt einfügen (überschreibt aktuellen Wert)"
                            : "Kein Projekt zugeordnet"}
                          onClick={async () => {
                            if (!form.project_id) return;
                            const { data: projFull } = await (supabase.from("projects" as never) as any)
                              .select("adresse, plz, ort")
                              .eq("id", form.project_id)
                              .maybeSingle();
                            if (!projFull) {
                              toast({ variant: "destructive", title: "Projekt nicht gefunden" });
                              return;
                            }
                            const projAdresse = [
                              (projFull as any).adresse,
                              [(projFull as any).plz, (projFull as any).ort].filter(Boolean).join(" "),
                            ].filter(Boolean).join("\n");
                            if (!projAdresse.trim()) {
                              toast({ title: "Projekt hat keine Adresse hinterlegt" });
                              return;
                            }
                            updateField("ausfuehrungsort", projAdresse);
                            toast({ title: "Adresse aus Projekt übernommen" });
                          }}
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          Aus Projekt übernehmen
                        </Button>
                        </div>
                      </div>
                      <Textarea
                        rows={2}
                        value={form.ausfuehrungsort}
                        onChange={(e) => updateField("ausfuehrungsort", e.target.value)}
                        placeholder="Adresse aus Projekt übernehmen oder manuell eintragen"
                        className="resize-none"
                      />
                    </div>
                    <div>
                      <Label>Ausführungszeitraum</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">Datumsbereich (von – bis)</p>
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              type="date"
                              value={form.leistungsdatum}
                              onChange={(e) => {
                                updateField("leistungsdatum", e.target.value);
                                if (e.target.value) updateField("ausfuehrungs_kw", "");
                              }}
                              placeholder="von"
                              disabled={!!form.ausfuehrungs_kw}
                            />
                            <Input
                              type="date"
                              value={form.leistungsdatum_bis || ""}
                              onChange={(e) => updateField("leistungsdatum_bis", e.target.value)}
                              placeholder="bis (optional)"
                              min={form.leistungsdatum || undefined}
                              disabled={!!form.ausfuehrungs_kw}
                            />
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">oder Kalenderwoche</p>
                          <Input
                            value={form.ausfuehrungs_kw}
                            onChange={(e) => updateField("ausfuehrungs_kw", e.target.value)}
                            placeholder="z. B. KW 19/2026"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Kalenderwoche hat Vorrang im PDF, sobald sie befüllt ist.
                      </p>
                    </div>
                    <div>
                      <Label>Ausführende Firma</Label>
                      <Select
                        value={form.ausfuehrende_firma || "_none"}
                        onValueChange={(v) => updateField("ausfuehrende_firma", v === "_none" ? "" : v)}
                      >
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">— keine Angabe —</SelectItem>
                          {EXECUTING_COMPANIES.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                          <SelectItem value="freitext">Andere Firma (Freitext)</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.ausfuehrende_firma === "freitext" && (
                        <Textarea
                          rows={3}
                          className="mt-2 resize-none"
                          value={form.ausfuehrende_firma_freitext}
                          onChange={(e) => updateField("ausfuehrende_firma_freitext", e.target.value)}
                          placeholder="Firmenname und Adresse mehrzeilig"
                        />
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
              </fieldset>
            </Card>
          )}

          {/* Positionen */}
          <Card className={isLocked ? "opacity-80" : ""}>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Positionen</CardTitle>
                {!isLocked && (
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => setStundenlohnOpen(true)} variant="outline" size="sm" className="gap-1"
                    title="Stundensätze NUR in diesem Dokument ändern — überall, wo sie verwendet werden">
                    <Clock3 className="w-4 h-4" />
                    Stundenlohn anpassen
                  </Button>
                  {form.typ === "rechnung" && (
                    <>
                      <Button onClick={() => setImportOfferOpen(true)} variant="outline" size="sm" className="gap-1">
                        <FileText className="w-4 h-4" />
                        Aus Angebot
                      </Button>
                    </>
                  )}
                  {/* Projektzeiten gehören in die (Schluss-)Rechnung — beim
                      Angebot gibt es noch keine gebuchten Zeiten. */}
                  {["rechnung", "schlussrechnung"].includes(form.typ) && (
                    <Button onClick={() => setImportTimeOpen(true)} variant="outline" size="sm" className="gap-1"
                      title="Gebuchte Zeiten aus dem Projekt als Positionen übernehmen">
                      <FileText className="w-4 h-4" />
                      Projektzeiten importieren
                    </Button>
                  )}
                  <Button onClick={() => setTemplateDialogOpen(true)} variant="outline" size="sm" className="gap-1">
                    <Package className="w-4 h-4" />
                    Aus Katalog
                  </Button>
                  {/* Katalog-Verknüpfung reicht — Komponenten-Positionen haben
                      ist_kalkuliert=false, sollen aber genauso aktualisierbar sein. */}
                  {items.some(it => it.kalkulation_template_id) && (
                    <Button onClick={refreshKalkulationFromCatalog} disabled={kalkRefreshing} variant="outline" size="sm"
                      className={`gap-1 ${staleKalkCount > 0 ? "border-amber-400 text-amber-700" : ""}`}
                      title="Kalkulierte Positionen mit den aktuellen Material-/EK-Preisen aus dem Katalog neu berechnen">
                      <RefreshCw className={`w-4 h-4 ${kalkRefreshing ? "animate-spin" : ""}`} />
                      Preise aktualisieren
                    </Button>
                  )}
                  <Button onClick={addItem} variant="outline" size="sm" className="gap-1">
                    <Plus className="w-4 h-4" />
                    Position
                  </Button>
                </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!isLocked && staleKalkCount > 0 && (
                <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-900 flex-1">
                      Bei <strong>{staleKalkCount}</strong> Position(en) haben sich die Katalogpreise seit dem Erstellen geändert:
                    </p>
                    <Button onClick={refreshKalkulationFromCatalog} disabled={kalkRefreshing} size="sm"
                      className="bg-amber-600 hover:bg-amber-700 gap-1 shrink-0">
                      <RefreshCw className={`w-4 h-4 ${kalkRefreshing ? "animate-spin" : ""}`} />
                      Jetzt aktualisieren
                    </Button>
                  </div>
                  {/* WELCHE Positionen betroffen sind — mit altem und neuem Preis */}
                  <ul className="mt-2 space-y-0.5 pl-6">
                    {staleKalkDetails.slice(0, 6).map(d => (
                      <li key={d.pos} className="text-xs text-amber-900 flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">Pos. {d.pos} · {d.name.length > 60 ? d.name.slice(0, 60) + "…" : d.name}</span>
                        <span className="font-mono tabular-nums">
                          € {d.alt.toFixed(2)} → <b>€ {d.neu.toFixed(2)}</b>
                          <span className={d.neu >= d.alt ? " text-red-700" : " text-green-700"}>
                            {" "}({d.neu >= d.alt ? "+" : ""}{(d.neu - d.alt).toFixed(2)})
                          </span>
                        </span>
                      </li>
                    ))}
                    {staleKalkDetails.length > 6 && (
                      <li className="text-xs text-amber-800">… und {staleKalkDetails.length - 6} weitere</li>
                    )}
                  </ul>
                </div>
              )}
              <fieldset disabled={isLocked}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Pos.</TableHead>
                      <TableHead>Beschreibung</TableHead>
                      <TableHead className="w-28">Menge</TableHead>
                      <TableHead className="w-24">Einheit</TableHead>
                      <TableHead className="w-32">Preis (netto) €</TableHead>
                      <TableHead className="w-20">Rabatt %</TableHead>
                      <TableHead className="w-28 text-right">Gesamt (netto) €</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => {
                      const acQuery = (autocompleteIdx === idx && item.beschreibung.length >= 2) ? item.beschreibung.toLowerCase() : "";
                      const acResults = acQuery ? templates.filter(t => {
                        const kb = ((t as any).kurzbezeichnung || t.name || "").toLowerCase();
                        const pn = ((t as any).produktnummer || "").toLowerCase();
                        const lb = ((t as any).langbezeichnung || t.beschreibung || "").toLowerCase();
                        const pg = ((t as any).produktgruppe || "").toLowerCase();
                        return kb.includes(acQuery) || pn.includes(acQuery) || lb.includes(acQuery) || pg.includes(acQuery);
                      }).slice(0, 20) : [];

                      const isExempt = !!(item as any).mwst_exempt;
                      // Auto-Abzugszeilen (kumulierte AR: negative Menge) wie
                      // exempt-Zeilen sperren — der Mengen-Clamp (min 0) würde
                      // aus -1 sonst irreparabel 0/positiv machen.
                      const istAbzug = Number(item.menge) < 0;
                      const zeileGesperrt = isExempt || istAbzug;
                      return (
                      <TableRow key={idx} className={isExempt ? "bg-rose-50/60 border-l-4 border-l-rose-300" : istAbzug ? "bg-amber-50/50 border-l-4 border-l-amber-300" : ""}>
                        <TableCell className="text-muted-foreground text-xs align-top">
                          <div className="flex items-center gap-1">
                            <span>{idx + 1}</span>
                            {isExempt && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-rose-300 text-rose-700 bg-white">
                                MwSt-frei
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="relative">
                            <Input
                              value={item.beschreibung}
                              onChange={(e) => {
                                updateItem(idx, "beschreibung", e.target.value);
                                updateItem(idx, "kurztext", e.target.value);
                                setAutocompleteIdx(idx);
                              }}
                              onFocus={() => setAutocompleteIdx(idx)}
                              onBlur={() => setTimeout(() => setAutocompleteIdx(null), 200)}
                              placeholder="Kurzbezeichnung"
                              disabled={zeileGesperrt}
                              title={isExempt ? "Automatischer Anzahlungs-Abzug — nicht manuell editierbar. Entferne die Zeile, wenn die Anzahlung nicht abgezogen werden soll." : undefined}
                            />
                            {/* Autocomplete dropdown */}
                            {acResults.length > 0 && (
                              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border rounded-md shadow-lg max-h-72 overflow-y-auto">
                                {acResults.map(t => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex justify-between gap-2"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      // EXAKT dieselbe Preisquelle wie Picker & Stale-Check
                                      // (inkl. Dokument-Aufschlag-Override bei kalkulierten
                                      // Positionen) — sonst liefert das Autocomplete einen
                                      // anderen Preis und die Zeile gilt sofort als "stale".
                                      const netto = expectedEpFromCatalog({ ist_kalkuliert: !!(t as any).ist_kalkuliert }, t);
                                      updateItem(idx, "beschreibung", (t as any).kurzbezeichnung || t.name);
                                      updateItem(idx, "kurztext", (t as any).kurzbezeichnung || t.name);
                                      const lang = (t as any).langbezeichnung || "";
                                      const kurz = (t as any).kurzbezeichnung || t.name || "";
                                      // Langtext nur setzen wenn es eine echte Langbezeichnung gibt und sie sich vom Kurztext unterscheidet
                                      updateItem(idx, "langtext", lang && lang !== kurz ? lang : "");
                                      updateItem(idx, "einheit", t.einheit);
                                      updateItem(idx, "einzelpreis", netto);
                                      updateItem(idx, "katalog_vk", netto); // Stale-Referenz
                                      updateItem(idx, "produktnummer", (t as any).produktnummer || "");
                                      // Katalog-Verknüpfung + Lohnminuten — sonst würde diese Position
                                      // bei "Preise aktualisieren" und im Stundenabgleich NICHT mitziehen
                                      updateItem(idx, "kalkulation_template_id", t.id);
                                      updateItem(idx, "arbeitszeit_minuten", Number((t as any).arbeitszeit_minuten) || 0);
                                      if ((t as any).ist_kalkuliert) {
                                        updateItem(idx, "ist_kalkuliert", true);
                                        updateItem(idx, "ek_preis", Number((t as any).ek_netto) || 0);
                                        updateItem(idx, "verschnitt_prozent", Number((t as any).verschnitt_prozent) || 0);
                                        updateItem(idx, "aufschlag_prozent", Number((t as any).aufschlag_prozent) || 0);
                                        updateItem(idx, "befestigung_preis", Number((t as any).befestigung_preis) || 0);
                                        updateItem(idx, "sonstiges_preis", Number((t as any).sonstiges_preis) || 0);
                                        updateItem(idx, "stundensatz", Number((t as any).stundensatz) || 52);
                                      }
                                      setAutocompleteIdx(null);
                                    }}
                                  >
                                    <span className="truncate">{(t as any).kurzbezeichnung || t.name}</span>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                      {(t as any).produktnummer && <span className="mr-2">{(t as any).produktnummer}</span>}
                                      € {(Number((t as any).vk_netto ?? (t as any).netto_preis) || t.einzelpreis).toFixed(2)}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {(item.produktnummer || item.kalkulation_template_id || istArbeitszeitZeile(item.kurztext || item.beschreibung, item.einheit)) && (
                            <span className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                              {item.produktnummer && <span>Prod.-Nr: {item.produktnummer}</span>}
                              {istArbeitszeitZeile(item.kurztext || item.beschreibung, item.einheit) && (
                                <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 px-1"
                                  title="Arbeitszeit-Position — zählt im Stundenabgleich">
                                  <Clock3 className="w-3 h-3" /> Arbeitszeit
                                </span>
                              )}
                              {item.kalkulation_template_id && (
                                <span className="inline-flex items-center gap-0.5 text-primary/80"
                                  title="Aus dem internen Katalog übernommen — hinterlegte Kalkulation über das Rechner-Symbol einsehbar">
                                  <Link2 className="w-3 h-3" /> Katalog
                                </span>
                              )}
                            </span>
                          )}
                          {(item.langtext || !isLocked) && (
                            <textarea
                              value={item.langtext || ""}
                              onChange={(e) => {
                                updateItem(idx, "langtext", e.target.value);
                                e.target.style.height = "auto";
                                e.target.style.height = e.target.scrollHeight + "px";
                              }}
                              onFocus={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                              placeholder="Langtext / Details (optional, wird auf PDF angezeigt)"
                              className="mt-1 w-full text-xs border rounded px-2 py-1 resize-none bg-muted/30"
                              style={{ minHeight: "28px", height: item.langtext ? "auto" : "28px" }}
                              rows={item.langtext ? Math.max(2, item.langtext.split("\n").length) : 1}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.menge} onChange={(e) => updateItem(idx, "menge", Number(e.target.value))} min={0} step={1} className="text-right h-10 md:h-9" disabled={zeileGesperrt} title="Pfeile zählen in ganzen Schritten; Kommawerte (z.B. 2,5) kannst du direkt eintippen." />
                        </TableCell>
                        <TableCell>
                          <Select value={item.einheit || "Stk."} onValueChange={(v) => updateItem(idx, "einheit", v)} disabled={zeileGesperrt}>
                            <SelectTrigger className="w-[90px] h-10 md:h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {einheiten.map(e => (
                                <SelectItem key={e} value={e}>{e}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.einzelpreis} onChange={(e) => updateItem(idx, "einzelpreis", Number(e.target.value))} step={0.01} className="text-right h-10 md:h-9" disabled={isExempt || !!item.ist_kalkuliert} title={item.ist_kalkuliert ? "Preis wird kalkuliert — über das Rechner-Symbol anpassen" : undefined} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.rabatt_prozent || ""} onChange={(e) => updateItem(idx, "rabatt_prozent", Number(e.target.value))} min={0} max={100} step={0.5} className="text-right h-10 md:h-9" placeholder="0" disabled={zeileGesperrt} />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          € {item.gesamtpreis.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            {/* Kalkulations-Popover NICHT für: gesperrte Belege,
                                MwSt-freie/Abzugszeilen (ein Tastendruck würde den
                                negativen Abzug durch einen positiven Preis ersetzen)
                                und Komponenten-Positionen aus dem Katalog (deren
                                Preis kommt aus den Komponenten, nicht aus der
                                Legacy-Formel). */}
                            {/* Katalog-Positionen: Kalkulation DAHINTER anzeigen
                                (z.B. Baukran = 30 h Facharbeiter + 6 h LKW Hiab) —
                                lesend, mit Wiederherstellen des Snapshot-Preises. */}
                            {item.kalkulation_template_id && !item.ist_kalkuliert && !item.mwst_exempt && (
                              <KatalogKalkulationPopover
                                templateId={item.kalkulation_template_id}
                                snapshot={item.kalkulation_snapshot}
                                position={item.position}
                                currentEp={item.einzelpreis}
                                canRestore={!isLocked && !zeileGesperrt}
                                onRestore={(preis) => {
                                  updateItem(idx, "einzelpreis", preis);
                                  updateItem(idx, "katalog_vk", preis);
                                }}
                              />
                            )}
                            {!isLocked && !zeileGesperrt && (item.ist_kalkuliert || !item.kalkulation_template_id) && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="icon" className={`h-10 w-10 md:h-8 md:w-8 ${item.ist_kalkuliert ? "text-primary" : "text-muted-foreground"}`} title="Kalkulation (EK, Verschnitt, Aufschlag, Lohn)">
                                    <Calculator className="w-4 h-4" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[420px] max-w-[92vw]" align="end">
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-semibold">Kalkulation – Position {item.position}</p>
                                      {item.ist_kalkuliert && (
                                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                                          onClick={() => updateItem(idx, "ist_kalkuliert", false)}>
                                          Kalkulation lösen
                                        </Button>
                                      )}
                                    </div>
                                    <KalkulationFields
                                      einheit={item.einheit}
                                      compact
                                      aufschlagOverride={docAufschlagOverride}
                                      value={{
                                        ek_preis: Number(item.ek_preis) || 0,
                                        verschnitt_prozent: Number(item.verschnitt_prozent) || 0,
                                        aufschlag_prozent: Number(item.aufschlag_prozent) || 0,
                                        befestigung_preis: Number(item.befestigung_preis) || 0,
                                        sonstiges_preis: Number(item.sonstiges_preis) || 0,
                                        arbeitszeit_minuten: Number(item.arbeitszeit_minuten) || 0,
                                        stundensatz: Number(item.stundensatz) || 52,
                                      }}
                                      onChange={(v) => applyItemKalkulation(idx, v)}
                                    />
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                            {!isLocked && (
                              <>
                                <Button variant="ghost" size="icon" className="h-10 w-10 md:h-8 md:w-8" disabled={idx === 0} onClick={() => moveItem(idx, "up")}>
                                  <ChevronUp className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-10 w-10 md:h-8 md:w-8" disabled={idx === items.length - 1} onClick={() => moveItem(idx, "down")}>
                                  <ChevronDown className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {items.length > 1 && !isLocked && (
                              <Button variant="ghost" size="icon" className="h-10 w-10 md:h-8 md:w-8" onClick={() => removeItem(idx)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                    {!isLocked && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-1">
                          <Button onClick={addItem} variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                            <Plus className="w-3.5 h-3.5" />
                            Position hinzufügen
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={6} className="text-right">Positionen Netto</TableCell>
                      <TableCell className="text-right font-medium">€ {positionenNetto.toFixed(2)}</TableCell>
                      <TableCell />
                    </TableRow>
                    {rabattWert > 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-right text-orange-600">
                          Rabatt {form.rabatt_prozent > 0 ? `(${form.rabatt_prozent}%)` : ""}
                        </TableCell>
                        <TableCell className="text-right text-orange-600">- € {rabattWert.toFixed(2)}</TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                    <TableRow>
                      <TableCell colSpan={6} className="text-right">Netto</TableCell>
                      <TableCell className="text-right font-medium">€ {nettoSumme.toFixed(2)}</TableCell>
                      <TableCell />
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={6} className="text-right">MwSt ({form.mwst_satz}%)</TableCell>
                      <TableCell className="text-right">€ {mwstBetrag.toFixed(2)}</TableCell>
                      <TableCell />
                    </TableRow>
                    {/* Kein eigener Anzahlungs-Abzug-Block mehr — der Abzug steht
                        als Position oben (mit AR-Nummer, Datum und USt-Ausweis);
                        hier nur noch "Zu zahlen". */}
                    <TableRow>
                      <TableCell colSpan={6} className="text-right font-bold text-lg">
                        {exemptBrutto < 0 ? "Zu zahlen" : "Brutto"}
                      </TableCell>
                      <TableCell className="text-right font-bold text-lg">€ {bruttoSumme.toFixed(2)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
              </fieldset>
            </CardContent>
          </Card>

          {/* Notizen */}
          <Card className={isLocked ? "opacity-80" : ""}>
            <CardHeader>
              <CardTitle>Notizen</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.notizen}
                onChange={(e) => updateField("notizen", e.target.value)}
                disabled={isLocked}
                placeholder="Zusätzliche Anmerkungen..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Archivierte PDFs */}
          {!isNew && storedPdfs.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Archivierte PDFs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {storedPdfs.map((pdf) => (
                    <div key={pdf.name} className="flex items-center justify-between p-2 rounded-md border">
                      <span className="text-sm font-mono">{pdf.name}</span>
                      <Button variant="ghost" size="sm" onClick={() => handleDownloadStoredPdf(pdf.name)} className="gap-1">
                        <FileDown className="w-4 h-4" />
                        Öffnen
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => navigate("/invoices")}>
              {isLocked ? "Zurück" : "Abbrechen"}
            </Button>
            {canCancel && (
              <Button variant="destructive" onClick={() => setStornoDialogOpen(true)}>Stornieren</Button>
            )}
            {form.status === "storniert" && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={async () => {
                try {
                  const { generateStornoPdf } = await import("@/lib/pdfGenerator");
                  const logoUri = await loadInvoiceLogo();
                  const { data: inv } = await supabase.from("invoices").select("storno_nummer, storno_datum, storno_grund").eq("id", invoiceId).single();
                  if (!inv?.storno_nummer) return;
                  const { data: bankSettings3 } = await supabase.from("app_settings").select("key, value").in("key", ["bank_kontoinhaber", "bank_iban", "bank_bic"]);
                  const bank3 = { kontoinhaber: "", iban: "", bic: "" };
                  bankSettings3?.forEach((s: any) => {
                    if (s.key === "bank_kontoinhaber") bank3.kontoinhaber = s.value;
                    if (s.key === "bank_iban") bank3.iban = s.value;
                    if (s.key === "bank_bic") bank3.bic = s.value;
                  });
                  const blob = generateStornoPdf(
                    { nummer: form.nummer, kunde_name: form.kunde_name, brutto_summe: bruttoSumme, datum: form.datum },
                    inv.storno_nummer, inv.storno_datum || form.datum, inv.storno_grund || "",
                    bank3, logoUri, invoiceLayout
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = `Storno_${inv.storno_nummer}.pdf`; a.click(); URL.revokeObjectURL(url);
                } catch (e) { console.error(e); }
              }}>
                <Download className="w-4 h-4" />
                Storno-Beleg
              </Button>
            )}
            {/* Angebot-Löschen läuft über den canDelete-AlertDialog im Kopfbereich
                (mit Folgedokument-Prüfung). Der frühere zweite Button hier war an
                isLocked && typ==='angebot' gebunden — eine nie erfüllbare Bedingung
                (isLocked gilt nur für Rechnungen) — und wurde entfernt. */}
            {isLocked ? (
              <>
                <Button onClick={handleDownloadPdf} variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  PDF herunterladen
                </Button>
                <Button onClick={handleERechnungDownload} variant="outline" className="gap-2"
                  title="Strukturierte E-Rechnung im österreichischen Standard ebInterface 6.1 (XML) — z.B. für Behörden und Firmenkunden">
                  <FileDown className="w-4 h-4" />
                  E-Rechnung (XML)
                </Button>
                <Button onClick={handlePrintPdf} variant="outline" className="gap-2">
                  <Printer className="w-4 h-4" />
                  Drucken
                </Button>
              </>
            ) : (
              <>
                {!isNew && invoiceId && (
                  <>
                    <Button onClick={handleDownloadPdf} variant="outline" className="gap-2">
                      <Download className="w-4 h-4" />
                      PDF
                    </Button>
                    <Button onClick={handlePrintPdf} variant="outline" className="gap-2">
                      <Printer className="w-4 h-4" />
                      Drucken
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={async () => { const ok = await handleSave(); if (ok) toast({ title: "Gespeichert" }); }} disabled={saving} className="gap-2">
                  {saving ? "Speichert..." : "Speichern"}
                </Button>
                <Button onClick={handlePreview} className="gap-2">
                  <Eye className="w-4 h-4" />
                  Vorschau
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Template Picker Dialog — Suche + Filter + Multi-Select */}
        <Dialog open={templateDialogOpen} onOpenChange={(open) => {
          setTemplateDialogOpen(open);
          if (!open) setTemplateSearch("");
          if (!open) setTemplateFilter("alle");
          if (!open) setSelectedTemplateIds([]);
          if (!open) setAddedFromDialog([]);
          if (!open) setTemplateMengen({});
          if (!open) setExpandedCatalog(new Set());
        }}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Positionen & Materialien aus dem Katalog einfügen</DialogTitle>
            </DialogHeader>
            <div className="flex gap-3 mb-3 flex-wrap">
              <Input
                placeholder="Suchen..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="flex-1 min-w-[160px]"
              />
              {/* Positionen (kalkulierte Leistungen) vs. Materialien (EK-Liste) */}
              <div className="flex rounded-md border overflow-hidden">
                {([["position", "Positionen"], ["material", "Materialien"], ["arbeitszeit", "Arbeitszeiten"], ["alle", "Alle"]] as const).map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTemplateArtFilter(val)}
                    className={`px-3 py-1.5 text-sm transition-colors ${templateArtFilter === val ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <Select value={templateFilter} onValueChange={setTemplateFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Alle Gruppen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Gruppen</SelectItem>
                  {Object.keys(groupedTemplates).sort().map(k => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-y-auto flex-1 space-y-1 border rounded-md p-2">
              {(() => {
                const s = templateSearch.toLowerCase();
                const filtered = templates.filter(t => {
                  const matchSearch = !s || t.name.toLowerCase().includes(s) || (t.beschreibung && t.beschreibung.toLowerCase().includes(s)) || ((t as any).kurzbezeichnung && (t as any).kurzbezeichnung.toLowerCase().includes(s));
                  const matchFilter = templateFilter === "alle" || t.kategorie === templateFilter;
                  const istArbeitszeit = (t as any).art === "material" && (t as any).ist_stundensatz === true;
                  const tArt = istArbeitszeit ? "arbeitszeit" : ((t as any).art === "material" ? "material" : "position");
                  const matchArt = templateArtFilter === "alle" || tArt === templateArtFilter;
                  return matchSearch && matchFilter && matchArt;
                });
                if (filtered.length === 0) return <p className="text-center text-muted-foreground py-8">Keine Einträge gefunden</p>;

                const favoriten = filtered.filter(t => t.ist_favorit);
                const restliche = filtered.filter(t => !t.ist_favorit);

                const toggleFavorit = async (e: React.MouseEvent, templateId: string) => {
                  e.stopPropagation();
                  const tmpl = templates.find(t => t.id === templateId);
                  if (!tmpl) return;
                  const newVal = !tmpl.ist_favorit;
                  await supabase.from("invoice_templates").update({ ist_favorit: newVal } as any).eq("id", templateId);
                  setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, ist_favorit: newVal } : t));
                };

                // EK-Lookup für verknüpfte Material-Komponenten (Live-Preis)
                const catalogEkLookup: Record<string, number> = {};
                for (const cs of Object.values(catalogComponents))
                  for (const c of cs)
                    if (c.material_template_id && c.liveEk != null) catalogEkLookup[c.material_template_id] = c.liveEk;

                const renderItem = (t: TemplateItem) => {
                  const isSelected = selectedTemplateIds.includes(t.id);
                  const netto = Number((t as any).netto_preis) || t.einzelpreis;
                  const comps = catalogComponents[t.id];
                  const hatKomp = !!comps && comps.length > 0;
                  const expanded = expandedCatalog.has(t.id);
                  const toggleSelect = () => {
                    setSelectedTemplateIds(prev => isSelected ? prev.filter(id => id !== t.id) : [...prev, t.id]);
                    if (!isSelected) setTemplateMengen(prev => ({ ...prev, [t.id]: 1 }));
                  };
                  return (
                    <div key={t.id}>
                      <div className={`flex items-center gap-2 p-2 rounded hover:bg-accent text-sm ${isSelected ? "bg-primary/10" : ""}`}>
                        <button onClick={(e) => toggleFavorit(e, t.id)} className="shrink-0 p-0.5 hover:scale-110 transition-transform" title={t.ist_favorit ? "Favorit entfernen" : "Als Favorit markieren"}>
                          <Star className={`w-3.5 h-3.5 ${t.ist_favorit ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40 hover:text-yellow-400"}`} />
                        </button>
                        <input type="checkbox" checked={isSelected} onChange={toggleSelect} className="rounded cursor-pointer" />
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={toggleSelect}>
                          <p className="font-medium truncate">{(t as any).kurzbezeichnung || t.name}</p>
                          {(t as any).langbezeichnung && <p className="text-xs text-muted-foreground truncate">{(t as any).langbezeichnung}</p>}
                        </div>
                        {/* Kalkulation dahinter ein-/ausklappen */}
                        {hatKomp && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedCatalog(prev => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; });
                            }}
                            className={`shrink-0 flex items-center gap-0.5 rounded px-1 py-0.5 text-xs transition-colors ${expanded ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-primary hover:bg-muted"}`}
                            title="Kalkulation dahinter anzeigen"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                        {isSelected && (
                          <Input
                            type="number"
                            value={templateMengen[t.id] || 1}
                            onChange={(e) => { e.stopPropagation(); setTemplateMengen(prev => ({ ...prev, [t.id]: Number(e.target.value) || 1 })); }}
                            onClick={(e) => e.stopPropagation()}
                            min={0} step={1}
                            className="w-16 text-right text-xs h-7"
                            title="Pfeile zählen in ganzen Schritten; Kommawerte direkt eintippen."
                          />
                        )}
                        <span className="text-xs text-muted-foreground shrink-0 w-12 text-center">{t.einheit}</span>
                        <span className="text-sm font-mono shrink-0 w-20 text-right">{netto > 0 ? `€ ${netto.toFixed(2)}` : "–"}</span>
                      </div>
                      {/* Aufgeklappte Kalkulation: Komponenten + Formel + Einzelpreis */}
                      {expanded && hatKomp && (
                        <div className="ml-9 mr-2 mb-1.5 rounded-md border bg-muted/20 overflow-x-auto">
                          <table className="w-full text-xs">
                            <tbody>
                              {comps!.map((c, i) => {
                                const ek = c.material_template_id ? (c.liveEk ?? undefined) : undefined;
                                const betrag = calcComponentZeile(c, ek);
                                return (
                                  <tr key={i} className="text-muted-foreground">
                                    <td className="px-2 py-1 whitespace-nowrap">
                                      {c.typ === "lohn" ? "⏱ " : c.typ === "sonstiges" ? "＋ " : "▪ "}{c.bezeichnung}
                                    </td>
                                    <td className="px-2 py-1 text-right whitespace-nowrap">{componentFormula(c, ek)}</td>
                                    <td className="px-2 py-1 text-right font-mono text-foreground whitespace-nowrap">€ {betrag.toFixed(2)}</td>
                                  </tr>
                                );
                              })}
                              <tr className="border-t font-medium bg-background/50">
                                <td className="px-2 py-1" colSpan={2}>Einzelpreis / {t.einheit}</td>
                                <td className="px-2 py-1 text-right font-mono text-primary whitespace-nowrap">
                                  € {calcPositionPreis(comps!, catalogEkLookup).einzelpreis.toFixed(2)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                };

                // Übersichtlich wie in der Excel: nach Kategorie gruppiert, mit
                // Überschriften. Favoriten stehen zuoberst.
                const byKat: Record<string, TemplateItem[]> = {};
                for (const t of restliche) {
                  const k = t.kategorie || "Allgemein";
                  (byKat[k] = byKat[k] || []).push(t);
                }
                const katGruppen = Object.entries(byKat).sort(([a], [b]) => a.localeCompare(b));
                return (
                  <>
                    {favoriten.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-1">⭐ Häufig verwendet</p>
                        {favoriten.map(renderItem)}
                        {restliche.length > 0 && <hr className="my-2 border-border" />}
                      </>
                    )}
                    {katGruppen.map(([kat, items]) => (
                      <div key={kat}>
                        <p className="text-xs font-semibold text-foreground bg-muted/70 rounded px-2 py-1 mt-1 sticky top-0 z-10 backdrop-blur">
                          {kat} <span className="text-muted-foreground font-normal">({items.length})</span>
                        </p>
                        {items.map(renderItem)}
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
            {addedFromDialog.length > 0 && (
              <div className="border-t pt-2 mt-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Bereits hinzugefügt ({addedFromDialog.length}):</p>
                <div className="flex flex-wrap gap-1.5">
                  {addedFromDialog.map((a, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-0.5">
                      {a.menge > 1 ? `${a.menge} ${a.einheit}` : ""} {a.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-between items-center pt-2">
              <span className="text-sm text-muted-foreground">{selectedTemplateIds.length} ausgewählt</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Abbrechen</Button>
                <Button disabled={selectedTemplateIds.length === 0} onClick={() => {
                  const selected = templates.filter(t => selectedTemplateIds.includes(t.id));
                  const newItems = selected.map(t => {
                    const menge = templateMengen[t.id] || 1;
                    // Kalkulierte Materialien: Snapshot + Katalog-Verknüpfung übernehmen,
                    // damit Aufschläge im Angebot anpassbar bleiben und "Preise aktualisieren" greift.
                    const isKalk = !!(t as any).ist_kalkuliert;
                    const kalk = isKalk ? {
                      ek_preis: Number((t as any).ek_netto) || 0,
                      verschnitt_prozent: Number((t as any).verschnitt_prozent) || 0,
                      aufschlag_prozent: Number((t as any).aufschlag_prozent) || 0,
                      befestigung_preis: Number((t as any).befestigung_preis) || 0,
                      sonstiges_preis: Number((t as any).sonstiges_preis) || 0,
                      arbeitszeit_minuten: Number((t as any).arbeitszeit_minuten) || 0,
                      stundensatz: Number((t as any).stundensatz) || 52,
                    } : null;
                    const netto = kalk
                      ? calcEinzelpreis({ ...kalk, aufschlag_prozent: docAufschlagOverride ?? kalk.aufschlag_prozent })
                      : (Number((t as any).vk_netto ?? (t as any).netto_preis) || t.einzelpreis);
                    // Langtext nur wenn er sich vom Kurztext unterscheidet —
                    // sonst steht derselbe Text doppelt auf dem PDF.
                    const _kurz = (t as any).kurzbezeichnung || t.name || "";
                    const _lang = (t as any).langbezeichnung || t.beschreibung || "";
                    return {
                      position: 1,
                      beschreibung: (t as any).kurzbezeichnung || t.name || t.beschreibung,
                      kurztext: (t as any).kurzbezeichnung || t.name,
                      langtext: _lang && _lang !== _kurz ? _lang : "",
                      menge,
                      einheit: t.einheit,
                      einzelpreis: netto,
                      katalog_vk: netto, // Snapshot: Katalogpreis beim Einfügen
                      gesamtpreis: Math.round(netto * menge * 100) / 100,
                      produktnummer: (t as any).produktnummer || "",
                      ist_kalkuliert: isKalk,
                      // Katalog-Verknüpfung IMMER mitnehmen — auch Komponenten-
                      // Positionen und Materialien folgen so "Preise aktualisieren".
                      kalkulation_template_id: t.id,
                      // Lohnminuten/EH für den Stundenabgleich (bei Komponenten-
                      // Positionen aus der Komponenten-Summe im Katalog).
                      arbeitszeit_minuten: Number((t as any).arbeitszeit_minuten) || 0,
                      ...(kalk || {}),
                    } as InvoiceItem;
                  });
                  setItems(prev => mergeItems(prev, newItems));
                  // Track was hinzugefügt wurde
                  setAddedFromDialog(prev => [...prev, ...newItems.map(i => ({ name: i.beschreibung, menge: i.menge, einheit: i.einheit }))]);
                  // Dialog bleibt offen — nur Auswahl zurücksetzen
                  setSelectedTemplateIds([]);
                  setTemplateMengen({});
                  toast({ title: `${newItems.length} Positionen hinzugefügt` });
                }} className="gap-2">
                  <Plus className="w-4 h-4" />
                  {selectedTemplateIds.length > 0 ? `${selectedTemplateIds.length} hinzufügen` : "Hinzufügen"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* PDF Preview Dialog — works both before and after saving */}
        <InvoicePdfPreview
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          onSave={handleSaveFromPreview}
          onSavedClose={() => navigate("/invoices")}
          saving={saving}
          saved={previewSaved}
          fileName={form.nummer || (form.typ === "angebot" ? "Angebot" : "Rechnung")}
          formData={{
            typ: form.typ,
            nummer: form.nummer,
            status: form.status,
            kunde_name: form.kunde_name,
            kunde_adresse: form.kunde_adresse,
            kunde_plz: form.kunde_plz,
            kunde_ort: form.kunde_ort,
            kunde_land: form.kunde_land,
            kunde_email: form.kunde_email,
            kunde_telefon: form.kunde_telefon,
            kunde_uid: form.kunde_uid,
            kunde_anrede: (form as any).kunde_anrede || "",
            kunde_titel: (form as any).kunde_titel || "",
            reverse_charge: (form as any).reverse_charge || false,
            datum: form.datum,
            faellig_am: form.faellig_am,
            leistungsdatum: form.leistungsdatum,
            leistungsdatum_bis: (form as any).leistungsdatum_bis || "",
            gueltig_bis: form.gueltig_bis,
            zahlungsbedingungen: form.zahlungsbedingungen,
            notizen: form.notizen,
            betreff: form.betreff,
            netto_summe: nettoSumme,
            mwst_satz: form.mwst_satz,
            mwst_betrag: mwstBetrag,
            brutto_summe: bruttoSumme,
            bezahlt_betrag: form.bezahlt_betrag,
            rabatt_prozent: form.rabatt_prozent,
            rabatt_betrag: form.rabatt_betrag,
            mahnstufe: form.mahnstufe,
            skonto_prozent: form.skonto_prozent,
            skonto_tage: form.skonto_tage,
            // Ohne diese Felder sieht die PDF-Vorschau weder den eingegebenen
            // Kunden-Ansprechpartner noch die Kundennummer / Anzahlungs-Prozent.
            // Eigene Typdeklaration von InvoiceHtmlData kennt sie nicht; wir
            // reichen sie als loose Props durch (pdfGenerator liest sie via
            // (invoice as any).ansprechpartner_*).
            kundennummer: (form as any).kundennummer || "",
            ansprechpartner_employee_id: (form as any).ansprechpartner_employee_id || null,
            ansprechpartner_name: (form as any).ansprechpartner_name || "",
            ansprechpartner_telefon: (form as any).ansprechpartner_telefon || "",
            ansprechpartner_email: (form as any).ansprechpartner_email || "",
            anzahlung_prozent: (form as any).anzahlung_prozent ?? null,
            anzahlung_betrag: (form as any).anzahlung_betrag ?? null,
            // Allgemeine Angaben (Angebot + AB) — Toggle + Felder müssen
            // an die Vorschau durchgereicht werden, sonst rendert die
            // Tabelle dort nicht (Renderer prüft auf allgemeine_angaben_aktiv).
            allgemeine_angaben_aktiv: !!(form as any).allgemeine_angaben_aktiv,
            leistungsbeschreibung: (form as any).leistungsbeschreibung || "",
            ausfuehrungsort: (form as any).ausfuehrungsort || "",
            ausfuehrungs_kw: (form as any).ausfuehrungs_kw || "",
            ausfuehrende_firma: (form as any).ausfuehrende_firma || "",
            ausfuehrende_firma_freitext: (form as any).ausfuehrende_firma_freitext || "",
            // Bezugs-Block bei verknüpften Gutschriften — wird sonst
            // in der Vorschau nicht gerendert (Renderer prüft auf
            // _parent_nummer/_parent_datum).
            _parent_nummer: parentRefInfo?.nummer || "",
            _parent_datum: parentRefInfo?.datum || "",
          } as any}
          items={items.map((item, idx) => ({
            position: idx + 1,
            beschreibung: item.beschreibung,
            kurztext: item.kurztext || item.beschreibung,
            langtext: item.langtext || "",
            menge: item.menge,
            einheit: item.einheit,
            einzelpreis: item.einzelpreis,
            rabatt_prozent: Number((item as any).rabatt_prozent) || 0,
            gesamtpreis: item.gesamtpreis,
            mwst_exempt: !!(item as any).mwst_exempt,
          }))}
        />

        {/* Gutschrift-Verrechnungs-Dialog: setzt Status auf "verrechnet"
            und verknüpft optional mit einer offenen Rechnung. */}
        <Dialog open={verrechnungDialogOpen} onOpenChange={setVerrechnungDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Gutschrift als verrechnet markieren</DialogTitle>
              <DialogDescription>
                Bestätigt, dass die Gutschrift {form.nummer} ausgezahlt oder mit einer Rechnung verrechnet wurde.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="verrechnung-datum">Verrechnungs-Datum</Label>
                <Input
                  id="verrechnung-datum"
                  type="date"
                  value={verrechnungDate}
                  onChange={(e) => setVerrechnungDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="verrechnung-ziel">Mit Rechnung verrechnen (optional)</Label>
                <Select value={verrechnungZielInvoice} onValueChange={setVerrechnungZielInvoice}>
                  <SelectTrigger id="verrechnung-ziel">
                    <SelectValue placeholder="Auszahlung ohne Verknüpfung" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Auszahlung (keine Rechnungs-Verknüpfung) —</SelectItem>
                    {verrechnungZielOptions.map((o) => {
                      const rest = Math.max(0, o.brutto_summe - o.bezahlt_betrag);
                      return (
                        <SelectItem key={o.id} value={o.id}>
                          {o.nummer} — offen: €&nbsp;{rest.toFixed(2)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {verrechnungZielInvoice !== "_none" && (
                  <p className="text-[11px] text-muted-foreground">
                    Der Gutschrift-Betrag wird automatisch dem bezahlten Betrag der Rechnung gutgeschrieben (gedeckelt auf den Restbetrag).
                  </p>
                )}
                {form.customer_id && verrechnungZielOptions.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Keine offenen Rechnungen für diesen Kunden — wähle „Auszahlung" oder lasse das Feld leer.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVerrechnungDialogOpen(false)} disabled={verrechnungSaving}>
                Abbrechen
              </Button>
              <Button onClick={handleVerrechnungSave} disabled={verrechnungSaving || !verrechnungDate}>
                {verrechnungSaving ? "Speichert..." : "Verrechnen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Materials Dialog */}
        <ImportMaterialsDialog
          open={importMaterialsOpen}
          onClose={() => setImportMaterialsOpen(false)}
          projectId={form.project_id}
          onImport={(importedItems) => {
            const newItems = importedItems.map((item, idx) => ({
              position: items.length + idx + 1,
              beschreibung: item.beschreibung,
              menge: item.menge,
              einheit: item.einheit,
              einzelpreis: item.einzelpreis,
              gesamtpreis: item.menge * item.einzelpreis,
            }));
            setItems(prev => mergeItems(prev, newItems));
            setImportMaterialsOpen(false);
            toast({ title: "Materialien importiert", description: `${newItems.length} Positionen hinzugefügt` });
          }}
        />

        {/* Import Disturbance Dialog */}

        {/* Import Time Dialog */}
        {/* Arbeitszeit-Import läuft ausschließlich über <ImportFromProjectDialog
            mode="zeit"/> (weiter unten). Der frühere zweite ImportTimeDialog war
            an dieselbe Variable gebunden und öffnete sich doppelt — entfernt. */}

        {/* Kunden-Bearbeiten Dialog */}
        <CustomerEditDialog
          open={customerEditOpen}
          onClose={() => setCustomerEditOpen(false)}
          customerId={form.customer_id}
          onSaved={(cust) => {
            // Aktualisierte Kundendaten in die Rechnung/Angebot übernehmen
            setForm(prev => ({
              ...prev,
              kunde_name: cust.name,
              kunde_anrede: cust.anrede || "",
              kunde_titel: cust.titel || "",
              kunde_adresse: cust.adresse || "",
              kunde_plz: cust.plz || "",
              kunde_ort: cust.ort || "",
              kunde_land: cust.land || "Österreich",
              kunde_email: cust.email || "",
              kunde_telefon: cust.telefon || "",
              kunde_uid: cust.uid_nummer || "",
              kundennummer: cust.kundennummer || "",
            } as any));
          }}
        />

        {/* Import from Regiebericht Dialog */}
        <ImportDisturbanceToInvoiceDialog
          open={importRegieOpen}
          onClose={() => setImportRegieOpen(false)}
          preselectedId={searchParams.get("disturbance_id")}
          onImport={(importedItems, kundeData, disturbanceId) => {
            const newItems = importedItems.map((item, idx) => ({
              position: items.length + idx + 1,
              beschreibung: item.beschreibung,
              menge: item.menge,
              einheit: item.einheit,
              einzelpreis: item.einzelpreis,
              gesamtpreis: item.menge * item.einzelpreis,
            }));
            setItems(prev => mergeItems(prev, newItems));
            // Regiebericht als verrechnet markieren — verhindert, dass dieselben
            // Regiestunden versehentlich ein zweites Mal auf eine Rechnung wandern.
            if (disturbanceId) {
              supabase.from("disturbances").update({ is_verrechnet: true } as any).eq("id", disturbanceId)
                .then(({ error }) => { if (error) console.warn("is_verrechnet setzen fehlgeschlagen:", error.message); });
            }
            if (kundeData && !form.kunde_name) {
              setForm(prev => ({
                ...prev,
                kunde_name: (kundeData as any).kunde_name || prev.kunde_name,
                kunde_adresse: (kundeData as any).kunde_adresse || prev.kunde_adresse,
                kunde_plz: (kundeData as any).kunde_plz || prev.kunde_plz,
                kunde_ort: (kundeData as any).kunde_ort || prev.kunde_ort,
                kunde_land: (kundeData as any).kunde_land || prev.kunde_land,
                kunde_email: (kundeData as any).kunde_email || prev.kunde_email,
                kunde_telefon: (kundeData as any).kunde_telefon || prev.kunde_telefon,
                kunde_uid: (kundeData as any).kunde_uid || prev.kunde_uid,
                customer_id: (kundeData as any).customer_id || prev.customer_id,
              }));
            }
            setImportRegieOpen(false);
            toast({ title: "Aus Regiebericht importiert", description: `${newItems.length} Positionen hinzugefügt` });
          }}
        />

        {/* Anzahlungsrechnung-Dialog: Prozent ODER fester Betrag */}
        <Dialog open={anzahlungDialogOpen} onOpenChange={setAnzahlungDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Anzahlungsrechnung erstellen</DialogTitle>
            </DialogHeader>
            {(() => {
              // Bei "AR aus AR" ist die Basis der Wurzel-Auftrag, nicht das Delta
              const basisNetto = anzahlungBasisNetto ?? nettoSumme;
              const basisBrutto = basisNetto * (1 + (form.mwst_satz / 100));
              const restNetto = Math.max(0, basisNetto - bestehendeAnzahlungenNetto);
              const prozentNum = Number(anzahlungProzentInput);
              const betragNum = Number(anzahlungBetragInput);
              const anzNetto = anzahlungMode === "prozent"
                ? (isNaN(prozentNum) ? 0 : basisNetto * prozentNum / 100)
                : (isNaN(betragNum) ? 0 : betragNum);
              const anzBrutto = anzNetto * (1 + (form.mwst_satz / 100));
              // Neue Anzahlung darf den noch offenen Rest (basisNetto abzüglich
              // bereits ausgestellter Anzahlungen) nicht überschreiten.
              const valid = anzNetto > 0 && anzNetto <= restNetto + 0.01;
              return (
                <>
                  <div className="space-y-4 py-2">
                    <div className="rounded border bg-muted/40 p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gesamtbetrag (Basis):</span>
                        <span className="font-mono font-medium">€ {basisNetto.toFixed(2)} netto</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                        <span>inkl. {form.mwst_satz}% MwSt.:</span>
                        <span className="font-mono">€ {basisBrutto.toFixed(2)} brutto</span>
                      </div>
                      {bestehendeAnzahlungenNetto > 0 && (
                        <>
                          <div className="flex justify-between text-xs text-orange-600 mt-1 pt-1 border-t">
                            <span>bereits angezahlt (netto):</span>
                            <span className="font-mono">- € {bestehendeAnzahlungenNetto.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs font-medium mt-0.5">
                            <span>Rest verfügbar (netto):</span>
                            <span className="font-mono">€ {restNetto.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Prozentsatz</Label>
                        <div className="flex items-center gap-1 mt-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step="0.1"
                            value={anzahlungProzentInput}
                            onChange={(e) => {
                              const v = e.target.value;
                              setAnzahlungProzentInput(v);
                              setAnzahlungMode("prozent");
                              const p = Number(v);
                              if (!isNaN(p) && basisNetto > 0) {
                                setAnzahlungBetragInput((basisNetto * p / 100).toFixed(2));
                              }
                            }}
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                      <div>
                        <Label>Fester Betrag (netto)</Label>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-sm text-muted-foreground">€</span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={anzahlungBetragInput}
                            onChange={(e) => {
                              const v = e.target.value;
                              setAnzahlungBetragInput(v);
                              setAnzahlungMode("betrag");
                              const b = Number(v);
                              if (!isNaN(b) && basisNetto > 0) {
                                setAnzahlungProzentInput(((b / basisNetto) * 100).toFixed(2));
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded border border-primary/30 bg-primary/5 p-3 text-sm">
                      <div className="flex justify-between font-medium">
                        <span>Anzahlung:</span>
                        <span className="font-mono">€ {anzNetto.toFixed(2)} netto</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                        <span>inkl. {form.mwst_satz}% MwSt.:</span>
                        <span className="font-mono">€ {anzBrutto.toFixed(2)} brutto</span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Bei der Schlussrechnung wird diese Anzahlung automatisch als Abzug berücksichtigt.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAnzahlungDialogOpen(false)}>Abbrechen</Button>
                    <Button
                      disabled={!valid}
                      onClick={() => {
                        if (!valid) {
                          toast({ variant: "destructive", title: "Ungültiger Anzahlungsbetrag", description: `Der Betrag muss > 0 und ≤ dem noch offenen Rest (€ ${restNetto.toFixed(2)}) sein.` });
                          return;
                        }
                        setAnzahlungDialogOpen(false);
                        // Kumulierte Folge-AR: bisherige ARs als Abzugszeilen +
                        // Konvertierung immer von der Auftrags-Wurzel aus.
                        const extra = {
                          ...(anzahlungAbzugIds.length > 0 ? { abzug_ids: anzahlungAbzugIds } : {}),
                          ...(anzahlungRootId ? { from_doc_id: anzahlungRootId } : {}),
                        };
                        if (anzahlungMode === "betrag") {
                          handleConvertTo("anzahlungsrechnung", { anzahlung_betrag: Math.round(anzNetto * 100) / 100, ...extra });
                        } else {
                          handleConvertTo("anzahlungsrechnung", { anzahlung_prozent: Number(anzahlungProzentInput), ...extra });
                        }
                      }}
                    >
                      Anzahlungsrechnung erstellen
                    </Button>
                  </DialogFooter>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Import from Offer Dialog */}
        <ImportFromOfferDialog
          open={importOfferOpen}
          onClose={() => setImportOfferOpen(false)}
          projectId={form.project_id}
          onImport={(importedItems, offer) => {
            // ALLE Positionsdaten übernehmen (Rabatt, Lang-/Kurztext,
            // MwSt-Befreiung, Produktnummer) — nicht nur Menge×Preis.
            const newItems = importedItems.map((item: any, idx) => ({
              position: items.length + idx + 1,
              beschreibung: item.beschreibung,
              kurztext: item.kurztext || item.beschreibung,
              langtext: item.langtext || "",
              menge: item.menge,
              einheit: item.einheit,
              einzelpreis: item.einzelpreis,
              rabatt_prozent: item.rabatt_prozent || 0,
              gesamtpreis: item.gesamtpreis ?? (item.menge * item.einzelpreis),
              produktnummer: item.produktnummer || "",
              mwst_exempt: !!item.mwst_exempt,
            }));
            setItems(prev => mergeItems(prev, newItems));
            // Quell-Angebot verknüpfen → wird beim Speichern als Rechnung auf
            // "verrechnet" gesetzt. Parent nur setzen, wenn noch keiner da ist
            // (kein Überschreiben bei Import aus mehreren Quellen).
            setFromAngebotId(offer.id);
            setForm(prev => ({
              ...prev,
              parent_invoice_id: (prev as any).parent_invoice_id || offer.id,
              ...(!prev.kunde_name ? {
                kunde_name: (offer as any).kunde_name || prev.kunde_name,
                kunde_adresse: (offer as any).kunde_adresse || prev.kunde_adresse,
                kunde_plz: (offer as any).kunde_plz || prev.kunde_plz,
                kunde_ort: (offer as any).kunde_ort || prev.kunde_ort,
                kunde_land: (offer as any).kunde_land || prev.kunde_land,
                kunde_email: (offer as any).kunde_email || prev.kunde_email,
                kunde_telefon: (offer as any).kunde_telefon || prev.kunde_telefon,
                kunde_uid: (offer as any).kunde_uid || prev.kunde_uid,
                customer_id: (offer as any).customer_id || prev.customer_id,
              } : {}),
            }));
            setImportOfferOpen(false);
            toast({ title: "Aus Angebot importiert", description: `${newItems.length} Positionen hinzugefügt` });
          }}
        />

        {/* Stundenlohn nur für dieses Dokument anpassen */}
        <StundenlohnAnpassenDialog
          open={stundenlohnOpen}
          onClose={() => setStundenlohnOpen(false)}
          items={items as any}
          onApply={handleStundenlohnApply}
        />

        {/* Import Arbeitszeiten aus Projekt */}
        <ImportFromProjectDialog
          open={importTimeOpen}
          onClose={() => setImportTimeOpen(false)}
          projectId={form.project_id || null}
          customerId={form.customer_id || null}
          mode="zeit"
          stundensaetze={stundensaetze}
          onImport={(importedItems) => {
            const newItems = importedItems.map((item, idx) => ({
              position: items.length + idx + 1,
              beschreibung: item.beschreibung,
              menge: item.menge,
              einheit: item.einheit,
              einzelpreis: item.einzelpreis,
              gesamtpreis: item.menge * item.einzelpreis,
            }));
            setItems(prev => mergeItems(prev, newItems));
            // Importierte Regieberichte als verrechnet markieren — verhindert,
            // dass dieselben Regiestunden ein zweites Mal fakturiert werden.
            const regieIds = [...new Set(importedItems.map(i => (i as any).disturbanceId).filter(Boolean))] as string[];
            if (regieIds.length > 0) {
              supabase.from("disturbances").update({ is_verrechnet: true } as any).in("id", regieIds)
                .then(({ error }) => { if (error) console.warn("is_verrechnet setzen fehlgeschlagen:", error.message); });
            }
            setImportTimeOpen(false);
            toast({
              title: "Projektzeiten importiert",
              description: `${newItems.length} Position${newItems.length === 1 ? "" : "en"} hinzugefügt${regieIds.length > 0 ? ` · ${regieIds.length} Regiebericht${regieIds.length === 1 ? "" : "e"} als verrechnet markiert` : ""}`,
            });
          }}
        />

        {/* Storno Dialog */}
        <Dialog open={stornoDialogOpen} onOpenChange={setStornoDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{typLabel} stornieren</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {typLabel} {form.nummer} wird unwiderruflich storniert. Eine Storno-Bestätigung wird erstellt.
            </p>
            <div>
              <Label>Storno-Grund *</Label>
              <Textarea
                value={stornoGrund}
                onChange={(e) => setStornoGrund(e.target.value)}
                placeholder="z.B. Fehlerhafte Rechnung, Kundenreklamation, doppelt erstellt..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStornoDialogOpen(false)}>Abbrechen</Button>
              <Button variant="destructive" disabled={!stornoGrund.trim()} onClick={async () => {
                // Guard: bereits storniert
                if (form.status === "storniert") {
                  toast({ variant: "destructive", title: "Bereits storniert", description: "Diese Rechnung wurde bereits storniert." });
                  setStornoDialogOpen(false);
                  return;
                }

                // Warnung wenn bereits bezahlt
                if (form.bezahlt_betrag > 0) {
                  const ok = window.confirm(
                    `⚠️ Achtung: Diese Rechnung hat bereits Zahlungen (€ ${form.bezahlt_betrag.toFixed(2)}).\n\n` +
                    `Beim Stornieren wird der Bezahlt-Betrag NICHT zurückgesetzt. ` +
                    `Bitte vorab mit der Buchhaltung klären und ggf. eine Rückzahlung dokumentieren.\n\n` +
                    `Trotzdem fortfahren?`
                  );
                  if (!ok) return;
                }

                const year = form.jahr || new Date().getFullYear();

                // Atomare Storno-Nummer-Generierung via DB-Funktion (race-safe)
                const { data: stornoNummer, error: numErr } = await supabase.rpc("next_storno_nummer" as any, { p_jahr: year });
                if (numErr || !stornoNummer) {
                  toast({ variant: "destructive", title: "Fehler", description: "Storno-Nummer konnte nicht generiert werden: " + (numErr?.message || "unbekannt") });
                  return;
                }

                const stornoDatum = new Date().toISOString().split("T")[0];

                // Verrechnete Gutschrift stornieren → gebuchten Betrag auf der
                // Ziel-Rechnung zurückrollen (sonst bleibt sie fälschlich als
                // bezahlt markiert, obwohl die Gutschrift weg ist).
                if (form.typ === "gutschrift" && form.status === "verrechnet" && form.verrechnet_mit_invoice_id) {
                  try {
                    const { data: targetInv } = await supabase
                      .from("invoices").select("brutto_summe, bezahlt_betrag, status")
                      .eq("id", form.verrechnet_mit_invoice_id).maybeSingle();
                    if (targetInv) {
                      const gutschriftBrutto = Math.abs(Number(bruttoSumme) || 0);
                      const altBezahlt = Number((targetInv as any).bezahlt_betrag) || 0;
                      // Echte Zahlungen (invoice_payments) als Untergrenze —
                      // der Rollback darf nur den angerechneten GS-Anteil entfernen.
                      const { data: pays } = await supabase
                        .from("invoice_payments").select("betrag")
                        .eq("invoice_id", form.verrechnet_mit_invoice_id);
                      const paymentsSum = Math.round(((pays as any[]) || []).reduce((s, p) => s + (Number(p.betrag) || 0), 0) * 100) / 100;
                      const neuBezahlt = Math.max(paymentsSum, Math.max(0, Math.round((altBezahlt - gutschriftBrutto) * 100) / 100));
                      const targetBrutto = Number((targetInv as any).brutto_summe) || 0;
                      const altStatus = (targetInv as any).status;
                      const neuStatus = altStatus === "storniert" ? "storniert"
                        : neuBezahlt <= 0 ? "offen"
                        : neuBezahlt >= Math.round(targetBrutto * 100) / 100 ? "bezahlt" : "teilbezahlt";
                      await supabase.from("invoices")
                        .update({ bezahlt_betrag: neuBezahlt, status: neuStatus })
                        .eq("id", form.verrechnet_mit_invoice_id);
                    }
                  } catch (rollbackErr) {
                    console.error("Rollback der Gutschrift-Verrechnung fehlgeschlagen:", rollbackErr);
                    toast({ variant: "destructive", title: "Rollback-Warnung", description: "Verrechnung auf der Quell-Rechnung konnte nicht zurückgesetzt werden — bitte manuell prüfen." });
                  }
                }

                const { error: updErr } = await supabase.from("invoices").update({
                  status: "storniert",
                  storno_nummer: stornoNummer,
                  storno_datum: stornoDatum,
                  storno_grund: stornoGrund.trim(),
                  // Bezahlt-Betrag auf 0 — sonst verzerrt ein stehengebliebener
                  // Teilzahlungswert die Umsatz-/Offen-Statistiken.
                  bezahlt_betrag: 0,
                }).eq("id", invoiceId);

                if (updErr) {
                  toast({ variant: "destructive", title: "Fehler", description: updErr.message });
                  return;
                }

                // Update local form state with storno data
                setForm(prev => ({
                  ...prev,
                  status: "storniert",
                  storno_nummer: stornoNummer,
                  storno_datum: stornoDatum,
                  storno_grund: stornoGrund.trim(),
                  bezahlt_betrag: 0,
                }));

                // Generate and download Storno-PDF
                try {
                  const { generateStornoPdf } = await import("@/lib/pdfGenerator");
                  const logoUri = await loadInvoiceLogo();

                  const { data: bankSettings4 } = await supabase.from("app_settings").select("key, value").in("key", ["bank_kontoinhaber", "bank_iban", "bank_bic"]);
                  const bank4 = { kontoinhaber: "", iban: "", bic: "" };
                  bankSettings4?.forEach((s: any) => {
                    if (s.key === "bank_kontoinhaber") bank4.kontoinhaber = s.value;
                    if (s.key === "bank_iban") bank4.iban = s.value;
                    if (s.key === "bank_bic") bank4.bic = s.value;
                  });
                  const stornoBlob = generateStornoPdf(
                    { nummer: form.nummer, kunde_name: form.kunde_name, brutto_summe: bruttoSumme, datum: form.datum },
                    stornoNummer, stornoDatum, stornoGrund.trim(),
                    bank4, logoUri, invoiceLayout
                  );
                  const url = URL.createObjectURL(stornoBlob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `Storno_${stornoNummer}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (e) { console.warn("Storno-PDF failed:", e); }

                toast({ title: `${typLabel} storniert`, description: `Stornonummer: ${stornoNummer}` });
                setStornoDialogOpen(false);
                navigate("/invoices");
              }}>
                {typLabel} stornieren
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Project Dialog (when offer accepted) */}
        <CreateProjectDialog
          open={createProjectDialogOpen}
          onClose={() => setCreateProjectDialogOpen(false)}
          onCreated={async (newProject) => {
            updateField("project_id", newProject.id);
            // Verknüpfung + Material-Soll SOFORT persistieren (nicht erst beim
            // nächsten Speichern) — Parität zum Annehmen-Flow in der Belegliste.
            if (invoiceId) {
              await supabase.from("invoices").update({ project_id: newProject.id }).eq("id", invoiceId);
              try {
                const { generateMaterialbedarfFromAngebot } = await import("@/lib/materialbedarf");
                const n = await generateMaterialbedarfFromAngebot(invoiceId, newProject.id);
                if (n > 0) toast({ title: "Projekt verknüpft", description: `${n} Material-Position(en) als Soll ins Projekt übernommen.` });
              } catch (e: any) {
                console.warn("Materialbedarf fehlgeschlagen:", e?.message);
              }
            }
            const { data: projectsData } = await supabase
              .from("projects")
              .select("id, name")
              .not("status", "eq", "Abgeschlossen")
              .order("name");
            if (projectsData) setProjects(projectsData);
            setCreateProjectDialogOpen(false);
          }}
          defaultName={`${form.kunde_name} - ${form.nummer}`}
          defaultCustomerName={form.kunde_name}
          defaultAdresse={form.kunde_adresse}
          defaultPlz={form.kunde_plz}
          defaultOrt={form.kunde_ort}
        />
      </div>

    </div>
  );
}
