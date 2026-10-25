# Teilefinder – Handbuch

## Signierte Installation (Unlisted)

Der Firefox-Build benötigt Firefox Desktop 140 oder neuer. Das lokal erzeugte ZIP ist noch kein signiertes Add-on. Die Einreichung und Installation einer von Mozilla signierten XPI sind in `release/UNLISTED.md` beschrieben.

## Installation in Firefox

1. Im Projektordner `npm run build` ausführen.
2. Firefox öffnen und `about:debugging#/runtime/this-firefox` aufrufen.
3. „Temporäres Add-on laden“ wählen und `outputs/firefox-addon/manifest.json` öffnen.
4. Über das Teilefinder-Symbol die Suchoberfläche öffnen.

Die Erweiterung arbeitet vollständig im Browser; ein lokaler Server ist nicht erforderlich. Temporäre Add-ons müssen nach einem Firefox-Neustart erneut geladen werden.

## Installation in Chrome

1. `npm run build` ausführen (oder nur Chrome: `npm run build:chrome`).
2. `chrome://extensions` öffnen und den Entwicklermodus aktivieren.
3. „Entpackte Erweiterung laden“ wählen und den Ordner `outputs/chrome-addon/` auswählen.
4. Über das Teilefinder-Symbol die Oberfläche öffnen.

Voraussetzung: Chrome 114 oder neuer. Der lokale Build ist keine Veröffentlichung im Chrome Web Store. Zum Aktualisieren wieder in denselben Ausgabeordner bauen und unter `chrome://extensions` bei Teilefinder „Neu laden“ wählen; nicht entfernen und neu installieren.

Firefox und Chrome verwenden jeweils eigenen lokalen Erweiterungsspeicher und eine eigene Preishistorie. Für die Übertragung „Als Datei speichern“ im bisherigen Browser und „Datei laden“ im anderen Browser verwenden. Es gibt keine automatische Browser-Synchronisierung.

## Aktualisieren

1. Die Wunschliste über „Als Datei speichern“ sichern.
2. Den neuen Quellcode im selben Projektordner bereitstellen und `npm run build` ausführen.
3. Unter `about:debugging` bei Teilefinder „Neu laden“ klicken. Die Erweiterung dabei nicht entfernen.
4. Die Teilefinder-Oberfläche schließen und über das Erweiterungssymbol neu öffnen; vorhandene Shop-Tabs neu laden, damit neue Skripte aktiv sind. Beim Umstieg auf 0.8.0 ändert sich die Adresse der Oberfläche, die Firefox-Add-on-ID bleibt erhalten.
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

Gemeinsamer Quellcode: `teilefinder/src/`. Browser-Manifeste: `teilefinder/manifests/`. Tests: `teilefinder/*.test.mjs` und `teilefinder/local-browser/extract.test.mjs`. Beide Manifeste tragen dieselbe Version; der Build prüft die Übereinstimmung. Generierte Dateien liegen unter `outputs/` und werden nicht in Git aufgenommen.

## Erneute Suche und Abbruch

„Suche stoppen“ beendet das Warten und lässt die bisher eingegangenen Ergebnisse bestehen. Bleibt eine erneute Shop-Abfrage leer, werden frühere Angebote mit ihrem bisherigen Stand erhalten und als aktuell nicht bestätigt markiert. Solche alten Angebote fließen nicht in den aktuellen Gesamtpreis ein.

## Lokaler Preisverlauf

Nach abgeschlossenen Suchen speichert die Erweiterung bestätigte, lieferbare Angebote pro EAN in IndexedDB. Über „Preisverlauf“ beim Wunschlistenartikel erscheint eine Grafik des günstigsten lieferbaren Preises mit Zeitraumauswahl und Tabelle. Maximalpreise begrenzen diese Historie nicht. Die Aufzeichnung beginnt mit zukünftigen Suchen; alte Ergebnisse werden nicht nachträglich als neue Preise erfasst.

„Als Datei speichern“ exportiert auch die Historie; „Datei laden“ stellt sie wieder her. Beim Deinstallieren werden die lokalen Daten gelöscht.

Das Preisfeld akzeptiert ein Maximum (z. B. `10`) oder einen Bereich (z. B. `5-10`). Beide Grenzen gelten auch für ähnliche Produktvorschläge. Bei gesetzter Preisgrenze werden Vorschläge ohne bestätigten Preis ausgeblendet; die gespeicherten Ergebnisse bleiben erhalten.

Die Oberfläche folgt automatisch dem im Browser eingestellten Website-Farbschema. Der Dunkelmodus verwendet eine zurückhaltende Smyck-Palette und gilt auch für Dialoge und den Preisverlauf. Ein Wechsel wird ohne Neuladen übernommen. Das Sonne/Mond-Symbol rechts oben schaltet manuell zwischen Hell und Dunkel um. Die manuelle Auswahl gilt bis zum Neuladen bzw. erneuten Öffnen der Oberfläche; dann wird wieder das Browser-Design verwendet.

Shopprüfungen haben ein Gesamtzeitlimit von 60 Sekunden (EAN-Nachsuche: 30 Sekunden). Bei einem blockierten Shop bleiben abgeschlossene Ergebnisse erhalten und die Wunschliste wird fortgesetzt. Eine zusätzliche Absicherung nach 105 Sekunden pro Artikel verhindert das Warten auf verlorene Abschlussmeldungen. Übersprungene Shops und ältere Ergebnisse werden entsprechend gekennzeichnet.

Mit „Shop-Tabs schließen“ werden die von diesem Teilefinder-Tab geöffneten Shop-Tabs gemeinsam geschlossen und eine laufende Suche gestoppt. Gespeicherte Ergebnisse bleiben erhalten. Beim Schließen des Teilefinder-Tabs werden seine Shop-Tabs automatisch geschlossen. Selbst geöffnete Shop-Tabs und die Tabs anderer Teilefinder-Fenster bleiben erhalten.

Bei der Ad-hoc-Suche schaltet der Schalter neben „EAN“ zwischen EAN- und Namenssuche um. Aktiviert wird zuerst die EAN verwendet; Shops ohne EAN-Treffer werden anschließend mit Produktname und Variante erneut geprüft. Ohne Schalter wird direkt nach dem Namen gesucht. Bereits gefundene EAN-Treffer bleiben erhalten. Beim Hinzufügen zur Wunschliste wird die EAN-Einstellung übernommen; die automatische Namenssuche nach erfolgloser EAN-Suche gilt für Ad-hoc-Abfragen.

Bei unterschiedlichen Shop-Bezeichnungen wird zusätzlich eine exakte Modellkennung mit Marke und gemeinsamen Produktmerkmalen abgeglichen. Falls nötig, wird die Shopsuche auf Marke und Modell eingegrenzt. Zahlen im Variantenfeld können im Artikeltitel oder in der ausgewählten Ausführung stehen; eine abweichende ausgewählte Ausführung hat Vorrang. Preise und Teile von Modellnummern bestätigen keine reine Zahlenvariante.

Ein Klick auf den laufenden Suchfortschritt stoppt die Suche. Während der Listenprüfung stoppt auch der Button „Prüfe …“ die gesamte Prüfung. Bereits gefundene Ergebnisse bleiben erhalten. Beide Bedienelemente sind auch per Tastatur erreichbar.

Preis und Ausführung in der Wunschliste lassen sich direkt im Feld bearbeiten: Beim ersten Klick wird der Inhalt markiert. Enter übernimmt die Änderung, Escape setzt den gespeicherten Wert wieder ein. Beim Verlassen des Feldes wird ebenfalls gespeichert. „Bearbeiten“ neben dem Artikelnamen ist nur für den Namen erforderlich.

Zeigen alle vier Shop-Listen für einen Artikel ein Angebot innerhalb des Preis- und Variantenfilters an, werden die EAN-Zeilen in der Gesamtübersicht und den Shop-Ergebnissen ausgeblendet. Es zählen die bereits angezeigten Ergebnisse, unabhängig von EAN-Metadaten und Abschlusskennzeichen. Eine neue Suche ist dafür nicht nötig; das EAN-Eingabefeld bleibt erhalten. Fehlt in einer Shop-Liste ein passendes Angebot, erscheinen die EAN-Zeilen wieder.

Bei erfolglosen EAN-Abfragen unterscheidet die Meldung zwischen einer abweichenden EAN, einer nicht auslesbaren EAN und einer bestätigten EAN mit nicht bestätigter Wunschvariante. Abweichende Produkte werden nicht als passende Angebote übernommen.

Bei aktivierter EAN-Suche werden Angebote mit ausdrücklich abweichender EAN aus Ergebnissen und Wunschliste entfernt, auch wenn eine EAN-Nachsuche erfolglos bleibt. Eine neu gefundene EAN gilt als eindeutig, wenn sie die einzige gemeinsame Kennung aller Shops mit ausgelesenen EANs ist. Mehrere Varianten in einem Shop verhindern diese Eingrenzung nicht. Ohne aktivierten EAN-Schalter bleibt die Namenssuche erhalten.

BIKE24: Bei Dropdown-Ausführungen wird die EAN nach der Auswahl gemeinsam mit Preis und Lagerstatus gelesen. Eine mehrdeutige GTIN-Liste löst bei vorhandenen Optionen eine vollständige Variantenprüfung aus. Explizite SKU/EAN-Zuordnungen aus den Produktdaten werden bevorzugt; die Reihenfolge einer GTIN-Liste wird nicht als Zuordnung verwendet. Eine nach dem Optionswechsel unveränderte SKU in der URL bestätigt nicht die neue Ausführung.

Liefert eine EAN-Suche mehrere bestätigte Angebote, grenzt der ursprüngliche Produktname mit exakter Modellkennung die Auswahl zusätzlich ein. Passende Namen werden bei der Detailprüfung bevorzugt. Wenn kein Name zuverlässig übereinstimmt, bleiben die bestätigten EAN-Treffer erhalten; ein Namensmatch ersetzt keine EAN-Bestätigung.

Bei BIKE24 öffnet die Detailprüfung „Datenblatt“ und wartet auf nachgeladene GTIN-Werte. Ist die gesuchte EAN dort in einer Liste enthalten, aber keiner ausgewählten Ausführung eindeutig zuzuordnen, wird diese Mehrdeutigkeit ausdrücklich angezeigt. Die bloße Listenposition gilt nicht als Zuordnung.

BIKE24 kann ein kombiniertes Ergebnis anzeigen, wenn Produktname/Modell passen, die eingegebene EAN im Datenblatt steht und die gewünschte Dropdown-Ausführung tatsächlich ausgewählt und mit Preis ausgelesen wurde. Diese Ergebnisse werden nicht als variantenspezifische Preisbeobachtung gespeichert oder als EAN-Quelle für andere Shops verwendet. Eine explizit andere EAN der ausgewählten Ausführung wird niemals überschrieben.

## Gemeinsame Architektur und Build-Ziele

- `src/ui/`: gemeinsame Oberfläche, Layout, Dialoge und Zwischenablage.
- `src/core/`: Produkt-/EAN-/Variantenregeln, Wunschliste, Preisvergleich und gemeinsamer Suchcontroller.
- `src/shops/`: DOM-Reader und Variantenauswahl für die vier Shops.
- `src/data/`: IndexedDB-Anbindung für die bestehende Preishistorie.
- `src/platform/`: native Browser-APIs, lokaler Nachrichtenbus und wiederherstellbare Shop-Tab-Zuordnung.
- `manifests/firefox.json`: Manifest V2 mit unveränderter Gecko-ID.
- `manifests/chrome.json`: Manifest V3 mit kleinem Service Worker.

Suchjobs laufen im geöffneten Teilefinder-Tab. Der Hintergrund verwaltet ausschließlich Toolbar-Ereignisse und Tab-Besitzdaten in `storage.session`. Ein Hintergrund-Neustart beendet deshalb keine Listenprüfung. Neu geöffnete Produktlinks über „Zum Shop“ sind manuelle Tabs und werden nicht als Such-Tabs registriert.

`npm run build` prüft und erzeugt beide ZIPs sowie die stabilen Ordner `outputs/firefox-addon/` und `outputs/chrome-addon/`. Einzelziele: `npm run build:firefox` und `npm run build:chrome`. `npm test` führt Syntax- und Regressionstests aus. Nach dem Build: `npm run lint:extension` für Firefox sowie `npm run lint:chrome` für die Chrome-Manifest-/Dateiprüfung. Die Builds enthalten unveränderte, lokal lesbare Quellen, keine Browserprofile oder Zugangsdaten.

Plan, Prüfkriterien und der Stand der Live-Abnahme: [Cross-Browser-Plan](docs/CROSS-BROWSER-PLAN.md).
