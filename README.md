# Nelskamp Olympiade

Eine Familien-Olympiade im Las-Vegas-Look: Spiele sammeln, ins Glücksrad legen, Spieler wählen, Olympiade erstellen und Runde für Runde um Medaillen spielen. Alles steckt in einer einzigen HTML-Datei, ohne Build-Schritt und ohne Abhängigkeiten.

**Live:** https://blechzuschnitt.github.io/online-olympiade-scoreboard/

## So funktioniert's

1. **Spiele sammeln:** Unter „Spiele“ einen Link einfügen. Das Spiel erscheint in der Liste mit Originalnamen, 🔗-Link und kleinem Vorschaubild (über microlink.io, ersatzweise das Seiten-Icon). Mit ✏️ lassen sich Name, Icon, Beschreibung, Link und „zählt doppelt (×2)“ ändern.
2. **Ins Glücksrad legen:** Bei jedem Spiel auf „+ Ins Rad“ tippen. Mit dem ☆ im Vorschaubild markierst du Favoriten, sie stehen dann oben in der Liste.
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

Der Spielstand liegt online in **Supabase** (Tabelle `public.olympiade_state`, Zeile `nelskamp`) und wird live auf alle Geräte synchronisiert. Oben im Schild zeigt die Anzeige „Live – für alle synchron“, ob die Verbindung steht.

- Jedes Gerät hält zusätzlich eine lokale Kopie (`localStorage`). Ohne Verbindung läuft die Seite also weiter, dann allerdings nur auf diesem Gerät.
- Der Schlüssel im Code ist ein öffentlicher *publishable key*. Per Row Level Security darf er nur die Zeile `nelskamp` lesen und deren Spalte `data` ändern. Anlegen, Löschen und alle anderen Tabellen des Projekts sind gesperrt.
- Wer die Seiten-Adresse kennt, kann den Spielstand ändern. Für eine Familienrunde ist das gewollt.

## Spiele-Sammlung (PDF)

Ganz unten in der App gibt es `spiele-sammlung.pdf`: die deutsche Fassung einer öffentlichen Liste mit 225 kostenlosen Browserspielen (Original von „nia“, Stand 2020). Das PDF hat ein anklickbares Inhaltsverzeichnis, PDF-Lesezeichen, ein Stichwortverzeichnis mit deutschen Spielnamen und durchsuchbaren Text. Alle Links wurden am 19.11.2026 geprüft, nicht mehr erreichbare sind grau markiert.

## Lucky Lines – unser eigenes Würfelspiel

`lucky-lines.html` ist ein Kreuzchen-Würfelspiel nur für uns (2 weiße + 4 farbige Würfel, vier Reihen, Schlösser, Fehlwürfe) im Spieltisch-Look mit 3D-Würfeln und Würfelgeräusch (abschaltbar).
Jede Person öffnet die Seite auf dem eigenen Handy und tippt auf ihren Namen – alles läuft live über Supabase
(Zeilen `ll-tisch` und `ll-s1` … `ll-s6` in `olympiade_state`). Ohne Verbindung geht „Alle an diesem Gerät“.

Varianten: Klassisch, Farbenmix, Zahlenmix, Doppel-Mix, Bonusreihen, dazu zuschaltbar „Kurzes Spiel“.
Die vollständigen Regeln stehen auf der Spielseite unter „Spielregeln & Varianten“.

Extras: Ansagen bei Sperren, Fehlwürfen und Spielende auf allen Geräten · Statistik (Siege, Bestwerte, Rekorde, letzte Partien)
· „Revanche“ mit denselben Leuten · „In die Olympiade übernehmen“ trägt die Platzierung als Runde (3/2/1 Punkte, ggf. ×2) ein.
KI-Gegner: beim Start 1–2 Computer-Mitspieler (🤖 Robo, 🦉 Ada) dazunehmen, Stärke „Locker“ oder „Clever“. Gesteuert werden sie vom Gerät, das das Spiel gestartet hat (ist es weg, übernimmt nach ~10 s ein anderes).
