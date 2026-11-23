// PDF drucken, ohne den PDF-Betrachter des Browsers (23.11.2026, Fall Tilger – gleiche Datei in allen Kunden-Apps).
//
// Früher: PDF als blob-URL in neuem Tab öffnen und dort print() aufrufen. Zeigt ein anderer PDF-Betrachter das PDF an
// (beim Kunden die Adobe-Acrobat-Erweiterung in Chrome), druckt print() nur die leere Hülle → weiße Seite mit Datum und
// blob-Adresse. Ein unsichtbarer iframe mit dem PDF hängt ebenso am Betrachter, und am iPhone/iPad druckt
// iframe.print() nur Seite 1 bzw. die ganze App-Seite.
//
// Jetzt (Weg wie in ruffmichael, dort seit 09/2026 auch am iPhone im Einsatz): pdf.js zeichnet die Seiten GENAU DIESES
// PDFs als Bilder, die kommen in einen Druckbereich der App-Seite, @media print blendet alles andere aus, dann
// window.print(). Kein neuer Tab, kein Popup-Blocker, kein fremder Betrachter dazwischen. Inhalt = Download-PDF.
// Klappt pdf.js nicht (sehr alter Browser): PDF im neuen Tab öffnen, OHNE print() – dort druckt man selbst.
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

const BEREICH_ID = "pdf-druckbereich";
let laeuft = false;

interface Seite {
  src: string;
  breiteMm: number;
  hoeheMm: number;
}

function istHandyOderTablet(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
}

async function seitenZeichnen(pdf: Blob): Promise<Seite[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  // PC 300 dpi (Druckqualität); Handy/Tablet 200 dpi – weniger Speicher, auf Papier trotzdem scharf
  const dpi = istHandyOderTablet() ? 200 : 300;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) }).promise;
  const seiten: Seite[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const seite = await doc.getPage(n);
      const basis = seite.getViewport({ scale: 1 }); // in pt (1/72 Zoll)
      const viewport = seite.getViewport({ scale: dpi / 72 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas nicht verfügbar");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // canvas + canvasContext: passt für pdf.js 4 (canvasContext) und 5 (canvas)
      await seite.render({ canvasContext: ctx, canvas, viewport } as Parameters<typeof seite.render>[0]).promise;
      seiten.push({
        src: canvas.toDataURL("image/png"),
        breiteMm: (basis.width / 72) * 25.4,
        hoeheMm: (basis.height / 72) * 25.4,
      });
      canvas.width = 0; // Speicher sofort freigeben (wichtig am iPhone)
      canvas.height = 0;
      seite.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return seiten;
}

function druckbereichAufbauen(seiten: Seite[]): HTMLElement {
  document.getElementById(BEREICH_ID)?.remove();
  const b = seiten[0].breiteMm.toFixed(1);
  const h = seiten[0].hoeheMm.toFixed(1);
  const bereich = document.createElement("div");
  bereich.id = BEREICH_ID;
  bereich.setAttribute("aria-hidden", "true");
  const stil = document.createElement("style");
  // „:not(#_)“ hebt die Regeln über z. B. body[data-scroll-locked] eines offenen Dialogs (der sperrt sonst den Überlauf).
  stil.textContent = `
#${BEREICH_ID}{display:none}
@media print{
  @page{size:${b}mm ${h}mm;margin:0}
  html:not(#_),body:not(#_){margin:0!important;padding:0!important;background:#fff!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;position:static!important}
  body:not(#_)>*:not(#${BEREICH_ID}){display:none!important}
  #${BEREICH_ID}{display:block!important}
  #${BEREICH_ID} img{display:block;margin:0;max-width:none;object-fit:contain;break-inside:avoid;break-after:page;page-break-after:always}
  #${BEREICH_ID} img:last-of-type{break-after:auto;page-break-after:auto}
}`;
  bereich.appendChild(stil);
  for (const s of seiten) {
    const img = document.createElement("img");
    img.src = s.src;
    img.alt = "";
    img.style.width = `${s.breiteMm.toFixed(1)}mm`;
    // 0,5 mm Luft: sonst rundet der Browser manchmal auf und hängt eine leere Seite an
    img.style.height = `${(s.hoeheMm - 0.5).toFixed(1)}mm`;
    bereich.appendChild(img);
  }
  document.body.appendChild(bereich);
  return bereich;
}

/** Druckt das PDF über die App selbst (Druckdialog des Browsers mit den echten PDF-Seiten). */
export async function druckePdf(pdf: Blob | string): Promise<void> {
  if (laeuft) return; // Doppelklick
  laeuft = true;
  try {
    const blob = typeof pdf === "string" ? await (await fetch(pdf)).blob() : pdf;
    let seiten: Seite[];
    try {
      seiten = await seitenZeichnen(blob);
      if (!seiten.length) throw new Error("PDF ohne Seiten");
    } catch (err) {
      console.error("Druck über pdf.js nicht möglich, öffne PDF im neuen Tab:", err);
      const url = URL.createObjectURL(blob);
      const tab = window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
      if (!tab) throw new Error("Drucken nicht möglich – bitte „PDF herunterladen“ und von dort drucken.");
      return;
    }
    const bereich = druckbereichAufbauen(seiten);
    // Warten, bis alle Seitenbilder dekodiert sind – sonst druckt v. a. Safari leere Seiten
    await Promise.all(
      Array.from(bereich.querySelectorAll("img")).map((img) =>
        typeof img.decode === "function"
          ? img.decode().catch(() => undefined)
          : new Promise<void>((ok) => {
              if (img.complete) return ok();
              img.onload = () => ok();
              img.onerror = () => ok();
            })),
    );
    const aufraeumen = () => {
      window.removeEventListener("afterprint", aufraeumen);
      bereich.remove();
    };
    window.addEventListener("afterprint", aufraeumen);
    setTimeout(aufraeumen, 10 * 60_000); // Sicherheitsnetz, falls afterprint nie kommt
    window.print();
  } finally {
    laeuft = false;
  }
}
