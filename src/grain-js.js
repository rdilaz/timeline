/* Same paper grain as rust/ink grain(), in plain JavaScript: the fallback, and the yardstick for the speed test. */
function grainJS(w,h,seed){
  const out=new Uint8ClampedArray(w*h*4);
  const h2=(x,y,s)=>{let v=(Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(s,2246822519|0))>>>0;v=Math.imul(v^(v>>>13),1274126177)>>>0;v=(v^(v>>>16))>>>0;return (v&0xffff)/65535};
  const vn2=(x,y,s)=>{const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
    const a=h2(xi,yi,s),b=h2(xi+1,yi,s),c=h2(xi,yi+1,s),d=h2(xi+1,yi+1,s),top=a+(b-a)*ux;return top+((c+(d-c)*ux)-top)*uy};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let n=0,amp=.5,fq=1/48;for(let o=0;o<4;o++){n+=amp*vn2(x*fq*.25,y*fq*2.2,seed+o);amp*=.5;fq*=2}
    const sp=h2(x,y,(seed^0x9e37)>>>0),i=(y*w+x)*4;
    if(n>.62){const a=Math.min(1,(n-.62)*2.4);out[i]=255;out[i+1]=250;out[i+2]=236;out[i+3]=a*120}
    else if(sp>.996||n<.24){const a=sp>.996?.28:(.24-n)*.5;out[i]=96;out[i+1]=68;out[i+2]=36;out[i+3]=a*255}
  }
  return out;
}
