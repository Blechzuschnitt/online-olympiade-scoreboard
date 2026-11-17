# Online-Olympiade Scoreboard

Ein Scoreboard für die Familien-Olympiade von Yana, Noah und Papa. Es besteht aus einer einzigen HTML-Datei und braucht weder Build-Schritt noch Abhängigkeiten.

**Live:** https://blechzuschnitt.github.io/online-olympiade-scoreboard/

## Funktionen

- Podium mit Gold, Silber und Bronze, der Spitzenreiter bekommt eine Krone
- Gesamtwertung mit Fortschrittsbalken
- Punktetabelle pro Disziplin mit Medaillen-Farben
- Glücksrad, das das nächste Spiel auslost (auf Wunsch nur Spiele ohne Punkte)
- Übersicht aller Spiele mit Links: Tippen öffnet das Spiel in einem neuen Tab, dazu wird angezeigt, wer die Disziplin gewonnen hat
- Bearbeiten-Modus: Spieler (Emoji und Name), Disziplinen und Spiele-Links ändern, Punkte eintragen, alles zurücksetzen

## Die Spiele

| # | Disziplin | Spiel |
|---|---|---|
| 1 | Zeichnen & Raten | [skribbl.io](https://skribbl.io) |
| 2 | Wortschlacht | [Stadt Land Fluss online](https://stadtlandflussonline.net) |
| 3 | Wissensquiz | [Kahoot](https://kahoot.it) |
| 4 | Geo-Duell | [OpenGuessr](https://openguessr.com) |
| 5 | Tetris-Sprint | [TETR.IO](https://tetr.io) |
| 6 | Tipp-Rennen | [TypeRacer](https://play.typeracer.com) |
| 7 | Wikipedia-Rennen | [The Wiki Game](https://www.thewikigame.com) |
| 8 | Dino-Finale (zählt doppelt) | [Chrome Dino](https://chromedino.com) |

**Wertung:** 3 = Gold, 2 = Silber, 1 = Bronze. Das Finale zählt doppelt, die Punkte dafür trägst du einfach doppelt ein.

## Speicherung

- **Als Claude-Artifact:** Die Punkte werden über `claude.use("db")` live mit allen Zuschauern synchronisiert.
- **Auf GitHub Pages oder lokal:** Die Punkte werden im Browser des jeweiligen Geräts gespeichert (`localStorage`). Sie bleiben dort auch nach dem Neuladen erhalten, werden aber nicht mit anderen geteilt.
