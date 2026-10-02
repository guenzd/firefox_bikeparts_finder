# Teilefinder

Firefox-Erweiterung zum Vergleich von Fahrradteilen bei BIKE24, Bike-Discount, bike-components und r2-bike. Sie verwendet Shop-Tabs in der eigenen Firefox-Sitzung. Wunschliste, Varianten und Maximalpreise werden lokal gespeichert und können als Datei gesichert werden.

- [Handbuch](MANUAL.md): Installation, Updates, Suche, Wunschliste und Warenkörbe
- Erweiterung: `teilefinder/firefox-r2/`
- Build-Werkzeug: `scripts/build-extension.py`
- Frühere Website und Browser-Prototypen: `teilefinder/`

## Bauen

Voraussetzungen: Node.js 22 oder neuer und Python 3. Keine zusätzlichen Pakete erforderlich.

```sh
npm run build
# oder ohne npm:
python3 scripts/build-extension.py
```

Der Build prüft JavaScript-Syntax und führt alle Erweiterungstests sowie die Tests der Auslese-Helfer aus. Erst danach erstellt er `outputs/teilefinder-firefox.zip`, ein ZIP mit Versionsnummer und den stabilen Ladeordner `outputs/firefox-addon/`.

Nur prüfen: `npm test` oder `python3 scripts/build-extension.py --test-only`.

Die Version steht in `teilefinder/firefox-r2/manifest.json`. Die Add-on-ID bleibt bei Updates unverändert. Das Build-Werkzeug benötigt keinen Server und keine Shop-Zugriffe. Die Tests verwenden Fixtures; sie ersetzen keine Prüfung der aktuellen Shop-Oberflächen in Firefox.

## Git

Dieses Repository enthält Quellcode, Tests, Handbuch und Build-Werkzeug. Downloads, Abhängigkeiten, Browserprofile und lokale Zugangsdaten sind ausgeschlossen. Es ist kein Remote konfiguriert.
