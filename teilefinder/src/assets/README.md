# Lokale Assets

`icon.svg` ist die Vektorquelle des grünen Fahrrads. Firefox verwendet SVG; Chrome verwendet daraus gerenderte, eingecheckte PNG-Dateien:

| Datei | Größe / Verwendung |
| --- | --- |
| [icon-16.png](icon-16.png) | 16 × 16 Pixel |
| [icon-32.png](icon-32.png) | 32 × 32 Pixel |
| [icon-48.png](icon-48.png) | 48 × 48 Pixel |
| [icon-128.png](icon-128.png) | 128 × 128 Pixel, auch als Chrome-Store-Symbol verwendbar |

Die PNGs wurden mit `@resvg/resvg-js` erzeugt. Beim normalen Erweiterungsbuild wird kein Renderer installiert und nichts heruntergeladen. Manifestreferenzen, PNG-Größen und Dateien werden geprüft.

Inter wird lokal aus `fonts/InterVariable.woff2` geladen. Herkunft und Downloadstand: [fonts/README.txt](fonts/README.txt); Lizenz: [SIL Open Font License 1.1](fonts/Inter-LICENSE.txt). Die Schrift wird unverändert mitgeliefert, ohne externen Fontdienst.
