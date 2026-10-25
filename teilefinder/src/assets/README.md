# Erweiterungs-Icons

`icon.svg` ist die gemeinsame Vektorquelle. Firefox verwendet sie direkt; Chrome verwendet die daraus gerenderten PNGs mit 16, 32, 48 und 128 Pixeln. Die PNGs wurden mit `@resvg/resvg-js` erzeugt und sind eingecheckt; beim normalen Build wird kein Renderer installiert und nichts heruntergeladen. Alle Fonts sind ebenfalls lokal enthalten.
