# Frühere Prototypen

Der Teilefinder begann als Sites-/vinext-Website. Ein späterer lokaler Ansatz verband diese Website mit einem separaten Chromium-/Playwright-Browser und einem eigenen Profil; die Website lief unter `http://127.0.0.1:5173/`.

Die heutige Erweiterung für Firefox und Chrome ersetzt beide Ansätze vollständig. Der aktuelle Quellbaum enthält deshalb keine Website-Konfiguration, UI-Bibliothekskopien, Server-/Datenbankbeispiele, lokale Browserprogramme oder zweite Paketinstallation mehr. Build und Tests werden ausschließlich im Repository-Hauptverzeichnis ausgeführt.

Der letzte vollständige Prototypstand ist über [Git-Tag v0.8.48](https://github.com/guenzd/firefox_bikeparts_finder/tree/v0.8.48/teilefinder) abrufbar. Die damalige Dokumentation und Startskripte gelten nur für diesen historischen Stand. Die früheren drei Parsertests wurden durch Tests der heute ausgelieferten gemeinsamen Parser ersetzt; der obsolete Parser wird nicht weiter mitgeführt.

Die ursprünglichen Lizenztexte des entfernten Website-Builds und der UI-Bibliothek bleiben unverändert unter [licenses/legacy](licenses/legacy/) erhalten. Die aktuellen Fahrrad-Icons, Inter-Schrift und zugehörigen Lizenz-/Herkunftsangaben liegen weiterhin unter [teilefinder/src/assets](../teilefinder/src/assets/README.md).

Lokale Profile, Sitzungen, Zugangsdaten, Wunschlistenexporte und laufend verwendete Test-Add-ons gehören nicht zur Quellcodebereinigung. Entwicklungsscreenshots sind keine Erweiterungs-Assets.
