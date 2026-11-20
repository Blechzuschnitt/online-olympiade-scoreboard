/* =====================================================================
   Rätselrad – die Buchstaben-Show der Familien-Olympiade (Oberfläche)
   Regeln: raetselrad-logic.js (RRL). Speicherung & Sync: state.show,
   state.rrPuzzles, state.rrSettings über commit() der Haupt-App.
   ===================================================================== */
const RR_CATS = ["SPRICHWORT","ORT","PERSON","FAMILIE","SPEISE","FILM","SONGTITEL","ALLES MÖGLICHE"];
const RR_SEED = [
  ["SPRICHWORT","Morgenstund hat Gold im Mund"],["SPRICHWORT","Übung macht den Meister"],["SPRICHWORT","Wer zuletzt lacht, lacht am besten"],
  ["SPRICHWORT","Ohne Fleiß kein Preis"],["SPRICHWORT","Der frühe Vogel fängt den Wurm"],["SPRICHWORT","Aller Anfang ist schwer"],
  ["SPRICHWORT","Wie ein Elefant im Porzellanladen"],["ORT","Brandenburger Tor","Steht in Berlin"],["ORT","Schloss Neuschwanstein"],
  ["ORT","Nordsee-Insel Sylt"],["ORT","Kölner Dom"],["SPEISE","Spaghetti Bolognese"],["SPEISE","Schwarzwälder Kirschtorte"],
  ["SPEISE","Currywurst mit Pommes"],["SPEISE","Kartoffelsalat mit Würstchen","Klassiker an Heiligabend"],["FILM","Die Eiskönigin"],
  ["FILM","Harry Potter"],["FILM","Findet Nemo"],["SONGTITEL","Atemlos durch die Nacht"],["PERSON","Albert Einstein"],
  ["FAMILIE","Wer hat die Fernbedienung?","Platzhalter – eigene Insider eintragen!"],["FAMILIE","Papa grillt am Wochenende","Platzhalter"],
  ["FAMILIE","Sonntags gibt es Pfannkuchen","Platzhalter"],["ALLES MÖGLICHE","Achterbahn im Freizeitpark"],["ALLES MÖGLICHE","Ein Tag am Meer"],
  ["ALLES MÖGLICHE","Auf die Plätze, fertig, los!","Passt zum Renntag"]
].map(([cat,text,hint],i)=>({id:"s"+(i+1), cat, text, hint:hint||""}));

const rrPuzzles = () => state.rrPuzzles || RR_SEED.map(p=>Object.assign({}, p));
const rrSettings = () => Object.assign({}, RRL.DEFAULTS, state.rrSettings);
const rrFmt = n => Number(n||0).toLocaleString("de-DE");
const rrRand = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };   // fairer Zufall
const RR_COL = ["#00F5FF","#FF00E5","#8B5CF6","#39FF88","#FF9F43"];
const RR_SPECIAL = {bankrott:["BANKROTT","#0b0b12","#FF3D5A"], aussetzen:["AUSSETZEN","#e9edf7","#1b1640"], extra:["EXTRA","#FFD84D","#2a1a00"],
  joker:["JOKER","#4361EE","#ffffff"], jackpot:["JACKPOT","url(#rrJack)","#2a0030"]};

let rrAnim = false, rrRot = 0, rrLastSpin, rrLastEv, rrIntroSeen, rrInit = false, rrBuy = false, rrWarn = null;
let rrWallKey = null, rrCardsKey = null, rrWheelKey = null, rrAdminBuilt = false, rrEditId = null;
const rrBusy = () => rrAnim;

// Effektstufe: 3 hoch · 2 mittel · 1 reduziert · 0 aus (auto nach Gerät und Bewegungs-Einstellung)
const RR_FX = ["auto","hoch","mittel","reduziert","aus"];
const rrFxSetting = () => { try{ return localStorage.getItem("rr-fx") || "auto"; }catch(e){ return "auto"; } };
function fxLevel(){
  const s = rrFxSetting();
  if(s!=="auto") return {hoch:3, mittel:2, reduziert:1, aus:0}[s];
  if(reduced()) return 0;
  return (navigator.hardwareConcurrency||4)<=4 || innerWidth<700 ? 2 : 3;
}

/* ---------------- Daten-Aktionen ---------------- */
function rrDo(a){
  const sh = state.show; if(!sh) return false;
  const r = RRL.act(sh, a);
  if(r.err){ rrSay(r.err); rrTone(150, .18, "square", .05); return false; }
  r.show.undo = JSON.stringify(sh, (k,v)=>k==="undo" ? undefined : v);   // ein Schritt zurück möglich
  if(r.show.ev && r.show.ev.type==="solved"){                            // Rätsel als gespielt markieren
    const list = rrPuzzles(), p = list.find(p=>p.id===r.show.puzzle.id);
    if(p){ p.lastPlayed = Date.now(); state.rrPuzzles = list; }
  }
  rrBuy = false; state.show = r.show; commit(); return true;
}
function rrUndo(){
  const sh = state.show; if(!sh || !sh.undo) return;
  const prev = JSON.parse(sh.undo); prev.seq = sh.seq+1; prev.ev = {id:prev.seq, type:"undo"};
  state.show = prev; rrWallKey = null; commit(); rrSay("Letzter Schritt zurückgenommen.");
}
function rrSpin(){
  const sh = state.show; if(!sh || rrAnim) return;
  const n = RRL.segments(sh.settings).length;
  rrDo({type:"spin", idx:rrRand(n), id:uid(), at:Date.now(), dur:5600+rrRand(1600), turns:4+rrRand(3), jit:rrRand(1000)/1000-.5});
}
function rrLetter(L){ if(!rrAnim) rrDo({type:"letter", letter:L}); }
function rrNextRound(){
  const sh = state.show; if(!sh) return;
  rrDo({type:"round", puzzle:RRL.pickPuzzle(rrPuzzles(), sh.played, sh.settings.puzzleOrder, Math.random)});
}
const rrSource = () => O() ? O().roster : state.players;
const rrPickList = () => picks.rr.filter(id=>rrSource().some(p=>p.id===id));       // niemand ist vorgemerkt – Auswahl per „+“
function rrStart(){
  const src = rrSource(), ps = rrPickList().map(id=>src.find(p=>p.id===id)).filter(Boolean), set = rrSettings();
  if(ps.length<2 || ps.length>6){ toast("Die Show braucht 2 bis 6 Spieler."); return; }
  const pz = RRL.pickPuzzle(rrPuzzles(), [], set.puzzleOrder, Math.random);
  if(!pz){ toast("Keine passenden Rätsel – lege in der Verwaltung welche an."); return; }
  const sh = RRL.newShow(ps, set); sh.intro = Date.now();
  state.show = RRL.act(sh, {type:"round", puzzle:pz}).show; picks.rr = []; pickOpen = null; commit();
}
// Show-Ergebnis über die vorhandene Rundenwertung in die Olympiade übernehmen
function rrTransfer(){
  const sh = state.show, ol = O();
  if(!sh || sh.transferred) return;
  if(!ol){ toast("Es läuft gerade keine Olympiade."); return; }
  if(state.pending && state.pending.gameId!=="raetselrad"){ toast(`Erst die laufende Runde „${state.pending.gameName}“ eintragen.`); return; }
  const g = game("raetselrad") || {name:"Rätselrad", icon:"🔠"};
  // nur wer Show-Punkte hat, bekommt eine Platzierung (gleich viele Punkte: Reihenfolge der Show)
  const order = RRL.ranking(sh).filter(p=>p.total>0).map(p=>p.id).filter(id=>ol.roster.some(r=>r.id===id));
  if(!order.length){ toast("Niemand aus der Olympiade hat Show-Punkte – nichts zu übertragen."); return; }
  state.pending = Object.assign({gameId:"raetselrad", gameName:g.name, icon:g.icon, double:!!g.double}, state.pending||{}, {order});
  const w = saveRound(); sh.transferred = true; commit();
  toast(`🏆 ${w ? w.name : "?"} gewinnt ${g.name} – Punkte sind in der Olympiade!`); confetti($("fx"));
}
// Spieleintrag in der Bibliothek (einmalig, zusätzlich zu den vorhandenen Spielen)
function ensureShowGame(){
  if(state.rrLib || state.library.some(g=>g.id==="raetselrad")) return false;
  state.library.push({id:"raetselrad", name:"Rätselrad", icon:"🔠", info:"Die Buchstaben-Show: drehen, Buchstaben raten, Rätsel lösen.",
    url:"#show", cat:"wissen", players:"2–6", time:"30 Min.", double:false});
  state.rrLib = true; return true;
}

/* ---------------- Ton ---------------- */
function rrTone(f, len, type, gain, to){
  const ac = audio(); if(!ac) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
  o.type = type||"sine"; o.frequency.setValueAtTime(f, t); if(to) o.frequency.exponentialRampToValueAtTime(to, t+len);
  g.gain.setValueAtTime(gain||.08, t); g.gain.exponentialRampToValueAtTime(.0005, t+len);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t+len+.02);
}
const rrSfx = {
  flip: () => { const ac = audio(); if(ac) noise(ac, ac.currentTime, .05, 2, "highpass", 1800, .25); rrTone(880, .12, "triangle", .05); },
  ding: () => { rrTone(1047, .25, "triangle", .08); setTimeout(()=>rrTone(1568, .35, "triangle", .06), 90); },
  buzz: () => rrTone(110, .45, "sawtooth", .07, 80),
  bank: () => { rrTone(400, .9, "sawtooth", .09, 60); const ac = audio(); if(ac) noise(ac, ac.currentTime, .5, 1.5, "lowpass", 600, .4); }
};

/* ---------------- Rendern ---------------- */
function renderShow(){
  const root = $("rrRoot"); if(!root || typeof RRL==="undefined") return;
  rrAdmin();
  const sh = state.show, mode = !sh ? "setup" : sh.phase==="end" ? "end" : "game";
  if(root.dataset.mode!==mode){
    root.dataset.mode = mode; rrWallKey = rrCardsKey = rrWheelKey = null; root._html = null;
    if(mode==="game") root.innerHTML = rrSkeleton();
  }
  if(mode==="setup") return rrHtml(root, rrSetupHTML());
  if(mode==="end") return rrHtml(root, rrEndHTML(sh));
  $("rr").dataset.fx = fxLevel();
  $("rrFx").textContent = "✨ " + rrFxSetting()[0].toUpperCase() + rrFxSetting().slice(1);
  $("rrSound").textContent = soundOn ? "🔊" : "🔇";
  $("rrEvent").textContent = "📅 " + rrSettings().event;
  $("rrRound").textContent = `RUNDE ${sh.round} / ${sh.settings.rounds}`;
  rrWheel(sh);
  // neue Drehung? Ergebnis steht schon fest – die Animation läuft genau dorthin
  if(sh.spin && sh.spin.id!==rrLastSpin){
    rrLastSpin = sh.spin.id;
    if(rrInit && Date.now()-sh.spin.at < sh.spin.dur+4000) return rrAnimate(sh.spin);
    rrSetRot(sh.spin);
  }
  if(rrAnim) return;
  rrWall(sh); rrPlayers(sh); rrControls(sh); rrTicker(sh);
  if(sh.ev && sh.ev.id!==rrLastEv){ rrLastEv = sh.ev.id; if(rrInit) rrEffect(sh.ev, sh); }
  if(sh.intro && sh.intro!==rrIntroSeen){ rrIntroSeen = sh.intro; if(Date.now()-sh.intro < 8000) rrIntro(sh); }
  rrInit = true;
}
function rrHtml(el, html){ if(el._html!==html){ el._html = html; el.innerHTML = html; } }

function rrSkeleton(){
  return `<div class="rr" id="rr">
  <div class="rr-head">
    <div class="rr-brand"><span class="rr-logo">RÄTSELRAD</span><small>FAMILIEN-OLYMPIADE</small></div>
    <div class="rr-meta"><span class="pill rr-ev" id="rrEvent"></span><span class="pill rr-rnd" id="rrRound"></span></div>
    <div class="rr-tools">
      <button class="ghost sm ic" data-rr="sound" id="rrSound" aria-label="Ton an/aus"></button>
      <button class="ghost sm" data-rr="fx" id="rrFx" title="Effektstufe wechseln"></button>
      <button class="ghost sm" data-rr="tv" id="rrTvBtn">📺 Studio</button>
      <button class="ghost sm" data-rr="host">🎛️ Spielleitung</button>
    </div>
  </div>
  <div class="rr-ticker" id="rrTicker" aria-live="polite"><b></b><span></span></div>
  <div class="rr-stage">
    <div class="rr-board px1"><div class="rr-cat" id="rrCat"></div><div class="rr-wall" id="rrWall"></div><div class="rr-hint" id="rrHint"></div></div>
    <div class="rr-wheelzone px2">
      <div class="rr-rig">
        <div class="rr-ptr" id="rrPtr"><svg viewBox="0 0 40 60" aria-hidden="true"><defs><linearGradient id="rrPg" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#FFD84D"/><stop offset="1" stop-color="#b37400"/></linearGradient></defs>
          <path d="M20 58 L4 14 A16 16 0 1 1 36 14 Z" fill="url(#rrPg)" stroke="#3a2200" stroke-width="2"/><circle cx="20" cy="13" r="5" fill="#080B14" stroke="#00F5FF" stroke-width="2"/></svg></div>
        <div class="rr-disc"><svg id="rrWheel" viewBox="-100 -100 200 200" role="img" aria-label="Show-Rad"></svg><div class="rr-gloss"></div></div>
      </div>
      <div class="rr-land" id="rrLand"></div>
    </div>
  </div>
  <div class="rr-players px3" id="rrPlayers"></div>
  <div class="rr-controls">
    <div class="rr-actions" id="rrActions"></div>
    <div class="rr-keys" id="rrKeys"></div>
  </div>
  <div class="rr-flash"></div>
  <button class="ghost sm rr-tvexit" data-rr="tv">✕ Studio-Ansicht beenden</button>
  <div class="rr-tvnote">Steuern per Handy: diese Seite dort öffnen → Bereich „Rätselrad“</div>
  <div class="rr-modal" id="rrModal" hidden><div class="rr-mbox" id="rrMbox"></div></div>
</div>`;
}

/* ---- Rad ---- */
function rrWheel(sh){
  const segs = RRL.segments(sh.settings), key = JSON.stringify(segs);
  if(key===rrWheelKey) return; rrWheelKey = key;
  const n = segs.length, a = 360/n;
  let s = `<defs><linearGradient id="rrJack" x1="0" x2="1"><stop offset="0" stop-color="#FFD84D"/><stop offset=".5" stop-color="#FF9F43"/><stop offset="1" stop-color="#FF00E5"/></linearGradient>
    <radialGradient id="rrShade" r=".5"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient></defs>
    <circle r="99.5" fill="#0a0d1a"/>`;
  segs.forEach((g,i)=>{
    const [x0,y0] = pt(i*a,92), [x1,y1] = pt((i+1)*a,92), c = (i+.5)*a, sp = RR_SPECIAL[g.t];
    const fill = sp ? sp[1] : RR_COL[i % RR_COL.length], ink = sp ? sp[2] : (i%5===0 || i%5===3 || i%5===4 ? "#0b0820" : "#fff");
    const label = sp ? sp[0] : String(g.v), fs = sp ? (label.length>7 ? 7.6 : 9) : label.length>3 ? 12 : 14;
    s += `<path id="rs${i}" d="M0 0 L${x0} ${y0} A92 92 0 0 1 ${x1} ${y1} Z" fill="${fill}" stroke="rgba(255,255,255,.55)" stroke-width=".5"/>
      <g transform="rotate(${c-90})"><text x="86" text-anchor="end" dominant-baseline="central" font-family="${sp ? "Orbitron, sans-serif" : "'Space Grotesk', sans-serif"}" font-weight="900" font-size="${fs}" fill="${ink}" letter-spacing="${sp ? .4 : 0}">${label}</text></g>`;
  });
  s += `<circle r="92" fill="url(#rrShade)"/><circle r="95.5" fill="none" stroke="#c9d3f5" stroke-width="5"/><circle r="95.5" fill="none" stroke="#00F5FF" stroke-width=".8" opacity=".9"/>
    <circle r="99" fill="none" stroke="#FF00E5" stroke-width="1"/>`;
  segs.forEach((_,i)=>{ const [x,y] = pt(i*a,95.5); s += `<circle cx="${x}" cy="${y}" r="1.9" fill="#fff" stroke="#556" stroke-width=".4"/>`; });
  s += `<circle r="24" fill="#0c1124" stroke="#00F5FF" stroke-width="1.5"/><text y="1" text-anchor="middle" dominant-baseline="central" font-family="Orbitron, sans-serif" font-weight="900" font-size="8" fill="#F5F7FF">RÄTSEL</text>`;
  $("rrWheel").innerHTML = s; $("rrWheel").style.transform = `rotate(${rrRot}deg)`;
}
const rrTarget = sp => { const a = 360/RRL.SEGMENTS; return -((sp.idx+.5)*a + sp.jit*a*.7); };
function rrSetRot(sp){ rrRot = rrTarget(sp); $("rrWheel").style.transform = `rotate(${rrRot}deg)`; rrMark(sp.idx); }
function rrMark(idx){ document.querySelectorAll("#rrWheel path.win").forEach(p=>p.classList.remove("win")); const p = $("rs"+idx); if(p) p.classList.add("win"); }
function rrAnimate(sp){
  const a = 360/RRL.SEGMENTS, fx = fxLevel(), wheel = $("rrWheel"), ptr = $("rrPtr");
  rrAnim = true; rrMark(-1); $("rrLand").className = "rr-land";
  rrControls(state.show, true);
  const p = state.show.players.find(x=>x.id===state.show.ev.pid);
  rrTickerSet(`${p ? p.name : ""} dreht …`, "Daumen drücken!");
  const start = ((rrRot%360)+360)%360, total = 360*sp.turns + ((((rrTarget(sp)-start)%360)+360)%360);
  const dur = fx===0 ? 700 : sp.dur;
  const t0 = performance.now() - Math.max(0, Math.min(dur*.5, Date.now()-sp.at-300));
  // Anlauf (kurz zurück), Beschleunigen, langes Ausrollen mit Zeitlupe am Ende
  const ease = x => x<.06 ? -.004*Math.sin(x/.06*Math.PI) : 1-Math.pow(1-(x-.06)/.94, 4.4);
  const segAt = r => Math.floor((((-r)%360)+360)%360 / a);
  let last = segAt(start), flap = 0, prev = start;
  const frame = now => {
    const x = Math.min(1, (now-t0)/dur), r = start + total*ease(x), speed = Math.abs(r-prev); prev = r;
    rrRot = r; wheel.style.transform = `rotate(${r}deg)`;
    if(fx>=3) wheel.style.filter = speed>6 ? `blur(${Math.min(2.2, (speed-6)*.12).toFixed(2)}px)` : "";
    const sg = segAt(r);
    if(sg!==last){ last = sg; flap = Math.min(30, 12+speed*2); wclick(.12+Math.min(.4, speed/20)); }
    flap *= .8; ptr.style.setProperty("--flap", (-flap).toFixed(1)+"deg");
    if(x<1) return requestAnimationFrame(frame);
    wheel.style.filter = ""; ptr.style.setProperty("--flap","0deg");
    rrAnim = false; rrMark(sp.idx); renderShow();
  };
  requestAnimationFrame(frame);
}

/* ---- Buchstabenwand ---- */
function rrWall(sh){
  const wall = $("rrWall"), grid = RRL.layout(sh.puzzle.text) || RRL.layout("?"), key = sh.round+":"+sh.puzzle.id;
  $("rrCat").textContent = sh.puzzle.cat;
  $("rrHint").textContent = sh.puzzle.hint ? "💡 " + sh.puzzle.hint : "";
  const cells = grid.flat();
  if(key!==rrWallKey){
    rrWallKey = key;
    wall.innerHTML = cells.map((c,i)=>`<div class="tile ${c===null ? "e" : RRL.isLetter(c) ? "l" : "p on now"}" style="--i:${i}"><div class="face f"></div><div class="face b">${c ? esc(c) : ""}</div></div>`).join("");
    cells.forEach((c,i)=>{ if(c && RRL.isLetter(c) && sh.used.includes(c)) wall.children[i].classList.add("on","now"); });
    wall.classList.remove("build"); void wall.offsetWidth; wall.classList.add("build");
    return;
  }
  let k = 0;
  cells.forEach((c,i)=>{
    const t = wall.children[i]; if(!t.classList.contains("l")) return;
    const want = sh.used.includes(c), has = t.classList.contains("on");
    if(want && !has){ const d = k++*160; t.classList.remove("now","hit"); t.style.setProperty("--dl", d+"ms"); t.classList.add("on","hit"); setTimeout(rrSfx.flip, d+150); }
    if(!want && has) t.classList.remove("on","hit");
  });
  if(k && fxLevel()>=2){ wall.classList.remove("zoom"); void wall.offsetWidth; wall.classList.add("zoom"); }
}

/* ---- Spielerkarten mit Ziffernwalzen ---- */
function odo(el, n){
  const s = String(Math.max(0, Math.round(n)));
  if(el.childElementCount!==s.length){ el.innerHTML = [...s].map(()=>`<span class="od"><span>${[...Array(10).keys()].map(d=>`<i>${d}</i>`).join("")}</span></span>`).join(""); void el.offsetWidth; }
  [...s].forEach((d,i)=>{ el.children[i].firstChild.style.transform = `translateY(${-d}em)`; });
  el.setAttribute("aria-label", rrFmt(n));
}
function rrPlayers(sh){
  const box = $("rrPlayers"), key = sh.players.map(p=>p.id).join();
  if(key!==rrCardsKey){
    rrCardsKey = key;
    box.innerHTML = sh.players.map((p,i)=>`<div class="rr-pc" data-pid="${esc(p.id)}" style="--pc:${PCOL[i%PCOL.length]}"><div class="av">${face(p)}</div>
      <div class="who"><b>${esc(p.name)}</b><span class="jk"></span></div>
      <div class="pts"><span class="odo r" data-k="round"></span><small>Runde</small></div><div class="pts tot"><span class="odo" data-k="total"></span><small>Konto</small></div></div>`).join("");
  }
  const live = ["turn","guess"].includes(sh.phase);
  sh.players.forEach((p,i)=>{
    const c = box.querySelector(`[data-pid="${CSS.escape(p.id)}"]`); if(!c) return;
    const act = live && i===sh.turn;
    if(act && !c.classList.contains("act") && innerWidth<900) c.scrollIntoView({behavior:"smooth", inline:"center", block:"nearest"});
    c.classList.toggle("act", act);
    c.classList.toggle("winner", sh.phase==="solved" && sh.ev && sh.ev.type==="solved" && sh.ev.pid===p.id);
    odo(c.querySelector('[data-k="round"]'), p.round); odo(c.querySelector('[data-k="total"]'), p.total);
    c.querySelector(".jk").textContent = p.jokers ? "🃏".repeat(Math.min(p.jokers,5)) : "";
  });
}

/* ---- Aktionsleiste & Tastatur ---- */
function rrControls(sh, lock){
  const p = sh.players[sh.turn], price = sh.settings.vowelPrice, t = sh.puzzle.text, busy = lock || rrAnim;
  const canSpin = !busy && sh.phase==="turn" && RRL.consonantsLeft(t, sh.used);
  const canBuy = !busy && sh.phase==="turn" && p.round>=price && RRL.vowelsLeft(t, sh.used);
  const last = sh.round>=sh.settings.rounds;
  rrHtml($("rrActions"), sh.phase==="solved"
    ? `<button class="arc go" data-rr="next">${last ? "🏆 Zum Finale" : `▶ Nächste Runde (${sh.round+1}/${sh.settings.rounds})`}</button>`
    : `<button class="arc spin" data-rr="spin" ${canSpin ? "" : "disabled"}>🎡 Drehen</button>
       <button class="arc buy ${rrBuy ? "on" : ""}" data-rr="buy" ${canBuy ? "" : "disabled"}>Vokal kaufen <small>${rrFmt(price)}</small></button>
       <button class="arc solve" data-rr="solve" ${!busy && sh.phase==="turn" ? "" : "disabled"}>Lösen</button>`);
  rrHtml($("rrKeys"), sh.phase==="solved" ? "" : RRL.ALPHA.map(L=>{
    const v = RRL.isVowel(L), used = sh.used.includes(L);
    const ok = !busy && !used && (v ? sh.phase==="turn" && p.round>=price : sh.phase==="guess");
    return `<button class="key ${v ? "vw" : "cs"}${used ? " used" : ""}${v && rrBuy ? " glow" : ""}" data-rr="key" data-l="${L}" ${ok ? "" : "disabled"} aria-label="${L}${v ? `, Vokal für ${price} Punkte` : ""}">${L}${v ? `<small>${price}</small>` : ""}</button>`;
  }).join(""));
}

/* ---- Ticker ---- */
function rrEvText(e, sh){
  const cur = sh.players[sh.turn], nx = cur ? cur.name : "";
  switch(e.type){
    case "round": return `Runde ${sh.round}: ${e.name} beginnt!`;
    case "value": return `${e.name} dreht ${rrFmt(e.v)}!`;
    case "jackpot": return `JACKPOT! ${rrFmt(e.v)} pro Treffer!`;
    case "hit": return e.vowel ? `${e.hits} × ${e.letter} gekauft (−${rrFmt(-e.pts)})` : `${e.hits} × ${e.letter} gefunden, +${rrFmt(e.pts)}`;
    case "miss": return e.solve ? `Leider falsch – ${nx} ist dran.` : `Kein ${e.letter} – ${nx} ist dran.`;
    case "saved": return `🃏 Joker eingesetzt – ${e.name} bleibt am Zug.`;
    case "bankrott": return `💥 BANKROTT! ${e.name} verliert ${rrFmt(e.lost)} Punkte.`;
    case "aussetzen": return `Aussetzen – ${nx} ist dran.`;
    case "extra": return `Extra-Drehung für ${e.name}!`;
    case "joker": return `🃏 ${e.name} bekommt einen Joker!`;
    case "solved": return `🎉 ${e.name} löst das Rätsel! +${rrFmt(e.pts)} aufs Konto.`;
    case "skip": return `Zug übersprungen – ${nx} ist dran.`;
    case "adjust": return `Spielleitung: ${e.name} ${e.delta>0 ? "+" : ""}${rrFmt(e.delta)} (${e.field==="total" ? "Konto" : "Runde"}).`;
    case "reveal": return `Spielleitung deckt ${e.letter} auf (${e.hits}×).`;
    case "undo": return "Letzter Schritt zurückgenommen.";
    default: return "";
  }
}
function rrTicker(sh){
  const p = sh.players[sh.turn];
  const help = sh.phase==="guess" ? `${p.name}: Konsonant wählen – ${rrFmt(sh.value)} pro Treffer.`
    : sh.phase==="turn" ? (RRL.consonantsLeft(sh.puzzle.text, sh.used) ? `${p.name} ist dran: drehen, Vokal kaufen oder lösen.` : `${p.name}: keine Konsonanten mehr – Vokal kaufen oder lösen.`)
    : sh.phase==="solved" ? "Weiter geht's mit dem nächsten Rätsel." : "";
  if(rrWarn && Date.now()<rrWarn.until) return rrTickerSet(rrWarn.text, help, true);
  rrTickerSet(sh.ev ? rrEvText(sh.ev, sh) : "Willkommen zur Show!", help, sh.ev && ["miss","bankrott"].includes(sh.ev.type));
}
function rrTickerSet(a, b, bad){ const t = $("rrTicker"); if(!t) return; t.firstChild.textContent = a; t.lastChild.textContent = b||""; t.classList.toggle("bad", !!bad); }
function rrSay(text){ rrWarn = {text, until:Date.now()+2600}; const sh = state.show; if(sh && $("rrTicker")) rrTicker(sh); setTimeout(()=>{ if(state.show && $("rrTicker") && !rrAnim) rrTicker(state.show); }, 2700); }

/* ---- Effekte zu Ereignissen ---- */
function rrLand(text, cls){ const l = $("rrLand"); l.textContent = text; l.className = "rr-land"; void l.offsetWidth; l.className = "rr-land pop " + (cls||""); }
function rrFloat(text, pid, neg){
  if(fxLevel()<1) return;
  const card = document.querySelector(`.rr-pc[data-pid="${CSS.escape(pid||"")}"]`), from = $("rrWall").getBoundingClientRect(); if(!card) return;
  const to = card.getBoundingClientRect(), f = document.createElement("div");
  f.className = "rr-float" + (neg ? " neg" : ""); f.textContent = text; document.body.appendChild(f);
  const at = (x,y,s) => `translate(${x}px,${y}px) translate(-50%,-50%) scale(${s})`;
  f.animate([{transform:at(from.left+from.width/2, from.top+from.height/2, .6), opacity:0},{transform:at(from.left+from.width/2, from.top+from.height/2-30, 1.6), opacity:1, offset:.3},
    {transform:at(to.left+to.width/2, to.top+to.height/2, .7), opacity:.3}], {duration:1200, easing:"cubic-bezier(.5,0,.3,1)"}).onfinish = () => f.remove();
}
function rrFlash(cls){ const r = $("rr"); r.classList.remove(cls); void r.offsetWidth; r.classList.add(cls); setTimeout(()=>r.classList.remove(cls), 1200); }
function rrEffect(e, sh){
  const card = id => document.querySelector(`.rr-pc[data-pid="${CSS.escape(id||"")}"]`);
  switch(e.type){
    case "value": rrLand(rrFmt(e.v)); rrSfx.ding(); break;
    case "jackpot": rrLand("JACKPOT " + rrFmt(e.v), "jack"); fanfare(false); if(fxLevel()>=2) confetti($("fx")); break;
    case "extra": rrLand("EXTRA-DREH", "extra"); rrSfx.ding(); break;
    case "joker": rrLand("🃏 JOKER", "joker"); rrSfx.ding(); break;
    case "aussetzen": rrLand("AUSSETZEN", "skip"); rrSfx.buzz(); break;
    case "bankrott": {
      rrLand("BANKROTT", "bank"); rrSfx.bank(); rrFlash("bankrott");
      const c = card(e.pid); if(c){ c.classList.remove("crumble"); void c.offsetWidth; c.classList.add("crumble"); }
      break; }
    case "hit": setTimeout(()=>rrFloat(`${e.pts>0 ? "+" : "−"}${rrFmt(Math.abs(e.pts))}`, e.pid, e.pts<0), 300); break;
    case "miss": rrSfx.buzz(); rrFlash("miss"); break;
    case "saved": rrSfx.ding(); break;
    case "solved": {
      rrSfx.ding(); fanfare(true); rrFlash("solved");
      if(fxLevel()>=1) confetti($("fx"), fxLevel()>=2 ? 3500 : 1500);
      const c = card(e.pid); if(c){ const cr = document.createElement("div"); cr.className = "rr-crown"; cr.textContent = "👑"; c.appendChild(cr); setTimeout(()=>cr.remove(), 3500); }
      break; }
    case "round": $("rrLand").className = "rr-land"; rrMark(-1); break;
  }
}
function rrIntro(sh){
  if(fxLevel()===0) return;
  const o = document.createElement("div"); o.className = "rr-intro";
  o.innerHTML = `<div class="rr-intro-logo">${[..."RÄTSELRAD"].map((c,i)=>`<span style="--i:${i}">${c}</span>`).join("")}</div>
    <div class="rr-intro-sub">${esc(sh.settings.event)} · Familien-Olympiade</div><div class="rr-intro-skip">Tippen zum Überspringen</div>`;
  const close = () => { o.classList.add("out"); setTimeout(()=>o.remove(), 400); };
  o.onclick = close; $("rr").appendChild(o); $("rr").classList.add("intro");
  setTimeout(()=>$("rr") && $("rr").classList.remove("intro"), 2400);
  fanfare(true); setTimeout(close, 3200);
}

/* ---- Modale Fenster ---- */
function rrModal(html){ $("rrMbox").innerHTML = `<button class="ghost sm ic rr-x" data-rr="close" aria-label="Schließen">✕</button>` + html; $("rrModal").hidden = false; const f = $("rrMbox").querySelector("input,button:not(.rr-x)"); if(f) f.focus(); }
function rrClose(){ if($("rrModal")) $("rrModal").hidden = true; }
function rrSolveModal(){
  const sh = state.show, p = sh.players[sh.turn];
  rrModal(`<h3>Rätsel lösen – ${esc(p.name)}</h3><p class="hint">Lösung eintippen und prüfen lassen – oder die Spielleitung entscheidet direkt.</p>
    <form id="rrSolveForm" autocomplete="off"><input class="txt" id="rrGuess" placeholder="Lösung …" autocapitalize="characters" spellcheck="false"><button class="pri" type="submit">Prüfen</button></form>
    <div class="row" style="margin-top:14px"><button class="arc go sm" data-rr="right">✓ Richtig</button><button class="arc bad sm" data-rr="wrong">✗ Falsch</button></div>`);
  $("rrSolveForm").onsubmit = e => { e.preventDefault(); const g = $("rrGuess").value; rrClose(); rrDo({type:"solve", guess:g}); };
}
function rrHost(){
  const sh = state.show; if(!sh) return;
  const adj = (p,f) => `<span class="rr-adj"><button class="ghost sm" data-rr="adj" data-pid="${esc(p.id)}" data-f="${f}" data-d="-50">−50</button><b>${rrFmt(p[f])}</b><button class="ghost sm" data-rr="adj" data-pid="${esc(p.id)}" data-f="${f}" data-d="50">+50</button></span>`;
  rrModal(`<h3>🎛️ Spielleitung</h3>
    <div class="row"><button class="ghost" data-rr="undo" ${sh.undo ? "" : "disabled"}>↶ Letzten Schritt zurück</button><button class="ghost" data-rr="skip" ${["turn","guess"].includes(sh.phase) ? "" : "disabled"}>⏭ Zug überspringen</button></div>
    <div class="sub">Buchstabe aufdecken (ohne Punkte)</div>
    <div class="rr-mini">${RRL.ALPHA.map(L=>`<button class="key" data-rr="reveal" data-l="${L}" ${sh.used.includes(L) ? "disabled" : ""}>${L}</button>`).join("")}</div>
    <div class="sub">Punkte korrigieren</div>
    <table class="rr-adjt"><tr><th></th><th>Runde</th><th>Konto</th></tr>${sh.players.map(p=>`<tr><td>${who(p)}</td><td>${adj(p,"round")}</td><td>${adj(p,"total")}</td></tr>`).join("")}</table>
    <div class="row" style="margin-top:16px"><button class="ghost" data-rr="finish">🏁 Show jetzt beenden</button><button class="danger" data-rr="abort">✕ Show abbrechen</button></div>
    <p class="hint">Abbrechen löscht nur die laufende Show – Olympiade, Rätsel und Einstellungen bleiben.</p>`);
}

/* ---- Studio-Modus (TV / Beamer) ---- */
function rrTv(on){
  document.body.classList.toggle("rrtv", on);
  try{ if(on) document.documentElement.requestFullscreen().catch(()=>{}); else if(document.fullscreenElement) document.exitFullscreen().catch(()=>{}); }catch(e){}
  try{ history.replaceState(null, "", on ? "#show-live" : "#show"); }catch(e){}
}

/* ---- Start- und Endbildschirm ---- */
function rrSetupHTML(){
  const src = rrSource(), pick = rrPickList(), set = rrSettings(), manual = set.playerOrder==="manual";
  const free = rrPuzzles().filter(p=>RRL.layout(p.text)).length;
  return `<div class="rr rr-setup">
    <div class="rr-hero"><div class="rr-logo big">${[..."RÄTSELRAD"].map((c,i)=>`<span style="--i:${i}">${c}</span>`).join("")}</div>
      <div class="rr-sub">Die Buchstaben-Show der Familien-Olympiade</div><span class="pill">📅 ${esc(set.event)}</span></div>
    <div class="admin">
      <section class="panel"><h2 class="h">Kandidaten <small>${manual ? "Reihenfolge = Antipp-Reihenfolge" : "Reihenfolge wird ausgelost"}</small></h2>
        ${pickerHTML("rr", src, 6, manual)}
        <p class="hint">${O() ? "Zur Auswahl stehen die Spieler der laufenden Olympiade. " : ""}2 bis 6 Spieler · ${pick.length} gewählt.</p></section>
      <section class="panel"><h2 class="h">So läuft's</h2><ul class="rr-rules">
        <li>Drehen, Konsonant wählen: Feldwert × Treffer. Treffer = nochmal dran.</li>
        <li>Vokal kaufen kostet ${rrFmt(set.vowelPrice)} Punkte – auch ohne Treffer.</li>
        <li>Bankrott: Rundenpunkte weg. Joker verzeiht einen Fehlversuch.</li>
        <li>Wer löst, bringt seine Rundenpunkte aufs Konto. ${set.rounds} Runden, ${free} Rätsel bereit.</li></ul></section>
    </div>
    <div class="row center" style="margin-top:22px"><button class="pri big" data-rr="start" ${pick.length>=2 && pick.length<=6 ? "" : "disabled"}>🎬 Show starten</button><button class="ghost" data-view="verwaltung">Rätsel &amp; Einstellungen</button></div>
  </div>`;
}
function rrEndHTML(sh){
  const rk = RRL.ranking(sh), ol = O();
  const canT = ol && !sh.transferred && rk.some(p=>ol.roster.some(r=>r.id===p.id));
  return `<div class="rr rr-end">
    <div class="rr-hero"><div class="k">Finale · ${esc(sh.settings.event)}</div><div class="rr-logo big">${[..."SIEGEREHRUNG"].map((c,i)=>`<span style="--i:${i}">${c}</span>`).join("")}</div></div>
    <div class="rr-final">${rk.map((p,i)=>`<div class="rr-fr ${i===0 ? "first" : ""}" style="--i:${i}"><span class="pos">${i+1}</span><span class="orb" style="--pc:${PCOL[i%PCOL.length]}">${face(p)}</span><b>${esc(p.name)}${i===0 ? " 👑" : ""}</b><span class="sc"><b>${rrFmt(p.total)}</b><small>PKT</small></span></div>`).join("")}</div>
    <div class="row center" style="margin-top:22px">
      ${canT ? `<button class="pri big" data-rr="transfer">🏆 Punkte in die Olympiade übertragen</button>` : sh.transferred ? `<span class="pill st-done">✓ In die Olympiade übertragen</span>` : `<span class="hint">Ohne laufende Olympiade werden keine Punkte übertragen.</span>`}
      <button class="ghost" data-rr="new">🔁 Neue Show</button></div>
  </div>`;
}

/* ---------------- Rätselverwaltung & Einstellungen (Bereich „Verwaltung“) ---------------- */
function rrAdmin(){
  const box = $("rrAdmin"); if(!box) return;
  if(!rrAdminBuilt){
    rrAdminBuilt = true;
    box.innerHTML = `<h2 class="h">Rätselrad <small>Show-Einstellungen &amp; Rätsel</small></h2>
      <div class="rr-set">
        <label>Eventangabe<input class="txt" data-rrs="event"></label>
        <label>Runden<input class="txt" type="number" min="1" max="10" data-rrs="rounds"></label>
        <label>Vokalpreis<input class="txt" type="number" min="0" step="50" data-rrs="vowelPrice"></label>
        <label>Jackpot-Wert<input class="txt" type="number" min="0" step="100" data-rrs="jackpotValue"></label>
        <label class="wide">Radwerte (mit Komma)<input class="txt" data-rrs="values"></label>
        <label>Spielerreihenfolge<select class="txt" data-rrs="playerOrder"><option value="random">zufällig</option><option value="manual">wie angetippt</option></select></label>
        <label>Rätselreihenfolge<select class="txt" data-rrs="puzzleOrder"><option value="random">zufällig</option><option value="manual">wie in der Liste</option></select></label>
        <label class="toggle"><input type="checkbox" data-rrs="joker"> Joker-Feld</label>
        <label class="toggle"><input type="checkbox" data-rrs="jackpot"> Jackpot-Feld</label>
      </div>
      <p class="hint">Änderungen gelten ab der nächsten Show.</p>
      <div class="sub">Neues Rätsel</div>
      <form class="rr-add" id="rrAddForm" autocomplete="off">
        <input class="txt" id="rrNewText" placeholder="Rätseltext, z. B. Ein Tag am Meer" maxlength="60">
        <select class="txt" id="rrNewCat">${RR_CATS.map(c=>`<option>${c}</option>`).join("")}</select>
        <input class="txt" id="rrNewHint" placeholder="Hinweis (optional)" maxlength="60">
        <button class="pri" type="submit">+ Rätsel</button>
      </form>
      <div class="hint" id="rrAddHint"></div>
      <div class="row between" style="margin:16px 0 8px"><div class="sub" style="margin:0" id="rrCount"></div>
        <div class="row"><button class="ghost sm" data-rr="export">⬇ Export</button><label class="btn ghost sm">⬆ Import<input type="file" accept=".json,application/json" id="rrImport" hidden></label><button class="ghost sm" data-rr="unplay">Gespielt-Marken zurücksetzen</button></div></div>
      <div id="rrList"></div>`;
    $("rrAddForm").onsubmit = e => {
      e.preventDefault();
      const text = $("rrNewText").value.trim(); if(!text) return;
      if(!RRL.layout(text)){ $("rrAddHint").textContent = "⚠️ Passt nicht auf die Wand: höchstens 4 Zeilen à 14 Zeichen, kein Wort länger als 14."; return; }
      const list = rrPuzzles(); list.push({id:uid(), text, cat:$("rrNewCat").value, hint:$("rrNewHint").value.trim()});
      state.rrPuzzles = list; $("rrNewText").value = $("rrNewHint").value = ""; $("rrAddHint").textContent = "✓ Rätsel hinzugefügt."; commit();
    };
    $("rrImport").onchange = e => { const f = e.target.files[0]; if(f) f.text().then(rrImport); e.target.value = ""; };
    box.addEventListener("change", e=>{
      const k = e.target.dataset.rrs; if(!k) return;
      const s = Object.assign({}, state.rrSettings), v = e.target;
      s[k] = v.type==="checkbox" ? v.checked : v.type==="number" ? Math.max(+v.min||0, Math.round(+v.value||0))
        : k==="values" ? v.value.split(/[,;\s]+/).map(Number).filter(n=>n>0).slice(0,20) : v.value.trim();
      if(k==="rounds") s[k] = Math.min(10, Math.max(1, s[k]));
      if(k==="values" && !s[k].length) delete s[k];
      state.rrSettings = s; commit();
    });
  }
  const s = rrSettings();
  box.querySelectorAll("[data-rrs]").forEach(el=>{
    if(el===document.activeElement) return;
    const v = s[el.dataset.rrs];
    if(el.type==="checkbox") el.checked = !!v; else el.value = Array.isArray(v) ? v.join(", ") : v;
  });
  const list = rrPuzzles(), sh = state.show;
  $("rrCount").textContent = `${list.length} Rätsel · ${list.filter(p=>!p.lastPlayed).length} noch ungespielt`;
  rrHtml($("rrList"), `<div class="rr-plist">${list.map((p,i)=>{
    const inShow = sh && sh.played.includes(p.id), bad = !RRL.layout(p.text);
    if(rrEditId===p.id) return `<div class="rr-prow edit" data-id="${esc(p.id)}"><input class="txt" data-pe="text" value="${esc(p.text)}" maxlength="60">
      <select class="txt" data-pe="cat">${RR_CATS.map(c=>`<option ${c===p.cat ? "selected" : ""}>${c}</option>`).join("")}</select>
      <input class="txt" data-pe="hint" value="${esc(p.hint||"")}" placeholder="Hinweis" maxlength="60"><button class="pri sm" data-rr="p-save" data-id="${esc(p.id)}">✓</button></div>`;
    return `<div class="rr-prow${p.lastPlayed ? " played" : ""}"><span class="cat" style="--cc:#00F5FF">${esc(p.cat)}</span>
      <span class="tx">${esc(p.text)}${p.hint ? `<small>💡 ${esc(p.hint)}</small>` : ""}${bad ? `<small class="warn">passt nicht auf die Wand</small>` : ""}</span>
      <span class="hint">${inShow ? "✓ in dieser Show" : p.lastPlayed ? "gespielt " + new Date(p.lastPlayed).toLocaleDateString("de-DE") : ""}</span>
      <span class="rr-pbtn"><button class="ghost sm ic" data-rr="p-up" data-id="${esc(p.id)}" ${i ? "" : "disabled"} aria-label="nach oben">↑</button><button class="ghost sm ic" data-rr="p-edit" data-id="${esc(p.id)}" aria-label="bearbeiten">✏️</button><button class="ghost sm ic" data-rr="p-del" data-id="${esc(p.id)}" aria-label="löschen">🗑️</button></span></div>`;
  }).join("")}</div>`);
}
function rrImport(txt){
  try{
    const d = JSON.parse(txt), arr = Array.isArray(d) ? d : d.puzzles;
    if(!Array.isArray(arr)) throw 0;
    const list = rrPuzzles(), have = new Set(list.map(p=>RRL.norm(p.text)));
    let ok = 0, skip = 0;
    arr.forEach(x=>{ const text = String(x && x.text || "").trim();
      if(!text || !RRL.layout(text) || have.has(RRL.norm(text))){ skip++; return; }
      have.add(RRL.norm(text)); ok++;
      list.push({id:uid(), text, cat:RR_CATS.includes(String(x.cat).toUpperCase()) ? String(x.cat).toUpperCase() : "ALLES MÖGLICHE", hint:String(x.hint||"").slice(0,60)}); });
    state.rrPuzzles = list; commit(); toast(`📥 ${ok} Rätsel importiert${skip ? `, ${skip} übersprungen` : ""}.`);
  }catch(e){ toast("⚠️ Datei nicht lesbar – erwartet wird eine JSON-Liste mit text, cat, hint."); }
}

/* ---------------- Bedienung ---------------- */
document.addEventListener("click", e=>{
  if(e.target.id==="rrModal"){ rrClose(); return; }
  const b = e.target.closest("[data-rr]"); if(!b) return;
  const k = b.dataset.rr, id = b.dataset.id, sh = state.show;
  const listOp = fn => { const list = rrPuzzles(); fn(list, list.findIndex(p=>p.id===id)); state.rrPuzzles = list; commit(); };
  switch(k){
    case "spin": rrSpin(); break;
    case "buy": rrBuy = !rrBuy; rrControls(sh); if(rrBuy) rrSay(`Tippe einen Vokal – kostet ${rrFmt(sh.settings.vowelPrice)} Punkte.`); break;
    case "key": rrLetter(b.dataset.l); break;
    case "solve": rrSolveModal(); break;
    case "right": rrClose(); rrDo({type:"solve", correct:true}); break;
    case "wrong": rrClose(); rrDo({type:"solve", correct:false}); break;
    case "next": rrNextRound(); break;
    case "host": rrHost(); break;
    case "close": rrClose(); break;
    case "undo": rrUndo(); rrHost(); break;
    case "skip": rrDo({type:"skip"}); rrHost(); break;
    case "reveal": rrDo({type:"reveal", letter:b.dataset.l}); rrHost(); break;
    case "adj": rrDo({type:"adjust", pid:b.dataset.pid, field:b.dataset.f, delta:+b.dataset.d}); rrHost(); break;
    case "finish": confirmTap(b, ()=>{ rrClose(); rrDo({type:"finish"}); }); break;
    case "abort": confirmTap(b, ()=>{ rrClose(); rrTv(false); state.show = null; commit(); toast("Show abgebrochen – alles andere bleibt."); }); break;
    case "tv": rrTv(!document.body.classList.contains("rrtv")); break;
    case "sound": setSound(!soundOn); renderShow(); break;
    case "fx": { const i = (RR_FX.indexOf(rrFxSetting())+1) % RR_FX.length; try{ localStorage.setItem("rr-fx", RR_FX[i]); }catch(e){} renderShow(); rrSay("Effekte: " + RR_FX[i]); break; }
    case "start": rrStart(); break;
    case "transfer": rrTransfer(); break;
    case "new": state.show = null; commit(); break;
    case "export": {
      const blob = new Blob([JSON.stringify({puzzles:rrPuzzles().map(({id,text,cat,hint})=>({text,cat,hint}))}, null, 2)], {type:"application/json"});
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "raetselrad-raetsel.json"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000); break; }
    case "unplay": listOp(list=>list.forEach(p=>delete p.lastPlayed)); break;
    case "p-up": listOp((list,i)=>{ if(i>0) [list[i-1], list[i]] = [list[i], list[i-1]]; }); break;
    case "p-edit": rrEditId = id; rrAdmin(); break;
    case "p-del": confirmTap(b, ()=>listOp((list,i)=>{ if(i>=0) list.splice(i,1); })); break;
    case "p-save": {
      const row = b.closest(".rr-prow"), v = f => row.querySelector(`[data-pe="${f}"]`).value.trim(), text = v("text");
      if(!RRL.layout(text)){ toast("⚠️ Passt nicht auf die Wand (max. 4 Zeilen à 14 Zeichen)."); break; }
      rrEditId = null; listOp((list,i)=>{ if(i>=0) Object.assign(list[i], {text, cat:v("cat"), hint:v("hint")}); }); break; }
  }
});
// Physische Tastatur: Buchstaben, Enter = drehen, Esc = schließen
document.addEventListener("keydown", e=>{
  if(curView!=="show" || !state.show || e.ctrlKey || e.metaKey || e.altKey) return;
  if(e.key==="Escape"){ if($("rrModal") && !$("rrModal").hidden) rrClose(); else if(document.body.classList.contains("rrtv")) rrTv(false); return; }
  if(e.target.closest("input,textarea,select") || ($("rrModal") && !$("rrModal").hidden)) return;
  const L = e.key.length===1 ? e.key.toUpperCase() : "";
  if(RRL.isLetter(L) && state.show.phase!=="end"){ e.preventDefault(); rrLetter(L); }
  else if(e.key==="Enter" && state.show.phase==="turn"){ e.preventDefault(); rrSpin(); }
  else if(e.key==="Enter" && state.show.phase==="solved"){ e.preventDefault(); rrNextRound(); }
});
// Tiefe: Wand, Rad und Spielerkarten bewegen sich leicht unterschiedlich mit der Maus
addEventListener("pointermove", e=>{
  const r = $("rr"); if(!r || curView!=="show" || fxLevel()<3 || !matchMedia("(hover:hover)").matches) return;
  r.style.setProperty("--mx", (e.clientX/innerWidth-.5).toFixed(3)); r.style.setProperty("--my", (e.clientY/innerHeight-.5).toFixed(3));
}, {passive:true});

if(location.hash==="#show-live"){ go("show"); rrTv(true); }
if(ensureShowGame()){ keepLocal(); render(); }   // nur lokal – online übernimmt connect() das Speichern
renderShow();
