# Firefox und Chrome: gemeinsamer Erweiterungskern

Branch: `feature/chrome-cross-browser` · Ausgangspunkt: 0.7.86
Ziel: dieselbe UI, dieselben Suchregeln und Shop-Reader; getrennte Browser-Einstiegspunkte und Manifeste. Firefox-ID und gespeicherte Daten bleiben erhalten. Keine Shop-Sonderfälle oder Änderungen der Match-Regeln in diesem Refactoring.

## 1. Bestand sichern und Struktur trennen

- [x] Sauberen Ausgangsstand prüfen und Entwicklungsbranch anlegen.
- [x] Implementierungsplan und Abnahmekriterien festhalten.
- [ ] Gemeinsame Quellen nach `teilefinder/src/{ui,core,shops,data,platform,assets}` verschieben.
- [ ] Reine Produkt-/Variantenlogik von DOM-Readern und IndexedDB-Anbindung trennen.
- [ ] Bestehende Tests auf die neue Struktur umstellen; vorhandene Szenarien erhalten.

Abnahme: bisherige 138 Tests weiterhin erfolgreich; keine Browser-Aufrufe in den reinen Core-Modellen; keine doppelten Firefox-/Chrome-Reader.

## 2. Browser-Schnittstelle und Nachrichten

- [ ] Kleinen, expliziten Adapter für verwendete Tabs-, Storage-, Runtime- und Action-APIs einführen.
- [ ] Native `browser`-/`chrome`-Referenzen ausschließlich in `platform/`.
- [ ] Asynchrone Message-Antworten per `sendResponse`/`return true` unterstützen, auch vor Chrome 148.
- [ ] Fehler und nicht behandelte Nachrichten korrekt weiterreichen; keine fremden Message-Kanäle übernehmen.
- [ ] Verträge für Firefox- und Chrome-API-Mocks testen.

Abnahme: identische fachliche Suchtests mit injizierter Plattform; Nachrichtentests für Erfolg, Fehler, unbehandelte Nachricht und Promise-Antwort.

## 3. Suchlaufzeit vom Browser-Hintergrund lösen

- [ ] Gemeinsamen Suchcontroller im geöffneten Erweiterungs-Tab ausführen.
- [ ] UI-Befehle und Suchergebnisse lokal zustellen; Content-Script-Nachrichten weiterhin über Tabs-API.
- [ ] Pro Erweiterungs-Tab getrennte Suchzustände, Abbruch und Zeitlimits erhalten.
- [ ] Hintergrund auf Toolbar-Aktion und Verwaltung der zugehörigen Shop-Tabs begrenzen.
- [ ] Tab-Zuordnungen in `storage.session` speichern; Hintergrund-Neustart darf keine Suchzustände zerstören.
- [ ] Schließen von Eltern-/Child-Tabs, konkurrierende Registrierung und geschlossenen Eltern-Tab testen.

Abnahme: simuliertes Beenden/Neustarten des Hintergrunds beeinflusst laufende Suchen nicht; nur registrierte Child-Tabs des richtigen Eltern-Tabs werden geschlossen. Manuell geöffnete Shoplinks bleiben unberührt. Website-/fremde Absender können keine Tab-Verwaltung auslösen.

## 4. Zwei Build-Ziele

- [ ] Firefox-Manifest V2 mit unveränderter Gecko-ID und Chrome-Manifest V3 mit Service Worker erstellen.
- [ ] Host-Rechte und Chrome-Action-Konfiguration korrekt setzen; Chrome-kompatible PNG-Icons bereitstellen.
- [ ] Deterministische ZIPs und stabile entpackte Verzeichnisse für beide Browser erzeugen.
- [ ] Alle referenzierten JS-, HTML-, CSS-, Font- und Icon-Dateien sowie Ladereihenfolge prüfen.
- [ ] Firefox-Lint und gesonderte Chrome-MV3-Prüfungen in den Build aufnehmen.

Abnahme: beide Pakete enthalten denselben Core/UI/Reader-Code; Chrome enthält keine Gecko-/MV2-Felder und keinen Suchcontroller im Worker. Firefox-Daten und JSON-Import bleiben kompatibel.

## 5. Gesamtabnahme und Übergabe

- [ ] Regressionstests sowie neue Plattform-/Hintergrund-/Build-Tests vollständig ausführen.
- [ ] Wiederholten Build auf identische ZIP-Inhalte prüfen.
- [ ] Manual um Architektur, beide Entwicklungsinstallationen, Update und Browser-Datentrennung ergänzen.
- [ ] Falls verfügbare Browsersteuerung funktioniert: beide Erweiterungen laden und Suche/Abbruch/Neuladen/Tab-Schließen/Dateiimport prüfen. Nicht verfügbare Live-Prüfung ausdrücklich dokumentieren.
- [ ] Implementierung auf dem Feature-Branch committen und pushen; Release-Version und annotierten Tag erst nach bestandenen automatischen Prüfungen setzen. Kein Merge nach `main`.

## Technische Entscheidungen

- Kein Framework-Wechsel: vorhandenes HTML/CSS/JavaScript bleibt bestehen.
- Keine neue Laufzeit-Abhängigkeit für Browser-APIs; nur der tatsächlich benötigte Adapterumfang.
- Suchjobs leben im UI-Tab statt im kurzlebigen Chrome-Service-Worker. Hintergrunddaten beschränken sich auf eine wiederherstellbare Besitzliste von Shop-Tabs.
- Wishlist/Cache: bestehende `storage.local`-Schlüssel; Historie: bestehende IndexedDB-Namen und Struktur. Chrome und Firefox speichern unabhängig, Übertragung über vorhandenen JSON-Export/Import.
- Quellen: Chrome-MV3-Service-Worker-Migration und Chrome-Messaging-Dokumentation. Asynchrone Listener verwenden `return true`, ohne Promise-Unterstützung ab Chrome 148 vorauszusetzen.
