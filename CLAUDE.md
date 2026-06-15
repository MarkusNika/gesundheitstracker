# CLAUDE.md — Gesundheitstracker

Diese Datei ist das Briefing für Claude Code. Sie hält die Entscheidungen fest, die
außerhalb dieses Repos getroffen wurden. Bitte vor dem ersten Arbeitsschritt lesen.

## Zweck & Kontext

Persönliche Tracking-App für **eine Person** während einer **ärztlich begleiteten
Ernährungsumstellung**. Sie erfasst Messwerte und bereitet sie für den behandelnden
Arzt auf. Die App ist ein **Daten-Werkzeug** — sie gibt keine Ernährungs-, Kalorien-
oder Dosierungsempfehlungen und keine Zielwerte aus. Alle medizinischen Entscheidungen
trifft der Arzt.

## Nutzer-Präferenzen (gelten für alle Antworten)

- **Sprache:** Deutsch, Du-Anrede. UI-Texte auf Deutsch.
- **Genauigkeit vor Vollständigkeit.** Keine erfundenen Fakten/Formeln/Werte. Bei
  Unsicherheit sagen statt raten.
- **Datenschutz:** Gesundheitsdaten. Alles bleibt **lokal auf dem Gerät**. Keine
  Cloud, kein Tracking, keine externen Requests außer der Chart-Bibliothek.
- Stil: sachlich, direkt.

## Architektur-Entscheidung

**PWA-first.** Reiner Web-Stack (HTML/CSS/Vanilla-JS), kein Build-Schritt, läuft über
`file://` lokal und über **GitHub Pages**. Bewusst **klassische `<script>`-Tags statt
ES-Modulen**, damit es ohne Server (file://) funktioniert.

**Speicher:** IndexedDB (siehe `db.js`). Fotos als Blobs in der DB.

**Ausbaustufe (noch nicht umgesetzt):** Dieselbe Codebasis lässt sich später mit
**Capacitor** in eine Android-APK packen — `@capacitor/camera` (echte Fotodateien),
`@capacitor/filesystem` (echte CSV-Dateien). Erst angehen, wenn die IndexedDB-Speicherung
in der Praxis zu fragil ist. Nicht ohne Rücksprache starten.

## Dateien

| Datei | Zweck |
|-------|-------|
| `index.html` | UI-Grundgerüst, alle Screens, Tab-Navigation |
| `styles.css` | mobiles Layout |
| `db.js` | IndexedDB-Datenschicht, globaler Namespace `window.DB` |
| `app.js` | Logik: Formulare, KFA-Berechnung, Charts, Export |
| `sw.js` | Service Worker, App-Shell-Caching (Offline) |
| `manifest.webmanifest` | PWA-Manifest |
| `icon-192.png` / `icon-512.png` | Platzhalter-Icons (ersetzbar) |

## Datenmodell (IndexedDB Object Stores)

- `daily` — keyPath `date` (YYYY-MM-DD)
  `sys, dia, pulse, medA_mg, medB_mg, food, protocol`
- `weekly` — keyPath `date` (YYYY-MM-DD)
  `weight_kg, chest_mm, abdomen_mm, thigh_mm, sum_mm, age, bf_pct`
- `photos` — keyPath `id` (autoIncrement)
  `month (YYYY-MM), blob, created`
- `settings` — keyPath `key`; Datensatz `config`:
  `sex, birthdate, medA, medB`

## Screens

1. **Heute** (täglich): Blutdruck (sys/dia), Puls, Dosis Med A, Dosis Med B,
   Essens-Notiz, Freitext-Protokoll. Datum wählbar (Nachtragen möglich).
2. **Woche** (wöchentlich): Gewicht, Hautfalten Brust/Bauch/Oberschenkel.
   KFA-Live-Vorschau.
3. **Fotos** (monatlich): Kamera-Aufnahme via `<input capture>`, Galerie, Löschen.
4. **Verlauf**: Linien-Charts Blutdruck+Puls, Gewicht, Körperfett (Chart.js).
5. **Export**: zwei Arzt-CSVs + JSON-Vollsicherung.
6. **Einstellungen**: Geschlecht (Protokoll), Geburtsdatum, Medikamentennamen.

## Körperfett-Formel — NICHT verändern ohne Quelle

Jackson-Pollock **3-Punkt, Männer** (Sites: Brust, Bauch, Oberschenkel in mm).
Quelle: Jackson, A.S. & Pollock, M.L. (1978), *British Journal of Nutrition*, 40, 497–504.

```
S = Brust + Bauch + Oberschenkel            (mm)
Körperdichte = 1.10938 - 0.0008267*S + 0.0000016*S^2 - 0.0002574*Alter
Körperfett %  = (495 / Körperdichte) - 450   (Siri-Gleichung)
```

Hinweis im Code belassen: Bei sehr dicken Falten (>40–50 mm) liegt man ggf. außerhalb
des validierten Bereichs → absoluter KFA mit Vorsicht, **Trend ist robust**. Das ist
hier relevant (Ausgangsgewicht hoch). Implementiert ist nur das Männer-Protokoll; das
Frauen-Protokoll (Trizeps/Suprailiac/Oberschenkel, andere Formel) ist als
Erweiterungspunkt markiert.

## CSV-Format (für den Arzt)

Deutsches Excel-Format: Trennzeichen `;`, **Dezimalkomma**, UTF-8 **mit BOM**.

- `blutdruck_<datum>.csv`: Datum; Systolisch; Diastolisch; Puls; Dosis_<MedA>_mg; Dosis_<MedB>_mg
- `koerperfett_gewicht_<datum>.csv`: Datum; Gewicht_kg; Brust_mm; Bauch_mm; Oberschenkel_mm; Summe_mm; Alter; KFA_Prozent
- `backup_<datum>.json`: Vollsicherung inkl. Fotos (Base64) zum Wiederherstellen.

## Konventionen

- Deutsch im UI und in Commit-Messages.
- Vanilla JS, keine Frameworks/Bundler ohne Rücksprache (PWA-first-Prinzip).
- Keine externen Netzwerk-Requests außer Chart.js-CDN. Wenn echtes Offline gewünscht:
  Chart.js vendorn (lokal ablegen) statt CDN.
- Keine Browser-Storage-Tricks außer IndexedDB.

## Roadmap / offene Punkte

Bereits im Scaffold: alle 6 Screens, Speichern/Laden, KFA-Berechnung, 3 Charts,
beide CSV-Exporte, JSON-Backup, Service Worker, Manifest, Persistenz-Anfrage.

Sinnvolle nächste Schritte (mit Nutzer abstimmen, nicht alles auf einmal):
- [ ] **JSON-Backup-Import** (Restore) — Gegenstück zum Export, wichtig bei Handywechsel.
- [ ] Eingabe-Validierung & sinnvolle Plausi-Hinweise (z. B. sys > dia).
- [ ] Liste/Bearbeiten vergangener Tages-/Wocheneinträge (aktuell nur über Datumswahl).
- [ ] Foto: Datum/Monat manuell setzbar, Bildkomprimierung vor dem Speichern.
- [ ] Chart-Zeitraumfilter (z. B. letzte 4/12 Wochen).
- [ ] Echtes Offline: Chart.js lokal vendorn.
- [ ] Später: Capacitor-Hülle für native Kamera + Dateisystem (siehe oben).
