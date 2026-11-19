# Nelskamp Olympiade

Eine Familien-Olympiade im Las-Vegas-Look: Spiele sammeln, ins Glücksrad legen, Spieler wählen, Olympiade erstellen und Runde für Runde um Medaillen spielen. Alles steckt in einer einzigen HTML-Datei, ohne Build-Schritt und ohne Abhängigkeiten.

**Live:** https://blechzuschnitt.github.io/online-olympiade-scoreboard/

## So funktioniert's

1. **Spiele sammeln:** Unter „Spiele“ einen Link einfügen. Das Spiel wird automatisch mit Name und Icon hinzugefügt, bei bekannten Seiten wie skribbl.io, Kahoot oder TETR.IO sogar mit passender Beschreibung. Mit ✏️ lassen sich Name, Icon, Link und „zählt doppelt (×2)“ ändern.
2. **Ins Glücksrad legen:** Bei jedem Spiel auf „+ Ins Rad“ tippen.
3. **Spieler wählen:** Unter „Wer spielt mit?“ Spieler an- und abwählen oder neue hinzufügen.
4. **Olympiade erstellen:** Dafür braucht es mindestens 1 Spiel im Rad und 2 Spieler.
5. **Spielen:** SPIN dreht das Rad. Alternativ tippst du ein Spiel unter „Im Rad“ direkt an. Danach die Spieler in der Reihenfolge ihrer Platzierung antippen und die Runde speichern.
6. **Beenden:** „Olympiade beenden“ verschiebt sie ins Archiv.

Der Würfel oben rechts im Glücksrad-Rahmen würfelt eine Zahl von 1 bis 6.

**Wertung:** 🥇 3 · 🥈 2 · 🥉 1 Punkte. Runden mit ×2 zählen doppelt. Gespielte Spiele fallen aus dem Rad.

## Gespielte Runden

- Log aller Runden der laufenden Olympiade mit Platzierungen, Punkten und Uhrzeit. Eine falsch eingetragene Runde lässt sich löschen.
- Statistiken: gespielte Runden, Führender, meiste Siege, verbleibende Spiele
- Archiv aller beendeten Olympiaden und eine **Ewige Tabelle** mit Titeln, Goldmedaillen und Punkten über alle Olympiaden

## Speicherung

- **Auf GitHub Pages oder lokal:** Alles wird im Browser des jeweiligen Geräts gespeichert (`localStorage`). Es bleibt nach dem Neuladen erhalten, wird aber nicht mit anderen Geräten geteilt.
- **Als Claude-Artifact:** Über `claude.use("db")` wird alles live mit allen Zuschauern synchronisiert.
