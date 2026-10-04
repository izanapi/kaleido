import {SCALES,clamp} from './music.mjs?v=layers-10';
export const TAU=Math.PI*2;
export function degreeMidi(degree,config){const notes=SCALES[config.scale].intervals,n=notes.length;return 60+Number(config.root)+config.octave*12+Math.floor(degree/n)*12+notes[((degree%n)+n)%n];}
export const LAYER_RADII=[.88,.62,.32];
export function layerInterval(r){return r>=.88?0:r>=.62?12:r>=.32?19:24;}
export function touchMap(x,y,spin=0,scaleSize=7){const r=clamp(Math.hypot(x,y),0,1),a=Math.atan2(y,x)-spin*Math.PI/180;const px=Math.cos(a)*r,py=Math.sin(a)*r;const raw=[(1-py)/3-px/Math.sqrt(3),(1+2*py)/3,(1-py)/3+px/Math.sqrt(3)].map(v=>Math.max(0,v));const sum=raw.reduce((a,b)=>a+b,0);return{interval:layerInterval(r),degree:r<.06?-scaleSize:Math.min(scaleSize*3-1,Math.floor((((Math.PI/2-Math.atan2(y,x))%TAU+TAU)%TAU)/TAU*scaleSize*3))-scaleSize,weights:raw.map(v=>v/sum),x,y,r};}
export function reflectionNotes(touch,config){
 const base=touch.degree,w=touch.weights;
 const notes=[{degree:base,interval:touch.interval??0,delay:0,level:1,pan:touch.x*.65,priority:3,kind:'main'}];
 if(config.mode==='chord')for(const [i,degree] of [base+2,base+4].entries())notes.push({degree,interval:touch.interval??0,delay:.009*(i+1),level:.36,pan:(i?1:-1)*.4,priority:2,kind:'chord'});
 // The three vertices color the note with root, a true perfect fifth, and an octave.
 const first=w[1]>w[2]?7:12;
 const count=config.mirror==='fractal'?3:Math.min(2,Math.ceil((Number(config.mirror)-3)/4.5));
 for(let i=0;i<count;i++)notes.push({degree:base+(i===2?2:0),interval:(touch.interval??0)+(i===0?first:i===1?(first===7?12:7):12),delay:.11+i*.14,level:(i? .22:.32)*.76**i,pan:(i%2?-1:1)*(.3+touch.r*.4),priority:0,kind:'spark',color:i,durationScale:.32});
 const norm=Math.sqrt(notes.reduce((sum,n)=>sum+n.level*n.level,0));return notes.map(n=>({...n,level:n.level/norm}));
}
export function overtoneLevels(touch){return{fifth:.13+touch.weights[1]*.25,octave:.1+touch.weights[2]*.22};}
export function sparkVoice(voice,index){const families={kaleido:['glass','tine','neon'],alloy:['wire','chrome','bell'],chrome:['ion','glass','chip'],ion:['chrome','neon','glass'],glass:['bell','tine','neon']};return (families[voice]||[voice,'glass','neon'])[index%3];}
export function glassSeeds(seed=1){let s=seed>>>0;const rand=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};return Array.from({length:74},()=>({r:.08+rand()*.94,a:rand()*Math.PI/3,size:.025+rand()*.12,hue:rand(),skew:rand(),phase:rand()*TAU}));}

// Coordinates shared with the visible triangle, in the instrument's y-up space.
export const TRIANGLE=[[-.779,-.45],[0,.9],[.779,-.45]];
export function triangleHit(x,y,spin=0){
 const a=spin*Math.PI/180,px=x*Math.cos(a)+y*Math.sin(a),py=-x*Math.sin(a)+y*Math.cos(a);
 for(let i=0;i<3;i++)if(Math.hypot(px-TRIANGLE[i][0],py-TRIANGLE[i][1])<.105)return{kind:'vertex',index:i,interval:[0,7,12][i]};
 let best=null;
 for(let i=0;i<3;i++){
  const a=TRIANGLE[i],b=TRIANGLE[(i+1)%3],dx=b[0]-a[0],dy=b[1]-a[1];
  const t=clamp(((px-a[0])*dx+(py-a[1])*dy)/(dx*dx+dy*dy),0,1),d=Math.hypot(px-a[0]-t*dx,py-a[1]-t*dy);
  if(d<.045&&(!best||d<best.distance))best={kind:'edge',index:i,interval:[0,7,12][t<.5?i:(i+1)%3],distance:d};
 }
 return best;
}
export function crossedTriangle(from,to,spin){
 const count=Math.min(32,Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/.025)));
 let hit=null;for(let i=0;i<=count;i++){const t=i/count,h=triangleHit(from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t,spin);if(h&&(h.kind==='vertex'||!hit))hit=h;}return hit;
}
