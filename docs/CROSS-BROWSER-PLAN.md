# Firefox und Chrome: gemeinsamer Erweiterungskern

Branch: `feature/chrome-cross-browser` · Ausgangspunkt: 0.7.86
Ziel: dieselbe UI, dieselben Suchregeln und Shop-Reader; getrennte Browser-Einstiegspunkte und Manifeste. Firefox-ID und gespeicherte Daten bleiben erhalten. Das ursprüngliche Refactoring sollte die Match-Regeln erhalten. Für die Weiterentwicklung gelten gemeinsame generische Produktregeln; Shop-spezifische DOM-Reader sind ausdrücklich vorgesehen, produktbezogenes Suchbegriff-Tuning nicht.

## Aktueller Architekturstand

Die Trennung ist umgesetzt: `teilefinder/src/ui`, `core`, `shops` und `data` sind gemeinsam; Browser-APIs liegen in `platform`, die beiden Manifeste in `teilefinder/manifests`. Der alte Ordner `firefox-r2` wird nicht mehr gebaut. Suchjobs laufen im UI-Tab, der Hintergrund verwaltet Toolbar, Tab-Besitz und Bildregeln. Pro UI-Tab gibt es höchstens einen wiederverwendeten Tab je Shop.

Produktlinks und konkrete ausgewählte Optionen werden dauerhaft lokal gespeichert. Ein Wunschlisten-Refresh prüft bekannte Seiten direkt, liest Preise und Bestand frisch und startet bei unbestätigten bekannten Seiten keine zusätzliche Suche. Firefox und Chrome behalten getrennte lokale Speicher; der JSON-Export überträgt Konfiguration, Ergebnisse und Historie.

Der Default ist das Browser-Farbschema. Der Sonne/Mond-Schalter gilt nur bis zum Neuladen; es gibt keinen zusätzlichen Automatik-Button. Neue Shop-Tabs werden leer angelegt, registriert und mit Bildregeln versehen, bevor sie zur Shopseite navigieren. Diese heutigen Abläufe ersetzen die entsprechenden Zwischenstände von 0.8.1 weiter unten.

Aktuelle Befehle und Bedienung: [README](../README.md), [Handbuch](../MANUAL.md), [Profiling](SEARCH-PROFILING.md). Automatisierte Prüfungen decken Plattformverträge, Hintergrund-Neustarts, Tab-Besitz, DOM-Reader, Matching, Dateien, Historie und reproduzierbare Pakete ab. Eine vollständige automatisierte Live-Abnahme beider Browser ist weiterhin offen: Die native Browsersteuerung war nicht erreichbar. Nutzerberichte und lokale Laufzeitprofile sind zusätzliche Evidenz, keine vollständige Browserabnahme.

## Ursprünglicher Umsetzungsplan und historische Abnahme

Die folgenden Zahlen und Versionsangaben dokumentieren die damaligen Schritte, nicht den aktuellen Testumfang.

## 1. Bestand sichern und Struktur trennen

- [x] Sauberen Ausgangsstand prüfen und Entwicklungsbranch anlegen.
- [x] Implementierungsplan und Abnahmekriterien festhalten.
- [x] Gemeinsame Quellen nach `teilefinder/src/{ui,core,shops,data,platform,assets}` verschieben.
- [x] Reine Produkt-/Variantenlogik von DOM-Readern und IndexedDB-Anbindung trennen.
- [x] Bestehende Tests auf die neue Struktur umstellen; vorhandene Szenarien erhalten.

Abnahme: bisherige 138 Tests weiterhin erfolgreich; keine Browser-Aufrufe in den reinen Core-Modellen; keine doppelten Firefox-/Chrome-Reader.

## 2. Browser-Schnittstelle und Nachrichten

- [x] Kleinen, expliziten Adapter für verwendete Tabs-, Storage-, Runtime- und Action-APIs einführen.
- [x] Native `browser`-/`chrome`-Referenzen ausschließlich in `platform/`.
- [x] Asynchrone Message-Antworten per `sendResponse`/`return true` unterstützen, auch vor Chrome 148.
- [x] Fehler und nicht behandelte Nachrichten korrekt weiterreichen; keine fremden Message-Kanäle übernehmen.
- [x] Verträge für Firefox- und Chrome-API-Mocks testen.

Abnahme: identische fachliche Suchtests mit injizierter Plattform; Nachrichtentests für Erfolg, Fehler, unbehandelte Nachricht und Promise-Antwort.

## 3. Suchlaufzeit vom Browser-Hintergrund lösen

- [x] Gemeinsamen Suchcontroller im geöffneten Erweiterungs-Tab ausführen.
- [x] UI-Befehle und Suchergebnisse lokal zustellen; Content-Script-Nachrichten weiterhin über Tabs-API.
- [x] Pro Erweiterungs-Tab getrennte Suchzustände, Abbruch und Zeitlimits erhalten.
- [x] Hintergrund auf Toolbar-Aktion und Verwaltung der zugehörigen Shop-Tabs begrenzen.
- [x] Tab-Zuordnungen in `storage.session` speichern; Hintergrund-Neustart darf keine Suchzustände zerstören.
- [x] Schließen von Eltern-/Child-Tabs, konkurrierende Registrierung und geschlossenen Eltern-Tab testen.

Abnahme: simuliertes Beenden/Neustarten des Hintergrunds beeinflusst laufende Suchen nicht; nur registrierte Child-Tabs des richtigen Eltern-Tabs werden geschlossen. Manuell geöffnete Shoplinks bleiben unberührt. Website-/fremde Absender können keine Tab-Verwaltung auslösen.

## 4. Zwei Build-Ziele

- [x] Firefox-Manifest V2 mit unveränderter Gecko-ID und Chrome-Manifest V3 mit Service Worker erstellen.
- [x] Host-Rechte und Chrome-Action-Konfiguration korrekt setzen; Chrome-kompatible PNG-Icons bereitstellen.
- [x] Deterministische ZIPs und stabile entpackte Verzeichnisse für beide Browser erzeugen.
- [x] Alle referenzierten JS-, HTML-, CSS-, Font- und Icon-Dateien sowie Ladereihenfolge prüfen.
- [x] Chrome-MV3-Paketprüfung in den Build aufnehmen; Firefox-Lint als separaten verbindlichen Release-Schritt bereitstellen.

Abnahme: beide Pakete enthalten denselben Core/UI/Reader-Code; Chrome enthält keine Gecko-/MV2-Felder und keinen Suchcontroller im Worker. Firefox-Daten und JSON-Import bleiben kompatibel.

## 5. Gesamtabnahme und Übergabe

- [x] Regressionstests sowie neue Plattform-/Hintergrund-/Build-Tests vollständig ausführen.
- [x] Wiederholten Build auf identische ZIP-Inhalte prüfen.
- [x] Manual um Architektur, beide Entwicklungsinstallationen, Update und Browser-Datentrennung ergänzen.
- [ ] Falls verfügbare Browsersteuerung funktioniert: beide Erweiterungen laden und Suche/Abbruch/Neuladen/Tab-Schließen/Dateiimport prüfen. Nicht verfügbare Live-Prüfung ausdrücklich dokumentieren.
- [x] Implementierung auf dem Feature-Branch committen und pushen; Release-Version und annotierten Tag erst nach bestandenen automatischen Prüfungen setzen. Kein Merge nach `main`.

## Technische Entscheidungen

- Kein Framework-Wechsel: vorhandenes HTML/CSS/JavaScript bleibt bestehen.
- Keine neue Laufzeit-Abhängigkeit für Browser-APIs; nur der tatsächlich benötigte Adapterumfang.
- Suchjobs leben im UI-Tab statt im kurzlebigen Chrome-Service-Worker. Suchzustände bleiben im UI-Tab; der Hintergrund hält die wiederherstellbare Besitzliste und verwaltet die Bildregeln.
- Wishlist/Cache: bestehende `storage.local`-Schlüssel; Historie: bestehende IndexedDB-Namen und Struktur. Chrome und Firefox speichern unabhängig, Übertragung über vorhandenen JSON-Export/Import.
- Quellen: Chrome-MV3-Service-Worker-Migration und Chrome-Messaging-Dokumentation. Asynchrone Listener verwenden `return true`, ohne Promise-Unterstützung ab Chrome 148 vorauszusetzen.

## Durchgeführte Prüfungen / offene Live-Abnahme

- Bestehende 138 Szenarien weiterhin erfolgreich nach Umstellung auf injizierte Plattform-Abhängigkeiten.
- Neue Adapter-Verträge für Firefox und Chrome, eigener lokaler UI-Nachrichtenbus und native asynchrone Antworten.
- Suchcontroller läuft in beiden API-Modi über einen simulierten Hintergrund-Neustart hinweg durch.
- Echter Chrome-Worker-Einstieg wird in isolierten JavaScript-Kontexten gestartet, beendet und mit demselben Sitzungsspeicher neu gestartet.
- Besitzprüfung, konkurrierende Registrierung, Schließen während Registrierung, Trennung manueller Tabs, Wiederverwendung nach UI-Neuladen und `pendingUrl` geprüft.
- Beide ZIPs werden auf identische gemeinsame Quellen und bytegenau reproduzierbare Ausgabe geprüft; HTML/CSS/JS/Font/Icon-Referenzen werden aufgelöst.
- Geplant für die lokale Browserabnahme: beide entpackten Erweiterungen laden, je einen Suchlauf und Abbruch ausführen, UI neu laden, Shop-Tabs wiederverwenden und schließen, JSON-Datei browserübergreifend importieren.

Live-Abnahme am 25.10.2026 erneut versucht: `cua.getState()` liefert `apps: []`, `browsers: []` und „Sky Computer Use native pipe startup failed“. Die Erweiterungen konnten deshalb nicht im realen Firefox/Chrome geladen werden. Die Live-Prüfliste bleibt offen; kein Live-Shop-Lauf wird als bestanden ausgegeben.

Automatisierter Stand: 152 Tests bestanden; Firefox-Lint ohne Fehler/Warnungen; Chrome-Manifest-/Asset-Prüfung bestanden. Beide Paketziele werden im Test wiederholt erzeugt und bytegenau verglichen.

Referenzen: [Chrome Service-Worker-Migration](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers), [Chrome-Nachrichten und asynchrone Antworten](https://developer.chrome.com/docs/extensions/develop/concepts/messaging), [Mozilla storage.session](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/session).

Umsetzungsversion: **0.8.0**. Commits: eigener Plan-Commit, gemeinsame Plattform/Core-/Build-Umsetzung und Dokumentations-/Abnahme-Commit. Der Branch wird separat gepusht und nicht nach `main` gemergt; Tag `v0.8.0` markiert diesen Entwicklungsstand, keine Store-Freigabe.


### Historische Nachprüfung 0.8.1

- Content-Skripte werden jetzt mit realistischem API-Umfang getestet: `tabs`, Toolbar-Aktion und `storage.session` fehlen dort. Der Adapter setzt nur `runtime` voraus und initialisiert deshalb auch auf Shopseiten korrekt.
- Firefox-Tabs dürfen zunächst `about:blank` ohne `pendingUrl` melden. Vor der Registrierung wartet die Seitenplattform auf die Shop-Adresse, mit Ereignissen, erneuter Zustandsprüfung und begrenztem Zeitlimit. Registrierung, Wiederverwendung und Listener-Aufräumen sind abgedeckt.
- Wunschlistenprüfung und Einzelpostenprüfung lesen EAN/Preisgrenzen direkt vom Listenartikel. Die manuellen Suchfelder bleiben unverändert, auch beim Übernehmen gefundener EANs und bei späten Ergebnissen.
- Damals: Sonne/Mond-Schalter mit gespeicherter Auswahl und „Automatisch“. Dieser Zwischenstand wurde durch den heutigen, nur bis zum Neuladen geltenden Schalter ersetzt.

Automatisierter Stand 0.8.1: 161 Tests bestanden, Firefox-Lint ohne Fehler/Warnungen und Chrome-Paketvalidierung bestanden. Die Live-Abnahme bleibt offen.
