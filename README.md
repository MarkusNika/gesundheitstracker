# Gesundheitstracker

Persönliche PWA zur Erfassung von Blutdruck, Puls, Medikamenten, Gewicht, Körperfett
(3-Punkt-Hautfalten, Männer- & Frauen-Protokoll), Monatsfotos und Tagesprotokoll. Daten
bleiben lokal auf dem Gerät (IndexedDB). CSV-Export für den Arzt, JSON-Vollsicherung als
Backup. Läuft komplett offline (keine externen Requests, Chart.js lokal eingebunden).

> Begleitendes Werkzeug für eine ärztlich betreute Ernährungsumstellung — keine
> medizinische Beratung. Details siehe `CLAUDE.md`.

## Lokal testen

Einfach `index.html` im Browser öffnen. Service Worker und „Installieren" funktionieren
zuverlässig nur über `https`/`localhost`, daher zum Testen ein lokaler Server:

```bash
# Python
python3 -m http.server 8080
# oder Node
npx serve .
```

Dann `http://localhost:8080` öffnen.

## Auf dem Handy nutzen (GitHub Pages)

1. Repo zu GitHub pushen.
2. Settings → Pages → Branch `main`, Ordner `/` (root) → Save.
3. Die ausgegebene URL auf dem Android-Handy in Chrome öffnen.
4. Menü → „Zum Startbildschirm hinzufügen". Läuft danach wie eine App und offline.

CSV/JSON-Exporte landen im Android-Downloads-Ordner und lassen sich von dort an den
Arzt mailen.

## Tests

Die testbare Kernlogik (Eingabe-Validierung, Backup-Import, Körperfett-Berechnung,
Eintrags-Listen, Foto- und Zeitraum-Helfer) liegt in `*-core.js`-Modulen und ist mit
dem eingebauten Test-Runner von Node abgedeckt — ohne zusätzliche Abhängigkeiten:

```bash
node --test
```

## Struktur

Siehe `CLAUDE.md` — Datenmodell, Screens, Körperfett-Formel mit Quelle, CSV-Format,
Roadmap.
