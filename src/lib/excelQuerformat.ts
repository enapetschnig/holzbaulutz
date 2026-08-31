/**
 * Excel-Export im Querformat ausliefern.
 *
 * xlsx-js-style schreibt zwar Seitenränder (`!margins`), aber KEIN
 * `<pageSetup>` — Ausrichtung und "an Seitenbreite anpassen" lassen sich
 * dort nicht setzen. Deshalb wird die fertige .xlsx (ein Zip) hier einmal
 * geöffnet, das Arbeitsblatt-XML um Querformat + fitToWidth ergänzt und
 * wieder verpackt. Excel/LibreOffice drucken die Datei dann ohne weiteres
 * Zutun quer über die volle Seitenbreite.
 */
import * as XLSX from "xlsx-js-style";
import JSZip from "jszip";

/** Schmale Ränder, damit im Querformat alle Spalten Platz haben. */
export const QUER_RAENDER = {
  left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2,
};

export async function querformatXlsxSpeichern(
  wb: XLSX.WorkBook,
  dateiname: string,
): Promise<void> {
  const roh = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

  try {
    const zip = await JSZip.loadAsync(roh);
    // Das erste (und einzige) Blatt der Auswertungs-Exporte.
    const pfad = "xl/worksheets/sheet1.xml";
    const datei = zip.file(pfad);
    if (datei) {
      let xml = await datei.async("string");
      // "An Seitenbreite anpassen" gilt nur mit fitToPage im sheetPr —
      // das muss laut Schema direkt nach <worksheet> stehen.
      if (!xml.includes("<sheetPr") && !xml.includes("<pageSetup")) {
        xml = xml.replace(
          /(<worksheet[^>]*>)/,
          '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>',
        );
        // pageSetup gehört direkt hinter pageMargins (Schema-Reihenfolge).
        const setup = '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>';
        xml = xml.includes("<pageMargins")
          ? xml.replace(/(<pageMargins[^/]*\/>)/, `$1${setup}`)
          : xml.replace("</worksheet>", `${setup}</worksheet>`);
        zip.file(pfad, xml);
      }
      const blob = await zip.generateAsync({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = dateiname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }
  } catch {
    // Fällt unten auf den normalen Download zurück.
  }
  // Nachbearbeitung fehlgeschlagen: Datei wenigstens im Hochformat liefern.
  XLSX.writeFile(wb, dateiname);
}
