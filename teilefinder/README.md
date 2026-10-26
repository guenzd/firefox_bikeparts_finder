# Teilefinder – Quellordner

Die aktuelle Anwendung ist eine eigenständige Erweiterung für Firefox und Chrome. Einstieg, Installation und Build-Anleitung stehen im [zentralen README](../README.md); die Bedienung im [Handbuch](../MANUAL.md).

## Aktuelle Erweiterung

- `src/ui/`: gemeinsame Oberfläche und Dialoge.
- `src/core/`: Suche, Produkt-/Varianten-/EAN-Abgleich, Wunschliste und Preise.
- `src/shops/`: Auslesen der vier Shops und Wiederherstellen ihrer Optionen.
- `src/data/`: IndexedDB für den Preisverlauf.
- `src/platform/`: native Browser-APIs, Nachrichten und Tab-Verwaltung.
- `src/assets/`: lokale Icons und Schrift, siehe [Assets](src/assets/README.md).
- `manifests/`: Firefox-MV2- und Chrome-MV3-Manifest mit gleicher Version.
- `*.test.mjs`: automatisierte Regressionstests; `test-sources.mjs` löst gemeinsame Testquellen auf.

Build und Tests **eine Ebene darüber**, im Repository-Hauptverzeichnis, ausführen:

```sh
cd ..
npm test
npm run build
```

Die Ausgabe liegt in `../outputs/`. Es gibt keinen notwendigen lokalen Web- oder Datenbankserver.

## Historischer Website-Prototyp

`app/`, `components/`, `lib/`, die Website-Konfiguration und das hiesige `package.json` stammen vom ursprünglichen Sites-/vinext-Prototyp. Dessen `npm run dev` und `npm run build` betreffen die Website und nicht das Browser-Add-on. Die Website-Abhängigkeiten sind für den Erweiterungsbau nicht erforderlich und werden nicht mit ausgeliefert.

`local-browser/` und `scripts/start-local.mjs` gehören zum früheren lokalen Chromium-Ansatz; siehe [LOKAL.md](LOKAL.md). Seine Parsertests werden weiterhin vom zentralen Testlauf berücksichtigt. Der Prototyp ist kein zweiter notwendiger Bestandteil der Erweiterung.
