# Teilefinder – Fahrradteile vergleichen

Browser-Erweiterung für **Firefox und Chrome**: Preise, Varianten und Lagerstatus bei **BIKE24, Bike-Discount, bike-components und r2-bike** vergleichen. Sie arbeitet in deiner Browsersitzung, ohne lokalen Server und ohne eigenes Benutzerkonto.

## Funktionen

- Einzelteilsuche und lokal gespeicherte Wunschliste mit Produktname, optionaler EAN, Variante und Preisgrenze. `60` bedeutet maximal 60 €, `30-60` einen Preisbereich.
- Allgemeine Namenssuchen: je Shop das günstigste passende lieferbare Produkt, ohne eine einzelne Treffer-EAN als Suchvorgabe zu übernehmen.
- Günstigstes lieferbares Angebot je Artikel, Gesamtpreis und Vergleich je Shop mit Summe und Abdeckung. Versandkosten sind nicht enthalten.
- Gespeicherte Produktlinks und Variantenauswahlen direkt aktualisieren, statt bekannte Artikel erneut zu suchen. Ohne bestätigten EAN-Treffer im Preisbereich folgt je Shop eine Namensprüfung mit denselben Preis- und Variantenfiltern; passende bekannte URLs bleiben nutzbar.
- Artikel bearbeiten, einzeln aktualisieren oder entfernen; Shopvergleich per Klick auf den Namen, Preisverlauf per Klick auf den Preis.
- Lokaler Preisverlauf je bestätigter EAN sowie Datei-Export und -Import einschließlich Ergebnissen und Historie.
- Lieferbare Artikel als nach Shop gruppierte Liste mit anklickbaren Links kopieren.
- Browser-Farbschema mit Sonne/Mond-Schalter; Bilder in verwalteten Shop-Tabs optional laden.

Pro Teilefinder-Tab wird höchstens ein Such-Tab je Shop wiederverwendet. Jeder Shop arbeitet die Wunschliste in einer eigenen seriellen Warteschlange ab. Schnellere Shops können bereits den nächsten Artikel prüfen; es bleiben maximal vier Shop-Tabs. Ein Klick auf den Fortschritt stoppt die Suche und erhält bereits gefundene Ergebnisse. Es gibt keine Warenkorb- oder Bestellaktionen.

## Installation und Benutzung

Firefox Desktop ab 140, Chrome ab 114. Für die Entwicklungsinstallation zuerst bauen und dann `outputs/firefox-addon/manifest.json` unter `about:debugging` beziehungsweise `outputs/chrome-addon/` unter `chrome://extensions` laden. Für Firefox außerhalb der temporären Entwicklungsinstallation wird eine von Mozilla signierte XPI benötigt.

Beim Update **neu laden beziehungsweise über die vorhandene Installation installieren**, statt die Erweiterung zu deinstallieren. Vorher die Daten als Datei sichern.

| Dokument | Inhalt |
| --- | --- |
| [Handbuch](MANUAL.md) | Installation, Updates, Suche, Wunschliste und Datensicherung |
| [Datenschutz](DATENSCHUTZ.md) | Lokale Daten, Shop-Verbindungen und Berechtigungen |
| [Firefox: Unlisted](release/UNLISTED.md) | Mozilla-Signierung und Selbstverteilung |
| [Chrome Web Store](release/CHROME-WEB-STORE.md) | Paket, Store-Angaben und Veröffentlichung |
| [Reviewer notes](release/REVIEWER-NOTES.md) | Funktionsweise, Berechtigungen und Prüfschritte auf Englisch |
| [Architektur und Cross-Browser-Plan](docs/CROSS-BROWSER-PLAN.md) | Gemeinsame Logik, Plattformadapter und Abnahme |
| [Profiling](docs/SEARCH-PROFILING.md) | Laufzeitmessungen, lokale Logs und historische Befunde |

## Entwickeln und bauen

Voraussetzungen: **Node.js 22+ und Python 3.9+**. Im Repository-Hauptverzeichnis ausführen:

```sh
npm ci
npm test
npm run build
NO_UPDATE_NOTIFIER=1 npm run lint:extension
npm run lint:chrome
```

`npm ci` installiert das Entwicklungswerkzeug `web-ext` für den Firefox-Lint. Tests und Paketbau benötigen selbst keine zusätzlichen npm-Pakete und können auch mit `python3 scripts/build-extension.py --test-only` beziehungsweise `python3 scripts/build-extension.py` ausgeführt werden. Der Build verwendet keine Shop-Verbindungen.

| Befehl | Zweck |
| --- | --- |
| `npm test` | Syntaxprüfung und automatisierte Regressionstests |
| `npm run build` | Prüfen und beide Browserpakete bauen |
| `npm run build:firefox` | Nur Firefox bauen |
| `npm run build:chrome` | Nur Chrome bauen |
| `npm run lint:extension` | Mozilla-Lint für den gebauten Firefox-Ordner |
| `npm run lint:chrome` | Chrome-Manifest und referenzierte Dateien prüfen |
| `npm run profile:search` | Suchcontroller mit simulierten Shopantworten messen |

Die Version steht übereinstimmend in [firefox.json](teilefinder/manifests/firefox.json) und [chrome.json](teilefinder/manifests/chrome.json). Builds erzeugen reproduzierbare ZIPs und stabile Ladeordner:

```text
outputs/
  firefox-addon/                    chrome-addon/
  teilefinder-firefox.zip            teilefinder-chrome.zip
  teilefinder-firefox-<Version>.zip   teilefinder-chrome-<Version>.zip
```

Nach einem erfolgreichen Ziel-Build werden dessen ältere versionierte ZIPs entfernt. Ein Einzelbrowser-Build lässt die Pakete des anderen Browsers stehen. Andere Dateien, etwa signierte XPIs, werden nicht bereinigt. ZIPs sind weder signiert noch automatisch im Store veröffentlicht.

## Quellcode

```text
teilefinder/src/
  ui/         Oberfläche, Dialoge, Design, Zwischenablage
  core/       Suche, Produkt-/EAN-/Variantenabgleich, Wunschliste, Preisvergleich
  shops/      Shop-DOM auslesen und Varianten auswählen
  data/       Lokale IndexedDB-Preishistorie
  platform/   Browser-APIs, Nachrichten, Hintergrund und Shop-Tab-Verwaltung
  assets/     Fahrrad-Icons und lokale Inter-Schrift
teilefinder/manifests/   Firefox MV2 und Chrome MV3
teilefinder/*.test.mjs   Regressionstests; zusätzliche Parsertests in local-browser/
scripts/                Paketbau und Profiling
```

UI und fachliche Logik sind gemeinsam; native Browserzugriffe liegen in `platform/`. Bei fehlenden oder nicht erfolgreich auslesbaren BIKE24-Widgets verwenden Firefox und Chromium frische Produktmetadaten und die schreibgeschützte Verfügbarkeitsabfrage desselben Shops. Varianten erfordern eine eindeutige Optionszuordnung und einen vollständig berechenbaren Preis. Verknüpfte Ausführungen werden auch dann geprüft, wenn etwa die Packungsgröße im Link und der Geschmack erst im Dropdown stehen; die endgültige Varianten- und EAN-Prüfung bleibt erforderlich. Erfolgreich ausgelesene Widgets behalten ihren DOM-/Dropdown-Pfad. Packungsangaben wie „24er“, „24 Stück“ und „24x50g“ werden über die Stückzahl verglichen, ohne andere Mengen oder Modellnummern gleichzusetzen. Shop-spezifische DOM-Reader sind nötig, Produktnamen-Sonderregeln oder Suchbegriff-Wörterbücher sind nicht vorgesehen. Tests verwenden Fixtures und API-Mocks; sie ersetzen keine Prüfung der aktuellen Shopseiten in beiden Browsern.

Die übrigen Website- und Chromium-Prototypdateien unter `teilefinder/` sind historischer Bestand. Deren verschachteltes `npm run build` baut die frühere Website, **nicht** die Erweiterung. Siehe [Quellordner](teilefinder/README.md) und [lokaler Prototyp](teilefinder/LOKAL.md).

## Repository und Releases

Repository: [guenzd/firefox_bikeparts_finder](https://github.com/guenzd/firefox_bikeparts_finder), konfigurierter Remote `git`. Die Cross-Browser-Entwicklung liegt auf `feature/chrome-cross-browser`. Veröffentlichungen werden geprüft, committed, mit `v<Version>` annotiert und samt Tag gepusht; die Regeln stehen in [AGENTS.md](AGENTS.md). Git-Tags bestätigen keine Store-Freigabe oder Mozilla-Signierung.

Generierte Pakete, Browserprofile, Zugangsdaten und lokale Datenexporte gehören nicht in Git. Mitgelieferte Schrift- und Bibliothekslizenzen bleiben bei den jeweiligen Dateien erhalten.
