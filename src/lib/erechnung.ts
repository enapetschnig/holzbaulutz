/**
 * E-Rechnung im österreichischen Standard ebInterface 6.1
 * (http://www.ebinterface.at — akzeptiert u.a. von e-rechnung.gv.at).
 *
 * Erzeugt aus einer gespeicherten Rechnung eine strukturierte XML-Datei
 * zum Download. Besonderheiten:
 *  - Anzahlungs-Abzugszeilen (mwst_exempt, negative Beträge) werden NICHT
 *    als Positionen ausgegeben, sondern als PrepaidAmount — TotalGross
 *    bleibt die volle Leistung, PayableAmount der offene Rest (§ 11 UStG
 *    Endrechnung).
 *  - Dokument-Rabatt wird als ReductionAndSurchargeDetails abgebildet.
 */

export interface ERechnungZeile {
  position: number;
  beschreibung: string;
  menge: number;
  einheit?: string;
  einzelpreis: number;
  rabatt_prozent?: number;
  gesamtpreis: number;
  mwst_exempt?: boolean;
}

export interface ERechnungDaten {
  nummer: string;
  datum: string;            // yyyy-MM-dd
  faellig_am?: string | null;
  typ: string;              // rechnung | anzahlungsrechnung | schlussrechnung
  ust_satz: number;         // z.B. 20
  rabatt_prozent?: number;  // Dokument-Rabatt %
  rabatt_euro?: number;     // Dokument-Rabatt € (netto)
  betreff?: string;
  zahlungsbedingungen?: string;
  kunde: {
    name: string;
    adresse?: string;
    plz?: string;
    ort?: string;
    email?: string;
    uid?: string | null;    // ATU… falls Firmenkunde
  };
  firma: {
    name: string;
    strasse: string;
    plz: string;
    ort: string;
    email?: string;
    uid: string;            // ATU67426948
    iban?: string;
    bic?: string;
    kontoinhaber?: string;
  };
  zeilen: ERechnungZeile[];
}

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const geld = (n: number) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
const zahl = (n: number) => String(Math.round((Number(n) || 0) * 10000) / 10000);

/** Einheiten-Mapping auf UN/ECE-Codes (ebInterface Quantity/@Unit). */
const EINHEIT_CODE: Record<string, string> = {
  "stk": "C62", "stk.": "C62", "stück": "C62", "pa": "C62", "ve": "C62", "psch": "C62",
  "m": "MTR", "lfm": "MTR",
  "m2": "MTK", "m²": "MTK", "qm": "MTK",
  "m3": "MTQ", "m³": "MTQ",
  "kg": "KGM", "t": "TNE", "l": "LTR",
  "std": "HUR", "std.": "HUR", "h": "HUR", "stunde": "HUR", "stunden": "HUR",
  "tag": "DAY", "tage": "DAY", "wo": "WEE", "woche": "WEE", "mo": "MON", "monat": "MON",
};
const einheitCode = (e?: string) => EINHEIT_CODE[String(e || "").trim().toLowerCase()] || "C62";

/**
 * Baut das ebInterface-6.1-XML. Gibt zusätzlich Hinweise zurück (z.B. wenn
 * die Kunden-UID fehlt), die der Aufrufer dem Nutzer anzeigen kann.
 */
export function erzeugeEbInterfaceXml(d: ERechnungDaten): { xml: string; hinweise: string[] } {
  const hinweise: string[] = [];
  // 0 % (steuerfrei / Reverse Charge) ist ein gültiger Satz — nur bei
  // fehlendem/ungültigem Wert auf 20 % zurückfallen.
  const ust = Number.isFinite(Number(d.ust_satz)) ? Number(d.ust_satz) : 20;

  // Normale Zeilen vs. Anzahlungs-Abzüge (mwst_exempt, negativ)
  const normale = d.zeilen.filter(z => !z.mwst_exempt);
  const abzuege = d.zeilen.filter(z => z.mwst_exempt);
  const prepaidBrutto = Math.round(abzuege.reduce((s, z) => s + Math.abs(Number(z.gesamtpreis) || 0), 0) * 100) / 100;

  // Netto der normalen Zeilen (Zeilenrabatt bereits in gesamtpreis enthalten)
  const zeilenNetto = Math.round(normale.reduce((s, z) => s + (Number(z.gesamtpreis) || 0), 0) * 100) / 100;

  // Dokument-Rabatt (netto)
  const rabattProzent = Number(d.rabatt_prozent) || 0;
  const rabattEuro = Number(d.rabatt_euro) || 0;
  const rabattBetrag = Math.round((rabattProzent > 0 ? zeilenNetto * rabattProzent / 100 : rabattEuro) * 100) / 100;

  const nettoNachRabatt = Math.round((zeilenNetto - rabattBetrag) * 100) / 100;
  const steuer = Math.round(nettoNachRabatt * ust / 100 * 100) / 100;
  const brutto = Math.round((nettoNachRabatt + steuer) * 100) / 100;
  const zahlbar = Math.round((brutto - prepaidBrutto) * 100) / 100;

  if (!d.kunde.uid) {
    hinweise.push("Kunde hat keine UID-Nummer hinterlegt — für B2B/Behörden die UID beim Kunden ergänzen (bei Privatkunden nicht nötig).");
  }

  const zeilenXml = normale.map(z => {
    const nettoZeile = Number(z.gesamtpreis) || 0;
    const steuerZeile = Math.round(nettoZeile * ust / 100 * 100) / 100;
    const rabatt = Number(z.rabatt_prozent) || 0;
    return `      <ListLineItem>
        <PositionNumber>${z.position}</PositionNumber>
        <Description>${esc(z.beschreibung || `Position ${z.position}`)}</Description>
        <Quantity Unit="${einheitCode(z.einheit)}">${zahl(z.menge)}</Quantity>
        <UnitPrice>${geld(z.einzelpreis)}</UnitPrice>${rabatt > 0 ? `
        <ReductionAndSurchargeListLineItemDetails>
          <ReductionListLineItem>
            <BaseAmount>${geld(z.menge * z.einzelpreis)}</BaseAmount>
            <Percentage>${zahl(rabatt)}</Percentage>
            <Amount>${geld(z.menge * z.einzelpreis * rabatt / 100)}</Amount>
          </ReductionListLineItem>
        </ReductionAndSurchargeListLineItemDetails>` : ""}
        <TaxItem>
          <TaxableAmount>${geld(nettoZeile)}</TaxableAmount>
          <TaxPercent TaxCategoryCode="S">${zahl(ust)}</TaxPercent>
          <TaxAmount>${geld(steuerZeile)}</TaxAmount>
        </TaxItem>
        <LineItemAmount>${geld(nettoZeile)}</LineItemAmount>
      </ListLineItem>`;
  }).join("\n");

  const rabattXml = rabattBetrag > 0 ? `
  <ReductionAndSurchargeDetails>
    <Reduction>
      <BaseAmount>${geld(zeilenNetto)}</BaseAmount>${rabattProzent > 0 ? `
      <Percentage>${zahl(rabattProzent)}</Percentage>` : ""}
      <Amount>${geld(rabattBetrag)}</Amount>
      <TaxItem>
        <TaxableAmount>${geld(rabattBetrag)}</TaxableAmount>
        <TaxPercent TaxCategoryCode="S">${zahl(ust)}</TaxPercent>
        <TaxAmount>${geld(rabattBetrag * ust / 100)}</TaxAmount>
      </TaxItem>
    </Reduction>
  </ReductionAndSurchargeDetails>` : "";

  const bankXml = d.firma.iban ? `
  <PaymentMethod>
    <UniversalBankTransaction>
      <BeneficiaryAccount>
        <IBAN>${esc(String(d.firma.iban).replace(/\s+/g, ""))}</IBAN>${d.firma.bic ? `
        <BIC>${esc(d.firma.bic)}</BIC>` : ""}${d.firma.kontoinhaber ? `
        <BankAccountOwner>${esc(d.firma.kontoinhaber)}</BankAccountOwner>` : ""}
      </BeneficiaryAccount>
    </UniversalBankTransaction>
  </PaymentMethod>` : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="http://www.ebinterface.at/schema/6p1/"
         GeneratingSystem="Holzbau Lutz App"
         DocumentType="Invoice"
         InvoiceCurrency="EUR"
         Language="de">
  <InvoiceNumber>${esc(d.nummer)}</InvoiceNumber>
  <InvoiceDate>${esc(d.datum)}</InvoiceDate>
  <Biller>
    <VATIdentificationNumber>${esc(d.firma.uid)}</VATIdentificationNumber>
    <Address>
      <Name>${esc(d.firma.name)}</Name>
      <Street>${esc(d.firma.strasse)}</Street>
      <Town>${esc(d.firma.ort)}</Town>
      <ZIP>${esc(d.firma.plz)}</ZIP>
      <Country CountryCode="AT">Österreich</Country>${d.firma.email ? `
      <Email>${esc(d.firma.email)}</Email>` : ""}
    </Address>
  </Biller>
  <InvoiceRecipient>
    <VATIdentificationNumber>${esc(d.kunde.uid || "ATU00000000")}</VATIdentificationNumber>
    <Address>
      <Name>${esc(d.kunde.name)}</Name>${d.kunde.adresse ? `
      <Street>${esc(d.kunde.adresse)}</Street>` : ""}
      <Town>${esc(d.kunde.ort || "-")}</Town>
      <ZIP>${esc(d.kunde.plz || "-")}</ZIP>
      <Country CountryCode="AT">Österreich</Country>${d.kunde.email ? `
      <Email>${esc(d.kunde.email)}</Email>` : ""}
    </Address>
  </InvoiceRecipient>
  <Details>${d.betreff ? `
    <HeaderDescription>${esc(d.betreff)}</HeaderDescription>` : ""}
    <ItemList>
${zeilenXml}
    </ItemList>
  </Details>${rabattXml}
  <Tax>
    <TaxItem>
      <TaxableAmount>${geld(nettoNachRabatt)}</TaxableAmount>
      <TaxPercent TaxCategoryCode="S">${zahl(ust)}</TaxPercent>
      <TaxAmount>${geld(steuer)}</TaxAmount>
    </TaxItem>
  </Tax>
  <TotalGrossAmount>${geld(brutto)}</TotalGrossAmount>${prepaidBrutto > 0 ? `
  <PrepaidAmount>${geld(prepaidBrutto)}</PrepaidAmount>` : ""}
  <PayableAmount>${geld(zahlbar)}</PayableAmount>${bankXml}
  <PaymentConditions>${d.faellig_am ? `
    <DueDate>${esc(d.faellig_am)}</DueDate>` : ""}${d.zahlungsbedingungen ? `
    <Comment>${esc(d.zahlungsbedingungen)}</Comment>` : ""}
  </PaymentConditions>
</Invoice>
`;

  return { xml, hinweise };
}
