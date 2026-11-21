// Tests für Sabotage, APOKALYPSE und KI. Ausführen: node tests/glueckstraehne-erweiterungen.test.js
const assert = require("node:assert/strict");
const G = require("../glueckstraehne-logic.js");
let n = 0;
const test = (name, fn) => { fn(); n++; console.log("✓ " + name); };
const P = [{id:"a",name:"Anna"},{id:"b",name:"Ben"},{id:"c",name:"Cleo"}];
const C = (k, i) => ({k, id:k+"-"+(i ?? Math.random().toString(36).slice(2,7))});
const gameX = (next, players = P, opts = {sabotage:true, apokalypse:true}) => {
  const S = G.newGame(players, 200, Math.random, opts); S.deck = next.slice().reverse().map(k=>C(k)); S.cats = []; return S; };
const go = (S, a, rnd) => { const r = G.act(S, a, rnd); assert.ok(!r.err, r.err); return r.state; };

test("Erweiterungen vergrößern den Stapel", () => {
  assert.equal(G.makeDeck({sabotage:true}).length, 101);
  assert.equal(G.makeDeck({sabotage:true, apokalypse:true}).length, 108);
});
test("Doppel oder nichts: freiwillig sichern verdoppelt", () => {
  let S = gameX(["D","n5"], [P[0]]);
  S = go(S, {type:"draw"}); S = go(S, {type:"draw"}); S = go(S, {type:"stay"});
  assert.equal(S.players[0].total, 10);
});
test("Schutzschild: geschützt vor gegnerischen Aktionen", () => {
  let S = gameX(["G","F"], [P[0],P[1]]);
  S = go(S, {type:"draw"});                       // Anna: Schutzschild
  S = go(S, {type:"draw"});                       // Ben: Stopp – Anna geschützt, also trifft es Ben selbst
  assert.equal(S.players[1].status, "stay"); assert.equal(S.players[0].status, "in");
});
test("Kartenklau tauscht niedrigste gegen höchste Zahl", () => {
  let S = gameX(["n2","n9","K"], [P[0],P[1]]);
  S = go(S, {type:"draw"}); S = go(S, {type:"draw"}); S = go(S, {type:"draw"});
  assert.deepEqual(S.players[0].row.map(c=>c.k), ["n9"]); assert.deepEqual(S.players[1].row.map(c=>c.k), ["n2"]);
});
test("Reset: eigene Karte abwerfen, Ersatz ziehen", () => {
  let S = gameX(["n7","n3","R","n4"], [P[0],P[1]]);
  S = go(S, {type:"draw"}); S = go(S, {type:"draw"}); S = go(S, {type:"draw"});
  assert.equal(S.pending.type, "R");
  S = go(S, {type:"choose", cid:S.players[0].row[0].id});
  assert.deepEqual(S.players[0].row.map(c=>c.k), ["n4"]);
});
test("Spiegel kopiert die letzte Aktion", () => {
  let S = gameX(["X","n1","n2","M","n6"], [P[0],P[1]]);
  S = go(S, {type:"draw"});                       // Anna: Kamikaze -> Ben zieht automatisch
  assert.equal(S.players[1].row[0].k, "n1");
  S = go(S, {type:"draw"});                       // Ben: 2
  S = go(S, {type:"draw"});                       // Anna: Spiegel = Kamikaze -> Ben zieht 6
  assert.deepEqual(S.players[1].row.map(c=>c.k), ["n1","n2","n6"]);
});
test("Rückwärtsgang: Nächster legt seine letzte Karte zurück und zieht neu", () => {
  let S = gameX(["n3","n8","B","n10"], [P[0],P[1]]);
  S = go(S, {type:"draw"}); S = go(S, {type:"draw"}); S = go(S, {type:"draw"});
  assert.deepEqual(S.players[1].row.map(c=>c.k), ["n10"]);
});
test("Katastrophe nach einem Umlauf: Inflation verdoppelt", () => {
  let S = gameX(["n3","n4"], [P[0],P[1]], {apokalypse:true}); S.cats = ["inflation"];
  S = go(S, {type:"draw"}); S = go(S, {type:"draw"});
  assert.equal(S.cat.k, "inflation");
  S = go(S, {type:"stay"}); S = go(S, {type:"stay"});
  assert.deepEqual(S.players.map(p=>p.total), [6,8]);
});
test("Schwerkraft: Zahlen zählen umgekehrt", () => {
  let S = gameX(["n2","n10"], [P[0],P[1]], {apokalypse:true}); S.cats = ["schwerkraft"];
  S = go(S, {type:"draw"}); S = go(S, {type:"draw"}); S = go(S, {type:"stay"}); S = go(S, {type:"stay"});
  assert.deepEqual(S.players.map(p=>p.total), [10,2]);
});
test("Weltuntergang beendet die Runde sofort", () => {
  let S = gameX(["n3","n4"], [P[0],P[1]], {apokalypse:true}); S.cats = ["weltuntergang"];
  S = go(S, {type:"draw"}); S = go(S, {type:"draw"});
  assert.equal(S.phase, "roundEnd"); assert.deepEqual(S.players.map(p=>p.total), [3,4]);
});
test("Joker der Hölle verhindert das Rausfliegen", () => {
  let S = gameX(["uJ","n5","n5"], [P[0]], {apokalypse:true});
  S = go(S, {type:"draw"}); S = go(S, {type:"draw"}); S = go(S, {type:"draw"});
  assert.equal(S.players[0].status, "in"); assert.deepEqual(G.numbers(S.players[0].row).sort(), [5,6]);
});
test("Verräter zählt nur, wenn er mehr hat als sein Ziel", () => {
  let S = gameX(["uV","n9","n4"], [P[0],P[1]], {apokalypse:true});
  S = go(S, {type:"draw"});                       // Anna: Verräter -> nur Ben möglich, automatisch
  S = go(S, {type:"draw"}); S = go(S, {type:"draw"}); S = go(S, {type:"stay"}); S = go(S, {type:"stay"});
  assert.deepEqual(S.players.map(p=>p.total), [0,9]);
});
test("Riss offen: Doppelte werfen nicht raus und zählen nicht", () => {
  let S = gameX(["Q","n5","n5"], [P[0]], {apokalypse:true});
  S = go(S, {type:"draw"}, () => 0); S = go(S, {type:"draw"}); S = go(S, {type:"draw"});
  assert.equal(S.players[0].status, "in"); assert.equal(G.rowScore(S.players[0], S), 5);
});
test("KI: zieht bei leerer Reihe, sichert bei hohem Risiko, wählt Ziele", () => {
  let S = gameX(["n12"], [Object.assign({bot:"clever"}, P[0]), P[1]]);
  assert.deepEqual(G.botMove(S, "a"), {type:"draw"});
  S.players[0].row = ["n12","n11","n10","n9","n8"].map(k=>C(k));
  assert.deepEqual(G.botMove(S, "a"), {type:"stay"});
  S.players[1].row = [C("n3")]; S.pending = {type:"X", from:"a"};
  assert.deepEqual(G.botMove(S, "a"), {type:"choose", pid:"b"});
});
test("KI spielt ganze Partien in allen Varianten ohne Fehler", () => {
  for(let k=0;k<40;k++){
    let S = G.newGame([{id:"a",name:"A",bot:"clever"},{id:"b",name:"B",bot:"locker"},{id:"c",name:"C",bot:"clever"}], 150, Math.random, {sabotage:k%2===0, apokalypse:k%3!==0});
    for(let i=0;i<4000 && S.phase!=="over";i++){
      if(S.phase==="roundEnd"){ S = go(S, {type:"next"}); continue; }
      const who = S.pending ? S.pending.from : S.players[S.turn].id;
      const m = G.botMove(S, who); assert.ok(m, "kein Zug für "+who);
      S = go(S, m);
      const cards = S.deck.length + S.discard.length + S.players.reduce((a,p)=>a+p.row.length, 0);
      assert.equal(cards, G.makeDeck(S.opts).length, "Karten verloren oder doppelt");
    }
    assert.equal(S.phase, "over");
  }
});
test("Gezogene Sonderkarten liegen sichtbar beim Spieler, bis die Runde endet", () => {
  let S = gameX(["G","n4","n5"], [P[0],P[1]]);
  S = go(S, {type:"draw"});
  assert.deepEqual(S.players[0].used.map(c=>c.k), ["G"]);
  S = go(S, {type:"draw"}); S = go(S, {type:"draw"}); S = go(S, {type:"stay"}); S = go(S, {type:"stay"});
  assert.equal(S.phase, "roundEnd"); assert.equal(S.players[0].used.length, 1);
  S = go(S, {type:"next"}); assert.deepEqual(S.players[0].used, []);
});
test("Beenden nach einer Runde macht das Spiel fertig", () => {
  let S = gameX(["n3","n4"], [P[0],P[1]], {});
  assert.ok(G.act(S, {type:"finish"}).err);
  S = go(S, {type:"draw"}); S = go(S, {type:"draw"}); S = go(S, {type:"stay"}); S = go(S, {type:"stay"});
  S = go(S, {type:"finish"}); assert.equal(S.phase, "over");
});
console.log(`\n${n} Tests bestanden.`);
