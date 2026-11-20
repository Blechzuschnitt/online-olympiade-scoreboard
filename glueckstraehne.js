/* =====================================================================
   Glückssträhne – Kartenspiel der Familien-Olympiade (Oberfläche)
   Regeln: glueckstraehne-logic.js (GSL). Speicher & Sync: state.gs über commit().
   ===================================================================== */
const GS_ACT = {S:["🛡️","SCHUTZ-SCHILD","fängt eine doppelte Zahl ab"], F:["✋","STOPP","jemand muss sofort sichern"], Z:["⚡","ZUGZWANG","jemand muss 2 Karten ziehen"]};
let gsMe = null; try{ gsMe = localStorage.getItem("gs-me"); }catch(e){}
let gsSeen = new Set(), gsLastEv = null, gsInit = false, gsTarget = 200;
picks.gs = picks.gs || [];
const gsHue = n => 188 + n*11;                       // 0 = Cyan … 12 = Magenta

function gsDo(a){
  const r = GSL.act(state.gs, a);
  if(r.err){ toast(r.err); return; }
  state.gs = r.state; commit();
}
const gsCan = pid => gsMe==="all" || gsMe===pid;     // darf dieses Gerät für pid spielen?

/* ---------- Karten ---------- */
function gsCard(c, fresh){
  const k = c.k, t = GSL.kind(k), cls = `gcard ${t}${fresh && gsInit ? " fresh" : ""}`;
  if(t==="num"){
    const n = GSL.val(k), copies = Math.max(1, n);
    return `<div class="${cls}" style="--h:${gsHue(n)}" data-cid="${c.id}"><span class="cx tl">${n}</span><span class="cx br">${n}</span>
      <b class="big">${n}</b><span class="pips" aria-hidden="true">${"<i></i>".repeat(copies)}</span></div>`;
  }
  if(t==="boost") return `<div class="${cls}" data-cid="${c.id}"><span class="lbl">BOOST</span><b class="big">${k==="x2" ? "×2" : "+"+GSL.val(k)}</b><span class="lbl">${k==="x2" ? "Zahlen doppelt" : "Punkte"}</span></div>`;
  const a = GS_ACT[k];
  return `<div class="${cls} a${k}" data-cid="${c.id}"><span class="ico">${a[0]}</span><b class="name">${a[1]}</b><span class="lbl">${a[2]}</span></div>`;
}
const gsBack = (extra="") => `<div class="gcard back ${extra}"><span class="seal">7</span></div>`;

/* ---------- Bildschirme ---------- */
function renderGs(){
  const root = $("gsRoot"); if(!root || typeof GSL==="undefined") return;
  const S = state.gs;
  if(!S){ gsInit = false; return gsHtml(root, gsSetupHTML()); }
  const ids = new Set(S.players.flatMap(p=>p.row.map(c=>c.id)));
  if(!gsInit){ gsSeen = ids; gsLastEv = S.ev && S.ev.id; }
  root.innerHTML = gsTableHTML(S);
  root._html = null;
  const ev = S.ev && S.ev.id!==gsLastEv ? S.ev : null;
  gsLastEv = S.ev && S.ev.id; gsSeen = ids; gsInit = true;
  if(ev) gsEffects(ev, S);
}
function gsHtml(el, h){ if(el._html!==h){ el._html = h; el.innerHTML = h; } }

function gsSetupHTML(){
  const pool = O() ? O().roster : state.players, n = picks.gs.filter(id=>pool.some(p=>p.id===id)).length;
  return `<div class="gs gs-setup">
    <div class="gs-hero"><div class="gs-logo">GLÜCKS<span>STRÄHNE</span></div><div class="gs-sub">Aufdecken, zocken, sichern – bevor das Glück reißt</div>
      <div class="gs-fan" aria-hidden="true">${[3,7,12,0].map((n,i)=>gsCard({k:"n"+n, id:"demo"+i})).join("")}${gsCard({k:"S", id:"demo-s"})}</div></div>
    <div class="admin">
      <section class="panel"><h2 class="h">Mitspieler <small>2 bis 8</small></h2>${pickerHTML("gs", pool, 8)}
        <div class="sub" style="margin-top:18px">Ziel</div>
        <div class="row">${[100,150,200].map(t=>`<button class="${gsTarget===t?"pri":"ghost"} sm" data-gs="target" data-t="${t}">${t} Punkte</button>`).join("")}</div></section>
      <section class="panel"><h2 class="h">So läuft's</h2><ul class="gs-rules">
        <li>Reihum: <b>Karte ziehen</b> oder <b>sichern</b>. Gesicherte Punkte sind sicher.</li>
        <li>Zieh nie eine Zahl doppelt – sonst bist du raus und bekommst 0.</li>
        <li><b>7 verschiedene Zahlen</b> beenden die Runde sofort: +15 Bonus.</li>
        <li>🛡️ Schild rettet einmal · ✋ Stopp zwingt jemanden zum Sichern · ⚡ Zugzwang: jemand zieht 2.</li>
        <li>Booster +2 … +10 und ×2 (verdoppelt deine Zahlen). Wer zuerst ${gsTarget} erreicht, gewinnt.</li></ul></section>
    </div>
    <div class="row center" style="margin-top:20px"><button class="pri big" data-gs="start" ${n>=2 ? "" : "disabled"}>🃏 Spiel starten</button><button class="ghost" data-view="spiele">← Spiele</button></div>
  </div>`;
}

function gsRow(S, p, i, big){
  const act = S.phase==="play" && i===S.turn && p.status==="in", sc = GSL.rowScore(p);
  const badge = {in:act ? "AM ZUG" : "", stay:"🔒 GESICHERT", bust:"💥 RAUS", seven:"🌟 SIEBEN!"}[p.status];
  const nums = new Set(GSL.numbers(p.row)).size;
  return `<div class="gs-seat${big ? " big" : ""}${act ? " act" : ""} st-${p.status}" data-pid="${esc(p.id)}">
    <div class="gs-head"><span class="who">${who(p)}${p.shield ? ` <span title="Schutzschild">🛡️</span>` : ""}</span>${badge ? `<span class="gs-badge">${badge}</span>` : ""}
      <span class="gs-pts"><b>${p.status==="bust" ? 0 : sc}</b><small>Runde</small></span><span class="gs-pts tot"><b>${p.total}</b><small>Konto</small></span></div>
    <div class="gs-cards">${p.row.map(c=>gsCard(c, !gsSeen.has(c.id))).join("") || `<span class="gs-empty">${big ? "Noch keine Karte – zieh die erste!" : "–"}</span>`}</div>
    ${big ? `<div class="gs-meter" aria-label="${nums} von 7 verschiedenen Zahlen">${Array.from({length:7},(_,k)=>`<i class="${k<nums ? "on" : ""}"></i>`).join("")}<span>${nums}/7 verschiedene</span></div>` : ""}
  </div>`;
}
function gsTableHTML(S){
  const cur = S.players[S.turn], chooser = S.pending && S.players.find(p=>p.id===S.pending.from);
  const seated = S.players.some(p=>p.id===gsMe);
  const bigP = seated ? S.players.find(p=>p.id===gsMe) : cur;
  const others = S.players.filter(p=>p!==bigP);
  let ctrl = "";
  if(S.phase==="play"){
    if(S.pending) ctrl = gsCan(chooser.id)
      ? `<div class="gs-choose"><b>${GS_ACT[S.pending.type][0]} ${GS_ACT[S.pending.type][1]}:</b> Wen triffst du?<div class="row">${S.players.filter(p=>p.status==="in").map(p=>`<button class="ghost" data-gs="choose" data-pid="${esc(p.id)}">${who(p)}${p.id===chooser.id ? " (ich)" : ""}</button>`).join("")}</div></div>`
      : `<div class="gs-wait">${esc(chooser.name)} wählt, wen ${GS_ACT[S.pending.type][1]} trifft …</div>`;
    else ctrl = gsCan(cur.id)
      ? `<div class="row center"><button class="arc spin" data-gs="draw">🃏 Ziehen</button><button class="arc solve" data-gs="stay" ${cur.row.length ? "" : "disabled"}>🔒 Sichern <small>${GSL.rowScore(cur)} P</small></button></div>`
      : `<div class="gs-wait">${who(cur)} ist am Zug …</div>`;
  }
  const last = S.last;
  const roundBox = S.phase!=="play" ? `<div class="gs-round">
      <div class="k">${S.phase==="over" ? "Spielende" : `Runde ${last.round} vorbei`}</div>
      <div class="gs-res">${GSL.ranking(S).map((p,i)=>{ const j = S.players.indexOf(p); return `<div class="${i===0 && S.phase==="over" ? "win" : ""}"><span>${i+1}.</span><span>${who(p)}</span><em>${last.status[j]==="bust" ? "raus" : "+"+last.scores[j]}</em><b>${p.total}</b></div>`; }).join("")}</div>
      <div class="row center">${S.phase==="over"
        ? `${O() && !S.transferred ? `<button class="pri" data-gs="transfer">🏆 In die Olympiade übertragen</button>` : S.transferred ? `<span class="pill">✓ übertragen</span>` : ""}<button class="ghost" data-gs="new">🔁 Neues Spiel</button>`
        : `<button class="pri big" data-gs="next">▶ Nächste Runde</button>`}</div></div>` : "";
  const humans = S.players;
  return `<div class="gs">
    <div class="gs-top">
      <div class="gs-brand"><span class="gs-logo sm">GLÜCKS<span>STRÄHNE</span></span><span class="pill">Runde ${S.round} · Ziel ${S.target}</span></div>
      <div class="gs-me">Ich bin: ${humans.map(p=>`<button class="chip${gsMe===p.id ? " on" : ""}" data-gs="me" data-pid="${esc(p.id)}">${who(p)}</button>`).join("")}<button class="chip${gsMe==="all" ? " on" : ""}" data-gs="me" data-pid="all">📱 Alle hier</button></div>
    </div>
    <div class="gs-main">
      <div class="gs-pile">
        <div class="gs-deck">${gsBack("d3")}${gsBack("d2")}${gsBack("d1")}<span class="gs-count">${S.deck.length}</span></div>
        <div class="gs-msg" id="gsMsg">${gsMsg(S)}</div>
        ${ctrl}${roundBox}
      </div>
      ${gsRow(S, bigP, S.players.indexOf(bigP), true)}
    </div>
    <div class="gs-others">${others.map(p=>gsRow(S, p, S.players.indexOf(p), false)).join("")}</div>
    <div class="row center" style="margin-top:14px"><button class="ghost sm" data-gs="quit">Spiel beenden</button><button class="ghost sm" data-view="spiele">← Spiele</button></div>
    <div class="gs-banner" id="gsBanner"></div>
  </div>`;
}
function gsMsg(S){
  const e = S.ev && S.ev.items.slice().reverse().find(x=>x.type!=="card") , nm = id => (S.players.find(p=>p.id===id)||{}).name;
  if(!e) { const c = S.ev && S.ev.items.find(x=>x.type==="card"), cur = S.players[S.turn];
    return c ? `${esc(nm(c.pid))} hat gezogen${S.phase==="play" && cur.id!==c.pid ? ` – ${esc(cur.name)} ist dran` : ""}.` : "Los geht's!"; }
  return esc({bust:`💥 ${nm(e.pid)} hat eine Zahl doppelt – raus!`, shield:`🛡️ Der Schild rettet ${nm(e.pid)}!`, seven:`🌟 ${nm(e.pid)} hat 7 verschiedene Zahlen!`,
    stay:`🔒 ${nm(e.pid)} sichert.`, stopp:`✋ ${nm(e.by)} stoppt ${nm(e.pid)}.`, zugzwang:`⚡ ${nm(e.by)} zwingt ${nm(e.pid)} zu 2 Karten!`,
    roundEnd:"Runde vorbei!", over:"Spielende!", round:"Neue Runde – neues Glück.", start:"Los geht's!"}[e.type] || "");
}

/* ---------- Effekte ---------- */
function gsEffects(ev, S){
  for(const e of ev.items){
    const seat = e.pid && document.querySelector(`.gs-seat[data-pid="${CSS.escape(e.pid)}"]`);
    if(e.type==="bust" && seat){ seat.classList.add("shatter"); if(typeof rrTone==="function") rrTone(160, .5, "sawtooth", .08, 60); }
    if(e.type==="seven"){ gsBanner("🌟 SIEBEN! +15"); confetti($("fx"), 2500); fanfare(true); }
    if(e.type==="shield" && seat){ seat.classList.add("saved"); gsBanner("🛡️ GERETTET"); }
    if(e.type==="over"){ confetti($("fx"), 4000); fanfare(true); }
  }
  if(ev.items.some(x=>x.type==="card")) wclick(.35);
}
function gsBanner(t){ const b = $("gsBanner"); if(!b) return; b.textContent = t; b.className = "gs-banner"; void b.offsetWidth; b.className = "gs-banner show"; }

/* ---------- Ergebnis in die Olympiade (über die vorhandene Rundenwertung) ---------- */
function gsTransfer(){
  const S = state.gs, ol = O(); if(!S || !ol || S.transferred) return;
  if(state.pending && state.pending.gameId!=="glueckstraehne"){ toast(`Erst die laufende Runde „${state.pending.gameName}“ eintragen.`); return; }
  const order = GSL.ranking(S).filter(p=>p.total>0).map(p=>p.id).filter(id=>ol.roster.some(r=>r.id===id));
  if(!order.length){ toast("Niemand aus der Olympiade hat Punkte – nichts zu übertragen."); return; }
  const g = game("glueckstraehne") || {name:"Glückssträhne", icon:"🃏"};
  state.pending = Object.assign({gameId:"glueckstraehne", gameName:g.name, icon:g.icon, double:!!g.double}, state.pending||{}, {order});
  const w = saveRound(); S.transferred = true; commit();
  toast(`🏆 ${w ? w.name : "?"} gewinnt ${g.name} – Punkte sind in der Olympiade!`);
}
// Spieleintrag in der Bibliothek; der alte Flip-7-Eintrag wird dabei entfernt
function ensureGsGame(){
  let changed = false;
  const old = state.library.filter(g=>/flip\s*7/i.test(g.name||"") || /flip-?7/i.test(g.url||"")).map(g=>g.id);
  if(old.length){ state.library = state.library.filter(g=>!old.includes(g.id)); state.wheel = state.wheel.filter(id=>!old.includes(id)); changed = true; }
  if(!state.gsLib && !state.library.some(g=>g.id==="glueckstraehne")){
    state.library.push({id:"glueckstraehne", name:"Glückssträhne", icon:"🃏", info:"Karten aufdecken, zocken, sichern – eine doppelte Zahl und du bist raus.",
      url:"#gs", cat:"party", players:"2–8", time:"20 Min.", double:false});
    state.gsLib = true; changed = true;
  }
  return changed;
}

/* ---------- Bedienung ---------- */
document.addEventListener("click", e=>{
  const b = e.target.closest("[data-gs]"); if(!b) return;
  const k = b.dataset.gs;
  switch(k){
    case "draw": gsDo({type:"draw"}); break;
    case "stay": gsDo({type:"stay"}); break;
    case "choose": gsDo({type:"choose", pid:b.dataset.pid}); break;
    case "next": gsDo({type:"next"}); break;
    case "target": gsTarget = +b.dataset.t; renderGs(); break;
    case "me": gsMe = b.dataset.pid; try{ localStorage.setItem("gs-me", gsMe); }catch(e){} renderGs(); break;
    case "start": {
      const pool = O() ? O().roster : state.players, ps = picks.gs.map(id=>pool.find(p=>p.id===id)).filter(Boolean);
      if(ps.length<2) return toast("Mindestens 2 Spieler auswählen.");
      state.gs = GSL.newGame(ps.map(p=>({id:p.id, name:p.name})), gsTarget); picks.gs = []; pickOpen = null;
      if(!ps.some(p=>p.id===gsMe)) gsMe = gsMe==="all" ? "all" : null;
      commit(); break; }
    case "transfer": gsTransfer(); break;
    case "new": state.gs = null; commit(); break;
    case "quit": confirmTap(b, ()=>{ state.gs = null; commit(); toast("Spiel beendet"); }); break;
  }
});
if(ensureGsGame()){ keepLocal(); render(); }     // nur lokal – online übernimmt connect() das Speichern
renderGs();
