// Tests für die Glückssträhne-Spiellogik. Ausführen: node tests/glueckstraehne.test.js
const assert = require("node:assert/strict");
const G = require("../glueckstraehne-logic.js");
let n = 0;
const test = (name, fn) => { fn(); n++; console.log("✓ " + name); };
const P = [{id:"a",name:"Anna"},{id:"b",name:"Ben"},{id:"c",name:"Cleo"}];
const C = (k, i) => ({k, id:k+"-"+i});
// Stapel so vorbereiten, dass die nächsten Karten feststehen (oben = Ende des Arrays)
function game(next, players = P){ const S = G.newGame(players, 200); S.deck = next.slice().reverse().map(C); return S; }
const go = (S, a) => { const r = G.act(S, a); assert.ok(!r.err, r.err); return r.state; };

test("Stapel: 79 Zahlen, 6 Booster, 9 Aktionen", () => {
  const d = G.makeDeck();
  assert.equal(d.length, 94);
  assert.equal(d.filter(c=>c.k==="n12").length, 12); assert.equal(d.filter(c=>c.k==="n0").length, 1);
});
test("Ziehen reihum, Sichern nur mit Karte", () => {
  let S = game(["n5","n7"]);
  assert.ok(G.act(S, {type:"stay"}).err);
  S = go(S, {type:"draw"}); assert.equal(S.turn, 1); assert.equal(S.players[0].row[0].k, "n5");
  S = go(S, {type:"draw"}); assert.equal(S.turn, 2);
});
test("Doppelte Zahl = raus und 0 Punkte", () => {
  let S = game(["n5","n1","n2","n5"]);
  S = go(S, {type:"draw"}); S = go(S, {type:"draw"}); S = go(S, {type:"draw"}); S = go(S, {type:"draw"});
  assert.equal(S.players[0].status, "bust"); assert.equal(G.rowScore(S.players[0]), 0);
});
test("Schutzschild fängt doppelte Zahl ab", () => {
  let S = game(["S","n1","n2","n4","n1","n3","n4"]);
  for(let i=0;i<7;i++) S = go(S, {type:"draw"});    // Anna: Schild, 4, 4 · Ben: 1, 1 (raus) · Cleo: 2, 3
  assert.equal(S.players[1].status, "bust");
  assert.equal(S.players[0].status, "in"); assert.equal(S.players[0].shield, false);
  assert.deepEqual(S.players[0].row.map(c=>c.k), ["n4"]);
});
test("Punkte: ×2 nur auf Zahlen, dann Booster", () => {
  const p = {status:"stay", row:[C("n5",1),C("n3",2),C("x2",3),C("p4",4)]};
  assert.equal(G.rowScore(p), 20);
});
test("Sieben verschiedene Zahlen: Runde endet, +15", () => {
  const S0 = game(["n1","n2","n3","n4","n5","n6","n7"], [P[0]]);
  let S = S0; for(let i=0;i<7;i++) S = go(S, {type:"draw"});
  assert.equal(S.phase, "roundEnd"); assert.equal(S.players[0].total, 1+2+3+4+5+6+7+15);
});
test("Stopp: Ziehende Person wählt, Ziel muss sichern", () => {
  let S = game(["F"]);
  S = go(S, {type:"draw"}); assert.deepEqual(S.pending, {type:"F", from:"a"});
  assert.ok(G.act(S, {type:"draw"}).err);
  S = go(S, {type:"choose", pid:"c"}); assert.equal(S.players[2].status, "stay"); assert.equal(S.turn, 1);
});
test("Zugzwang: Ziel zieht sofort zwei Karten", () => {
  let S = game(["Z","n3","n9"]);
  S = go(S, {type:"draw"}); S = go(S, {type:"choose", pid:"b"});
  assert.deepEqual(S.players[1].row.map(c=>c.k), ["n3","n9"]); assert.equal(S.turn, 1);
});
test("Zugzwang stoppt, wenn das Ziel rausfliegt", () => {
  let S = game(["n4","Z","n4","n8"], [P[0],P[1]]);
  S = go(S, {type:"draw"});                 // Anna: 4
  S = go(S, {type:"draw"});                 // Ben: Zugzwang
  S = go(S, {type:"choose", pid:"a"});      // Anna zieht 4 -> raus, 8 bleibt liegen
  assert.equal(S.players[0].status, "bust"); assert.equal(S.players[0].row.length, 2); assert.equal(S.deck.slice(-1)[0].k, "n8");
});
test("Nur noch eine Person aktiv: Aktion trifft sie automatisch", () => {
  let S = game(["n4","n6","F"], [P[0],P[1]]);
  S = go(S, {type:"draw"}); S = go(S, {type:"draw"}); S = go(S, {type:"stay"});
  S = go(S, {type:"draw"});                                   // Ben zieht Stopp, nur er ist noch aktiv
  assert.equal(S.pending, null); assert.equal(S.phase, "roundEnd"); assert.deepEqual(S.players.map(p=>p.total), [4,6]);
});
test("Rundenende, wenn alle raus sind; nächste Runde rotiert", () => {
  let S = game(["n4","n6"], [P[0],P[1]]);
  S = go(S, {type:"draw"}); S = go(S, {type:"draw"});
  S = go(S, {type:"stay"}); S = go(S, {type:"stay"});
  assert.equal(S.phase, "roundEnd"); assert.deepEqual(S.players.map(p=>p.total), [4,6]);
  S = go(S, {type:"next"}); assert.equal(S.turn, 1); assert.equal(S.round, 2); assert.equal(S.players[0].row.length, 0);
});
test("Spielende ab Zielpunktzahl", () => {
  let S = game(["n12"], [P[0]]); S.target = 10;
  S = go(S, {type:"draw"}); S = go(S, {type:"stay"});
  assert.equal(S.phase, "over"); assert.equal(G.ranking(S)[0].id, "a");
});
console.log(`\n${n} Tests bestanden.`);
