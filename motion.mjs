const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Every impulse comes from a performed/scheduled note, never from background physics.
export function tapTurn(x,y){const radius=clamp(Math.hypot(x,y),0,1);return -(7+radius*18);}
export class MirrorMotion {
 constructor(){this.angle=0;this.target=0;this.x=0;this.y=0;this.targetX=0;this.targetY=0;this.energy=0;this.focus=0;}
 excite({x,y,turn=0,level=.5}){if(![x,y,turn,level].every(Number.isFinite))return;this.target=this.angle+clamp(this.target-this.angle+turn,-70,70);this.targetX=clamp(x,-1,1);this.targetY=clamp(y,-1,1);this.focus=clamp(Math.hypot(x,y),0,1);this.energy=Math.min(1.4,this.energy+level*.8);}
 step(dt,reduced=false){dt=clamp(dt,0,.05);const ease=1-Math.exp(-dt*5.5);this.angle+=(this.target-this.angle)*ease;this.x+=(this.targetX-this.x)*ease;this.y+=(this.targetY-this.y)*ease;this.energy*=Math.exp(-dt*1.8);if(Math.abs(this.target-this.angle)<.002)this.angle=this.target;return reduced?0:this.angle;}
 drift(degrees){if(Number.isFinite(degrees))this.target+=degrees;}
 stop(){this.target=this.angle;this.energy=0;}
}
