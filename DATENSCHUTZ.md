# Datenschutzerklärung für Teilefinder

**Teilefinder – Fahrradteile vergleichen**

**Stand: 30. Oktober 2026**

## Kontakt

Website und Kontakt zum Anbieter: [www.dgd-racing-team.de](https://www.dgd-racing-team.de/).

Diese Erklärung beschreibt die Datenverarbeitung der Browser-Erweiterung Teilefinder für Chrome und Firefox.

## Zweck und Funktionsweise

Teilefinder vergleicht Fahrradteile bei BIKE24, Bike-Discount, bike-components und r2-bike. Du kannst einzelne Artikel suchen, Wunschlisten lokal speichern, Preise und Lagerstatus aktualisieren und einen lokalen Preisverlauf anzeigen.

Die Verarbeitung erfolgt im Browser. Für Teilefinder gibt es keinen eigenen Server zur Verarbeitung deiner Such- oder Wunschlistendaten, kein Benutzerkonto, keine Telemetrie und keine eingebundenen Analyse- oder Werbedienste. Die Erweiterung übermittelt diese Daten nicht automatisch an den Entwickler.

## Verarbeitete Daten

Die Erweiterung verarbeitet die von dir eingegebenen oder importierten Produktnamen, Artikelnummern, EAN/GTIN, Varianten und Preisgrenzen. Auf den Shopseiten liest sie die für den Vergleich benötigten Produktdaten: Produktname, Produktlink, Preis, Lager- und Lieferangaben, EAN/GTIN und auswählbare Varianten.

Lokal gespeichert werden:

- Wunschlistenartikel und ihre Suchvorgaben, einschließlich der Einstellung zur EAN-Suche;
- gefundene Angebote mit Preisen, Lieferangaben, Produktlinks und Abfragezeitpunkten;
- bekannte Produktlinks und konkrete Variantenauswahlen, damit spätere Prüfungen gezielt dieselbe Ausführung öffnen können;
- bestätigte lieferbare Angebote mit EAN, Shop, Preis, Produktlink und Zeitstempel für den Preisverlauf;
- die Einstellung zum Laden von Shop-Bildern.

Wunschliste, Ergebnisse, Produktlink-Cache und Einstellungen liegen im lokalen Erweiterungsspeicher. Der Preisverlauf liegt in einer lokalen IndexedDB-Datenbank. Die Erweiterung verwendet keine Cloud-Synchronisierung.

## Verbindungen zu den Shops

Wenn du eine Suche oder Aktualisierung startest, öffnet beziehungsweise verwendet Teilefinder Shop-Tabs. Suchbegriffe und gegebenenfalls Artikelnummern oder EAN werden dabei als normale Shop-Suchanfragen übermittelt. Bei bekannten Artikeln werden gespeicherte Produktseiten direkt aufgerufen. Varianten werden über die Bedienelemente des Shops ausgewählt. Bei fehlenden oder nicht auslesbaren BIKE24-Produktfeldern kann Teilefinder die Produktdaten der aktuellen Seite mit einer schreibgeschützten Lieferdatenabfrage bei BIKE24 abgleichen; dabei werden die Produktkennung und das auf der Shopseite eingestellte Lieferland übermittelt. Die Erweiterung kann Cookie-Hinweise über die angebotenen Ablehnen- beziehungsweise Nur-notwendige-Cookies-Optionen schließen.

Die angesprochenen Shops sind:

- [BIKE24](https://www.bike24.de/)
- [Bike-Discount](https://www.bike-discount.de/)
- [bike-components](https://www.bike-components.de/)
- [r2-bike](https://r2-bike.com/)

Die Shop-Aufrufe erfolgen über HTTPS. Dabei erhalten die Shops die üblichen Verbindungsdaten, insbesondere deine IP-Adresse, Browserinformationen sowie die aufgerufene URL und darin enthaltene Suchparameter. Der Browser kann vorhandene Shop-Cookies und Anmeldesitzungen verwenden. Shopseiten können eigene Dienstleister und Inhalte einbinden, beispielsweise für Sicherheitsprüfungen. Für deren Verarbeitung gelten die jeweiligen Datenschutzerklärungen der Shops und ihrer Dienstleister.

Die Erweiterung liest oder speichert keine Passwörter, Zahlungsdaten oder Authentifizierungs-Cookies. Sie führt keine Warenkorb-, Bestell- oder Checkout-Aktionen aus. Die Shop-Aufrufe können wie andere Seitenaufrufe im normalen Browserverlauf erscheinen. Teilefinder liest die allgemeine Browserhistorie nicht aus.

## Berechtigungen und Shop-Tabs

Der Zugriff auf Shop-Inhalte ist auf die vier genannten Shops beschränkt. Die Erweiterung verwaltet die von ihr geöffneten Shop-Tabs und verwendet sie für weitere Prüfungen wieder. Ihre eigenen Seiten, Symbole, Skripte und Schriftarten sind im Erweiterungspaket enthalten.

In verwalteten Shop-Tabs können Bildanfragen blockiert werden. Dazu werden tabbezogene Browserregeln und eine ergänzende, auf Bildquellen begrenzte Content-Security-Policy verwendet. Die Regeln dienen der Verringerung von Bilddownloads, nicht der Aufzeichnung des Netzwerkverkehrs. Die Bildeinstellung lässt sich in der Oberfläche ändern.

## Dateien und Zwischenablage

„Als Datei speichern“ erstellt auf deinem Gerät eine JSON-Datei mit Suchvorgaben, Wunschliste, Ergebnissen und Preishistorie. „Datei laden“ verarbeitet nur die von dir ausgewählte Datei. Die Erweiterung lädt solche Dateien nicht auf einen Server hoch.

Kopieraktionen schreiben auf deinen ausdrücklichen Klick Produktnamen, Shopnamen, Produkt- oder Suchlinks beziehungsweise EAN in die Zwischenablage. Für Listen können zusätzlich anklickbare HTML-Links geschrieben werden. Die Erweiterung liest den bisherigen Inhalt der Zwischenablage nicht aus. Wenn du kopierte Inhalte anschließend versendest, bestimmst du selbst die Empfänger.

## Lokale Diagnoseinformationen

Für die Fehlersuche hält die geöffnete Erweiterungsseite die letzten 20 Suchprofile im Arbeitsspeicher bereit. Sie enthalten Produktname, eingegebene EAN, Variante, EAN-Einstellung sowie Laufzeiten und technische Prüfergebnisse je Shop. Sie werden nicht automatisch übertragen und beim Neuladen der Erweiterungsseite gelöscht.

Wenn du solche Ausgaben oder exportierte Dateien selbst an den Support weitergibst, können darin deine Such- und Produktdaten enthalten sein. Eine automatische Übermittlung findet nicht statt.

## Speicherdauer und Löschen

Gespeicherte Wunschlisten, Angebote, Einstellungen und Preisverlaufsdaten bleiben lokal verfügbar, bis sie geändert, überschrieben oder über die Browserfunktionen gelöscht werden. Der Produktlink-Cache ist mengenmäßig begrenzt; ältere Einträge können durch neuere ersetzt werden.

Wunschlistenartikel kannst du in der Oberfläche bearbeiten und entfernen. Das Entfernen eines Artikels löscht nicht automatisch zugehörige Einträge im Produktlink-Cache oder im Preisverlauf. Zur vollständigen Entfernung der lokal gespeicherten Erweiterungsdaten kannst du die Erweiterung deinstallieren beziehungsweise ihre Daten mit den verfügbaren Browserfunktionen löschen. Manuell exportierte Dateien, kopierte Inhalte, Shop-Cookies und Einträge im normalen Browserverlauf musst du bei Bedarf separat löschen.

Da keine Kopie deiner lokalen Daten an den Entwickler übermittelt wird, kann der Entwickler diese Daten nicht für dich einsehen oder auf deinem Gerät löschen.

## Begrenzte Datennutzung

Die Nutzung der durch Teilefinder verarbeiteten Daten beschränkt sich auf die beschriebenen, sichtbaren Funktionen der Erweiterung. Es findet kein Verkauf dieser Daten und keine Nutzung für personalisierte Werbung, Werbeprofile oder Kreditwürdigkeitsprüfungen statt.

Die Nutzung entspricht der [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/policies), einschließlich ihrer Anforderungen zur begrenzten Nutzung („Limited Use“).

## Verlinkte Websites

Diese Erklärung betrifft die Erweiterung. Beim Besuch der Anbieter-Website, der Shops oder dieser auf GitHub veröffentlichten Seite findet zusätzlich die Datenverarbeitung des jeweiligen Website-Betreibers statt. Maßgeblich sind dafür dessen eigene Datenschutzhinweise.

## Änderungen

Bei Änderungen der Funktionen oder Datenverarbeitung wird diese Erklärung angepasst. Den Stand der Erklärung findest du oben auf dieser Seite.
