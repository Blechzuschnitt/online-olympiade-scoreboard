# Online-Olympiade Scoreboard

Ein Scoreboard für eine Online-Olympiade mit mehreren Teams und Disziplinen. Es besteht aus einer einzigen HTML-Datei und braucht weder Build-Schritt noch Abhängigkeiten.

## Funktionen

- Podium mit Gold, Silber und Bronze
- Gesamtwertung, automatisch sortiert
- Punktetabelle pro Disziplin mit Summenspalte
- Bearbeiten-Modus: Teams (Emoji und Name) und Disziplinen hinzufügen, umbenennen oder entfernen, Punkte eintragen, alle Punkte zurücksetzen

Vorbelegt sind drei Teams (Rot, Blau, Grün) und acht Disziplinen, vom „Zeichnen & Raten“ bis zum „Dino-Finale“.

**Wertung:** 3 = Gold, 2 = Silber, 1 = Bronze. Das Finale zählt doppelt, die Punkte dafür trägst du einfach doppelt ein.

## Nutzung

`index.html` im Browser öffnen, fertig.

## Hinweis zum Live-Sync

Ursprünglich lief das Scoreboard als Claude-Artifact. Dort werden die Punkte über einen gemeinsamen Speicher (`claude.use("db")`) live mit allen Zuschauern synchronisiert.

Außerhalb von Claude, zum Beispiel lokal oder auf GitHub Pages, gibt es diesen Speicher nicht. Dann läuft die Seite nur lokal: Eingaben gelten bis zum Neuladen und werden nicht geteilt. Unten auf der Seite erscheint dazu ein Hinweis.
