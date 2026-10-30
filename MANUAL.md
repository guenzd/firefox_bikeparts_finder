# Teilefinder – Handbuch

## Installieren

Die Erweiterung braucht keinen lokalen Server. Voraussetzung: Firefox Desktop 140+ oder Chrome 114+.

### Firefox

Für eine dauerhafte Installation die von Mozilla signierte `.xpi` unter `about:addons` → Zahnrad → „Add-on aus Datei installieren“ auswählen. Ein selbst gebautes ZIP ist noch nicht signiert. Details: [Unlisted-Signierung](release/UNLISTED.md).

Zum Entwickeln:

1. Im Repository-Hauptverzeichnis `npm run build:firefox` ausführen.
2. `about:debugging#/runtime/this-firefox` öffnen.
3. „Temporäres Add-on laden“ und `outputs/firefox-addon/manifest.json` auswählen.
4. Das Teilefinder-Symbol anklicken.

Temporäre Add-ons müssen nach einem Firefox-Neustart erneut geladen werden.

### Chrome

1. Im Repository-Hauptverzeichnis `npm run build:chrome` ausführen.
2. `chrome://extensions` öffnen und den Entwicklermodus aktivieren.
3. „Entpackte Erweiterung laden“ und `outputs/chrome-addon/` auswählen.
4. Das Teilefinder-Symbol anklicken.

Eine Store-Installation erfolgt über den veröffentlichten Store-Eintrag. Der lokale Build veröffentlicht nichts; siehe [Chrome Web Store](release/CHROME-WEB-STORE.md).

## Aktualisieren und Daten behalten

Vor dem Update „Als Datei speichern“ verwenden. Für Entwicklungsinstallationen erneut in denselben Ausgabeordner bauen und bei der vorhandenen Erweiterung „Neu laden“ wählen. Anschließend die Teilefinder-Seite schließen und über das Symbol neu öffnen. Eine neue signierte Firefox-XPI über die bestehende Installation installieren. Die Firefox-ID bleibt unverändert.

**Nicht erst deinstallieren:** Dabei können Wunschliste, Ergebnisse und Historie verloren gehen. Falls nötig, die Sicherung über „Datei laden“ wiederherstellen. Firefox und Chrome haben getrennte lokale Daten; für den Wechsel ebenfalls Datei-Export/-Import nutzen. Es gibt keine Cloud-Synchronisierung.

## Einzelteil suchen

| Feld | Eingabe |
| --- | --- |
| Produktname | Name beziehungsweise Modell des gesuchten Artikels |
| EAN | Optional bekannte Kennung; der Schalter bestimmt, ob damit gesucht wird |
| Variante | Gewünschte Merkmale, etwa `30 mm`, `black, M` oder `116` |
| Preis € | Maximum wie `60` oder Bereich wie `30-60`; Dezimalkomma ist möglich |

„Suchen“ startet die vier Shops. Bei BIKE24 kann die Erweiterung fehlende oder nicht auslesbare Produktfelder durch frisch bestätigte Produkt- und Lieferdaten desselben Shops ergänzen; der Shop-Tab bleibt dabei im Hintergrund. Zuerst werden Suchtreffer ausgewertet; Produktseiten und Optionen werden für fehlende Angaben geprüft. Mengen wie `1 L` und `1000 ml` werden gleichgesetzt. Packungsangaben wie `24er`, `24 Stück` und `24x50g` bestätigen dieselbe Stückzahl; abweichende Mengen bleiben verschieden. Modellnummern und Zahlenvarianten bleiben streng; die Ausführung kann im Titel oder in der ausgewählten Option stehen. Zeichensetzung im Produktnamen zählt nicht als eigenes Suchwort. Bei festen Produkten werden auch ausdrücklich beschriftete Angaben wie „Inhalt: 100 ml“ aus der Produktbeschreibung berücksichtigt. Mengen in Werbetexten oder Grundpreisen bestätigen keine Variante. Es gibt keine produktbezogenen Suchbegriff-Sonderregeln.

Ein Variantenlink muss nicht bereits alle gewünschten Merkmale nennen: Eine Packungsgröße kann auf eine weitere Produktseite führen, auf der anschließend der Geschmack gewählt wird. Eine Datenblattliste mit mehreren EANs bestätigt dabei noch keine konkrete Ausführung.

Wenn der Name passt, aber die Variante nicht bestätigt wurde, erscheinen andere Ausführungen zur Auswahl. „Ohne Variantenfilter suchen“ entfernt den Variantenfilter. Ähnliche Produkte lassen sich übernehmen; dadurch startet eine neue Suche. Preisgrenzen schränken auch Vorschläge ein. Bei gesetzter Grenze werden Vorschläge ohne bestätigten Preis ausgeblendet.

Bei einer allgemeinen Namenssuche mit mehreren unterschiedlichen passenden Produkten wird je Shop das günstigste bestätigte, lieferbare Produkt im Preis- und Variantenfilter angezeigt. Günstigere nicht lieferbare Produkte gewinnen nicht. Fehlende Angaben werden bevorzugt bei günstigen Kandidaten geprüft; eine allgemeine Suche wird nicht automatisch auf die EAN eines einzelnen Treffers eingegrenzt. In der EAN-Phase bleibt die angegebene Kennung verbindlich; der anschließende Rückfall auf den Namen ist unter „EAN verwenden“ beschrieben. Ohne lieferbares Angebot bleibt ein nicht lieferbarer Treffer zur Prüfung anklickbar.

Die Alternativen bleiben gespeichert. Wird der Preisbereich geändert, wird daraus der passende Shop-Bestpreis neu ausgewählt. Diese Auswahl gilt auch im Shop-Popup und beim Kopieren und bleibt beim Datei-Export/-Import erhalten.

Die Einzelteilsuche klappt Wunschliste und deren Ergebnisse ein, ohne sie zu löschen. Eine Listenprüfung verändert die manuellen Suchfelder nicht.

## EAN verwenden

Eine eindeutig gefundene EAN wird beim zugehörigen Artikel ergänzt. Unterschiedliche mögliche Kennungen werden nicht willkürlich ausgewählt. Das Kopiersymbol neben einer EAN kopiert sie in die Zwischenablage **und** übernimmt sie ins zugehörige EAN-Feld.

Mit aktiviertem EAN-Schalter wird eine vorhandene EAN als Suchbegriff verwendet. Gleichwertige UPC-/EAN-Schreibweisen mit führenden Auffüllnullen werden als dieselbe Kennung erkannt. Bei einer leeren Kennungssuche wird einmal die gleichwertige UPC-/EAN-Schreibweise im selben Shop-Tab versucht. Verpackungskennungen mit anderer führender Ziffer gelten weiterhin als andere Artikel. Die eingegebene Kennung wird dabei nicht umgeschrieben. In der EAN-Phase wird eine ausdrücklich andere Kennung ausgeschlossen. Bei mehreren bestätigten Treffern kann der Produktname die Auswahl weiter eingrenzen, ersetzt aber keine EAN-Bestätigung. Bei Einzelteilsuche, Einzelaktualisierung und kompletter Wunschlistenprüfung wird je Shop zuerst die EAN geprüft. Gibt es keinen bestätigten Treffer innerhalb der Preisgrenzen und der gewünschten Variante, folgt eine Namenssuche mit denselben Preis- und Variantenfiltern. Vorhandene passende Produktlinks werden dabei wiederverwendet. Ausgewiesene Sicherheitsprüfungen und technische Fehler lösen keinen zusätzlichen Suchlauf aus. Ein nicht lieferbarer, aber passender EAN-Treffer im Preisbereich bleibt ein Treffer. Erfolgreiche EAN-Ergebnisse anderer Shops bleiben erhalten. Namens-Treffer bestätigen die ursprüngliche EAN nicht; eine gelesene andere Kennung oder eine fehlende Kennung bleibt unverändert, und die gespeicherte Such-EAN wird nicht automatisch ersetzt. Mit ausgeschaltetem Schalter wird nach dem Namen gesucht; eine gespeicherte EAN kann dennoch ein gelesenes Angebot bestätigen.

Wird die EAN erst im Suchlauf gefunden, können Shops mit mehreren Treffern einmal damit nachgeprüft werden. Eine erfolglose Nachsuche entfernt keine zuvor bestätigten passenden Angebote.

BIKE24 liest die GTIN unter „Datenblatt“, r2-bike bei Bedarf über „mehr lesen“ in der Beschreibung. Bei mehreren GTINs wird keine Zuordnung anhand der Listenreihenfolge erfunden. Ein kombiniertes BIKE24-Ergebnis aus passendem Produkt, Datenblatt-EAN und ausgewählter Variante gilt nicht als variantenspezifische EAN-Bestätigung für andere Shops oder die Preishistorie.

Die wiederholten EAN-Zeilen in Ergebnissen werden ausgeblendet, sobald für den Artikel in allen vier Shop-Listen passende Angebote im Preis-/Variantenfilter angezeigt werden. Eine neue Suche ist dafür nicht erforderlich; die EAN bleibt im Editor verfügbar.

## Wunschliste

„Zur Wunschliste hinzufügen“ speichert die Vorgaben und startet die Prüfung. Liegt schon eine abgeschlossene passende Einzelteilsuche vor, werden deren Angebote samt ursprünglichem Stand übernommen, ohne neu zu suchen.

Eingaben und günstigste Ergebnisse stehen in einer gemeinsamen Liste:

| Aktion | Wirkung |
| --- | --- |
| Artikelname anklicken | Shopvergleich mit gefilterten Angeboten, günstigster Preis zuerst |
| Shopnamen in der Übersicht anklicken | Zur jeweiligen Shopliste weiter unten springen |
| Preis anklicken | Lokalen Preisverlauf öffnen |
| Stift in der festen Spalte rechts im Artikelbereich | Name, EAN samt Schalter, Ausführung und Preisbereich unter der Zeile bearbeiten |
| ↻ | Nur diesen Artikel aktualisieren |
| × | Artikel aus der Wunschliste entfernen |

Im Editor übernimmt „Speichern“ die Änderungen gemeinsam. „Abbrechen“ oder Escape verwirft sie. Eine reine Preisänderung erhält die Ergebnisse. Eine Namenskorrektur erhält die EAN; eine geänderte Variante entfernt die unverändert übernommene alte EAN, damit sie nicht die neue Ausführung festlegt.

„Wunschliste prüfen“ nutzt pro Shop eine eigene Warteschlange. Innerhalb eines Shops laufen die Artikel nacheinander; unterschiedliche Shops können bereits verschiedene Artikel prüfen. Es bleibt bei einem Tab pro Shop. Die Anzeige markiert immer nur den ersten noch nicht vollständig geprüften Artikel. Die Markierung bleibt damit beim zurückliegenden Artikel und springt nicht zwischen den schnelleren Shop-Warteschlangen. Bei einer Einzelaktualisierung zeigt der obere Button den Fortschritt als 0/4 bis 4/4 Shops. Andere Aktionen, die dieselben Shop-Tabs benötigen, sind währenddessen gesperrt.

Während der Prüfung ist die aktive Artikelzeile dezent grün hinterlegt; ihr Aktualisieren-Symbol dreht sich. Bei reduzierter Bewegung bleibt die Hervorhebung ohne Animation sichtbar. Ein Klick auf den laufenden Fortschritt stoppt die Suche. Bereits gelesene Ergebnisse bleiben erhalten. Shopprüfungen haben Zeitlimits; blockierte oder nicht antwortende Shops sollen die Liste nicht dauerhaft aufhalten.

## Bekannte Artikel direkt aktualisieren

Bestätigte Produkt-URLs werden lokal gespeichert, zusammen mit der tatsächlich ausgewählten Variante: etwa Optionswerte, IDs und Beschriftungen mehrerer abhängiger Dropdowns. Beim Aktualisieren wird die Seite direkt geöffnet und die Auswahl wiederhergestellt. Beim Wechsel eines wiederverwendeten Shop-Tabs wartet der Leser auf die Zielseite; Antworten der vorherigen Seite verbrauchen nicht die begrenzten Produktprüfungen. Preis, Lagerstatus und Kennung werden frisch gelesen. Bei bestätigter EAN und gewünschter Ausführung mit exaktem Preis und bekanntem Lagerstatus werden weitere Optionen desselben Produkts nicht mehr durchgeklickt. Eine reine Datenblatt-EAN reicht dafür nicht. Bei Bike-Discount wird eine ausdrücklich ausgewiesene EAN der gewählten Variante auch dann gelesen, wenn daneben eine andere UPC steht. Für den Preis wird ausschließlich das Produktpreisfeld verwendet; Preise und UVPs der Empfehlungskarten werden nicht übernommen. Bei Bike-Discount reicht ein bereits markiertes Radiofeld nicht als Auswahlbestätigung: Falls der Shop noch seine Platzhalteranzeige zeigt, wird das Variantenlabel erneut ausgelöst. Die Stabilitätsprüfung berücksichtigt verzögerte Timer in Hintergrundtabs und verlangt zwei übereinstimmende Auslesungen. Geänderte oder entfernte Optionen führen zurück zur normalen Variantenprüfung auf der Produktseite.

Bei der Wunschlistenprüfung wird eine bekannte, nicht bestätigte Produktseite nicht durch zusätzliche Shopsuchen ersetzt. Der frühere Link bleibt erhalten. Nur Shops ohne passenden gespeicherten Link werden durchsucht. Die Einzelteilsuche kann auf die Shopsuche zurückfallen.

„Frühere Angebote, nicht bestätigt“ bedeutet: Das aktuelle Auslesen konnte diese Angebote nicht bestätigen. Der alte Preis bleibt mit seinem ursprünglichen Stand sichtbar, zählt aber nicht zu aktuellen Summen oder zur neuen Preishistorie. Das bedeutet nicht automatisch „ausverkauft“.

## Preise und Lieferstatus

Der günstigste Gesamtpreis verwendet je Artikel das günstigste **bestätigte, lieferbare Angebot** mit exaktem Preis, gewünschter Variante und passendem Preisbereich. Fehlen Artikel, wird eine Teilsumme angezeigt. Versandkosten werden nicht eingerechnet.

„Lieferbar 3/4“ nennt die Anzahl lieferbarer Shops; mehrere Angebote desselben Shops zählen einmal. Nicht lieferbare Artikel bleiben anklickbar. Die obere Übersicht vereinheitlicht den Status, die Shoplisten und der Dialog zeigen die Shoptexte.

Jede Shopüberschrift nennt Summe und Abdeckung als x/x Produkte. Pro Wunschlistenartikel zählt ein lieferbares Angebot. Neben dem Shoppreis zeigt die dezente Differenz einen Aufpreis gegenüber dem Bestpreis mit `+` an. Nicht bestätigte frühere Angebote zählen nicht zur aktuellen Vergleichssumme.

## Links und Listen kopieren

„Öffnen“ zeigt das Produkt, „Suchen“ die Shopsuche. Das Symbol mit zwei Quadraten kopiert den jeweiligen Link. Trackingparameter wie `origin` werden entfernt; benötigte Varianten- und SKU-Parameter bleiben erhalten.

„Lieferbare kopieren“ kopiert ausschließlich lieferbare Artikel, nach Shop gruppiert, jeweils mit Namen und URL. Für E-Mail-Programme wird zusätzlich HTML mit anklickbaren Links angeboten; Messenger können stattdessen die Textfassung verwenden.

## Sicherung als Datei

„Als Datei speichern“ exportiert die vollständige Ansicht: Suchfelder, Einzelteilergebnisse, Wunschliste, Angebote, Produktlinks, Variantenauswahlen, Abfragezeiten und Preishistorie. Die JSON-Datei liegt außerhalb der Erweiterung. Änderungen werden nicht automatisch in diese Datei zurückgeschrieben.

„Datei laden“ stellt die gespeicherte Suche wieder her und ergänzt die Wunschliste. Identische Kombinationen aus Name, Variante und Preisbereich werden zusammengeführt; neuere vorhandene Ergebnisse bleiben erhalten. Ältere Dateien mit reinen Suchvorgaben bleiben lesbar. Importierte Preise behalten ihren alten Abfragezeitpunkt.

## Preisverlauf

Nach abgeschlossenen Suchen werden bestätigte, lieferbare Angebote je EAN lokal in IndexedDB gespeichert. Diagramm und Tabelle zeigen je Kalendertag den niedrigsten Preis. Höhere Messungen desselben Tages entfallen in der Ansicht. Bei mehr als zwei gleichen Tagespreisen hintereinander bleiben die Randpunkte erhalten; mittlere Wiederholungen entfallen. Die gespeicherten Messungen bleiben vollständig erhalten. Preisgrenzen begrenzen diese Aufzeichnung nicht. Die Anzeige nennt Tiefstpreis und aktuellen aufgezeichneten Preis.

Die Aufzeichnung beginnt mit den Suchläufen; alte importierte Ergebnisse werden nicht als neue Messung ausgegeben. Export und Import enthalten auch die Historie. Ohne bestätigte EAN gibt es keinen zugeordneten Preisverlauf.

## Shop-Tabs, Bilder und Design

Pro Teilefinder-Tab werden vier Shop-Tabs wiederverwendet. „Shop-Tabs schließen“ schließt diese gemeinsam und stoppt eine laufende Prüfung. Auch das Schließen des Teilefinder-Tabs schließt seine Such-Tabs. Manuell geöffnete Produktlinks und Tabs anderer Teilefinder-Fenster bleiben erhalten. Ein noch sichtbares Browser-Ladesymbol kann länger laufen als das Auslesen der Produktdaten.

„Bilder laden“ ist standardmäßig ausgeschaltet. Die Bildsperre gilt nur in verwalteten Shop-Tabs, auch für CDN-Fotos. Skripte, CSS und Datenabfragen bleiben aktiv. Die Einstellung wird lokal gespeichert und wirkt bei der nächsten Navigation beziehungsweise beim Neuladen der Shopseite. Sicherheitsprüfungen bei Bedarf selbst im Shop-Tab abschließen.

Die Oberfläche folgt dem Browser-Farbschema. Sonne/Mond schaltet manuell um, bis die Oberfläche neu geladen wird; dann gilt wieder das Browser-Design. „Nicht lieferbar“ ist in einem gedeckten Orange gekennzeichnet, unbekannter Lagerstatus bleibt neutral. Schrift und Symbole sind lokal enthalten.

## Technik und Fehlersuche

Build-Befehle und Quellstruktur stehen im [README](README.md), Laufzeitmessungen unter [Profiling](docs/SEARCH-PROFILING.md). Ein leeres `getSearchProfiles()` nach dem Neuladen ist normal: Profile liegen nur im Arbeitsspeicher der geöffneten Teilefinder-Seite.

Datenspeicherung und Berechtigungen: [Datenschutzerklärung](DATENSCHUTZ.md).

## Modellnummern bei der Suche

Wenn eine Namenssuche kein passendes Angebot im Preis- und Variantenfilter liefert, wird bei genau einer eindeutig erkannten Modellnummer einmal zusätzlich nach dieser gesucht. Treffer müssen weiterhin zum ursprünglichen Namen passen; Marke, Modell und Produktbeschreibung werden geprüft. Sicherheitsprüfungen und technische Fehler lösen diesen Zusatzversuch nicht aus. Erfolgreiche Suchen bleiben unverändert, je Shop wird derselbe Tab wiederverwendet.

## Wunschliste sortieren

Das Menü neben „Wunschliste“ bietet „Hinzugefügt“, „Name A–Z“, „Preis aufsteigend“ und „Shop A–Z“. Die Auswahl gilt für die obere Übersicht und die Listen der vier Shops. „Preis“ verwendet das günstigste lieferbare Angebot im jeweiligen Preis-/Variantenfilter. „Shop“ ordnet nach dem Shop dieses Angebots und innerhalb des Shops nach Produktname. Artikel ohne lieferbares Angebot stehen bei Name/Preis/Shop samt „Ähnliche Produkte“ am Ende, untereinander in ihrer ursprünglichen Reihenfolge. Die Vorschläge selbst werden nicht umsortiert. Gleiche Namen behalten ihre ursprüngliche Reihenfolge.

„Hinzugefügt“ stellt jederzeit die ursprüngliche Reihenfolge wieder her; Sortieren verändert weder Artikel noch Suchergebnisse. Während einer Suche ist das Menü gesperrt und die sichtbare Reihenfolge bleibt fest. Nach Abschluss wird die Sortierung mit den neuen Preisen aktualisiert. Die Auswahl bleibt beim Neuladen und im Datei-Export erhalten.

## Abweichende EAN beim Namens-Fallback

Bei aktivierter EAN-Suche ist eine ausdrücklich andere gelesene EAN kein passendes Angebot – auch dann nicht, wenn Name und Preis passen. Solche Namens-Fallback-Treffer erscheinen nur als „Ähnliche Produkte“ und zählen nicht zu Bestpreis, Shopanzahl oder Summen. Das gilt nach Neuladen oder Import auch für bereits gespeicherte Ergebnisse, ohne neue Suche. Die gesuchte EAN bleibt erhalten. Ein Namensangebot ohne auslesbare EAN kann weiterhin verwendet werden, erhält aber keine erfundene EAN. Gleichwertige UPC/EAN-Schreibweisen zählen als dieselbe Kennung. Wenn die gespeicherte EAN bewusst nicht als Filter dienen soll, kann „EAN verwenden“ am Artikel ausgeschaltet werden.
