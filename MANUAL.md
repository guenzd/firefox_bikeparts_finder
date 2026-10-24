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

Bei bekannten Artikeln werden zuerst die gespeicherten Produktseiten direkt geprüft. Die Erweiterung speichert bestätigte Produktlinks pro Shop dauerhaft lokal, mit EAN oder Suchbegriff und Variante als Zuordnung. Preise, Lagerstatus und Produktidentität werden bei jeder Prüfung neu gelesen. Fehlt ein passender Link oder kann die Produktseite nicht bestätigt werden, folgt die normale Shopsuche. Bei dieser werden in allen vier Shops zuerst die Suchtreffer ausgewertet. Bereits bestätigte Ausführung, exakter Preis und Lagerstatus werden direkt übernommen; eindeutig abweichende Varianten werden aussortiert. Produktseiten und Dropdowns werden nur für fehlende Angaben geprüft. Die vier Shop-Tabs werden dabei wiederverwendet. Bei einer Sicherheitsprüfung den betroffenen Tab öffnen und die Prüfung selbst abschließen. Produktlinks öffnen das Angebot; das Symbol mit zwei Quadraten kopiert den Link.

Fehlen passende Treffer, schließt die Suche auch ohne ausdrückliches „keine Ergebnisse“-Banner ab. Eine breitere Suche wird einmal versucht. Danach wird der Artikel als ohne passendes Angebot markiert und die Wunschliste läuft weiter. Nicht antwortende Shop-Skripte haben eine begrenzte Wartezeit.

## EAN verwenden

Sobald eine eindeutige EAN gefunden wurde, wird sie ins Suchfeld und beim passenden Wunschlistenartikel übernommen. Sie wird auch in bestätigten Angeboten derselben Variante ergänzt. Bei mehreren unterschiedlichen EANs bleibt die automatische Auswahl aus.

Neben jeder EAN in den Ergebnissen steht ein Symbol mit zwei überlappenden Quadraten. Es übernimmt die Kennung direkt ins EAN-Suchfeld und gegebenenfalls in den zugehörigen Wunschlistenartikel und kopiert sie zusätzlich in die Zwischenablage. Anschließend „Suchen“ klicken. Das gleiche Symbol neben Shoplinks kopiert dagegen den Link in die Zwischenablage.

Ist das EAN-Häkchen aktiviert, wird eine vorhandene EAN von Anfang an als Suchbegriff verwendet. Ohne Häkchen wird nach dem Namen gesucht; eine gespeicherte EAN kann dann dennoch ein auf der Produktseite geprüftes ähnliches Angebot bestätigen, wenn EAN und gewünschte Variante übereinstimmen. Wird sie erst während der Suche gefunden, werden Shops mit mehreren Treffern einmal mit der EAN nachgesucht. Eine erfolglose EAN-Nachsuche entfernt keine zuvor gefundenen Angebote.

Bei BIKE24 wird auch die GTIN im Datenblatt als EAN gelesen. Bei r2-bike wird die EAN aus der Beschreibung übernommen; falls erforderlich, öffnet die Erweiterung „mehr lesen“. Eine Änderung des Produktnamens oder der Variante entfernt die bisherige EAN, damit sie nicht für einen anderen Artikel verwendet wird.

## Wunschliste und Dateien

„Zur Wunschliste hinzufügen“ speichert die Suche samt Variante und Maximalpreis. Liegt bereits eine abgeschlossene Ad-hoc-Suche für denselben Artikel, dieselbe Variante und passende EAN vor, werden die vorhandenen Shop-Ergebnisse samt ursprünglichen Abfragezeiten übernommen, ohne erneut zu suchen. Andernfalls startet die Prüfung automatisch. Diese Angaben können anschließend pro Artikel geändert werden. Über „Name korrigieren“ den Suchnamen bearbeiten und mit „Speichern“ übernehmen oder mit „Abbrechen“ verwerfen. Variante und Maximalpreis bleiben erhalten; Suchergebnisse werden bei einer Änderung zurückgesetzt. Danach erneut prüfen. „Erneut suchen“ prüft nur diesen Artikel in allen vier Shops und aktualisiert dessen Ergebnisse und den Gesamtpreis. Die anderen Artikel bleiben erhalten. Eine fehlende EAN wird dabei ergänzt, wenn die gefundenen Angebote eine eindeutige Kennung liefern.

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

## Lokaler Preisverlauf

Nach abgeschlossenen Suchen speichert die Erweiterung bestätigte, lieferbare Angebote pro EAN in IndexedDB. Über „Preisverlauf“ beim Wunschlistenartikel erscheint eine Grafik des günstigsten lieferbaren Preises mit Zeitraumauswahl und Tabelle. Maximalpreise begrenzen diese Historie nicht. Die Aufzeichnung beginnt mit zukünftigen Suchen; alte Ergebnisse werden nicht nachträglich als neue Preise erfasst.

„Als Datei speichern“ exportiert auch die Historie; „Datei laden“ stellt sie wieder her. Beim Deinstallieren werden die lokalen Daten gelöscht.

Das Preisfeld akzeptiert ein Maximum (z. B. `10`) oder einen Bereich (z. B. `5-10`). Beide Grenzen gelten auch für ähnliche Produktvorschläge. Bei gesetzter Preisgrenze werden Vorschläge ohne bestätigten Preis ausgeblendet; die gespeicherten Ergebnisse bleiben erhalten.

Die Oberfläche folgt automatisch dem in Firefox eingestellten Website-Farbschema. Der Dunkelmodus verwendet eine zurückhaltende Smyck-Palette und gilt auch für Dialoge und den Preisverlauf. Ein Wechsel wird ohne Neuladen übernommen.

Shopprüfungen haben ein Gesamtzeitlimit von 60 Sekunden (EAN-Nachsuche: 30 Sekunden). Bei einem blockierten Shop bleiben abgeschlossene Ergebnisse erhalten und die Wunschliste wird fortgesetzt. Eine zusätzliche Absicherung nach 105 Sekunden pro Artikel verhindert das Warten auf verlorene Abschlussmeldungen. Übersprungene Shops und ältere Ergebnisse werden entsprechend gekennzeichnet.

Mit „Shop-Tabs schließen“ werden die von diesem Teilefinder-Tab geöffneten Shop-Tabs gemeinsam geschlossen und eine laufende Suche gestoppt. Gespeicherte Ergebnisse bleiben erhalten. Beim Schließen des Teilefinder-Tabs werden seine Shop-Tabs automatisch geschlossen. Selbst geöffnete Shop-Tabs und die Tabs anderer Teilefinder-Fenster bleiben erhalten.

Bei der Ad-hoc-Suche schaltet der Schalter neben „EAN“ zwischen EAN- und Namenssuche um. Aktiviert wird zuerst die EAN verwendet; Shops ohne EAN-Treffer werden anschließend mit Produktname und Variante erneut geprüft. Ohne Schalter wird direkt nach dem Namen gesucht. Bereits gefundene EAN-Treffer bleiben erhalten. Beim Hinzufügen zur Wunschliste wird die EAN-Einstellung übernommen; die automatische Namenssuche nach erfolgloser EAN-Suche gilt für Ad-hoc-Abfragen.

Bei unterschiedlichen Shop-Bezeichnungen wird zusätzlich eine exakte Modellkennung mit Marke und gemeinsamen Produktmerkmalen abgeglichen. Falls nötig, wird die Shopsuche auf Marke und Modell eingegrenzt. Zahlen im Variantenfeld können im Artikeltitel oder in der ausgewählten Ausführung stehen; eine abweichende ausgewählte Ausführung hat Vorrang. Preise und Teile von Modellnummern bestätigen keine reine Zahlenvariante.

Ein Klick auf den laufenden Suchfortschritt stoppt die Suche. Während der Listenprüfung stoppt auch der Button „Prüfe …“ die gesamte Prüfung. Bereits gefundene Ergebnisse bleiben erhalten. Beide Bedienelemente sind auch per Tastatur erreichbar.

Preis und Ausführung in der Wunschliste lassen sich direkt im Feld bearbeiten: Beim ersten Klick wird der Inhalt markiert. Enter übernimmt die Änderung, Escape setzt den gespeicherten Wert wieder ein. Beim Verlassen des Feldes wird ebenfalls gespeichert. „Bearbeiten“ neben dem Artikelnamen ist nur für den Namen erforderlich.

Zeigen alle vier Shop-Listen für einen Artikel ein Angebot innerhalb des Preis- und Variantenfilters an, werden die EAN-Zeilen in der Gesamtübersicht und den Shop-Ergebnissen ausgeblendet. Es zählen die bereits angezeigten Ergebnisse, unabhängig von EAN-Metadaten und Abschlusskennzeichen. Eine neue Suche ist dafür nicht nötig; das EAN-Eingabefeld bleibt erhalten. Fehlt in einer Shop-Liste ein passendes Angebot, erscheinen die EAN-Zeilen wieder.

Bei erfolglosen EAN-Abfragen unterscheidet die Meldung zwischen einer abweichenden EAN, einer nicht auslesbaren EAN und einer bestätigten EAN mit nicht bestätigter Wunschvariante. Abweichende Produkte werden nicht als passende Angebote übernommen.
