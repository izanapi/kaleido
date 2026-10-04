// Admission happens just before synthesis. Reserve capacity for the played note.
export class NoteGate {
 constructor(){this.reset();}
 reset(){this.tokens=9;this.last=0;this.recent=new Map();this.accepted=0;this.dropped=0;}
 admit(time,key,priority=0){this.tokens=Math.min(9,this.tokens+Math.max(0,time-this.last)*24);this.last=Math.max(this.last,time);const reserve=priority>=2?0:3;const previous=this.recent.get(key)??-100;if(this.tokens<1+reserve||time-previous<.055){this.dropped++;return false;}this.tokens--;this.recent.set(key,time);if(this.recent.size>80)for(const [k,t] of this.recent)if(time-t>1)this.recent.delete(k);this.accepted++;return true;}
}
export const HOLD_DELAY=320;
export function holdRate(fingers,now){const held=[...fingers].filter(f=>now-f.down>=HOLD_DELAY&&Math.hypot(f.touch.x,f.touch.y)<=1.04);if(!held.length)return 0;return held.reduce((sum,f)=>sum+-(10+Math.min(1,f.touch.r)*8),0)/held.length;}
