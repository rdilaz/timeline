/* ============ make your own scroll: three ways in, you choose how much you share ============ */
const MK={tier:null, step:0, ans:{}, out:null, busy:false, who:store.get("tlpub.who","llama"), dev:null};
const QZ=TLGen.QUIZ;
const mkBody=()=>$("#mkBody");
function openMaker(){ interrupt(); $$(".veil").forEach(v=>v.hidden=true); $("#makerVeil").hidden=false; mkTiers(); }
function mkSet(html){ const b=mkBody(); b.innerHTML=html; ink(b,900); const f=$("[data-autofocus]",b)||$("button,textarea",b); if(f) setTimeout(()=>f.focus({preventScroll:true}),60); }
function meter(n){ return `<span class="meter m${n}" aria-hidden="true"><i></i><i></i><i></i></span>`; }

/* step 0: pick a tier */
function mkTiers(){
  MK.tier=null;
  mkSet(`<p class="mklead">${words("You choose how much you share.",.05,.4)}</p>
  <ol class="tiers">
    <li><button class="tier" type="button" data-mk="quiz" data-autofocus>
      <span class="tk" aria-hidden="true">問</span><span class="tn">Quiz</span><span class="tl">Tap eight answers. No AI.</span>
      ${meter(1)}<span class="tag safe">Stays on this device</span></button></li>
    <li><button class="tier" type="button" data-mk="apps">
      <span class="tk" aria-hidden="true">連</span><span class="tn">Your apps <em>Beta</em></span><span class="tl">Calendar, Photos, Mail. A working preview on sample data.</span>
      ${meter(2)}<span class="tag">No account is connected</span></button></li>
    <li><button class="tier" type="button" data-mk="words">
      <span class="tk" aria-hidden="true">語</span><span class="tn">Your words</span><span class="tl">Write it your way. Llama turns it into a timeline on this device.</span>
      ${meter(3)}<span class="tag safe">Stays on this device, or Muse if you choose</span></button></li>
  </ol>
  ${fastRow()}`);
}
function fastRow(){
  return `<div class="fastrow"><button class="switch" type="button" data-mk="fast" role="switch" aria-checked="${FAST}"><span class="knob" aria-hidden="true"></span>Fast mode</button>
  <span class="fdesc">${FAST?"On: lower resolution, fewer effects, baked by Rust.":"Off. Turn it on for older phones and laptops."}</span></div>`;
}

/* tier 1: the quiz, one question per screen */
function mkQuiz(i){
  MK.tier="quiz"; MK.step=i; const q=QZ[i], sel=MK.ans[q.id]||[];
  const pct=((i)/QZ.length*100).toFixed(1);
  mkSet(`<div class="qprog" role="progressbar" aria-valuemin="1" aria-valuemax="${QZ.length}" aria-valuenow="${i+1}" aria-label="Question ${i+1} of ${QZ.length}">
      <svg viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true"><path class="track" d="M2 7 C 80 3, 200 10, 298 5"/><path class="fill" pathLength="100" style="stroke-dashoffset:${100-pct}" d="M2 7 C 80 3, 200 10, 298 5"/></svg>
      <span>${i+1} / ${QZ.length}</span></div>
    <h3 class="qq">${words(q.q,.05,.4)}</h3>
    <p class="qmax">${q.max>1?`Pick up to ${q.max}`:"Pick one"}</p>
    <div class="qopts" role="group" aria-label="${esc(q.q)}">${q.opts.map(([v,l],k)=>`<button type="button" class="qo" data-qo="${esc(v)}" aria-pressed="${sel.includes(v)}"${k===0?" data-autofocus":""}>${esc(q.id==="era"&&v!=="Rather not say"?v:l)}</button>`).join("")}</div>
    <div class="row mkfoot">
      <button class="ghost" type="button" data-mk="${i?"qback":"home"}">Back</button>
      <button class="seal-btn" type="button" data-mk="qnext" ${sel.length?"":"disabled"}>${i===QZ.length-1?"Make my timeline":"Next"}</button>
      <button class="txt-btn" type="button" data-mk="qskip">Skip</button>
    </div>`);
}
function qToggle(v){
  const q=QZ[MK.step]; let sel=MK.ans[q.id]||[];
  if(sel.includes(v)) sel=sel.filter(x=>x!==v); else { if(q.max===1) sel=[v]; else { if(sel.length>=q.max) sel=sel.slice(1); sel=[...sel,v]; } }
  MK.ans[q.id]=sel; SFX.pluck();
  $$(".qo",mkBody()).forEach(b=>b.setAttribute("aria-pressed",String(sel.includes(b.dataset.qo))));
  const n=$('[data-mk="qnext"]',mkBody()); if(n) n.disabled=!sel.length;
  if(q.max===1&&sel.length) setTimeout(()=>{ if(MK.tier==="quiz"&&QZ[MK.step]===q) qNext(); },still?0:260);
}
function qNext(){ if(MK.step<QZ.length-1) mkQuiz(MK.step+1); else mkResult(TLGen.fromQuiz(MK.ans),"quiz",0); }

/* tier 2: connected apps, a framework preview that runs the real guard on sample data */
const APP_SAMPLE=[
  ["暦","Calendar","Graduation day, May 2016"],["暦","Calendar","Dentist at 12 Elm St"],["写","Photos","Album: first trip abroad, 2019"],
  ["便","Mail","Your order 4821377 has shipped"],["写","Photos","Album: the new studio, 2022"],["便","Mail","Call me at 555-201-3344 about the lease"],
  ["暦","Calendar","Pottery class, every Saturday"],["写","Photos","Album: Kumano Kodo plans"]
];
function mkApps(){
  MK.tier="apps";
  mkSet(`<p class="mklead">${words("A preview of how connected apps would work.",.05,.4)}</p>
  <ul class="srcs">
    <li><span class="sk" aria-hidden="true">暦</span><b>Google Calendar</b><span>Reads event titles and years</span></li>
    <li><span class="sk" aria-hidden="true">写</span><b>Google Photos</b><span>Reads album names and years</span></li>
    <li><span class="sk" aria-hidden="true">便</span><b>Gmail</b><span>Reads subjects only</span></li>
    <li class="later"><span class="sk" aria-hidden="true">他</span><b>Apple and Microsoft</b><span>Later</span></li>
  </ul>
  <p class="never"><b>Never reads</b> message text, locations, contacts or faces.</p>
  <div class="row"><button class="seal-btn" type="button" data-mk="apprun" data-autofocus>Run the preview</button><button class="ghost" type="button" data-mk="home">Back</button></div>
  <ol class="feed" id="feed" aria-live="polite"></ol>`);
}
function appRun(){
  const feed=$("#feed"); feed.innerHTML=""; const kept=[]; let k=0;
  $('[data-mk="apprun"]').disabled=true;
  const next=()=>{
    if(k>=APP_SAMPLE.length){ const n=$('[data-mk="apprun"]'); n.disabled=false; n.textContent="Use this timeline"; n.dataset.mk="appuse"; MK.out=kept; SFX.bell(523,.1); return; }
    const [kj,src,t]=APP_SAMPLE[k++], c=TLGuard.clean(t), ok=!c.removed.length;
    const li=document.createElement("li"); li.className=ok?"ok":"no";
    li.innerHTML=`<span class="fk" aria-hidden="true">${kj}</span><span class="ft"><span class="fs">${esc(src)}</span><span class="fl">${esc(t)}</span></span><span class="fv">${ok?"Kept":"Refused: "+esc(c.removed[0].label)}</span>`;
    feed.appendChild(li); if(ok){ kept.push(t); SFX.pluck(); } else SFX.paper();
    setTimeout(next,still?0:420);
  };
  next();
}
function appMoments(titles){
  return titles.map(t=>{
    const y=(t.match(/\b(19|20)\d{2}\b/)||[""])[0], line=t.replace(/^Album:\s*/,"").replace(/,?\s*\b(19|20)\d{2}\b/,"").trim();
    const plan=/plans?\b/i.test(t), cap=line.charAt(0).toUpperCase()+line.slice(1);
    return {kind:plan?"ahead":"event",chapter:plan?"ahead":/graduat/i.test(t)?"craft":"making",when:y||(plan?"Next":"Lately"),kanji:TLGen.pickKanji(t),line:cap.replace(/\s*plans?$/i,"")+".",detail:"",splat:/graduat/i.test(t)?"red":"none"};
  });
}

/* tier 3: your own words, written into a scroll by Llama on this device or, opt-in, by Muse */
function mkWords(){
  MK.tier="words";
  const draft=MK.draft||"";
  mkSet(`<label for="mkText" class="mklabel">Your story, in a few sentences</label>
  <textarea id="mkText" maxlength="${TLGuard.MAX_INPUT}" rows="6" placeholder="Where you grew up, what you loved, what changed, what's next." data-autofocus>${esc(draft)}</textarea>
  <div class="tcount"><span id="mkCount">${draft.length} / ${TLGuard.MAX_INPUT}</span><button class="txt-btn" type="button" data-mk="example">Try a made-up example</button></div>
  <ul class="cut" id="mkCut" aria-live="polite"></ul>
  <fieldset class="who"><legend>Who writes it</legend><div class="seg2">
    <button type="button" data-who="llama" aria-pressed="${MK.who==="llama"}"><b>Llama 3.2</b><span>On this device. Nothing leaves it.</span></button>
    <button type="button" data-who="muse" aria-pressed="${MK.who==="muse"}"><b>Muse by Meta</b><span>Sends the cleaned text to Meta. Opt-in.</span></button>
  </div></fieldset>
  <p class="devline" id="devline">${MK.who==="llama"?"Checking this device…":museLine()}</p>
  <div class="row mkfoot"><button class="ghost" type="button" data-mk="home">Back</button><button class="seal-btn" type="button" data-mk="write">Write my timeline</button></div>`);
  liveCut(); devCheck();
}
function museLine(){ return MUSE_OK?"Muse is ready. Only the text shown above, with refused parts cut out, is sent. Nothing is stored.":HOSTED?"Muse isn't switched on for this site right now. Use Llama or the quiz.":"Muse runs on the live site. This preview can't reach it."; }
function liveCut(){
  const ta=$("#mkText"); if(!ta) return; const c=TLGuard.clean(ta.value);
  $("#mkCount").textContent=`${ta.value.length} / ${TLGuard.MAX_INPUT}`;
  const seen=[...new Set(c.removed.map(r=>r.label))];
  $("#mkCut").innerHTML=seen.map(l=>`<li>Will be cut: ${esc(l)}</li>`).join("");
}
async function devCheck(){
  const line=$("#devline"); if(!line) return;
  if(MK.who==="muse"){ line.textContent=museLine(); return; }
  const d=MK.dev||(MK.dev=await LLM.check()); if(!$("#devline")) return;
  line.textContent=d.ok?(HOSTED?`This device can run it. First run downloads about ${d.mb} MB, once.`:"This device could run it. Model downloads only work on the live site, so this preview uses the quiz writer instead."):`${d.why} Use the quiz, or Muse.`;
  line.classList.toggle("warn",!d.ok);
}
async function mkWrite(){
  const ta=$("#mkText"); MK.draft=ta.value; const c=TLGuard.clean(ta.value);
  if(c.empty){ $("#mkCut").innerHTML=`<li>Write a sentence or two first.</li>`; ta.focus(); return; }
  const cut=c.removed.length;
  mkRun(MK.who==="muse"?"Sending to Muse":"Waking Llama");
  try{
    let raw;
    if(MK.who==="muse"){
      if(!MUSE_OK) throw new Error(museLine());
      setRun("Muse is reading your story",.4);
      const r=await fetch("api/muse",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({story:c.text})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.error||"Muse didn't answer. Try again or use Llama.");
      raw=j;
    } else {
      const d=MK.dev||(MK.dev=await LLM.check());
      if(!d.ok||!HOSTED){ mkResult(storyFallback(c.text),"words",cut,!HOSTED?"This preview can't download Llama, so a simple writer on this page made it. On the live site Llama writes it.":d.why+" A simple writer on this page made it instead."); return; }
      raw=await LLM.write(c.text,d,setRun);
    }
    const chk=TLGen.checkMoments(raw);
    if(chk.moments.length<2) throw new Error("The model's answer didn't hold together. Try again, or add a little more detail.");
    mkResult(chk.moments,"words",cut,"",chk.dropped);
  }catch(e){ if(MK.cancelled){MK.cancelled=false;return} mkError(String(e&&e.message||e)); }
}
/* a tiny, rule-based writer: one moment per sentence, so the tier still works with no AI at all */
function storyFallback(text){
  // a clause that held a refused piece goes entirely, so no "at ." is left behind
  const sents=text.split(/(?<=[.!?])\s+|\n+/).map(s=>s.split(/,\s*/).filter(c=>!c.includes("▢")).join(", ").replace(/[\s,]+$/,"").trim()).map(s=>s&&!/[.!?]$/.test(s)?s+".":s).filter(s=>s.length>8).slice(0,12);
  return sents.map((s,i)=>{
    const ahead=/\b(want|plan|hope|someday|next|will|dream|going to)\b/i.test(s), y=(s.match(/\b(19|20)\d{2}\b/)||[])[0], age=(s.match(/\b(?:age|aged|was)\s+(\d{1,2})\b/i)||[])[1];
    let line=s.replace(/^(and|then|later|next|so|but)\s+/i,"").replace(/\bI\b/g,"you").replace(/\bmy\b/gi,"your").replace(/\bme\b/gi,"you").replace(/\bI'm\b/gi,"you're").replace(/\bam\b/g,"are").replace(/\bwas\b/g,"were");
    line=line.charAt(0).toUpperCase()+line.slice(1); if(line.length>78) line=line.slice(0,76).replace(/\s+\S*$/,"")+"…";
    return {kind:ahead?"ahead":"event",chapter:ahead?"ahead":i<2?"roots":i<4?"craft":"making",when:y||(age?"Age "+age:ahead?"Next":""),kanji:TLGen.pickKanji(s),line,detail:"",splat:i===1?"black":"none"};
  });
}

/* running, error and result screens */
function mkRun(label){
  MK.busy=true;
  mkSet(`<div class="run"><div class="kj big" aria-hidden="true">${glyphs("書",.05)}</div>
    <div class="qprog wide" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="runbar"><svg viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true"><path class="track" d="M2 7 C 80 3, 200 10, 298 5"/><path class="fill" pathLength="100" style="stroke-dashoffset:96" d="M2 7 C 80 3, 200 10, 298 5"/></svg></div>
    <p class="runtxt" id="runtxt">${esc(label)}</p>
    <div class="row"><button class="ghost" type="button" data-mk="cancel" data-autofocus>Cancel</button></div></div>`);
}
function setRun(t,f){ const e=$("#runtxt"); if(e) e.textContent=t; const b=$("#runbar"); if(b&&f!=null){ b.setAttribute("aria-valuenow",String(Math.round(f*100))); $(".fill",b).style.strokeDashoffset=String(100-Math.max(4,f*100)); } }
function mkError(msg){ MK.busy=false; mkSet(`<p class="mklead">${words("That didn't work.",.05,.4)}</p><p class="err">${esc(msg)}</p><div class="row"><button class="seal-btn" type="button" data-mk="words" data-autofocus>Try again</button><button class="ghost" type="button" data-mk="quiz">Use the quiz</button></div>`); }
function mkResult(moments,from,cut,note,dropped=0){
  MK.busy=false; MK.out=moments;
  const first=moments.filter(m=>m.kind!=="ahead"), plans=moments.filter(m=>m.kind==="ahead");
  const row=m=>`<li class="${m.kind}"><span class="rk${m.kind==="ahead"?" hollow":""}" aria-hidden="true">${esc(m.kanji)}</span><span class="rt"><span class="rw">${esc(m.when||"")}</span><span class="rl">${esc(m.line)}</span></span></li>`;
  const notes=[note, cut?`${cut} refused piece${cut>1?"s were":" was"} cut before anything ran.`:"", dropped?`${dropped} line${dropped>1?"s":""} from the model failed the check and were left out.`:""].filter(Boolean);
  mkSet(`<p class="mklead">${words(`${first.length} moments and ${plans.length} plan${plans.length===1?"":"s"}.`,.05,.4)}</p>
    ${notes.map(n=>`<p class="note">${esc(n)}</p>`).join("")}
    <ol class="res">${first.map(row).join("")}${plans.length?`<li class="rsep">Ahead</li>`+plans.map(row).join(""):""}</ol>
    <div class="row mkfoot"><button class="seal-btn" type="button" data-mk="apply" data-autofocus>Make my timeline</button><button class="ghost" type="button" data-mk="${from==="quiz"?"quiz":from==="apps"?"apps":"words"}">Start over</button></div>`);
}
function mkApply(){
  const ev=TLGen.assemble(MK.out||[], "Your timeline");
  events=ev; DATA.deck=TLGen.buildDeck(events); inked.clear(); saveEvents();
  $("#makerVeil").hidden=true; setView("scroll"); rebuild(0); goTo(0,false);
  SFX.kane(); tplAfterApply();
}

/* the on-device model: Meta Llama 3.2 1B through WebLLM, in a worker, on WebGPU */
const LLM={engine:null,model:null,
  async check(){
    try{
      if(!("gpu" in navigator)) return {ok:false,why:"This browser has no WebGPU."};
      const ad=await navigator.gpu.requestAdapter(); if(!ad) return {ok:false,why:"This device has no WebGPU adapter."};
      if(navigator.deviceMemory&&navigator.deviceMemory<4) return {ok:false,why:"This device has less than 4 GB of memory."};
      const f16=ad.features.has("shader-f16");
      return {ok:true,model:f16?"Llama-3.2-1B-Instruct-q4f16_1-MLC":"Llama-3.2-1B-Instruct-q4f32_1-MLC",mb:f16?880:1130};
    }catch(e){ return {ok:false,why:"WebGPU isn't available here."}; }
  },
  async load(d,onp){
    if(this.engine&&this.model===d.model) return this.engine;
    const mod=await import(WEBLLM_URL);
    let worker=null;
    try{ worker=new Worker(URL.createObjectURL(new Blob([`import {WebWorkerMLCEngineHandler} from ${JSON.stringify(WEBLLM_URL)};const h=new WebWorkerMLCEngineHandler();self.onmessage=m=>h.onmessage(m);`],{type:"text/javascript"})),{type:"module"}); }catch(e){ worker=null; }
    const cb={initProgressCallback:r=>onp(r.progress<1?`Getting Llama ready: ${Math.round(r.progress*100)}%. This happens once.`:"Llama is ready",r.progress*.7)};
    this.engine=worker?await mod.CreateWebWorkerMLCEngine(worker,d.model,cb):await mod.CreateMLCEngine(d.model,cb);
    this.model=d.model; return this.engine;
  },
  async write(story,d,onp){
    const eng=await this.load(d,onp);
    let lastErr;
    for(let attempt=0;attempt<2;attempt++){
      onp(attempt?"One more try, more carefully":"Llama is reading your story",.75+attempt*.1);
      const r=await eng.chat.completions.create({messages:[{role:"system",content:TLGen.SYSTEM},{role:"user",content:TLGen.userPrompt(story)}],temperature:attempt?.2:.5,max_tokens:1100,response_format:{type:"json_object"}});
      try{ const raw=extractJSON(r.choices[0].message.content||""); onp("Checking every line",.95); if(TLGen.checkMoments(raw).moments.length>=2) return raw; lastErr=new Error("too few moments"); }catch(e){ lastErr=e; }
    }
    throw new Error("Llama's answer didn't hold together. Try again, or add a little more detail.");
  },
  stop(){ try{ this.engine&&this.engine.interruptGenerate(); }catch(e){} }
};
function extractJSON(text){
  const fenced=text.match(/```(?:json)?\s*([\s\S]*?)```/i), body=fenced?fenced[1]:text, start=body.indexOf("{");
  if(start<0) throw new Error("no JSON");
  let depth=0,inStr=false,escp=false;
  for(let i=start;i<body.length;i++){const c=body[i];
    if(inStr){ if(escp) escp=false; else if(c==="\\") escp=true; else if(c==='"') inStr=false; continue; }
    if(c==='"') inStr=true; else if(c==="{") depth++; else if(c==="}"&&--depth===0) return JSON.parse(body.slice(start,i+1));
  }
  throw new Error("unfinished JSON");
}

/* is Muse switched on for this site? only the live server can say */
let MUSE_OK=false;
if(HOSTED) fetch("api/health").then(r=>r.json()).then(j=>{MUSE_OK=!!j.muse; if($("#devline")&&MK.who==="muse") devCheck();}).catch(()=>{});

/* maker clicks */
document.addEventListener("click",ev=>{
  const w=ev.target.closest("[data-who]"); if(w){ MK.who=w.dataset.who; store.set("tlpub.who",MK.who); $$("[data-who]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.who===MK.who))); devCheck(); return; }
  const q=ev.target.closest("[data-qo]"); if(q){ qToggle(q.dataset.qo); return; }
  const t=ev.target.closest("[data-mk]"); if(!t) return; const a=t.dataset.mk;
  if(a==="home") return mkTiers();
  if(a==="quiz") { MK.ans={}; return mkQuiz(0); }
  if(a==="apps") return mkApps();
  if(a==="words") return mkWords();
  if(a==="qnext") return qNext();
  if(a==="qback") return mkQuiz(Math.max(0,MK.step-1));
  if(a==="qskip"){ MK.ans[QZ[MK.step].id]=[]; return qNext(); }
  if(a==="apprun") return appRun();
  if(a==="appuse") return mkResult(appMoments(MK.out||[]),"apps",APP_SAMPLE.length-(MK.out||[]).length,"Made from the sample items above. Nothing was connected.");
  if(a==="example"){ const ta=$("#mkText"); ta.value=TLGen.SAMPLE_STORY; liveCut(); ta.focus(); return; }
  if(a==="write") return mkWrite();
  if(a==="cancel"){ MK.cancelled=true; LLM.stop(); return mkWords(); }
  if(a==="apply") return mkApply();
  if(a==="fast"){ setFast(!FAST); const r=$(".fastrow"); if(r) r.outerHTML=fastRow(); return; }
});
document.addEventListener("input",ev=>{ if(ev.target.id==="mkText"){ MK.draft=ev.target.value; liveCut(); } });
