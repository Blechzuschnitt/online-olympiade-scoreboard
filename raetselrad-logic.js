/* =====================================================================
   Rätselrad – reine Spiellogik (ohne Oberfläche, ohne Speicher)
   Läuft im Browser (window.RRL) und in Node (require) für die Tests.

   Buchstaben-Regeln:
   - Alles wird groß geschrieben.
   - ß zählt als „SS“ (es gibt also kein eigenes ß-Feld).
   - Ä, Ö, Ü sind eigene Buchstaben und gelten wie A, E, I, O, U als Vokale.
   - Satz- und Sonderzeichen (- ' , . ! ? usw.) sind von Anfang an sichtbar.
   - Joker: verzeiht einen Fehlversuch (falscher Buchstabe oder falsche Lösung),
     nicht aber Bankrott oder Aussetzen.
   ===================================================================== */
(function(root){
"use strict";
const ALPHA = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ"], VOWELS = [..."AEIOUÄÖÜ"];
const COLS = 14, ROWS = 4, SEGMENTS = 24;
const DEFAULTS = {rounds:3, vowelPrice:250, values:[50,100,150,200,250,300,400,500,750,1000],
  joker:true, jackpot:true, jackpotValue:2500, playerOrder:"random", puzzleOrder:"random", event:"Renntag · 5. Oktober"};

const norm = t => String(t ?? "").replace(/ß/g,"SS").replace(/ẞ/g,"SS").toUpperCase().replace(/\s+/g," ").trim();
const isLetter = c => ALPHA.includes(c);
const isVowel = c => VOWELS.includes(c);
const lettersOf = t => [...norm(t)].filter(isLetter);
const count = (t, L) => lettersOf(t).filter(c=>c===L).length;
const isSolved = (t, used) => lettersOf(t).every(c=>used.includes(c));
const consonantsLeft = (t, used) => lettersOf(t).some(c=>!isVowel(c) && !used.includes(c));
const vowelsLeft = (t, used) => lettersOf(t).some(c=>isVowel(c) && !used.includes(c));
// Lösung vergleichen: nur Buchstaben zählen, Groß/klein, Leer- und Satzzeichen egal
const sameAnswer = (guess, text) => { const g = lettersOf(guess).join(""); return g.length>0 && g===lettersOf(text).join(""); };

// Rätsel wortweise auf die Wand verteilen (Zeilen und Block mittig). null = passt nicht.
function layout(text, cols = COLS, rows = ROWS){
  const words = norm(text).split(" ").filter(Boolean);
  if(!words.length || words.some(w=>[...w].length>cols)) return null;
  const lines = []; let cur = "";
  for(const w of words){ const nxt = cur ? cur+" "+w : w; if([...nxt].length<=cols) cur = nxt; else { lines.push(cur); cur = w; } }
  lines.push(cur);
  if(lines.length>rows) return null;
  const top = Math.floor((rows-lines.length)/2);
  return Array.from({length:rows}, (_,r)=>{
    const row = Array(cols).fill(null), l = lines[r-top];
    if(l){ const ch = [...l], off = Math.floor((cols-ch.length)/2); ch.forEach((c,i)=>{ row[off+i] = c===" " ? null : c; }); }
    return row;
  });
}

// 24 Felder: Punktewerte plus gleichmäßig verteilte Sonderfelder
const gcd = (a,b) => b ? gcd(b, a%b) : a;
function segments(settings){
  const s = Object.assign({}, DEFAULTS, settings);
  const sp = [{t:"bankrott"},{t:"aussetzen"},{t:"extra"},{t:"bankrott"}];
  if(s.joker) sp.splice(2, 0, {t:"joker"});
  if(s.jackpot) sp.push({t:"jackpot", v:+s.jackpotValue || 2500});
  const V = (s.values||[]).map(Number).filter(v=>v>0); if(!V.length) V.push(100);
  const step = [7,3,11,13,1].find(k=>gcd(k, V.length)===1);          // Werte gut gemischt, keine Treppe
  const out = Array(SEGMENTS).fill(null);
  sp.forEach((x,k)=>{ out[Math.floor(k*SEGMENTS/sp.length)+1] = x; });
  let j = 0;
  return out.map(x=>x || {t:"wert", v:V[(j++*step) % V.length]});
}

function shuffle(a, rnd){ a = a.slice(); for(let i=a.length-1;i>0;i--){ const j = Math.floor(rnd()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a; }
// Nächstes Rätsel: nie doppelt in derselben Show, ungespielte bevorzugt
function pickPuzzle(puzzles, played, mode, rnd = Math.random){
  const free = puzzles.filter(p=>!played.includes(p.id) && layout(p.text));
  if(!free.length) return null;
  if(mode==="manual") return free[0];
  const fresh = free.filter(p=>!p.lastPlayed), pool = fresh.length ? fresh : free;
  return pool[Math.floor(rnd()*pool.length)];
}

function newShow(players, settings, rnd = Math.random){
  const s = Object.assign({}, DEFAULTS, settings);
  const ps = s.playerOrder==="random" ? shuffle(players, rnd) : players.slice();
  return {v:1, phase:"ready", round:0, settings:s, seq:0, ev:null, used:[], value:0, turn:0, puzzle:null, played:[],
    players:ps.map(p=>({id:p.id, name:p.name, emoji:p.emoji, round:0, total:0, jokers:0}))};
}
const clone = o => JSON.parse(JSON.stringify(o));
const ranking = show => show.players.slice().sort((a,b)=>b.total-a.total);

// Eine Aktion anwenden. Gibt {show} (neuer Zustand) oder {show, err} (unverändert) zurück.
function act(show, a){
  const S = clone(show); delete S.undo;
  const p = S.players[S.turn], s = S.settings, t = S.puzzle ? S.puzzle.text : "";
  const ev = (type, x) => { S.ev = Object.assign({id:++S.seq, type, pid:p && p.id, name:p && p.name}, x); };
  const next = () => { S.turn = (S.turn+1) % S.players.length; S.phase = "turn"; S.value = 0; };
  const win = how => { const pts = p.round; p.total += pts; S.players.forEach(x=>{ x.round = 0; }); S.phase = "solved"; S.value = 0; S.played.push(S.puzzle.id); ev("solved", {pts, how}); };
  const miss = x => { if(p.jokers>0){ p.jokers--; S.phase = "turn"; S.value = 0; ev("saved", x); } else { ev("miss", x); next(); } };
  const fail = err => ({show, err});
  const playing = ["turn","guess"].includes(S.phase);
  switch(a.type){
    case "round": {
      if(!["ready","solved"].includes(S.phase)) return fail("Die Runde läuft noch.");
      if(S.round >= s.rounds){ S.phase = "end"; ev("end"); break; }
      if(!a.puzzle) return fail("Keine Rätsel mehr übrig – lege in der Verwaltung neue an.");
      S.round++; S.puzzle = {id:a.puzzle.id, text:a.puzzle.text, cat:a.puzzle.cat||"ALLES MÖGLICHE", hint:a.puzzle.hint||""};
      S.used = []; S.value = 0; S.phase = "turn"; S.turn = (S.round-1) % S.players.length;
      S.players.forEach(x=>{ x.round = 0; });
      const q = S.players[S.turn]; ev("round", {pid:q.id, name:q.name}); break; }
    case "spin": {
      if(S.phase!=="turn") return fail("Jetzt kann nicht gedreht werden.");
      if(!consonantsLeft(t, S.used)) return fail("Keine Konsonanten mehr – kaufe einen Vokal oder löse das Rätsel.");
      const seg = segments(s)[a.idx]; if(!seg) return fail("Ungültiges Feld.");
      S.spin = {id:a.id, idx:a.idx, at:a.at, dur:a.dur, turns:a.turns, jit:a.jit};
      if(seg.t==="wert" || seg.t==="jackpot"){ S.value = seg.v; S.phase = "guess"; ev(seg.t==="jackpot" ? "jackpot" : "value", {v:seg.v}); }
      else if(seg.t==="bankrott"){ const lost = p.round; p.round = 0; ev("bankrott", {lost}); next(); }
      else if(seg.t==="aussetzen"){ ev("aussetzen"); next(); }
      else if(seg.t==="extra") ev("extra");
      else if(seg.t==="joker"){ p.jokers++; ev("joker"); }
      break; }
    case "letter": {
      const L = a.letter;
      if(!isLetter(L)) return fail("Kein gültiger Buchstabe.");
      if(!playing) return fail("Gerade ist niemand am Zug.");
      if(S.used.includes(L)) return fail(`${L} wurde schon genannt.`);
      const hits = count(t, L);
      if(isVowel(L)){
        if(S.phase!=="turn") return fail("Erst einen Konsonanten wählen.");
        if(p.round < s.vowelPrice) return fail(`Ein Vokal kostet ${s.vowelPrice} Punkte.`);
        p.round -= s.vowelPrice; S.used.push(L);
        if(!hits) miss({letter:L, vowel:true});
        else { ev("hit", {letter:L, hits, pts:-s.vowelPrice, vowel:true}); if(isSolved(t, S.used)) win("auto"); }
      } else {
        if(S.phase!=="guess") return fail("Für einen Konsonanten zuerst drehen.");
        S.used.push(L);
        if(!hits) miss({letter:L});
        else { const pts = S.value*hits; p.round += pts; S.phase = "turn"; S.value = 0; ev("hit", {letter:L, hits, pts}); if(isSolved(t, S.used)) win("auto"); }
      }
      break; }
    case "solve": {
      if(S.phase!=="turn") return fail("Lösen geht nur, bevor gedreht wurde.");
      const ok = typeof a.correct==="boolean" ? a.correct : sameAnswer(a.guess, t);
      if(ok){ lettersOf(t).forEach(c=>{ if(!S.used.includes(c)) S.used.push(c); }); win("solve"); }
      else miss({solve:true, guess:a.guess||""});
      break; }
    /* --- Spielleitung --- */
    case "skip": if(!playing) return fail("Gerade ist niemand am Zug."); ev("skip"); next(); break;
    case "adjust": {
      const x = S.players.find(x=>x.id===a.pid), f = a.field==="total" ? "total" : "round"; if(!x) return fail("Spieler nicht gefunden.");
      x[f] = Math.max(0, x[f] + (+a.delta||0)); ev("adjust", {pid:x.id, name:x.name, delta:+a.delta, field:f}); break; }
    case "reveal": {
      const L = a.letter;
      if(!S.puzzle || !isLetter(L) || S.used.includes(L)) return fail("Dieser Buchstabe kann nicht aufgedeckt werden.");
      S.used.push(L); ev("reveal", {letter:L, hits:count(t, L)}); break; }
    case "finish": S.phase = "end"; ev("end"); break;
    default: return fail("Unbekannte Aktion.");
  }
  return {show:S};
}

const API = {ALPHA, VOWELS, COLS, ROWS, SEGMENTS, DEFAULTS, norm, isLetter, isVowel, lettersOf, count, isSolved, consonantsLeft, vowelsLeft,
  sameAnswer, layout, segments, shuffle, pickPuzzle, newShow, act, ranking};
if(typeof module!=="undefined" && module.exports) module.exports = API; else root.RRL = API;
})(typeof window!=="undefined" ? window : globalThis);
