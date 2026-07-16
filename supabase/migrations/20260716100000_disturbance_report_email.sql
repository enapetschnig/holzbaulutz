-- Korrektur: 20260317084200_update_email.sql hatte disturbance_report_email
-- fälschlich auf info@ft-tilger.at (Fremdfirma) gesetzt. Der Live-Wert wurde
-- bereits manuell auf info@holzbau-lutz.at korrigiert — diese Migration macht
-- die Korrektur reproduzierbar (frische Umgebungen / db reset), ohne einen
-- ggf. bewusst abweichend konfigurierten Wert zu überschreiben.
UPDATE public.app_settings
SET value = 'info@holzbau-lutz.at',
    updated_at = now()
WHERE key = 'disturbance_report_email'
  AND value = 'info@ft-tilger.at';
