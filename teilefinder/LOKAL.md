# Teilefinder lokal

Start: `node --experimental-strip-types scripts/start-local.mjs` oder die bereitgestellte Teilefinder-starten.command per Doppelklick öffnen.

Das Terminal bleibt offen. Beenden: Strg+C. Adresse: http://127.0.0.1:5173/

Vier Browseradapter: BIKE24, Bike-Discount, bike-components, r2-bike. Anfragen laufen jeweils in zwei Shop-Tabs gleichzeitig. Keine Google-API, kein Cloud-Dienst. Eigenes dauerhaftes Chromium-Profil im work-Ordner ohne Zugriff auf persönliche Browserprofile. Anmeldesitzungen bleiben auf diesem Mac gespeichert. Preise und Lagerangaben werden bei jeder Suche neu abgefragt. Ab-Preise und ungeklärte Varianten werden gekennzeichnet. Sicherheitsprüfungen der Shops werden nicht automatisch gelöst. Bei geänderten Shop-Seiten kann ein Adapter angepasst werden müssen.

Voraussetzungen: Node.js 22+, installierte Abhängigkeiten und Chromium oder Chrome. Auf diesem Mac ist Chromium bereits vorhanden. Fehlende npm-Abhängigkeiten werden beim Start installiert. Der Start verwendet den installierten Browser; nur wenn keiner gefunden wurde, wird Playwright-Chromium installiert.

Der Suchbrowser ist nun standardmäßig sichtbar. Optional wieder headless starten: `TEILEFINDER_SHOW_BROWSER=0 node --experimental-strip-types scripts/start-local.mjs`. Einen anderen Chromium-Browser über TEILEFINDER_BROWSER mit absolutem Executable-Pfad wählen.

Prüfung: Syntax, TypeScript und Produktionsbuild erfolgreich. Parserprüfungen decken Preisformate, fehlende/negative Lagerangaben, Ab-Preise und fremde Produktlinks ab. Die Shops und die Bike-Discount-Variante 116 Glieder wurden im normalen Browser geprüft. Der automatische Vier-Shop-Durchlauf konnte in der Codex-Sandbox noch nicht geprüft werden: Chromium wird dort beim Start beendet. Er muss nach Start außerhalb dieser Sandbox geprüft werden. Browser-WebMCP wurde noch nicht geprüft.

Die Browserabfrage ist lokal im Vite-Server integriert. Ein Cloud-Build allein enthält keinen lokalen Browserdienst. Diese Version wird nicht veröffentlicht.

## BIKE24-Anmeldung
Teilefinder im Terminal mit Strg+C stoppen. Shop-Anmelden.command öffnen, im separaten Browser selbst anmelden und eventuelle Sicherheitsprüfungen selbst durchführen. Danach dessen Browserfenster schließen und Teilefinder-starten.command erneut öffnen. Login und Suche verwenden dasselbe lokale Profil. Login ist keine Garantie gegen erneute Shop-Sicherheitsprüfungen. Die Anmeldesitzung wird nicht exportiert oder in den Quellcode-ZIP aufgenommen.
