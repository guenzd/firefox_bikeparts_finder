# Suchlauf-Profiling

## Aktuellen Suchlauf aufzeichnen

1. Die aktualisierte Erweiterung laden und die Teilefinder-Seite neu öffnen.
2. Einen Artikel über ↻ aktualisieren oder eine Einzelteilsuche ausführen. Für einen Vergleich Produktname, EAN-Schalter, Variante, Preisbereich und „Bilder laden“ unverändert lassen.
3. Nach Abschluss in der Entwicklerkonsole **der Teilefinder-Seite** ausführen:

```js
JSON.stringify(getSearchProfiles(), null, 2)
```

4. Die vollständige Ausgabe bei Bedarf in `tmp.log` im Repository-Hauptverzeichnis ablegen. Die Datei ist ignoriert und wird nicht gepusht. Das Add-on schreibt sie nicht automatisch.

Die letzten 20 abgeschlossenen oder abgebrochenen Jobs liegen nur im Arbeitsspeicher. Ein Neuladen leert sie; `[]` während des ersten laufenden Jobs ist ebenfalls möglich. Profile enthalten Namen, EAN und Varianten und sollten vor einer Weitergabe geprüft werden. Einzelmessungen und komplette Listenläufe nicht ohne gleiche Bedingungen vergleichen.

Hohe `detail`-Zeiten können DOM-, Datenblatt- und Variantenwartezeiten enthalten. `navigation` misst nur den API-Aufruf, nicht den vollständigen Netzwerkabruf. Shops laufen parallel; ihre Zeiten dürfen nicht zur Gesamtlaufzeit addiert werden. Ein weiter rotierendes Browser-Ladesymbol misst nicht den Abschluss der Produktauslesung. `pageMismatch` und `readIssues` sind Diagnosehinweise, kein alleiniger Beweis einer bestimmten Ursache.

Bekannte Wunschlisten-URLs und gespeicherte Optionen sollten direkt unter `detail` geprüft werden, ohne vorheriges Listing. Shops ohne geeigneten gespeicherten Link benötigen weiterhin die Suche. Ältere oder nicht bestätigte Angebote sind kein Beleg für erfolgreiche frische Auslesungen.

`npm run profile:search` führt dagegen einen **simulierten** Controller-Benchmark aus, keinen echten Shop- oder Netzwerkvergleich. Die folgenden Abschnitte bewahren die historischen Messungen und Änderungen. Frühe Testzahlen und technische Zwischenstände gelten jeweils für die dort genannte Version.

## Historischer Ausgangsversuch 0.8.3: Messung und Grenzen

Die native Browsersteuerung lieferte am 25.10.2026 erneut `Sky Computer Use native pipe startup failed`, ohne erreichbare Browser. Deshalb enthält dieser erste Versuch **keine Messung realer Shop- oder Netzwerkzeiten**. Spätere Abschnitte werten vom Nutzer bereitgestellte echte Laufzeitprofile aus. Gemessen wurde der echte Suchcontroller mit deterministischer virtueller Uhr und simulierten Shopantworten. Matching, Cache-Auswahl, Wartezeiten, Wiederverwendung und Ergebnisabschluss laufen durch den produktiven Code.

`npm run profile:search` erzeugt einen JSON-Bericht. Die Szenarien liefern vier gültige Angebote; ein fehlendes Ergebnis lässt den Lauf fehlschlagen. Erfasst werden Controller-Laufzeit, Navigationen, Listing-/Detail-Auslesungen, erstellte Tabs und gleichzeitige Auslesungen pro Tab.

## Vorher / nachher

Ausgangsstand: Commit `0fdab45` (0.8.2). Zeiten sind simulierte Controller-Laufzeiten, keine prognostizierten Shop-Ladezeiten.

| Szenario | Vorher | Nachher | Tabs | Navigationen vorher / nachher |
| --- | ---: | ---: | ---: | ---: |
| Listing sofort verfügbar | 4.000 ms | 2.500 ms | 4 | 4 / 4 |
| Listing nach 2.500 ms verfügbar | 6.000 ms | 4.500 ms | 4 | 4 / 4 |
| Gespeicherte Produktseite sofort verfügbar | 750 ms | 750 ms | 4 | 4 / 4 |
| Drei Prüfungen gespeicherter Seiten | 2.250 ms | 2.250 ms | 4 insgesamt | 12 / 12 |
| Gespeicherte Seite: Laden 1.500 ms, Auslesen 600 ms | 2.700 ms | 2.700 ms | 4 | 4 / 4 |

In allen Szenarien bleibt höchstens eine Auslesung pro Tab gleichzeitig aktiv. Die Listing-Auslesezahl bleibt in den ersten beiden Fällen bei 8 bzw. 12 insgesamt. Es gibt keine zusätzlichen Shopseitenaufrufe.

Die Ausgangsmessung lässt sich reproduzieren:

```sh
git show 0fdab45:teilefinder/src/core/search-controller.js > /tmp/teilefinder-controller-before.js
node scripts/profile-search.mjs --controller /tmp/teilefinder-controller-before.js
npm run profile:search
```

## Befunde und Änderungen

1. Der Controller wartete vor jedem Listing-Auslesen zwei Sekunden. Selbst fertige Treffer benötigten dadurch mindestens vier Sekunden für zwei identische Auslesungen. Die erste Ladepause bleibt bei zwei Sekunden; nur die Stabilitätsprüfung bereits vorhandener Treffer oder Vorschläge erfolgt nach 500 ms. Das spart im sofort verfügbaren Listing-Szenario 37,5 %. Leere Seiten und Sicherheitsprüfungen behalten den langsameren Takt.
2. Ein Nachrichten-Timeout beendet die asynchrone Auslesung im Shop nicht. Dropdowns können deutlich länger dauern: bis zu 24 Kombinationen, jeweils Auswahlpause und Stabilitätsprüfung, bei mehreren Dropdowns zusätzliche Zwischenstufen. Ein Retry konnte daher erneut gleichzeitig Optionen auswählen. Eine Queue pro Shopdokument serialisiert verschiedene Auslesungen und teilt identische laufende Requests mit Wiederholungsversuchen. Abgeschlossene Ergebnisse werden nicht zwischengespeichert; erneute Prüfungen lesen frische Daten. Fehler geben die Queue wieder frei.
3. BIKE24-Verweise auf weitere Ausführungen verwendeten bisher eine unbegrenzte einzelne Nachrichtenwartezeit. Diese Auslesungen verwenden jetzt ebenfalls den begrenzten Nachrichtenpfad und prüfen nach der Wartepause erneut, ob der Suchjob noch aktiv ist.
4. Bekannte Produktseiten umgehen die Suche bereits. Ihre Lade- und Variantenwartezeiten wurden nicht pauschal verkürzt: ohne Live-Messung wäre die Gefahr zu groß, veraltete Preise oder Lagerstände zu übernehmen.

## Messungen im laufenden Add-on

Der Suchcontroller hält für die letzten 20 abgeschlossenen/abgebrochenen Suchjobs lokale Timing-Zusammenfassungen im Arbeitsspeicher. Keine Speicherung auf Disk und keine Übertragung. Nach einem Suchlauf in der Entwicklerkonsole der Teilefinder-Seite:

```js
getSearchProfiles()
```

Die Einträge enthalten Gesamtzeit und je Shop Aufrufzahl sowie aufsummierte Dauer für:

- `navigation`: Dauer der Tab-API-Aufrufe; **nicht** die vollständige Netzwerk-Ladezeit.
- `wait`: explizite Controller-Wartepausen.
- `listing`: Antwortzeiten für das Listing-Auslesen.
- `detail`: Antwortzeiten für Produktdetails, einschließlich Dropdown- und Datenblattwartezeiten.
- `cache.read`: Laden bekannter Produktlinks, einschließlich Warten auf ausstehende Cache-Schreibvorgänge.

Die Phasen messen verstrichene Zeit, keine reine CPU-Zeit. Shops laufen parallel, deshalb die Summen verschiedener Shops nicht als Gesamtzeit addieren. Die Übersicht enthält ab 0.8.9 auch den eingegebenen Produktnamen (`productName`), die hinterlegte EAN (`ean`), die Variante (`variant`) und die EAN-Einstellung (`useEAN`). Produktlinks werden nicht aufgenommen. Ein Neuladen leert sie.

## Weitere mögliche Engpässe

Wunschlistenartikel werden weiterhin nacheinander geprüft; die vier Shops eines Artikels laufen parallel. Ein langsamer Shop kann deshalb den nächsten Artikel verzögern. Eine Umstellung auf unabhängige Warteschlangen pro Shop würde mehr Ablaufänderungen erfordern, insbesondere bei nachträglich entdeckten EANs, Abbruch und Zwischenergebnissen. Sie ist hier nicht enthalten.

Für weitere gezielte Optimierung sind reale Timing-Zusammenfassungen entscheidend: hohe `detail`-Zeiten sprechen für Varianten/Datenblatt-Auslesung; hohe `wait`-Zeiten bei wenig Detailarbeit für Readiness-Erkennung. Die Rendering-Kosten der echten Browser-DOMs wurden mangels Browserzugriff nicht gemessen.

## Verifikation

Regressionen prüfen identische Treffer, schnellere stabile Listings, verzögertes Laden, direkte Produktseiten, Wiederverwendung von exakt vier Tabs über mehrere Suchen, unveränderte Sicherheitsprüfungs-Intervalle, begrenzte Profilhistorie sowie Queue-Deduplizierung, Serialisierung und Fehlerbehandlung.

Stand 0.8.3: 166 Tests bestanden; Firefox-Lint ohne Fehler/Warnungen; Chrome-Manifest-/Asset-Prüfung bestanden. Beide Pakete werden im Test auf reproduzierbare Inhalte geprüft. Eine echte Browser-/Shop-Abnahme steht weiter aus.

## Auswertung echter Nutzer-Messwerte / 0.8.4

Zwölf übermittelte Suchprofile: insgesamt 267,744 Sekunden (4:28 Minuten), Median 20,202 Sekunden, langsamster Lauf 60,129 Sekunden. Die folgenden Werte sind jeweils über alle zwölf Läufe **innerhalb eines Shops** aufsummiert; die Shops laufen parallel, daher die Shopzeiten nicht zur Gesamtlaufzeit addieren.

| Shop | Explizite Wartepausen | Detail-Antwortzeit | Detail-Aufrufe |
| --- | ---: | ---: | ---: |
| BIKE24 | 53,622 s | 42,756 s | 56 |
| Bike-Discount | 68,511 s | 82,964 s | 47 |
| bike-components | 110,147 s | 0,689 s | 57 |
| r2-bike | 175,269 s | 0,835 s | 105 |

Cache-Lesezeit insgesamt: 69 ms. Der 60-Sekunden-Lauf fällt mit 48,739 Sekunden Bike-Discount-Detail-Antwortzeit auf. Die Daten allein unterscheiden noch nicht, ob eine schnelle erfolglose Antwort durch Sicherheitsprüfung, noch nicht fertige Seite, umgeleitete URL oder fehlende Elemente verursacht wird. Hintergrund-Timer und asynchrone Leser können zusätzlich die expliziten Wartezeiten verlängern; das ist aus den Summen nicht eindeutig zuzuordnen.

Konkrete Korrekturen nach Codeprüfung:

- Eine in diesem Shoplauf bereits direkt geprüfte gespeicherte Produkt-URL wird nicht erneut als letzter EAN-Fallback geöffnet. Die normale Shopsuche und das Prüfen ihrer aktuellen Treffer bleiben erhalten. Neue Suchläufe prüfen die gespeicherten URLs wieder frisch.
- bike-components verlangt für feste Produkte ohne Variantenauswahl kein Dropdown mehr. Die aktuelle Preisangabe `auto-product-price` wird auch beim direkten Aktualisieren berücksichtigt. Fehlende frische Preise werden weiterhin nicht durch gespeicherte Preise ersetzt.
- Profiling zählt unter `outcomes` zusätzlich `ready`, `notReady`, `blocked`, `noResponse`, `errors` und bei Detailantworten `pageMismatch`. `pageMismatch` kann etwa eine kanonische Weiterleitung bedeuten, nicht automatisch einen Fehler. Alle Werte sind Anzahlen, keine Zeiten.
- Fertige Profile sind unveränderliche Momentaufnahmen. Nach einem Job-Timeout noch auslaufende Operationen verändern ihre Summen nicht nachträglich. Beim Abschluss noch nicht beendete Operationen können deshalb in den abgeschlossenen Phasenmessungen fehlen.

Die Regressionstests prüfen das Vermeiden doppelter Fallbacks, den aktuellen Preis/Lagerstatus fester bike-components-Produkte, das Ablehnen veralteter Preise, die Rückgabe-Klassifikation und unveränderliche Profil-Snapshots. Für diese Korrekturen wird keine neue Gesamtbeschleunigung aus den alten Messwerten behauptet; dafür ist ein erneuter realer Lauf erforderlich.

## Zweiter realer Lauf / 0.8.5

Die nächsten zwölf Profile dauern zusammen 299,378 Sekunden (4:59 Minuten), Median 21,350 Sekunden. Das sind 31,634 Sekunden mehr als im ersten Lauf; unterschiedliche Ladebedingungen sind in diesem Vergleich nicht kontrolliert. Eine reale Beschleunigung durch 0.8.4 ist damit nicht nachgewiesen.

Die neue Rückgabe-Klassifikation zeigt 218 Fehler, 77 bereite Antworten und 97 noch nicht bereite Antworten. Hinzu kommen 19 abweichende Seitenadressen, die als zusätzliches Merkmal gezählt werden. `blocked` wurde nicht gemeldet; daraus lässt sich bei fehlerhaften Auslesungen jedoch nicht sicher schließen, dass keine Sicherheitsseite beteiligt war.

| Shop | Fehler | Bereit | Nicht bereit |
| --- | ---: | ---: | ---: |
| BIKE24 | 33 | 15 | 15 |
| Bike-Discount | 37 | 11 | 9 |
| bike-components | 46 | 21 | 16 |
| r2-bike | 102 | 30 | 57 |

0.8.5 verkürzt keine weiteren Wartezeiten. Stattdessen wird der bisher grobe Fehlerzähler eingegrenzt:

- `errorKinds.noReceiver`: Auslese-Skript beim Senden noch nicht erreichbar.
- `errorKinds.disconnected`: unterbrochener Nachrichtenkanal.
- `errorKinds.timeout`: Nachricht nicht rechtzeitig beantwortet.
- `errorKinds.readerError`: vom Auslese-Skript zurückgemeldete Ausnahme.
- `errorKinds.other`: übrige Fehler.

Bei Skript-Ausnahmen enthält `readerErrors` zusätzlich den Standard-Fehlertyp, die relative Quelldatei samt Zeile/Spalte und, falls passend, eine eng begrenzte technische Fehlersignatur. Das funktioniert sowohl für synchrone als auch für asynchrone Fehler über den Browser-Adapter. Rohe Stacktraces und allgemeine Fehlermeldungen werden nicht in die Profile übernommen. Die Zahl unterschiedlicher Fehlersignaturen bleibt pro Shop und Suchjob auf acht begrenzt.

Für die nächste Eingrenzung genügt ein einzelner langsamer Artikel; die ganze Wunschliste muss dafür nicht erneut geprüft werden. Derselbe Konsolenaufruf liefert die erweiterten Informationen.


## Versuch: Bilder nicht laden / 0.8.6

In Firefox und Chrome wird vor dem ersten Shop-Aufruf eine Sitzungsregel für Bildanfragen installiert. Sie gilt nur für registrierte Shop-Tab-IDs und die vier Shop-Domains als Initiatoren. So werden auch Bilddateien von CDNs erfasst, ohne normale Shop-Tabs zu beeinflussen. Nur `image` wird blockiert; Skripte, CSS, Fonts, HTML und Produktdatenabfragen werden nicht blockiert. `challenges.cloudflare.com` ist als Request-Domain ausgenommen. Inline-Grafiken und bereits im HTML eingebettete Datenbilder benötigen keine separaten Netzwerkanfragen und werden durch diese Regel nicht entfernt.

Neue Shop-Tabs werden zunächst als leere Kinder des Teilefinder-Tabs angelegt, vor der Navigation registriert und mit der Bildregel versehen. Für leere Tabs kann das URL-Feld mangels allgemeiner `tabs`-Berechtigung fehlen; die Zuordnung wird dann über den expliziten `openerTabId` und ein validiertes Shop-Ziel geprüft. Es wird keine zusätzliche allgemeine `tabs`-Berechtigung verlangt.

„Bilder laden“ hebt die Sperre auf; die Auswahl bleibt lokal gespeichert. Bereits fehlgeschlagene Bildanfragen werden dadurch nicht automatisch neu gestartet: Shopseite neu laden oder nächste Suche abwarten. Beim Schließen verwalteter Tabs werden die Regeln bereinigt; Neustarts des Hintergrund-Workers stellen sie aus dem Sitzungsspeicher wieder her. Die zusätzliche `declarativeNetRequest`-Berechtigung kann beim Browser-Update einen Berechtigungsdialog auslösen.

Diese Änderung ist ein Ladeversuch, kein belegter Fix für die im letzten Profil beobachteten 218 Fehler. Eine echte Vorher-/Nachher-Messung mit aktuellen Profilen bleibt erforderlich. Live-Browsersteuerung ist weiterhin nicht verfügbar. Automatische Tests prüfen beide API-Modi, Registrierung vor der ersten Navigation, manuelle Tabs, Regelbereinigung, Worker-Neustart, Einstellungswechsel und Fehlerbehandlung.

Referenzen: [Mozilla DNR-Berechtigungen](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/declarativeNetRequest#permissions), [Tab-bezogene Sitzungsregeln](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/declarativeNetRequest/RuleCondition), [Tab-URL-Berechtigungen](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs).


## Vollständiger Lauf aus `tmp.log` / 0.8.7

Lokale Profiling-Ausgaben werden künftig aus `tmp.log` im Repository-Verzeichnis gelesen. Diese Datei ist in `.gitignore` eingetragen und wird nicht veröffentlicht.

Der vorliegende Lauf enthält zwölf Profile mit insgesamt 294,061 Sekunden (4:54 Minuten), Median 20,806 Sekunden. Alle 187 klassifizierten Fehler sind `noReceiver`; kein `readerError` wurde gemeldet. Das grenzt den Fehler ein: Der Nachrichtenempfänger ist bei diesen Versuchen noch nicht installiert/erreichbar, statt dass die eigentliche Auslesefunktion eine Ausnahme zurückmeldet. Der sechste Lauf bleibt mit 60,057 Sekunden der langsamste; Bike-Discount benötigt dort über 44 Sekunden für abgeschlossene Detailantworten.

Die bisherigen Content-Skripte wurden erst bei `document_idle` angemeldet. In 0.8.7 werden sie bei `document_start` angemeldet. Eingehende Ausleseanfragen warten innerhalb der vorhandenen serialisierten Queue auf `DOMContentLoaded`, bevor DOM-Felder gelesen oder Optionen ausgewählt werden. Identische Wiederholungen teilen weiterhin dieselbe ausstehende Anfrage. Ein schon interaktives oder vollständig geladenes Dokument benötigt diese zusätzliche DOM-Wartephase nicht. Es kommen keine weiteren Tabs oder Shop-Seitenaufrufe hinzu.

Die Änderung adressiert die verspätete Anmeldung des Empfängers. Sie beseitigt weder die HTML-Ladezeit vor dem Start eines Dokuments noch lange Variantenprüfungen oder kanonische Weiterleitungen. Die tatsächliche Beschleunigung benötigt einen erneuten Live-Lauf. Tests prüfen die früh erreichbare Anmeldung, Aufschub bis `DOMContentLoaded`, Deduplizierung während des Wartens und frische Daten bei späteren Aufrufen.

Zur Bildsperre: Die vom Nutzer gelesene Sitzungsregel 840001 war für genau vier Tab-IDs installiert. Firefox-Version 157 enthält die in [Bug 1949623](https://bugzilla.mozilla.org/show_bug.cgi?id=1949623) ab Firefox 149 markierte Korrektur des In-Memory-Cache-Problems. Deshalb wird dieser alte Cache-Fehler nicht als belegte Ursache der weiterhin sichtbaren Produktfotos herangezogen. Eine konkrete Bildadresse bzw. der zugehörige Request ist zur weiteren Eingrenzung erforderlich; bloßes Ausblenden wäre kein Nachweis eingesparter Bilddownloads.


## Bildquellen-Richtlinie / 0.8.8

Die gemeldeten Resource-Timing-Einträge für ein sichtbares Produktfoto stammen von normalen `img`-Anfragen an den BIKE24-CDN. Ein vorgeschalteter `fetch` wurde für diese Einträge nicht festgestellt. `transferSize: 0` beweist bei dieser fremden Origin keinen Cache-Treffer: Ohne `Timing-Allow-Origin` werden diese Angaben ebenfalls auf null gesetzt ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/transferSize)). Der Grund, warum die vorhandene Bildregel diese sichtbaren Fotos nicht verhindert hat, ist weiterhin nicht abschließend belegt.

Zur bisherigen Bildanfragen-Regel kommt deshalb eine unabhängige Bildquellen-Absicherung: Sitzungsregel 840002 hängt an HTML-Hauptdokument-Antworten der vier Shop-Domains in den registrierten Tabs einen zusätzlichen `Content-Security-Policy`-Header mit ausschließlich `img-src` an. Dieser Mechanismus hängt nicht vom Initiator einzelner Bildanfragen ab. Die Shop-Richtlinien werden nicht ersetzt oder gelockert. Die ergänzte Richtlinie setzt keine Vorgaben für Skripte, CSS, Verbindungen oder Unterframes. Bildquellen sind ausschließlich `https://challenges.cloudflare.com` und dessen HTTPS-Subdomains; normale Produkt-, CDN-, Daten- und Blob-Bilder werden nicht freigegeben. Inline-SVG-Markup ist keine separate Bildquelle und wird dadurch nicht entfernt.

Das sind Browser-Ladebeschränkungen, kein nachträgliches Verstecken per CSS. Eine zusätzlich angehängte Richtlinie kann bestehende Richtlinien nur weiter einschränken ([CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy), [img-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/img-src)). Ein echter Browser-Test bleibt erforderlich; die Geschwindigkeit wird daraus nicht abgeleitet.

„Bilder laden“ entfernt beide Sitzungsregeln. Ein bereits geladenes Dokument behält seine empfangene Richtlinie bis zum nächsten Neuladen bzw. einer neuen Navigation. Daher nach dem Update und auch beim Wiederfreigeben von Bildern die Shopseiten neu laden bzw. die nächste Suche abwarten. Normale Shop-Tabs bleiben über die Tab-ID-Begrenzung ausgeschlossen; die Headerregel hat zusätzlich eine Begrenzung auf die vier Shop-Domains und `main_frame`. Es kommen keine neuen Berechtigungen hinzu.

Tests für Firefox und Chrome prüfen Installation beider Regeln vor dem ersten Shop-Aufruf, Erhalt vorhandener Shop-CSP durch `append`, die reine `img-src`-Vorgabe, Beschränkung auf registrierte Tab-IDs/Hauptdokumente/Shop-Domains sowie Entfernen beider Regeln beim Opt-out und Schließen.


## Artikelzuordnung / 0.8.9

Jeder Profil-Eintrag enthält den ursprünglichen Produktnamen, die eingegebene EAN, Variante und EAN-Einstellung. Der Produktname bleibt auch dann erhalten, wenn intern mit EAN oder einem vereinfachten Suchbegriff gesucht wird. Eine hinterlegte, aber deaktivierte EAN bleibt mit `useEAN: false` nachvollziehbar. Die Angaben bleiben zusammen mit den letzten 20 Profilen ausschließlich im Arbeitsspeicher der Teilefinder-Seite; ein Neuladen leert sie. Bereits vorhandene Profile werden nicht nachträglich ergänzt.

Für einen neuen Durchlauf die aktualisierte Erweiterung und anschließend die Teilefinder-Seite neu laden, die Wunschliste prüfen und danach `JSON.stringify(getSearchProfiles(), null, 2)` in `tmp.log` übernehmen. Produktnamen müssen nicht mehr manuell ergänzt werden.


## Gespeicherte Wunschlistenlinks / 0.8.10

Wunschlistenprüfungen setzen `refreshKnown`. Ist eine passende Produkt-URL bekannt, wird ausschließlich diese direkt aktualisiert; eine fehlgeschlagene Bestätigung löst keine Shopsuche aus. Frühere Ergebnisse bleiben über die vorhandene Zusammenführung als nicht bestätigt erhalten. Shops ohne bekannten Link werden weiterhin durchsucht. Die Einzelteilsuche behält ihren Such-Fallback. Gespeicherte Links ohne EAN werden auch bei später ergänzter EAN direkt geprüft; die EAN muss auf der frisch gelesenen Seite weiterhin bestätigt werden. Explizit abweichende gespeicherte EANs werden ausgeschlossen.


## Einzeltests / 0.8.14

Peaty’s (1000 ml) benötigt im Einzeltest 52,323 Sekunden; Bike-Discount liefert sechsmal kein auswertbares Detailangebot, davon 47,622 Sekunden innerhalb der Leseraufrufe. Powerbar (Cola) benötigt diesmal 16,844 Sekunden; bei BIKE24 werden acht abweichende Seitenpfade gemeldet. Die Ursache dieser Pfadabweichungen ist nicht bestätigt. r2-bike liefert beim ersten Artikel nach zwei `noReceiver`-Antworten einen bereiten Datensatz; seine abgeschlossenen Warte- und Leseraufrufe dauern zusammen rund 3,5 Sekunden. Ein weiter sichtbares Firefox-Ladesymbol beschreibt den Seitenladezustand, nicht den Abschluss unseres Auslesens; offene Netzwerkressourcen sind im Timingprofil nicht erfasst.

Die Bike-Discount-Variantenprüfung unterscheidet nun fehlende Bedienelemente (weiter versuchen) von einer durchgeführten Prüfung vorhandener Optionen (abschließen, auch ohne bestätigtes Angebot). Dadurch wird eine erfolglose vollständige Prüfung nicht sechsmal neu gestartet. Es werden dabei keine alten Preise als frisch bestätigt.

Die Auswahlbestätigung verwendet denselben allgemeinen Variantenvergleich wie die Vorauswahl, insbesondere für unterschiedliche Mengeneinheiten und Leerzeichen. Der Preisleser erlaubt Zusätze zu genau einem Eurobetrag, lehnt aber mehrere Geldbeträge weiterhin als mehrdeutig ab. Diese Fälle sind regressionsgetestet; welche Bedingung konkret im Live-Tab gescheitert ist, lässt sich aus dem ursprünglichen Profil nicht beweisen. Der direkte HTML-Abruf wird durch Cloudflare blockiert; eine interaktive Browserprüfung ist hier nicht verfügbar.

`readIssues` zählt nun `optionsMissing`, `noMatchingOption`, `selectionUnconfirmed`, `priceMissing`, `fromPrice`, `stockMissing` oder `selectionUnsettled` bei nicht bestätigten Varianten. Diese Zähler enthalten keine zusätzlichen Shopinhalte und bleiben im lokalen Profil. Für eine reale Folgemessung genügt zunächst Peaty’s; der Powerbar-Pfadfehler ist von dieser Änderung nicht behoben.


## Gespeicherte Auswahl / 0.8.16

Der persistente Produktlink-Cache und die Wunschlistendatei speichern nun Optionsart, IDs, Werte, Namen und Beschriftungen der tatsächlich ausgewählten Variante. Beim Direktaufruf werden diese Daten gesondert als `savedSelection` übergeben. Alte Preise, Lagerangaben und EANs werden weiterhin aus dem Fallback entfernt; auch die gespeicherte Auswahl wird nicht als frisch bestätigt ausgegeben. Native Dropdowns werden in ihrer Abhängigkeiten-Reihenfolge wiederhergestellt. Bike-Discount-Radios und bike-components-Optionen erhalten dieselbe gezielte Wiederverwendung innerhalb ihrer bestehenden Shop-Adapter.

Die Regression mit zwei abhängigen BIKE24-Dropdowns prüft bei der Wiederholung nur eine gespeicherte Kombination mit zwei Auswahlereignissen statt erneut vier Kombinationen. Entfernte Werte/Beschriftungen führen zurück zur normalen Prüfung, ohne beliebige fremde DOM-Elemente anzuklicken. Verschiedene Ausführungen unter derselben URL bleiben getrennt; für die nächste Auswahl auf derselben Seite ist keine erneute Navigation nötig. Tests prüfen zudem Cache-Wiederverwendung nach einem Neustart sowie den Datei-Roundtrip. Live-Geschwindigkeitsgewinne sind damit noch nicht gemessen.


## Getrennte Farbe und Größe / 0.8.17

Die Farbe wurde bisher nur über wenige Farbwörter im sichtbaren Seitentext erkannt. Das reicht bei eingeklappten Produkteigenschaften nicht. Der gemeinsame Leser wertet deshalb explizit beschriftete Farbzeilen in Tabellen und Definitionslisten sowie `itemprop="color"` aus. Widersprüchliche Eigenschaften werden nicht bestätigt. Zusammengeschriebene Wörter mit Großbuchstaben im expliziten Farbfeld werden getrennt; Produktnamen und Beschreibungstexte werden dafür nicht umgedeutet.

Die allgemeine Bekleidungsregression kombiniert eine M-Radiooption mit einer nur im DOM vorhandenen Farbzeile. Sie prüft Schwarz, eine zusammengesetzte Farbbezeichnung, eine falsche Größe und eine abweichende Farbe. Vorhandene Tests stellen weiterhin sicher, dass ein Produktname mit einem farbähnlichen Technologiebegriff nicht als Farbbestätigung gilt. Der vom Nutzer genannte aktuelle Tab nennt Schwarz; der abrufbare externe Seitenstand nennt eine andere Farbe und ist daher kein Live-Nachweis für diesen Tab.

## Wunschlisten-Warteschlangen und Bereitschaftssignal (0.8.32)

Jeder Shop besitzt eine serielle Warteschlange für Initialprüfung und spätere EAN-Eingrenzung. Ein langsamer Shop blockiert die folgenden Artikel der anderen Shops nicht mehr. Pro Teilefinder-Tab bleibt es bei höchstens vier verwalteten Shop-Tabs. Profile entstehen je Artikel; ihre `elapsedMs` enthalten nun auch die Wartezeit in den Shop-Warteschlangen. Diese Zeiten dürfen bei einem Listenlauf **nicht addiert** werden. Für einen vollständigen Lauf mit gemeinsam gestarteten Artikeln entspricht das Maximum näherungsweise der Gesamtdauer.

Ein leichtes Bereitschaftssignal kann die erste feste Produktseiten-Pause verkürzen, wenn die Navigation zu einem anderen Produktpfad sicher erkennbar ist. Bei gleichem Pfad, unbekanntem Ausgangsdokument, fehlendem Empfänger oder ausbleibender Bereitschaft bleibt der bisherige begrenzte Wartepfad erhalten. Listing-Stabilität und langsamere Sicherheitsprüfungsintervalle bleiben unverändert. Dropdowns enden früher nur bei frisch bestätigter EAN, passender Variante, exaktem Preis und bekanntem Lagerstatus; eine Datenblatt-EAN reicht nicht. Gleichzeitige Statusmeldungen werden für die Darstellung gebündelt, die zugrunde liegenden Ergebnisse sofort verarbeitet.

Ein Live-Vergleich am 30.10.2026 mit derselben vorhandenen 12-Artikel-Wunschliste ergab weiterhin 35 bestätigte Shop-Angebote mit identischer Abdeckung je Artikel und denselben 445,95 € als Teilsumme. Der vorangegangene sequenzielle Lauf lieferte rund 223,5 Sekunden summierte Artikelzeiten; der Warteschlangenlauf rund 136,4 Sekunden bis zum letzten Artikel. Das entspricht in diesem einzelnen Vergleich etwa 39 % weniger Zeit. Netzwerk, Seitencaches und Hintergrundtab-Timer sind damit nicht kontrolliert; dies ist keine allgemeine Geschwindigkeitsgarantie. Während des Warteschlangenlaufs waren genau vier Tabs verwaltet. Beim Entwicklungs-Neuladen zurückgebliebene ältere Test-Tabs wurden anschließend geschlossen.

Die zusätzlichen Szenarien `readyProductSignal` und `loadingProductSignal` in `npm run profile:search` sind weiterhin **Simulationen**. Bei sofort beziehungsweise nach 100 ms verfügbarem Produktdokument entfällt dort die bisherige 750-ms-Pause, ohne zusätzliche Produkt-Auslesungen oder Shop-Tabs. Regressionstests prüfen außerdem unabhängigen Fortschritt, einen aktiven Auftrag pro Shop, EAN-Eingrenzung in derselben Warteschlange und Abbruch vor dem Start wartender Aufträge.
