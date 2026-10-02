# Mozilla-Signierung: Unlisted

## Fertiges Paket

`npm run build` und `npm run lint:extension` ausführen. `outputs/teilefinder-firefox-0.6.1.zip` ist das unsigned Einreichungspaket. Es enthält nur Dateien der Erweiterung, nicht die frühere Website oder Browserprofile. Ein ZIP umzubenennen signiert es nicht.

Version 0.6.1 setzt Firefox Desktop 140 voraus und verwendet Firefox' eingebaute Dateneinwilligung (`searchTerms`, `websiteActivity`). Die lokale Datenschutzseite ist über die Oberfläche erreichbar. Es gibt keine eigene Serververarbeitung, Telemetrie oder Werbung. Lizenz: alle Rechte vorbehalten, solange der Rechteinhaber keine andere Lizenz festlegt.

## Einreichen

1. Unter https://addons.mozilla.org/de/developers/ mit dem eigenen Mozilla-Konto anmelden.
2. Eine neue Erweiterung einreichen. Als Verteilung **„On your own“ / Selbst verteilen** wählen, nicht öffentlich im Store listen.
3. Das Versions-ZIP hochladen und die Validator-Ergebnisse prüfen.
4. Datenschutzangaben aus `teilefinder/firefox-r2/privacy.html` und Prüfanweisungen aus `release/REVIEWER-NOTES.md` bereitstellen. Falls eine externe Datenschutz-URL verlangt wird, ist dafür noch eine öffentlich erreichbare Seite erforderlich.
5. Das Paket enthält direkt lesbares, unverändertes JavaScript/HTML/CSS/SVG. Kein Bundling, Transpiling oder Minifizieren. Falls Mozilla zusätzlich Quellen anfordert, den Erweiterungsordner und Build-Anweisungen bereitstellen; keine Profile, Zugangsdaten oder Testdaten hochladen.
6. Die Vertriebsvereinbarung persönlich lesen und akzeptieren. Die signierte XPI nach erfolgreicher Prüfung herunterladen.

Die tatsächliche Freigabe und mögliche Rückfragen entscheidet Mozilla. Es wurde noch nichts eingereicht oder signiert.

## Installieren und aktualisieren

Zuerst die Wunschliste als Datei sichern. Die signierte `.xpi` über `about:addons` → Zahnrad → „Add-on aus Datei installieren“ installieren. Die Add-on-ID bleibt `r2-teilefinder@local.invalid`. Nach einem Wechsel von der temporären Installation die Sicherung bei Bedarf importieren.

Für weitere Releases die Versionsnummer erhöhen, bauen, prüfen und im bestehenden Mozilla-Eintrag als neue unlisted Version signieren lassen. Die neue signierte XPI über die vorhandene Erweiterung installieren; nicht deinstallieren. Automatische Updates sind hier noch nicht eingerichtet. Dafür wäre später ein HTTPS-Update-Manifest mit stabiler `update_url` und signierten Downloads nötig.
