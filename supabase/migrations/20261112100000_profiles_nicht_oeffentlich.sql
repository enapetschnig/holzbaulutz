-- Grundtests 12.11.2026: Ohne Anmeldung (nur mit dem öffentlichen Schlüssel, der in jeder App-Auslieferung steht)
-- gab die Datenbank die Tabelle profiles heraus – alle Mitarbeiter mit Telefon, Adresse, Geburtsdatum, SV-Nummer,
-- Stundenlohn. Ursache: Regel „Users can view all profiles“ (USING true) galt für die Rolle public, also auch anon.
-- Rückwärtsverträglich: Für angemeldete Benutzer bleibt alles wie bisher (Profile weiter für alle Angemeldeten
-- lesbar); Edge Functions nutzen den Service-Schlüssel bzw. das Benutzer-Token. Nur Unangemeldete sind ausgesperrt.
-- Keine Datenänderung. (Gleicher Fund wie bei monti.pro am 09.11.2026.)
ALTER POLICY "Users can view all profiles" ON public.profiles TO authenticated;
