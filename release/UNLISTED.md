# Firefox: Unlisted signieren und selbst verteilen

Voraussetzung: Firefox Desktop 140+. Die Erweiterung verwendet Manifest V2 und die stabile ID `r2-teilefinder@local.invalid`. Sie benötigt keinen lokalen Server. Chrome wird separat über den [Chrome Web Store](CHROME-WEB-STORE.md) veröffentlicht.

## Paket vorbereiten

Im Repository-Hauptverzeichnis:

```sh
npm ci
npm run build:firefox
NO_UPDATE_NOTIFIER=1 npm run lint:extension
```

Das Einreichungspaket ist `outputs/teilefinder-firefox-<Version>.zip`; dieselben Inhalte stehen unter `outputs/teilefinder-firefox.zip`. Die Version kommt aus `teilefinder/manifests/firefox.json` und muss mit dem Chrome-Manifest übereinstimmen. Das ZIP enthält nur die Erweiterungsquellen und lokale Assets. Umbenennen in `.xpi` ersetzt keine Signierung.

## Bei Mozilla einreichen

1. Im [Mozilla Developer Hub](https://addons.mozilla.org/de/developers/) anmelden und eine Erweiterung beziehungsweise eine neue Version des bestehenden Eintrags einreichen.
2. Für Selbstverteilung **„On your own“** wählen. „On this site“ wäre die Verteilung über einen öffentlichen AMO-Eintrag.
3. Das Firefox-Versions-ZIP hochladen und die Validator-Meldungen beheben.
4. [Reviewer notes](REVIEWER-NOTES.md) und [Datenschutz](../DATENSCHUTZ.md) bereitstellen. Mozilla-Dateneinwilligung: `searchTerms` und `websiteActivity`, wie im Manifest deklariert. Die lokale Datenschutzseite ist in der Oberfläche verlinkt.
5. Das Paket enthält direkt lesbares JavaScript/HTML/CSS und lokale Assets, ohne Bundling, Transpilierung oder Minifizierung. Falls zusätzliche Quellen verlangt werden, den zum Tag passenden Quellstand samt Build-Anweisungen bereitstellen; keine Browserprofile oder lokalen Nutzerdaten.
6. Die Vertriebsvereinbarung selbst prüfen und akzeptieren. Nach der Freigabe die signierte XPI herunterladen.

Maßgeblich ist die [offizielle Mozilla-Einreichungsanleitung](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/). Ein erfolgreicher lokaler Build oder Git-Tag ist noch keine Mozilla-Freigabe.

Öffentlicher Datenschutz-Link für das Formular:

[Datenschutzerklärung auf GitHub](https://github.com/guenzd/firefox_bikeparts_finder/blob/feature/chrome-cross-browser/DATENSCHUTZ.md)

## Download und Updates

Die **signierte XPI** kann über eine eigene Website oder als GitHub-Release-Datei verteilt werden. Andere Benutzer benötigen dafür keinen Quellcode und keinen lokalen Build. Die Datei selbst muss nach der Signierung zum Download bereitgestellt werden; das hier erzeugte ZIP ist dafür kein Ersatz.

Vor dem Installieren die vorhandene Wunschliste als Datei sichern. In Firefox `about:addons` → Zahnrad → „Add-on aus Datei installieren“ wählen. Bei Updates die neue signierte XPI über die bestehende Erweiterung installieren, nicht vorher deinstallieren. Bei einem Wechsel von temporärer Installation bei Bedarf die Sicherung importieren.

Weitere Releases im bestehenden Mozilla-Eintrag mit höherer Versionsnummer signieren lassen. Automatische Updates über ein eigenes HTTPS-Update-Manifest sind derzeit nicht eingerichtet; dafür wären eine passende `update_url` und signierte Downloads erforderlich. Ein unlisted Mozilla-Paket und die Sichtbarkeit eines Chrome-Store-Eintrags sind unterschiedliche Vertriebswege.

## Release im Repository

Beide Browserziele bauen und prüfen, vollständige Quellen und Dokumentation committen, annotierten Tag `v<Version>` erstellen und Commit plus Tag pushen. Signierte Pakete bleiben außerhalb von Git und können anschließend als Release-Anhang veröffentlicht werden. Details: [AGENTS.md](../AGENTS.md).
