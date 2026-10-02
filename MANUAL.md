# Teilefinder – Handbuch

## Signierte Installation (Unlisted)

Die Erweiterung ist noch nicht veröffentlicht und benötigt Firefox Desktop 140 oder neuer. Das erzeugte ZIP ist noch kein signiertes Add-on. Die Einreichung und Installation einer von Mozilla signierten XPI sind in `release/UNLISTED.md` beschrieben.

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

- Produktname oder Artikelnummer eingeben, etwa `Continental Aero 111`.
- Das separate EAN-Feld kann leer bleiben; eine bekannte EAN kann direkt eingetragen werden.
- Die gewünschte Ausführung separat unter „Variante“ angeben, etwa `29 mm`.
- Optional einen Maximalpreis setzen und „Suchen“ klicken.

Mengenangaben in Liter und Milliliter werden gleichgesetzt (z. B. `1 L` = `1000 ml`). Wird der Produktname gefunden, aber die gewünschte Variante nicht bestätigt, werden die anderen Ausführungen mit ihren Variantenangaben angezeigt. „Ohne Variantenfilter suchen“ sucht denselben Produktnamen erneut mit leerem Variantenfeld.

In allen vier Shops werden zuerst die Suchtreffer ausgewertet. Bereits bestätigte Ausführung, exakter Preis und Lagerstatus werden direkt übernommen; eindeutig abweichende Varianten werden aussortiert. Produktseiten und Dropdowns werden nur für fehlende Angaben geprüft. Die vier Shop-Tabs werden dabei wiederverwendet. Bei einer Sicherheitsprüfung den betroffenen Tab öffnen und die Prüfung selbst abschließen. Produktlinks öffnen das Angebot; das Symbol mit zwei Quadraten kopiert den Link.

Fehlen passende Treffer, schließt die Suche auch ohne ausdrückliches „keine Ergebnisse“-Banner ab. Eine breitere Suche wird einmal versucht. Danach wird der Artikel als ohne passendes Angebot markiert und die Wunschliste läuft weiter. Nicht antwortende Shop-Skripte haben eine begrenzte Wartezeit.

## EAN verwenden

Sobald eine eindeutige EAN gefunden wurde, wird sie ins Suchfeld und beim passenden Wunschlistenartikel übernommen. Sie wird auch in bestätigten Angeboten derselben Variante ergänzt. Bei mehreren unterschiedlichen EANs bleibt die automatische Auswahl aus.

Neben jeder EAN in den Ergebnissen steht ein Symbol mit zwei überlappenden Quadraten. Es übernimmt die Kennung direkt ins EAN-Suchfeld und gegebenenfalls in den zugehörigen Wunschlistenartikel. Anschließend „Suchen“ klicken. Das gleiche Symbol neben Shoplinks kopiert dagegen den Link in die Zwischenablage.

Eine vorhandene EAN wird von Anfang an als Suchbegriff verwendet. Wird sie erst während der Suche gefunden, werden Shops mit mehreren Treffern einmal mit der EAN nachgesucht. Eine erfolglose EAN-Nachsuche entfernt keine zuvor gefundenen Angebote.

Bei BIKE24 wird auch die GTIN im Datenblatt als EAN gelesen. Bei r2-bike wird die EAN aus der Beschreibung übernommen; falls erforderlich, öffnet die Erweiterung „mehr lesen“. Eine Änderung des Produktnamens oder der Variante entfernt die bisherige EAN, damit sie nicht für einen anderen Artikel verwendet wird.

## Wunschliste und Dateien

„Zur Wunschliste hinzufügen“ speichert die Suche samt Variante und Maximalpreis. Diese Angaben können anschließend pro Artikel geändert werden. Über „Name korrigieren“ den Suchnamen bearbeiten und mit „Speichern“ übernehmen oder mit „Abbrechen“ verwerfen. Variante und Maximalpreis bleiben erhalten; Suchergebnisse werden bei einer Änderung zurückgesetzt. Danach erneut prüfen. „Erneut suchen“ prüft nur diesen Artikel in allen vier Shops und aktualisiert dessen Ergebnisse und den Gesamtpreis. Die anderen Artikel bleiben erhalten. Eine fehlende EAN wird dabei ergänzt, wenn die gefundenen Angebote eine eindeutige Kennung liefern.

- „Als Datei speichern“ sichert die gesamte aktuelle Ansicht in einer JSON-Datei: Suchfelder, Suchergebnisse, Wunschlistenartikel und deren Angebote einschließlich Preisen, Lagerstatus, EANs, Links und Abfragezeitpunkten. Die Datei liegt außerhalb des Add-ons und kann frei abgelegt oder kopiert werden.
- „Datei laden“ stellt die gespeicherte Suche mit Ergebnissen wieder her und ergänzt die Wunschliste aus dieser Datei. Identische Kombinationen aus Name, Variante und Preisgrenze werden nicht doppelt angelegt; vorhandene Artikel bleiben erhalten.
- Nach Änderungen erneut speichern: Die externe Datei wird nicht automatisch aktualisiert.
- Gespeicherte Ergebnisse behalten ihren ursprünglichen Abfragezeitpunkt. Bei identischen Wunschlistenartikeln werden Ergebnisse übernommen, wenn noch keine oder ältere Ergebnisse vorhanden sind. Ältere Dateien mit ausschließlich Suchvorgaben bleiben lesbar.

## Gesamtpreis

„Wunschliste prüfen“ sucht alle Wunschlistenartikel. Pro Artikel zählt das günstigste bestätigte, lieferbare Angebot der gewünschten Variante innerhalb des Maximalpreises. Fehlen Angebote, wird eine Teilsumme angezeigt. Versandkosten werden nicht in die Summe eingerechnet.

Produktlinks öffnen die jeweilige Shopseite.

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

## Erneute Suche und Abbruch

„Suche stoppen“ beendet das Warten und lässt die bisher eingegangenen Ergebnisse bestehen. Bleibt eine erneute Shop-Abfrage leer, werden frühere Angebote mit ihrem bisherigen Stand erhalten und als aktuell nicht bestätigt markiert. Solche alten Angebote fließen nicht in den aktuellen Gesamtpreis ein.
