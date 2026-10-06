import {playbackPlan,silenceWindow} from './time-core.mjs';
/** Uses one common clock with the schedule. Audio hardware enforces the end,
 * independently of UI timer throttling. No played-date flag: reloads can rejoin. */
export class SilencePlayer{
constructor(clock,onState=()=>{}){this.clock=clock;this.onState=onState;this.context=null;this.buffer=null;this.source=null;this.releaseLock=null;this.plan=null;this.busy=false;this.claiming=false;this.state='waiting';this.loadError=false;this.stopped=false;this.tabId=globalThis.crypto?.randomUUID?.()||String(Math.random());this.leaseKey='romanivka.audio.lease';this.fallback=false;this.leasePending=false;
this.prepare();this.timer=setInterval(()=>this.reconcile(),200);
for(const event of ['pointerdown','keydown'])document.addEventListener(event,()=>this.enable(),{capture:true,passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){this.cancel();this.reconcile();}});
window.addEventListener('pageshow',()=>{this.cancel();this.reconcile();});
window.addEventListener('pagehide',()=>this.cancel());
clock.onSync(()=>{this.cancel();this.reconcile();});
}
publish(){const active=silenceWindow(this.clock.now()).active;this.onState({state:this.state,ready:this.context?.state==='running'&&!!this.buffer,active,error:this.loadError,otherTab:this.claiming&&!this.source});}
async prepare(){try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC){this.state='unsupported';return this.publish();}this.context=new AC();this.context.addEventListener('statechange',()=>{if(this.context.state!=='running')this.cancel();this.reconcile();});
const response=await fetch('./Хвилина мовчання.mp3');if(!response.ok)throw new Error('audio');this.buffer=await this.context.decodeAudioData(await response.arrayBuffer());if(this.buffer.duration<60)throw new Error('short audio');this.reconcile();
}catch{this.loadError=true;if(this.context){this.buffer=this.metronomeBuffer();this.reconcile();}else{this.state='unsupported';this.publish();}}}
metronomeBuffer(){const rate=22050,buffer=this.context.createBuffer(1,rate*60,rate),data=buffer.getChannelData(0);for(let beat=0;beat<60;beat++)for(let i=0;i<rate*.055;i++){const t=i/rate;data[beat*rate+i]=.4*Math.sin(2*Math.PI*1100*t)*Math.exp(-95*t);}return buffer;}
enable(){if(!this.context||this.context.state==='running')return;this.context.resume().then(()=>this.reconcile()).catch(()=>{this.state='blocked';this.publish();});}
cancel(){if(this.source){try{this.source.stop();}catch{}this.source.disconnect();this.source=null;}this.plan=null;if(this.fallback){try{const lease=JSON.parse(localStorage.getItem(this.leaseKey)||'null');if(lease?.owner===this.tabId)localStorage.removeItem(this.leaseKey);}catch{}this.fallback=false;}if(this.releaseLock){this.releaseLock();this.releaseLock=null;}}
start(){const context=this.context;if(!this.buffer||context.state!=='running')return;const plan=playbackPlan(this.clock.now(),context.currentTime);if(!plan)return;
const source=context.createBufferSource();source.buffer=this.buffer;source.connect(context.destination);this.source=source;this.plan=plan;source.start(plan.when,plan.offset,plan.duration);source.stop(plan.stopAt);source.onended=()=>{if(this.source===source){this.source=null;this.plan=null;source.disconnect();if(this.fallback)this.cancel();if(this.releaseLock){this.releaseLock();this.releaseLock=null;}this.publish();}};
this.state=plan.offset>0?'playing':'ready';this.publish();}
claim(){if(this.claiming)return;this.claiming=true;
if(navigator.locks?.request){navigator.locks.request('romanivka-minute-of-silence',{ifAvailable:true},async lock=>{if(!lock)return;await new Promise(resolve=>{this.releaseLock=resolve;this.start();if(!this.source){this.releaseLock=null;resolve();}});}).catch(()=>{this.state='blocked';}).finally(()=>{this.claiming=false;this.publish();});}
else {this.claiming=false;this.claimFallback();}}
claimFallback(){if(this.leasePending||this.fallback)return;try{const current=JSON.parse(localStorage.getItem(this.leaseKey)||'null');if(current&&current.owner!==this.tabId&&current.until>Date.now())return;localStorage.setItem(this.leaseKey,JSON.stringify({owner:this.tabId,until:Date.now()+1800}));this.leasePending=true;setTimeout(()=>{this.leasePending=false;try{const lease=JSON.parse(localStorage.getItem(this.leaseKey)||'null');if(lease?.owner!==this.tabId)return;this.fallback=true;this.start();if(!this.source)this.cancel();}catch{this.start();}},80);}catch{this.start();}}
reconcile(){if(!this.context)return;if(this.fallback&&this.source){try{const lease=JSON.parse(localStorage.getItem(this.leaseKey)||'null');if(lease?.owner!==this.tabId)this.cancel();else localStorage.setItem(this.leaseKey,JSON.stringify({owner:this.tabId,until:Date.now()+1800}));}catch{}}const now=this.clock.now(),w=silenceWindow(now),plan=playbackPlan(now,this.context.currentTime);
if(this.source&&(!plan||this.context.state!=='running'||Math.abs(this.plan.stopAt-plan.stopAt)>.2)){this.cancel();}
if(this.context.state!=='running'){this.state=w.active?'blocked':'waiting';if(w.active&&!this.busy){this.busy=true;this.context.resume().then(()=>this.reconcile()).catch(()=>{}).finally(()=>{this.busy=false;});}}
else if(this.source){this.state=w.active?'playing':'ready';}
else if(this.buffer&&plan){this.claim();}
else{this.state=this.buffer?'ready':'loading';}
this.publish();}
}