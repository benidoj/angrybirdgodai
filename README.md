# AngryBirdGodAI

AngryBirdGodAI ist eine lokale ChatGPT-ähnliche Web-App für Windows. Sie verwendet Ollama und das LiquidAI-Modell **LFM2.5 2.6B GGUF**. Zusätzlich bietet sie Web-Recherche mit Quellen, Deep Research und Analysis Mode, Sprachsteuerung, Read-aloud/TTS, die Great-Sage-Ansicht, Notizen, Podcasts sowie ausdrücklich bestätigungspflichtige PC-Aktionen.

> **Wichtig:** Die App kann lokale Programme starten und Systeminformationen auslesen. Aktiviere diese Funktionen nur, wenn du dem Projekt und deinen lokalen Dateien vertraust. API-Schlüssel gehören nicht in GitHub, Screenshots oder öffentliche Chats.

---

## Inhaltsverzeichnis

1. [Voraussetzungen](#voraussetzungen)
2. [Projekt herunterladen](#projekt-herunterladen)
3. [Ollama installieren](#ollama-installieren)
4. [LFM2.5-Modell herunterladen](#lfm25-modell-herunterladen)
5. [Projektabhängigkeiten installieren](#projektabhängigkeiten-installieren)
6. [App starten](#app-starten)
7. [Erste Einrichtung](#erste-einrichtung)
8. [Alle Funktionen verwenden](#alle-funktionen-verwenden)
9. [Deep Research und Analysis Mode](#deep-research-und-analysis-mode)
10. [Bilder und Vision-Modell](#bilder-und-vision-modell)
11. [Stimme, Great Sage und Fish Audio](#stimme-great-sage-und-fish-audio)
12. [Lokales Kokoro-TTS](#lokales-kokoro-tts)
13. [Spracheingabe und Wake-Word](#spracheingabe-und-wake-word)
14. [Notizen](#notizen)
15. [Podcasts](#podcasts)
16. [PC-Aktionen und Systemchecks](#pc-aktionen-und-systemchecks)
17. [Konfiguration über Umgebungsvariablen](#konfiguration-über-umgebungsvariablen)
18. [Problemlösung](#problemlösung)
19. [Datenschutz und Sicherheit](#datenschutz-und-sicherheit)
20. [Technischer Überblick](#technischer-überblick)

---

## Voraussetzungen

Für die normale Nutzung brauchst du:

- Windows 10 oder Windows 11
- ein aktuelles 64-Bit-Node.js, empfohlen **Node.js LTS**
- Ollama für das lokale Sprachmodell
- mindestens mehrere GB freien Speicher für das Modell
- einen modernen Browser, vorzugsweise Chrome oder Edge
- Internetzugang nur für Web-Recherche und optionale Cloud-TTS-Dienste

Für optionale Funktionen gelten zusätzliche Voraussetzungen:

| Funktion | Zusätzlich erforderlich |
|---|---|
| Chat offline | Ollama und ein installiertes Modell |
| Web-Recherche | Internetzugang |
| Mikrofon/Wake-Word | Browser-Mikrofonberechtigung, Chrome oder Edge empfohlen |
| Fish Audio | Fish-Audio-Konto und API-Key |
| Kokoro lokal | Python, die mitgelieferten Kokoro-Dateien und ein laufender Python-Server |
| Podcasts als WAV | Kokoro oder Fish Audio, abhängig vom gewählten Backend |
| Vision-Beschreibungen | Ein Ollama-Vision-Modell, z. B. `llama3.2-vision` |

---

## Projekt herunterladen

### Möglichkeit A: Mit Git

1. Installiere Git für Windows von:
   [https://git-scm.com/download/win](https://git-scm.com/download/win)
2. Öffne **PowerShell** oder **Windows Terminal**.
3. Wechsle in den Ordner, in dem das Projekt liegen soll:

   ```powershell
   cd "$HOME\OneDrive\sillys"
   ```

4. Klone das Repository:

   ```powershell
   git clone <REPOSITORY-URL> angrybirdgodai
   cd angrybirdgodai
   ```

   Ersetze `<REPOSITORY-URL>` durch die tatsächliche Git-URL des Projekts.

### Möglichkeit B: Als ZIP-Datei

1. Öffne die Projektseite im Browser.
2. Klicke auf **Code → Download ZIP**.
3. Speichere die ZIP-Datei.
4. Entpacke sie beispielsweise nach:

   ```text
   C:\Users\andre\OneDrive\sillys\angrybirdgodai
   ```

5. Öffne PowerShell und wechsle in den entpackten Ordner:

   ```powershell
   cd "C:\Users\andre\OneDrive\sillys\angrybirdgodai"
   ```

Prüfe danach, ob mindestens diese Dateien vorhanden sind:

```text
app.js
index.html
styles.css
server.js
package.json
```

---

## Ollama installieren

Ollama ist der lokale Dienst, der das Sprachmodell lädt und Antworten erzeugt.

1. Lade Ollama für Windows von [https://ollama.com/download/windows](https://ollama.com/download/windows) herunter.
2. Starte den Installer.
3. Akzeptiere die Standardoptionen.
4. Starte Ollama nach der Installation. Normalerweise läuft es anschließend im Hintergrund.
5. Öffne ein neues PowerShell-Fenster und prüfe die Installation:

   ```powershell
   ollama --version
   ```

Wenn eine Versionsnummer erscheint, ist Ollama installiert.

### Prüfen, ob der Ollama-Dienst erreichbar ist

```powershell
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

Wenn der Dienst läuft, erhältst du eine JSON-Antwort mit den installierten Modellen. Falls die Verbindung fehlschlägt, starte die Ollama-Anwendung über das Startmenü und wiederhole den Befehl.

---

## LFM2.5-Modell herunterladen

Das Projekt ist für das LiquidAI-Modell aus diesem Ollama-Modellpfad vorgesehen:

```text
hf.co/LiquidAI/LFM2.5-2.6B-GGUF
```

Die empfohlene lokale Variante ist:

```powershell
ollama pull hf.co/LiquidAI/LFM2.5-2.6B-GGUF:Q4_K_M
```

Der Download kann je nach Internetgeschwindigkeit mehrere Minuten dauern.

### Modell testen

```powershell
ollama run hf.co/LiquidAI/LFM2.5-2.6B-GGUF:Q4_K_M
```

Gib danach eine kurze Frage ein. Mit `Ctrl+C` beendest du den Test.

### Installierte Modelle anzeigen

```powershell
ollama list
```

Notiere den exakten Namen in der Spalte **NAME**. Falls dein Modell einen anderen Tag verwendet, zum Beispiel `:Q8_0` oder `:bf16`, trägst du genau diesen Namen später in den App-Einstellungen ein.

### Hinweis zum vorhandenen Windows-Modellpfad

Ollama verwaltet seine Modelldateien selbst. Ein Ordner wie:

```text
C:\Users\andre\.ollama\models\manifests\hf.co\LiquidAI\LFM2.5-2.6B-GGUF
```

sollte nicht manuell kopiert, umbenannt oder bearbeitet werden. Die App liest diesen Ordner nicht direkt, sondern spricht mit der lokalen Ollama-API.

---

## Projektabhängigkeiten installieren

Dieses Projekt hat derzeit keine zusätzlichen npm-Pakete. Node.js ist trotzdem erforderlich, weil `server.js` der lokale Webserver ist.

Wechsle in den Projektordner:

```powershell
cd "C:\Users\andre\OneDrive\sillys\angrybirdgodai"
```

Prüfe Node und npm:

```powershell
node --version
npm --version
```

Optional kannst du npm initialisieren bzw. prüfen, ob das Projekt korrekt gelesen wird:

```powershell
npm install
```

Da `package.json` keine externen Abhängigkeiten enthält, sollte dieser Befehl sehr schnell fertig sein. Falls ein `package-lock.json` vorhanden ist, kannst du stattdessen reproduzierbar installieren:

```powershell
npm ci
```

---

## App starten

### Empfohlener Start

```powershell
cd "C:\Users\andre\OneDrive\sillys\angrybirdgodai"
npm start
```

Der Server startet standardmäßig auf:

```text
http://127.0.0.1:4173
```

Öffne diese Adresse im Browser.

### Entwicklungsstart

```powershell
npm run dev
```

`npm run dev` verwendet in diesem Projekt denselben lokalen Node-Server. Änderungen an HTML, CSS oder JavaScript werden beim Neuladen der Seite sichtbar.

### Server beenden

Klicke in das PowerShell-Fenster, in dem der Server läuft, und drücke:

```text
Ctrl+C
```

### Anderen Port verwenden

Wenn Port 4173 bereits belegt ist:

```powershell
$env:PORT=3000
npm start
```

Öffne anschließend:

```text
http://127.0.0.1:3000
```

Nur für den aktuellen PowerShell-Prozess gilt die gesetzte Variable. Für ein neues Fenster muss sie erneut gesetzt werden.

### Prüfen, ob ein Port belegt ist

```powershell
Get-NetTCPConnection -LocalPort 4173 -ErrorAction SilentlyContinue
```

---

## Desktop-App (wie Steam)

AngryBirdGodAI kann als echtes Desktop-Programm gestartet werden — mit Startmenü-Verknüpfung, Desktop-Icon und eigenem Fenster, ganz ohne Browser. Die App startet den Server automatisch im Hintergrund.

### Option 1: Portables EXE (kein Installieren)

```text
desktop/dist/AngryBirdGodAI.exe
```

Einfach doppelklicken. Die App startet, der Server läuft automatisch, das Fenster öffnet sich. Kein Installieren nötig — perfekt zum Austesten oder Umkopieren auf USB-Stick.

### Option 2: Installer mit Startmenü-Verknüpfung

```text
desktop/dist/AngryBirdGodAI Setup 1.0.0.exe
```

Dieser Installer erstellt:
- Eine **Desktop-Verknüpfung**
- Einen **Startmenü-Eintrag** unter *AngryBirdGodAI*
- Einen **Deinstallierer** unter Systemeinstellungen

### Selbst bauen

Wenn du die App selbst neu bauen möchtest (z.B. nach Code-Änderungen):

```powershell
cd desktop
npm install           # einmalig (~150 MB)
npm run fetch:whisper # einmalig — lädt die Offline-Spracherkennung (whisper.cpp + Modell, ~41 MB)
npm run dist          # baut Installer + Portable
# oder:
npm run dist:portable # nur portable EXE
```

Der Aufruf `npm run fetch:whisper` lädt die kleine Offline-Spracherkennung
herunter, mit der das „Great Sage“-Aufwachwort und die Spracheingabe auch ohne
Google-Sprachdienst und ohne Internet funktionieren. Er ist idempotent —
einfach erneut ausführen, wenn die Dateien fehlen oder repariert werden sollen.

Die fertige EXE liegt dann unter `desktop/dist/`.

### Für Freunde teilen

Die portable EXE (`AngryBirdGodAI.exe`, ~71 MB) ist alles was dein Freund braucht:
- Kein Node.js nötig
- Kein npm nötig
- Kein Ollama nötig (das muss er separat installieren)
- Einfach doppelklicken, Ollama-Endpunkt in Settings eintragen, fertig

### App updaten

Wie du auf die neueste Version kommst, hängt davon ab, wie du die App bekommen hast:

**Per `git clone` (Entwickler):**

```powershell
cd angrybirdgodai
git pull                          # Code aktualisieren
npm install                       # falls neue Dependencies dazugekommen sind
cd desktop && npm install && cd ..  # falls sich desktop/ geändert hat
npm start                         # App starten
```

**Per ZIP-Download:**

1. Lade die neueste ZIP von https://github.com/benidoj/angrybirdgodai/archive/refs/heads/main.zip herunter
2. Entpacke sie
3. Kopiere deine `Settings`-Konfiguration (Ollama-Endpunkt, Modellname) aus der alten Version
4. Starte mit `npm start` oder nutze die neue portable EXE

**Per portable EXE (`AngryBirdGodAI.exe`):**

1. Lade die neueste EXE von https://github.com/benidoj/angrybirdgodai/releases herunter (oder direkt von `desktop/dist/AngryBirdGodAI.exe` im Repo)
2. Ersetze die alte EXE durch die neue
3. Doppelklick — fertig

> **Tipp:** Die App prüft beim Start automatisch, ob eine neue Version auf GitHub verfügbar ist. Du siehst ein Hinweis-Banner, wenn ein Update bereit ist.

---

## Erste Einrichtung

1. Starte Ollama.
2. Starte die App mit `npm start`.
3. Öffne `http://127.0.0.1:4173`.
4. Öffne in der App **Settings**.
5. Prüfe den Ollama-Endpunkt:

   ```text
   http://127.0.0.1:11434
   ```

6. Trage den exakten Modellnamen aus `ollama list` ein.
7. Wähle zunächst einen normalen Antwortstil und eine moderate Temperatur.
8. Sende eine kurze Testfrage.
9. Wenn eine Antwort erscheint, ist die Grundinstallation fertig.

Die Unterhaltungen und Einstellungen werden lokal im Browser gespeichert. Wenn du die Browserdaten löschst oder einen anderen Browser verwendest, sind die dort gespeicherten Einstellungen und Notizen nicht automatisch vorhanden.

---

## Alle Funktionen verwenden

### Normale Chatfragen

Schreibe deine Frage in das Eingabefeld und drücke **Send** oder `Enter`. Mit `Shift+Enter` kannst du in der Regel einen Zeilenumbruch einfügen.

### Generation Controls

In den Settings kannst du anpassen:

- **Temperature:** Niedrige Werte liefern vorhersehbarere Antworten; höhere Werte sind kreativer.
- **Context length:** Wie viele Tokens als Kontext verwendet werden. Wenn die Fehlermeldung `exceeds the available context size` erscheint, reduziere Anhänge, Gesprächslänge oder Forschungsumfang bzw. erhöhe die Context Length, sofern dein Modell und dein RAM das erlauben.
- **Response style:** balanced, concise, detailed oder creative.
- **Stop:** Bricht eine laufende Modellantwort ab.

### Dateien anhängen

1. Klicke auf das Büroklammer-Symbol.
2. Wähle Text- oder Code-Dateien aus.
3. Alternativ kannst du Dateien auf den Composer ziehen.
4. Sende danach deine Frage.

Die App liest Text und Code lokal im Browser. Die aktuellen Grenzen sind ungefähr 600 KB pro Datei und 1,5 MB insgesamt. Binärdateien, PDFs und Bilder werden mit dem textorientierten Standardmodell nicht automatisch als Text analysiert.

### Quellen anzeigen

Wenn Recherche aktiv ist, zeigt die App unter der Antwort die verwendeten Quellen an. Die Quellen sind anklickbar und enthalten Titel, Domain, Snippet und – je nach Modus – Seiteninhalte oder Beispielbilder.

---

## Deep Research und Analysis Mode

### Deep Research

Deep Research führt mehrere Suchanfragen aus, dedupliziert die Ergebnisse, liest ausgewählte Seiten ein und übergibt Auszüge an das lokale Modell. Die Antwort enthält strukturierte Abschnitte und Quellenzitate wie `[1]` oder `[2]`.

Du kannst Deep Research auf zwei Arten starten:

- global in den Settings aktivieren; oder
- im Composer den **Deep**-Schalter für genau die nächste Frage aktivieren.

Deep Research dauert länger als eine normale Antwort. Der Statusbereich zeigt die einzelnen Phasen. Der Stop-Button bricht laufende Recherche und Generierung ab.

### Analysis Mode mit 100 oder mehr Quellen

Der Analysis Mode ist für besonders umfangreiche Berichte gedacht. Er erstellt viele Suchanfragen, sammelt und dedupliziert Suchergebnisse und versucht, mindestens 100 unterschiedliche Quellen zu erfassen – abhängig davon, was die Suchanbieter tatsächlich liefern. Bis zu 120 Quellen können in der Ergebnismenge erscheinen; ausgewählte Seiten werden zusätzlich vollständig bzw. auszugsweise gelesen.

Das ist wichtig: **100 Quellen zu suchen bedeutet nicht, dass jede einzelne Seite vollständig gelesen werden kann.** Webseiten können blockieren, Suchmaschinen können Rate-Limits auslösen und manche Treffer sind Duplikate. Die Oberfläche zeigt deshalb die tatsächlich geprüfte Quellenanzahl und die gelesenen Seiten getrennt an.

Der Server verwendet eine Fallback-Kette:

```text
DuckDuckGo → Bing → Brave → Wikipedia
```

Bei Analysis Mode werden mehrere Suchanfragen parallel ausgeführt. Die Ergebnisliste wird nach Wiederholungen und Relevanz sortiert. Verwende für gute Ergebnisse ein möglichst präzises Thema, zum Beispiel:

```text
Die Auswirkungen von Mikroplastik auf Süßwasserökosysteme seit 2015
```

statt nur:

```text
Mikroplastik
```

Ein ausführlicher Analysebericht kann je nach Internet, Zielseiten und Rechner mehrere Minuten benötigen.

---

## Bilder und Vision-Modell

In Deep Research und Analysis Mode versucht die App, aus gelesenen Quellen Beispielbilder zu ermitteln. Sie bevorzugt `og:image` und ergänzt relevante Bild-URLs aus normalen `<img>`-Elementen. Kleine Icons, Logos, SVGs und offensichtliche Platzhalter werden herausgefiltert.

Das Modell darf nur Bilder verwenden, deren exakte URLs aus den recherchierten Quellen stammen. Relevante Bilder können als Markdown eingebettet werden:

```markdown
![Beschreibung des Bildes](https://example.org/bild.jpg)
```

### Vision-Modell einrichten

Für automatische Bildbeschreibungen brauchst du ein Vision-fähiges Ollama-Modell.

Beispiel:

```powershell
ollama pull llama3.2-vision
```

Andere mögliche Modelle sind – abhängig von Ollama und deiner Hardware – beispielsweise `minicpm-v` oder ein anderes Vision-Modell.

Trage anschließend in den Settings im Feld für das Vision-Modell den exakten Namen ein:

```text
llama3.2-vision
```

Nach dem Bericht lädt die App eingebettete Bilder über den lokalen Proxy, sendet sie als Bilddaten an das Vision-Modell und fügt eine kurze Beschreibung hinzu. Wenn du das Feld leer lässt, werden Bilder weiterhin eingebettet, aber nicht automatisch beschrieben.

---

## Stimme, Great Sage und Fish Audio

### Browser-Stimme

Die einfachste Variante verwendet die Web-Speech-Synthese des Browsers:

1. Öffne **Settings**.
2. Wähle als TTS-Engine **Browser**.
3. Wähle eine englische Stimme.
4. Passe Geschwindigkeit und Tonhöhe an.
5. Speichere die Einstellungen.

Die verfügbaren Stimmen hängen von Windows und dem Browser ab. Chrome und Edge liefern meist die beste Unterstützung.

### Fish Audio einrichten

Fish Audio ist ein Cloud-Dienst. Der Text wird zur Sprachsynthese an Fish Audio übertragen.

1. Erstelle ein Konto unter [fish.audio](https://fish.audio).
2. Öffne die API-Key-Seite: [fish.audio/app/api-keys](https://fish.audio/app/api-keys/).
3. Erstelle einen API-Key und kopiere ihn sofort.
4. Öffne in AngryBirdGodAI **Settings**.
5. Wähle **Fish Audio (Great Sage)** als TTS-Engine.
6. Trage den API-Key ein.
7. Trage die ID des gewünschten Voice-Modells ein. Eine zuvor verwendete Great-Sage-Voice-ID war beispielsweise:

   ```text
   4c82a14548dc4b3e8d7dda68c9756c90
   ```

8. Speichere die Settings.
9. Nutze **Read aloud** unter einer Assistant-Antwort zum Testen.

Die App verwendet dafür den lokalen Server-Proxy `/api/fish-tts`, damit der Browser keine CORS-Probleme bekommt. Der Schlüssel wird in den Browser-Settings gespeichert und sollte nicht in öffentlichen Code gelangen.

> Wenn du einen API-Key bereits in einem Chat, Screenshot oder Repository veröffentlicht hast, widerrufe ihn beim Anbieter und erstelle einen neuen.

### Great-Sage-Avatar

Wenn Fish Audio (oder der passende Great-Sage-Kokoro-Modus) aktiv ist, erscheint der 3D-Analyse-Sigil unten rechts nur während des Denkens oder Sprechens. Er kann:

- während der Generierung einen Thinking-Zustand anzeigen;
- während des Sprechens mit Aura, Ringen und Bewegungen reagieren;
- die Mund-/Sprachring-Bewegung über einen Web-Audio-Analyser an die echte Lautstärke koppeln;
- einen Satz im Speech-Bubble anzeigen;
- per Klick die letzte Antwort vorlesen oder laufende Wiedergabe stoppen;
- per Cursor-Parallaxe räumlicher wirken.

Bei einer anderen Stimme bleibt der Avatar ausgeblendet.

---

## Lokales Kokoro-TTS

Im Projekt liegen Dateien für einen lokalen Kokoro-Dienst, unter anderem:

```text
kokoro_server.py
kokoro-v1.0.onnx
voices-v1.0.bin
```

Die genaue Python-Umgebung kann je nach bereitgestellter Version variieren. Allgemeines Vorgehen:

1. Installiere Python 3.10 oder neuer von [python.org](https://www.python.org/downloads/).
2. Aktiviere beim Windows-Installer **Add Python to PATH**.
3. Prüfe Python:

   ```powershell
   python --version
   ```

4. Wechsle in den Projektordner.
5. Installiere nur die Pakete, die `kokoro_server.py` importiert. Prüfe dafür zuerst die Importzeilen:

   ```powershell
   Select-String -Path .\kokoro_server.py -Pattern '^import |^from '
   ```

6. Starte den Kokoro-Dienst gemäß den in der Datei dokumentierten Optionen:

   ```powershell
   python .\kokoro_server.py
   ```

   Falls die Datei eine andere Startsyntax verlangt, verwende die dort angegebene Syntax.
7. Wähle in AngryBirdGodAI **Kokoro** als TTS-Engine.

Da lokale TTS-Setups stark von Python-Version, GPU, CPU und den installierten Paketen abhängen, solltest du bei Fehlern zuerst die komplette Fehlermeldung aus dem Python-Terminal prüfen.

---

## Spracheingabe und Wake-Word

### Diktieren

1. Erlaube dem Browser den Zugriff auf das Mikrofon.
2. Klicke auf das Mikrofon-Symbol.
3. Sprich deine Frage.
4. Prüfe den erkannten Text.
5. Sende die Frage.

### Wake-Word „Great Sage“

1. Klicke auf das Waveform-/Wake-Word-Symbol.
2. Sage auf Englisch deutlich **Great Sage**.
3. Sprich anschließend den Befehl, zum Beispiel:

   ```text
   Great Sage, open calculator
   ```

4. Die App bestätigt kurz und sendet den Befehl als Chatnachricht.

Du kannst in den Settings **Auto-start “Great Sage” listening** aktivieren. Browser können trotzdem eine einmalige Nutzeraktion oder Mikrofonberechtigung verlangen. Wenn der Browser die Erkennung nicht automatisch starten darf, klicke einmal auf den Wake-Word-Button.

---

## Great-Sage-Overlay über anderen Apps

Die Great Sage kann als schwebendes, transparentes Fenster **über allen anderen Apps** erscheinen (Spotify, Discord, Browser, Spiele …), nicht nur im Browser-Tab. Dafür gibt es eine kleine Electron-Overlay-App im Ordner `overlay/`.

### Einmalige Installation

```powershell
cd "C:\Users\andre\OneDrive\sillys\angrybirdgodai\overlay"
npm install
```

Das lädt Electron einmalig herunter (~150 MB).

### Starten

1. Starte zuerst die normale App: `npm start` (in einem eigenen Fenster).
2. Starte das Overlay in einem zweiten Fenster:

   ```powershell
   cd "C:\Users\andre\OneDrive\sillys\angrybirdgodai"
   npm run overlay
   ```

3. Der Server und die App müssen laufen, damit das Overlay funktioniert.

### Verhalten

- Das Overlay zeigt das Great-Sage-Sigil **unten rechts über allen Apps**, aber nur solange die Great-Sage-Stimme ausgewählt ist und sie tatsächlich spricht oder denkt.
- Es ist ein transparentes, rahmenloses, immer-im-Vordergrund-Fenster. Wenn sie nicht spricht, ist es unsichtbar und **klickdurchlässig** — es stört andere Apps nicht.
- Während sie spricht, kannst du auf das Overlay klicken, um die Wiedergabe zu stoppen.
- **Du kannst sie mit der Maus überall hinziehen** — sowohl im Browser-Tab als auch im Overlay. Die Position wird gespeichert und beim nächsten Erscheinen wiederhergestellt. Ein Klick ohne Ziehen bleibt ein Klick (Stopp/Read-aloud); erst ab einer kleinen Bewegung wird es als Ziehen gewertet.
- Der Sprachbubble zeigt den aktuell gesprochenen Satz.
- Das Overlay bezieht seinen Zustand über `/api/overlay-state` vom lokalen Server — die Browser-App meldet dort, wann sie spricht.

### Beenden

Im Fenster des Overlays `Ctrl+C` drücken oder die Electron-Prozesse beenden.

### Hinweise

- Das Overlay funktioniert nur auf Windows (die App ist insgesamt Windows-orientiert).
- Falls du einen anderen Port als 4173 verwendest, starte das Overlay mit:

  ```powershell
  $env:ABGAI_SERVER="http://127.0.0.1:3000"
  npm run overlay
  ```

## Notizen

Die Notes-Funktion speichert Notizen lokal im Browser.

### Notiz manuell erstellen

1. Öffne **Notes** in der Sidebar.
2. Klicke auf **New note**.
3. Bearbeite Titel und Inhalt.
4. Die Notiz wird automatisch gespeichert.

### AI-Antwort speichern

Unter einer Assistant-Antwort kannst du wählen:

- **Save to notes:** speichert die vorhandene Antwort;
- **Regenerate as note:** führt die ursprüngliche Frage erneut als Notizauftrag aus und speichert die neue Antwort;
- eine Notiz-Anweisung direkt im Chat, zum Beispiel `Schreib eine Notiz über ...`.

### Notizen exportieren

In der Notes-Toolbar kannst du alle Notizen exportieren:

- als eine Markdown-Datei; oder
- als ZIP-Datei mit einer Markdown-Datei pro Notiz.

---

## Podcasts

Die Podcast-Funktion erzeugt aus einem Thema ein Dialogskript mit zwei Hosts.

1. Öffne **Podcast** in der Sidebar.
2. Gib ein Thema ein.
3. Wähle kurz, mittel oder lang.
4. Starte die Recherche und Skripterstellung.
5. Bearbeite das Skript bei Bedarf direkt im Textfeld.
6. Prüfe die Sprecherzeilen `HOST1:` und `HOST2:`.
7. Starte die Wiedergabe oder die WAV-Synthese.
8. Nutze **Cancel**, wenn die Recherche oder Synthese zu lange dauert.

Abgeschlossene Episoden werden automatisch als Notiz gespeichert. Wenn eine WAV-Datei erzeugt wurde, wird der Download-Link ebenfalls in der Notiz abgelegt.

Für lokale WAV-Synthese wird Kokoro verwendet, wenn das Skript und Backend dafür geeignet sind. Fish Audio kann die Sprachsynthese ebenfalls übernehmen, sofern API-Key und Voice-ID korrekt konfiguriert sind.

---

## PC-Aktionen und Systemchecks

Die App kann bestimmte Aktionen auf dem Windows-PC vorschlagen. Jede Aktion benötigt eine ausdrückliche Bestätigung.

### Programme öffnen

Beispiele:

```text
Great Sage, open Spotify
Great Sage, launch Notepad
Open Calculator
```

Unterstützte Programme umfassen unter anderem Spotify, VS Code, Chrome, Firefox, Edge, File Explorer, Notepad, Calculator, PowerShell, Task Manager, Settings, Discord, Slack, Telegram, WhatsApp, Obsidian, Terminal, Paint und Snipping Tool.

**Voller Zugriff auf alle installierten Apps:** Die KI ist nicht auf die Whitelist beschränkt. Wenn du sie bittest, irgendein Programm zu öffnen (z. B. Steam, Blender, OBS, Audacity, ein Spiel), verwendet sie den App-Namen direkt als Ziel. Der Server findet die App über mehrere Fallbacks: bekannte Installationspfade (Program Files, LocalAppData, System32), Startmenü-Verknüpfungen (`.lnk`), UWP/Microsoft-Store-Apps (ohne `.lnk`, via `Get-StartApps` + `shell:AppsFolder`), die Windows-Registry (`App Paths`), den PATH und registrierte URI-Schemata (z. B. `spotify:`, `discord:`, `ms-settings:`, `ms-windows-store:`). Tote Verknüpfungen (Ziel nicht mehr vorhanden) werden übersprungen. Wenn eine App wirklich nicht installiert ist, meldet die App das klar (z. B. „Could not find "vlc" on this PC.“), statt still zu scheitern. **Jede Aktion benötigt weiterhin deine ausdrückliche Bestätigung** — die KI kann nichts ohne dein OK starten.

### Webseiten öffnen

Die KI kann zusätzlich Webseiten im Standardbrowser öffnen — entweder über bekannte Site-Namen oder direkt per Domain:

```text
Open YouTube
Open github
Open example.com
Open docs.python.org
```

Unterstützte bekannte Namen: youtube, google, github, reddit, twitter/x, wikipedia, twitch, amazon, netflix, roblox, gmail, maps. Alles andere, was wie eine Domain aussieht (`.com`, `.org`, `.io`, …), wird als `https://www.<domain>` geöffnet.

### Ordner öffnen

Beispiele:

```text
Open Downloads
Open Documents
Open Desktop
Open my OneDrive folder
```

### Sichere Systemchecks

Die App bietet read-only Checks für:

- CPU
- Arbeitsspeicher
- Speicherplatz
- laufende Prozesse
- Netzwerk
- Systemlaufzeit/Uptime

Beispiele:

```text
How much free disk space do I have?
What is using my CPU?
Wie lange läuft mein System schon?
```

Die App kann außerdem proaktiv vorschlagen, einen Check durchzuführen, wenn Informationen über den PC-Zustand fehlen. In den Settings kannst du **Run diagnostics** verwenden, um alle sechs Checks auszuführen und eine Zusammenfassung anzuzeigen.

Die Befehle sind serverseitig als Whitelist definiert. Trotzdem solltest du jede Bestätigungsanzeige lesen, bevor du sie bestätigst.

---

## Konfiguration über Umgebungsvariablen

Der Server unterstützt folgende Variablen:

| Variable | Standard | Bedeutung |
|---|---:|---|
| `PORT` | `4173` | Port der Web-App |
| `HOST` | `127.0.0.1` | Bind-Adresse des Webservers |
| `OLLAMA_HOST` | `127.0.0.1` | Host der Ollama-API |
| `OLLAMA_PORT` | `11434` | Port der Ollama-API |

Beispiel für einen anderen Ollama-Port:

```powershell
$env:OLLAMA_PORT=11435
npm start
```

Beispiel für einen anderen App-Port:

```powershell
$env:PORT=3000
npm start
```

Für dauerhaft gesetzte Variablen kannst du Windows-Umgebungsvariablen verwenden. Vermeide es, geheime API-Keys in `package.json`, `README.md` oder Quellcodedateien zu schreiben.

---

## Problemlösung

### `Unable to reach Ollama`

Prüfe:

```powershell
ollama --version
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

Starte Ollama neu und prüfe in den App-Settings Host, Port und Modellnamen.

### `model not found`

Zeige die exakten Namen an:

```powershell
ollama list
```

Ziehe das fehlende Modell nach:

```powershell
ollama pull <EXAKTER-MODELLNAME>
```

### `request exceeds the available context size`

Die Nachricht inklusive Verlauf, Rechercheauszügen und Anhängen ist zu groß. Maßnahmen:

1. Starte eine neue Unterhaltung.
2. Entferne große Anhänge.
3. Verwende Quick Research statt Analysis Mode.
4. Reduziere die Context Length nicht weiter; erhöhe sie nur, wenn dein Modell das unterstützt.
5. Kürze die Frage oder teile sie in mehrere Schritte.

### Es werden nur wenige Quellen angezeigt

Suchanbieter können Rate-Limits, CAPTCHAs, Duplikate oder nicht zugängliche Seiten liefern. Analysis Mode versucht viele Ergebnisse zu sammeln, aber die tatsächlich verfügbare Zahl hängt vom Netz und den Anbietern ab. Prüfe in der Anzeige den Unterschied zwischen:

- Suchergebnissen;
- deduplizierten Quellen;
- gelesenen Seiten.

### Deep Research ist langsam

Das ist normal: mehrere Suchanfragen und Seitenabrufe laufen nacheinander bzw. parallel. Nutze den Stop-Button, wenn du abbrechen möchtest. Bei dauerhaft langsamen oder blockierten Seiten kann ein kleinerer Modus sinnvoller sein.

### Mikrofon funktioniert nicht

- Erlaube Mikrofonzugriff für `127.0.0.1`.
- Verwende Chrome oder Edge.
- Prüfe, ob ein anderes Programm das Mikrofon exklusiv verwendet.
- Klicke zuerst manuell auf das Mikrofon- oder Wake-Word-Symbol.
- Prüfe, ob die Browser-Sprache zur gesprochenen Sprache passt.

### Fish Audio: `Failed to fetch`

- Prüfe, ob der lokale Node-Server läuft.
- Prüfe den API-Key und die Voice-ID.
- Prüfe deine Internetverbindung.
- Prüfe, ob Fish Audio den Key deaktiviert oder ein Kontingent erreicht hat.
- Öffne die Browser-Konsole nur zur Fehlersuche und veröffentliche den Key niemals.

### Fish Audio liefert Fehler 401 oder 403

Der API-Key ist ungültig, abgelaufen oder hat keine Berechtigung. Erstelle einen neuen Key und speichere ihn in den Settings.

### Kokoro startet nicht

- Prüfe `python --version`.
- Lies die Import- und Fehlermeldung von `kokoro_server.py`.
- Installiere die dort benötigten Python-Pakete in einer virtuellen Umgebung.
- Prüfe, ob die ONNX- und Voice-Dateien im erwarteten Ordner liegen.
- Stelle sicher, dass der vom Frontend erwartete Port frei und korrekt konfiguriert ist.

### Der Great-Sage-Avatar erscheint nicht

Der Avatar wird absichtlich nur angezeigt, wenn:

1. eine Great-Sage-kompatible Stimme ausgewählt ist;
2. tatsächlich Thinking oder Speech aktiv ist.

Prüfe zuerst die TTS-Engine und starte anschließend Read-aloud. Bei Browser-Stimmen bleibt der Avatar ausgeblendet.

### Port 4173 ist belegt

Wähle einen anderen Port:

```powershell
$env:PORT=3000
npm start
```

Öffne dann `http://127.0.0.1:3000`.

---

## Datenschutz und Sicherheit

- Chatverlauf, Settings und Notizen liegen standardmäßig im Browser-Local-Storage.
- Ollama-Anfragen gehen an deinen lokalen Ollama-Dienst.
- Bei aktivierter Recherche werden Suchanfragen an externe Suchanbieter geschickt.
- Bei Fish Audio wird der zu sprechende Text an Fish Audio übertragen.
- Bei Vision-Beschreibungen werden Bilddaten an dein lokales Vision-Modell geschickt; bei Cloud-Modellen gelten zusätzlich deren Datenschutzbedingungen.
- Anhänge werden lokal im Browser verarbeitet, aber ihr Inhalt wird mit der Chat-Anfrage an Ollama übertragen.
- PC-Aktionen können Programme starten oder Systeminformationen auslesen und benötigen deshalb Bestätigung.
- Veröffentliche niemals Fish-Audio-Keys, Tokens oder private Notizen.
- Wenn ein Schlüssel versehentlich veröffentlicht wurde, widerrufe ihn sofort beim Anbieter.

---

## Technischer Überblick

Die wichtigsten Dateien sind:

| Datei | Zweck |
|---|---|
| `index.html` | Oberfläche, Settings, Sidebar, Podcast- und Notes-UI, Avatar-Markup |
| `styles.css` | Layout, responsive Darstellung und Avatar-Animationen |
| `app.js` | Frontend-Zustand, Chat, Recherche, TTS, Notizen, Podcasts und PC-Aktionsdialoge |
| `server.js` | lokaler HTTP-Server, Ollama-Proxy, Recherche-Fallbacks, TTS-Proxy, Bild-Proxy und Systemaktionen |
| `kokoro_server.py` | optionaler lokaler Kokoro-TTS-Dienst |
| `overlay/` | Electron-Overlay-App (Great Sage über anderen Apps, `npm run overlay`) |
| `package.json` | npm-Skripte `start`, `dev` und `overlay` |
| `podcasts/` | lokal gespeicherte erzeugte WAV-Podcasts |

Startskripte:

```json
{
  "start": "node server.js",
  "dev": "node server.js"
}
```

Für einen normalen Start genügt daher:

```powershell
npm start
```

---

## Schnellstart in Kurzform

Wenn Node.js und Ollama bereits installiert sind:

```powershell
cd "C:\Users\andre\OneDrive\sillys\angrybirdgodai"
ollama pull hf.co/LiquidAI/LFM2.5-2.6B-GGUF:Q4_K_M
npm install
npm start
```

Dann im Browser öffnen:

```text
http://127.0.0.1:4173
```

Für die Grundfunktionen brauchst du zunächst keinen Fish-Audio-Key und kein Python. Installiere die optionalen Komponenten erst, wenn du Cloud-TTS, lokales Kokoro-TTS, Podcasts als WAV oder Vision-Bildbeschreibungen nutzen möchtest.
