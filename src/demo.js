/* Demo mode. Open the page with ?demo (3:00) or ?demo=short (2:20) and Timeline plays its own tour.
   It runs on the visitor's own copy of the page, borrows a clean slate, and puts their saved timeline back when the tab closes.
   The meter in the corner counts every network request the page makes from the moment the tour starts. */
(function(){
const q=new URLSearchParams(location.search); if(!q.has("demo")) return;
const SHORT=/^(short|x)$/.test(q.get("demo")||"");
// ?slow=8 runs the whole page eight times slower, for recording on machines that can't capture frames fast enough
const K=Math.max(1,Math.min(20,+q.get("slow")||1));
if(K>1){ const pn=performance.now.bind(performance), p0=pn(), dn=Date.now, d0=dn(), st=setTimeout, si=setInterval, raf=requestAnimationFrame;
  const vnow=()=>p0+(pn()-p0)/K; performance.now=vnow; Date.now=()=>d0+(dn()-d0)/K;
  window.setTimeout=(f,ms=0,...a)=>st(f,ms*K,...a); window.setInterval=(f,ms=0,...a)=>si(f,ms*K,...a);
  window.requestAnimationFrame=cb=>raf(()=>cb(vnow())); }
const KEYS=k=>k&&(k.startsWith("tlpub.")||k.startsWith("timeline."));
const saved={}; try{ for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(KEYS(k)) saved[k]=localStorage.getItem(k);} Object.keys(saved).forEach(k=>localStorage.removeItem(k)); localStorage.setItem("tlpub.fast","false"); localStorage.setItem("timeline.v1.sfx","false"); }catch(e){}
addEventListener("pagehide",()=>{ try{ const all=[]; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(KEYS(k)) all.push(k);} all.forEach(k=>localStorage.removeItem(k)); for(const k in saved) localStorage.setItem(k,saved[k]); }catch(e){} });

/* ---------- the request meter: every resource, fetch, XHR, beacon and socket ---------- */
let counting=false, sent=0; const bump=()=>{ if(!counting) return; sent++; const n=document.querySelector("#dx-net b"); if(n){ n.textContent=sent; document.getElementById("dx-net").classList.toggle("hot",sent>0); } };
try{ new PerformanceObserver(l=>l.getEntries().forEach(bump)).observe({type:"resource",buffered:false}); }catch(e){}
const sb=navigator.sendBeacon&&navigator.sendBeacon.bind(navigator); if(sb) navigator.sendBeacon=(...a)=>{bump();return sb(...a)};
const WS=window.WebSocket; if(WS) window.WebSocket=function(...a){bump();return new WS(...a)};

const T=SHORT
  ? {b1:12,b2:22,b3:32,b4:45,b5:null,b6:55,b7:75,b8:83,b9:99,b10:111,b11:126,b12:140}
  : {b1:15,b2:30,b3:45,b4:60,b5:70,b6:80,b7:105,b8:115,b9:135,b10:150,b11:165,b12:180};

const css=`
#dx-cap{position:fixed;left:50%;bottom:34px;transform:translateX(-50%) translateY(8px);z-index:2147483646;max-width:min(980px,86vw);text-align:center;opacity:0;transition:opacity .7s ease,transform .7s ease;pointer-events:none}
#dx-cap.on{opacity:1;transform:translateX(-50%) translateY(0)}
#dx-cap .l{display:inline-block;padding:12px 22px;border-radius:14px;background:rgba(10,12,22,.74);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#f4f1ea;font:400 25px/1.35 'Instrument Serif',Georgia,serif;box-shadow:0 10px 40px rgba(0,0,0,.25)}
#dx-cap .s{display:block;margin-top:8px;color:rgba(244,241,234,.8);font:500 12.5px/1.4 'Instrument Sans',Helvetica,Arial,sans-serif;letter-spacing:.04em;text-shadow:0 1px 8px rgba(0,0,0,.5)}
#dx-net{position:fixed;left:18px;bottom:18px;z-index:2147483646;display:flex;align-items:center;gap:9px;padding:8px 13px 8px 11px;border-radius:999px;background:rgba(10,12,22,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#f4f1ea;font:500 11px/1 'Instrument Sans',Helvetica,Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;pointer-events:none;transition:box-shadow .6s ease,transform .6s ease}
#dx-net i{width:8px;height:8px;border-radius:50%;background:#7ee0a1;box-shadow:0 0 0 0 rgba(126,224,161,.6);animation:dxp 2.4s ease-out infinite}
#dx-net b{font:400 22px/1 'Instrument Serif',Georgia,serif;letter-spacing:0;min-width:.6em;text-align:center}
#dx-net.hot i{background:#f3a35a;animation:none}
#dx-net.lit{box-shadow:0 0 0 2px rgba(126,224,161,.55),0 0 34px rgba(126,224,161,.35);transform:scale(1.18);transform-origin:left bottom}
@keyframes dxp{0%{box-shadow:0 0 0 0 rgba(126,224,161,.55)}70%{box-shadow:0 0 0 9px rgba(126,224,161,0)}100%{box-shadow:0 0 0 0 rgba(126,224,161,0)}}
#dx-card{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:radial-gradient(120% 120% at 70% 40%,#0b1230,#05070f);color:#f4f1ea;opacity:0;transition:opacity 1s ease;pointer-events:none;text-align:center}
#dx-card.on{opacity:1}
#dx-card h1{margin:0;font:400 92px/1 'Instrument Serif',Georgia,serif;letter-spacing:-.01em}
#dx-card p{margin:0;font:400 26px/1.4 'Instrument Serif',Georgia,serif;color:rgba(244,241,234,.85)}
#dx-card .m{margin-top:22px;font:500 13px/1.8 'Instrument Sans',Helvetica,Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:rgba(244,241,234,.62)}
#dx-card .rule{width:44px;height:1.5px;background:#f3d27a;margin:6px 0}
.dx-tap{position:fixed;z-index:2147483645;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:2px solid rgba(47,85,212,.85);background:rgba(47,85,212,.16);pointer-events:none;animation:dxtap .7s ease-out forwards}
@keyframes dxtap{from{transform:scale(.4);opacity:1}to{transform:scale(1.5);opacity:0}}
#dx-fade{position:fixed;inset:0;z-index:2147483647;background:#05070f;opacity:1;transition:opacity 1.2s ease;pointer-events:none}
html.dx *{cursor:none!important}`;

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let t0=0; const el=()=>(performance.now()-t0)/1000;
const hold=async s=>{ const w=(s-el())*1000; if(w>0) await wait(w); };
const pick=sel=>{ const m=sel.match(/^(.*) >> nth=(-?\d+)$/); if(!m) return $(sel); const a=$$(m[1]), i=+m[2]; return a[i<0?a.length+i:i]; };
async function until(sel,ms=6000){ const end=performance.now()+ms; while(performance.now()<end){ const e=pick(sel); if(e&&e.getClientRects().length) return e; await wait(80);} return null; }
async function tap(sel){ const e=await until(sel); if(!e){ console.warn("demo: missing",sel); return; }
  const r0=e.getBoundingClientRect(); if(r0.bottom<0||r0.top>innerHeight) { e.scrollIntoView({block:"center"}); await wait(120); }
  const r=e.getBoundingClientRect(), d=document.createElement("div"); d.className="dx-tap"; d.style.left=(r.left+r.width/2)+"px"; d.style.top=(r.top+r.height/2)+"px"; document.body.append(d); setTimeout(()=>d.remove(),800);
  await wait(180); e.click(); }
async function type(sel,text,delay){ const e=await until(sel); if(!e) return; e.focus(); for(const ch of text){ e.value+=ch; e.dispatchEvent(new Event("input",{bubbles:true})); await wait(delay); } }
const key=k=>document.dispatchEvent(new KeyboardEvent("keydown",{key:k,bubbles:true,cancelable:true}));
function glide(sel,to,ms){ return new Promise(r=>{ const e=$(sel); if(!e) return r(); const from=e.scrollTop;
  let tgt=from; if(typeof to==="number") tgt=to; else { const t=e.querySelector(to); if(t) tgt=t.getBoundingClientRect().top-e.getBoundingClientRect().top+e.scrollTop-e.clientHeight*.35; }
  const s=performance.now(); const f=n=>{ const p=Math.min(1,(n-s)/Math.max(1,ms)), q=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2; e.scrollTop=from+(tgt-from)*q; p<1?requestAnimationFrame(f):r(); }; requestAnimationFrame(f); }); }
let tok=0;
// a beat's signs, spread evenly until the beat ends
function signs(list,end,sub=""){ const my=++tok, a=el(), span=Math.max(1,end-a)/list.length; list.forEach((l,i)=>setTimeout(()=>{ if(my===tok) cap(l,sub); },i*span*1000)); }
function cap(l,s=""){ const c=$("#dx-cap"); c.classList.remove("on"); setTimeout(()=>{ c.innerHTML=`<span class="l">${l}</span>${s?`<span class="s">${s}</span>`:""}`; c.classList.add("on"); },380); }

async function run(){
  // every font the tour uses is fetched before the clock starts, so the meter only sees the tour itself
  try{ const chars=[...new Set(document.documentElement.innerHTML)].filter(c=>c.charCodeAt(0)>32).join("");
    await Promise.all(["400 20px 'Instrument Serif'","italic 400 20px 'Instrument Serif'","400 20px 'Instrument Sans'","500 20px 'Instrument Sans'","600 20px 'Instrument Sans'","700 20px 'Instrument Sans'","400 20px 'Yuji Syuku'","500 20px 'Shippori Mincho'","700 20px 'Shippori Mincho'","500 20px 'Zen Kaku Gothic New'","700 20px 'Zen Kaku Gothic New'"].map(f=>document.fonts.load(f,chars))); }catch(e){}
  const st=document.createElement("style"); st.textContent=css; document.head.append(st); document.documentElement.classList.add("dx");
  for(const [id,h] of [["dx-cap",""],["dx-card",""],["dx-fade",""],["dx-net",'<i></i><b>0</b>requests out']]){ const d=document.createElement("div"); d.id=id; d.innerHTML=h; document.body.append(d); }
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); await wait(1500);
  t0=performance.now(); counting=true; console.log("DEMO_START");
  // 1 Basic, a whole life down to today
  await glide("#bScroll",520,10); $("#dx-fade").style.opacity="0";
  signs(["This is a whole life.","This is today."],T.b1);
  await glide("#bScroll",".bit.today",(T.b1-1.5)*1000); await hold(T.b1);
  // 2 plans below today, then back up
  signs(["Calendars know your day.","Photos know your moments.","Nothing holds a whole life."],T.b2);
  await glide("#bScroll",".bit.ahead:last-of-type",4000); await wait(1500);
  await glide("#bScroll",0,(T.b2-el()-1.2)*1000); await hold(T.b2);
  // 3 three ways in
  signs(["You choose what to share."],T.b3);
  await tap(".tbasic .bbtn.pri.lg"); await hold(T.b3);
  // 4 the quiz
  signs(["Eight taps.","No typing. No AI.","Nothing leaves the device."],T.b4);
  await tap('[data-mk="quiz"]');
  const per=Math.max(.9,(T.b4-el()-3)/8);
  for(let i=0;i<8;i++){ await wait(per*450); await tap(`.qo >> nth=${1+(i%2)}`); const m=$(".qmax"); if(m&&/up to/.test(m.textContent)){ await wait(250); await tap(".qo >> nth=3"); await tap('[data-mk="qnext"]'); } await wait(per*350); }
  await wait(400); await tap('[data-mk="apply"]'); await hold(T.b4);
  // 5 a preview of your apps
  if(T.b5){
    signs(["Refused before anything is used."],T.b5);
    await tap('.tbasic [data-act="maker"]'); await wait(700); await tap('[data-mk="apps"]'); await wait(500); await tap('[data-mk="apprun"]'); await wait(3500);
    await glide(".sheet.maker",4000,2500); await hold(T.b5); await tap('[data-mk="home"]');
  } else { await tap('.tbasic [data-act="maker"]'); await wait(600); }
  // 6 your own words
  signs(["Cut before any model sees it."],T.b6);
  await tap('[data-mk="words"]'); await wait(400);
  await type("#mkText","I grew up in a small town near the sea and got a secondhand piano at nine. Call me at 555-201-3344. I studied engineering, then moved to a new city for a design job. Next I want to walk the Kumano Kodo.",SHORT?14:22);
  await hold(T.b6);
  // 7 the writer, with the meter in the spotlight
  const gpu=!!("gpu" in navigator&&await navigator.gpu.requestAdapter().catch(()=>null));
  signs(gpu?[...(navigator.onLine?[]:["Wi-Fi off."]),"Meta's Llama 3.2, on-device.","Your life stays here."]:["Written right here.","0 requests sent.","Your life stays here."],T.b7,gpu?"":"No GPU on this machine, so Timeline's built-in writer stands in. On a WebGPU laptop, Meta's Llama 3.2 writes it.");
  $("#dx-net").classList.add("lit"); const w0=sent; console.log("DEMO_W0 "+el().toFixed(1));
  await tap('[data-who="llama"]'); await wait(1600); await tap('[data-mk="write"]');
  await until('.sheet.maker [data-mk="apply"]',gpu?60000:6000); await wait(1500);
  await glide(".sheet.maker",3000,3000);
  await hold(T.b7-5); await tap('[data-mk="apply"]'); await wait(800); $("#dx-net").classList.remove("lit"); console.log("DEMO_W1 "+el().toFixed(1)+" during-write "+(sent-w0));
  await glide("#bScroll",380,3000); await hold(T.b7);
  // 8 three looks
  signs(["Same life, three looks."],T.b8);
  await tap('.tbasic [data-act="tplpick"]'); await hold(T.b8);
  // 9 ink: whole life, today, strike one off
  signs(["Whole life, down to today.","Strike one off.","And back."],T.b9);
  await tap('.tplcard[data-tpl="ink"]'); await wait(2200);
  await tap('#zoom [data-view="life"]'); await wait(SHORT?3200:4500);
  await tap('#zoom [data-view="today"]'); await wait(1500);
  const f=$("#addt"); if(f){ await type("#addt","Book the Kumano Kodo trail",30); $("#addf").requestSubmit(); } await wait(1200);
  await tap("#todos .td >> nth=-1"); await wait(1500);
  await tap('#zoom [data-view="life"]'); await hold(T.b9);
  // 10 futures
  signs(["Every plan gets a fortune.","One small step today."],T.b10);
  await tap('#zoom [data-view="scroll"]'); await wait(900); key("End"); await wait(2200);
  await tap('[data-act="draw"]'); await wait(SHORT?4000:5200);
  if($('[data-act="slipact"]')) await tap('[data-act="slipact"]');
  await hold(T.b10);
  // 11 cosmos
  signs(["Every moment, a star.","Brightest is now.","Rings are plans."],T.b11);
  key("Escape"); await wait(300);
  await tap(".topbar .tbtn.tplb"); await wait(500); await tap('.tplcard[data-tpl="cosmos"]'); await wait(2000);
  for(let i=0;i<3;i++){ await tap('[data-cos="-1"]'); await wait(1200); }
  for(let i=0;i<3;i++){ await tap('[data-cos="1"]'); await wait(1000); }
  await hold(T.b11);
  // 12 home, then the card
  tok++; $("#dx-cap").classList.remove("on");
  await tap('.tcosmos [data-act="tplpick"]'); await wait(400); await tap('.tplcard[data-tpl="basic"]'); await wait(2000);
  const k=$("#dx-card"); k.innerHTML=`<h1>Timeline</h1><div class="rule"></div><p>Your life, at every scale.</p><div class="m">Built with Meta Llama, running on your device<br>github.com/rdilaz/timeline</div>`; k.classList.add("on");
  $("#dx-net").style.zIndex="2147483647";
  await hold(T.b12+.6); window.__demoDone={sent,dur:T.b12}; console.log("DEMO_DONE "+sent);
}
addEventListener("load",()=>setTimeout(()=>run().catch(e=>console.error("demo",e)),700));
})();
