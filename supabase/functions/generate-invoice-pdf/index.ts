import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fmt(val: number): string {
  return val.toFixed(2).replace('.', ',');
}

function fmtCurrency(val: number): string {
  return `€ ${fmt(val)}`;
}

function parseLayoutSettings(value: string | null): any {
  const DEFAULT = {
    company: { name: "Holzbau Lutz OG", slogan: "Zimmerei & Holzbau", address_line1: "Am Sportplatz 3", address_line2: "6642 Stanzach", phone: "0699/191 68 685", email: "info@holzbau-lutz.at", website: "" },
    logo: { enabled: true, position: "left", width_mm: 45, height_mm: 18 },
    footer: { line1: "", line2: "", line3: "", show_bank_in_footer: true, show_page_numbers: true },
    sender_line: "", closing_text_invoice: "", closing_text_angebot: "", danke_text: "Vielen Dank für Ihren Auftrag!", accent_color: "#0E5A44"
  };
  if (!value) return DEFAULT;
  try {
    const p = JSON.parse(value);
    return {
      company: { ...DEFAULT.company, ...(p.company || {}) },
      logo: { ...DEFAULT.logo, ...(p.logo || {}) },
      footer: { ...DEFAULT.footer, ...(p.footer || {}) },
      sender_line: p.sender_line || DEFAULT.sender_line,
      accent_color: p.accent_color || DEFAULT.accent_color,
      danke_text: p.danke_text || DEFAULT.danke_text,
      closing_text_invoice: p.closing_text_invoice || DEFAULT.closing_text_invoice,
      closing_text_angebot: p.closing_text_angebot || DEFAULT.closing_text_angebot,
    };
  } catch { return DEFAULT; }
}

const LOGO_IMG = `<img src="data:image/png;base64,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" alt="Holzbau Lutz" style="height:24mm;width:auto;display:block;" />`;
function buildHtml(invoice: any, items: any[], bank: { kontoinhaber: string; iban: string; bic: string } = { kontoinhaber: "", iban: "", bic: "" }, layout: any = parseLayoutSettings(null)): string {
  const isAngebot = invoice.typ === "angebot";
  const typLabel = isAngebot ? "Angebot" : "Rechnung";
  const accent = layout.accent_color || "#0E5A44";
  const co = layout.company;
  const ft = layout.footer;

  const datumFormatted = new Date(invoice.datum).toLocaleDateString("de-AT");
  const faelligFormatted = invoice.faellig_am ? new Date(invoice.faellig_am).toLocaleDateString("de-AT") : null;
  const leistungFormatted = invoice.leistungsdatum ? new Date(invoice.leistungsdatum).toLocaleDateString("de-AT") : null;
  const gueltigBisFormatted = invoice.gueltig_bis ? new Date(invoice.gueltig_bis).toLocaleDateString("de-AT") : null;

  const bezahltBetrag = Number(invoice.bezahlt_betrag) || 0;
  const rabattProzent = Number(invoice.rabatt_prozent) || 0;
  const rabattBetrag = Number(invoice.rabatt_betrag) || 0;
  const positionenNetto = (items || []).reduce((sum: number, it: any) => sum + Number(it.gesamtpreis), 0);
  const rabattWert = rabattProzent > 0 ? positionenNetto * (rabattProzent / 100) : rabattBetrag;
  const hasRabatt = rabattWert > 0;
  const restBetrag = Number(invoice.brutto_summe) - bezahltBetrag;
  const showPaymentInfo = !isAngebot && bezahltBetrag > 0;
  const mahnstufe = Number(invoice.mahnstufe) || 0;

  const itemRows = (items || []).map((item: any, idx: number) => {
    // Kurztext als Hauptzeile + optionaler Langtext darunter (kleiner, grau) —
    // wie im Client-PDF. Vorher wurde nur beschreibung gerendert, dadurch fehlte
    // der Langtext auf der Server-/Export-PDF.
    const kurz = item.kurztext || item.beschreibung || '';
    const lang = (item.langtext && item.langtext !== kurz) ? item.langtext : '';
    const descCell = lang
      ? `${kurz}<div style="margin-top:3px;color:#555;font-size:8.5pt;white-space:pre-wrap;">${lang}</div>`
      : kurz;
    return `
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'};">
      <td style="padding:9px 12px;border-bottom:1px solid #e8e8e8;color:#888;text-align:center;font-size:9pt;">${item.position}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e8e8e8;color:#1a1a1a;font-size:9.5pt;white-space:pre-wrap;">${descCell}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e8e8e8;text-align:right;color:#444;font-size:9pt;">${fmt(Number(item.menge))}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e8e8e8;text-align:center;color:#444;font-size:9pt;">${item.einheit || 'Stk.'}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e8e8e8;text-align:right;color:#444;font-size:9pt;">${fmtCurrency(Number(item.einzelpreis))}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e8e8e8;text-align:right;font-weight:600;color:#1a1a1a;font-size:9.5pt;">${fmtCurrency(Number(item.gesamtpreis))}</td>
    </tr>`;
  }).join("");

  let totalsHtml = '';
  if (hasRabatt) {
    totalsHtml += `<tr><td style="padding:5px 0;color:#666;font-size:9.5pt;">Zwischensumme</td><td style="padding:5px 0;text-align:right;color:#333;font-size:9.5pt;">${fmtCurrency(positionenNetto)}</td></tr>`;
    totalsHtml += `<tr><td style="padding:5px 0;color:${accent};font-size:9.5pt;">Rabatt${rabattProzent > 0 ? ` (${rabattProzent}%)` : ''}</td><td style="padding:5px 0;text-align:right;color:${accent};font-size:9.5pt;">- ${fmtCurrency(rabattWert)}</td></tr>`;
  }
  totalsHtml += `<tr><td style="padding:5px 0;color:#666;font-size:9.5pt;">Nettobetrag</td><td style="padding:5px 0;text-align:right;color:#333;font-size:9.5pt;">${fmtCurrency(Number(invoice.netto_summe))}</td></tr>`;
  totalsHtml += `<tr><td style="padding:5px 0;color:#666;font-size:9.5pt;">USt. ${Number(invoice.mwst_satz).toFixed(0)}%</td><td style="padding:5px 0;text-align:right;color:#333;font-size:9.5pt;">${fmtCurrency(Number(invoice.mwst_betrag))}</td></tr>`;
  totalsHtml += `<tr><td colspan="2" style="padding:0;"><div style="border-top:2px solid ${accent};margin:6px 0;"></div></td></tr>`;
  totalsHtml += `<tr><td style="padding:6px 0;font-size:14pt;font-weight:800;color:#1a1a1a;">Gesamtbetrag</td><td style="padding:6px 0;text-align:right;font-size:14pt;font-weight:800;color:#1a1a1a;">${fmtCurrency(Number(invoice.brutto_summe))}</td></tr>`;
  if (showPaymentInfo) {
    totalsHtml += `<tr><td style="padding:4px 0;color:#16a34a;font-size:9pt;">Bereits bezahlt</td><td style="padding:4px 0;text-align:right;color:#16a34a;font-size:9pt;">${fmtCurrency(bezahltBetrag)}</td></tr>`;
    totalsHtml += `<tr><td style="padding:4px 0;font-weight:700;color:${accent};font-size:10pt;">Offener Betrag</td><td style="padding:4px 0;text-align:right;font-weight:700;color:${accent};font-size:10pt;">${fmtCurrency(restBetrag)}</td></tr>`;
  }

  const metaParts: string[] = [];
  metaParts.push(`<div><span class="meta-label">${typLabel} Nr.</span><span class="meta-value">${invoice.nummer}</span></div>`);
  metaParts.push(`<div><span class="meta-label">Datum</span><span class="meta-value">${datumFormatted}</span></div>`);
  if (!isAngebot && leistungFormatted) metaParts.push(`<div><span class="meta-label">Leistungsdatum</span><span class="meta-value">${leistungFormatted}</span></div>`);
  if (!isAngebot && faelligFormatted) metaParts.push(`<div><span class="meta-label">Fällig am</span><span class="meta-value">${faelligFormatted}</span></div>`);
  if (gueltigBisFormatted) metaParts.push(`<div><span class="meta-label">Gültig bis</span><span class="meta-value">${gueltigBisFormatted}</span></div>`);
  if (!isAngebot && invoice.zahlungsbedingungen) metaParts.push(`<div><span class="meta-label">Zahlung</span><span class="meta-value">${invoice.zahlungsbedingungen}</span></div>`);

  const mahnBanner = mahnstufe > 0 ? `
    <div style="background:#fef6ed;border:2px solid ${accent};border-radius:6px;padding:12px 20px;margin-bottom:20px;text-align:center;font-weight:800;color:${accent};font-size:12pt;letter-spacing:1px;">
      ⚠ ${mahnstufe}. MAHNUNG
    </div>` : '';

  const defaultClosingInvoice = "Wir bedanken uns für Ihren Auftrag und bitten um Überweisung des Rechnungsbetrages innerhalb der angegebenen Zahlungsfrist.";
  const defaultClosingAngebot = "Wir freuen uns auf Ihren Auftrag und stehen für Rückfragen jederzeit gerne zur Verfügung.";
  const closingText = isAngebot
    ? `<div class="closing-text">${layout.closing_text_angebot || defaultClosingAngebot}</div>`
    : `<div class="closing-text">${layout.closing_text_invoice || defaultClosingInvoice}</div>`;

  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>${typLabel} ${invoice.nummer}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 22mm 15mm 28mm 15mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-wrap { padding: 0; }
    .no-print { display: none !important; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif; font-size: 9pt; color: #333; line-height: 1.5; }
  .heading, .doc-title, .recipient-name { font-family: "Montserrat", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 800; letter-spacing: -0.01em; }
  .page-wrap { max-width: 210mm; margin: 0 auto; padding: 15mm; }

  /* Running header on every page */
  .running-header { display: none; }
  @media print {
    .running-header { display: flex; position: fixed; top: -8mm; left: 0; right: 0; justify-content: space-between; align-items: center; padding-bottom: 4px; border-bottom: 1px solid #ddd; font-size: 7pt; color: #888; }
    .running-header img { height: 28px; width: auto; }
  }

  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 1px solid #ccc; margin-bottom: 18px; gap: 10px; }
  .header-logo { flex: 0 0 auto; }
  .header-logo img { width: 140mm; height: auto; display: block; }
  .header-info { text-align: right; font-size: 7pt; color: #666; line-height: 1.5; max-width: 40mm; }
  .header-info strong { color: #1a1a1a; font-size: 8pt; font-family: "Montserrat", "Segoe UI", sans-serif; font-weight: 700; }

  .address-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px; }
  .recipient { flex: 1; }
  .sender-line { font-size: 7pt; color: #999; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin-bottom: 8px; }
  .recipient-name { font-weight: 700; font-size: 10pt; color: #1a1a1a; }
  .recipient-addr { font-size: 9pt; color: #555; line-height: 1.6; }
  .doc-meta { text-align: right; min-width: 180px; }
  .doc-meta-row { display: flex; justify-content: space-between; gap: 12px; font-size: 8.5pt; line-height: 1.8; }
  .doc-meta-label { color: #888; }
  .doc-meta-value { color: #1a1a1a; font-weight: 600; }

  .doc-title { font-size: 14pt; font-weight: 800; color: #1a1a1a; margin-bottom: 16px; border-bottom: 2px solid ${accent}; padding-bottom: 6px; }

  table.items { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  table.items thead { display: table-header-group; }
  table.items thead th { border-bottom: 2px solid #333; padding: 6px 8px; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; color: #555; background: #fff; }
  table.items tbody td { padding: 7px 8px; border-bottom: 1px solid #e0e0e0; font-size: 8.5pt; vertical-align: top; }
  table.items tbody tr { page-break-inside: avoid; }
  table.items tbody tr:last-child td { border-bottom: 2px solid #333; }

  .totals-section { page-break-inside: avoid; break-inside: avoid; }
  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 18px; }
  .totals-table { width: 250px; }
  .totals-table td { padding: 3px 0; font-size: 9pt; }

  .notes { border-left: 3px solid #ddd; padding: 8px 14px; font-size: 8.5pt; color: #555; margin-bottom: 14px; }
  .closing-text { font-size: 8.5pt; color: #666; margin-bottom: 14px; padding-top: 8px; page-break-inside: avoid; break-inside: avoid; }

  .bank-info { page-break-inside: avoid; break-inside: avoid; margin-bottom: 10px; }
  .bank-info-row { font-size: 8pt; color: #555; }
  .bank-info-row strong { color: #333; }

  .footer { border-top: 2px solid ${accent}; padding-top: 6px; font-size: 7pt; color: #666; line-height: 1.5; margin-top: 24px; }
  @media print {
    .footer { position: fixed; bottom: -18mm; left: 0; right: 0; margin-top: 0; }
  }
  .footer-line { text-align: center; }

  .storniert::after { content: 'STORNIERT'; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 72pt; color: rgba(204,0,0,0.08); font-weight: 900; pointer-events: none; letter-spacing: 8px; }
</style>
</head>
<body class="${invoice.status === 'storniert' ? 'storniert' : ''}">

${mahnBanner}

<!-- Header -->
<div class="header-bar">
  <div class="header-left">
    ${LOGO_IMG}
  </div>
  <div class="header-right">
    <div class="header-contact">
      ${co.address_line1 ? `${co.address_line1}` : ''}${co.address_line2 ? ` · ${co.address_line2}` : ''}<br>
      ${co.phone ? `Tel: ${co.phone}<br>` : ''}
      ${co.email ? `<a href="mailto:${co.email}">${co.email}</a>` : ''}
    </div>
    <div class="doc-badge">${typLabel}</div>
  </div>
</div>

<div class="sender-line">${layout.sender_line || `${co.name}${co.slogan ? ` · ${co.slogan}` : ''}${co.address_line1 ? ` · ${co.address_line1}` : ''}${co.address_line2 ? ` · ${co.address_line2}` : ''}`}</div>

<div class="addr-block">
  <div class="addr-name">${invoice.kunde_name}</div>
  <div class="addr-detail">
    ${invoice.kunde_adresse ? `${invoice.kunde_adresse}<br>` : ''}
    ${(invoice.kunde_plz || invoice.kunde_ort) ? `${invoice.kunde_plz || ''} ${invoice.kunde_ort || ''}<br>` : ''}
    ${invoice.kunde_land && invoice.kunde_land !== 'Österreich' ? `${invoice.kunde_land}<br>` : ''}
    ${invoice.kunde_uid ? `<span style="color:#999;font-size:8pt;">UID: ${invoice.kunde_uid}</span>` : ''}
  </div>
</div>

<!-- Document Meta -->
<div class="meta-grid">
  ${metaParts.join('')}
</div>

<!-- Items Table -->
<table class="items">
  <thead>
    <tr>
      <th style="width:36px;text-align:center;">Pos</th>
      <th style="text-align:left;">Beschreibung</th>
      <th style="width:60px;text-align:right;">Menge</th>
      <th style="width:50px;text-align:center;">Einheit</th>
      <th style="width:90px;text-align:right;">Einzelpreis</th>
      <th style="width:100px;text-align:right;">Gesamt</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
  </tbody>
</table>

<!-- Totals -->
<div class="totals-section">
  <div class="totals-wrap">
    <table class="totals-table">
      ${totalsHtml}
    </table>
  </div>
</div>

${invoice.notizen ? `<div class="notes"><strong>Anmerkung:</strong> ${invoice.notizen}</div>` : ''}

${closingText}

${!isAngebot ? `<!-- Bank Details -->
<div class="bank-info">
  <div class="bank-info-title">Bankverbindung</div>
  <div class="bank-info-grid">
    <div><div class="bank-info-label">Kontoinhaber</div><div class="bank-info-value">${bank.kontoinhaber}</div></div>
    <div><div class="bank-info-label">IBAN</div><div class="bank-info-value">${bank.iban}</div></div>
    <div><div class="bank-info-label">BIC</div><div class="bank-info-value">${bank.bic}</div></div>
  </div>
</div>` : ''}

<!-- Footer -->
<div class="footer">
  <div class="footer-line">
    ${ft.line1 || `<span><span class="footer-accent">${co.name}</span>${co.slogan ? ` · ${co.slogan}` : ''}</span>
    <span>${co.address_line1 ? co.address_line1 : ''}${co.address_line2 ? ` · ${co.address_line2}` : ''}</span>
    <span>${co.phone ? `Tel: ${co.phone}` : ''}${co.email ? ` · <span class="footer-accent">${co.email}</span>` : ''}</span>`}
  </div>
  ${ft.line2 || (ft.show_bank_in_footer ? `<div class="footer-line" style="margin-top:2px;">
    <span>IBAN: ${bank.iban} · BIC: ${bank.bic}</span>
  </div>` : '')}
  ${ft.line3 ? `<div class="footer-line" style="margin-top:2px;">${ft.line3}</div>` : ''}
</div>

</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { invoiceId } = await req.json();
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "invoiceId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invoice, error: invError } = await supabase
      .from("invoices").select("*").eq("id", invoiceId).single();

    if (invError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: items } = await supabase
      .from("invoice_items").select("*").eq("invoice_id", invoiceId).order("position");

    // Load bank settings
    const bankData = { kontoinhaber: "", iban: "", bic: "" };
    const { data: bankSettings } = await supabase
      .from("app_settings").select("key, value").in("key", ["bank_kontoinhaber", "bank_iban", "bank_bic"]);
    if (bankSettings) {
      bankSettings.forEach((s: any) => {
        if (s.key === "bank_kontoinhaber") bankData.kontoinhaber = s.value;
        if (s.key === "bank_iban") bankData.iban = s.value;
        if (s.key === "bank_bic") bankData.bic = s.value;
      });
    }

    // Load invoice layout settings
    const { data: layoutSetting } = await supabase
      .from("app_settings").select("value").eq("key", "invoice_layout").maybeSingle();
    const layout = parseLayoutSettings(layoutSetting?.value || null);

    const html = buildHtml(invoice, items || [], bankData, layout);
    const base64Html = btoa(unescape(encodeURIComponent(html)));

    return new Response(JSON.stringify({ pdf: base64Html, format: "html" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
