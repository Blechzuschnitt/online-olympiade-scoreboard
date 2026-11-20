/* =====================================================================
   Glückssträhne – reine Spiellogik (ohne Oberfläche), testbar mit Node
   Regeln:
   - Stapel: Zahlen 0–12, jede Zahl so oft wie ihr Wert (0 einmal),
     Booster +2/+4/+6/+8/+10 und ×2, je 3× Schutzschild, Stopp, Zugzwang.
   - Reihum: Karte ziehen oder sichern (sichern geht ab der ersten Karte).
   - Doppelte Zahl = raus, 0 Punkte – außer man hat einen Schutzschild.
   - 7 verschiedene Zahlen = Runde endet sofort, +15 Bonus.
   - Stopp: ein aktiver Spieler (auch man selbst) muss sofort sichern.
   - Zugzwang: ein aktiver Spieler muss sofort 2 Karten ziehen.
   - Punkte: Zahlensumme (×2 verdoppelt nur die Zahlen) + Booster + Bonus.
   - Wer nach einer Runde das Ziel (Standard 200) erreicht, beendet das Spiel.
   ===================================================================== */
(function(root){
"use strict";
const SEVEN_BONUS = 15, BOOSTS = ["p2","p4","p6","p8","p10","x2"], ACTIONS = ["S","F","Z"];
const kind = k => k[0]==="n" ? "num" : (k[0]==="p" || k==="x2") ? "boost" : "action";
const val = k => +k.slice(1);
function makeDeck(){
  const d = []; let i = 0; const add = k => d.push({k, id:"c"+(i++)});
  for(let n=0;n<=12;n++) for(let c=0;c<Math.max(1,n);c++) add("n"+n);
  BOOSTS.forEach(add); ACTIONS.forEach(k=>{ for(let j=0;j<3;j++) add(k); });
  return d;
}
function shuffle(a, rnd){ a = a.slice(); for(let i=a.length-1;i>0;i--){ const j = Math.floor(rnd()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a; }
const numbers = row => row.filter(c=>kind(c.k)==="num").map(c=>val(c.k));
function rowScore(p){
  if(p.status==="bust") return 0;
  const ns = numbers(p.row);
  let s = ns.reduce((a,b)=>a+b, 0);
  if(p.row.some(c=>c.k==="x2")) s *= 2;
  s += p.row.filter(c=>c.k[0]==="p").reduce((a,c)=>a+val(c.k), 0);
  if(new Set(ns).size>=7) s += SEVEN_BONUS;
  return s;
}
const clone = o => JSON.parse(JSON.stringify(o));
const actives = S => S.players.filter(p=>p.status==="in");
function nextActive(S, from){
  const n = S.players.length;
  for(let i=1;i<=n;i++){ const j = (from+i) % n; if(S.players[j].status==="in") return j; }
  return from;
}

function newGame(players, target, rnd = Math.random){
  return {v:1, phase:"play", round:1, target:target||200, dealer:0, turn:0, seq:1, ev:{id:1, items:[{type:"start"}]},
    deck:shuffle(makeDeck(), rnd), discard:[], pending:null, forced:null, queue:[], advanceFrom:null, last:null,
    players:players.map(p=>({id:p.id, name:p.name, total:0, row:[], status:"in", shield:false}))};
}

// eine Karte für Spieler p ziehen und sofort auswerten
function drawFor(S, p, rnd, items){
  if(!S.deck.length){ S.deck = shuffle(S.discard, rnd); S.discard = []; }
  const c = S.deck.pop(); if(!c) return;
  const t = kind(c.k);
  if(t==="num"){
    const n = val(c.k);
    if(numbers(p.row).includes(n)){
      if(p.shield){                                   // Schutzschild fängt die doppelte Zahl ab
        p.shield = false; const si = p.row.findIndex(x=>x.k==="S");
        S.discard.push(c, ...p.row.splice(si, 1)); items.push({type:"shield", pid:p.id, card:c});
      } else { p.row.push(c); p.status = "bust"; items.push({type:"bust", pid:p.id, card:c}); }
      return;
    }
    p.row.push(c); items.push({type:"card", pid:p.id, card:c});
    if(new Set(numbers(p.row)).size>=7){ p.status = "seven"; items.push({type:"seven", pid:p.id}); }
  } else if(t==="boost"){ p.row.push(c); items.push({type:"card", pid:p.id, card:c}); }
  else if(c.k==="S"){
    if(p.shield) S.discard.push(c); else { p.shield = true; p.row.push(c); }
    items.push({type:"card", pid:p.id, card:c});
  } else { S.discard.push(c); S.queue.push({type:c.k, from:p.id}); items.push({type:"card", pid:p.id, card:c}); }
}
function applyAction(S, type, t, by, items){
  if(type==="F"){ t.status = "stay"; items.push({type:"stopp", pid:t.id, by}); }
  else { S.forced = {pid:t.id, left:2}; items.push({type:"zugzwang", pid:t.id, by}); }
}
function endRound(S, items){
  const scores = S.players.map(rowScore);
  S.players.forEach((p,i)=>{ p.total += scores[i]; });
  S.last = {round:S.round, scores, status:S.players.map(p=>p.status)};
  S.pending = S.forced = null; S.queue = []; S.advanceFrom = null;
  const top = Math.max(...S.players.map(p=>p.total));
  S.phase = top>=S.target ? "over" : "roundEnd";
  items.push({type:S.phase==="over" ? "over" : "roundEnd"});
}
// alles Ausstehende abarbeiten: Zugzwang-Karten, Aktionskarten, Zugwechsel, Rundenende
function resolve(S, rnd, items){
  for(let guard=0; guard<200; guard++){
    if(S.players.some(p=>p.status==="seven")) return endRound(S, items);
    if(S.forced){
      const t = S.players.find(p=>p.id===S.forced.pid);
      if(t.status==="in" && S.forced.left>0){ S.forced.left--; drawFor(S, t, rnd, items); continue; }
      S.forced = null; continue;
    }
    if(S.pending) return;
    if(S.queue.length){
      const q = S.queue.shift(), act = actives(S);
      if(!act.length) continue;
      if(act.length===1){ applyAction(S, q.type, act[0], q.from, items); continue; }
      S.pending = q; return;                          // Ziehende Person wählt das Ziel
    }
    break;
  }
  if(!actives(S).length) return endRound(S, items);
  const from = S.advanceFrom!=null ? S.advanceFrom : S.turn;
  if(S.advanceFrom!=null || S.players[S.turn].status!=="in") S.turn = nextActive(S, from);
  S.advanceFrom = null;
}

// Aktion anwenden → {state} oder {state, err} (unverändert)
function act(state, a, rnd = Math.random){
  const S = clone(state), items = [], fail = err => ({state, err});
  const p = S.players[S.turn];
  switch(a.type){
    case "draw":
      if(S.phase!=="play" || S.pending || S.forced) return fail("Jetzt kann nicht gezogen werden.");
      if(p.status!=="in") return fail("Du bist in dieser Runde schon raus.");
      S.advanceFrom = S.turn; drawFor(S, p, rnd, items); resolve(S, rnd, items); break;
    case "stay":
      if(S.phase!=="play" || S.pending || S.forced) return fail("Jetzt kann nicht gesichert werden.");
      if(!p.row.length) return fail("Erst eine Karte ziehen.");
      p.status = "stay"; items.push({type:"stay", pid:p.id});
      S.advanceFrom = S.turn; resolve(S, rnd, items); break;
    case "choose": {
      if(!S.pending) return fail("Gerade ist nichts zu wählen.");
      const t = S.players.find(x=>x.id===a.pid);
      if(!t || t.status!=="in") return fail("Diese Person ist nicht mehr im Spiel.");
      const q = S.pending; S.pending = null; applyAction(S, q.type, t, q.from, items); resolve(S, rnd, items); break; }
    case "next":
      if(S.phase!=="roundEnd") return fail("Die Runde läuft noch.");
      S.players.forEach(x=>{ S.discard.push(...x.row); x.row = []; x.status = "in"; x.shield = false; });
      S.round++; S.dealer = (S.dealer+1) % S.players.length; S.turn = S.dealer; S.phase = "play";
      items.push({type:"round"}); break;
    default: return fail("Unbekannte Aktion.");
  }
  S.seq++; S.ev = {id:S.seq, items};
  return {state:S};
}
const ranking = S => S.players.slice().sort((a,b)=>b.total-a.total);

const API = {SEVEN_BONUS, kind, val, makeDeck, shuffle, numbers, rowScore, newGame, act, ranking};
if(typeof module!=="undefined" && module.exports) module.exports = API; else root.GSL = API;
})(typeof window!=="undefined" ? window : globalThis);
