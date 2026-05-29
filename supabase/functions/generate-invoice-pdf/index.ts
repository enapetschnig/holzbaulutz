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

const LOGO_IMG = `<span style="font-family:Montserrat,'Segoe UI',sans-serif;font-weight:800;font-size:20pt;letter-spacing:-0.01em;color:#0E5A44;">Holzbau Lutz</span>`;
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

  const itemRows = (items || []).map((item: any, idx: number) => `
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'};">
      <td style="padding:9px 12px;border-bottom:1px solid #e8e8e8;color:#888;text-align:center;font-size:9pt;">${item.position}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e8e8e8;color:#1a1a1a;font-size:9.5pt;white-space:pre-wrap;">${item.beschreibung}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e8e8e8;text-align:right;color:#444;font-size:9pt;">${fmt(Number(item.menge))}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e8e8e8;text-align:center;color:#444;font-size:9pt;">${item.einheit || 'Stk.'}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e8e8e8;text-align:right;color:#444;font-size:9pt;">${fmtCurrency(Number(item.einzelpreis))}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e8e8e8;text-align:right;font-weight:600;color:#1a1a1a;font-size:9.5pt;">${fmtCurrency(Number(item.gesamtpreis))}</td>
    </tr>`).join("");

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
