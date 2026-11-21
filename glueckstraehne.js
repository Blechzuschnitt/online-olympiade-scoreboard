/* =====================================================================
   Glückssträhne – Kartenspiel der Familien-Olympiade (Oberfläche)
   Regeln: glueckstraehne-logic.js (GSL). Speicher & Sync: state.gs über commit().
   Kartenmotive: gs-art/*.jpg (aus der Kartendesign-Referenztafel)
   ===================================================================== */
// Karte: [Symbol oder Motiv, Titel, Effekt, Farbton]
const GS_CARD = {
  S:["⚓","RETTUNGSANKER","rettet dich einmal vor dem Rauswurf",195], F:["✋","STOPP","jemand muss sofort sichern",350], Z:["⚡","ZUGZWANG","jemand muss 2 Karten ziehen",285],
  K:["art:tausch","KARTENKLAU","tausche deine kleinste gegen die größte Zahl",280], D:["🎲","DOPPEL ODER NICHTS","freiwillig sichern = Punkte ×2",45],
  R:["art:reset","RESET","eine eigene Karte weg, Ersatz ziehen",130], M:["art:spiegel","SPIEGEL","kopiert die letzte Aktionskarte",48],
  G:["art:schild","SCHUTZSCHILD","bis zu deinem Zug immun gegen Angriffe",195], B:["⏪","RÜCKWÄRTSGANG","der Nächste legt seine letzte Karte zurück",30],
  X:["💣","KAMIKAZE","jemand muss sofort 1 Karte ziehen",10], Q:["art:riss","DER RISS","die Regeln brechen auf",330],
  uP:["🪱","PARASIT","deine kleinste Zahl wächst jeden Zug +1",95], uD:["👥","DOPPELGÄNGER","zeigt, wer mehr Karten hat",210], uJ:["😈","JOKER DER HÖLLE","rettet eine Doppelte: Wert ±1",0],
  uF:["🔗","FLUCH","jemand darf im nächsten Zug nicht sichern",300], uU:["🏁","ÜBERLEBENDER","Letzter im Spiel: +3",140], uV:["🗡️","VERRÄTER","zählt nur, wenn du dein Ziel schlägst",350]
};
const GS_CAT = {
  blackout:["🌑","BLACKOUT","Eure eigenen Karten sind verdeckt bis zu eurem nächsten Zug."], inflation:["💸","INFLATION","Alle Punkte dieser Runde zählen doppelt."],
  buergerkrieg:["⚔️","BÜRGERKRIEG","Alle geben ihre letzte Karte nach links weiter."], zeitbombe:["⏱️","ZEITBOMBE","In 3 Zügen ziehen alle Aktiven eine Karte."],
  schwerkraft:["🪐","SCHWERKRAFT","Niedrig ist gut: 0 zählt 12, 12 zählt 0."], virus:["art:virus","VIRUS","Wer die Virus-Zahl zieht, wirft sie ab und zieht neu."],
  chaos:["🌀","CHAOS","Alle Aktiven ziehen sofort eine Karte."], revolution:["✊","REVOLUTION","Wer gerade vorne liegt, verliert 3 Punkte."],
  meteorit:["art:meteorit","METEORIT","Alle Aktiven verlieren ihre letzte Karte."], weltuntergang:["art:schwarzesloch","WELTUNTERGANG","Die Runde endet sofort."],
  offen:["art:riss","DER RISS IST OFFEN","Nur verschiedene Zahlen zählen – Doppelte werfen nicht mehr raus."],
  verzerrt:["art:riss","REALITÄT VERZERRT","Höchster und niedrigster Rundenwert tauschen ihre Karten."], zeitbruch:["art:riss","ZEITBRUCH","Jeder Aktive hat nur noch einen Zug."]
};
const GS_BOTS = [{id:"bot-robo", name:"Robo", bot:"clever"}, {id:"bot-ada", name:"Ada", bot:"locker"}, {id:"bot-max", name:"Max", bot:"clever"}];
const GS_CID = (()=>{ try{ let c = localStorage.getItem("gs-cid"); if(!c){ c = uid(); localStorage.setItem("gs-cid", c); } return c; }catch(e){ return uid(); } })();
let gsMe = null; try{ gsMe = localStorage.getItem("gs-me"); }catch(e){}
let gsPopQ = [], gsPopBusy = false, gsIncoming = new Set();
let gsSeen = new Set(), gsLastEv = null, gsInit = false, gsTarget = 200, gsOpts = {sabotage:true, apokalypse:false}, gsBots = [], gsBotTimer = null, gsBotKey = null;
picks.gs = picks.gs || [];
const gsHue = n => 188 + n*11;                       // 0 = Cyan … 12 = Magenta
const GS_WORD = ["NULL","EINS","ZWEI","DREI","VIER","FÜNF","SECHS","SIEBEN","ACHT","NEUN","ZEHN","ELF","ZWÖLF"];

function gsDo(a){
  const r = GSL.act(state.gs, a);
  if(r.err){ toast(r.err); return; }
  state.gs = r.state; commit();
}
const gsPlayer = id => state.gs && state.gs.players.find(p=>p.id===id);
const gsCan = pid => { const p = gsPlayer(pid); return !!p && !p.bot && (gsMe==="all" || gsMe===pid); };
const gsWho = p => p.bot ? `<span class="ava bot">🤖</span>${esc(p.name)}` : who(p);

/* ---------- Karten ---------- */
function gsFace(k, title, text, hue, cls, extra = ""){
  const isArt = k.startsWith("art:"), style = isArt ? ` style="--img:url(gs-art/${k.slice(4)}.jpg);--h:${hue}"` : ` style="--h:${hue}"`;
  return `<div class="gcard special ${isArt ? "art" : "sym"} ${cls}"${style} ${extra}><span class="banner">${title}</span>${isArt ? "" : `<span class="ico">${k}</span>`}<span class="eff">${text}</span></div>`;
}
function gsCard(c, opt = {}){
  const k = c.k, t = GSL.kind(k), fresh = (opt.fresh && gsInit ? " fresh" : "") + (gsIncoming.has(c.id) ? " incoming" : "") + (opt.used ? " used" : "");
  const pickAttr = opt.pick ? ` data-gs="pickcard" data-cid="${c.id}"` : ` data-cid="${c.id}"`, pickCls = opt.pick ? " pickable" : "";
  if(opt.hidden) return gsBack(fresh, "?", ` data-cid="${c.id}"`);
  if(t==="num"){
    const n = GSL.cval(c), copies = Math.max(1, GSL.val(k));
    return `<div class="gcard num${fresh}${pickCls}" style="--h:${gsHue(n)}"${pickAttr}><span class="banner">${GS_WORD[n]||n}</span><span class="cx tl">${n}</span><span class="cx br">${n}</span>
      <b class="big">${n}</b>${c.v!=null ? `<span class="tag">😈 war ${GSL.val(k)}</span>` : ""}${opt.plus ? `<span class="tag grow">🪱 +${opt.plus}</span>` : ""}<span class="pips" aria-hidden="true">${"<i></i>".repeat(copies)}</span></div>`;
  }
  if(t==="boost") return `<div class="gcard boost${fresh}${pickCls}"${pickAttr}><span class="lbl">BOOST</span><b class="big">${k==="x2" ? "×2" : "+"+GSL.val(k)}</b><span class="lbl">${k==="x2" ? "Zahlen doppelt" : "Punkte"}</span></div>`;
  const d = GS_CARD[k] || ["❔", k, "", 200];
  return gsFace(d[0], d[1], d[2], d[3], `${t==="mut" ? "mut" : ""}${fresh}${pickCls}`, pickAttr);
}
// Kartenrücken: Gitter, Doppelrahmen, Rauten-Siegel mit Stern
const gsBack = (extra="", mark="✦", attr="") => `<div class="gcard back ${extra}"${attr}><span class="bk-l t">GLÜCKS</span><span class="seal"><i>${mark}</i></span><span class="bk-l b">STRÄHNE</span></div>`;
const gsCatCard = (key, cls="") => { const d = GS_CAT[key]; return gsFace(d[0], d[1], d[2], key==="virus" ? 90 : 0, "cat "+cls); };

/* ---------- Bildschirme ---------- */
function renderGs(){
  const root = $("gsRoot"); if(!root || typeof GSL==="undefined") return;
  const S = state.gs;
  if(!S){ gsInit = false; clearTimeout(gsBotTimer); gsBotKey = null; return gsHtml(root, gsSetupHTML()); }
  const ids = new Set(S.players.flatMap(p=>p.row.concat(p.used||[]).map(c=>c.id)));
  const ev0 = gsInit && S.ev && S.ev.id!==gsLastEv ? S.ev : null;   // neue Sonderkarten fliegen erst noch zum Spieler
  if(ev0) ev0.items.forEach(e=>{ if(e.type==="card" && e.card && GSL.kind(e.card.k)!=="num") gsIncoming.add(e.card.id); });
  if(!gsInit){ gsSeen = ids; gsLastEv = S.ev && S.ev.id; }
  root.innerHTML = gsTableHTML(S); root._html = null;
  const ev = S.ev && S.ev.id!==gsLastEv ? S.ev : null;
  gsLastEv = S.ev && S.ev.id; gsSeen = ids; gsInit = true;
  if(ev) gsEffects(ev, S);
  gsBotTick(S);
}
function gsHtml(el, h){ if(el._html!==h){ el._html = h; el.innerHTML = h; } }

function gsSetupHTML(){
  const pool = O() ? O().roster : state.players, n = picks.gs.filter(id=>pool.some(p=>p.id===id)).length + gsBots.length;
  const tog = (k, title, sub) => `<button class="gs-mode${gsOpts[k] ? " on" : ""}" data-gs="mode" data-k="${k}" aria-pressed="${gsOpts[k]}"><b>${title}</b><small>${sub}</small></button>`;
  return `<div class="gs gs-setup">
    <div class="gs-hero"><div class="gs-logo">GLÜCKS<span>STRÄHNE</span></div><div class="gs-sub">Aufdecken, zocken, sichern – bevor das Glück reißt</div>
      <div class="gs-fan" aria-hidden="true">${[7,12].map((n,i)=>gsCard({k:"n"+n, id:"demo"+i})).join("")}${gsCard({k:"K", id:"d-k"})}${gsCatCard("meteorit")}${gsCard({k:"Q", id:"d-q"})}</div></div>
    <div class="admin">
      <section class="panel"><h2 class="h">Mitspieler <small>2 bis 8</small></h2>${pickerHTML("gs", pool, 8 - gsBots.length)}
        <div class="sub" style="margin-top:16px">KI-Gegner</div>
        <div class="row">${gsBots.map(b=>`<span class="pchip"><span class="ava bot">🤖</span>${b.name} · ${b.bot}<button class="x" data-gs="unbot" data-id="${b.id}" aria-label="${b.name} entfernen">✕</button></span>`).join("")}
          ${gsBots.length<GS_BOTS.length && n<8 ? `<button class="ghost sm" data-gs="addbot">🤖 + KI-Gegner</button>` : ""}</div>
        <div class="sub" style="margin-top:16px">Ziel</div>
        <div class="row">${[100,150,200].map(t=>`<button class="${gsTarget===t?"pri":"ghost"} sm" data-gs="target" data-t="${t}">${t} Punkte</button>`).join("")}</div></section>
      <section class="panel"><h2 class="h">Erweiterungen</h2>
        <div class="gs-modes">${tog("sabotage","🗡️ Sabotage & Sonderrechte","Kartenklau, Reset, Spiegel, Schutzschild, Kamikaze …")}${tog("apokalypse","☄️ APOKALYPSE","Katastrophen, Mutationen und DER RISS – die Regeln brechen")}</div>
        <ul class="gs-rules">
          <li>Reihum: <b>Karte ziehen</b> oder <b>sichern</b>. Eine doppelte Zahl wirft dich raus.</li>
          <li><b>7 verschiedene Zahlen</b> beenden die Runde sofort: +15 Bonus.</li>
          <li>⚓ Rettungsanker · ✋ Stopp · ⚡ Zugzwang · Booster +2 … +10 und ×2. Wer zuerst ${gsTarget} hat, gewinnt.</li></ul></section>
    </div>
    <div class="row center" style="margin-top:20px"><button class="pri big" data-gs="start" ${n>=2 ? "" : "disabled"}>🃏 Spiel starten</button><button class="ghost" data-view="spiele">← Spiele</button></div>
  </div>`;
}

function gsRow(S, p, i, big){
  const act = S.phase==="play" && i===S.turn && p.status==="in", sc = GSL.rowScore(p, S);
  const badge = {in:act ? "AM ZUG" : "", stay:"🔒 GESICHERT", bust:"💥 RAUS", seven:"🌟 SIEBEN!"}[p.status];
  const nums = new Set(GSL.numbers(p.row)).size;
  const hidden = big && (S.blackout||[]).includes(p.id) && gsCan(p.id);
  const choosing = S.pending && GSL.NEEDS[S.pending.type]==="own" && S.pending.from===p.id && gsCan(p.id);
  const ts = choosing ? GSL.targets(S, S.pending) : [];
  const card = c => gsCard(c, {fresh:!gsSeen.has(c.id), hidden, pick:ts.includes(c.id), plus:(p.muts||{}).P && p.muts.P.cid===c.id ? p.muts.P.plus : 0});
  const m = p.muts || {}, tags = [p.anchor && "⚓", p.guard && "🛡️", p.double && "🎲×2", p.cursed && "🔗", m.P && "🪱", m.J===1 && "😈", m.U && "🏁", m.D && (o=>o ? `👥 ${esc(o.name)}: ${o.row.length} Karten` : "👥")(S.players.filter(x=>x!==p).sort((a,b)=>b.row.length-a.row.length)[0]),
    m.V && `🗡️→${esc((S.players.find(x=>x.id===m.V)||{}).name||"")}`].filter(Boolean);
  return `<div class="gs-seat${big ? " big" : ""}${act ? " act" : ""} st-${p.status}" data-pid="${esc(p.id)}">
    <div class="gs-head"><span class="who">${gsWho(p)}${tags.length ? ` <span class="gs-tags">${tags.join(" ")}</span>` : ""}</span>${badge ? `<span class="gs-badge">${badge}</span>` : ""}
      <span class="gs-pts"><b>${hidden ? "?" : p.status==="bust" ? 0 : sc}</b><small>Runde</small></span><span class="gs-pts tot"><b>${p.total}</b><small>Konto</small></span></div>
    ${(sp=>sp.length ? `<div class="gs-specials">${sp.join("")}</div>` : "")(p.row.filter(c=>GSL.kind(c.k)!=="num").map(card).concat((p.used||[]).map(c=>gsCard(c, {used:true}))))}
    <div class="gs-cards">${p.row.filter(c=>GSL.kind(c.k)==="num").map(card).join("") || `<span class="gs-empty">${big ? (p.row.length ? "Noch keine Zahl" : "Noch keine Karte – zieh die erste!") : "–"}</span>`}</div>
    ${big ? `<div class="gs-meter" aria-label="${nums} von 7 verschiedenen Zahlen">${Array.from({length:7},(_,k)=>`<i class="${k<nums && !hidden ? "on" : ""}"></i>`).join("")}<span>${hidden ? "🌑 Blackout – deine Karten sind verdeckt" : `${nums}/7 verschiedene`}</span></div>` : ""}
  </div>`;
}
function gsControls(S){
  if(S.phase!=="play") return "";
  const cur = S.players[S.turn];
  if(S.pending){
    const q = S.pending, ch = gsPlayer(q.from), d = GS_CARD[q.type];
    if(!gsCan(ch.id)) return `<div class="gs-wait">${gsWho(ch)} wählt für ${d[1]} …</div>`;
    if(GSL.NEEDS[q.type]==="own") return `<div class="gs-choose"><b>${d[1]}:</b> Tippe eine deiner Karten an, die weg soll.</div>`;
    return `<div class="gs-choose"><b>${d[1]}:</b> Wen triffst du?<div class="row">${GSL.targets(S, q).map(id=>{ const p = gsPlayer(id);
      return `<button class="ghost" data-gs="choose" data-pid="${esc(id)}">${gsWho(p)}${id===ch.id ? " (ich)" : ""}</button>`; }).join("")}</div></div>`;
  }
  if(!gsCan(cur.id)) return `<div class="gs-wait">${gsWho(cur)} ${cur.bot ? "überlegt" : "ist am Zug"} …</div>`;
  return `<div class="row center"><button class="arc spin" data-gs="draw">🃏 Ziehen</button><button class="arc solve" data-gs="stay" ${cur.row.length && !cur.cursed ? "" : "disabled"}>${cur.cursed ? "🔗 Verflucht" : `🔒 Sichern <small>${GSL.rowScore(cur, S)} P</small>`}</button></div>`;
}
function gsCatInfo(S){
  const c = S.cat; if(!c) return "";
  const key = c.k==="riss" ? c.sub : c.k, d = GS_CAT[key];
  const extra = c.k==="virus" ? ` Virus-Zahl: <b>${c.n}</b>.` : c.k==="revolution" ? ` Betroffen: ${(c.who||[]).map(id=>esc((gsPlayer(id)||{}).name||"")).join(", ")}.` : c.k==="zeitbombe" && S.mods.bombe!=null ? ` Noch ${S.mods.bombe} Züge.` : "";
  return `<div class="gs-cat">${gsCatCard(key, "mini")}<div><div class="k">${c.k==="riss" ? "Der Riss" : "Katastrophe"}</div><b>${d[1]}</b><p>${d[2]}${extra}</p></div></div>`;
}
function gsTableHTML(S){
  const cur = S.players[S.turn], humans = S.players.filter(p=>!p.bot);
  const seated = S.players.some(p=>p.id===gsMe && !p.bot);
  const bigP = seated ? gsPlayer(gsMe) : (cur.bot && humans[0]) || cur;
  const others = S.players.filter(p=>p!==bigP), last = S.last;
  const modes = [S.opts.sabotage && "🗡️ Sabotage", S.opts.apokalypse && "☄️ Apokalypse"].filter(Boolean).join(" · ");
  const roundBox = S.phase!=="play" ? `<div class="gs-round">
      <div class="k">${S.phase==="over" ? "Spielende" : `Runde ${last.round} vorbei`}</div>
      <div class="gs-res">${GSL.ranking(S).map((p,i)=>{ const j = S.players.indexOf(p); return `<div class="${i===0 && S.phase==="over" ? "win" : ""}"><span>${i+1}.</span><span>${gsWho(p)}</span><em>${last.status[j]==="bust" ? "raus" : "+"+last.scores[j]}</em><b>${p.total}</b></div>`; }).join("")}</div>
      <div class="row center">${S.phase==="over"
        ? `${O() && !S.transferred ? `<button class="pri" data-gs="transfer">🏆 In die Olympiade übertragen</button>` : S.transferred ? `<span class="pill">✓ übertragen</span>` : ""}<button class="ghost" data-gs="new">🔁 Neues Spiel</button>`
        : `<button class="pri big" data-gs="next">▶ Nächste Runde</button><button class="ghost" data-gs="finish">🏁 Beenden</button>`}</div></div>` : "";
  return `<div class="gs">
    <div class="gs-top">
      <div class="gs-brand"><span class="gs-logo sm">GLÜCKS<span>STRÄHNE</span></span><span class="pill">Runde ${S.round} · Ziel ${S.target}</span>${modes ? `<span class="pill">${modes}</span>` : ""}</div>
      <div class="gs-me">Ich bin: ${humans.map(p=>`<button class="chip${gsMe===p.id ? " on" : ""}" data-gs="me" data-pid="${esc(p.id)}">${who(p)}</button>`).join("")}<button class="chip${gsMe==="all" ? " on" : ""}" data-gs="me" data-pid="all">📱 Alle hier</button></div>
    </div>
    <div class="gs-main">
      <div class="gs-pile">
        <div class="gs-deck">${gsBack("d3")}${gsBack("d2")}${gsBack("d1")}<span class="gs-count">${S.deck.length}</span></div>
        <div class="gs-msg" id="gsMsg">${gsMsg(S)}</div>
        ${gsControls(S)}${gsCatInfo(S)}${roundBox}
      </div>
      ${gsRow(S, bigP, S.players.indexOf(bigP), true)}
    </div>
    <div class="gs-others">${others.map(p=>gsRow(S, p, S.players.indexOf(p), false)).join("")}</div>
    <div class="row center" style="margin-top:14px"><button class="ghost sm" data-gs="quit">Spiel beenden</button><button class="ghost sm" data-view="spiele">← Spiele</button></div>
    <div class="gs-banner" id="gsBanner"></div><div class="gs-catpop" id="gsCatPop"></div>
  </div>`;
}
function gsMsg(S){
  const nm = id => esc((gsPlayer(id)||{}).name||""), items = S.ev ? S.ev.items : [];
  const e = items.slice().reverse().find(x=>x.type!=="card");
  if(!e){ const c = items.find(x=>x.type==="card"), cur = S.players[S.turn];
    return c ? `${nm(c.pid)} hat gezogen${S.phase==="play" && cur.id!==c.pid ? ` – ${esc(cur.name)} ist dran` : ""}.` : "Los geht's!"; }
  const t = {bust:`💥 ${nm(e.pid)} hat eine Zahl doppelt – raus!`, anchor:`⚓ Der Rettungsanker rettet ${nm(e.pid)}!`, seven:`🌟 ${nm(e.pid)} hat 7 verschiedene Zahlen!`,
    stay:`🔒 ${nm(e.pid)} sichert.`, stopp:`✋ ${nm(e.by)} stoppt ${nm(e.pid)}.`, zugzwang:`⚡ ${nm(e.by)} zwingt ${nm(e.pid)} zu 2 Karten!`, kamikaze:`💣 ${nm(e.by)}: ${nm(e.pid)} muss ziehen!`,
    klau:e.none ? `🃏 Kartenklau bei ${nm(e.pid)} – nichts Passendes.` : `🃏 ${nm(e.by)} klaut ${nm(e.pid)} die ${e.got} und gibt die ${e.give}.`,
    reset:`♻️ ${nm(e.pid)} wirft eine Karte ab und zieht neu.`, mirror:e.copy ? `🪞 Spiegel: ${nm(e.pid)} kopiert ${(GS_CARD[e.copy]||[])[1]||""}!` : `🪞 Spiegel – noch nichts zu kopieren.`,
    guard:`🛡️ ${nm(e.pid)} ist geschützt bis zum nächsten Zug.`, rueck:e.none ? "⏪ Rückwärtsgang verpufft." : `⏪ ${nm(e.pid)} legt die letzte Karte zurück und zieht neu.`,
    virus:`🦠 Virus! ${nm(e.pid)} wirft die ${e.card ? GSL.val(e.card.k) : ""} ab.`, joker:`😈 Joker der Hölle: ${nm(e.pid)} macht aus der ${e.from} eine ${e.to}!`,
    mut:{P:`🪱 ${nm(e.pid)} hat einen Parasiten.`, D:`👥 ${nm(e.pid)} hat einen Doppelgänger.`, J:`😈 ${nm(e.pid)} hält den Joker der Hölle.`, U:`🏁 ${nm(e.pid)} will überleben.`,
      F:`🔗 ${nm(e.pid)} verflucht ${nm(e.target)}!`, V:`🗡️ ${nm(e.pid)} verrät ${nm(e.target)}!`}[e.m],
    cat:`☄️ Katastrophe: ${(GS_CAT[e.k]||[])[1]||""}!`, riss:`🌌 DER RISS: ${(GS_CAT[e.sub]||[])[1]||""}!`, swap:`🌌 ${nm(e.a)} und ${nm(e.b)} tauschen ihre Karten!`,
    bombe:"💥 Die Zeitbombe explodiert – alle ziehen!", fizzle:"Die Aktion verpufft – niemand kann getroffen werden.",
    roundEnd:"Runde vorbei!", over:"Spielende!", round:"Neue Runde – neues Glück.", start:"Los geht's!"}[e.type];
  return t || "";
}

/* ---------- Effekte ---------- */
function gsEffects(ev, S){
  for(const e of ev.items){
    const seat = e.pid && document.querySelector(`.gs-seat[data-pid="${CSS.escape(e.pid)}"]`);
    if(e.type==="bust" && seat){ seat.classList.add("shatter"); if(typeof rrTone==="function") rrTone(160, .5, "sawtooth", .08, 60); }
    if(e.type==="seven"){ gsBanner("🌟 SIEBEN! +15"); confetti($("fx"), 2500); fanfare(true); }
    if((e.type==="anchor" || e.type==="joker") && seat){ seat.classList.add("saved"); gsBanner(e.type==="anchor" ? "⚓ GERETTET" : "😈 JOKER!"); }
    if(e.type==="card" && e.card && GSL.kind(e.card.k)!=="num"){ const c = e.card, pid = e.pid; gsQueue(done=>gsCardPop(c, pid, done)); }
    if(e.type==="cat" || e.type==="riss"){ const key = e.type==="riss" ? e.sub : e.k; gsQueue(done=>{ gsCatPop(key); setTimeout(done, 2700); }); }
    if(e.type==="over"){ confetti($("fx"), 4000); fanfare(true); }
  }
  if(ev.items.some(x=>x.type==="card")) wclick(.35);
}
function gsBanner(t){ const b = $("gsBanner"); if(!b) return; b.textContent = t; b.className = "gs-banner"; void b.offsetWidth; b.className = "gs-banner show"; }
function gsCatPop(key){
  const b = $("gsCatPop"), d = GS_CAT[key]; if(!b || !d) return;
  b.innerHTML = `${gsCatCard(key, "huge")}<b>${d[1]}</b><span>${d[2]}</span>`;
  b.className = "gs-catpop"; void b.offsetWidth; b.className = "gs-catpop show";
  if(typeof rrTone==="function") rrTone(90, 1, "sawtooth", .08, 40);
}


/* ---------- Gezogene Sonderkarte groß zeigen und zum Spieler fliegen lassen ---------- */
function gsQueue(fn){ gsPopQ.push(fn); if(!gsPopBusy) gsPopNext(); }
function gsPopNext(){ const f = gsPopQ.shift(); gsPopBusy = !!f; if(f) f(()=>setTimeout(gsPopNext, 120)); }
function gsCardPop(c, pid, done){
  if(typeof curView!=="undefined" && curView!=="gs"){ gsIncoming.delete(c.id); return done(); }
  let ov = $("gsCardPop");
  if(!ov){ ov = document.createElement("div"); ov.id = "gsCardPop"; document.body.appendChild(ov); }
  const p = gsPlayer(pid);
  ov.innerHTML = `<div class="gs-cp-who">${p ? gsWho(p) : ""} zieht</div><div class="gs-cp-card">${gsCard(c)}</div>`;
  const pc = ov.querySelector(".gcard"); if(pc) pc.classList.remove("incoming", "fresh");
  ov.className = "gs-cardpop"; void ov.offsetWidth; ov.className = "gs-cardpop show";
  if(typeof rrTone==="function") rrTone(520, .25, "triangle", .06, 900);
  const land = ()=>{ gsIncoming.delete(c.id); const t = document.querySelector(`#gsRoot .gs-seat [data-cid="${c.id}"]`); if(t) t.classList.remove("incoming"); };
  setTimeout(()=>{
    const card = ov.querySelector(".gcard"), t = document.querySelector(`#gsRoot .gs-seat [data-cid="${c.id}"]`);
    ov.classList.add("fly");
    let fin = false; const finish = ()=>{ if(fin) return; fin = true; land(); ov.className = "gs-cardpop"; ov.innerHTML = ""; done(); };
    setTimeout(finish, 1000);                                         // Sicherheitsnetz, falls die Animation pausiert (Tab im Hintergrund)
    if(card && t && card.animate){
      const a = card.getBoundingClientRect(), b = t.getBoundingClientRect();
      const anim = card.animate([{transform:"none"}, {transform:`translate(${b.left+b.width/2-a.left-a.width/2}px,${b.top+b.height/2-a.top-a.height/2}px) scale(${b.width/a.width})`}],
        {duration:650, easing:"cubic-bezier(.5,0,.25,1)", fill:"forwards"});
      anim.onfinish = finish;
    } else setTimeout(finish, 350);
  }, 1500);
}
/* ---------- KI-Gegner: das startende Gerät steuert sie; ist es weg, übernimmt ein anderes ---------- */
function gsBotTick(S){
  let who = null;
  if(S.phase==="roundEnd" && S.players.every(p=>p.bot)) who = "next";
  else if(S.phase==="play"){ const id = S.pending ? S.pending.from : S.players[S.turn].id; if((gsPlayer(id)||{}).bot) who = id; }
  if(!who){ clearTimeout(gsBotTimer); gsBotKey = null; return; }
  const key = who + ":" + S.seq; if(key===gsBotKey) return;
  gsBotKey = key; clearTimeout(gsBotTimer);
  const driver = !online || !S.host || S.host===GS_CID;
  gsBotTimer = setTimeout(()=>{
    const S2 = state.gs; if(!S2 || S2.seq!==S.seq) return;
    if(!driver) S2.host = GS_CID;
    const m = who==="next" ? {type:"next"} : GSL.botMove(S2, who);
    if(m) gsDo(m);
  }, (driver ? (S.pending ? 1100 : 1400) : 9000) + (gsPopBusy ? 2200 * Math.max(1, gsPopQ.length + 1) : 0));
}

/* ---------- Ergebnis in die Olympiade (über die vorhandene Rundenwertung) ---------- */
function gsTransfer(){
  const S = state.gs, ol = O(); if(!S || !ol || S.transferred) return;
  if(state.pending && state.pending.gameId!=="glueckstraehne"){ toast(`Erst die laufende Runde „${state.pending.gameName}“ eintragen.`); return; }
  const order = GSL.ranking(S).filter(p=>p.total>0 && !p.bot).map(p=>p.id).filter(id=>ol.roster.some(r=>r.id===id));
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
  switch(b.dataset.gs){
    case "draw": gsDo({type:"draw"}); break;
    case "stay": gsDo({type:"stay"}); break;
    case "choose": gsDo({type:"choose", pid:b.dataset.pid}); break;
    case "pickcard": gsDo({type:"choose", cid:b.dataset.cid}); break;
    case "next": gsDo({type:"next"}); break;
    case "finish": confirmTap(b, ()=>gsDo({type:"finish"})); break;
    case "target": gsTarget = +b.dataset.t; renderGs(); break;
    case "mode": gsOpts[b.dataset.k] = !gsOpts[b.dataset.k]; renderGs(); break;
    case "addbot": { const nb = GS_BOTS.find(x=>!gsBots.some(y=>y.id===x.id)); if(nb) gsBots.push(nb); renderGs(); break; }
    case "unbot": gsBots = gsBots.filter(x=>x.id!==b.dataset.id); renderGs(); break;
    case "me": gsMe = b.dataset.pid; try{ localStorage.setItem("gs-me", gsMe); }catch(e){} renderGs(); break;
    case "start": {
      const pool = O() ? O().roster : state.players, ps = picks.gs.map(id=>pool.find(p=>p.id===id)).filter(Boolean);
      if(!ps.length) return toast("Mindestens ein Mensch muss mitspielen.");
      if(ps.length + gsBots.length < 2) return toast("Mindestens 2 Spieler – oder einen KI-Gegner dazunehmen.");
      state.gs = GSL.newGame([...ps.map(p=>({id:p.id, name:p.name})), ...gsBots], gsTarget, Math.random, Object.assign({host:GS_CID}, gsOpts));
      picks.gs = []; pickOpen = null;
      if(!ps.some(p=>p.id===gsMe)) gsMe = ps.length===1 ? ps[0].id : "all";
      commit(); break; }
    case "transfer": gsTransfer(); break;
    case "new": state.gs = null; commit(); break;
    case "quit": confirmTap(b, ()=>{ state.gs = null; commit(); toast("Spiel beendet"); }); break;
  }
});
if(ensureGsGame()){ keepLocal(); render(); }     // nur lokal – online übernimmt connect() das Speichern
renderGs();
