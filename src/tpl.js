/* ============ templates: Basic (default), Ink scroll, Cosmos ============
   One timeline, three looks. Basic is plain and readable in seconds; Ink scroll is the
   original handscroll; Cosmos puts each moment on a star spiralling out to today. */
const TPLS=["basic","ink","cosmos"];
let TPL=store.get("tlpub.tpl","cosmos"); if(!TPLS.includes(TPL)) TPL="basic";
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
  $("#bWho").innerHTML=isExample()?`<h2>Ryo's timeline</h2><span class="bnote">Example</span>`:`<h2>Your timeline</h2><span class="bnote">Saved in this browser only</span>`;
  let html="", prev="";
  ms.forEach((e,k)=>{
    if(e.chapter!==prev&&e.kind!=="today"){ html+=`<li class="bch">${esc(CHN[e.chapter]||e.chapter)}</li>`; prev=e.chapter; }
    if(e.kind==="today"){
      html+=`<li class="bit today" style="--k:${k}"><div class="bcard"><div class="bwhen"><span class="btag">Today</span>${esc(fmtDay(new Date()))}</div><h3>You are here.</h3><p>Everything above has happened. Everything below is a plan.</p>${payList()}</div></li>`;
      return;
    }
    const big=e.splat==="red";
    html+=`<li class="bit ${e.kind}${big?" big":""}" style="--k:${k}"><div class="bcard"><div class="bwhen">${e.kind==="ahead"?'<span class="btag">Plan</span>':big?'<span class="btag">Big moment</span>':""}${esc(e.when||"")}</div><h3>${esc(e.line)}</h3>${e.detail?`<p>${esc(e.detail)}</p>`:""}${e.kind==="ahead"?paySlip(e.id):""}</div></li>`;
  });
  const list=$("#bList"); list.innerHTML=html;
  const pct=ti<0?100:Math.round((ti+1)/(ms.length+1)*100); list.style.setProperty("--done",pct+"%");
}

/* ---------- Cosmos: moments as stars on a spiral ---------- */
const COS={sel:0,stars:[],bg:[],raf:0,t0:0,pts:[]};
function cosLayout(){
  const c=$("#cosCanvas"), w=c.clientWidth||innerWidth, h=c.clientHeight||innerHeight, d0=(typeof FAST!=="undefined"&&FAST)?1:Math.min(2,devicePixelRatio||1), d=Math.min(d0,Math.sqrt(2.2e6/(w*h)));
  c.width=Math.round(w*d); c.height=Math.round(h*d);
  const wide=w>=896, cx=wide?w*.4:w*.5, cy=wide?h*.53:h*.42, R=Math.min(wide?w*.36:w*.46,h*(wide?.42:.3));
  const ms=moments(), n=ms.length;
  COS.pts=ms.map((e,i)=>{
    const f=n>1?i/(n-1):0, a=-Math.PI*.6+f*Math.PI*2.35, r=R*(.12+.88*Math.pow(f,.85));
    return {e,x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r*.82,i};
  });
  COS.w=w; COS.h=h; COS.d=d; COS.cx=cx; COS.cy=cy; COS.R=R;
  if(!COS.bg.length||COS.bgw!==w||COS.bgh!==h){ COS.bgw=w; COS.bgh=h; COS.bg=Array.from({length:Math.round(w*h/2200)},(_,k)=>({x:hash(k*1.13)*w,y:hash(k*2.71)*h,r:hash(k*3.3)<.06?1.4:.4+hash(k*4.9)*.8,p:hash(k*7.7)*6.28,g:hash(k*5.5)<.12})); }
}
function cosDraw(now){
  const c=$("#cosCanvas"), x=c.getContext("2d"), {w,h,d}=COS; if(!w) return;
  const tt=(now||0)/1000;
  x.setTransform(d,0,0,d,0,0); x.clearRect(0,0,w,h);
  if(C3.on){ cosOver(x,tt); return; }
  // nebula: three slow clouds of colour
  [[.72,.3,.55,"124,92,255",.16],[.2,.75,.5,"46,190,210",.11],[.5,.5,.35,"243,210,122",.07]].forEach(([fx,fy,fr,col,al],k)=>{ const ox=fx*w+Math.sin(tt*.05+k*2)*w*.03, oy=fy*h+Math.cos(tt*.04+k)*h*.03, rr=Math.max(w,h)*fr; const g=x.createRadialGradient(ox,oy,0,ox,oy,rr); g.addColorStop(0,`rgba(${col},${al})`); g.addColorStop(1,`rgba(${col},0)`); x.fillStyle=g; x.fillRect(0,0,w,h); });
  // the chart: a slowly turning ring of ticks around the spiral, like an old star chart
  { const R0=(COS.R||200)*1.12, rot=still?0:tt*.012; x.save(); x.translate(COS.cx,COS.cy); x.scale(1,.82); x.rotate(rot);
    x.strokeStyle="rgba(243,210,122,.16)"; x.lineWidth=1; x.beginPath(); x.arc(0,0,R0,0,7); x.stroke(); x.beginPath(); x.arc(0,0,R0*1.07,0,7); x.stroke();
    for(let k=0;k<72;k++){ const a=k/72*Math.PI*2, L=k%6===0?R0*.07:R0*.025; x.strokeStyle=k%6===0?"rgba(243,210,122,.34)":"rgba(243,210,122,.14)"; x.beginPath(); x.moveTo(Math.cos(a)*R0,Math.sin(a)*R0); x.lineTo(Math.cos(a)*(R0+L),Math.sin(a)*(R0+L)); x.stroke(); }
    x.restore(); }
  // a shooting star every so often
  if(!still){ const c=(tt%9)/1.1; if(c<1){ const sx=w*(.15+.6*hash(Math.floor(tt/9))), sy=h*.12, ex=sx+w*.18*c, ey=sy+h*.12*c, g=x.createLinearGradient(ex-w*.08,ey-h*.05,ex,ey); g.addColorStop(0,"rgba(255,255,255,0)"); g.addColorStop(1,`rgba(255,255,255,${.7*(1-c)})`); x.strokeStyle=g; x.lineWidth=1.4; x.beginPath(); x.moveTo(ex-w*.08,ey-h*.05); x.lineTo(ex,ey); x.stroke(); } }
  for(const s of COS.bg){ const tw=still?.7:.45+.35*Math.sin(tt*1.3+s.p); x.fillStyle=s.g?`rgba(243,210,122,${tw*.7})`:`rgba(238,241,255,${tw*.75})`; x.beginPath(); x.arc(s.x,s.y,s.r,0,7); x.fill(); }
  const P=COS.pts; if(!P.length) return;
  const ti=P.findIndex(p=>p.e.kind==="today");
  // the path: solid up to today, dotted after
  P.forEach(p=>{ if(p.e.kind!=="ahead") return; const rr=Math.hypot(p.x-COS.cx,(p.y-COS.cy)/.82); x.save(); x.translate(COS.cx,COS.cy); x.scale(1,.82); x.strokeStyle="rgba(200,210,240,.10)"; x.lineWidth=1; x.setLineDash([2,7]); x.beginPath(); x.arc(0,0,rr,0,7); x.stroke(); x.restore(); x.setLineDash([]); });
  x.lineWidth=1.6; x.lineCap="round"; x.shadowColor="rgba(143,176,255,.8)"; x.shadowBlur=still?0:8;
  for(let i=1;i<P.length;i++){
    const a=P[i-1], b=P[i], fut=ti>=0&&i>ti;
    x.strokeStyle=fut?"rgba(154,164,199,.45)":"rgba(143,176,255,.55)"; x.setLineDash(fut?[3,6]:[]);
    x.beginPath(); x.moveTo(a.x,a.y); const mx=(a.x+b.x)/2+(b.y-a.y)*.18, my=(a.y+b.y)/2-(b.x-a.x)*.18; x.quadraticCurveTo(mx,my,b.x,b.y); x.stroke();
  }
  x.setLineDash([]); x.shadowBlur=0;
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
    if(today){ const L=r*4.2+(still?0:Math.sin(tt*1.6)*2); x.strokeStyle="rgba(255,231,160,.85)"; x.lineWidth=1.2; x.beginPath(); x.moveTo(p.x-L,p.y); x.lineTo(p.x+L,p.y); x.moveTo(p.x,p.y-L); x.lineTo(p.x,p.y+L); x.stroke();
      for(let k=0;k<2;k++){ const ph=still?.5:((tt*.35+k*.5)%1); x.strokeStyle=`rgba(243,210,122,${.45*(1-ph)})`; x.beginPath(); x.arc(p.x,p.y,r+6+ph*34,0,7); x.stroke(); } }
    if(sel){ x.strokeStyle="rgba(243,210,122,.95)"; x.lineWidth=1.6; x.beginPath(); x.arc(p.x,p.y,r+8+(still?0:Math.sin(tt*3)*1.5),0,7); x.stroke(); }
    if(wide||sel){ x.fillStyle=sel?"#f3d27a":"rgba(154,164,199,.9)"; x.font=`600 ${sel?13:11}px "Instrument Sans",system-ui,sans-serif`; x.fillText(today?"Today":(e.when||"").slice(0,22),p.x+r+10,p.y+4); }
  });
}
function cosFxDraw(x,now){ if(!COS.fx||!COS.fx.length) return;
  for(const f of COS.fx){ const a=(now-f.t)/1000; if(a<0||a>2.4) continue; const e=1-Math.pow(1-Math.min(1,a/1.2),3);
    if(f.k==="flare"){ x.strokeStyle=`rgba(255,231,160,${.9*(1-a/2.4)})`; x.lineWidth=2; x.beginPath(); x.arc(f.x,f.y,10+e*90,0,7); x.stroke();
      for(let k=0;k<14;k++){ const ang=k/14*Math.PI*2+.3, r1=12+e*70, r2=r1+10+e*26; x.strokeStyle=`rgba(255,240,200,${.8*(1-a/2.4)})`; x.lineWidth=1.4; x.beginPath(); x.moveTo(f.x+Math.cos(ang)*r1,f.y+Math.sin(ang)*r1); x.lineTo(f.x+Math.cos(ang)*r2,f.y+Math.sin(ang)*r2); x.stroke(); } }
    if(f.k==="gold"){ const g=x.createRadialGradient(f.x,f.y,0,f.x,f.y,30+e*60); g.addColorStop(0,`rgba(243,210,122,${.7*(1-a/2.4)})`); g.addColorStop(1,"rgba(243,210,122,0)"); x.fillStyle=g; x.beginPath(); x.arc(f.x,f.y,30+e*60,0,7); x.fill(); x.strokeStyle=`rgba(243,210,122,${1-a/2.4})`; x.lineWidth=2; x.beginPath(); x.arc(f.x,f.y,8+e*22,0,7); x.stroke(); }
    if(f.k==="dim"){ const j=a<.6?Math.sin(a*60)*4*(1-a/.6):0; x.strokeStyle=`rgba(226,92,84,${.85*(1-a/2.4)})`; x.lineWidth=2; x.beginPath(); x.arc(f.x+j,f.y,10+e*14,0,7); x.stroke(); const g=x.createRadialGradient(f.x,f.y,0,f.x,f.y,60); g.addColorStop(0,`rgba(10,8,20,${.55*(1-a/2.4)})`); g.addColorStop(1,"rgba(10,8,20,0)"); x.fillStyle=g; x.beginPath(); x.arc(f.x,f.y,60,0,7); x.fill(); }
  } }
function cosOver(x,tt){ const P=COS.pts, wide=COS.w>=720;
  P.forEach((p,i)=>{ if(p.behind) return; const e=p.e, sel=i===COS.sel, today=e.kind==="today";
    if(sel){ x.strokeStyle="rgba(243,210,122,.95)"; x.lineWidth=1.6; x.beginPath(); x.arc(p.x,p.y,16+(still?0:Math.sin(tt*3)*2),0,7); x.stroke(); }
    if(sel||(wide&&today)){ x.fillStyle=sel?"#f3d27a":"rgba(200,206,230,.85)"; x.font=`600 ${sel?14:12}px "Instrument Sans",system-ui,sans-serif`; x.fillText(today?"Now":(e.when||"").slice(0,22),p.x+22,p.y+5); }
  }); }
function cosLoop(now){ if(C3.on&&TPL==="cosmos") cos3Frame(now); cosDraw(now); cosFxDraw($("#cosCanvas").getContext("2d"),now); if(TPL==="cosmos"&&!still&&!document.hidden) COS.raf=requestAnimationFrame(cosLoop); }
function cosStop(){ cancelAnimationFrame(COS.raf); COS.raf=0; }
function cosSelect(i){
  const P=COS.pts; if(!P.length) return; COS.sel=clamp(i,0,P.length-1); const e=P[COS.sel].e;
  $("#cPanel").innerHTML=e.kind==="today"
    ?`<div class="cw">${esc(fmtDay(new Date()))}</div><h3>Now.</h3>${payList()}`
    :`<div class="cw">${esc(e.when||CHN[e.chapter]||"")}</div><h3>${esc(e.line)}</h3>${e.kind==="ahead"?paySlip(e.id):""}`;
  $("#cCount").textContent=`${COS.sel+1} of ${P.length}`;
  if(still) cosDraw(0);
}
function renderCosmos2(){ if(C3.on) cos3Build(); else cos3Init();
  $("#cHint").textContent=isExample()?"Ryo's life. Make it yours.":"";
  cosLayout(); const ti=COS.pts.findIndex(p=>p.e.kind==="today");
  cosSelect(COS.selSet?COS.sel:Math.max(0,ti)); COS.selSet=true;
  cosStop(); if(still) cosDraw(0); else COS.raf=requestAnimationFrame(cosLoop);
}
$("#cosCanvas").addEventListener("click",ev=>{
  const r=ev.currentTarget.getBoundingClientRect(), px=ev.clientX-r.left, py=ev.clientY-r.top;
  let best=-1,bd=34*34; COS.pts.forEach((p,i)=>{const dd=(p.x-px)**2+(p.y-py)**2;if(dd<bd){bd=dd;best=i}});
  if(best>=0){ cosSelect(best); try{SFX.pluck()}catch(e){} }
});
new ResizeObserver(()=>{ if(TPL==="cosmos"){ cosLayout(); cos3Size(); if(C3.on) cos3Frame(performance.now()); cosDraw(performance.now()); } if(TPL==="basic"){} }).observe($("#tplCosmos"));



/* ---------- Cosmos in 3D: a three.js sky the 2D layer draws labels and payoffs over ---------- */
const THREE_URL=HOSTED?new URL("vendor/three-0.170.0.min.js",location.href).href:"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js";
const C3={on:false,busy:false};
function glowTex(T,inner,outer){ const c=document.createElement("canvas"); c.width=c.height=128; const x=c.getContext("2d"), g=x.createRadialGradient(64,64,0,64,64,64); g.addColorStop(0,inner); g.addColorStop(.22,inner.replace(/[\d.]+\)$/,".55)")); g.addColorStop(1,outer); x.fillStyle=g; x.fillRect(0,0,128,128); const t=new T.CanvasTexture(c); t.colorSpace=T.SRGBColorSpace; return t; }
async function cos3Init(){
  if(C3.on||C3.busy||C3.failed) return; C3.busy=true;
  try{
    const probe=document.createElement("canvas"); if(!(probe.getContext("webgl2")||probe.getContext("webgl"))) throw new Error("no webgl");
    const T=await import(THREE_URL); C3.T=T;
    const host=$("#tplCosmos"), cv=document.createElement("canvas"); cv.id="cos3"; cv.setAttribute("aria-hidden","true"); host.insertBefore(cv,$("#cosCanvas"));
    const r=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true,powerPreference:"high-performance"}); r.setClearColor(0x000000,0);
    const scene=new T.Scene(), cam=new T.PerspectiveCamera(42,1,.1,200);
    Object.assign(C3,{r,scene,cam,cv,tgt:new T.Vector3(),look:new T.Vector3(),t0:performance.now()});
    // deep sky
    const N=2600, pos=new Float32Array(N*3), col=new Float32Array(N*3);
    for(let i=0;i<N;i++){ const u=hash(i*1.7)*2-1, th=hash(i*3.1)*Math.PI*2, rr=40+hash(i*5.3)*30, sq=Math.sqrt(1-u*u); pos.set([Math.cos(th)*sq*rr,u*rr,Math.sin(th)*sq*rr],i*3); const g=hash(i*7.7)<.1; col.set(g?[1,.86,.55]:[.85,.9,1],i*3); }
    const sg=new T.BufferGeometry(); sg.setAttribute("position",new T.BufferAttribute(pos,3)); sg.setAttribute("color",new T.BufferAttribute(col,3));
    C3.sky=new T.Points(sg,new T.PointsMaterial({size:.55,map:glowTex(T,"rgba(255,255,255,1)","rgba(255,255,255,0)"),vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:.9}));
    scene.add(C3.sky);
    // nebula clouds
    C3.neb=[["rgba(124,92,255,.5)",[-14,-6,-30],34],["rgba(46,190,210,.35)",[18,4,-34],30],["rgba(243,210,122,.22)",[0,-10,-20],22]].map(([c,p,sz])=>{ const m=new T.Sprite(new T.SpriteMaterial({map:glowTex(T,c,"rgba(0,0,0,0)"),transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:.55})); m.position.set(...p); m.scale.set(sz,sz,1); scene.add(m); return m; });
    C3.dot=glowTex(T,"rgba(255,255,255,1)","rgba(255,255,255,0)"); C3.gold=glowTex(T,"rgba(255,226,150,1)","rgba(243,190,90,0)");
    C3.light=new T.PointLight(0xffd98a,40,30,1.6); scene.add(C3.light); scene.add(new T.AmbientLight(0x6070a0,.35));
    C3.on=true; host.classList.add("c3"); cos3Build(); cos3Size();
    COS.raf||(!still&&(COS.raf=requestAnimationFrame(cosLoop))); if(still) cosLoop(performance.now());
  }catch(e){ C3.failed=true; }
  C3.busy=false;
}
function cos3Build(){
  if(!C3.on) return; const T=C3.T, sc=C3.scene;
  (C3.grp&&sc.remove(C3.grp)); const grp=C3.grp=new T.Group(); sc.add(grp);
  const ms=moments(), n=ms.length, ti=ms.findIndex(e=>e.kind==="today");
  C3.p3=ms.map((e,i)=>{ const f=n>1?i/(n-1):0, a=-Math.PI*.6+f*Math.PI*2.35, r=1+7.2*Math.pow(f,.85); return new T.Vector3(Math.cos(a)*r,Math.sin(i*1.3)*.35+(e.kind==="ahead"?.6:0),Math.sin(a)*r); });
  C3.spr=ms.map((e,i)=>{ const today=e.kind==="today", ahead=e.kind==="ahead", big=e.splat==="red", mid=e.splat==="black";
    if(ahead){ const ring=new T.Mesh(new T.TorusGeometry(.34,.035,12,48),new T.MeshStandardMaterial({color:0xc8d2f0,emissive:0x2a3350,roughness:.35,metalness:.6})); ring.position.copy(C3.p3[i]); ring.rotation.x=Math.PI/2.4; grp.add(ring);
      const rr=Math.hypot(C3.p3[i].x,C3.p3[i].z), orb=new T.Mesh(new T.TorusGeometry(rr,.006,6,160),new T.MeshBasicMaterial({color:0x9aa4c7,transparent:true,opacity:.22})); orb.rotation.x=Math.PI/2; orb.position.y=C3.p3[i].y; grp.add(orb); return ring; }
    const m=new T.Sprite(new T.SpriteMaterial({map:today?C3.gold:C3.dot,color:today?0xffe2a0:big?0xfff0c8:0xe9eeff,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
    const s=today?2.6:big?1.5:mid?1.1:.85; m.userData.s=s; m.scale.set(s,s,1); m.position.copy(C3.p3[i]); grp.add(m); return m; });
  if(ti>=0){ C3.light.position.copy(C3.p3[ti]); const core=new T.Mesh(new T.SphereGeometry(.16,24,16),new T.MeshBasicMaterial({color:0xfff1c8})); core.position.copy(C3.p3[ti]); grp.add(core); }
  // the path: lit up to today, faint after
  const cut=ti<0?n-1:ti, mk=(a,b,op,rad)=>{ if(b-a<1) return; const curve=new T.CatmullRomCurve3(C3.p3.slice(a,b+1)); grp.add(new T.Mesh(new T.TubeGeometry(curve,Math.max(8,(b-a)*24),rad,6,false),new T.MeshBasicMaterial({color:0x8fb0ff,transparent:true,opacity:op,blending:T.AdditiveBlending,depthWrite:false}))); };
  mk(0,cut,.55,.022); mk(cut,n-1,.16,.012);
  // the star chart ring, tilted with the plane
  const R0=9.4, ch=new T.Group(); ch.add(new T.Mesh(new T.TorusGeometry(R0,.01,6,240),new T.MeshBasicMaterial({color:0xf3d27a,transparent:true,opacity:.28})));
  const tv=[]; for(let k=0;k<120;k++){ const a=k/120*Math.PI*2, L=k%10===0?.6:k%5===0?.3:.14; tv.push(Math.cos(a)*R0,Math.sin(a)*R0,0,Math.cos(a)*(R0+L),Math.sin(a)*(R0+L),0); }
  const tg=new T.BufferGeometry(); tg.setAttribute("position",new T.Float32BufferAttribute(tv,3)); ch.add(new T.LineSegments(tg,new T.LineBasicMaterial({color:0xf3d27a,transparent:true,opacity:.35})));
  ch.rotation.x=Math.PI/2; grp.add(ch); C3.chart=ch;
  C3.look.copy((C3.p3[COS.sel]||new T.Vector3()).clone().multiplyScalar(.4));
}
function cos3Size(){ if(!C3.on) return; const c=$("#cosCanvas"), w=c.clientWidth||innerWidth, h=c.clientHeight||innerHeight; C3.r.setPixelRatio(FAST?1:Math.min(2,devicePixelRatio||1)); C3.r.setSize(w,h,false); C3.cam.aspect=w/h; C3.cam.fov=w<700?58:40; C3.cam.updateProjectionMatrix(); C3.w=w; C3.h=h; }
function cos3Frame(now){
  const T=C3.T, t=(now-C3.t0)/1000, sel=C3.p3[COS.sel]; if(!sel) return;
  // the camera leans toward the chosen star: the guide leads the eye
  C3.look.lerp(sel.clone().multiplyScalar(.4),still?1:.05);
  const wide=C3.w>=896, drift=still?0:t*.05, ang=-.9+drift, dist=wide?19:27, hgt=wide?12:20;
  const want=new T.Vector3(C3.look.x+Math.cos(ang)*dist,hgt+Math.sin(t*.3)*.4,C3.look.z+Math.sin(ang)*dist);
  C3.cam.position.lerp(want,still?1:.04); const la=C3.look.clone(); if(wide) la.add(new T.Vector3(Math.sin(ang)*3.4,0,-Math.cos(ang)*3.4)); else la.add(new T.Vector3(0,-2.2,0)); C3.cam.lookAt(la);
  C3.sky.rotation.y=t*.004; C3.chart.rotation.z=t*.02;
  C3.spr.forEach((m,i)=>{ if(m.isSprite){ const b=still?1:1+.09*Math.sin(t*1.7+i*1.9); const s=m.userData.s*(i===COS.sel?1.35:1)*b; m.scale.set(s,s,1); } else m.rotation.z=t*.6+i; });
  C3.light.intensity=still?40:40+8*Math.sin(t*2);
  C3.r.render(C3.scene,C3.cam);
  const v=new T.Vector3(); COS.pts.forEach((p,i)=>{ v.copy(C3.p3[i]).project(C3.cam); p.x=(v.x*.5+.5)*C3.w; p.y=(-v.y*.5+.5)*C3.h; p.behind=v.z>1; });
}

/* ---------- the payoff, in every template: strike a to-do, read a plan's fortune ---------- */
const PAY={read:{}};
const BAD=g=>{const k=(DATA.tiers[g]||{}).key; return k==="kyo"||k==="daikyo";};
function payList(){ day=loadDay();
  return `<ol class="plist">${day.map((d,i)=>`<li><button type="button" class="pt${d.x?" x":""}" data-pt="${i}" aria-pressed="${d.x}"><i aria-hidden="true"></i><span>${esc(d.t)}</span></button></li>`).join("")}</ol>
  <form class="padd" data-padd><input type="text" maxlength="80" placeholder="Add a to-do" aria-label="Add a to-do for today"><button type="submit" class="bbtn">Add</button></form>`; }
function payDraw(id){
  const all=(DATA.deck||[]), mine=all.filter(s=>s.toward===id), pool=mine.length?mine:all; if(!pool.length) return null;
  const W=pool.map(s=>(DATA.tiers[s.grade]||{w:1}).w); let r=Math.random()*W.reduce((a,b)=>a+b,0), k=0; while(k<pool.length-1&&(r-=W[k])>0) k++;
  return PAY.read[id]=pool[k];
}
function paySlip(id){ const s=PAY.read[id]; if(!s) return `<button type="button" class="bbtn pdraw" data-pdraw="${esc(id)}">Read the fortune</button>`;
  const t=DATA.tiers[s.grade]||{en:""}, bad=BAD(s.grade);
  return `<div class="pslip ${bad?"bad":"good"}"><div class="pg">${esc(t.en)}</div><p>${esc(s.move)}</p><div class="prow">${s.act&&s.act.kind==="todo"?`<button type="button" class="bbtn" data-pact="${esc(id)}">Add to today</button>`:""}<button type="button" class="bbtn ghost2" data-pdraw="${esc(id)}">Draw again</button></div></div>`; }
function payRefresh(){ if(TPL==="cosmos") cosSelect(COS.sel); else if(TPL==="basic"){ const sc=$("#bScroll"), y=sc.scrollTop; renderBasic(); sc.scrollTop=y; } }
document.addEventListener("click",ev=>{
  const t=ev.target.closest("[data-pt]"), d=ev.target.closest("[data-pdraw]"), a=ev.target.closest("[data-pact]");
  if(!t&&!d&&!a) return; ev.stopPropagation();
  if(t){ day=loadDay(); const i=+t.dataset.pt; if(!day[i]) return; day[i].x=!day[i].x; saveDay(); PAY.last={k:"td",i,on:day[i].x}; if(day[i].x) cosFx("flare"); try{SFX.pluck()}catch(e){} }
  if(d){ const s=payDraw(d.dataset.pdraw); PAY.last={k:"slip",id:d.dataset.pdraw}; if(s) cosFx(BAD(s.grade)?"dim":"gold"); try{SFX.pluck()}catch(e){} }
  if(a){ const s=PAY.read[a.dataset.pact]; if(s&&s.act) addTodo(s.act.text); PAY.last={k:"add"}; }
  payRefresh();
  if(PAY.last&&PAY.last.k==="td"&&PAY.last.on){ const b=document.querySelector(`#tpl${TPL==="cosmos"?"Cosmos":"Basic"} [data-pt="${PAY.last.i}"]`); if(b){ b.classList.add("pop"); b.focus({preventScroll:true}); } }
  if(PAY.last&&PAY.last.k==="slip"){ const el=document.querySelector(`#tpl${TPL==="cosmos"?"Cosmos":"Basic"} .pslip`); if(el) el.classList.add("in"); }
},true);
document.addEventListener("submit",ev=>{ const f=ev.target.closest("[data-padd]"); if(!f) return; ev.preventDefault(); const v=f.querySelector("input").value.trim(); if(!v) return; addTodo(v); payRefresh(); const i=document.querySelector(`#tpl${TPL==="cosmos"?"Cosmos":"Basic"} [data-padd] input`); if(i) i.focus(); },true);
function cosFx(k){ if(TPL!=="cosmos"||!COS.pts.length) return; const p=COS.pts[COS.sel]; COS.fx=(COS.fx||[]).filter(f=>performance.now()-f.t<3000); COS.fx.push({k,x:p.x,y:p.y,t:performance.now()}); }

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
