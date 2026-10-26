# Historischer lokaler Browser-Prototyp

Dieser Ansatz stammt aus der Zeit vor der eigenständigen Erweiterung. Für den heutigen Teilefinder wird er **nicht benötigt**. Verwende die [Installationsanleitung](../MANUAL.md) für Firefox oder Chrome.

## Aufbau und Start für Entwicklungszwecke

Der Prototyp verbindet die lokale Website mit einem separaten Chromium-/Playwright-Browser. Er verwendet ein eigenes Profil unter `work/`, nicht das persönliche Browserprofil. Das ist ein anderer Ablauf als die vier wiederverwendeten Shop-Tabs der aktuellen Erweiterung.

Aus diesem Ordner:

```sh
node --experimental-strip-types scripts/start-local.mjs
```

Das Startskript benötigt Node.js 22+, installiert bei Bedarf die Website-/Playwright-Abhängigkeiten und sucht einen Chromium-kompatiblen Browser. Falls keiner gefunden wird, versucht es, Playwright-Chromium zu installieren. Die Website wird unter `http://127.0.0.1:5173/` geöffnet. Das Terminal bleibt offen; Strg+C beendet den Prozess.

Optional: `TEILEFINDER_BROWSER` mit dem absoluten Browserpfad setzen; `TEILEFINDER_SHOW_BROWSER=0` fordert den früheren Headless-Modus an. Mit `node --experimental-strip-types scripts/start-local.mjs --login` lässt sich der separate Anmeldeablauf starten. Anmelden und Sicherheitsprüfungen erfolgen durch den Benutzer im Browser.

## Abgrenzung

Der Prototyp ist nicht Bestandteil der Firefox-/Chrome-Pakete und wird durch deren Build nicht als lauffähiger Dienst bereitgestellt. Ein Website-Cloud-Build enthält keinen lokalen Browserdienst. Die alten Startabläufe wurden bei der aktuellen Erweiterungsabnahme nicht erneut live geprüft. Profile, Sitzungen und lokale Daten gehören nicht in Git oder Store-Pakete.
