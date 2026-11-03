"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const DATA=JSON.parse($("#timeline-data").textContent);
const store={
  get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},
  del(k){try{localStorage.removeItem(k)}catch(e){}}
};
const K_EVENTS="timeline.v5.events", K_HINT="timeline.v2.draghint";
let events=store.get(K_EVENTS,null)||DATA.events.map(e=>({...e}));
const MOTION=store.get("timeline.v1.motion",null);
let still=MOTION==="reduced"||(MOTION!=="full"&&matchMedia("(prefers-reduced-motion: reduce)").matches);
if(still) document.documentElement.classList.add("still");
const FINE=matchMedia("(hover:hover) and (pointer:fine)").matches;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const buzz=p=>{try{if(navigator.vibrate&&(!navigator.userActivation||navigator.userActivation.hasBeenActive))navigator.vibrate(p)}catch(e){}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const app=$("#app");
const CH=Object.fromEntries(DATA.chapters.map(c=>[c.key,c]));

/* ============ sound: procedural Web Audio, silent until the first tap ============
   Every sound is generated live: koto by Karplus-Strong string synthesis, bells by
   modal synthesis, paper and brush from filtered noise, reverb from a generated
   impulse response. No recordings are loaded. */
const AU={ctx:null};
let sfxOn=store.get("timeline.v1.sfx",!store.get("timeline.v1.mute",false));
let sfxVol=store.get("timeline.v1.sfxvol",60), musVol=store.get("timeline.v1.musvol",45);
function impulse(a,dur,dec){
  const len=Math.floor(a.sampleRate*dur), b=a.createBuffer(2,len,a.sampleRate);
  for(let c=0;c<2;c++){const d=b.getChannelData(c);let lp=0;for(let i=0;i<len;i++){const n=Math.random()*2-1;lp+=(n-lp)*(.4-.3*i/len);d[i]=lp*Math.pow(1-i/len,dec)}}
  return b;
}
function audio(create){
  if(!AU.ctx){
    if(!create) return null;
    try{AU.ctx=new (window.AudioContext||window.webkitAudioContext)()}catch(e){return null}
    try{if(navigator.audioSession) navigator.audioSession.type="playback"}catch(e){}
    const a=AU.ctx;
    const comp=a.createDynamicsCompressor(); comp.threshold.value=-16; comp.ratio.value=3; comp.attack.value=.005; comp.release.value=.3;
    AU.master=a.createGain(); AU.master.gain.value=.9; AU.master.connect(comp); comp.connect(a.destination);
    AU.verb=a.createConvolver(); AU.verb.buffer=impulse(a,3.4,2.4);
    const wet=a.createGain(); wet.gain.value=.5; AU.verb.connect(wet); wet.connect(AU.master);
    AU.sfx=a.createGain(); AU.sfx.gain.value=sfxOn?sfxVol/100:0; AU.sfx.connect(AU.master);
    const s1=a.createGain(); s1.gain.value=.3; AU.sfx.connect(s1); s1.connect(AU.verb);
    AU.music=a.createGain(); AU.music.gain.value=0; AU.music.connect(AU.master);
    const s2=a.createGain(); s2.gain.value=.7; AU.music.connect(s2); s2.connect(AU.verb);
    AU.noise=a.createBuffer(1,a.sampleRate*2,a.sampleRate); const d=AU.noise.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  }
  if(AU.ctx.state==="suspended") AU.ctx.resume();
  return AU.ctx;
}
const now=()=>AU.ctx.currentTime;
function env(g,t,a,peak,d){g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,peak),t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d)}
function noise(t,dur,bus,o={}){
  const {type="bandpass",f=1000,Q=1,f2=null,gain=.1,a=.005}=o, x=AU.ctx, s=x.createBufferSource(); s.buffer=AU.noise;
  const fl=x.createBiquadFilter(); fl.type=type; fl.frequency.setValueAtTime(f,t); if(f2) fl.frequency.exponentialRampToValueAtTime(f2,t+a+dur); fl.Q.value=Q;
  const g=x.createGain(); env(g,t,a,gain,dur);
  s.connect(fl); fl.connect(g); g.connect(bus); s.start(t,Math.random()*1.5); s.stop(t+a+dur+.05);
}
function osc(t,f,dur,bus,o={}){
  const {type="sine",gain=.1,a=.004,f2=null,detune=0}=o, x=AU.ctx, n=x.createOscillator(); n.type=type; n.frequency.setValueAtTime(f,t); if(f2) n.frequency.exponentialRampToValueAtTime(f2,t+a+dur); n.detune.value=detune;
  const g=x.createGain(); env(g,t,a,gain,dur); n.connect(g); g.connect(bus); n.start(t); n.stop(t+a+dur+.05);
}
/* koto: a plucked string, rendered once per pitch and cached */
const KS=new Map();
function ksBuf(f){
  const x=AU.ctx, key=Math.round(f); if(KS.has(key)) return KS.get(key);
  const sr=x.sampleRate, len=Math.floor(sr*3), N=Math.max(2,Math.round(sr/f)), b=x.createBuffer(1,len,sr), d=b.getChannelData(0), ring=new Float32Array(N);
  for(let i=0;i<N;i++) ring[i]=Math.random()*2-1;
  for(let i=0;i<N;i++) ring[i]=.6*ring[i]+.4*ring[(i+1)%N];
  let idx=0, peak=0;
  for(let i=0;i<len;i++){const nx=idx+1===N?0:idx+1, v=ring[idx]; d[i]=v; ring[idx]=.9985*.5*(v+ring[nx]); idx=nx; const av=v<0?-v:v; if(av>peak)peak=av}
  if(peak>0) for(let i=0;i<len;i++) d[i]/=peak;
  KS.set(key,b); return b;
}
function koto(f,gain,bus,t){
  const x=AU.ctx; t=t??x.currentTime;
  const s=x.createBufferSource(); s.buffer=ksBuf(f);
  const body=x.createBiquadFilter(); body.type="peaking"; body.frequency.value=Math.min(4000,f*2); body.gain.value=4; body.Q.value=1.5;
  const g=x.createGain(); g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(.0001,t+2.9);
  s.connect(body); body.connect(g); g.connect(bus); s.start(t); s.stop(t+3);
  noise(t,.012,bus,{type:"highpass",f:5000,gain:gain*.25,a:.001});
}
/* rin: a small temple bell; kane: the big one */
function bell(f,gain,bus,t,len=4.5){
  [[1,1],[2.71,.5],[5.15,.28],[8.4,.12],[11.9,.05]].forEach(([m,a],i)=>{const d=len/(1+i*.65);osc(t,f*m,d,bus,{gain:gain*a,a:.002,detune:-3});osc(t,f*m,d,bus,{gain:gain*a*.6,a:.002,detune:4})});
  noise(t,.03,bus,{type:"highpass",f:3500,gain:gain*.5,a:.001});
}
function kane(gain,bus,t){
  const f=73.4;
  [[.5,.5,9],[1,1,8],[1.19,.45,6],[1.5,.3,5],[2,.45,4.5],[2.52,.2,3.5],[3,.14,3]].forEach(([m,a,d])=>{osc(t,f*m,d,bus,{gain:gain*a,a:.004,detune:-2});osc(t,f*m,d,bus,{gain:gain*a*.5,a:.004,detune:3})});
  osc(t,58,.35,bus,{gain:gain*1.2,a:.003,f2:40}); noise(t,.25,bus,{type:"lowpass",f:500,gain:gain*.6,a:.002});
}
const SFX={
  ok(){return sfxOn&&audio(false)},
  brush(){if(!this.ok())return;noise(now(),.75,AU.sfx,{f:900,f2:2400,Q:.7,gain:.05,a:.12})},
  rustle(){if(!this.ok())return;const t=now();noise(t,.28,AU.sfx,{f:3200,f2:1800,Q:.8,gain:.035,a:.03});for(let i=0;i<6;i++)noise(t+Math.random()*.3,.02+Math.random()*.03,AU.sfx,{type:"highpass",f:2500+Math.random()*2500,gain:.03+Math.random()*.05,a:.001})},
  splat(R=24){if(!this.ok())return;const t=now(),k=Math.min(1,R/24);osc(t,170,.16,AU.sfx,{f2:55,gain:.22*k,a:.003});noise(t,.14,AU.sfx,{type:"lowpass",f:1100,f2:300,gain:.16*k,a:.002});for(let i=0;i<5;i++){const dt=.05+Math.random()*.32,f=1800+Math.random()*1600;osc(t+dt,f,.05,AU.sfx,{f2:f*.6,gain:.035*k,a:.001})}},
  rattle(){if(!this.ok())return;const t=now();noise(t,.03,AU.sfx,{f:1700+Math.random()*1500,Q:7,gain:.22,a:.001});osc(t,800+Math.random()*600,.04,AU.sfx,{gain:.05,a:.001})},
  clack(){if(!this.ok())return;const t=now();noise(t,.07,AU.sfx,{f:1100,Q:4,gain:.45,a:.001});osc(t,230,.2,AU.sfx,{f2:150,gain:.22,a:.002});noise(t+.11,.05,AU.sfx,{f:1300,Q:4,gain:.18,a:.001});noise(t+.19,.04,AU.sfx,{f:1500,Q:4,gain:.08,a:.001})},
  unroll(){if(!this.ok())return;const t=now();noise(t,.55,AU.sfx,{f:5200,f2:1400,Q:1.1,gain:.06,a:.04});for(let i=0;i<8;i++)noise(t+Math.random()*.5,.015,AU.sfx,{type:"highpass",f:3000,gain:.04,a:.001})},
  paper(){this.unroll()},
  bell(f=880,g=.12){if(!this.ok())return;bell(f*2.4,g*.55,AU.sfx,now())},
  kane(){if(!this.ok())return;kane(.22,AU.sfx,now())},
  shimmer(){if(!this.ok())return;const t=now(),fs=[2093,2349,2637,3136,3520,4186,4699];for(let i=0;i<24;i++)osc(t+Math.random()*2.2,fs[Math.floor(Math.random()*fs.length)],.7,AU.sfx,{gain:.022,a:.002});noise(t,2,AU.sfx,{type:"highpass",f:7000,gain:.02,a:.6})},
  chimes(){this.shimmer()},
  pluck(){if(!this.ok())return;const t=now();koto(587.3,.16,AU.sfx,t);koto(880,.1,AU.sfx,t+.07)},
  knot(){if(!this.ok())return;const t=now();koto(293.7,.16,AU.sfx,t);noise(t,.18,AU.sfx,{f:500,Q:2,gain:.05,a:.02})},
  wind(){if(!this.ok())return;noise(now(),2,AU.sfx,{type:"lowpass",f:300,f2:900,Q:.5,gain:.14,a:.6})}
};
function setSfx(on){
  sfxOn=on; store.set("timeline.v1.sfx",on);
  if(AU.ctx) AU.sfx.gain.setTargetAtTime(on?sfxVol/100:0,AU.ctx.currentTime,.05);
  if(typeof updateFrow==="function") updateFrow();
  const b=$("#sfxBtn"); if(b){b.setAttribute("aria-pressed",String(on));b.textContent=on?"Sound effects on":"Sound effects off"}
}

/* ============ music: generative, three moods ============ */
const MOODS={
  temple:{name:"Temple morning",about:"Koto and small bells",root:293.66,scale:[0,2,5,7,9]},
  bamboo:{name:"Bamboo flute",about:"Shakuhachi over koto",root:293.66,scale:[0,1,5,7,10]},
  rain:{name:"Rain at the shrine",about:"Rain, koto and a deep bell",root:220,scale:[0,2,3,7,8]}
};
let mood=store.get("timeline.v1.mood","temple"); if(!MOODS[mood]) mood="temple";
let musicOn=false, mTimer=null, mNext={}, beds=[], deg=4;
const noteF=(M,dg)=>{const n=M.scale.length,o=Math.floor(dg/n),i=((dg%n)+n)%n;return M.root*Math.pow(2,o+M.scale[i]/12)};
function flute(f,dur,gain,bus,t){
  const x=AU.ctx, o=x.createOscillator(), o2=x.createOscillator(); o.type="triangle"; o2.type="sine";
  o.frequency.setValueAtTime(f*.94,t); o.frequency.exponentialRampToValueAtTime(f,t+.35);
  o2.frequency.setValueAtTime(f*1.88,t); o2.frequency.exponentialRampToValueAtTime(f*2,t+.35);
  const lfo=x.createOscillator(); lfo.frequency.value=4.6; const lg=x.createGain(); lg.gain.setValueAtTime(0,t); lg.gain.linearRampToValueAtTime(0,t+dur*.45); lg.gain.linearRampToValueAtTime(f*.014,t+dur*.8);
  lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
  const m2=x.createGain(); m2.gain.value=.22;
  const lp=x.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=1700; lp.Q.value=.5;
  const g=x.createGain(); g.gain.setValueAtTime(.0001,t); g.gain.linearRampToValueAtTime(gain,t+.32); g.gain.linearRampToValueAtTime(gain*.75,t+Math.max(.4,dur-.4)); g.gain.exponentialRampToValueAtTime(.0001,t+dur+.3);
  o.connect(lp); o2.connect(m2); m2.connect(lp); lp.connect(g); g.connect(bus);
  [o,o2,lfo].forEach(n=>{n.start(t);n.stop(t+dur+.4)});
  const s=x.createBufferSource(); s.buffer=AU.noise; s.loop=true; const bp=x.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=f*1.6; bp.Q.value=1.4;
  const bg=x.createGain(); bg.gain.setValueAtTime(.0001,t); bg.gain.linearRampToValueAtTime(gain*.55,t+.12); bg.gain.linearRampToValueAtTime(gain*.18,t+.5); bg.gain.linearRampToValueAtTime(gain*.12,t+Math.max(.6,dur-.3)); bg.gain.exponentialRampToValueAtTime(.0001,t+dur+.25);
  s.connect(bp); bp.connect(bg); bg.connect(bus); s.start(t,Math.random()); s.stop(t+dur+.3);
}
function startBeds(){
  const x=AU.ctx, t=x.currentTime, add=n=>{beds.push(n);return n};
  if(mood!=="bamboo"){
    [[73.42,.03],[110,.022]].forEach(([f,g])=>{const o=add(x.createOscillator());o.frequency.value=mood==="rain"?f*.75:f;const gg=x.createGain();gg.gain.value=g;const l=add(x.createOscillator());l.frequency.value=.07+Math.random()*.05;const lg=x.createGain();lg.gain.value=g*.6;l.connect(lg);lg.connect(gg.gain);o.connect(gg);gg.connect(AU.music);o.start(t);l.start(t)});
  }
  if(mood!=="temple"){
    const s=add(x.createBufferSource()); s.buffer=AU.noise; s.loop=true;
    const hp=x.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=mood==="rain"?500:150;
    const lp=x.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=mood==="rain"?4200:600;
    const g=x.createGain(); g.gain.value=mood==="rain"?.05:.02;
    s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(AU.music); s.start(t);
  }
}
function stopBeds(){if(!AU.ctx)return;const t=AU.ctx.currentTime;beds.forEach(n=>{try{n.stop(t+.05)}catch(e){}});beds=[]}
function musicTick(){
  const x=AU.ctx; if(!x||!musicOn) return; const t=x.currentTime, ahead=t+.8, M=MOODS[mood], rnd=Math.random;
  if(mNext.koto<t) mNext.koto=t+.1;
  while(mNext.koto<ahead){
    deg=clamp(deg+[-2,-1,-1,0,1,1,2][Math.floor(rnd()*7)],0,10);
    const g=(mood==="temple"?.2:.13)*(.6+rnd()*.4), tt=mNext.koto;
    if(rnd()<.12){[0,1,2].forEach(k=>koto(noteF(M,deg+k),g*.8,AU.music,tt+k*.16))}
    else{koto(noteF(M,deg),g,AU.music,tt); if(rnd()<.25) koto(noteF(M,deg-3),g*.6,AU.music,tt+.02)}
    mNext.koto+=mood==="temple"?1.3+rnd()*2.4:mood==="bamboo"?3.8+rnd()*5:2.6+rnd()*4;
  }
  if(mood==="bamboo"&&mNext.flute<ahead){
    let tt=Math.max(mNext.flute,t), d0=2+Math.floor(rnd()*4); const n=3+Math.floor(rnd()*3);
    for(let i=0;i<n;i++){const dur=1.3+rnd()*1.9;flute(noteF(M,d0+5),dur,.09,AU.music,tt);d0=clamp(d0+[-1,1,-2,2,0][Math.floor(rnd()*5)],0,6);tt+=dur+.12}
    mNext.flute=tt+4+rnd()*5;
  }
  if(mNext.bell<ahead){
    const tt=Math.max(mNext.bell,t);
    if(mood==="rain"){kane(.12,AU.music,tt);mNext.bell=tt+26+rnd()*14}
    else{bell(rnd()<.5?880:1174.7,.035,AU.music,tt);mNext.bell=tt+(mood==="temple"?14+rnd()*12:24+rnd()*14)}
  }
  if(mood==="rain"){if(mNext.drop<t)mNext.drop=t;while(mNext.drop<ahead){const f=1400+rnd()*1800;osc(mNext.drop,f,.06,AU.music,{f2:f*.55,gain:.012,a:.001});mNext.drop+=.08+rnd()*.5}}
}
function musicPlay(on){
  const x=audio(true); if(!x) return;
  musicOn=on; const t=x.currentTime;
  AU.music.gain.cancelScheduledValues(t); AU.music.gain.setValueAtTime(AU.music.gain.value,t);
  if(on){
    AU.music.gain.linearRampToValueAtTime(musVol/100*.8,t+2.5);
    stopBeds(); startBeds(); mNext={koto:t+.4,flute:t+1.5,bell:t+3,drop:t+.5};
    clearInterval(mTimer); mTimer=setInterval(musicTick,150); musicTick();
  }else{
    AU.music.gain.linearRampToValueAtTime(0,t+1.2);
    clearInterval(mTimer); setTimeout(()=>{if(!musicOn)stopBeds()},1400);
  }
  updateMusicUI();
}
function setMood(m){
  if(!MOODS[m]) return; mood=m; store.set("timeline.v1.mood",m);
  if(musicOn){stopBeds();startBeds();const t=AU.ctx.currentTime;mNext={koto:t+.3,flute:t+1,bell:t+2,drop:t+.3}}
  updateMusicUI();
}
function updateMusicUI(){
  const b=$("#musicBtn"); if(b){b.setAttribute("aria-pressed",String(musicOn));b.setAttribute("aria-label",musicOn?"Pause music":"Play music");b.classList.toggle("playing",musicOn)}
  const p=$("#musicPlay"); if(p) p.textContent=musicOn?"Pause music":"Play music";
  $$('#soundVeil [name=mood]').forEach(r=>r.checked=r.value===mood);
  const np=$("#nowPlaying"); if(np) np.textContent=musicOn?`Playing: ${MOODS[mood].name}`:"Music is off";
}


/* ============ ink text builders ============ */
function glyphs(str,g0=0,step=.24){
  return [...String(str)].map((c,i)=>`<svg class="glyph" viewBox="0 0 100 100" style="--gd:${(g0+i*step).toFixed(2)}s" aria-hidden="true"><text class="halo" x="50" y="52" text-anchor="middle" dominant-baseline="central">${esc(c)}</text><text class="k" x="50" y="52" text-anchor="middle" dominant-baseline="central">${esc(c)}</text></svg>`).join("");
}
function words(str,start=0,span=.55){
  const ws=String(str||"").split(/\s+/).filter(Boolean);
  return ws.map((w,i)=>`<span class="w" style="--d:${(start+i*span/Math.max(1,ws.length)).toFixed(2)}s">${esc(w)}</span>`).join(" ");
}
function ink(el,ms=1300){
  if(!el) return;
  el.classList.remove("done","on"); void el.offsetWidth; el.classList.add("on");
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.add("done"),ms);
}

/* ============ noise ============ */
const hash=n=>{n=Math.sin(n*127.1+311.7)*43758.5453;return n-Math.floor(n)};
const vn=x=>{const i=Math.floor(x),f=x-i,u=f*f*(3-2*f);return hash(i)*(1-u)+hash(i+1)*u};
const ss=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};

/* ============ paper fibers texture (generated once) ============ */
(function paper(){
  try{
    const c=document.createElement("canvas"); c.width=c.height=420; const x=c.getContext("2d");
    for(let i=0;i<190;i++){
      const px=Math.random()*420,py=Math.random()*420,len=14+Math.random()*80,a=Math.random()*Math.PI*2,bend=(Math.random()-.5)*30,light=Math.random()<.6;
      x.strokeStyle=light?`rgba(255,250,236,${(.25+Math.random()*.35).toFixed(2)})`:`rgba(110,80,44,${(.06+Math.random()*.1).toFixed(2)})`;
      x.lineWidth=.4+Math.random()*.9; x.beginPath(); x.moveTo(px,py);
      x.quadraticCurveTo(px+Math.cos(a)*len/2-Math.sin(a)*bend,py+Math.sin(a)*len/2+Math.cos(a)*bend,px+Math.cos(a)*len,py+Math.sin(a)*len); x.stroke();
    }
    for(let i=0;i<260;i++){x.fillStyle=`rgba(90,64,34,${(Math.random()*.16).toFixed(2)})`;x.beginPath();x.arc(Math.random()*420,Math.random()*420,Math.random()*.9+.2,0,7);x.fill()}
    document.documentElement.style.setProperty("--fibers",`url(${c.toDataURL()})`);
  }catch(e){}
})();

/* ============ the stroke: geometry ============ */
let W=360, X0=0, Xend=1, BAND=160, K=BAND/300;
const todayIndex=()=>Math.max(0,events.findIndex(e=>e.kind==="today"));
function geom(){
  const tr=$("#track"); W=tr.clientWidth||360; const h=tr.clientHeight||600;
  BAND=Math.round(h<360?clamp(h*.2,48,72):clamp(h*.24,56,240)); const textMax=Math.round(clamp(h-BAND-96,90,380));
  tr.style.setProperty("--band",BAND+"px"); tr.style.setProperty("--text-max",textMax+"px");
  K=BAND/300; X0=.55*W; Xend=todayIndex()*W+.62*W;
}
function strokeAt(X){
  const t=(X-X0)/(Xend-X0); if(t<0||t>1) return null;
  const u=X/W;
  let y=15*Math.sin(u*1.9+.6)+16*(vn(u*3.1)-.5)+5*(vn(u*17)-.5);
  const lift=ss(.9,1,t); y-=34*lift*lift;
  const a=ss(0,.03,t), press=.82+.36*vn(u*2.3+9)+.12*Math.sin(u*9.1);
  let T=50*press*(.3+.7*a)*(1-.72*ss(.86,1,t)); y-=(1-a)*8;
  const dry=.05+.17*ss(.58,.92,vn(u*1.3+20))+.3*ss(.84,1,t)+.4*ss(.965,1,t);
  return {y,T,dry};
}
/* the brush: wet core, bristles, then dry-brush (kasure) streaks scraped back out */
function brush(ctx,xa,xb,toX,mid,ys,ts,nX){
  const N=34, step=2;
  xa=Math.floor(xa/step)*step-step;
  ctx.save();
  ctx.fillStyle="rgba(23,19,15,.92)"; ctx.shadowColor="rgba(23,19,15,.35)"; ctx.shadowBlur=3.5*Math.max(.5,ts);
  let top=[],bot=[];
  const flush=()=>{if(top.length>1){ctx.beginPath();ctx.moveTo(top[0][0],top[0][1]);for(const p of top)ctx.lineTo(p[0],p[1]);for(let i=bot.length-1;i>=0;i--)ctx.lineTo(bot[i][0],bot[i][1]);ctx.closePath();ctx.fill()}top=[];bot=[]};
  for(let x=xa;x<=xb+step;x+=step){
    const s=strokeAt(toX(x)); if(!s){flush();continue}
    const w=s.T*ts*.62*Math.max(0,1-s.dry*1.5); if(w<.4){flush();continue}
    const cy=mid+s.y*ys; top.push([x,cy-w/2]); bot.push([x,cy+w/2]);
  }
  flush(); ctx.restore();
  ctx.lineCap="round";
  for(let k=0;k<N;k++){
    const off=k/(N-1)-.5, e=Math.abs(off)*2;
    ctx.strokeStyle=`rgba(23,19,15,${(.42+.45*(1-e)).toFixed(2)})`;
    ctx.lineWidth=Math.max(.55,50*ts/N*2);
    ctx.beginPath(); let down=false,px=0,py=0,have=false;
    for(let x=xa;x<=xb+step;x+=step){
      const s=strokeAt(toX(x)); if(!s){down=false;have=false;continue}
      const y=mid+s.y*ys+(off*s.T+(vn(k*13.7+x*nX*.25)-.5)*s.T*.09)*ts;
      const on=vn(k*7.31+x*nX)>s.dry+e*e*.4;
      if(on&&have){if(!down)ctx.moveTo(px,py);ctx.lineTo(x,y);down=true}else down=false;
      px=x;py=y;have=true;
    }
    ctx.stroke();
  }
  ctx.save(); ctx.globalCompositeOperation="destination-out"; ctx.lineCap="round";
  for(let k=0;k<9;k++){
    const off=(hash(k*3.17)-.5)*.8;
    ctx.lineWidth=(.6+hash(k*5.3)*1.3)*Math.max(.5,ts);
    ctx.strokeStyle=`rgba(0,0,0,${(.35+hash(k*9.1)*.5).toFixed(2)})`;
    ctx.beginPath(); let down=false;
    for(let x=xa;x<=xb+step;x+=step){
      const s=strokeAt(toX(x)); if(!s){down=false;continue}
      const y=mid+s.y*ys+off*s.T*ts, on=vn(k*11.9+x*nX*.45)>.83-s.dry*.55;
      if(on){if(!down)ctx.moveTo(x,y);else ctx.lineTo(x,y);down=true}else down=false;
    }
    ctx.stroke();
  }
  ctx.restore();
}
function blobPath(ctx,cx,cy,r,seed){
  ctx.beginPath();
  for(let a=0;a<=72;a++){const g=a/72*Math.PI*2,rr=r*(.72+.55*vn(seed*3.3+g*1.7));const x=cx+Math.cos(g)*rr,y=cy+Math.sin(g)*rr*.86;a?ctx.lineTo(x,y):ctx.moveTo(x,y)}
}
const SUMI="rgba(23,19,15,.94)", SHU="rgba(179,48,26,.93)";

/* ============ particles: ink that flies, streaks and lands ============ */
const parts=[], grows=[];
let quiet=false;
function splash(ctx,cx,cy,R,col,seed,count=30,owner=null){
  if(!quiet&&R>=12) SFX.splat(R);
  grows.push({ctx,cx,cy,R,col,seed,f:0,owner}); if(owner) owner.live=(owner.live||0)+1;
  for(let i=0;i<count;i++){
    const g=hash(seed*5.1+i)*Math.PI*2, q=hash(seed*7.7+i), arm=i<8, sp=(arm?6+q*7:3+q*q*11)*Math.max(.5,R/24);
    parts.push({ctx,col,x:cx+Math.cos(g)*R*.45,y:cy+Math.sin(g)*R*.4,vx:Math.cos(g)*sp,vy:Math.sin(g)*sp*.82,r:arm?R*(.17+.08*q):Math.max(.8,R*.09*(1-q)+.7),drag:arm?.8:.84,owner});
    if(owner) owner.live++;
  }
  if(!quiet) buzz(12); wake();
}
function stepParticles(all){
  do{
    for(let i=grows.length-1;i>=0;i--){
      const b=grows[i]; b.f++; const s=Math.min(1,.45+b.f*.12);
      b.ctx.fillStyle=b.col; blobPath(b.ctx,b.cx,b.cy,b.R*s,b.seed); b.ctx.fill();
      if(s>=1){grows.splice(i,1); if(b.owner) b.owner.live--}
    }
    for(let i=parts.length-1;i>=0;i--){
      const p=parts[i]; p.ctx.fillStyle=p.col;
      p.ctx.beginPath(); p.ctx.arc(p.x,p.y,p.r,0,7); p.ctx.fill();
      p.x+=p.vx; p.y+=p.vy; p.vx*=p.drag; p.vy*=p.drag; p.r*=.9;
      if(Math.hypot(p.vx,p.vy)<.35||p.r<.35){
        if(p.r>.5){p.ctx.beginPath();p.ctx.arc(p.x,p.y,p.r*1.7,0,7);p.ctx.fill()}
        parts.splice(i,1); if(p.owner) p.owner.live--;
      }
    }
  }while(all&&(parts.length||grows.length));
}

/* ============ depth layers ============ */
const K_FAR=.18, K_FOG=.42;
function buildDepth(){
  const mist=$(".mist"), h=mist.clientHeight||600, n=events.length;
  const far=$("#far"), fw=Math.ceil(W+(n-1)*W*K_FAR), d=Math.min(1.5,window.devicePixelRatio||1,4000/fw);
  far.width=Math.round(fw*d); far.height=Math.round(h*d); far.style.width=fw+"px"; far.style.height=h+"px";
  const x=far.getContext("2d"); x.setTransform(d,0,0,d,0,0); x.clearRect(0,0,fw,h);
  for(const L of [{b:.34,a:.16,al:.07,f:.0032,s:11},{b:.41,a:.12,al:.085,f:.0055,s:23},{b:.47,a:.075,al:.1,f:.009,s:37}]){
    const base=h*L.b, amp=h*L.a, ridge=[];
    for(let px=0;px<=fw;px+=4){const p=vn(px*L.f+L.s)*.6+vn(px*L.f*2.7+L.s*2)*.3+vn(px*L.f*8+L.s*3)*.1;ridge.push([px,base-amp*Math.pow(p,1.5)*1.9])}
    const gr=x.createLinearGradient(0,base-amp*1.9,0,base+h*.12);
    gr.addColorStop(0,`rgba(23,19,15,${L.al})`); gr.addColorStop(.55,`rgba(23,19,15,${L.al*.55})`); gr.addColorStop(1,"rgba(23,19,15,0)");
    x.fillStyle=gr; x.beginPath(); x.moveTo(0,base+h*.12); ridge.forEach(p=>x.lineTo(p[0],p[1])); x.lineTo(fw,base+h*.12); x.closePath(); x.fill();
    x.strokeStyle=`rgba(23,19,15,${(L.al*1.3).toFixed(3)})`; x.lineWidth=1.1; x.beginPath(); ridge.forEach((p,i)=>{if(vn(i*.21+L.s)>.4)x.lineTo(p[0],p[1]);else x.moveTo(p[0],p[1])}); x.stroke();
  }
  const sx=fw-W*.32, sy=h*.16;
  const sg=x.createRadialGradient(sx,sy,0,sx,sy,40); sg.addColorStop(0,"rgba(179,48,26,.30)"); sg.addColorStop(.85,"rgba(179,48,26,.22)"); sg.addColorStop(1,"rgba(179,48,26,0)");
  x.fillStyle=sg; x.beginPath(); x.arc(sx,sy,40,0,7); x.fill();
  x.strokeStyle="rgba(23,19,15,.35)"; x.lineWidth=1.2; x.lineCap="round";
  [[-70,18],[-52,8],[-88,30]].forEach(([dx,dy])=>{x.beginPath();x.moveTo(sx+dx-5,sy+dy-2);x.quadraticCurveTo(sx+dx-2,sy+dy-5,sx+dx,sy+dy);x.quadraticCurveTo(sx+dx+2,sy+dy-5,sx+dx+5,sy+dy-2);x.stroke()});
  const fog=$("#fog"), gw=Math.ceil(W+(n-1)*W*K_FOG); fog.style.width=gw+"px"; let html="";
  for(let i=0;i<n*1.4;i++){const w=150+hash(i*2.1)*230,hh=40+hash(i*3.3)*80;html+=`<i style="left:${(hash(i*1.7)*gw).toFixed(0)}px;top:${(h*(.3+hash(i*4.4)*.4)).toFixed(0)}px;width:${w.toFixed(0)}px;height:${hh.toFixed(0)}px;animation-delay:-${(hash(i)*15).toFixed(1)}s"></i>`}
  for(let i=0;i<n;i++){const top=hash(i*6.6)<.5?h*(.03+hash(i*8.1)*.1):h*(.86+hash(i*8.8)*.1);html+=`<b class="leaf" style="left:${(hash(i*5.5)*gw).toFixed(0)}px;top:${top.toFixed(0)}px;transform:rotate(${(hash(i*9.9)*180).toFixed(0)}deg) scale(${(.6+hash(i*7.2)*.9).toFixed(2)});animation-delay:-${(hash(i*3)*5).toFixed(1)}s"></b>`}
  fog.innerHTML=html;
}

/* ============ the scroll: panels ============ */
const track=$("#track");
const fmtDay=d=>d.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
let OM;
function rackSVG(){
  const n=Math.min(OM.tied,14); let k="";
  for(let i=0;i<n;i++){const x=10+(i%7)*13+(i>6?6:0),y=i>6?60:34;k+=`<g transform="translate(${x} ${y}) rotate(${((hash(i*3.3)-.5)*24).toFixed(0)})"><g class="knot${i===n-1&&OM.justTied?" new":""}"><rect x="-3" y="0" width="6" height="15" rx="1"/><path d="M-4 1 L4 1" stroke="rgba(179,48,26,.7)"/></g></g>`}
  return `<svg class="rack" viewBox="0 0 110 132" role="img" aria-label="Rack with ${OM.tied} tied slip${OM.tied===1?"":"s"}">
    <path class="ln" d="M6 112 V 22 M104 112 V 22"/><path class="ln" style="--ld:.2s" d="M2 22 H 108"/>
    <path class="ln" style="--ld:.35s;stroke-width:1.4" d="M6 34 C 40 38, 70 38, 104 34 M6 60 C 40 64, 70 64, 104 60"/>${k}<text class="lbl" x="55" y="128" text-anchor="middle" font-family="Zen Kaku Gothic New, sans-serif" font-weight="700" font-size="11" fill="#902512">Tied slips</text></svg>`;
}
const chapLabel=e=>{const c=CH[e.chapter];return c?`<span class="chap">${c.num} · ${esc(c.name)}</span>`:""};
function whenHTML(e,when){
  const c=CH[e.chapter];
  return `<p class="when">${c?`<span class="chap w" style="--d:0s">${esc(c.num+" · "+c.name)}</span>`:""}${c&&when?`<span class="sep" aria-hidden="true">·</span>`:""}${words(when,.08,.2)}</p>`;
}
function panelHTML(e,i){
  const side=(i%2)?"r":"l", n=[...e.kanji].length>1?"n2":"n1";
  if(e.kind==="futures"){
    const hint=store.get(K_HINT,false)?"":`<p class="draghint" id="draghint"><svg viewBox="0 0 120 20" aria-hidden="true"><path class="ln red" style="--ld:.6s;stroke-width:2.6" d="M14 10 H106 M22 3 L12 10 L22 17 M98 3 L108 10 L98 17"/></svg><span>${words(FINE?"Press and hold the box, or press Space":"Drag or hold the box to shake it",.7,.45)}</span></p>`;
    return `<section class="panel futures" data-i="${i}" role="group" aria-label="Futures. ${esc(e.line)}">
      <div class="fhead">${whenHTML(e,e.when)}<div class="kj" aria-hidden="true">${glyphs(e.kanji,.1)}</div></div>
      <div class="stage">
        <div id="rackHost" style="display:contents">${rackSVG()}</div>
        <div class="boxcol">${hint}
          <div class="boxwrap">
            <svg class="ring" viewBox="0 -14 200 230" aria-hidden="true">
              <path class="ln" style="--ld:.2s;stroke-width:2;stroke:rgba(23,19,15,.45)" d="M168 58 C 150 22, 92 6, 52 30 C 14 54, 12 128, 50 162 C 88 196, 152 186, 176 140 C 190 112, 186 84, 172 64"/>
              <path class="fillring" id="ringFill" pathLength="100" d="M168 58 C 150 22, 92 6, 52 30 C 14 54, 12 128, 50 162 C 88 196, 152 186, 176 140 C 190 112, 186 84, 172 64"/>
            </svg>
            <button class="mikuji" id="mikuji" type="button" aria-label="Omikuji box. Press Space or Enter to shake it, or drag or hold it">
              <svg viewBox="0 0 120 160" aria-hidden="true">
                <g class="stick"><path class="ln" style="--ld:.5s" d="M60 14 V 60"/><path class="ln red" style="--ld:.6s" d="M60 14 V 24"/></g>
                <g class="mk-body">
                  <path class="ln" d="M32 42 L88 42 L95 142 L25 142 Z"/>
                  <path class="ln" style="--ld:.15s" d="M32 42 L60 33 L88 42 L60 51 Z"/>
                  <path class="ln red" style="--ld:.3s" d="M29 80 L91 80 M28 93 L92 93"/>
                  <path class="ln" style="--ld:.35s" d="M48 106 L72 106 L72 128 L48 128 Z"/>
                  <text class="lbl" x="60" y="118" text-anchor="middle" dominant-baseline="central" font-family="Yuji Syuku, serif" font-size="15" fill="#b3301a">御籤</text>
                </g>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div class="txt"><p class="line">${words(e.line,.35,.5)}</p><p class="detail">${words(e.detail,.5,.5)}</p><div class="crow" id="frow"></div></div>
    </section>`;
  }
  const when=e.kind==="today"?fmtDay(new Date()):e.when;
  const kjAttr=e.kind==="today"?` role="button" tabindex="0" data-act="today" aria-label="Open today's list"`:` aria-hidden="true"`;
  let extra="";
  if(e.kind==="title") extra=`<p class="hint">${words(FINE?"Scroll, drag or use the arrow keys":"Swipe to travel through time",.7,.45)}<svg viewBox="0 0 64 20" aria-hidden="true"><path class="ln red" style="--ld:.75s" d="M2 11 C 20 7, 40 13, 60 9 M50 3 L61 9 L51 16"/></svg></p>
    <div class="crow"><button class="chip primary" type="button" data-act="play"><b aria-hidden="true">映</b>Play the scroll</button><button class="chip" type="button" data-act="cosmos"><b aria-hidden="true">宙</b>Cosmos preview</button></div>`;
  if(e.kind==="today") extra=`<ul class="tprev" id="tprev" aria-label="Today's list"></ul><div class="crow"><button class="chip primary" type="button" data-act="today"><b aria-hidden="true">今</b>Open today's list</button></div>`;
  if(e.kind==="ahead") extra=`<div class="crow"><button class="chip" type="button" data-act="inkit"><b aria-hidden="true">墨</b>It happened: ink it</button></div>`;
  return `<section class="panel ${e.kind} side-${side}" data-i="${i}" role="group" aria-label="${esc(when)}. ${esc(e.line)}">
    ${whenHTML(e,when)}
    <div class="kjrow"><div class="kj ${n}${e.kind==="ahead"?" hollow":""}"${kjAttr}>${glyphs(e.kanji,.05)}</div></div>
    <div class="band" aria-hidden="true"><canvas class="bleed"></canvas><canvas class="ink"></canvas></div>
    <div class="txt"><p class="line">${words(e.line,.38,.5)}</p><p class="detail">${words(e.detail,.55,.5)}</p>${extra}</div>
  </section>`;
}
function frowHTML(){
  const found=Object.keys(OM.found).length;
  return `<button class="chip primary" type="button" data-act="draw"><b aria-hidden="true">籤</b>Draw a fortune</button>
    <button class="chip" type="button" data-act="book"><b aria-hidden="true">帳</b>Slip book ${found}/${DATA.deck.length}</button>
    <span class="chip static">${OM.streak?OM.streak+"-day streak":"No streak yet"}</span>
    <button class="chip" type="button" data-act="sound" aria-pressed="${sfxOn}">${sfxOn?"Sound effects on":"Sound effects off"}</button>`;
}

/* per-panel ink state; the brush tip is a fixed point on screen, the paper moves under it */
let P=[], tip=0, tipTarget=0, lastScroll=0, settledAt=-1, running=false, io;
const inked=new Set();
function sizeCanvas(c,w,h,dmax=2){const d=Math.min(dmax,window.devicePixelRatio||1);c.width=Math.max(1,Math.round(w*d));c.height=Math.max(1,Math.round(h*d));const ctx=c.getContext("2d");ctx.setTransform(d,0,0,d,0,0);return ctx}
function buildTrack(keepIndex,instant){
  const idx=clamp(keepIndex??0,0,events.length-1);
  parts.length=0; grows.length=0;
  track.innerHTML=events.map(panelHTML).join("");
  geom();
  P=$$(".panel",track).map((el,i)=>({el,i,id:events[i].id,ink:$("canvas.ink",el),bleed:$("canvas.bleed",el),ctx:null,front:0,splatted:false,pooled:false,bled:false,guided:false,live:0,kj:$(".kj",el)}));
  P.forEach(p=>{if(inked.has(p.id)){p.inked=true;p.el.classList.add("on","done")}});
  updateFrow(); bindBox();
  io&&io.disconnect();
  io=new IntersectionObserver(es=>{for(const en of es){if(en.intersectionRatio>.55){const p=P[+en.target.dataset.i];if(!p)continue;if(!p.inked){p.inked=true;inked.add(p.id);ink(p.el,1500)}if(events[p.i].kind==="ahead")drawGuide(p)}}},{root:track,threshold:[.6]});
  P.forEach(p=>io.observe(p.el));
  track.scrollLeft=idx*W;
  buildDepth();
  tip=0; tipTarget=Math.max(W,(idx+1)*W);
  if(instant){quiet=true;advanceTip(tipTarget);stepParticles(true);P.forEach(maybeBleed);quiet=false}
  updateTodayPanel(); updateSteps(idx);
  wake();
}
function panelCtx(p){if(!p.ctx&&p.ink){p.ctx=sizeCanvas(p.ink,W,BAND);p.ctx.scale(K,K)}return p.ctx}
/* only the panels on screen are drawn; ones you skipped are laid down the moment you reach them */
function advanceTip(to){
  const near=track.scrollLeft/Math.max(1,W);
  for(const p of P){
    if(!p.ink||Math.abs(p.i-near)>1.2) continue;
    const start=p.i*W, local=clamp(to-start,0,W);
    if(local<=p.front) continue;
    const was=quiet; if(local-p.front>W*.6) quiet=true;
    if(start>Xend){p.front=local;continue}
    const ctx=panelCtx(p);
    if(p.front===0&&!quiet) SFX.brush();
    brush(ctx,p.front/K,local/K,x=>start+x*K,150,1,1,.035*K);
    if(!p.pooled&&start<=X0&&start+local>=X0+4){p.pooled=true;const s=strokeAt(X0+6);if(s)splash(ctx,(X0-start)/K+4,150+s.y,14,SUMI,7.7,10,p)}
    const ev=events[p.i], sx=.5*W;
    if(!p.splatted&&local>=sx&&ev&&ev.kind==="event"&&ev.splat&&ev.splat!=="none"){
      p.splatted=true; const s=strokeAt(start+sx);
      if(s){splash(ctx,sx/K,150+s.y,24,SUMI,p.i*3.7+1,30,p); if(ev.splat==="red"){const red=()=>splash(ctx,sx/K+24,150+s.y-22,15,SHU,p.i*5.3+2,22,p); if(quiet||still) red(); else setTimeout(red,140)}}
    }
    p.front=local; quiet=was;
  }
  tip=Math.max(tip,to);
}
/* the future is outlined, not inked: a faint dotted guide */
function drawGuide(p){
  if(p.guided||!p.ink) return; p.guided=true;
  const ctx=panelCtx(p), w=W/K;
  ctx.fillStyle="rgba(23,19,15,.32)";
  for(let x=6;x<w;x+=11){const y=150+12*Math.sin((p.i*W/K+x)*.012)+6*(vn(x*.02+p.i)-.5);ctx.beginPath();ctx.arc(x,y,1.5+.6*vn(x*.07),0,7);ctx.fill()}
  ctx.strokeStyle="rgba(179,48,26,.55)"; ctx.lineWidth=1.4; ctx.beginPath(); ctx.arc(w*.5,150+12*Math.sin((p.i*W/K+w*.5)*.012),9,0,7); ctx.stroke();
}
function maybeBleed(p){
  if(p.bled||!p.bleed||!p.ctx||p.front<W-1||p.live>0||events[p.i].kind==="ahead") return;
  p.bled=true; const b=p.bleed; sizeCanvas(b,W,BAND,1).drawImage(p.ink,0,0,W,BAND);
  requestAnimationFrame(()=>b.classList.add("wick"));
}
function wake(){if(!running){running=true;requestAnimationFrame(loop)}}
function loop(now){
  const sl=track.scrollLeft;
  $("#far").style.transform=`translate3d(${(-sl*K_FAR).toFixed(1)}px,0,0)`;
  $("#fog").style.transform=`translate3d(${(-sl*K_FOG).toFixed(1)}px,0,0)`;
  const ci=sl/W;
  for(const p of P){const dd=p.i-ci; if(Math.abs(dd)>1.5||still||!p.kj) continue; p.kj.style.setProperty("--px",(dd*W*.08).toFixed(1))}
  tipTarget=Math.max(tipTarget,sl+.62*W);
  const idle=now-lastScroll>150;
  if(idle){
    const idx=Math.round(ci);
    tipTarget=Math.max(tipTarget,(idx+1)*W);
    if(settledAt!==idx){if(settledAt>=0){buzz(6);SFX.rustle();$("#live").textContent=P[idx]?P[idx].el.getAttribute("aria-label"):""}settledAt=idx;updateSteps(idx)}
  }
  tipTarget=Math.min(tipTarget,Xend+W);
  if(tip<tipTarget){const gap=tipTarget-tip;advanceTip(tip+(still?gap:Math.max(6,Math.min(gap,gap*.2))))}
  else advanceTip(tip);
  stepParticles(false);
  P.forEach(maybeBleed);
  if(tip<tipTarget-.5||parts.length||grows.length||!idle) requestAnimationFrame(loop); else running=false;
}
track.addEventListener("scroll",()=>{lastScroll=performance.now();wake()},{passive:true});
const curIndex=()=>clamp(Math.round(track.scrollLeft/Math.max(1,W)),0,events.length-1);
function goTo(i,smooth=true){track.scrollTo({left:i*W,behavior:smooth&&!still?"smooth":"auto"});lastScroll=performance.now();wake()}
function finishAll(){
  $$(".on:not(.done)").forEach(e=>e.classList.add("done"));
  anims.forEach(a=>a.finish());
  if(tip<tipTarget) advanceTip(tipTarget);
  stepParticles(true); P.forEach(maybeBleed);
}

/* ============ timed animations ============ */
const anims=new Set();
function animate(dur,frame,done){
  const a={t0:performance.now(),stopped:false,finish(){if(!this.stopped){this.stopped=true;frame(1);anims.delete(a);done&&done()}}};
  if(still||dur<=0){frame(1);done&&done();return a}
  anims.add(a);
  const tick=now=>{if(a.stopped)return;const p=Math.min(1,(now-a.t0)/dur);frame(1-Math.pow(1-p,2.2));if(p<1)requestAnimationFrame(tick);else{a.stopped=true;anims.delete(a);done&&done()}};
  requestAnimationFrame(tick); return a;
}

/* ============ whole life: a hanging scroll, read top to bottom ============ */
function renderLife(){
  const ol=$("#ovmarks"); let html="", prev="";
  events.forEach((e,i)=>{
    if(e.kind==="title"||e.kind==="futures") return;
    if(e.chapter!==prev){const c=CH[e.chapter];if(c)html+=`<li class="ovch">${esc(c.num+" · "+c.name)}</li>`;prev=e.chapter}
    const lab=e.kind==="today"?"Today":e.when;
    html+=`<li><button class="ovrow ${e.kind}" type="button" data-goto="${i}" data-k="${i}"><span class="${e.kind==="ahead"?"hollow":""}" aria-hidden="true">${glyphs([...e.kanji][0],.2)}</span><span class="ovt"><span class="ovw">${esc(lab)}</span><span class="ovl">${esc(e.line)}</span></span></button></li>`;
  });
  html+=`<li class="ovch">${esc(CH.ahead?CH.ahead.num+" · Futures":"Futures")}</li><li><button class="ovrow" type="button" data-goto="${events.findIndex(e=>e.kind==="futures")}"><span aria-hidden="true">${glyphs("籤",.2)}</span><span class="ovt"><span class="ovw">Any time</span><span class="ovl">Draw a fortune</span></span></button></li>`;
  ol.innerHTML=html;
  requestAnimationFrame(drawLifeStroke);
}
function drawLifeStroke(){
  const list=$("#ovlist"), c=$("#ovc"), rows=$$(".ovrow",list); if(!rows.length) return;
  const H=list.scrollHeight, cw=64; c.style.height=H+"px";
  const ctx=sizeCanvas(c,cw,H,2);
  // offsetTop ignores the view's entrance transform, so the stroke lines up with the rows
  const yOf=el=>{let y=0,n=el;while(n&&n!==list){y+=n.offsetTop;n=n.offsetParent}return y};
  const centers=rows.map(r=>({y:yOf(r)+r.offsetHeight/2,i:+r.dataset.k,kind:(events[+r.dataset.k]||{}).kind}));
  const firstY=centers[0].y, todayC=centers.find(c=>c.kind==="today")||centers[centers.length-1];
  const y0=firstY-10, yT=todayC.y;
  const toX=y=>X0+(y-y0)/(yT-y0)*(Xend-X0);
  ctx.save(); ctx.translate(cw/2,0); ctx.rotate(Math.PI/2);
  // in rotated space: x runs down the list, y runs across the column
  let last=y0;
  animate(1100,f=>{
    const cur=y0+(yT+30-y0)*f;
    if(cur>last){brush(ctx,last,cur,toX,0,.4,.42,.1);last=cur}
  },()=>{
    centers.forEach(cn=>{
      const e=events[cn.i]; if(!e) return;
      if(e.kind==="event"&&e.splat!=="none"){const s=strokeAt(toX(cn.y));if(s){ctx.fillStyle=SUMI;blobPath(ctx,cn.y,s.y*.4,7,cn.i*3.7+1);ctx.fill();if(e.splat==="red"){ctx.fillStyle=SHU;blobPath(ctx,cn.y+6,s.y*.4-6,4.5,cn.i*5.3+2);ctx.fill()}}}
      if(e.kind==="ahead"||e.kind===undefined){ctx.fillStyle="rgba(23,19,15,.35)";for(let k=-14;k<=14;k+=7){ctx.beginPath();ctx.arc(cn.y+k,0,1.4,0,7);ctx.fill()}}
    });
    const last=centers[centers.length-1]; ctx.fillStyle="rgba(23,19,15,.3)";
    for(let y=yT+30;y<last.y;y+=10){ctx.beginPath();ctx.arc(y,4*Math.sin(y*.05),1.4,0,7);ctx.fill()}
    ctx.restore();
  });
}

/* ============ today ============ */
const dayKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const K_DAY=()=>"timeline.v1.today."+dayKey(new Date());
function loadDay(){const saved=store.get(K_DAY(),null);if(saved)return saved;return (DATA.today&&DATA.today.date===dayKey(new Date())?DATA.today.items:[]).map(t=>({t,x:false}))}
let day=loadDay();
const saveDay=()=>{store.set(K_DAY(),day);updateTodayPanel()};
function updateTodayPanel(){
  const left=day.filter(d=>!d.x).length, b=$("#badge");
  b.hidden=!left; b.textContent=left;
  const tp=$("#tprev");
  if(tp) tp.innerHTML=day.length?day.slice(0,3).map(d=>`<li class="${d.x?"x":""}">${esc(d.t)}</li>`).join("")+(day.length>3?`<li>and ${day.length-3} more</li>`:""):`<li>Nothing on the list yet.</li>`;
}
function renderToday(animateIn,freshIndex=-1){
  const ol=$("#todos");
  ol.innerHTML=day.length?day.map((d,i)=>`<li><button type="button" class="td${d.x?" x":""}${i===freshIndex?" fresh":""}" data-td="${i}" aria-pressed="${d.x}">
    <svg class="enso" viewBox="0 0 30 30" aria-hidden="true"><path class="ln" style="--ld:${(.2+i*.08).toFixed(2)}s" d="M24 7 C 19 2, 8 3, 5 11 C 2 20, 10 28, 18 26 C 25 24, 28 16, 25 10"/><circle cx="15" cy="15" r="6"/></svg>
    <span class="tt">${words(d.t,.25+i*.08,.4)}<svg class="strike" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true"><path pathLength="100" d="M1 7 C 25 4, 55 9, 99 5"/></svg></span>
  </button></li>`).join(""):`<li class="empty">Nothing yet. Add the first one below.</li>`;
  if(animateIn) ink($("#todayv"),1400); else $("#todayv").classList.add("on","done");
}
function addTodo(text){
  day=loadDay();
  if(day.some(d=>d.t.toLowerCase()===text.toLowerCase())) return false;
  day.push({t:text,x:false}); saveDay(); return true;
}

/* ============ views ============ */
let view="scroll";
function setView(v){
  if(v===view&&v!=="scroll") return;
  finishAll(); view=v;
  $$("#zoom [data-view]").forEach(b=>b.setAttribute("aria-current",String(b.dataset.view===v)));
  const life=$("#lifev"), tod=$("#todayv"), cos=$("#cosmosv");
  life.hidden=v!=="life"; tod.hidden=v!=="today"; cos.hidden=v!=="cosmos";
  updateSteps(curIndex());
  if(v==="life"){
    $("#lifeKj").innerHTML=glyphs("生涯",.05); $("#lifeWhen").innerHTML=words("Whole life",.1,.3);
    $("#life-h").innerHTML=words("Your whole scroll, top to bottom.",.3,.5);
    $("#lifeDetail").innerHTML=words(`${events.filter(e=>e.kind==="event").length} moments in ink and ${events.filter(e=>e.kind==="ahead").length} still outlined. Tap any of them to jump there.`,.5,.6);
    life.className="region view from-far"; life.scrollTop=0; ink(life,1500); renderLife();
  }
  if(v==="today"){
    day=loadDay();
    $("#todayKj").innerHTML=glyphs("今日",.05); $("#todayWhen").innerHTML=words(fmtDay(new Date()),.1,.3);
    tod.className="region view enter"; renderToday(true);
  }
  if(v==="cosmos"){ cos.className="region view cosmos enter"; renderCosmos(); }
}
function renderCosmos(){
  $("#cosList").innerHTML=DATA.cosmos.map(m=>`<li><span class="cos-when">${esc(m.when)}</span><span class="cos-title">${esc(m.title)}</span><span class="cos-line">${esc(m.line)}</span><span class="soon">Coming soon</span></li>`).join("");
  const c=$("#stars"), v=$("#cosmosv"), w=v.clientWidth, h=v.clientHeight, ctx=sizeCanvas(c,w,h,2);
  for(let i=0;i<Math.round(w*h/2600);i++){const r=Math.random();ctx.fillStyle=`rgba(${r<.15?"217,180,91":"241,233,210"},${(.25+Math.random()*.7).toFixed(2)})`;ctx.beginPath();ctx.arc(Math.random()*w,Math.random()*h,r<.04?1.6:Math.random()*1.1+.2,0,7);ctx.fill()}
}

/* ============ play the scroll ============ */
let playing=false, playT=null;
function playScroll(on){
  playing=on; clearInterval(playT);
  if(on){
    if(!musicOn) musicPlay(true);
    setView("scroll"); if(curIndex()>=todayIndex()-1) goTo(0,false);
    playT=setInterval(()=>{const i=curIndex(); if(i>=todayIndex()){playScroll(false);return} goTo(i+1)}, still?4500:6500);
  }
  updateStrip();
}
function interrupt(){ if(playing) playScroll(false) }
function updateStrip(){
  const f=!$("#focus").hidden;
  $("#playBox").hidden=!playing;
  const show=f||playing; $("#strip").hidden=!show; app.classList.toggle("has-strip",show);
}

/* ============ omikuji ============ */
const K_OM="timeline.v2.omikuji";
OM=Object.assign({lastDay:"",streak:0,draws:0,found:{},tied:0,dai:0},store.get(K_OM,{}));
OM.justTied=false;
const saveOM=()=>{const {justTied,...o}=OM;store.set(K_OM,o)};
function moonLine(){
  const SYN=29.530588853, REF=Date.UTC(2000,0,6,18,14)/864e5;
  const ph=((((Date.now()/864e5)-REF)%SYN+SYN)%SYN)/SYN;
  const names=[[.03,"New moon"],[.22,"Waxing crescent"],[.28,"First quarter"],[.47,"Waxing gibbous"],[.53,"Full moon"],[.72,"Waning gibbous"],[.78,"Last quarter"],[.97,"Waning crescent"],[1.01,"New moon"]];
  return names.find(n=>ph<n[0])[1];
}
function pickSlip(){
  const tiers=DATA.tiers, tot=Object.values(tiers).reduce((s,t)=>s+t.w,0);
  let r=Math.random()*tot, grade=Object.keys(tiers)[0];
  for(const [g,t] of Object.entries(tiers)){if((r-=t.w)<0){grade=g;break}}
  const pool=DATA.deck.filter(s=>s.grade===grade);
  return (pool.length?pool:DATA.deck)[Math.floor(Math.random()*(pool.length||DATA.deck.length))];
}
let energy=0, boxBusy=false, drag=null;
function setRing(){const r=$("#ringFill");if(r)r.style.strokeDashoffset=String(100-energy*100)}
function bindBox(){
  const b=$("#mikuji"); if(!b) return;
  const body=$(".mk-body",b);
  b.addEventListener("pointerdown",ev=>{
    if(boxBusy) return; interrupt(); audio(true); try{b.setPointerCapture(ev.pointerId)}catch(e){}
    drag={x0:ev.clientX,x:ev.clientX,t0:performance.now(),dir:0,moved:0,lastT:0,lastR:0}; b.classList.add("drag");
    const hold=t=>{
      if(!drag||boxBusy) return;
      const dt=drag.lastT?t-drag.lastT:0; drag.lastT=t;
      if(drag.moved<10&&t-drag.t0>220){
        energy=Math.min(1,energy+dt/1400); setRing();
        body.style.setProperty("--rot",(Math.sin(t/45)*8).toFixed(1)+"deg");
        if(t-drag.lastR>85){SFX.rattle();buzz(3);drag.lastR=t}
        if(energy>=1){endDrag(b,body);drop();return}
      }
      requestAnimationFrame(hold);
    };
    requestAnimationFrame(hold);
  });
  b.addEventListener("pointermove",ev=>{
    if(!drag) return; const dx=ev.clientX-drag.x, tot=ev.clientX-drag.x0; drag.x=ev.clientX; drag.moved+=Math.abs(dx);
    body.style.setProperty("--rot",clamp(tot*.35,-24,24).toFixed(1)+"deg");
    const dir=Math.sign(dx); if(dir&&dir!==drag.dir&&drag.moved>14){SFX.rattle();buzz(5);drag.dir=dir}
    energy=Math.min(1,energy+Math.abs(dx)/900); setRing();
    if(energy>=1){endDrag(b,body);drop()}
  });
  const up=()=>{
    if(!drag) return; const tap=drag.moved<10&&performance.now()-drag.t0<220; endDrag(b,body);
    if(tap) autoShake(); else if(energy<1) decay();
  };
  b.addEventListener("pointerup",up); b.addEventListener("pointercancel",up);
  b.addEventListener("keydown",ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();autoShake()}});
  b.addEventListener("click",ev=>{if(ev.detail===0){autoShake()}});
}
function endDrag(b,body){drag=null;b.classList.remove("drag");body.style.setProperty("--rot","0deg")}
function decay(){const t0=performance.now(),e0=energy;const f=now=>{if(drag||boxBusy)return;const k=Math.min(1,(now-t0)/2500);energy=e0*(1-k*.6);setRing();if(k<1)requestAnimationFrame(f)};requestAnimationFrame(f)}
function autoShake(){
  if(boxBusy) return; interrupt(); audio(true); const b=$("#mikuji"); if(!b) return; b.classList.add("shake");
  const e0=energy, t0=performance.now(), dur=still?1:1000; let lastR=0;
  const f=now=>{const k=Math.min(1,(now-t0)/dur);energy=e0+(1-e0)*k;setRing();if(now-lastR>75){SFX.rattle();buzz(4);lastR=now}if(k<1)requestAnimationFrame(f);else{b.classList.remove("shake");drop()}};
  requestAnimationFrame(f);
}
function drop(){
  if(boxBusy) return; boxBusy=true;
  if(!store.get(K_HINT,false)){store.set(K_HINT,true);const h=$("#draghint");h&&h.remove()}
  const b=$("#mikuji"); b&&b.classList.add("out"); SFX.clack(); buzz([12,40,18]);
  setTimeout(()=>openSlip(pickSlip(),false),still?0:620);
}
function resetBox(){boxBusy=false;energy=0;setRing();const b=$("#mikuji");b&&b.classList.remove("out","shake")}
let fxRun=null;
function fxCanvases(){const v=$("#slipVeil"),w=v.clientWidth,h=v.clientHeight;return {back:sizeCanvas($("#fxBack"),w,h),front:sizeCanvas($("#fxFront"),w,h),w,h}}
function goldLeaf(front,w,h){
  const flakes=[];
  for(let i=0;i<80;i++){const a=-Math.PI/2+(Math.random()-.5)*2.6,sp=6+Math.random()*12;flakes.push({x:w/2,y:h*.44,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,s:4+Math.random()*7,rot:Math.random()*6,vr:(Math.random()-.5)*.3,ph:Math.random()*6,c:["#e9cd78","#c9a24a","#f6e3a2","#b18b35"][i%4]})}
  const t0=performance.now();
  const f=now=>{
    front.clearRect(0,0,w,h); const age=now-t0;
    for(const p of flakes){
      p.vy+=.22; p.vx*=.985; p.vy*=.985; p.x+=p.vx+Math.sin(age/300+p.ph)*.8; p.y+=p.vy; p.rot+=p.vr;
      front.save(); front.translate(p.x,p.y); front.rotate(p.rot); front.scale(1,Math.cos(age/160+p.ph));
      front.globalAlpha=clamp(1.2-age/3200,0,1); front.fillStyle=p.c;
      front.beginPath(); front.moveTo(-p.s,-p.s*.4); front.lineTo(p.s*.3,-p.s*.6); front.lineTo(p.s,p.s*.2); front.lineTo(-p.s*.2,p.s*.6); front.closePath(); front.fill();
      front.restore();
    }
    if(age<3400&&fxRun===f) requestAnimationFrame(f); else front.clearRect(0,0,w,h);
  };
  fxRun=f; requestAnimationFrame(f);
}
function inkBurst(back,w,h,col,count,R){
  const cx=w/2, cy=h*.44, local=[];
  for(let i=0;i<count;i++){const g=Math.random()*Math.PI*2,q=Math.random(),sp=(6+q*q*18)*R/30;local.push({x:cx+Math.cos(g)*R*.5,y:cy+Math.sin(g)*R*.5,vx:Math.cos(g)*sp,vy:Math.sin(g)*sp,r:3+Math.random()*R*.18})}
  back.fillStyle=col; blobPath(back,cx,cy,R*.9,Math.random()*50); back.fill();
  const f=()=>{let alive=0;for(const p of local){if(p.r<.35)continue;alive++;back.beginPath();back.arc(p.x,p.y,p.r,0,7);back.fill();p.x+=p.vx;p.y+=p.vy;p.vx*=.86;p.vy*=.86;p.r*=.91;if(Math.hypot(p.vx,p.vy)<.4){back.beginPath();back.arc(p.x,p.y,p.r*1.6,0,7);back.fill();p.r=0}}if(alive)requestAnimationFrame(f)};
  if(still){for(let i=0;i<60;i++)f()} else requestAnimationFrame(f);
}
let current=null;
function openSlip(s,review){
  current=s; const tier=DATA.tiers[s.grade], key=tier.key, tot=Object.values(DATA.tiers).reduce((a,t)=>a+t.w,0);
  const today=dayKey(new Date()), yest=dayKey(new Date(Date.now()-864e5));
  let first=false;
  if(!review){
    OM.draws++; OM.found[s.id]=(OM.found[s.id]||0)+1; if(key==="dai") OM.dai++;
    if(OM.lastDay!==today){first=true;OM.streak=OM.lastDay===yest?OM.streak+1:1;OM.lastDay=today}
    saveOM();
  }
  const no=1+Math.floor(Math.random()*100), rare=Math.round(tot/tier.w);
  const veil=$("#slipVeil"), slip=$("#slip");
  const ti=s.toward?events.findIndex(e=>e.id===s.toward):-1, tev=ti>=0?events[ti]:null;
  slip.className="slip t-"+key;
  slip.innerHTML=`<div class="roll"></div>
    <p class="meta">${words(`Slip no. ${no} · ${review?"From your slip book":first?"Today's slip":"Another draw"} · ${moonLine()} moon`,.4,.25)}</p>
    <p class="gen">${words(tier.en,.42,.25)}</p>
    <div class="grade" aria-hidden="true">${glyphs(s.grade,.5,.22)}</div>
    ${rare>=8?`<p class="rar">${words(`Rare · about 1 in ${rare}`,.6,.15)}</p>`:""}
    <p class="poem">${words(s.poem,.62,.35)}</p>
    <p class="mvl">${words("Next move",.8,.1)}</p>
    <p class="move">${words(s.move,.85,.4)}</p>
    ${tev?`<p class="toward"><button class="linkbtn" type="button" data-goto="${ti}">${tev.kind==="ahead"?"Moves you toward":"Ties to"}: ${esc(tev.line)}</button></p>`:""}
    <div class="seal" aria-hidden="true">${glyphs(s.seal,1)}</div>`;
  slip.setAttribute("aria-label",`${tier.en}. ${s.poem} Next move: ${s.move}`);
  const bad=key==="kyo"||key==="daikyo";
  let btns="";
  if(s.act) btns+=`<button class="ghost primary" type="button" data-act="slipact">${esc(s.act.kind==="todo"?"Add to today's list":s.act.label)}</button>`;
  btns+=bad?`<button class="ghost${s.act?"":" primary"}" type="button" data-act="tie">Tie it to the rack</button><button class="ghost" type="button" data-act="again">Draw again</button>`
           :`<button class="ghost" type="button" data-act="keep">Keep it</button><button class="ghost" type="button" data-act="tie">Tie it to the rack</button><button class="ghost" type="button" data-act="again">Draw again</button>`;
  const bb=$("#slipBtns"); bb.innerHTML=btns; bb.classList.remove("show");
  veil.classList.toggle("dark",bad); veil.hidden=false; veil.scrollTop=0;
  if(slip.getAnimations) slip.getAnimations().forEach(an=>{if(!(typeof CSSAnimation!=="undefined"&&an instanceof CSSAnimation))an.cancel()});
  slip.style.animation="none"; void slip.offsetWidth; slip.style.animation="";
  $("#rays").classList.remove("go"); $("#flash").classList.remove("go");
  const fx=fxCanvases(); fxRun=null;
  SFX.unroll();
  ink(slip,2300);
  setTimeout(()=>{bb.classList.add("show");const f=bb.querySelector("button");f&&f.focus({preventScroll:true})},still?0:1500);
  if(review) return;
  setTimeout(()=>{
    if(key==="dai"){
      void $("#rays").offsetWidth; $("#rays").classList.add("go"); $("#flash").classList.add("go");
      SFX.kane(); SFX.shimmer(); SFX.bell(523,.14); buzz([20,50,20,50,80]);
      inkBurst(fx.back,fx.w,fx.h,"rgba(201,162,74,.55)",40,46); goldLeaf(fx.front,fx.w,fx.h);
    }else if(key==="chu"||key==="kichi"){
      SFX.bell(key==="chu"?349:330,.15); buzz([16,40,16]); inkBurst(fx.back,fx.w,fx.h,SHU,key==="chu"?34:26,key==="chu"?40:32);
    }else if(key==="sho"||key==="sue"){
      SFX.bell(294,.1); buzz(14); inkBurst(fx.back,fx.w,fx.h,"rgba(23,19,15,.75)",14,20);
    }else{
      SFX.wind(); buzz([40,60,40]); inkBurst(fx.back,fx.w,fx.h,"rgba(23,19,15,.9)",key==="daikyo"?40:22,key==="daikyo"?48:30);
    }
    updateFrow();
  },still?0:420);
}
function closeSlip(){
  $("#slipVeil").hidden=true; fxRun=null; $("#rays").classList.remove("go");
  ["#fxBack","#fxFront"].forEach(s=>{const c=$(s);c.width=1;c.height=1});
  resetBox(); current=null;
  const b=$("#mikuji"); b&&b.focus({preventScroll:true});
}
function updateFrow(){const fr=$("#frow");if(fr)fr.innerHTML=frowHTML()}
function tieSlip(){
  const slip=$("#slip"), rack=$(".rack"), done=()=>{
    OM.tied++; OM.justTied=true; saveOM(); closeSlip();
    const host=$("#rackHost"); if(host){host.innerHTML=rackSVG();host.firstElementChild.classList.add("on","done")}
    OM.justTied=false; SFX.knot(); buzz(10);
  };
  if(still||!rack||!slip.animate){done();return}
  const a=slip.getBoundingClientRect(), r=rack.getBoundingClientRect();
  const dx=r.left+r.width/2-(a.left+a.width/2), dy=r.top+r.height*.4-(a.top+a.height/2);
  SFX.paper();
  slip.animate([{transform:"none",opacity:1},{transform:"scale(.55,.12)",opacity:1,offset:.45},{transform:`translate(${dx}px,${dy}px) scale(.04,.05) rotate(12deg)`,opacity:.2}],{duration:820,easing:"cubic-bezier(.4,0,.2,1)",fill:"forwards"}).onfinish=done;
  $("#slipBtns").classList.remove("show");
}
function flyToToday(fromEl){
  const nav=$("#navToday");
  const done=()=>{nav.classList.remove("pulse");void nav.offsetWidth;nav.classList.add("pulse");SFX.pluck();buzz([8,30,8])};
  if(still||!fromEl||!document.body.animate){done();return}
  const A=app.getBoundingClientRect(), f=fromEl.getBoundingClientRect(), t=nav.getBoundingClientRect();
  const x0=f.left+f.width/2-A.left, y0=f.top+f.height/2-A.top, x1=t.left+t.width/2-A.left, y1=t.top+t.height/2-A.top;
  const d=document.createElement("div"); d.className="flydot"; d.style.left=x0+"px"; d.style.top=y0+"px"; app.appendChild(d);
  const mx=(x1-x0)*.5+(x0<x1?-60:60), my=Math.min(y0,y1)-120-y0;
  d.animate([{transform:"translate(0,0) scale(1)"},{transform:`translate(${mx}px,${my}px) scale(1.5)`,offset:.45},{transform:`translate(${x1-x0}px,${y1-y0}px) scale(.6)`}],{duration:750,easing:"cubic-bezier(.5,0,.3,1)"}).onfinish=()=>{d.remove();done()};
}

/* focus timer */
const K_FOCUS="timeline.v1.focus";
let focusTimer=null;
function startFocus(min,label){store.set(K_FOCUS,{end:Date.now()+min*6e4,total:min*6e4,label});runFocus()}
function runFocus(){
  const f=store.get(K_FOCUS,null), el=$("#focus"); clearInterval(focusTimer);
  if(!f){el.hidden=true;updateStrip();return}
  el.hidden=false; $("#focusL").textContent=f.label; updateStrip();
  const tick=()=>{
    const left=f.end-Date.now();
    if(left<=0){$("#focusT").textContent="Done";$("#focusArc").style.strokeDashoffset="100";clearInterval(focusTimer);store.del(K_FOCUS);SFX.bell(392,.18);buzz([30,60,30]);setTimeout(()=>{el.hidden=true;updateStrip()},8000);return}
    const m=Math.floor(left/6e4), s=Math.floor(left%6e4/1e3);
    $("#focusT").textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    $("#focusArc").style.strokeDashoffset=String(100*(1-left/f.total));
  };
  tick(); focusTimer=setInterval(tick,1000);
}

/* slip book */
function openBook(){
  const found=Object.keys(OM.found).length;
  $("#bstats").innerHTML=[[OM.streak,"Day streak"],[OM.draws,"Draws"],[`${found}/${DATA.deck.length}`,"Found"],[OM.tied,"Tied"]].map(([v,l])=>`<li><b>${esc(v)}</b><span>${l}</span></li>`).join("");
  $("#book").innerHTML=DATA.deck.map(s=>{
    const n=OM.found[s.id]||0, key=DATA.tiers[s.grade].key;
    return n?`<li><button class="bk t-${key}" type="button" data-slip="${s.id}" aria-label="${esc(DATA.tiers[s.grade].en)}: ${esc(s.poem)}"><span class="bg" aria-hidden="true">${esc(s.grade)}</span><span class="be">${esc(DATA.tiers[s.grade].en)}</span><span class="bn">×${n}</span></button></li>`
            :`<li><span class="bk unfound" role="img" aria-label="Not found yet"><span class="bg" aria-hidden="true">${esc(s.grade)}</span><span class="be">Not found yet</span></span></li>`;
  }).join("");
  $("#bookVeil").hidden=false;
}

/* ============ edit ============ */
let editing=0, armed=null;
function openEdit(){
  editing=curIndex(); const e=events[editing]; if(!e) return; armed=null;
  $("#e-when").value=e.when||""; $("#e-kanji").value=e.kanji||""; $("#e-line").value=e.line||""; $("#e-detail").value=e.detail||"";
  $("#e-when").disabled=e.kind==="today";
  $("#sp-"+(e.splat||"none")).checked=true;
  const special=e.kind!=="event"&&e.kind!=="ahead";
  $("#removeBtn").hidden=special; $$('#ef [name=splat]').forEach(r=>r.disabled=e.kind!=="event");
  $("#edit-h").textContent=e.kind==="today"?"Edit today's moment":e.kind==="futures"?"Edit the futures panel":e.kind==="ahead"?"Edit this plan":"Edit this moment";
  $("#estatus").textContent=""; $("#editVeil").hidden=false; $("#e-line").focus();
}
const saveEvents=()=>store.set(K_EVENTS,events);
function rebuild(i){finishAll();buildTrack(i,true)}
$("#ef").addEventListener("submit",ev=>{
  ev.preventDefault();
  const e=events[editing], k=[...$("#e-kanji").value.trim()].slice(0,2).join(""), line=$("#e-line").value.trim();
  if(!k||!line){$("#estatus").textContent="Add a kanji and a line, then save.";return}
  if(e.kind!=="today") e.when=$("#e-when").value.trim();
  e.kanji=k; e.line=line; e.detail=$("#e-detail").value.trim();
  const sp=$("#ef [name=splat]:checked"); if(sp&&e.kind==="event") e.splat=sp.value;
  inked.delete(e.id); saveEvents(); $("#editVeil").hidden=true; rebuild(editing);
});
function inkIt(){
  const i=curIndex(), e=events[i]; if(!e||e.kind!=="ahead") return;
  e.kind="event"; e.chapter="now"; e.splat="red";
  e.when="Inked "+new Date().toLocaleDateString("en-US",{month:"short",year:"numeric"});
  events.splice(i,1); const at=todayIndex(); events.splice(at,0,e); inked.delete(e.id);
  saveEvents(); rebuild(at); SFX.kane(); SFX.shimmer(); buzz([20,50,20]);
  $("#live").textContent=`Inked: ${e.line}`;
}

/* ============ one click handler ============ */
document.addEventListener("click",ev=>{
  const t=ev.target.closest("[data-act],[data-view],[data-goto],[data-td],[data-slip]");
  if(!t){ if(!ev.target.closest(".veil")) finishAll(); else if(ev.target.closest(".slipveil")) $$("#slipVeil .on:not(.done)").forEach(e=>e.classList.add("done")); return }
  if(t.dataset.view){ interrupt(); setView(t.dataset.view); return }
  if(t.dataset.goto){ interrupt(); const i=+t.dataset.goto; if(!$("#slipVeil").hidden) closeSlip(); setView("scroll"); goTo(i,false); return }
  if(t.dataset.td){ const i=+t.dataset.td; day[i].x=!day[i].x; saveDay(); t.classList.toggle("x",day[i].x); t.setAttribute("aria-pressed",day[i].x); if(day[i].x){SFX.pluck();buzz(8)} return }
  if(t.dataset.slip){ const s=DATA.deck.find(d=>d.id===t.dataset.slip); if(s){$("#bookVeil").hidden=true;openSlip(s,true)} return }
  const a=t.dataset.act;
  if(a==="noop") return;
  if(a==="today"){ interrupt(); setView("today"); return }
  if(a==="draw"){ autoShake(); return }
  if(a==="again"){ closeSlip(); setTimeout(autoShake,still?0:250); return }
  if(a==="keep"){ closeSlip(); return }
  if(a==="tie"){ tieSlip(); return }
  if(a==="slipact"&&current&&current.act){
    const act=current.act;
    if(act.kind==="todo"){ const ok=addTodo(act.text); t.textContent=ok?"Added to today's list":"Already on today's list"; t.disabled=true; if(ok) flyToToday(t); return }
    if(act.kind==="today"){ closeSlip(); setView("today"); setTimeout(()=>{const i=$("#addt");i.placeholder="Your one next step";i.focus()},400); return }
    if(act.kind==="focus"){ startFocus(act.minutes,act.label.replace(/^Start an? /,"")); t.textContent="Started"; t.disabled=true; SFX.bell(330,.12); return }
    if(act.kind==="play"){ closeSlip(); playScroll(true); return }
  }
  if(a==="play"){ playScroll(true); return }
  if(a==="playstop"){ playScroll(false); return }
  if(a==="inkit"){ inkIt(); return }
  if(a==="cosmos"){ interrupt(); $$(".veil").forEach(v=>v.hidden=true); setView("cosmos"); return }
  if(a==="inkmode"){ setView("scroll"); return }
  if(a==="book"){ openBook(); return }
  if(a==="sound"||a==="sfx"){ audio(true); setSfx(!sfxOn); SFX.pluck(); return }
  if(a==="music"){ musicPlay(!musicOn); return }
  if(a==="fullscreen"){ toggleFs(); return }
  if(a==="prev"){ interrupt(); step(-1); return }
  if(a==="next"){ interrupt(); step(1); return }
  if(a==="stopfocus"){ store.del(K_FOCUS); runFocus(); return }
  if(a==="clear"){ day=day.filter(d=>!d.x); saveDay(); renderToday(false); return }
  if(a==="settings"){ $("#soundVeil").hidden=false; updateMusicUI(); ink($("#soundVeil"),1200); return }
  if(a==="closeveil"){ t.closest(".veil").hidden=true; return }
  if(a==="edit"){ interrupt(); if(view!=="scroll") setView("scroll"); openEdit(); return }
  if(a==="addafter"){
    const n={id:"m"+Date.now().toString(36),kind:"event",chapter:events[editing]?events[editing].chapter:"now",when:"",kanji:"新",line:"A new moment. Tap Edit to write it.",detail:"",splat:"none"};
    const at=Math.min(editing+1,todayIndex()); events.splice(at,0,n); saveEvents();
    $("#editVeil").hidden=true; rebuild(at); setTimeout(openEdit,60); return;
  }
  if(a==="remove"){
    if(armed!=="remove"){armed="remove";$("#estatus").textContent="Tap Remove again to delete this moment.";return}
    events.splice(editing,1); saveEvents(); $("#editVeil").hidden=true; rebuild(Math.max(0,editing-1)); return;
  }
  if(a==="reset"){
    if(armed!=="reset"){armed="reset";$("#estatus").textContent="Tap again to drop your edits and go back to the first draft.";return}
    store.del(K_EVENTS); events=DATA.events.map(e=>({...e})); inked.clear(); $("#editVeil").hidden=true; rebuild(0); return;
  }
  if(a==="copy"){
    const out=JSON.stringify({...DATA,events},null,2), st=$("#estatus");
    (navigator.clipboard?navigator.clipboard.writeText(out):Promise.reject()).then(()=>st.textContent="Copied. Paste it to Claude to make it the new draft.").catch(()=>st.textContent="Copy is blocked here. Your edits are still saved in this browser.");
    return;
  }
});
document.addEventListener("keydown",ev=>{
  if((ev.key==="Enter"||ev.key===" ")&&ev.target.matches&&ev.target.matches('.kj[data-act="today"]')){ev.preventDefault();setView("today")}
  if(ev.key==="Escape"){ if(!$("#slipVeil").hidden) closeSlip(); $$(".veil").forEach(v=>v.hidden=true); if(view==="cosmos") setView("scroll") }
});
$("#addf").addEventListener("submit",ev=>{
  ev.preventDefault(); const v=$("#addt").value.trim(); if(!v) return;
  day.push({t:v,x:false}); saveDay(); $("#addt").value=""; renderToday(false,day.length-1); SFX.pluck();
});

/* ============ modes + credits ============ */
$("#modesList").innerHTML=DATA.modes.map((m,i)=>{
  const st=m.state==="now"?"Current":m.state==="preview"?"Preview":"Later";
  const act=m.key==="cosmos"?` data-act="cosmos"`:m.key==="ink"?` data-act="inkmode"`:" disabled";
  return `<li><button class="mtile ${m.state}" type="button"${act}><span class="mk" aria-hidden="true">${esc(m.kanji)}</span><span class="mn">${esc(m.name)}</span><span class="ms">${st}</span></button></li>`;
}).join("");
const CREDIT=`Credits are set in build.py`;
$("#credits1").innerHTML=CREDIT; $("#credits2").innerHTML=CREDIT;

/* ============ full screen ============ */
const DE=document.documentElement;
const fsReq=DE.requestFullscreen||DE.webkitRequestFullscreen;
const isFs=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
const IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
let toastT=null;
function toast(msg){const t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,6500)}
function fsHint(){toast(IOS?"iPhone Safari doesn't allow full screen here. For a full-screen view, tap Share, then Add to Home Screen.":"Full screen is blocked in this view. Open the page in its own browser tab and try again.")}
function toggleFs(){
  if(isFs()){(document.exitFullscreen||document.webkitExitFullscreen).call(document);return}
  const enabled=document.fullscreenEnabled??document.webkitFullscreenEnabled??!!fsReq;
  if(!fsReq||!enabled){fsHint();return}
  try{const r=fsReq.call(DE,{navigationUI:"hide"});if(r&&r.catch)r.catch(fsHint)}catch(e){fsHint()}
}
function fsUI(){const on=isFs(),b=$("#fsBtn");b.setAttribute("aria-pressed",String(on));b.setAttribute("aria-label",on?"Exit full screen (F or Escape)":"Full screen (F)");b.title=on?"Exit full screen (F or Escape)":"Full screen (F)";$(".lg",b).textContent=on?"Exit full screen":"Full screen";$(".sm",b).textContent=on?"Exit":"Full"}
document.addEventListener("fullscreenchange",fsUI); document.addEventListener("webkitfullscreenchange",fsUI);
document.addEventListener("keydown",ev=>{
  if((ev.key==="f"||ev.key==="F")&&!ev.altKey&&!ev.ctrlKey&&!ev.metaKey&&!(ev.target.closest&&ev.target.closest("input,textarea,select,[contenteditable]"))){ev.preventDefault();toggleFs()}
});


/* ============ every way to move: buttons, wheel, mouse drag, keys ============ */
function step(d){
  if(view!=="scroll") setView("scroll");
  goTo(clamp(curIndex()+d,0,events.length-1));
}
function updateSteps(i){
  const pb=$("#prevBtn"), nb=$("#nextBtn"); if(!pb) return;
  pb.disabled=view==="scroll"&&i<=0; nb.disabled=view==="scroll"&&i>=events.length-1;
}
let wheelAcc=0, wheelLock=0;
track.addEventListener("wheel",ev=>{
  if(Math.abs(ev.deltaX)>Math.abs(ev.deltaY)) return;
  ev.preventDefault(); interrupt();
  const t=performance.now(); if(t<wheelLock) return;
  wheelAcc+=ev.deltaY;
  if(Math.abs(wheelAcc)>=40){step(Math.sign(wheelAcc));wheelAcc=0;wheelLock=t+450}
},{passive:false});
let mdrag=null;
track.addEventListener("pointerdown",ev=>{
  interrupt();
  if(ev.pointerType!=="mouse"||ev.button!==0) return;
  if(ev.target.closest("button,a,input,[role=button],.mikuji")) return;
  mdrag={x:ev.clientX,sl:track.scrollLeft,i:curIndex()};
  track.classList.add("grabbing"); track.style.scrollSnapType="none";
});
addEventListener("pointermove",ev=>{if(!mdrag)return;track.scrollLeft=mdrag.sl-(ev.clientX-mdrag.x)});
const mup=ev=>{
  if(!mdrag) return; const dx=ev.clientX-mdrag.x, i=mdrag.i;
  track.classList.remove("grabbing"); track.style.scrollSnapType=""; mdrag=null;
  goTo(clamp(dx<-50?i+1:dx>50?i-1:i,0,events.length-1));
};
addEventListener("pointerup",mup); addEventListener("pointercancel",mup);
document.addEventListener("keydown",ev=>{
  if(ev.defaultPrevented||ev.altKey||ev.ctrlKey||ev.metaKey) return;
  if(ev.target.closest&&ev.target.closest("input,textarea,select")) return;
  if($$(".veil").some(v=>!v.hidden)) return;
  const k=ev.key;
  if(["ArrowRight","ArrowLeft","PageUp","PageDown","Home","End"].includes(k)) interrupt();
  if(k==="ArrowRight"||k==="PageDown"){ev.preventDefault();step(1);return}
  if(k==="ArrowLeft"||k==="PageUp"){ev.preventDefault();step(-1);return}
  if(view==="scroll"&&k==="Home"){ev.preventDefault();goTo(0);return}
  if(view==="scroll"&&k==="End"){ev.preventDefault();goTo(events.length-1);return}
  if(k===" "&&view==="scroll"&&events[curIndex()]&&events[curIndex()].kind==="futures"&&!(ev.target.closest&&ev.target.closest("button"))){ev.preventDefault();autoShake()}
});
addEventListener("pointerdown",()=>audio(true),{once:true,capture:true});
addEventListener("keydown",()=>audio(true),{once:true,capture:true});

/* ============ sound sheet controls ============ */
$("#moods").innerHTML=Object.entries(MOODS).map(([k,m])=>`<label><input type="radio" name="mood" value="${k}"> ${esc(m.name)} <span class="mdesc">${esc(m.about)}</span></label>`).join("");
$("#moods").addEventListener("change",ev=>{if(ev.target.name==="mood"){setMood(ev.target.value);if(!musicOn)musicPlay(true)}});
$("#musicVol").value=musVol; $("#sfxVol").value=sfxVol;
$("#musicVol").addEventListener("input",ev=>{musVol=+ev.target.value;store.set("timeline.v1.musvol",musVol);if(AU.ctx&&musicOn)AU.music.gain.setTargetAtTime(musVol/100*.8,AU.ctx.currentTime,.1)});
$("#sfxVol").addEventListener("input",ev=>{sfxVol=+ev.target.value;store.set("timeline.v1.sfxvol",sfxVol);if(AU.ctx&&sfxOn)AU.sfx.gain.setTargetAtTime(sfxVol/100,AU.ctx.currentTime,.05)});
$("#sfxVol").addEventListener("change",()=>SFX.pluck());
$$("#soundVeil [name=motion]").forEach(r=>{r.checked=r.value===(still?"reduced":"full");r.addEventListener("change",()=>{if(r.checked)setMotion(r.value==="reduced")})});
function setMotion(reduced){
  still=reduced; store.set("timeline.v1.motion",reduced?"reduced":"full");
  document.documentElement.classList.toggle("still",reduced);
  if(reduced) finishAll();
}
setSfx(sfxOn); updateMusicUI();

/* ============ start + stay correct at every size ============ */
buildTrack(0,false); ink($("#zoom"),1400);
runFocus();
let lastSize="", rzT=null;
new ResizeObserver(()=>{
  const sz=track.clientWidth+"x"+track.clientHeight;
  if(sz===lastSize) return; const first=!lastSize; lastSize=sz; if(first) return;
  clearTimeout(rzT);
  rzT=setTimeout(()=>{
    const i=Math.round(track.scrollLeft/Math.max(1,W));
    rebuild(i);
    if(view==="life") drawLifeStroke();
    if(view==="cosmos") renderCosmos();
  },120);
}).observe(track);
