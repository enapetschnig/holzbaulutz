import { supabase } from "@/integrations/supabase/client";

/**
 * Quelle der Wahrheit für Projekt-Dateien = Supabase Storage (NICHT die
 * 'documents'-Tabelle). Damit erscheint JEDE hochgeladene Datei im Ordner —
 * egal über welchen Upload-Weg sie kam (QuickUpload, Kamera, Projekt-Anlage,
 * Projekt-Detail …) — und Zähler stimmen immer mit dem überein, was der Ordner
 * anzeigt. 'documents' ist nur noch ein optionaler Metadaten-Index (Kommentar
 * pro Foto).
 */

export interface ProjectFile {
  /** Storage-Pfad inkl. Projekt-Prefix, z.B. "<projectId>/123_foto.jpg" */
  path: string;
  /** Dateiname (letztes Pfadsegment) */
  name: string;
  /** Anzeige-/Download-URL (public bei project-photos, sonst signiert) */
  url: string;
  createdAt: string;
  size: number;
  /** documents-Zeile (falls vorhanden) — nur für Metadaten/Kommentar */
  docId: string | null;
  beschreibung: string | null;
}

/** Storage-Bucket -> documents.typ (für den optionalen Metadaten-Join) */
export const BUCKET_TYP: Record<string, string> = {
  "project-photos": "photos",
  "project-plans": "plans",
  "project-reports": "reports",
  "project-materials": "materials",
  "project-chef": "chef",
  "project-notizen": "notizen",
};

/** Nur dieser Bucket ist öffentlich — alle anderen brauchen signierte URLs. */
const PUBLIC_BUCKETS = new Set(["project-photos"]);

/** Echte Dateien aus dem Storage-Listing (Unterordner haben id===null,
 *  Supabase-Platzhalter beginnen mit "."). */
function realFiles<T extends { id: string | null; name: string }>(objects: T[]): T[] {
  return objects.filter((o) => o.id !== null && !o.name.startsWith("."));
}

/**
 * Listet alle Dateien eines Projekts direkt aus dem Storage-Bucket und
 * reichert sie (best effort) mit documents-Metadaten (Kommentar) an.
 * Gibt JEDES Storage-Objekt zurück, auch ohne documents-Zeile.
 */
export async function listProjectFiles(projectId: string, bucket: string): Promise<ProjectFile[]> {
  const { data: objects, error } = await supabase.storage
    .from(bucket)
    .list(projectId, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
  if (error || !objects) return [];

  const files = realFiles(objects);
  if (files.length === 0) return [];

  // URLs auflösen: public direkt, privat als (gebündelte) signierte URLs.
  const paths = files.map((o) => `${projectId}/${o.name}`);
  const urlByPath = new Map<string, string>();
  if (PUBLIC_BUCKETS.has(bucket)) {
    for (const p of paths) urlByPath.set(p, supabase.storage.from(bucket).getPublicUrl(p).data.publicUrl);
  } else {
    const { data: signed } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600);
    (signed || []).forEach((s, i) => { if (s?.signedUrl) urlByPath.set(paths[i], s.signedUrl); });
  }

  // documents-Metadaten einmalig laden und per Dateiname zuordnen.
  const typ = BUCKET_TYP[bucket];
  const metaByName = new Map<string, { id: string; beschreibung: string | null }>();
  if (typ) {
    const { data: rows } = await supabase
      .from("documents")
      .select("id, file_url, beschreibung")
      .eq("project_id", projectId)
      .eq("typ", typ);
    for (const r of ((rows as any[]) || [])) {
      const seg = decodeURIComponent(((r.file_url || "").split("/").pop() || ""));
      if (seg) metaByName.set(seg, { id: r.id, beschreibung: r.beschreibung ?? null });
    }
  }

  return files.map((o) => {
    const path = `${projectId}/${o.name}`;
    const meta = metaByName.get(o.name);
    return {
      path,
      name: o.name,
      url: urlByPath.get(path) || "",
      createdAt: (o as any).created_at || (o as any).updated_at || new Date().toISOString(),
      size: (o as any).metadata?.size ?? 0,
      docId: meta?.id ?? null,
      beschreibung: meta?.beschreibung ?? null,
    };
  });
}

/** Nur die Anzahl der Dateien (für Zähler/Badges) — identische Filterlogik
 *  wie listProjectFiles, aber ohne URL-/Metadaten-Auflösung (schnell). */
export async function countProjectFiles(projectId: string, bucket: string): Promise<number> {
  const { data: objects, error } = await supabase.storage.from(bucket).list(projectId, { limit: 1000 });
  if (error || !objects) return 0;
  return realFiles(objects).length;
}

/**
 * Löscht eine Datei: zuerst das Storage-Objekt (die Quelle der Wahrheit, die
 * auch der Zähler liest), danach best effort die documents-Zeile. So bleibt
 * die "Anzahl" außen automatisch synchron mit dem Ordner.
 */
export async function deleteProjectFile(bucket: string, file: ProjectFile): Promise<{ error?: string }> {
  const { error } = await supabase.storage.from(bucket).remove([file.path]);
  if (error) return { error: error.message };
  if (file.docId) await supabase.from("documents").delete().eq("id", file.docId);
  return {};
}
