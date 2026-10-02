# Teilefinder – Handbuch

## Installation

1. Im Projektordner `npm run build` ausführen.
2. Firefox öffnen und `about:debugging#/runtime/this-firefox` aufrufen.
3. „Temporäres Add-on laden“ wählen und `outputs/firefox-addon/manifest.json` öffnen.
4. Über das Teilefinder-Symbol die Suchoberfläche öffnen.

Die Erweiterung arbeitet vollständig in Firefox; ein lokaler Server ist nicht erforderlich. Temporäre Add-ons müssen nach einem Firefox-Neustart erneut geladen werden.

## Aktualisieren

1. Die Wunschliste über „Als Datei speichern“ sichern.
2. Den neuen Quellcode im selben Projektordner bereitstellen und `npm run build` ausführen.
3. Unter `about:debugging` bei Teilefinder „Neu laden“ klicken. Die Erweiterung dabei nicht entfernen.
4. Die Teilefinder-Oberfläche und vorhandene Shop-Tabs neu laden, damit neue Skripte aktiv sind.
5. Falls die Wunschliste leer ist, über „Datei laden“ die Sicherung auswählen.

Der Ordner `outputs/firefox-addon/` bleibt bei Builds am selben Ort. Ein Entfernen und Neuinstallieren kann lokale Add-on-Daten löschen; deshalb vorher die Datei sichern.

## Suchen

- Produktname oder Artikelnummer/EAN eingeben, etwa `Continental Aero 111`.
- Die gewünschte Ausführung separat unter „Variante“ angeben, etwa `29 mm`.
- Optional einen Maximalpreis setzen und „Suchen“ klicken.

Die vier Shop-Tabs werden wiederverwendet. Dropdowns auf Produktseiten werden geprüft, um Variantenpreise und Lieferstatus zu ermitteln. Bei einer Sicherheitsprüfung den betroffenen Tab öffnen und die Prüfung selbst abschließen. Produktlinks öffnen das Angebot; das Symbol mit zwei Quadraten kopiert den Link.

## Wunschliste und Dateien

„Zur Wunschliste hinzufügen“ speichert die Suche samt Variante und Maximalpreis. Diese Angaben können anschließend pro Artikel geändert werden.

- „Als Datei speichern“ lädt eine JSON-Datei herunter. Die Datei liegt außerhalb des Add-ons und kann frei abgelegt oder kopiert werden.
- „Datei laden“ ergänzt die Liste aus dieser Datei. Identische Kombinationen aus Name, Variante und Preisgrenze werden nicht doppelt angelegt; vorhandene Artikel bleiben erhalten.
- Nach Änderungen erneut speichern: Die externe Datei wird nicht automatisch aktualisiert.
- Die Datei enthält Suchvorgaben und Warenkorb-Marker. Alte Preise und Suchergebnisse werden beim Import nicht übernommen; erneut prüfen.

## Gesamtpreis und Warenkörbe

„Prüfen & Shop-Warenkörbe befüllen“ sucht alle Wunschlistenartikel. Pro Artikel zählt das günstigste bestätigte, lieferbare Angebot der gewünschten Variante innerhalb des Maximalpreises. Fehlen Angebote, wird eine Teilsumme angezeigt. Versandkosten werden nicht in die Summe eingerechnet.

Die Funktion versucht danach, je Artikel ein Stück in den jeweiligen Shop-Warenkorb zu legen. Bei BIKE24, Bike-Discount und bike-components werden Preis, Variante und Lieferbarkeit vor dem Klick geprüft. Bei r2-bike erfolgt das Hinzufügen derzeit manuell. Checkout und Kauf werden nicht ausgeführt.

Warenkorb-Marker verhindern wiederholtes automatisches Hinzufügen desselben Angebots. Sie werden auch in die Sicherungsdatei übernommen. Nach manueller Entfernung im Shop fügt eine weitere Prüfung dasselbe Angebot deshalb nicht automatisch wieder hinzu.

## Entwicklung und Build

```sh
npm test
npm run build
```

Alternativ die gleichen Befehle ohne npm:

```sh
python3 scripts/build-extension.py --test-only
python3 scripts/build-extension.py
```

Quellcode: `teilefinder/firefox-r2/`. Tests: `teilefinder/*.test.mjs` und `teilefinder/local-browser/extract.test.mjs`. Die Build-Version kommt aus dem Erweiterungsmanifest. Generierte Dateien liegen unter `outputs/` und werden nicht in Git aufgenommen.
