/* =====================================================================
   Glückssträhne – reine Spiellogik (ohne Oberfläche), testbar mit Node
   GRUNDSPIEL
   - Stapel: Zahlen 0–12 (jede so oft wie ihr Wert, 0 einmal), Booster +2…+10 und ×2,
     je 3× Rettungsanker, Stopp, Zugzwang.
   - Reihum ziehen oder sichern. Doppelte Zahl = raus (0 Punkte), außer mit Rettungsanker.
   - 7 verschiedene Zahlen beenden die Runde sofort: +15. Ziel: 100/150/200 Punkte.
   ERWEITERUNG „Sabotage & Sonderrechte“ (je 1×): Kartenklau, Doppel oder nichts, Reset,
     Spiegel, Schutzschild, Rückwärtsgang, Kamikaze.
   ERWEITERUNG „APOKALYPSE“: eine Katastrophe pro Runde (nach einem vollen Umlauf oder
     2 Ausgeschiedenen), seltene Mutationskarten und DER RISS.
   Festgelegte Auslegungen (für den Prototyp):
   - Kartenklau tauscht automatisch deine niedrigste gegen die höchste Zahl des Ziels,
     ohne dabei doppelte Zahlen zu erzeugen. Bürgerkrieg/Meteorit nehmen die zuletzt
     gelegte Karte; eine weitergereichte Doppelte wird abgeworfen statt rauszuwerfen.
   - Schwerkraft: Zahlen zählen umgekehrt (0 = 12 Punkte … 12 = 0).
   - Joker der Hölle rettet automatisch: eine doppelte Zahl wird um ±1 verändert.
   - Parasit wächst auf deiner niedrigsten Zahl. Doppelgänger zeigt nur den Vergleich.
   ===================================================================== */
(function(root){
"use strict";
const SEVEN_BONUS = 15, BOOSTS = ["p2","p4","p6","p8","p10","x2"];
const BASE_ACTIONS = ["S","F","Z"], SABOTAGE = ["K","D","R","M","G","B","X"];
const MUTATIONS = ["uP","uD","uJ","uF","uU","uV"], CATS = ["blackout","inflation","buergerkrieg","zeitbombe","schwerkraft","virus","chaos","revolution","meteorit","weltuntergang"];
const RISS = ["offen","verzerrt","zeitbruch"];
const NEEDS = {F:"player", Z:"player", X:"other", K:"other", R:"own", uF:"other", uV:"other"};   // wer/was gewählt werden muss
const kind = k => k[0]==="n" ? "num" : (k[0]==="p" || k==="x2") ? "boost" : k[0]==="u" ? "mut" : k==="Q" ? "riss" : "action";
const val = k => +k.slice(1);
const cval = c => c.v!=null ? c.v : val(c.k);                       // Joker der Hölle kann den Wert ändern
function makeDeck(opts = {}){
  const d = []; let i = 0; const add = k => d.push({k, id:"c"+(i++)});
  for(let n=0;n<=12;n++) for(let c=0;c<Math.max(1,n);c++) add("n"+n);
  BOOSTS.forEach(add); BASE_ACTIONS.forEach(k=>{ for(let j=0;j<3;j++) add(k); });
  if(opts.sabotage) SABOTAGE.forEach(add);
  if(opts.apokalypse){ MUTATIONS.forEach(add); add("Q"); }
  return d;
}
function shuffle(a, rnd){ a = a.slice(); for(let i=a.length-1;i>0;i--){ const j = Math.floor(rnd()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a; }
const numCards = row => row.filter(c=>kind(c.k)==="num");
const numbers = row => numCards(row).map(cval);
const clone = o => JSON.parse(JSON.stringify(o));
const actives = S => S.players.filter(p=>p.status==="in");
const pl = (S, id) => S.players.find(p=>p.id===id);
function nextActive(S, from){
  const n = S.players.length;
  for(let i=1;i<=n;i++){ const j = (from+i) % n; if(S.players[j].status==="in") return j; }
  return from;
}

// Rundenwert eines Spielers (ohne Verräter-Vergleich, der braucht alle)
function rowScore(p, S){
  if(p.status==="bust") return 0;
  const m = (S && S.mods) || {};
  let ns = numbers(p.row);
  if(m.offen) ns = [...new Set(ns)];                                  // Riss: Doppelte sind wertlos
  let s = ns.reduce((a,n)=>a + (m.schwerkraft ? 12-n : n), 0);
  if(p.muts && p.muts.P) s += p.muts.P.plus;                          // Parasit
  if(p.row.some(c=>c.k==="x2")) s *= 2;
  s += p.row.filter(c=>c.k[0]==="p").reduce((a,c)=>a+val(c.k), 0);
  if(new Set(numbers(p.row)).size>=7) s += SEVEN_BONUS;
  if(p.double && p.volStay) s *= 2;                                   // Doppel oder nichts
  if(m.revol && m.revol.includes(p.id)) s -= 3;
  if(p.survivor) s += 3;
  if(m.inflation) s *= 2;
  return Math.max(0, s);
}

function newGame(players, target, rnd = Math.random, opts = {}){
  const o = {sabotage:!!opts.sabotage, apokalypse:!!opts.apokalypse};
  return {v:2, gid:Math.floor(rnd()*2e9).toString(36) + Date.now().toString(36), opts:o, phase:"play", round:1, target:target||200, dealer:0, turn:0, seq:1, ev:{id:1, items:[{type:"start"}]},
    deck:shuffle(makeDeck(o), rnd), discard:[], cats:o.apokalypse ? shuffle(CATS, rnd) : [],
    pending:null, forced:null, queue:[], advanceFrom:null, last:null, lastAction:null,
    cat:null, mods:{}, turns:0, blackout:[], host:opts.host||null,
    players:players.map(p=>({id:p.id, name:p.name, bot:p.bot||null, total:0, row:[], status:"in", anchor:false, guard:false, double:false, volStay:false, cursed:false, muts:{}}))};
}

/* ---------- Ziehen ---------- */
function take(S, rnd){ if(!S.deck.length){ S.deck = shuffle(S.discard, rnd); S.discard = []; } return S.deck.pop(); }
function placeNumber(S, p, c, items){
  const n = cval(c), have = numbers(p.row);
  if(have.includes(n) && !S.mods.offen){
    if(p.muts.J===1){                                                  // Joker der Hölle: Wert ±1
      const alt = [n+1, n-1].find(x=>x>=0 && x<=12 && !have.includes(x));
      if(alt!=null){ c.v = alt; p.muts.J = 0; p.row.push(c); items.push({type:"joker", pid:p.id, from:n, to:alt}); return afterNumber(S, p, items); }
    }
    if(p.anchor){
      p.anchor = false; const ai = p.row.findIndex(x=>x.k==="S");
      S.discard.push(c, ...p.row.splice(ai, 1)); items.push({type:"anchor", pid:p.id, card:c}); return;
    }
    p.row.push(c); p.status = "bust"; items.push({type:"bust", pid:p.id, card:c}); return;
  }
  p.row.push(c); items.push({type:"card", pid:p.id, card:c});
  afterNumber(S, p, items);
}
function afterNumber(S, p, items){ if(new Set(numbers(p.row)).size>=7){ p.status = "seven"; items.push({type:"seven", pid:p.id}); } }

function drawFor(S, p, rnd, items, depth = 0){
  const c = take(S, rnd); if(!c) return;
  const t = kind(c.k);
  if(t==="num"){
    if(S.mods.virus!=null && val(c.k)===S.mods.virus && depth<3){   // Virus: Karte ab, Ersatz ziehen
      S.discard.push(c); items.push({type:"virus", pid:p.id, card:c}); return drawFor(S, p, rnd, items, depth+1);
    }
    return placeNumber(S, p, c, items);
  }
  items.push({type:"card", pid:p.id, card:c});
  // Ausgespielte Sonderkarten bleiben bis Rundenende sichtbar beim Spieler liegen (nur Anzeige)
  if(t!=="boost" && c.k!=="D" && !(c.k==="S" && !p.anchor)) (p.used = p.used || []).push({k:c.k, id:c.id});
  if(t==="boost") return void p.row.push(c);
  if(t==="mut"){ S.discard.push(c); return mutate(S, p, c.k, items); }
  if(t==="riss"){ S.discard.push(c); return riss(S, rnd, items); }
  if(c.k==="S"){ if(p.anchor) S.discard.push(c); else { p.anchor = true; p.row.push(c); } return; }
  if(c.k==="D"){ p.double = true; p.row.push(c); return; }
  if(c.k==="G"){ S.discard.push(c); p.guard = true; items.push({type:"guard", pid:p.id}); return; }
  S.discard.push(c);
  if(c.k==="M"){                                                      // Spiegel kopiert die letzte Aktion
    if(!S.lastAction) return void items.push({type:"mirror", pid:p.id, copy:null});
    items.push({type:"mirror", pid:p.id, copy:S.lastAction});
    return queueAction(S, S.lastAction, p, items);
  }
  queueAction(S, c.k, p, items);
}
function queueAction(S, k, p, items){
  S.lastAction = k;
  if(k==="B"){                                                        // Rückwärtsgang trifft automatisch den Nächsten
    const j = nextActive(S, S.players.indexOf(p)), t = S.players[j];
    if(t===p || t.guard || !t.row.length) return void items.push({type:"rueck", pid:t.id, by:p.id, none:true});
    const back = t.row.pop();
    if(back.k==="S") t.anchor = false; if(back.k==="D") t.double = false;
    delete back.v; S.deck.splice(Math.floor(S.deck.length/2), 0, back);
    items.push({type:"rueck", pid:t.id, by:p.id}); S.forcedQ = (S.forcedQ||[]).concat({pid:t.id, left:1});
    return;
  }
  S.queue.push({type:k, from:p.id});
}
function mutate(S, p, k, items){
  const m = k.slice(1);
  if(m==="P"){ const low = numCards(p.row).sort((a,b)=>cval(a)-cval(b))[0]; p.muts.P = {cid:low ? low.id : null, plus:0}; }
  else if(m==="J") p.muts.J = 1;
  else if(m==="U") p.muts.U = true;
  else if(m==="D") p.muts.D = true;
  else return void S.queue.push({type:k, from:p.id});                // Fluch / Verräter: Ziel wählen
  items.push({type:"mut", pid:p.id, m});
}

/* ---------- Auswahl & Aktionen ---------- */
function targets(S, q){
  const need = NEEDS[q.type], from = pl(S, q.from);
  if(need==="own") return from.row.filter(c=>c.k!=="D").map(c=>c.id);
  const pool = need==="other" ? S.players.filter(x=>x.id!==q.from) : S.players;
  return pool.filter(x=>(q.type==="uV" || x.status==="in") && (x.id===q.from || !x.guard)).map(x=>x.id);
}
function applyAction(S, q, target, rnd, items){
  const by = q.from, from = pl(S, by);
  switch(q.type){
    case "F": { const t = pl(S, target); t.status = "stay"; t.volStay = false; items.push({type:"stopp", pid:t.id, by}); break; }
    case "Z": S.forcedQ = (S.forcedQ||[]).concat({pid:target, left:2}); items.push({type:"zugzwang", pid:target, by}); break;
    case "X": S.forcedQ = (S.forcedQ||[]).concat({pid:target, left:1}); items.push({type:"kamikaze", pid:target, by}); break;
    case "K": {
      const t = pl(S, target), mine = numCards(from.row).sort((a,b)=>cval(a)-cval(b)), theirs = numCards(t.row).sort((a,b)=>cval(b)-cval(a));
      let done = null;
      for(const a of mine){ for(const b of theirs){
        const mineAfter = numbers(from.row.filter(c=>c!==a)), theirsAfter = numbers(t.row.filter(c=>c!==b));
        if(!mineAfter.includes(cval(b)) && !theirsAfter.includes(cval(a)) && cval(b)>cval(a)){ done = [a,b]; break; } } if(done) break; }
      if(done){ const [a,b] = done; from.row[from.row.indexOf(a)] = b; t.row[t.row.indexOf(b)] = a; items.push({type:"klau", pid:t.id, by, give:cval(a), got:cval(b)}); afterNumber(S, from, items); }
      else items.push({type:"klau", pid:t.id, by, none:true});
      break; }
    case "R": {
      const i = from.row.findIndex(c=>c.id===target); if(i<0) break;
      const [c] = from.row.splice(i, 1); if(c.k==="S") from.anchor = false; delete c.v; S.discard.push(c);
      items.push({type:"reset", pid:by, card:c}); drawFor(S, from, rnd, items); break; }
    case "uF": pl(S, target).cursed = true; items.push({type:"mut", pid:by, m:"F", target}); break;
    case "uV": from.muts.V = target; items.push({type:"mut", pid:by, m:"V", target}); break;
  }
}

/* ---------- Katastrophen & Riss ---------- */
function catastrophe(S, rnd, items){
  const k = S.cats.length ? S.cats.shift() : null; if(!k) return;
  S.catDone = true; S.cat = {k}; items.push({type:"cat", k});
  const act = actives(S);
  switch(k){
    case "blackout": S.blackout = act.map(p=>p.id); break;
    case "inflation": S.mods.inflation = true; break;
    case "schwerkraft": S.mods.schwerkraft = true; break;
    case "zeitbombe": S.mods.bombe = 3; break;
    case "virus": S.mods.virus = Math.floor(rnd()*13); S.cat.n = S.mods.virus; break;
    case "chaos": act.forEach(p=>{ if(p.status==="in") drawFor(S, p, rnd, items); }); break;
    case "revolution": {
      const sc = S.players.filter(p=>p.status!=="bust").map(p=>[p.id, rowScore(p, S)]), top = Math.max(...sc.map(x=>x[1]));
      S.mods.revol = sc.filter(x=>x[1]===top).map(x=>x[0]); S.cat.who = S.mods.revol; break; }
    case "meteorit": act.forEach(p=>{ const c = p.row.pop(); if(c){ if(c.k==="S") p.anchor = false; if(c.k==="D") p.double = false; delete c.v; S.discard.push(c); } }); break;
    case "buergerkrieg": {
      if(act.length<2) break;
      const give = act.map(p=>p.row.length ? p.row.pop() : null);
      act.forEach((p,i)=>{ const c = give[(i-1+act.length) % act.length]; if(!c) return;
        if(c.k==="S" && p.row.some(x=>x.k==="S")){ S.discard.push(c); return; }
        if(kind(c.k)==="num" && numbers(p.row).includes(cval(c))){ S.discard.push(c); return; }  // Doppelte wird abgeworfen
        p.row.push(c); if(kind(c.k)==="num") afterNumber(S, p, items); });
      act.forEach(p=>{ p.anchor = p.row.some(x=>x.k==="S"); p.double = p.row.some(x=>x.k==="D"); });
      break; }
    case "weltuntergang": S.endNow = true; break;
  }
}
function riss(S, rnd, items){
  const sub = RISS[Math.floor(rnd()*RISS.length)];
  S.mods = {revol:S.mods.revol}; S.blackout = [];                     // ersetzt die bisherige Katastrophe
  S.cat = {k:"riss", sub}; items.push({type:"riss", sub});
  if(sub==="offen") S.mods.offen = true;
  if(sub==="zeitbruch") S.mods.zeit = actives(S).length;
  if(sub==="verzerrt"){
    const live = S.players.filter(p=>p.status!=="bust"); if(live.length<2) return;
    const sc = live.map(p=>({p, s:rowScore(p, S), r:rnd()})).sort((a,b)=>b.s-a.s || a.r-b.r);
    const hi = sc[0].p, lo = sc[sc.length-1].p;
    [hi.row, lo.row] = [lo.row, hi.row]; [hi.anchor, lo.anchor] = [lo.anchor, hi.anchor]; [hi.double, lo.double] = [lo.double, hi.double];
    items.push({type:"swap", a:hi.id, b:lo.id});
  }
}

/* ---------- Ablauf ---------- */
function endRound(S, items){
  const alive = S.players.filter(p=>p.status!=="bust");
  if(alive.length===1 && alive[0].muts.U && S.players.length>1) alive[0].survivor = true;   // Überlebender
  let scores = S.players.map(p=>rowScore(p, S));
  scores = scores.map((s,i)=>{ const v = S.players[i].muts.V; if(v==null) return s;          // Verräter
    const j = S.players.findIndex(x=>x.id===v); return j>=0 && s>scores[j] ? s : 0; });
  S.players.forEach((p,i)=>{ p.total += scores[i]; });
  S.last = {round:S.round, scores, status:S.players.map(p=>p.status), cat:S.cat};
  S.pending = S.forced = null; S.forcedQ = []; S.queue = []; S.advanceFrom = null; S.endNow = false;
  const top = Math.max(...S.players.map(p=>p.total));
  S.phase = top>=S.target ? "over" : "roundEnd";
  items.push({type:S.phase==="over" ? "over" : "roundEnd"});
}
function afterTurn(S, p, rnd, items){
  S.turns++;
  if(p.muts.P && p.status!=="bust") p.muts.P.plus++;                 // Parasit wächst
  S.blackout = S.blackout.filter(x=>x!==p.id);
  p.cursed = false;
  if(S.mods.zeit!=null && --S.mods.zeit<=0) S.endNow = true;          // Zeitbruch
  if(S.mods.bombe!=null && --S.mods.bombe<=0){ delete S.mods.bombe; items.push({type:"bombe"}); actives(S).forEach(x=>drawFor(S, x, rnd, items)); }
  if(S.opts.apokalypse && !S.catDone && (S.turns>=S.players.length || S.players.filter(x=>x.status==="bust").length>=2)) catastrophe(S, rnd, items);
}
function resolve(S, rnd, items){
  for(let guard=0; guard<300; guard++){
    if(S.endNow || S.players.some(p=>p.status==="seven")) return endRound(S, items);
    if(!S.forced && S.forcedQ && S.forcedQ.length) S.forced = S.forcedQ.shift();
    if(S.forced){
      const t = pl(S, S.forced.pid);
      if(t.status==="in" && S.forced.left>0){ S.forced.left--; drawFor(S, t, rnd, items); continue; }
      S.forced = null; continue;
    }
    if(S.pending) return;
    if(S.queue.length){
      const q = S.queue.shift(), ts = targets(S, q);
      if(!ts.length){ items.push({type:"fizzle", by:q.from, k:q.type}); continue; }
      if(ts.length===1 && NEEDS[q.type]!=="own"){ applyAction(S, q, ts[0], rnd, items); continue; }
      S.pending = q; return;
    }
    break;
  }
  if(!actives(S).length) return endRound(S, items);
  const from = S.advanceFrom!=null ? S.advanceFrom : S.turn;
  if(S.advanceFrom!=null || S.players[S.turn].status!=="in"){ S.turn = nextActive(S, from); S.players[S.turn].guard = false; }
  S.advanceFrom = null;
}

// Aktion anwenden → {state} oder {state, err} (unverändert)
function act(state, a, rnd = Math.random){
  const S = clone(state), items = [], fail = err => ({state, err});
  S.mods = S.mods || {}; S.blackout = S.blackout || []; S.forcedQ = S.forcedQ || [];
  const p = S.players[S.turn];
  switch(a.type){
    case "draw":
      if(S.phase!=="play" || S.pending || S.forced) return fail("Jetzt kann nicht gezogen werden.");
      if(p.status!=="in") return fail("Du bist in dieser Runde schon raus.");
      S.advanceFrom = S.turn; drawFor(S, p, rnd, items); afterTurn(S, p, rnd, items); resolve(S, rnd, items); break;
    case "stay":
      if(S.phase!=="play" || S.pending || S.forced) return fail("Jetzt kann nicht gesichert werden.");
      if(!p.row.length) return fail("Erst eine Karte ziehen.");
      if(p.cursed) return fail("Verflucht – du darfst in diesem Zug nicht sichern.");
      p.status = "stay"; p.volStay = true; items.push({type:"stay", pid:p.id});
      S.advanceFrom = S.turn; afterTurn(S, p, rnd, items); resolve(S, rnd, items); break;
    case "choose": {
      if(!S.pending) return fail("Gerade ist nichts zu wählen.");
      const ts = targets(S, S.pending), t = a.pid || a.cid;
      if(!ts.includes(t)) return fail("Das kann nicht gewählt werden.");
      const q = S.pending; S.pending = null; applyAction(S, q, t, rnd, items); resolve(S, rnd, items); break; }
    case "next":
      if(S.phase!=="roundEnd") return fail("Die Runde läuft noch.");
      S.players.forEach(x=>{ x.row.forEach(c=>{ delete c.v; }); S.discard.push(...x.row);
        Object.assign(x, {row:[], status:"in", anchor:false, guard:false, double:false, volStay:false, cursed:false, muts:{}, survivor:false, used:[]}); });
      Object.assign(S, {round:S.round+1, dealer:(S.dealer+1) % S.players.length, phase:"play", cat:null, catDone:false, mods:{}, turns:0, blackout:[], lastAction:null});
      S.turn = S.dealer; items.push({type:"round"}); break;
    case "finish":                                                    // nach einer Runde vorzeitig beenden
      if(S.phase!=="roundEnd") return fail("Beenden geht nur zwischen den Runden.");
      S.phase = "over"; S.finished = true; items.push({type:"over"}); break;
    default: return fail("Unbekannte Aktion.");
  }
  S.seq++; S.ev = {id:S.seq, items};
  return {state:S};
}
const ranking = S => S.players.slice().sort((a,b)=>b.total-a.total);

/* ---------- KI-Spieler ---------- */
// Schätzt das Risiko nur aus offen sichtbaren Karten – die KI schummelt nicht.
function bustRisk(S, p){
  const full = {}; makeDeck(S.opts).forEach(c=>{ full[c.k] = (full[c.k]||0)+1; });
  [...S.players.flatMap(x=>x.row), ...S.discard].forEach(c=>{ if(full[c.k]) full[c.k]--; });
  const unknown = Object.values(full).reduce((a,b)=>a+b, 0) || 1;
  if(S.mods && S.mods.offen) return 0;
  let bad = 0; new Set(numbers(p.row)).forEach(n=>{ bad += full["n"+n]||0; });
  let r = bad/unknown;
  if(p.anchor) r *= .15; if(p.muts && p.muts.J===1) r *= .3;
  return r;
}
function botMove(S, pid, rnd = Math.random){
  const me = pl(S, pid), lvl = me.bot || "clever";
  if(S.pending && S.pending.from===pid){
    const q = S.pending, ts = targets(S, q), others = ts.map(id=>pl(S, id)).filter(Boolean);
    const by = f => others.slice().sort((a,b)=>f(b)-f(a))[0];
    if(NEEDS[q.type]==="own"){                                         // Reset: riskanteste Zahl abwerfen
      const full = {}; makeDeck(S.opts).forEach(c=>{ full[c.k] = (full[c.k]||0)+1; });
      const c = me.row.filter(c=>ts.includes(c.id)).sort((a,b)=>(full[b.k]||0)-(full[a.k]||0))[0];
      return {type:"choose", cid:(c || {}).id || ts[0]};
    }
    const opp = others.filter(o=>o.id!==pid), pool = opp.length ? opp : others;
    const pick = q.type==="F" ? by.call(null, o=>o.id===pid ? -1 : rowScore(o, S))
      : q.type==="uV" ? pool.slice().sort((a,b)=>a.total-b.total)[0]
      : q.type==="uF" ? pool.slice().sort((a,b)=>b.total-a.total)[0]
      : q.type==="K" ? pool.slice().sort((a,b)=>Math.max(-1,...numbers(b.row))-Math.max(-1,...numbers(a.row)))[0]
      : pool.slice().sort((a,b)=>numbers(b.row).length-numbers(a.row).length)[0];          // Zugzwang / Kamikaze
    return {type:"choose", pid:(pick || others[0]).id};
  }
  if(S.players[S.turn].id!==pid) return null;
  if(!me.row.length || me.cursed) return {type:"draw"};
  const risk = bustRisk(S, me), score = rowScore(me, S), distinct = new Set(numbers(me.row)).size;
  const behind = Math.max(...S.players.map(x=>x.total)) - me.total;
  if(lvl==="locker") return (risk>.3 || score>=28 || rnd()<.12) ? {type:"stay"} : {type:"draw"};
  const gain = (1-risk)*(6.5 + (distinct===6 ? SEVEN_BONUS : 0)), loss = risk*score*(behind>60 ? .7 : 1);
  return gain>loss ? {type:"draw"} : {type:"stay"};
}

const API = {SEVEN_BONUS, CATS, RISS, NEEDS, kind, val, cval, makeDeck, shuffle, numbers, rowScore, newGame, act, ranking, targets, bustRisk, botMove};
if(typeof module!=="undefined" && module.exports) module.exports = API; else root.GSL = API;
})(typeof window!=="undefined" ? window : globalThis);
