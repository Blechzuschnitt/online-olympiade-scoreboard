// Tests für die Rätselrad-Spiellogik. Ausführen: node tests/raetselrad.test.js
const assert = require("node:assert/strict");
const R = require("../raetselrad-logic.js");

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("✓ " + name); };
const P = [{id:"a",name:"Anna",emoji:"🦄"},{id:"b",name:"Ben",emoji:"🚀"},{id:"c",name:"Cleo",emoji:"🐼"}];
const pz = (text, id = "x") => ({id, text, cat:"TEST"});
const segIdx = (show, t, v) => R.segments(show.settings).findIndex(s=>s.t===t && (v===undefined || s.v===v));
function start(text, set = {}){
  const s = R.newShow(P, Object.assign({playerOrder:"manual"}, set));
  return R.act(s, {type:"round", puzzle:pz(text)}).show;
}
const spin = (s, t, v) => R.act(s, {type:"spin", idx:segIdx(s, t, v), id:"s", at:0, dur:1, turns:1, jit:0});
const letter = (s, L) => R.act(s, {type:"letter", letter:L});

test("Treffer zählen, auch mehrfach", () => {
  assert.equal(R.count("Übung macht den Meister", "E"), 3);
  assert.equal(R.count("Übung macht den Meister", "Ü"), 1);
  assert.equal(R.count("Übung macht den Meister", "U"), 1);
});
test("ß wird als SS behandelt", () => {
  assert.equal(R.norm("Ohne Fleiß kein Preis"), "OHNE FLEISS KEIN PREIS");
  assert.equal(R.count("Fleiß", "S"), 2);
});
test("Umlaute sind Vokale, Satzzeichen keine Buchstaben", () => {
  assert.ok(R.isVowel("Ä") && R.isVowel("Ö") && R.isVowel("Ü"));
  assert.ok(!R.isLetter("-") && !R.isLetter(","));
});
test("Lösung vergleichen ignoriert Groß/klein und Satzzeichen", () => {
  assert.ok(R.sameAnswer("auf die plaetze fertig los", "Auf die Plätze, fertig, los!") === false); // ae ≠ Ä
  assert.ok(R.sameAnswer("auf die plätze fertig los", "Auf die Plätze, fertig, los!"));
  assert.ok(!R.sameAnswer("", "Harry Potter"));
});
test("Wand: wortweise, mittig, max. 4×14", () => {
  const g = R.layout("Der frühe Vogel fängt den Wurm");
  assert.equal(g.length, 4); g.forEach(r=>assert.equal(r.length, 14));
  const lines = g.map(r=>r.map(c=>c||" ").join("").trim()).filter(Boolean);
  assert.deepEqual(lines, ["DER FRÜHE", "VOGEL FÄNGT", "DEN WURM"]);
  assert.equal(R.layout("Donaudampfschifffahrt ist lang"), null);          // Wort länger als 14
  assert.equal(R.layout("eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf dreizehn"), null);
});
test("Rad hat 24 Felder mit allen Sonderfeldern", () => {
  const seg = R.segments({});
  assert.equal(seg.length, 24);
  for(const t of ["bankrott","aussetzen","extra","joker","jackpot"]) assert.ok(seg.some(s=>s.t===t), t);
  assert.ok(!R.segments({joker:false, jackpot:false}).some(s=>s.t==="joker" || s.t==="jackpot"));
});
test("Konsonant: Wert × Treffer, Spieler bleibt dran", () => {
  let s = spin(start("Harry Potter"), "wert", 100).show;
  assert.equal(s.phase, "guess");
  s = letter(s, "R").show;                                  // HARRY POTTER: 3× R
  assert.equal(s.players[0].round, 300); assert.equal(s.turn, 0); assert.equal(s.phase, "turn");
});
test("Konsonant ohne Drehen ist nicht erlaubt", () => {
  const r = letter(start("Harry Potter"), "R"); assert.ok(r.err);
});
test("Fehlbuchstabe: nächster Spieler", () => {
  let s = spin(start("Harry Potter"), "wert", 100).show;
  s = letter(s, "Z").show; assert.equal(s.turn, 1); assert.equal(s.ev.type, "miss");
});
test("Vokal kostet 250, auch ohne Treffer weg", () => {
  let s = start("Harry Potter"); s.players[0].round = 600;
  s = letter(s, "O").show; assert.equal(s.players[0].round, 350); assert.equal(s.turn, 0);
  s = letter(s, "U").show; assert.equal(s.players[0].round, 100); assert.equal(s.turn, 1);
  assert.ok(letter(s, "A").err);                            // Ben hat 0 Punkte
});
test("Bereits genannte Buchstaben sind gesperrt", () => {
  let s = spin(start("Harry Potter"), "wert", 100).show; s = letter(s, "R").show;
  s = spin(s, "wert", 100).show; assert.ok(letter(s, "R").err);
});
test("Bankrott: Rundenpunkte weg, Zug endet", () => {
  let s = start("Harry Potter"); s.players[0].round = 900;
  s = spin(s, "bankrott").show; assert.equal(s.players[0].round, 0); assert.equal(s.turn, 1);
});
test("Aussetzen, Extra-Drehung, Joker", () => {
  let s = spin(start("Harry Potter"), "aussetzen").show; assert.equal(s.turn, 1);
  s = spin(s, "extra").show; assert.equal(s.turn, 1); assert.equal(s.phase, "turn");
  s = spin(s, "joker").show; assert.equal(s.players[1].jokers, 1);
  s = spin(s, "wert", 50).show; s = letter(s, "Z").show;   // Joker rettet den Fehlversuch
  assert.equal(s.turn, 1); assert.equal(s.players[1].jokers, 0); assert.equal(s.ev.type, "saved");
});
test("Lösen: nur Gewinner behält Punkte, Rätsel wird gespielt markiert", () => {
  let s = start("Harry Potter"); s.players[0].round = 500; s.players[1].round = 800;
  s = R.act(s, {type:"solve", guess:"harry potter"}).show;
  assert.equal(s.players[0].total, 500); assert.equal(s.players[1].total, 0);
  assert.equal(s.players[1].round, 0); assert.equal(s.phase, "solved"); assert.deepEqual(s.played, ["x"]);
});
test("Falsche Lösung beendet den Zug", () => {
  const s = R.act(start("Harry Potter"), {type:"solve", guess:"Harry Styles"}).show;
  assert.equal(s.turn, 1); assert.equal(s.ev.type, "miss");
});
test("Letzter Buchstabe deckt alles auf: Runde gewonnen", () => {
  let s = start("Ei"); s.players[0].round = 600;
  s = letter(s, "E").show; s = letter(s, "I").show;
  assert.equal(s.phase, "solved"); assert.equal(s.players[0].total, 100);
});
test("Rundenwechsel, Startspieler rotiert, Ende nach eingestellten Runden", () => {
  let s = R.newShow(P, {playerOrder:"manual", rounds:2});
  s = R.act(s, {type:"round", puzzle:pz("Ei","1")}).show; assert.equal(s.turn, 0);
  s = R.act(s, {type:"solve", correct:true}).show;
  s = R.act(s, {type:"round", puzzle:pz("Oh","2")}).show; assert.equal(s.round, 2); assert.equal(s.turn, 1);
  s = R.act(s, {type:"solve", correct:true}).show;
  s = R.act(s, {type:"round", puzzle:null}).show; assert.equal(s.phase, "end");
});
test("Rätselauswahl wiederholt nichts innerhalb der Show", () => {
  const list = [pz("Ei","1"), pz("Oh","2")];
  assert.equal(R.pickPuzzle(list, ["1"], "random").id, "2");
  assert.equal(R.pickPuzzle(list, ["1","2"], "random"), null);
  assert.equal(R.pickPuzzle(list, [], "manual").id, "1");
});
test("Spielleitung: Punkte korrigieren, Buchstabe aufdecken, Zug überspringen", () => {
  let s = start("Harry Potter");
  s = R.act(s, {type:"adjust", pid:"a", delta:150}).show; assert.equal(s.players[0].round, 150);
  s = R.act(s, {type:"reveal", letter:"T"}).show; assert.ok(s.used.includes("T"));
  s = R.act(s, {type:"skip"}).show; assert.equal(s.turn, 1);
});
console.log(`\n${n} Tests bestanden.`);
