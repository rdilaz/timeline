/* ============ fast mode + the Rust ink module ============
   Fast mode draws at lower resolution, skips the costly effects (ink bleed, drifting mist,
   flying splatter, parallax) and bakes the mountains once into a small bitmap with Rust
   compiled to WebAssembly. The paper grain is per-pixel work, so Rust draws it too. */
const autoFast=()=>{try{return (navigator.hardwareConcurrency||8)<=4||(navigator.deviceMemory||8)<=2||!!(navigator.connection&&navigator.connection.saveData)}catch(e){return false}};
let FAST=store.get("tlpub.fast",null); if(FAST===null) FAST=autoFast();
document.documentElement.classList.toggle("fast",FAST);
{const sw=document.getElementById("fastSwitch"); if(sw) sw.setAttribute("aria-checked",String(FAST));}
const INK={ex:null,mem:null,ok:false};
try{
  const bin=Uint8Array.from(atob(INK_WASM_B64),c=>c.charCodeAt(0));
  const inst=new WebAssembly.Instance(new WebAssembly.Module(bin),{});
  INK.ex=inst.exports; INK.ok=typeof INK.ex.grain==="function";
}catch(e){ INK.ok=false; }
function inkPixels(fn,w,h,arg){
  const p=INK.ex[fn](w,h,arg);
  return new ImageData(new Uint8ClampedArray(INK.ex.memory.buffer,p,w*h*4).slice(),w,h);
}
function grainImage(w,h,seed){ return INK.ok?inkPixels("grain",w,h,seed):new ImageData(grainJS(w,h,seed),w,h); }
/* paper: Rust grain underneath, the hand-drawn fibres on top */
function paperGrain(){
  try{
    const c=document.createElement("canvas"), n=FAST?240:420; c.width=c.height=n; const x=c.getContext("2d");
    x.putImageData(grainImage(n,n,7),0,0);
    for(let i=0;i<(FAST?60:190);i++){
      const px=Math.random()*n,py=Math.random()*n,len=14+Math.random()*80,a=Math.random()*Math.PI*2,bend=(Math.random()-.5)*30,light=Math.random()<.6;
      x.strokeStyle=light?`rgba(255,250,236,${(.25+Math.random()*.35).toFixed(2)})`:`rgba(110,80,44,${(.06+Math.random()*.1).toFixed(2)})`;
      x.lineWidth=.4+Math.random()*.9; x.beginPath(); x.moveTo(px,py);
      x.quadraticCurveTo(px+Math.cos(a)*len/2-Math.sin(a)*bend,py+Math.sin(a)*len/2+Math.cos(a)*bend,px+Math.cos(a)*len,py+Math.sin(a)*len); x.stroke();
    }
    document.documentElement.style.setProperty("--fibers",`url(${c.toDataURL()})`);
  }catch(e){}
}
paperGrain();
/* fast mountains: one bitmap at half resolution, scaled up softly */
function washInto(far,fw,h){
  const s=.5, w=Math.max(1,Math.round(fw*s)), hh=Math.max(1,Math.round(h*s));
  far.width=w; far.height=hh; far.style.width=fw+"px"; far.style.height=h+"px";
  const x=far.getContext("2d");
  if(INK.ok) x.putImageData(inkPixels("wash",w,hh,s),0,0);
  return x;
}
function setFast(on){
  FAST=on; store.set("tlpub.fast",on); document.documentElement.classList.toggle("fast",on);
  paperGrain(); rebuild(curIndex());
  const r=$("#fastSwitch"); if(r){ r.setAttribute("aria-checked",String(on)); }
  toast(on?"Fast mode on: lower resolution, fewer effects.":"Fast mode off: full detail.");
}
/* race Rust against JavaScript on this device, same picture, same size */
function raceInk(){
  const out=$("#raceOut"); if(!out) return;
  const n=420, runs=4, time=f=>{f();const t=performance.now();for(let i=0;i<runs;i++)f();return (performance.now()-t)/runs};
  const js=time(()=>grainJS(n,n,7)), rs=INK.ok?time(()=>INK.ex.grain(n,n,7)):null;
  const max=Math.max(js,rs||0)||1;
  out.innerHTML=`<li><span>Rust, WebAssembly</span><i style="--w:${rs==null?0:(rs/max*100).toFixed(0)}%"></i><b>${rs==null?"not available here":rs.toFixed(1)+" ms"}</b></li><li><span>JavaScript</span><i style="--w:${(js/max*100).toFixed(0)}%"></i><b>${js.toFixed(1)} ms</b></li>`;
  $("#raceNote").textContent=rs==null?"WebAssembly is blocked in this view, so the page uses JavaScript.":rs<js?`Rust drew the paper grain ${(js/rs).toFixed(1)} times faster on this device.`:"On this device JavaScript kept up, so the gain here is small.";
}
