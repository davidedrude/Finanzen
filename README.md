# Finanzen

Private Progressive Web App zum Tracken von Ausgaben und zum Sparen.
Alle Daten bleiben **ausschließlich auf deinem Gerät** (IndexedDB). Es gibt keinen Server und keinen Login, und nichts wird übertragen.

- Konten mit Start- und aktuellem Saldo (Girokonto, Bargeld, Tagesgeld …)
- Einnahmen, Ausgaben, Umbuchungen. **Schnelleingabe in 3 Schritten:** `+` → Betrag → Kategorie
- Kategorien mit Farbe und Emoji, sinnvoll vorbelegt
- Wiederkehrende Buchungen (Miete, Abos, Gehalt). Sie werden beim Öffnen der App automatisch nachgebucht.
- Budgets pro Kategorie mit Warnung ab 80 %
- Sparziele mit nötiger Monatsrate und „im Plan“-Anzeige
- Auswertungen: Ausgaben nach Kategorie, 12-Monats-Verlauf, Sparquote
- CSV-Import von Kontoauszügen mit Spaltenzuordnung, Duplikaterkennung und Vorschau
- Backup als JSON (Export/Import), mit Hinweis nach 30 Tagen ohne Backup
- Hell/Dunkel automatisch, offlinefähig, installierbar auf iOS und Android

---

## Lokal starten

Voraussetzung: Node.js ≥ 20 (auf diesem Mac liegt Node 22 unter `~/.local/node`).

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

```bash
npm install
```

```bash
npm run dev
```

Die App läuft dann unter <http://localhost:5173/finanzen/>.

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm test` | Unit-Tests (Salden, Budgets, Sparziele, wiederkehrende Buchungen, CSV-Import, Backup) |
| `npm run build` | Produktions-Build nach `dist/` (inkl. Service Worker) |
| `npm run preview` | Produktions-Build lokal testen |
| `npm run icons` | App-Icons aus `public/logo.svg` neu erzeugen |

---

## Deployment auf GitHub Pages

Einmalig einrichten:

1. **Repository auf GitHub anlegen**, z. B. `finanzen` (privat oder öffentlich; GitHub Pages für private Repos braucht einen kostenpflichtigen Plan).
2. **Code hochladen:**
   ```bash
   git add . && git commit -m "Finanzen-App"
   ```
   ```bash
   git remote add origin https://github.com/<dein-user>/finanzen.git
   ```
   ```bash
   git push -u origin main
   ```
3. Auf GitHub: **Settings → Pages → Build and deployment → Source: „GitHub Actions“** auswählen.
4. Die Action `.github/workflows/deploy.yml` läuft bei jedem Push auf `main`: Tests → Build → Deploy.
   Den Fortschritt siehst du unter **Actions**.
5. Die App ist danach erreichbar unter
   `https://<dein-user>.github.io/<repo-name>/`

**Base-Pfad:** Die Action setzt ihn automatisch auf `/<repo-name>/`. Du musst also nichts ändern, auch wenn dein Repo anders heißt.
Nur für lokale Builds gilt der Standardwert `/finanzen/` aus `vite.config.ts`.

**Updates:** Einfach pushen. Die installierte App lädt die neue Version beim nächsten Öffnen im Hintergrund und nutzt sie ab dem übernächsten Start.

---

## Installation auf dem Handy

### iPhone / iPad (Safari)

1. Die App-URL in **Safari** öffnen (andere Browser auf iOS können teils nicht installieren).
2. Unten auf **Teilen** (Quadrat mit Pfeil) tippen.
3. **„Zum Home-Bildschirm“** wählen → **Hinzufügen**.
4. Die App startet nun im Vollbild vom Homescreen und funktioniert offline.

> **Wichtig für iOS:** Safari kann Website-Daten löschen, wenn eine Seite längere Zeit nicht genutzt wird. Als installierte Home-Bildschirm-App bist du davor weitgehend geschützt. Trotzdem gilt: **regelmäßig ein Backup machen** (Mehr → Backup & Daten → „In Dateien sichern“). Die Daten im Safari-Tab und in der installierten App sind **getrennt**, also am besten nur die installierte App verwenden.

### Android (Chrome)

1. Die App-URL in **Chrome** öffnen.
2. Chrome schlägt meist automatisch **„App installieren“** vor. Alternativ: Menü **⋮ → App installieren** bzw. **„Zum Startbildschirm hinzufügen“**.
3. Die App erscheint im App-Drawer mit eigenem Icon.

### Daten auf ein neues Gerät übertragen

Altes Gerät: **Mehr → Backup & Daten → Backup speichern**.
Neues Gerät: App installieren, erstes Konto anlegen (wird überschrieben), dann **Backup wiederherstellen** und die JSON-Datei wählen.

---

## CSV-Import

Im Online-Banking die Umsätze als CSV exportieren und dann **Mehr → CSV-Import** öffnen:

1. Zielkonto wählen, Datei auswählen. Zeichensatz (UTF-8/Windows-1252), Trennzeichen und Vorspannzeilen (z. B. bei der DKB) werden automatisch erkannt.
2. Spalten zuordnen: Datum, Betrag (oder Soll/Haben getrennt), Verwendungszweck, Empfänger. Die Zuordnung wird pro Bankformat gespeichert.
3. In der Vorschau prüfen:
   - **„Bereits importiert“**: Diese Zeile wurde schon einmal importiert und ist standardmäßig abgewählt.
   - **„Evtl. schon erfasst“**: Es gibt eine manuelle Buchung mit gleichem Datum und Betrag auf dem Konto.
   - Kategorien werden aus früheren Buchungen mit ähnlichem Text vorgeschlagen.
4. Importieren.

---

## Technik

- Vite + React + TypeScript, `vite-plugin-pwa` (Workbox, Precache aller Dateien)
- Dexie (IndexedDB) mit Live-Queries
- `HashRouter`, damit Neuladen auf GitHub Pages nie zu einem 404 führt
- **Alle Beträge als ganze Cent (Integer)**, dadurch gibt es keine Rundungsfehler. Das Parsen (`1.234,56` → `123456`) geschieht rein über Strings.
- Salden werden immer aus Startsaldo + Buchungen berechnet und nie gespeichert. Sie können deshalb nicht auseinanderlaufen.

```
src/
  domain/      Reine Rechenlogik + Tests (Geld, Datum, Salden, Budgets, Sparziele, Wiederkehrend, Statistik, CSV)
  db/          Dexie-Schema, Standardkategorien, Backup, Runner für wiederkehrende Buchungen
  components/  UI-Bausteine, Schnelleingabe, Diagramme (eigene SVGs)
  pages/       Screens
  styles/      Design-Tokens (hell/dunkel) und Komponenten-CSS
```
