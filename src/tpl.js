/* ============ templates: Basic (default), Ink scroll, Cosmos ============
   One timeline, three looks. Basic is plain and readable in seconds; Ink scroll is the
   original handscroll; Cosmos puts each moment on a star spiralling out to today. */
const TPLS=["basic","ink","cosmos"];
let TPL=store.get("tlpub.tpl","basic"); if(!TPLS.includes(TPL)) TPL="basic";
const isExample=()=>events[0]&&events[0].when==="Example scroll";
const moments=()=>events.filter(e=>e.kind==="event"||e.kind==="today"||e.kind==="ahead");
const CHN={roots:"Early years",craft:"Learning",work:"Work",making:"Making",now:"Now",ahead:"Ahead"};

function setTpl(t,quiet){
  if(!TPLS.includes(t)) t="basic";
  TPL=t; store.set("tlpub.tpl",t);
  const de=document.documentElement; TPLS.forEach(k=>de.classList.toggle("tpl-"+k,k===t));
  $("#tplBasic").hidden=t!=="basic"; $("#tplCosmos").hidden=t!=="cosmos";
  $$(".tplcard").forEach(c=>c.setAttribute("aria-current",String(c.dataset.tpl===t)));
  if(t==="basic") renderBasic();
  if(t==="cosmos") renderCosmos2(); else cosStop();
  if(t==="ink"&&!quiet){ interrupt(); setView("scroll"); rebuild(curIndex()); }
  if(!quiet){ try{SFX.pluck()}catch(e){} }
}
function tplAfterApply(){
  if(TPL==="ink"){ toast("Your timeline is inked. Press Next or swipe to travel through it."); return; }
  if(TPL==="basic"){ renderBasic(); const w=$("#bWho"); if(w) $("#bScroll").scrollTo({top:w.offsetTop-70,behavior:still?"auto":"smooth"}); }
  if(TPL==="cosmos") renderCosmos2();
  toast("Your timeline is ready.");
}

/* ---------- Basic: a plain vertical timeline ---------- */
function renderBasic(){
  const ms=moments(), ti=ms.findIndex(e=>e.kind==="today");
  $("#bWho").innerHTML=isExample()?`<h2>Mika's timeline</h2><span class="bnote">Example. Mika is made up.</span>`:`<h2>Your timeline</h2><span class="bnote">Saved in this browser only</span>`;
  let html="", prev="";
  ms.forEach((e,k)=>{
    if(e.chapter!==prev&&e.kind!=="today"){ html+=`<li class="bch">${esc(CHN[e.chapter]||e.chapter)}</li>`; prev=e.chapter; }
    if(e.kind==="today"){
      html+=`<li class="bit today" style="--k:${k}"><div class="bcard"><div class="bwhen"><span class="btag">Today</span>${esc(fmtDay(new Date()))}</div><h3>You are here.</h3><p>Everything above has happened. Everything below is a plan.</p></div></li>`;
      return;
    }
    const big=e.splat==="red";
    html+=`<li class="bit ${e.kind}${big?" big":""}" style="--k:${k}"><div class="bcard"><div class="bwhen">${e.kind==="ahead"?'<span class="btag">Plan</span>':big?'<span class="btag">Big moment</span>':""}${esc(e.when||"")}</div><h3>${esc(e.line)}</h3>${e.detail?`<p>${esc(e.detail)}</p>`:""}</div></li>`;
  });
  const list=$("#bList"); list.innerHTML=html;
  const pct=ti<0?100:Math.round((ti+1)/(ms.length+1)*100); list.style.setProperty("--done",pct+"%");
}

/* ---------- Cosmos: moments as stars on a spiral ---------- */
const COS={sel:0,stars:[],bg:[],raf:0,t0:0,pts:[]};
function cosLayout(){
  const c=$("#cosCanvas"), w=c.clientWidth||innerWidth, h=c.clientHeight||innerHeight, d0=(typeof FAST!=="undefined"&&FAST)?1:Math.min(2,devicePixelRatio||1), d=Math.min(d0,Math.sqrt(2.2e6/(w*h)));
  c.width=Math.round(w*d); c.height=Math.round(h*d);
  const wide=w>=896, cx=wide?w*.4:w*.5, cy=wide?h*.52:h*.42, R=Math.min(wide?w*.34:w*.46,h*(wide?.4:.3));
  const ms=moments(), n=ms.length;
  COS.pts=ms.map((e,i)=>{
    const f=n>1?i/(n-1):0, a=-Math.PI*.6+f*Math.PI*2.35, r=R*(.12+.88*Math.pow(f,.85));
    return {e,x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r*.82,i};
  });
  COS.w=w; COS.h=h; COS.d=d; COS.cx=cx; COS.cy=cy;
  if(!COS.bg.length||COS.bgw!==w||COS.bgh!==h){ COS.bgw=w; COS.bgh=h; COS.bg=Array.from({length:Math.round(w*h/2200)},(_,k)=>({x:hash(k*1.13)*w,y:hash(k*2.71)*h,r:hash(k*3.3)<.06?1.4:.4+hash(k*4.9)*.8,p:hash(k*7.7)*6.28,g:hash(k*5.5)<.12})); }
}
function cosDraw(now){
  const c=$("#cosCanvas"), x=c.getContext("2d"), {w,h,d}=COS; if(!w) return;
  const tt=(now||0)/1000;
  x.setTransform(d,0,0,d,0,0); x.clearRect(0,0,w,h);
  for(const s of COS.bg){ const tw=still?.7:.45+.35*Math.sin(tt*1.3+s.p); x.fillStyle=s.g?`rgba(243,210,122,${tw*.7})`:`rgba(238,241,255,${tw*.75})`; x.beginPath(); x.arc(s.x,s.y,s.r,0,7); x.fill(); }
  const P=COS.pts; if(!P.length) return;
  const ti=P.findIndex(p=>p.e.kind==="today");
  // the path: solid up to today, dotted after
  x.lineWidth=1.4; x.lineCap="round";
  for(let i=1;i<P.length;i++){
    const a=P[i-1], b=P[i], fut=ti>=0&&i>ti;
    x.strokeStyle=fut?"rgba(154,164,199,.45)":"rgba(143,176,255,.55)"; x.setLineDash(fut?[3,6]:[]);
    x.beginPath(); x.moveTo(a.x,a.y); const mx=(a.x+b.x)/2+(b.y-a.y)*.18, my=(a.y+b.y)/2-(b.x-a.x)*.18; x.quadraticCurveTo(mx,my,b.x,b.y); x.stroke();
  }
  x.setLineDash([]);
  const wide=w>=720;
  P.forEach((p,i)=>{
    const e=p.e, sel=i===COS.sel, today=e.kind==="today", ahead=e.kind==="ahead", big=e.splat==="red", mid=e.splat==="black";
    const r=today?7:big?6:mid?4.6:3.6, pulse=still?0:Math.sin(tt*2+i)*.6;
    if(ahead){ x.strokeStyle="rgba(200,210,240,.85)"; x.lineWidth=1.6; x.beginPath(); x.arc(p.x,p.y,r+1,0,7); x.stroke(); }
    else{
      const col=today?"243,210,122":big?"255,236,190":"238,241,255";
      const g=x.createRadialGradient(p.x,p.y,0,p.x,p.y,r*5+pulse*2); g.addColorStop(0,`rgba(${col},.55)`); g.addColorStop(1,`rgba(${col},0)`);
      x.fillStyle=g; x.beginPath(); x.arc(p.x,p.y,r*5+pulse*2,0,7); x.fill();
      x.fillStyle=`rgb(${col})`; x.beginPath(); x.arc(p.x,p.y,r,0,7); x.fill();
    }
    if(sel){ x.strokeStyle="rgba(243,210,122,.95)"; x.lineWidth=1.6; x.beginPath(); x.arc(p.x,p.y,r+8+(still?0:Math.sin(tt*3)*1.5),0,7); x.stroke(); }
    if(wide||sel){ x.fillStyle=sel?"#f3d27a":"rgba(154,164,199,.9)"; x.font=`600 ${sel?13:11}px "Instrument Sans",system-ui,sans-serif`; x.fillText(today?"Today":(e.when||"").slice(0,22),p.x+r+10,p.y+4); }
  });
}
function cosLoop(now){ cosDraw(now); if(TPL==="cosmos"&&!still&&!document.hidden) COS.raf=requestAnimationFrame(cosLoop); }
function cosStop(){ cancelAnimationFrame(COS.raf); COS.raf=0; }
function cosSelect(i){
  const P=COS.pts; if(!P.length) return; COS.sel=clamp(i,0,P.length-1); const e=P[COS.sel].e;
  $("#cPanel").innerHTML=e.kind==="today"
    ?`<div class="cw">Today · ${esc(fmtDay(new Date()))}</div><h3>You are here.</h3><p>The bright star. Everything before it happened; the rings after it are plans.</p>`
    :`<div class="cw">${esc(e.kind==="ahead"?"Plan · ":"")}${esc(e.when||CHN[e.chapter]||"")}</div><h3>${esc(e.line)}</h3>${e.detail?`<p>${esc(e.detail)}</p>`:""}`;
  $("#cCount").textContent=`${COS.sel+1} of ${P.length}`;
  if(still) cosDraw(0);
}
function renderCosmos2(){
  $("#cHint").textContent=isExample()?"Mika's timeline (made up). Each star is a moment. The bright one is today. Rings are plans.":"Each star is a moment. The bright one is today. Rings are plans.";
  cosLayout(); const ti=COS.pts.findIndex(p=>p.e.kind==="today");
  cosSelect(COS.selSet?COS.sel:Math.max(0,ti)); COS.selSet=true;
  cosStop(); if(still) cosDraw(0); else COS.raf=requestAnimationFrame(cosLoop);
}
$("#cosCanvas").addEventListener("click",ev=>{
  const r=ev.currentTarget.getBoundingClientRect(), px=ev.clientX-r.left, py=ev.clientY-r.top;
  let best=-1,bd=34*34; COS.pts.forEach((p,i)=>{const dd=(p.x-px)**2+(p.y-py)**2;if(dd<bd){bd=dd;best=i}});
  if(best>=0){ cosSelect(best); try{SFX.pluck()}catch(e){} }
});
new ResizeObserver(()=>{ if(TPL==="cosmos"){ cosLayout(); cosDraw(performance.now()); } if(TPL==="basic"){} }).observe($("#tplCosmos"));

/* ---------- picker + controls (capture phase, so the ink scroll's own handler never sees them) ---------- */
document.addEventListener("click",ev=>{
  const tp=ev.target.closest("[data-tpl]");
  if(tp){ ev.stopPropagation(); $("#tplVeil").hidden=true; setTpl(tp.dataset.tpl); return; }
  const cb=ev.target.closest("[data-cos]");
  if(cb){ ev.stopPropagation(); cosSelect(COS.sel+(+cb.dataset.cos)); try{SFX.pluck()}catch(e){} return; }
  const a=ev.target.closest("[data-act]"); if(!a) return;
  const act=a.dataset.act;
  if(act==="tplpick"){ ev.stopPropagation(); $$(".veil").forEach(v=>v.hidden=true); $$(".tplcard").forEach(c=>c.setAttribute("aria-current",String(c.dataset.tpl===TPL))); $("#tplVeil").hidden=false; setTimeout(()=>{const f=$(`.tplcard[data-tpl="${TPL}"]`);f&&f.focus({preventScroll:true})},40); return; }
  if(act==="cosmos"){ ev.stopPropagation(); $$(".veil").forEach(v=>v.hidden=true); setTpl("cosmos"); return; }
  if(act==="bexample"){ ev.stopPropagation(); const w=$("#bWho"); $("#bScroll").scrollTo({top:w.offsetTop-70,behavior:still?"auto":"smooth"}); return; }
},true);
document.addEventListener("keydown",ev=>{
  if(TPL==="ink") return;
  if(ev.target.closest&&ev.target.closest("input,textarea,select")) return;
  if($$(".veil").some(v=>!v.hidden)) return;
  const k=ev.key;
  if(["ArrowRight","ArrowLeft","PageUp","PageDown","Home","End"," "].includes(k)){
    ev.stopImmediatePropagation();
    if(TPL==="cosmos"){
      if(k==="ArrowRight"||k==="PageDown"){ev.preventDefault();cosSelect(COS.sel+1)}
      if(k==="ArrowLeft"||k==="PageUp"){ev.preventDefault();cosSelect(COS.sel-1)}
      if(k==="Home"){ev.preventDefault();cosSelect(0)}
      if(k==="End"){ev.preventDefault();cosSelect(COS.pts.length-1)}
    }
  }
},true);
document.addEventListener("visibilitychange",()=>{ if(!document.hidden&&TPL==="cosmos"&&!still&&!COS.raf) COS.raf=requestAnimationFrame(cosLoop); else if(document.hidden) cosStop(); });
setTpl(TPL,true);
