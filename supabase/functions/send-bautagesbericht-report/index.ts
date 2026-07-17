import { Resend } from "https://esm.sh/resend@2.0.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Lazy: new Resend(undefined) WIRFT sofort beim Modul-Load ("Missing API key")
// und crasht die ganze Function — dann würde auch die PDF-Ablage nie laufen.
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Supabase Admin Client for reading settings
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Storage-sicherer Dateiname: Supabase Storage lehnt Keys mit Umlauten ab
// ('Invalid key') → Umlaute transliterieren, Rest auf [a-zA-Z0-9._-] eindampfen.
// Nur für STORAGE-Pfade verwenden — der Mail-Anhang behält die Umlaute.
function toStorageSafeName(name: string): string {
  return name
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

const LOGO_BASE64 = "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";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Material {
  id: string;
  material: string;
  menge: string | null;
  einheit: string | null;
  notizen: string | null;
}

interface Photo {
  id: string;
  file_path: string;
  file_name: string;
}

interface Bautagesbericht {
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
  unterschrift_kunde: string;
}

interface ReportRequest {
  bautagesbericht: Bautagesbericht;
  materials: Material[];
  technicianNames?: string[];
  technicianName?: string; // Legacy support
  photos?: Photo[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("de-AT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("de-AT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Failed to fetch image:", url, response.status);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    const contentType = response.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error("Error fetching image:", error);
    return null;
  }
}

async function generatePDF(data: ReportRequest & { technicians: string[] }, photoImages: (string | null)[]): Promise<string> {
  const { bautagesbericht, materials, technicians, photos } = data;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15; // einheitlich mit pdfLetterhead.ts
  const contentWidth = pageWidth - 2 * margin;
  let yPos = margin;

  // Helper: Section title with Akzentfarbe left border
  const sectionTitle = (title: string) => {
    doc.setFillColor(28, 107, 76);
    doc.rect(margin, yPos - 4, 2, 6, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 26, 26);
    doc.text(title, margin + 5, yPos);
    yPos += 7;
  };

  // Helper: Info row
  const infoRow = (label: string, value: string, bold = false) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(label, margin + 5, yPos);
    doc.setTextColor(26, 26, 26);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(value, margin + 42, yPos);
    yPos += 5;
  };

  // === EINHEITLICHER BRIEFKOPF (analog zu BTB/Ersttermin/Rechnung) ===
  // Logo 140mm breit, aspect-ratio-preserving
  const logoWidth = 32; // Holzbau-Lutz-Logo (quadratisch) — wie Rechnungs-Layout
  let logoBottomY = margin;
  try {
    const logoDataUrl = `data:image/png;base64,${LOGO_BASE64}`;
    const props = doc.getImageProperties(logoDataUrl);
    const aspect = props.width / props.height;
    const logoHeight = logoWidth / aspect;
    doc.addImage(logoDataUrl, "PNG", margin, margin, logoWidth, logoHeight);
    logoBottomY = margin + logoHeight;
  } catch (e) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 26, 26);
    doc.text("Holzbau Lutz OG", margin, 18);
    logoBottomY = margin + 10;
  }

  // Abstand unter dem Logo + graue Trennlinie (wie pdfLetterhead)
  yPos = Math.max(logoBottomY + 4, margin + 20);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;

  // "Bautagesbericht" Titel + Datum + Akzentlinie (wie drawTitleBlock)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(26, 26, 26);
  doc.text("Bautagesbericht", margin, yPos + 4);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(formatDate(bautagesbericht.datum), pageWidth - margin, yPos + 4, { align: "right" });
  yPos += 6;
  doc.setDrawColor(0, 119, 204);
  doc.setLineWidth(0.8);
  doc.line(margin, yPos + 1, pageWidth - margin, yPos + 1);
  yPos += 8;

  // === KEY INFO BOX (light gray background) ===
  const boxHeight = 28;
  doc.setFillColor(247, 247, 247);
  doc.roundedRect(margin, yPos, contentWidth, boxHeight, 2, 2, "F");
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, yPos, contentWidth, boxHeight, 2, 2, "S");

  const startTime = bautagesbericht.start_time.slice(0, 5);
  const endTime = bautagesbericht.end_time.slice(0, 5);
  const techDisplay = technicians.join(", ");
  const col1 = margin + 5;
  const col2 = margin + contentWidth * 0.35;
  const col3 = margin + contentWidth * 0.7;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("KUNDE", col1, yPos + 5);
  doc.text("ARBEITSZEIT", col2, yPos + 5);
  doc.text("STUNDEN", col3, yPos + 5);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 26, 26);
  doc.text(bautagesbericht.kunde_name, col1, yPos + 11);
  doc.text(`${startTime} – ${endTime} Uhr`, col2, yPos + 11);
  doc.text(`${Number(bautagesbericht.stunden || 0).toFixed(2)} h`, col3, yPos + 11);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  if (bautagesbericht.kunde_adresse) doc.text(bautagesbericht.kunde_adresse, col1, yPos + 16);
  doc.text(`Techniker: ${techDisplay}`, col2, yPos + 16);
  if (bautagesbericht.pause_minutes > 0) {
    doc.text(`Pause: ${bautagesbericht.pause_minutes} Min.`, col3, yPos + 16);
  }

  // Contact info in smaller text
  const contactParts: string[] = [];
  if (bautagesbericht.kunde_telefon) contactParts.push(`Tel: ${bautagesbericht.kunde_telefon}`);
  if (bautagesbericht.kunde_email) contactParts.push(bautagesbericht.kunde_email);
  if (contactParts.length > 0) {
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text(contactParts.join(" · "), col1, yPos + 21);
  }

  yPos += boxHeight + 10;

  // === DURCHGEFÜHRTE ARBEITEN ===
  sectionTitle("Durchgeführte Arbeiten");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 40);
  const beschreibungLines = doc.splitTextToSize(bautagesbericht.beschreibung, contentWidth - 5);
  doc.text(beschreibungLines, margin + 5, yPos);
  yPos += beschreibungLines.length * 4.5 + 6;

  // === NOTIZEN ===
  if (bautagesbericht.notizen) {
    sectionTitle("Notizen");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const notizenLines = doc.splitTextToSize(bautagesbericht.notizen, contentWidth - 5);
    doc.text(notizenLines, margin + 5, yPos);
    yPos += notizenLines.length * 4.5 + 6;
  }

  // Materials Section
  if (materials && materials.length > 0) {
    if (yPos > 220) { doc.addPage(); yPos = margin; }

    sectionTitle("Verwendetes Material");

    // Table header
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("MATERIAL", margin + 5, yPos);
    doc.text("MENGE / EINHEIT", margin + 95, yPos);
    doc.text("NOTIZEN", margin + 130, yPos);
    yPos += 2;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin + 5, yPos, margin + contentWidth, yPos);
    yPos += 4;

    doc.setTextColor(26, 26, 26);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    materials.forEach((mat, idx) => {
      if (yPos > 270) { doc.addPage(); yPos = margin; }
      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin + 3, yPos - 3.5, contentWidth - 3, 6, "F");
      }
      doc.setTextColor(26, 26, 26);
      doc.text(mat.material || "-", margin + 5, yPos);
      doc.setTextColor(80, 80, 80);
      const mengeText = mat.menge ? `${mat.menge}${mat.einheit ? ` ${mat.einheit}` : ""}` : "-";
      doc.text(mengeText, margin + 95, yPos);
      doc.text(mat.notizen || "-", margin + 130, yPos);
      yPos += 6;
    });
    yPos += 6;
  }

  // Photos Section (if present)
  if (photos && photos.length > 0 && photoImages.some(img => img !== null)) {
    // Start new page for photos
    doc.addPage();
    yPos = margin;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Fotos", margin, yPos);
    yPos += 10;

    for (let i = 0; i < photos.length; i++) {
      const imageData = photoImages[i];
      if (!imageData) continue;

      // Check if we need a new page
      if (yPos > 200) {
        doc.addPage();
        yPos = margin;
      }

      try {
        // Add image with max width 80mm, proportional height ~60mm
        // Format aus der Data-URL ableiten — PNGs würden als "JPEG" still fehlen
        const imageFormat = imageData.startsWith("data:image/png") ? "PNG" : "JPEG";
        doc.addImage(imageData, imageFormat, margin, yPos, 80, 60);
        yPos += 65;

        // Add filename below image
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(photos[i].file_name, margin, yPos);
        yPos += 8;
        doc.setTextColor(0, 0, 0);
      } catch (e) {
        console.error("Error adding image to PDF:", e);
      }
    }
  }

  // === UNTERSCHRIFT (optional — Abschnitt entfällt ohne Unterschrift) ===
  if (bautagesbericht.unterschrift_kunde) {
    if (yPos > 210) { doc.addPage(); yPos = margin; }

    sectionTitle("Kundenunterschrift");

    try {
      doc.addImage(bautagesbericht.unterschrift_kunde, "PNG", margin + 5, yPos, 55, 22);
      yPos += 26;
    } catch (e) {
      console.error("Error adding signature:", e);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text("[Unterschrift konnte nicht geladen werden]", margin + 5, yPos + 8);
      yPos += 16;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(130, 130, 130);
    doc.text("Der Kunde bestätigt die ordnungsgemäße Durchführung der oben genannten Arbeiten.", margin + 5, yPos);
  }
  yPos += 10;

  // === FOOTER (einheitlich mit anderen PDFs) ===
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 12;

  // Akzent-Linie (2px stark, wie drawFooter in pdfLetterhead)
  doc.setDrawColor(28, 107, 76);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(102, 102, 102);
  doc.text("Holzbau Lutz OG · Zimmerei & Holzbau", pageWidth / 2, footerY + 3.5, { align: "center" });
  doc.setFontSize(6.5);
  doc.text(`Erstellt: ${new Date().toLocaleDateString("de-AT")}`, pageWidth - margin, footerY + 3.5, { align: "right" });

  // Return as base64
  return doc.output("datauristring").split(",")[1];
}

function generateEmailHtml(data: ReportRequest & { technicians: string[] }): string {
  const { bautagesbericht, technicians } = data;
  const technicianDisplay = technicians.length === 1 ? technicians[0] : technicians.join(", ");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; color: #333; line-height: 1.5; }
        .header { font-size: 12px; font-weight: 900; color: #1A1A1A; letter-spacing: 2px; margin-bottom: 2px; }
        .header-large { font-size: 28px; font-weight: 900; color: #1A1A1A; letter-spacing: 1px; margin-bottom: 4px; }
        .header-sub { font-size: 11px; color: #64748b; margin-bottom: 10px; }
        .red-bar { height: 3px; background: #0E5A44; margin-bottom: 16px; border-radius: 2px; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .info-box { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #0E5A44; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">Holzbau Lutz OG</div>
        <div class="header-large">Zimmerei & Holzbau</div>
        <div class="header-sub">Am Sportplatz 3 · 6642 Stanzach · 0699/191 68 685 · info@holzbau-lutz.at</div>
        <div class="red-bar"></div>
        <h2>Bautagesbericht</h2>

        <p>Sehr geehrte Damen und Herren,</p>

        <p>im Anhang finden Sie den Bautagesbericht für den Einsatz bei <strong>${bautagesbericht.kunde_name}</strong> vom <strong>${formatDate(bautagesbericht.datum)}</strong>.</p>

        <div class="info-box">
          <strong>Zusammenfassung:</strong><br>
          Techniker: ${technicianDisplay}<br>
          Arbeitszeit: ${bautagesbericht.start_time.slice(0, 5)} - ${bautagesbericht.end_time.slice(0, 5)} Uhr<br>
          Gesamtstunden: ${Number(bautagesbericht.stunden || 0).toFixed(2)} h
        </div>

        <p>Der vollständige Bericht mit allen Details und der Kundenunterschrift befindet sich im angehängten PDF-Dokument.</p>

        <p>Mit freundlichen Grüßen,<br>
        Holzbau Lutz OG<br>
        <span style="color:#64748b;font-size:12px;">Zimmerei & Holzbau</span></p>
      </div>
    </body>
    </html>
  `;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // AUTH: Nur eingeloggte, aktive App-Nutzer dürfen versenden — die Function
    // läuft sonst unauthentifiziert mit Service-Role (Spam-/Phishing-Risiko,
    // beliebige Schreibzugriffe auf Projektordner). Gleiches Muster wie
    // create-team-time-entries.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Nicht angemeldet" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Ungültige Anmeldung" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const body = await req.json();
    const { bautagesbericht, materials, technicianNames, technicianName, photos }: ReportRequest = body;
    // pdfOnly: nur PDF erzeugen + ablegen (Bericht + Projektordner), KEINE E-Mail —
    // für das automatische Speichern beim Erstellen (ohne Unterschrift).
    const pdfOnly: boolean = body.pdfOnly === true;

    // Backward compatibility + fallback
    const technicians = technicianNames?.length ? technicianNames :
                        technicianName ? [technicianName] : ["Techniker"];

    // Unterschrift ist OPTIONAL — Bautagesberichte werden auch ohne
    // Kundenunterschrift als PDF erzeugt und abgelegt.
    if (!bautagesbericht) {
      return new Response(
        JSON.stringify({ error: "Bautagesbericht data required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Generating PDF for bautagesbericht:", bautagesbericht.id);

    // Fetch photo images from storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const photoImages: (string | null)[] = [];
    if (photos && photos.length > 0) {
      console.log(`Fetching ${photos.length} photos...`);
      for (const photo of photos) {
        const photoUrl = `${supabaseUrl}/storage/v1/object/public/bautagesbericht-photos/${photo.file_path}`;
        const imageData = await fetchImageAsBase64(photoUrl);
        photoImages.push(imageData);
      }
    }

    // Generate PDF
    const pdfBase64 = await generatePDF({ bautagesbericht, materials, technicians, photos }, photoImages);

    // Generate simple email HTML
    const emailHtml = generateEmailHtml({ bautagesbericht, materials, technicians });

    // Fetch office email from settings with fallback
    const { data: setting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "disturbance_report_email")
      .maybeSingle();

    const officeEmail = setting?.value || "info@holzbau-lutz.at";
    console.log("Using office email:", officeEmail);

    // Prepare recipients - office email for all reports
    const recipients = [officeEmail];
    if (bautagesbericht.kunde_email) {
      recipients.push(bautagesbericht.kunde_email);
    }

    // Create filename
    const dateForFilename = formatDateShort(bautagesbericht.datum).replace(/\./g, "-");
    const kundeForFilename = bautagesbericht.kunde_name.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_");
    const pdfFilename = `Bautagesbericht_${kundeForFilename}_${dateForFilename}.pdf`;

    const subject = `Bautagesbericht - ${bautagesbericht.kunde_name} - ${formatDateShort(bautagesbericht.datum)}`;

    // WICHTIG: PDF-Ablage ZUERST (Berichts-Bucket + Projektordner), Mail danach.
    // So liegt der unterschriebene Bericht auch dann im Projekt, wenn der
    // Mail-Versand fehlschlägt oder (noch) nicht konfiguriert ist.
    let pdfStored = false;
    let projectStored = false;
    try {
      const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
      const storagePath = `${bautagesbericht.id}/${toStorageSafeName(pdfFilename)}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("bautagesbericht-pdfs")
        .upload(storagePath, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        console.error("PDF upload error:", uploadError);
      } else {
        pdfStored = true;
        // Save PDF path on the bautagesbericht record
        await supabaseAdmin
          .from("bautagesberichte")
          .update({ pdf_path: storagePath, pdf_gesendet_am: new Date().toISOString() })
          .eq("id", bautagesbericht.id);
        console.log("PDF stored at:", storagePath);
      }

      // Zusätzlich im Projekt-Ordner ablegen, wenn Projekt zugeordnet
      if ((bautagesbericht as any).project_id) {
        const sanitizedName = toStorageSafeName(pdfFilename);
        const projectPath = `${(bautagesbericht as any).project_id}/bautagesberichte/${sanitizedName}`;
        const { error: projErr } = await supabaseAdmin.storage
          .from("project-reports")
          .upload(projectPath, pdfBytes, {
            contentType: "application/pdf",
            upsert: true,
          });
        if (projErr) {
          console.error("Bautagesbericht-PDF-Upload in Projektordner fehlgeschlagen:", projErr);
        } else {
          projectStored = true;
          console.log("Bautagesbericht-PDF im Projektordner abgelegt:", projectPath);
        }
      }
    } catch (storageErr) {
      console.error("PDF storage failed:", storageErr);
    }

    // pdfOnly: fertig — Bericht-PDF ist gespeichert (und ggf. im Projektordner).
    if (pdfOnly) {
      return new Response(
        JSON.stringify({ success: true, pdfStored, projectStored }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // E-Mail-Versand — klare Meldung, wenn Resend (noch) nicht konfiguriert ist.
    if (!Deno.env.get("RESEND_API_KEY")) {
      console.error("RESEND_API_KEY fehlt — E-Mail-Versand nicht konfiguriert.");
      return new Response(
        JSON.stringify({
          error: "E-Mail-Versand ist noch nicht konfiguriert (RESEND_API_KEY fehlt). Das PDF wurde gespeichert" + (projectStored ? " und im Projektordner abgelegt." : "."),
          pdfStored, projectStored,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Sending email with PDF attachment to:", recipients);

    // Use Resend test domain if holzbau-lutz.at is not verified yet
    // Once domain is verified in Resend dashboard, change back to noreply@holzbau-lutz.at
    const fromAddress = Deno.env.get("RESEND_FROM_EMAIL") || "Holzbau Lutz OG <onboarding@resend.dev>";

    console.log("Sending from:", fromAddress);

    const emailResponse = await resend!.emails.send({
      from: fromAddress,
      reply_to: officeEmail,
      to: recipients,
      subject: subject,
      html: emailHtml,
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBase64,
        },
      ],
    });

    console.log("Resend response:", JSON.stringify(emailResponse));

    // Check for Resend errors — PDF ist zu diesem Zeitpunkt bereits gespeichert.
    if (emailResponse?.error) {
      console.error("Resend error:", JSON.stringify(emailResponse.error));
      return new Response(
        JSON.stringify({
          error: (emailResponse.error.message || "E-Mail konnte nicht gesendet werden") + (pdfStored ? " — das PDF wurde gespeichert." : ""),
          details: emailResponse.error, pdfStored, projectStored,
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email sent successfully:", JSON.stringify(emailResponse));

    return new Response(
      JSON.stringify({ success: true, emailResponse, pdfStored, projectStored }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error sending bautagesbericht report:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
