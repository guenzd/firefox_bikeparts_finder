# Chrome Web Store: Paket und Veröffentlichung

Die Chrome-Erweiterung verwendet Manifest V3, benötigt Chrome 114+ und enthält dieselbe UI und Suchlogik wie Firefox. Ein lokaler Build ist noch kein Store-Upload.

## Paket prüfen

Im Repository-Hauptverzeichnis:

```sh
npm ci
npm run build:chrome
npm run lint:chrome
```

Zum Hochladen **`outputs/teilefinder-chrome-<Version>.zip`** verwenden, alternativ das inhaltsgleiche `outputs/teilefinder-chrome.zip`. Nicht das Firefox-ZIP, ein GitHub-Quellarchiv oder einen zusätzlichen umschließenden Ordner hochladen. `manifest.json` muss direkt im ZIP-Hauptverzeichnis liegen. Der Build prüft Manifestreferenzen und Chrome-PNG-Icons.

Vor dem Einreichen unter `chrome://extensions` den Entwicklermodus einschalten und `outputs/chrome-addon/` als entpackte Erweiterung laden. Suche, Wunschliste, Varianten, Abbruch, Tab-Wiederverwendung und Dateiimport prüfen. Automatisierte Tests ersetzen diesen Browserlauf nicht.

Bei einem Update die bestehende Erweiterung im Dashboard auswählen und ein Paket mit höherer Manifestversion einreichen. Für lokale Updates neu bauen und die vorhandene entpackte Erweiterung neu laden, statt sie zu entfernen.

## Angaben im Dashboard

1. Im [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) anmelden und den Artikel anlegen beziehungsweise öffnen.
2. Das Chrome-ZIP hochladen.
3. Store-Eintrag, Datenschutzangaben und Verteilung ausfüllen. Beschreibung und Screenshots müssen die aktuelle Erweiterung zeigen.
4. Als 128 × 128-PNG das [grüne Fahrrad](../teilefinder/src/assets/icon-128.png) verwenden. Weitere Store-Grafiken nach den aktuellen Dashboard-Vorgaben ergänzen.
5. Die öffentliche [Datenschutzerklärung](https://github.com/guenzd/firefox_bikeparts_finder/blob/feature/chrome-cross-browser/DATENSCHUTZ.md) verlinken. Sie enthält den Anbieter-Kontakt über www.dgd-racing-team.de.
6. Berechtigungen und Datennutzung entsprechend der tatsächlichen Funktion erklären; [Reviewer notes](REVIEWER-NOTES.md) enthalten technische Prüfanweisungen.
7. Sichtbarkeit und Veröffentlichung im Dashboard festlegen und die Prüfung anfordern. Erst nach erfolgreicher Store-Prüfung ist der gewählte Vertriebsweg verfügbar.

Offizielle Anleitungen: [Paket vorbereiten](https://developer.chrome.com/docs/webstore/prepare) und [Veröffentlichen](https://developer.chrome.com/docs/webstore/publish). Dashboard-Angaben können sich ändern; maßgeblich sind dessen aktuelle Anforderungen.

## Funktionsbezogene Berechtigungsbegründungen

| Zugriff | Zweck |
| --- | --- |
| Vier Shop-Domains / Content-Skripte | Vom Benutzer gestartete Suche, Produktdaten und Variantenauswahl auslesen |
| `storage` | Wunschliste, Ergebnisse, Produktlinks, ausgewählte Optionen und Einstellungen lokal speichern |
| `clipboardWrite` | Auf Klick EANs beziehungsweise Produktlisten und Links kopieren |
| `declarativeNetRequest` | Bilder nur in verwalteten Shop-Tabs optional blockieren, ohne Netzwerkprotokollierung |

Es gibt keinen eigenen Server, keine Werbung oder Telemetrie und keinen extern geladenen ausführbaren Code. Shop-Anfragen verwenden die normale Browsersitzung. Die Shopseiten können eigene Dienstleister einbinden; die Datenschutzerklärung beschreibt diese Abgrenzung.

## Falls der Upload scheitert

Prüfen, ob wirklich das aktuelle Chrome-Paket hochgeladen wurde, ob `manifest.json` im ZIP-Hauptverzeichnis liegt und ob die Versionsnummer bei Updates erhöht wurde. `npm run build:chrome` und `npm run lint:chrome` erneut ausführen. Ältere versionierte Chrome-ZIPs werden nach einem erfolgreichen Build automatisch entfernt. Bei einem weiter unklaren Dashboard-Fehler den genauen Fehlertext sichern; ein generischer Uploadfehler allein beweist keine bestimmte Ursache.

## Verteilung und Daten

Nach Freigabe wird die Erweiterung über ihren Store-Link installiert. Firefox benötigt stattdessen eine [Mozilla-signierte XPI](UNLISTED.md). Browserdaten bleiben getrennt; Wunschliste, Ergebnisse und Historie können als JSON übertragen werden. Kein Store-Upload enthält lokale Nutzerdaten oder Browserprofile.
