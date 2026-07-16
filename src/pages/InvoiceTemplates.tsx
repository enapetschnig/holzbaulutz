import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";
import { Plus, Trash2, Save, Package, Search, Filter, Upload, Star, TrendingUp, Percent, Euro, ImagePlus, X, Calculator } from "lucide-react";
import { MaterialFileImport } from "@/components/MaterialFileImport";
import { Textarea } from "@/components/ui/textarea";
import { useEinheiten } from "@/hooks/useEinheiten";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PositionComponentsEditor, type MaterialOption } from "@/components/PositionComponentsEditor";
import { KalkulationsExcelAnsicht } from "@/components/KalkulationsExcelAnsicht";
import { type PositionComponent, calcPositionPreis } from "@/lib/positionen";
import { BulkPriceDialog } from "@/components/BulkPriceDialog";
import { KalkulationFields } from "@/components/KalkulationFields";
import { calcEinzelpreis } from "@/lib/kalkulation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Template {
  id: string;
  name: string;
  beschreibung: string;
  einheit: string;
  einzelpreis: number;
  kategorie: string;
  artikelnummer: string | null;
  produktnummer: string | null;
  produktgruppe: string | null;
  kurzbezeichnung: string | null;
  langbezeichnung: string | null;
  netto_preis: number;
  brutto_preis: number;
  ust_satz: number;
  ist_aktiv: boolean;
  ist_lagerartikel: boolean;
  lieferant: string | null;
  ist_favorit: boolean;
  foto_path: string | null;
  ist_set: boolean;
  ek_netto: number;
  vk_netto: number;
  bezugseinheit: string | null;
  aufschlag_prozent: number;
  vk_preis_manuell: boolean;
  ist_kalkuliert: boolean;
  verschnitt_prozent: number;
  befestigung_preis: number;
  sonstiges_preis: number;
  arbeitszeit_minuten: number;
  stundensatz: number;
  /** 'material' = Einkaufspreis-Eintrag · 'position' = kalkulierte Leistung */
  art: "material" | "position";
}

export default function InvoiceTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterKategorie, setFilterKategorie] = useState<string>("alle");
  // Aktiver Tab: Positionen (kalkulierte Leistungen) oder Materialien (EK-Liste)
  const [activeArt, setActiveArt] = useState<"position" | "material">("position");
  // Positionen-Darstellung: Liste (Karten je Kategorie) oder Excel-Gesamtansicht
  const [posAnsicht, setPosAnsicht] = useState<"liste" | "excel">("liste");
  const [form, setForm] = useState({
    name: "", beschreibung: "", einheit: "Stk.", einzelpreis: 0, kategorie: "Allgemein", artikelnummer: "",
    produktnummer: "", kurzbezeichnung: "", langbezeichnung: "", netto_preis: 0, brutto_preis: 0, ust_satz: 20,
    ist_lagerartikel: false, lieferant: "", produktgruppe: "",
    foto_path: null as string | null,
    ist_set: false,
    ek_netto: 0,
    vk_netto: 0,
    bezugseinheit: "" as string,
    aufschlag_prozent: 0,
    vk_preis_manuell: false,
    ist_kalkuliert: false,
    verschnitt_prozent: 0,
    befestigung_preis: 0,
    sonstiges_preis: 0,
    arbeitszeit_minuten: 0,
    stundensatz: 52,
    art: "position" as "material" | "position",
  });
  const [importOpen, setImportOpen] = useState(false);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [priceAdjustMode, setPriceAdjustMode] = useState<"prozent" | "euro">("prozent");
  const [priceAdjustValue, setPriceAdjustValue] = useState("");
  // Foto-Vorschau-URLs (signed) für Katalog-Liste + Edit-Dialog
  const [fotoUrls, setFotoUrls] = useState<Record<string, string>>({});
  // Komponenten der aktuell editierten Position (Material/Lohn/Sonstiges) —
  // im Dialog lokal gehalten, beim Save synchron in position_components geschrieben
  const [posComponents, setPosComponents] = useState<PositionComponent[]>([]);
  // Merker: welche Komponenten-Row-IDs waren beim Öffnen da? Für Diff beim Save.
  const [originalComponentIds, setOriginalComponentIds] = useState<string[]>([]);
  // Solange die Komponenten einer Position noch laden, darf nicht gespeichert
  // werden — sonst würde z.B. arbeitszeit_minuten=0 persistiert (leere Liste).
  const [componentsLoading, setComponentsLoading] = useState(false);
  // Excel-Ansicht: Zähler → bei Änderung lädt die Ansicht ihre Komponenten neu
  // (nach Dialog-Save/Delete), damit ihr nächster Save keinen alten Stand schreibt.
  const [excelReloadKey, setExcelReloadKey] = useState(0);
  // Ungespeicherte Änderungen in der Excel-Ansicht (Guard vor Tab-/Ansicht-Wechsel)
  const [excelDirty, setExcelDirty] = useState(false);
  // Lösch-Bestätigung: Ziel + Anzahl verknüpfter Komponenten (bei Material)
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [deleteUsageCount, setDeleteUsageCount] = useState<number | null>(null);
  const [fotoUploading, setFotoUploading] = useState(false);
  const [editFotoUrl, setEditFotoUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const einheiten = useEinheiten();

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("invoice_templates")
      .select("*")
      .order("kategorie, name")
      .limit(5000);
    if (error) {
      toast({ variant: "destructive", title: "Fehler", description: "Materialien konnten nicht geladen werden" });
    } else {
      const rows = (data || []).map(t => {
        const nettoPreis = Number((t as any).netto_preis) || Number(t.einzelpreis);
        return {
          ...t,
          einzelpreis: Number(t.einzelpreis),
          netto_preis: nettoPreis,
          brutto_preis: Number((t as any).brutto_preis) || 0,
          ust_satz: Number((t as any).ust_satz) || 20,
          ist_aktiv: (t as any).ist_aktiv !== false,
          ist_lagerartikel: (t as any).ist_lagerartikel || false,
          artikelnummer: (t as any).artikelnummer || null,
          produktnummer: (t as any).produktnummer || null,
          produktgruppe: (t as any).produktgruppe || null,
          kurzbezeichnung: (t as any).kurzbezeichnung || null,
          langbezeichnung: (t as any).langbezeichnung || null,
          lieferant: (t as any).lieferant || null,
          ist_favorit: (t as any).ist_favorit || false,
          foto_path: (t as any).foto_path || null,
          ist_set: !!(t as any).ist_set,
          ek_netto: Number((t as any).ek_netto ?? nettoPreis) || 0,
          vk_netto: Number((t as any).vk_netto ?? nettoPreis) || 0,
          bezugseinheit: (t as any).bezugseinheit || null,
          aufschlag_prozent: Number((t as any).aufschlag_prozent) || 0,
          vk_preis_manuell: !!(t as any).vk_preis_manuell,
          ist_kalkuliert: !!(t as any).ist_kalkuliert,
          verschnitt_prozent: Number((t as any).verschnitt_prozent) || 0,
          befestigung_preis: Number((t as any).befestigung_preis) || 0,
          sonstiges_preis: Number((t as any).sonstiges_preis) || 0,
          arbeitszeit_minuten: Number((t as any).arbeitszeit_minuten) || 0,
          stundensatz: Number((t as any).stundensatz) || 52,
          art: ((t as any).art === "material" ? "material" : "position") as "material" | "position",
        };
      }) as Template[];
      setTemplates(rows);

      // Signed URLs für alle Fotos parallel generieren (1h gültig)
      const withFotos = rows.filter(r => r.foto_path);
      if (withFotos.length > 0) {
        const urls: Record<string, string> = {};
        await Promise.all(withFotos.map(async (r) => {
          try {
            const { data: signed } = await supabase.storage
              .from("project-materials")
              .createSignedUrl(r.foto_path!, 3600);
            if (signed?.signedUrl) urls[r.id] = signed.signedUrl;
          } catch {}
        }));
        setFotoUrls(urls);
      } else {
        setFotoUrls({});
      }
    }
    setLoading(false);
  };

  const kategorien = [...new Set(templates.filter(t => t.art === activeArt).map(t => t.kategorie))].sort();
  const produktgruppen = [...new Set(templates.map(t => t.produktgruppe).filter(Boolean))].sort() as string[];
  const lieferanten = [...new Set(templates.map(t => t.lieferant).filter(Boolean))].sort() as string[];

  const filtered = templates.filter(t => {
    const s = search.toLowerCase();
    const matchesSearch = !search ||
      t.name.toLowerCase().includes(s) ||
      t.beschreibung.toLowerCase().includes(s) ||
      (t.artikelnummer && t.artikelnummer.toLowerCase().includes(s)) ||
      (t.produktnummer && t.produktnummer.toLowerCase().includes(s)) ||
      (t.kurzbezeichnung && t.kurzbezeichnung.toLowerCase().includes(s)) ||
      (t.langbezeichnung && t.langbezeichnung.toLowerCase().includes(s)) ||
      (t.lieferant && t.lieferant.toLowerCase().includes(s));
    const matchesKategorie = filterKategorie === "alle" || t.kategorie === filterKategorie;
    return matchesSearch && matchesKategorie && t.art === activeArt;
  });

  // Materialien (EK-Liste) für den Komponenten-Picker im Positions-Dialog
  const materialOptions: MaterialOption[] = templates
    .filter(t => t.art === "material")
    .map(t => ({
      id: t.id,
      name: t.kurzbezeichnung || t.name,
      einheit: t.einheit,
      ek_netto: t.ek_netto,
      kategorie: t.kategorie,
    }));

  const grouped = filtered.reduce<Record<string, Template[]>>((acc, t) => {
    (acc[t.kategorie] = acc[t.kategorie] || []).push(t);
    return acc;
  }, {});

  const openNew = (kategorie?: string, art?: "position" | "material") => {
    const neueArt = art ?? activeArt;
    setEditId(null);
    setForm({
      name: "", beschreibung: "", einheit: neueArt === "position" ? "m2" : "Stk.", einzelpreis: 0,
      kategorie: kategorie || "Allgemein", artikelnummer: "",
      produktnummer: "", kurzbezeichnung: "", langbezeichnung: "", netto_preis: 0, brutto_preis: 0, ust_satz: 20,
      ist_lagerartikel: false, lieferant: "", produktgruppe: kategorie || "",
      foto_path: null, ist_set: false,
      ek_netto: 0, vk_netto: 0, bezugseinheit: "", aufschlag_prozent: 0, vk_preis_manuell: false,
      ist_kalkuliert: false, verschnitt_prozent: 0, befestigung_preis: 0, sonstiges_preis: 0, arbeitszeit_minuten: 0, stundensatz: 52,
      art: neueArt,
    });
    setPosComponents([]);
    setOriginalComponentIds([]);
    setComponentsLoading(false);
    setEditFotoUrl(null);
    setDialogOpen(true);
  };

  const openEdit = async (t: Template) => {
    setEditId(t.id);
    setForm({
      name: t.name, beschreibung: t.beschreibung, einheit: t.einheit, einzelpreis: t.einzelpreis,
      kategorie: t.kategorie, artikelnummer: t.artikelnummer || "",
      produktnummer: t.produktnummer || "", kurzbezeichnung: t.kurzbezeichnung || t.name,
      langbezeichnung: t.langbezeichnung || t.beschreibung, netto_preis: t.netto_preis,
      brutto_preis: t.brutto_preis, ust_satz: t.ust_satz, ist_lagerartikel: t.ist_lagerartikel,
      lieferant: t.lieferant || "", produktgruppe: t.produktgruppe || t.kategorie,
      foto_path: t.foto_path,
      ist_set: t.ist_set,
      ek_netto: t.ek_netto,
      vk_netto: t.vk_netto || t.netto_preis,
      bezugseinheit: t.bezugseinheit || "",
      aufschlag_prozent: t.aufschlag_prozent,
      vk_preis_manuell: t.vk_preis_manuell,
      ist_kalkuliert: t.ist_kalkuliert,
      verschnitt_prozent: t.verschnitt_prozent,
      befestigung_preis: t.befestigung_preis,
      sonstiges_preis: t.sonstiges_preis,
      arbeitszeit_minuten: t.arbeitszeit_minuten,
      stundensatz: t.stundensatz || 52,
      art: t.art,
    });
    setPriceAdjustValue("");
    setEditFotoUrl(t.foto_path ? (fotoUrls[t.id] || null) : null);
    setDialogOpen(true);

    // Komponenten der Position laden (Material/Lohn/Sonstiges).
    // Während des Ladens ist Speichern gesperrt (componentsLoading) — ein Save
    // mit noch leerer Komponentenliste würde sonst arbeitszeit_minuten=0 und
    // einen falschen VK persistieren.
    if (t.art === "position") {
      setComponentsLoading(true);
      setPosComponents([]);
      setOriginalComponentIds([]);
      const { data } = await (supabase as any)
        .from("position_components")
        .select("id, material_template_id, typ, bezeichnung, einheit, menge_pro_einheit, preis, verschnitt_prozent, aufschlag_prozent, sort_order")
        .eq("position_template_id", t.id)
        .order("sort_order");
      const rows = ((data as any[]) || []).map(r => ({
        id: r.id,
        material_template_id: r.material_template_id || null,
        typ: (r.typ || "material") as PositionComponent["typ"],
        bezeichnung: r.bezeichnung || "",
        einheit: r.einheit || "",
        menge_pro_einheit: Number(r.menge_pro_einheit) || 0,
        preis: Number(r.preis) || 0,
        verschnitt_prozent: Number(r.verschnitt_prozent) || 0,
        aufschlag_prozent: Number(r.aufschlag_prozent) || 0,
        sort_order: Number(r.sort_order) || 0,
      })) as PositionComponent[];
      setPosComponents(rows);
      setOriginalComponentIds(rows.map(r => r.id!).filter(Boolean));
      setComponentsLoading(false);
    } else {
      setPosComponents([]);
      setOriginalComponentIds([]);
      setComponentsLoading(false);
    }
  };

  // Foto-Upload in den bestehenden project-materials-Bucket. Pfad ist
  // material-fotos/<templateId>.<ext>. Bei neuem Material gibt es noch
  // keine ID — wir erzeugen daher eine temporäre uuid, die wir beim Save
  // in foto_path speichern.
  const handleFotoSelect = async (file: File) => {
    setFotoUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      // Eindeutiger Pfad: template-ID wenn vorhanden, sonst zufällige UUID
      const base = editId || crypto.randomUUID();
      const path = `material-fotos/${base}.${ext}`;
      const { error } = await supabase.storage.from("project-materials")
        .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
      if (error) throw error;
      setForm(f => ({ ...f, foto_path: path }));
      const { data: signed } = await supabase.storage
        .from("project-materials").createSignedUrl(path, 3600);
      setEditFotoUrl(signed?.signedUrl || null);
      toast({ title: "Foto hochgeladen" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload fehlgeschlagen", description: err.message });
    } finally {
      setFotoUploading(false);
    }
  };

  const handleFotoRemove = async () => {
    if (form.foto_path) {
      try { await supabase.storage.from("project-materials").remove([form.foto_path]); } catch {}
    }
    setForm(f => ({ ...f, foto_path: null }));
    setEditFotoUrl(null);
  };

  const handleSave = async () => {
    const effectiveName = (form.kurzbezeichnung || form.name || "").trim();
    if (!effectiveName) {
      toast({ variant: "destructive", title: "Fehler", description: "Kurzbezeichnung ist erforderlich" });
      return;
    }

    // Komponenten noch nicht geladen → Speichern würde eine leere Liste
    // (arbeitszeit_minuten=0, falscher VK) persistieren. Button ist zwar
    // disabled, aber hier nochmal absichern.
    if (componentsLoading) {
      toast({ title: "Bitte warten", description: "Komponenten werden noch geladen…" });
      return;
    }

    // H-4: Preise dürfen nicht negativ sein (DB-Constraint wirft sonst nur technische Meldung)
    const ek = Number(form.ek_netto) || 0;
    const vk = Number(form.vk_netto) || 0;
    if (ek < 0 || vk < 0) {
      toast({ variant: "destructive", title: "Preis ungültig", description: "EK und VK dürfen nicht negativ sein." });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // VK ist der Primärwert für Rechnungen; netto_preis und einzelpreis werden
    // daraus gespiegelt für Abwärtskompatibilität mit Altcode.
    // Positionen mit Komponenten: VK = Summe der Komponenten (Excel-Modell).
    // Legacy-Positionen ohne Komponenten: alter Kalkulations-Modus (ein EK).
    const hatKomponenten = form.art === "position" && posComponents.length > 0;
    const ekLookup: Record<string, number> = {};
    for (const m of materialOptions) ekLookup[m.id] = m.ek_netto;
    const komponentenPreis = calcPositionPreis(posComponents, ekLookup);

    const kalkVk = calcEinzelpreis({
      ek_preis: Number(form.ek_netto) || 0,
      verschnitt_prozent: Number(form.verschnitt_prozent) || 0,
      aufschlag_prozent: Number(form.aufschlag_prozent) || 0,
      befestigung_preis: Number(form.befestigung_preis) || 0,
      sonstiges_preis: Number(form.sonstiges_preis) || 0,
      arbeitszeit_minuten: Number(form.arbeitszeit_minuten) || 0,
      stundensatz: Number(form.stundensatz) || 52,
    });
    const vkEffective = hatKomponenten
      ? komponentenPreis.einzelpreis
      : form.ist_kalkuliert ? kalkVk : (Number(form.vk_netto) || Number(form.netto_preis) || 0);
    const ekEffective = Number(form.ek_netto) || (form.art === "material" ? 0 : vkEffective);
    const bruttoEffective = Math.round(vkEffective * (1 + Number(form.ust_satz) / 100) * 100) / 100;
    const istKalkuliert = hatKomponenten ? false : form.ist_kalkuliert;

    const payload: any = {
      name: form.kurzbezeichnung || form.name,
      beschreibung: form.langbezeichnung || form.beschreibung || form.kurzbezeichnung || form.name,
      einheit: form.einheit,
      einzelpreis: vkEffective,
      kategorie: form.produktgruppe || form.kategorie,
      artikelnummer: form.produktnummer || form.artikelnummer || null,
      produktnummer: form.produktnummer || null,
      produktgruppe: form.produktgruppe || null,
      kurzbezeichnung: form.kurzbezeichnung || form.name,
      langbezeichnung: form.langbezeichnung || null,
      netto_preis: vkEffective,
      brutto_preis: bruttoEffective,
      ust_satz: form.ust_satz,
      ist_lagerartikel: form.ist_lagerartikel,
      lieferant: form.lieferant || null,
      foto_path: form.foto_path,
      art: form.art,
      ist_set: false,
      ek_netto: ekEffective,
      vk_netto: vkEffective,
      bezugseinheit: null,
      aufschlag_prozent: istKalkuliert ? Number(form.aufschlag_prozent) || 0 : 0,
      vk_preis_manuell: false,
      ist_kalkuliert: istKalkuliert,
      verschnitt_prozent: istKalkuliert ? Number(form.verschnitt_prozent) || 0 : 0,
      befestigung_preis: istKalkuliert ? Number(form.befestigung_preis) || 0 : 0,
      sonstiges_preis: istKalkuliert ? Number(form.sonstiges_preis) || 0 : 0,
      // Lohnminuten/EH: bei Komponenten aus deren Summe (für Stundenabgleich)
      arbeitszeit_minuten: hatKomponenten ? komponentenPreis.minutenProEinheit : (istKalkuliert ? Number(form.arbeitszeit_minuten) || 0 : 0),
      stundensatz: Number(form.stundensatz) || 52,
    };

    let templateId = editId;
    if (editId) {
      const { error } = await supabase.from("invoice_templates").update(payload).eq("id", editId);
      if (error) { toast({ variant: "destructive", title: "Fehler", description: error.message }); return; }
    } else {
      const { data, error } = await supabase.from("invoice_templates")
        .insert({ ...payload, user_id: user.id })
        .select("id")
        .single();
      if (error) { toast({ variant: "destructive", title: "Fehler", description: error.message }); return; }
      templateId = (data as any)?.id || null;
    }

    // Komponenten-Diff synchronisieren (nur für Positionen).
    // Die DB rechnet den VK danach per Trigger nochmal — identische Formel.
    if (form.art === "position" && templateId) {
      // WICHTIG: jede Komponenten-Operation auf Fehler prüfen und bei einem
      // Fehlschlag abbrechen — sonst rechnet der recompute-Trigger aus den
      // verbliebenen/fehlenden Komponenten einen falschen VK, während dem
      // Nutzer fälschlich "Gespeichert" gemeldet wird.
      const komponentenFehler = (msg: string) => {
        toast({ variant: "destructive", title: "Komponenten nicht gespeichert", description: msg });
      };
      const currentIds = posComponents.map(c => c.id).filter(Boolean) as string[];
      const toDelete = originalComponentIds.filter(id => !currentIds.includes(id));
      if (toDelete.length > 0) {
        const { error } = await (supabase as any).from("position_components").delete().in("id", toDelete);
        if (error) { komponentenFehler(error.message); return; }
      }
      for (let i = 0; i < posComponents.length; i++) {
        const c = posComponents[i];
        const row = {
          material_template_id: c.material_template_id,
          typ: c.typ,
          bezeichnung: c.bezeichnung || (c.typ === "lohn" ? "Arbeitszeit" : "Komponente"),
          einheit: c.einheit || "",
          menge_pro_einheit: Number(c.menge_pro_einheit) || 0,
          preis: Number(c.preis) || 0,
          verschnitt_prozent: Number(c.verschnitt_prozent) || 0,
          aufschlag_prozent: Number(c.aufschlag_prozent) || 0,
          sort_order: i,
        };
        if (c.id) {
          // .select('id'): ein Update auf eine (z.B. in anderem Tab) gelöschte
          // ID trifft 0 Zeilen OHNE Fehler — das wäre stiller Datenverlust.
          const { data: upd, error } = await (supabase as any)
            .from("position_components").update(row).eq("id", c.id).select("id");
          if (error) { komponentenFehler(error.message); return; }
          if (!upd || (upd as any[]).length === 0) {
            komponentenFehler("Komponente wurde zwischenzeitlich gelöscht — bitte Dialog neu öffnen.");
            return;
          }
        } else {
          const { error } = await (supabase as any).from("position_components")
            .insert({ ...row, position_template_id: templateId });
          if (error) { komponentenFehler(error.message); return; }
        }
      }
    }

    toast({ title: editId ? "Gespeichert" : "Erstellt" });
    setDialogOpen(false);
    fetchTemplates();
    // Excel-Ansicht neu laden lassen — sonst schreibt ihr nächster Save den
    // hier gerade überschriebenen (alten) Komponenten-Stand zurück.
    setExcelReloadKey(k => k + 1);
  };

  const handleInlinePrice = async (id: string, newPrice: number) => {
    const { error } = await supabase.from("invoice_templates").update({ einzelpreis: newPrice }).eq("id", id);
    if (!error) {
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, einzelpreis: newPrice } : t));
    }
  };

  // Löschen anfragen: öffnet den Bestätigungs-Dialog. Bei Materialien wird
  // vorher gezählt, in wie vielen Positions-Komponenten es verwendet wird —
  // der FK (SET NULL) + Recompute-Trigger würden deren VK sonst STILL ändern.
  const requestDelete = async (t: Template) => {
    setDeleteTarget(t);
    if (t.art === "material") {
      setDeleteUsageCount(null); // lädt…
      const { count } = await (supabase as any)
        .from("position_components")
        .select("id", { count: "exact", head: true })
        .eq("material_template_id", t.id);
      setDeleteUsageCount(count ?? 0);
    } else {
      setDeleteUsageCount(0);
    }
  };

  const handleDelete = async (t: Template) => {
    // Material: EK in allen verknüpften Komponenten auf den letzten Stand
    // einfrieren, damit der VK der Positionen nach dem Löschen (FK SET NULL
    // + Trigger) unverändert bleibt.
    if (t.art === "material") {
      const { error: freezeErr } = await (supabase as any)
        .from("position_components")
        .update({ preis: t.ek_netto })
        .eq("material_template_id", t.id);
      if (freezeErr) {
        toast({ variant: "destructive", title: "Fehler", description: `EK konnte nicht eingefroren werden: ${freezeErr.message}` });
        return;
      }
    }
    const { error } = await supabase.from("invoice_templates").delete().eq("id", t.id);
    if (error) { toast({ variant: "destructive", title: "Fehler", description: error.message }); return; }
    toast({ title: "Gelöscht" });
    fetchTemplates();
    // Excel-Ansicht neu laden lassen (Komponenten/EKs können sich geändert haben)
    setExcelReloadKey(k => k + 1);
  };

  // Positionen mit Komponenten (und Legacy-Kalkulation) leiten ihren VK aus dem
  // Modell ab — ein manuell getippter VK/Brutto oder das Preisanpassung-Panel
  // würden beim Speichern überschrieben. Für Anzeige (VK/Brutto/Marge) daher
  // durchgängig den Live-Komponentenpreis nutzen und die Direkteingaben sperren.
  const istKomponentenOderKalk = (form.art === "position" && posComponents.length > 0) || form.ist_kalkuliert;
  const anzeigeVkNetto = (form.art === "position" && posComponents.length > 0)
    ? calcPositionPreis(posComponents, Object.fromEntries(materialOptions.map(m => [m.id, m.ek_netto]))).einzelpreis
    : (Number(form.vk_netto) || Number(form.netto_preis) || 0);

  // Guard: die Excel-Ansicht hält ungespeicherte Zell-Änderungen lokal — ein
  // Tab-/Ansicht-Wechsel würde sie kommentarlos verwerfen. Vorher nachfragen.
  const confirmExcelLeave = () => {
    if (!(activeArt === "position" && posAnsicht === "excel" && excelDirty)) return true;
    const ok = window.confirm("Ungespeicherte Änderungen in der Excel-Ansicht gehen verloren. Trotzdem wechseln?");
    if (ok) setExcelDirty(false);
    return ok;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-[1400px]">
        <PageHeader title="Materialien & Kalkulation" backPath="/" />

        {/* Zwei Ebenen nach Excel-Vorlage: Positionen (kalkulierte Leistungen)
            bestehen aus Materialien (Einkaufspreis-Liste inkl. Stundensätze). */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Tabs value={activeArt} onValueChange={(v) => {
            if (!confirmExcelLeave()) return;
            setActiveArt(v as "position" | "material");
            setFilterKategorie("alle");
          }}>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="position" className="gap-1.5">
                <Calculator className="w-4 h-4" />
                Positionen
              </TabsTrigger>
              <TabsTrigger value="material" className="gap-1.5">
                <Package className="w-4 h-4" />
                Materialien (EK)
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {activeArt === "position" && (
            <div className="flex rounded-md border overflow-hidden">
              {([["liste", "Liste"], ["excel", "🧮 Excel-Ansicht"]] as const).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    if (val === posAnsicht) return;
                    if (!confirmExcelLeave()) return;
                    setPosAnsicht(val);
                  }}
                  className={`px-3 py-1.5 text-sm transition-colors ${posAnsicht === val ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Orientierung für Excel-Umsteiger: die zwei Tabs sind exakt die zwei
            Arbeitsmappen der Kalkulations-Excel. */}
        <div className="mb-4 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>📊 <b>Aufgebaut wie deine Kalkulations-Excel:</b></span>
          <span><b className="text-foreground">Materialien</b> = Blatt „MATERIALIEN" (Einkaufspreise + Stundensätze)</span>
          <span className="opacity-50">·</span>
          <span><b className="text-foreground">Positionen</b> = Blatt „POSITIONEN" (fertige Leistungen aus Material + Arbeitszeit)</span>
          {activeArt === "position" && (
            <span className="opacity-50">· Tipp: <b className="text-foreground">🧮 Excel-Ansicht</b> zeigt alle Positionen samt Komponenten als ein Blatt.</span>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name, Beschreibung, Artikelnummer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterKategorie} onValueChange={setFilterKategorie}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Kategorien</SelectItem>
                {kategorien.map(k => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkPriceOpen(true)} className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Preise anpassen
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
              <Upload className="w-4 h-4" />
              Importieren
            </Button>
            <Button onClick={() => openNew()} className="gap-2">
              <Plus className="w-4 h-4" />
              {activeArt === "position" ? "Neue Position" : "Neues Material"}
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Lädt...</p>
        ) : activeArt === "position" && posAnsicht === "excel" ? (
          <KalkulationsExcelAnsicht
            positionen={templates.filter(t => t.art === "position").map(t => ({
              id: t.id,
              name: t.kurzbezeichnung || t.name,
              einheit: t.einheit,
              kategorie: t.kategorie,
              vk_netto: t.vk_netto,
              arbeitszeit_minuten: t.arbeitszeit_minuten,
              ust_satz: t.ust_satz,
            }))}
            onEdit={(id) => {
              const t = templates.find(x => x.id === id);
              if (t) openEdit(t);
            }}
            onAddPosition={(kategorie) => openNew(kategorie, "position")}
            onDataChanged={fetchTemplates}
            reloadKey={excelReloadKey}
            onDirtyChange={setExcelDirty}
          />
        ) : Object.keys(grouped).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{search || filterKategorie !== "alle"
                ? (activeArt === "position" ? "Keine Positionen gefunden" : "Keine Materialien gefunden")
                : (activeArt === "position" ? "Noch keine Positionen angelegt" : "Noch keine Materialien angelegt")}</p>
              {!search && filterKategorie === "alle" && (
                <Button className="mt-4" onClick={() => openNew()}>
                  {activeArt === "position" ? "Erste Position anlegen" : "Erstes Material anlegen"}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([kategorie, items]) => (
            <Card key={kategorie} className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge variant="secondary">{kategorie}</Badge>
                  <span className="text-muted-foreground text-sm">({items.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-14">Foto</TableHead>
                      <TableHead>Prod.-Nr.</TableHead>
                      <TableHead>Kurzbezeichnung</TableHead>
                      <TableHead>Langbezeichnung</TableHead>
                      <TableHead>Einheit</TableHead>
                      <TableHead>USt</TableHead>
                      <TableHead className="text-right">Netto (€)</TableHead>
                      <TableHead className="text-right">Brutto (€)</TableHead>
                      <TableHead>Lager</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(t => (
                      <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(t)}>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async (e) => {
                            e.stopPropagation();
                            const newVal = !t.ist_favorit;
                            await supabase.from("invoice_templates").update({ ist_favorit: newVal } as any).eq("id", t.id);
                            setTemplates(prev => prev.map(item => item.id === t.id ? { ...item, ist_favorit: newVal } : item));
                          }}>
                            <Star className={`w-4 h-4 ${t.ist_favorit ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                          </Button>
                        </TableCell>
                        <TableCell>
                          {t.foto_path && fotoUrls[t.id] ? (
                            <img
                              src={fotoUrls[t.id]}
                              alt=""
                              className="w-10 h-10 object-cover rounded border"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center">
                              <Package className="w-4 h-4 text-muted-foreground/40" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{t.produktnummer || t.artikelnummer || "–"}</TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          <span>{t.kurzbezeichnung || t.name}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[250px] truncate text-xs">{t.langbezeichnung || t.beschreibung}</TableCell>
                        <TableCell className="text-xs">{t.einheit}</TableCell>
                        <TableCell className="text-xs">{t.ust_satz}%</TableCell>
                        <TableCell className="text-right font-mono text-sm">{t.netto_preis > 0 ? `€ ${t.netto_preis.toFixed(2)}` : "–"}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">{t.brutto_preis > 0 ? `€ ${t.brutto_preis.toFixed(2)}` : "–"}</TableCell>
                        <TableCell>{t.ist_lagerartikel ? <Badge variant="outline" className="text-xs">Lager</Badge> : ""}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); requestDelete(t); }}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {form.art === "position"
                  ? (editId ? "Position bearbeiten" : "Neue Position (kalkulierte Leistung)")
                  : (editId ? "Material bearbeiten" : "Neues Material (Einkaufspreis)")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Produktnummer</Label>
                  <Input value={form.produktnummer} onChange={(e) => setForm(f => ({ ...f, produktnummer: e.target.value }))} placeholder="z.B. 0050-PCI" />
                </div>
                <div>
                  <Label>Produktgruppe</Label>
                  <Select value={form.produktgruppe || "none"} onValueChange={(v) => {
                    if (v === "_new") {
                      const newGrp = prompt("Neue Produktgruppe:");
                      if (newGrp?.trim()) setForm(f => ({ ...f, produktgruppe: newGrp.trim() }));
                    } else {
                      setForm(f => ({ ...f, produktgruppe: v === "none" ? "" : v }));
                    }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {produktgruppen.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      <SelectItem value="_new" className="text-primary font-medium">+ Neue Gruppe...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Lieferant</Label>
                  <Select value={form.lieferant || "none"} onValueChange={(v) => {
                    if (v === "_new") {
                      const newLief = prompt("Neuer Lieferant:");
                      if (newLief?.trim()) setForm(f => ({ ...f, lieferant: newLief.trim() }));
                    } else {
                      setForm(f => ({ ...f, lieferant: v === "none" ? "" : v }));
                    }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {lieferanten.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      <SelectItem value="_new" className="text-primary font-medium">+ Neuer Lieferant...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Kurzbezeichnung *</Label>
                <Input value={form.kurzbezeichnung} onChange={(e) => setForm(f => ({ ...f, kurzbezeichnung: e.target.value }))} placeholder="Kurzname des Materials" />
              </div>
              <div>
                <Label>Langbezeichnung</Label>
                <Textarea
                  value={form.langbezeichnung}
                  onChange={(e) => setForm(f => ({ ...f, langbezeichnung: e.target.value }))}
                  placeholder="Detaillierte Beschreibung für Angebot/Rechnung (Plain-Text, Zeilenumbrüche erlaubt)"
                  rows={6}
                />
              </div>

              {/* Foto-Upload */}
              <div className="border rounded-lg p-3 bg-muted/20">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <ImagePlus className="w-4 h-4" /> Foto (optional)
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  Wird nur im Katalog + diesem Dialog angezeigt, nicht auf dem PDF.
                </p>
                <div className="flex items-center gap-3">
                  {editFotoUrl ? (
                    <img
                      src={editFotoUrl}
                      alt="Material-Foto"
                      className="w-20 h-20 object-cover rounded border shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded border bg-background flex items-center justify-center shrink-0">
                      <ImagePlus className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <label>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFotoSelect(file);
                          e.currentTarget.value = "";
                        }}
                      />
                      <Button type="button" variant="outline" size="sm" disabled={fotoUploading} asChild>
                        <span className="cursor-pointer">
                          {fotoUploading ? "Lädt..." : (editFotoUrl ? "Foto austauschen" : "Foto hochladen")}
                        </span>
                      </Button>
                    </label>
                    {editFotoUrl && (
                      <Button type="button" variant="ghost" size="sm" onClick={handleFotoRemove}>
                        <X className="w-4 h-4 mr-1" /> Entfernen
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              {/* Kalkulation mit Komponenten (Positionen) — nach Excel-Vorlage:
                  Position = Materialien + Arbeitszeit + Sonstiges */}
              {form.art === "position" && (
                <PositionComponentsEditor
                  components={posComponents}
                  onChange={setPosComponents}
                  einheit={form.einheit}
                  materialien={materialOptions}
                />
              )}
              {/* Legacy: alte Einzel-Kalkulation (EK+Verschnitt+Aufschlag+Lohn in einem)
                  — nur noch für bestehende Positionen OHNE Komponenten */}
              {form.art === "position" && posComponents.length === 0 && form.ist_kalkuliert && (
                <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="font-medium">Einfache Kalkulation (alt)</Label>
                      <p className="text-xs text-muted-foreground">
                        Diese Position nutzt noch die einfache Ein-Material-Kalkulation.
                        Füge oben Komponenten hinzu, um auf das neue Modell umzustellen.
                      </p>
                    </div>
                    <Switch
                      checked={form.ist_kalkuliert}
                      onCheckedChange={(c) => setForm(f => ({ ...f, ist_kalkuliert: !!c }))}
                    />
                  </div>
                  <KalkulationFields
                    einheit={form.einheit}
                    value={{
                      ek_preis: form.ek_netto, verschnitt_prozent: form.verschnitt_prozent,
                      aufschlag_prozent: form.aufschlag_prozent, befestigung_preis: form.befestigung_preis,
                      sonstiges_preis: form.sonstiges_preis, arbeitszeit_minuten: form.arbeitszeit_minuten,
                      stundensatz: form.stundensatz || 52,
                    }}
                    onChange={(v) => setForm(f => {
                      const vk = calcEinzelpreis(v);
                      return {
                        ...f,
                        ek_netto: v.ek_preis, verschnitt_prozent: v.verschnitt_prozent,
                        aufschlag_prozent: v.aufschlag_prozent, befestigung_preis: v.befestigung_preis,
                        sonstiges_preis: v.sonstiges_preis, arbeitszeit_minuten: v.arbeitszeit_minuten,
                        stundensatz: v.stundensatz,
                        vk_netto: vk, netto_preis: vk,
                        brutto_preis: Math.round(vk * (1 + f.ust_satz / 100) * 100) / 100,
                      };
                    })}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <Label>Einheit</Label>
                  <Select value={form.einheit} onValueChange={(v) => setForm(f => ({ ...f, einheit: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {einheiten.map(e => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>EK netto (€)</Label>
                  <Input type="number" value={form.ek_netto || ""} onChange={(e) => {
                    const ek = Number(e.target.value);
                    setForm(f => ({ ...f, ek_netto: ek }));
                  }} min={0} step={0.01} />
                </div>
                <div>
                  <Label>VK netto (€)</Label>
                  <Input
                    type="number"
                    value={istKomponentenOderKalk ? (anzeigeVkNetto || "") : (form.vk_netto || "")}
                    onChange={(e) => {
                      const vk = Number(e.target.value);
                      setForm(f => ({
                        ...f,
                        vk_netto: vk,
                        netto_preis: vk,
                        brutto_preis: Math.round(vk * (1 + f.ust_satz / 100) * 100) / 100,
                      }));
                    }}
                    min={0}
                    step={0.01}
                    disabled={istKomponentenOderKalk}
                  />
                </div>
                <div>
                  <Label>USt-Satz (%)</Label>
                  <Select value={String(form.ust_satz)} onValueChange={(v) => {
                    const ust = Number(v);
                    setForm(f => ({ ...f, ust_satz: ust, brutto_preis: Math.round((f.vk_netto || f.netto_preis) * (1 + ust / 100) * 100) / 100 }));
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="10">10%</SelectItem>
                      <SelectItem value="13">13%</SelectItem>
                      <SelectItem value="20">20%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Brutto (€)</Label>
                  <Input
                    type="number"
                    value={Math.round(anzeigeVkNetto * (1 + form.ust_satz / 100) * 100) / 100 || ""}
                    onChange={(e) => {
                      const brutto = Number(e.target.value);
                      const vk = form.ust_satz > 0 ? Math.round(brutto / (1 + form.ust_satz / 100) * 100) / 100 : brutto;
                      setForm(f => ({
                        ...f,
                        vk_netto: vk,
                        netto_preis: vk,
                        brutto_preis: brutto,
                      }));
                    }}
                    min={0}
                    step={0.01}
                    disabled={istKomponentenOderKalk}
                  />
                </div>
              </div>
              {/* Marge-Anzeige — auf den effektiven (Live-)VK bezogen */}
              {anzeigeVkNetto > 0 && (
                <div className="text-xs text-muted-foreground -mt-2">
                  {form.ek_netto > 0 ? (
                    <>Marge: <span className={`font-mono ${anzeigeVkNetto >= form.ek_netto ? "text-green-600" : "text-destructive"}`}>
                      {(((anzeigeVkNetto - form.ek_netto) / form.ek_netto) * 100).toFixed(1)} %
                    </span> (€ {(anzeigeVkNetto - form.ek_netto).toFixed(2)} Aufschlag)</>
                  ) : (
                    <>Kein EK hinterlegt — Marge nicht berechenbar.</>
                  )}
                </div>
              )}
              {/* Preisanpassung — nur bei FREI bepreisten Materialien/Positionen.
                  Bei Komponenten-Positionen/Legacy-Kalkulation würde ein VK-
                  Override beim Speichern verworfen (VK kommt aus dem Modell). */}
              {editId && !istKomponentenOderKalk && (
                <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4" />
                    Preisanpassung
                  </p>
                  <div className="flex gap-2 items-end">
                    <div className="flex border rounded-md overflow-hidden h-9">
                      <button
                        type="button"
                        className={`px-3 text-sm flex items-center gap-1 transition-colors ${priceAdjustMode === "prozent" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                        onClick={() => setPriceAdjustMode("prozent")}
                      >
                        <Percent className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className={`px-3 text-sm flex items-center gap-1 transition-colors ${priceAdjustMode === "euro" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                        onClick={() => setPriceAdjustMode("euro")}
                      >
                        <Euro className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <Input
                        type="number"
                        step={priceAdjustMode === "prozent" ? "0.1" : "0.01"}
                        placeholder={priceAdjustMode === "prozent" ? "z.B. 5 für +5%" : "z.B. 2.50 für +€2,50"}
                        value={priceAdjustValue}
                        onChange={(e) => setPriceAdjustValue(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0"
                      disabled={!priceAdjustValue || Number(priceAdjustValue) === 0}
                      onClick={() => {
                        const val = Number(priceAdjustValue);
                        if (!val) return;
                        setForm(f => {
                          const baseVk = f.vk_netto || f.netto_preis;
                          let newVk: number;
                          if (priceAdjustMode === "prozent") {
                            newVk = Math.round(baseVk * (1 + val / 100) * 100) / 100;
                          } else {
                            newVk = Math.round((baseVk + val) * 100) / 100;
                          }
                          if (newVk < 0) newVk = 0;
                          return {
                            ...f,
                            vk_netto: newVk,
                            netto_preis: newVk,
                            brutto_preis: Math.round(newVk * (1 + f.ust_satz / 100) * 100) / 100,
                          };
                        });
                        const val2 = Number(priceAdjustValue);
                        const label = priceAdjustMode === "prozent" ? `${val2 > 0 ? "+" : ""}${val2}%` : `${val2 > 0 ? "+" : ""}€${Math.abs(val2).toFixed(2)}`;
                        toast({ title: `VK angepasst: ${label}` });
                        setPriceAdjustValue("");
                      }}
                    >
                      Anwenden
                    </Button>
                  </div>
                  {priceAdjustValue && Number(priceAdjustValue) !== 0 && (
                    <p className="text-xs text-muted-foreground">
                      {(() => {
                        const val = Number(priceAdjustValue);
                        const baseVk = form.vk_netto || form.netto_preis;
                        let newVk: number;
                        if (priceAdjustMode === "prozent") {
                          newVk = Math.round(baseVk * (1 + val / 100) * 100) / 100;
                        } else {
                          newVk = Math.round((baseVk + val) * 100) / 100;
                        }
                        if (newVk < 0) newVk = 0;
                        const diff = newVk - baseVk;
                        return `VK: € ${baseVk.toFixed(2)} → € ${newVk.toFixed(2)} (${diff >= 0 ? "+" : ""}${diff.toFixed(2)})`;
                      })()}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Checkbox id="lagerartikel" checked={form.ist_lagerartikel} onCheckedChange={(c) => setForm(f => ({ ...f, ist_lagerartikel: !!c }))} />
                  <Label htmlFor="lagerartikel" className="cursor-pointer">Lagerartikel</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={handleSave} disabled={!form.kurzbezeichnung?.trim() || componentsLoading} className="gap-2">
                <Save className="w-4 h-4" />
                {componentsLoading ? "Lädt Komponenten…" : "Speichern"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lösch-Bestätigung — Material-Löschen würde sonst per FK SET NULL +
            Trigger STILL die VK-Preise verknüpfter Positionen ändern. */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deleteTarget?.art === "material" ? "Material löschen?" : "Position löschen?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                „{deleteTarget ? (deleteTarget.kurzbezeichnung || deleteTarget.name) : ""}" wird endgültig gelöscht.
                {deleteTarget?.art === "material" && deleteUsageCount === null && (
                  <> Verwendung in Positionen wird geprüft…</>
                )}
                {deleteTarget?.art === "material" && (deleteUsageCount ?? 0) > 0 && (
                  <> Wird in {deleteUsageCount} Position{deleteUsageCount === 1 ? "" : "en"} verwendet —
                  der EK wird dort auf den letzten Stand (€ {deleteTarget.ek_netto.toFixed(2)}) eingefroren.</>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteTarget?.art === "material" && deleteUsageCount === null}
                onClick={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <MaterialFileImport
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={() => { setImportOpen(false); fetchTemplates(); }}
        />

        <BulkPriceDialog
          open={bulkPriceOpen}
          onClose={() => setBulkPriceOpen(false)}
          onApplied={fetchTemplates}
          kategorien={kategorien}
          lieferanten={lieferanten}
        />
      </div>
    </div>
  );
}
