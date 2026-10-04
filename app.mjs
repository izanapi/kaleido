import {GLASS_PALETTES} from './palettes.mjs?v=layers-10';
import {KaleidoVisual} from './visual.mjs?v=layers-10';
import {NOTES,SCALES} from './music.mjs?v=layers-10';
import {VOICES,KALEIDO_VOICES} from './voices.mjs?v=layers-10';
const $=id=>document.getElementById(id);
const config={root:0,scale:'lydian',voice:'kaleido',octave:0,mirror:'6',mode:'pluck',palette:'frost',spin:0,glow:65,showNotes:true,calm:false,bpm:92};
for(const [id,items] of Object.entries({root:NOTES.map((n,i)=>[i,n]),scale:Object.entries(SCALES).map(([k,v])=>[k,v.name]),voice:KALEIDO_VOICES.map(k=>[k,VOICES[k].name]),palette:Object.entries(GLASS_PALETTES).map(([k,v])=>[k,v.name])})){for(const [v,n] of items)$(id).add(new Option(n,v));$(id).value=config[id];}
import {InstrumentAudio} from './audio.mjs?v=layers-10';
import {touchMap,degreeMidi,reflectionNotes,overtoneLevels,sparkVoice,TAU,triangleHit,crossedTriangle} from './kaleido.mjs?v=layers-10';
import {clamp,noteName,bpmFromTaps,accompanimentPhrase,stepSeconds} from './music.mjs?v=layers-10';
import {NoteGate,holdRate,HOLD_DELAY} from './performance.mjs?v=layers-10';
import {tapTurn} from './motion.mjs?v=layers-10';
const audio=new InstrumentAudio(),visual=new KaleidoVisual($('canvas'),config),fingers=new Map(),keys=new Set(),queue=[],pending=[],gate=new NoteGate();
const loop={state:'empty',events:[],start:0,cursor:0};
let last=performance.now(),timer=null,nextStep=0,step=0,flow=false,muted=false,phrase=[],taps=[],epoch=0,lastFan=-10,lastHold=-10,holdCell=null,holdTurn=0,holdRecorded=0,lastMelody=null;
const defaults='12時から時計回りに音階 · なぞって奏でる';
function hint(message){$('hint').textContent=message;}
function startAudio(){const e=epoch;audio.unlock().then(()=>{if(e!==epoch||document.hidden)return;if(timer===null){nextStep=audio.time+.04;step=0;timer=setInterval(schedule,25);schedule();}}).catch(()=>hint('音を開始できませんでした。もう一度触れてください。'));}
function pulse(event,when=audio.time){queue.push({event,when});queue.sort((a,b)=>a.when-b.when);if(queue.length>256)queue.shift();}
function recordEvent(event,when){
 if(loop.state==='armed'&&!event.motion&&event.mirrorValue===undefined){loop.start=when;loop.events=[{mirrorValue:config.mirror,at:0}];loop.cursor=0;setLoopState('recording');}
 if(loop.state==='recording'){const at=(when-loop.start)/stepSeconds(config.bpm);if(at>=0&&at<32&&loop.events.length<512)loop.events.push({...event,at});}
}
function deliver(event,when,source){
 const voice=event.voice??(source==='flow'?'velvet':config.voice),midi=degreeMidi(event.degree,config)+(event.interval??0),priority=event.priority??(source==='flow'?0:2);
 if(!gate.admit(when,`${voice}/${midi}`,priority))return;
 const played=audio.play(midi,{voice,velocity:event.level,brightness:event.brightness??.6,pan:event.pan,when,priority,durationScale:event.durationScale??1,fifth:event.fifth??0,octave:event.octave??0});
 if(played===false)return;
 if(source==='live'&&event.melody)lastMelody={degree:event.degree,interval:event.interval??0};
 if(source==='live'||source==='arp'||source==='hold')recordEvent(event,when);
 pulse(event,when);
}
function emit(event,when=audio.time,source='live'){
 if(!audio.context||muted)return;
 if(event.motion||event.mirrorValue!==undefined){pulse(event,when);return;}
 if(when<=audio.time+.055)deliver(event,when,source);
 else{pending.push({event,when,source});pending.sort((a,b)=>a.when-b.when);if(pending.length>48)pending.pop();}
}
function flushNotes(){while(pending.length&&pending[0].when<=audio.time+.055){const n=pending.shift();if(n.when>=audio.time-.09)deliver(n.event,Math.max(n.when,audio.time),n.source);}}
function strike(touch,when=audio.time,source='live',velocity=.65){
 if(!audio.context||muted)return;
 const fan=when-lastFan>=.3;const notes=reflectionNotes(touch,config);if(fan)lastFan=when;
 for(const [i,n] of notes.entries()){
  if(n.kind==='spark'&&!fan)continue;
  const overtones=n.kind==='main'?overtoneLevels(touch):{};
  emit({...n,...overtones,melody:n.kind==='main',voice:n.kind==='spark'?sparkVoice(config.voice,n.color):undefined,x:touch.x,y:touch.y,turn:tapTurn(touch.x,touch.y)*(i===0?1:.14*n.level)*(source==='arp'?.36:1),level:n.level*velocity,brightness:.55+touch.weights[2]*.4},when+n.delay,source);
 }
 if(source==='live')hint(defaults);
}
function triangleStrike(touch,hit,turn=0){
 const base=lastMelody??{degree:0,interval:0};
 emit({degree:base.degree,interval:base.interval+hit.interval,voice:hit.kind==='edge'?'wire':['celesta','tine','glass'][hit.index],level:hit.kind==='edge'?.56:.76,pan:touch.x*.5,x:touch.x,y:touch.y,turn,priority:3,durationScale:hit.kind==='edge'?.48:.9,brightness:.9,triangle:hit,fifth:hit.interval===0?.16:0,octave:.18});
 hint(hit.kind==='edge'?'三角形の辺を弾く':`${['ROOT · 最後の音','5TH · 最後の音の5度上','8VE · 最後の音のオクターブ上'][hit.index]}`);
}
function traceSound(f,p,now){
 if(Math.hypot(p.x,p.y)>1.04){f.soundAnchor=p;return;}
 const distance=Math.hypot(p.x-f.soundAnchor.x,p.y-f.soundAnchor.y);
 if(now-f.lastSound<70||distance<.055)return;
 const hit=crossedTriangle(f.soundAnchor,p,config.spin);f.soundAnchor=p;f.lastSound=now;
 if(hit){triangleStrike(p,hit);return;}
 emit({degree:p.degree,interval:p.interval,melody:true,level:.46,pan:p.x*.6,x:p.x,y:p.y,turn:0,priority:2,durationScale:.42,brightness:.8,...overtoneLevels(p)});
}
function setLoopState(state){loop.state=state;
 const names={empty:'REC',armed:'ARMED',recording:'REC',playing:'PAUSE',paused:'PLAY'};
 $('loopLabel').textContent=names[state];$('loopIcon').textContent={empty:'●',armed:'●',recording:'●',playing:'Ⅱ',paused:'▶'}[state];
 $('loop').classList.toggle('recording',['armed','recording'].includes(state));$('loop').classList.toggle('playing',state==='playing');
 $('loop').setAttribute('aria-label',({empty:'2小節ループを録音',armed:'録音待機を解除',recording:'録音を終了',playing:'ループを一時停止',paused:'ループを再開'})[state]);
 $('loopStatus').textContent={empty:'2 BARS',armed:'PLAY TO RECORD',recording:'RECORDING · 2 BARS',playing:'LOOPING · 2 BARS',paused:'PAUSED'}[state];
 $('clearLoop').disabled=state==='empty';$('bpm').disabled=state==='recording';$('tap').disabled=state==='recording';
 if(['empty','armed'].includes(state))$('loopProgress').style.width='0%';
}
function loopAction(){startAudio();
 if(loop.state==='empty')setLoopState('armed');
 else if(loop.state==='armed')setLoopState('empty');
 else if(loop.state==='recording'){if(loop.events.length){loop.events.sort((a,b)=>a.at-b.at);loop.start=audio.time+.04;loop.cursor=0;setLoopState('playing');}else setLoopState('empty');}
 else if(loop.state==='playing'){stopVoices();setLoopState('paused');}
 else{loop.start=audio.time+.04;loop.cursor=0;setLoopState('playing');}
}
function clearLoop(){visual.stop();loop.events=[];loop.cursor=0;stopVoices();setLoopState('empty');}
function stopVoices(){queue.length=0;pending.length=0;gate.reset();for(const v of audio.voices){const now=audio.time;v.env.gain.cancelScheduledValues(now);v.env.gain.setTargetAtTime(.0001,now,.012);for(const source of v.sources)try{source.stop(now+.06);}catch{}}}
function stopAll(){epoch++;fingers.clear();keys.clear();visual.stop();flow=false;$('flow').setAttribute('aria-pressed','false');if(loop.state==='recording'){loop.events.sort((a,b)=>a.at-b.at);setLoopState(loop.events.length?'paused':'empty');}else if(loop.state==='playing')setLoopState('paused');else if(loop.state==='armed')setLoopState('empty');if(timer!==null)clearInterval(timer);timer=null;queue.length=0;pending.length=0;gate.reset();lastFan=-10;lastHold=-10;holdCell=null;holdTurn=0;audio.dispose();$('beatDot').classList.remove('on');}
function schedule(){if(!audio.context||audio.context.state!=='running')return;const now=audio.time,d=stepSeconds(config.bpm);flushNotes();
 if(loop.state==='recording'&&now>=loop.start+32*d){loop.start+=32*d;loop.cursor=0;loop.events.sort((a,b)=>a.at-b.at);setLoopState(loop.events.length?'playing':'empty');}
 if(loop.state==='playing'&&loop.events.length){
  // The cursor advances once per scheduled event, preserving sub-beat gesture timing.
  let guard=0;while(guard++<1024){const index=loop.cursor%loop.events.length,cycle=Math.floor(loop.cursor/loop.events.length),e=loop.events[index];const when=loop.start+(cycle*32+e.at)*d;if(when>now+.075)break;if(when>=now-.04)emit(e,Math.max(now,when),'loop');loop.cursor++;}
 }
 if(nextStep<now-.15){step+=Math.ceil((now-nextStep)/d);nextStep=now+.02;}
 while(nextStep<now+.075){const when=nextStep;
  if(step%4===0&&$('metronome').checked)audio.click(when,step%16===0);
  const held=[...fingers.values()].filter(f=>!f.dragging&&performance.now()-f.down>=HOLD_DELAY&&Math.hypot(f.touch.x,f.touch.y)<=1.04);
  if(held.length&&step%2===0){const f=held[Math.floor(step/2)%held.length],mapped=touchMap(f.touch.x,f.touch.y,config.spin,SCALES[config.scale].intervals.length),cell=Math.floor(config.spin/18);
   if(config.mode==='arp'||(cell!==holdCell&&now-lastHold>.45)){
    const phase=Math.floor(step/2)%4,interval=[0,7,12,7][phase];
    emit({degree:mapped.degree,interval:(mapped.interval??0)+interval,level:.3,pan:mapped.x*.6,x:mapped.x,y:mapped.y,turn:0,priority:1,voice:sparkVoice(config.voice,phase%3),durationScale:.45},when,config.mode==='arp'?'arp':'hold');lastHold=now;holdCell=cell;
   }
  }
  if(flow){if(step%32===0||!phrase.length)phrase=accompanimentPhrase(config.scale);for(const n of phrase)if(n.step===step%32)emit({degree:n.id-(n.bass?SCALES[config.scale].intervals.length:0),level:n.velocity*.65,pan:0,x:Math.cos(n.id)*.38,y:Math.sin(n.id)*.38,turn:-2},when,'flow');}
  step++;nextStep+=d;
 }
}
function setMirror(value){
 if(value!=='fractal'){value=String(clamp(Number(value),3,12));if(!Number.isFinite(Number(value)))throw new Error('Unknown mirror');}
 config.mirror=value;
 $('mirrorReadout').textContent=value==='fractal'?'FRACTAL':`MIRROR ${Number(value).toFixed(1).replace('.0','')}`;
}
function setMode(value){config.mode=value;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===value));}
function point(e){const p=visual.point(e);return touchMap(p.x,p.y,config.spin,SCALES[config.scale].intervals.length);}
$('canvas').addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;const p=point(e);if(Math.hypot(p.x,p.y)>1.04)return;e.preventDefault();$('canvas').setPointerCapture(e.pointerId);startAudio();fingers.set(e.pointerId,{touch:p,last:performance.now(),anchor:p,soundAnchor:p,lastSound:performance.now(),originX:e.clientX,originY:e.clientY,mirrorStart:config.mirror==='fractal'?12:Number(config.mirror),dragging:false,mirrorCell:Math.round(Number(config.mirror)||12),down:performance.now()});holdCell=Math.floor(config.spin/18);const hit=triangleHit(p.x,p.y,config.spin);if(hit)triangleStrike(p,hit,tapTurn(p.x,p.y));else strike(p);});
$('canvas').addEventListener('pointermove',e=>{
 const f=fingers.get(e.pointerId);if(!f)return;e.preventDefault();const p=point(e);f.touch=p;
 const dx=e.clientX-f.originX,dy=e.clientY-f.originY;
 if(!f.dragging&&Math.hypot(dx,dy)>9){f.dragging=true;}
 if(!f.dragging)return;
 const value=clamp(f.mirrorStart+dx/Math.max(160,visual.g.r*1.6)*9,3,12);
 if(Math.abs(dx)>9)setMirror(value);const now=performance.now();
 if(now-f.last>100){if(!muted)recordEvent({mirrorValue:config.mirror},audio.time);f.last=now;}
 traceSound(f,p,now);
});
function release(e){const f=fingers.get(e.pointerId);if(f?.dragging&&!muted)recordEvent({mirrorValue:config.mirror},audio.time);fingers.delete(e.pointerId);}
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('canvas').addEventListener(event,release);
const keyNotes='asdfghjk';
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('settings').open)return;stopAll();hint('STOPPED · 触れると再開');return;}if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)||$('settings').open)return;if(e.repeat)return;const key=e.key.toLowerCase();if(keyNotes.includes(key)&&key.length===1){e.preventDefault();const i=keyNotes.indexOf(key),n=SCALES[config.scale].intervals.length,a=(i+.5)/(n*3)*TAU,p=touchMap(Math.sin(a)*.7,Math.cos(a)*.7,config.spin,n);startAudio();keys.add(key);fingers.set(key,{touch:p,last:performance.now(),down:performance.now()});holdCell=Math.floor(config.spin/18);strike(p);}else if(key===' '){e.preventDefault();loopAction();}});
document.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());fingers.delete(e.key.toLowerCase());});
window.addEventListener('blur',()=>{fingers.clear();keys.clear();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAll();});audio.onInterrupted=stopAll;
window.addEventListener('pagehide',stopAll);
for(const id of ['root','scale','voice','octave','palette'])$(id).addEventListener('change',()=>{config[id]=['root','octave'].includes(id)?Number($(id).value):$(id).value;if(['root','scale','octave'].includes(id))lastMelody=null;phrase=[];});
for(const id of ['echo','hall','volume','decay','glow'])$(id).addEventListener('input',()=>{const value=Number($(id).value);$(id+'Value').value=value;if(id==='glow')config[id]=value;else audio.configure({[id]:value});});
for(const id of ['showNotes','calm'])$(id).addEventListener('change',()=>{config[id]=$(id).checked;});
$('metronome').addEventListener('change',()=>{if($('metronome').checked)startAudio();});
$('settingsOpen').addEventListener('click',()=>{fingers.clear();keys.clear();$('settings').showModal();});$('settingsClose').addEventListener('click',()=>$('settings').close());
$('mute').addEventListener('click',()=>{muted=!muted;audio.configure({muted});$('mute').setAttribute('aria-pressed',String(muted));$('mute').textContent=muted?'MUTED':'SOUND';if(!muted)startAudio();});
$('flow').addEventListener('click',()=>{flow=!flow;$('flow').setAttribute('aria-pressed',String(flow));if(flow){phrase=[];startAudio();}});
$('loop').addEventListener('click',loopAction);$('clearLoop').addEventListener('click',clearLoop);
function setBpm(value){const bpm=clamp(Math.round(Number(value)||92),40,200);if(loop.state==='recording')return;const now=audio.time,old=stepSeconds(config.bpm);if(loop.state==='playing'){const phase=(now-loop.start)/old;loop.start=now-phase*stepSeconds(bpm);}config.bpm=bpm;$('bpm').value=bpm;audio.configure({bpm});nextStep=now+.04;}
$('bpm').addEventListener('change',()=>setBpm($('bpm').value));
$('tap').addEventListener('click',()=>{const now=performance.now();taps=taps.filter(t=>now-t<3500);taps.push(now);if(taps.length>7)taps.shift();const bpm=bpmFromTaps(taps);if(bpm)setBpm(bpm);startAudio();});
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('randomize').addEventListener('click',()=>{const pick=a=>a[Math.floor(Math.random()*a.length)];config.root=pick([...Array(12).keys()]);config.scale=pick(Object.keys(SCALES));config.voice=pick(KALEIDO_VOICES);config.palette=pick(Object.keys(GLASS_PALETTES));for(const id of ['root','scale','voice','palette'])$(id).value=config[id];lastMelody=null;phrase=[];});
function frame(now){const dt=Math.min((now-last)/1000,.05);last=now;
 const rate=holdRate(fingers.values(),now),turn=rate*dt;
 if(rate&&audio.context?.state==='running'){visual.drift(turn);holdTurn+=turn;if(now-holdRecorded>100){if(!muted)recordEvent({motion:true,turn:holdTurn},audio.time);holdTurn=0;holdRecorded=now;}}else holdTurn=0;
 if(audio.context){while(queue.length&&queue[0].when<=audio.time+.01){const {event}=queue.shift();if(event.mirrorValue!==undefined)setMirror(event.mirrorValue);else if(event.motion)visual.drift(event.turn);else{visual.sound(event);$('noteReadout').textContent=noteName(degreeMidi(event.degree,config)+(event.interval??0)+(VOICES[event.voice??config.voice]?.transpose??0));}}
  if(loop.state==='playing'||loop.state==='recording'){const position=((audio.time-loop.start)/(32*stepSeconds(config.bpm))%1+1)%1;$('loopProgress').style.width=position*100+'%';}
  $('beatDot').classList.toggle('on',timer!==null&&audio.context.state==='running'&&audio.time%(60/config.bpm)<.08);
 }visual.draw(dt,muted?null:audio.readSpectrum());config.spin=visual.angle;$('spinReadout').textContent=`TURN ${Math.round(((-config.spin)%360+360)%360)}°`;requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Curated voice selection for supported document-scoped tools.
if(document.modelContext?.registerTool){const lifecycle=new AbortController();try{Promise.resolve(document.modelContext.registerTool({name:'configure_kaleido',title:'Configure Kaleido',description:'Select a metallic or electronic voice and mirror pattern. Does not start sound or alter the recording.',inputSchema:{type:'object',properties:{voice:{type:'string',enum:KALEIDO_VOICES},mirror:{type:'string',enum:['3','6','12','fractal']}},required:['voice','mirror'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['voice','mirror'].includes(k))||!KALEIDO_VOICES.includes(input.voice)||!['3','6','12','fractal'].includes(input.mirror))throw new Error('Choose a supported voice and mirror');config.voice=input.voice;$('voice').value=input.voice;setMirror(input.mirror);return{voice:config.voice,mirror:config.mirror};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
