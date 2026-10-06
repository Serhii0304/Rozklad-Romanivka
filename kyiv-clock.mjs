import {kyivParts} from './time-core.mjs';
export class KyivClock{
constructor(){this.baseEpoch=Date.now();this.baseMono=performance.now();this.lastDevice=Date.now();this.lastMono=performance.now();this.synced=false;this.source='Час пристрою';this.busy=false;this.listeners=new Set();}
now(){const mono=performance.now(),device=Date.now();if(Math.abs((device-this.lastDevice)-(mono-this.lastMono))>2000){this.baseEpoch=device;this.baseMono=mono;this.synced=false;this.source='Час пристрою';queueMicrotask(()=>this.sync());}this.lastMono=mono;this.lastDevice=device;return this.baseEpoch+mono-this.baseMono;}
async sync(){if(this.busy)return;this.busy=true;try{const t0=performance.now();const response=await fetch('https://worldtimeapi.org/api/timezone/Europe/Kyiv',{cache:'no-store',signal:AbortSignal.timeout(4500)});if(!response.ok)throw new Error('time service');const data=await response.json();const remote=Date.parse(data.utc_datetime||data.datetime);const t1=performance.now();if(!Number.isFinite(remote)||t1-t0>4500)throw new Error('invalid time');this.baseEpoch=remote+(t1-t0)/2;this.baseMono=t1;this.synced=true;this.source='Звірено онлайн';}catch{this.source=this.synced?'Остання онлайн-звірка':'Час пристрою';}finally{this.busy=false;for(const listener of this.listeners)listener();}}
onSync(fn){this.listeners.add(fn);}
parts(){return kyivParts(this.now());}
start(){void this.sync();this.timer=setInterval(()=>this.sync(),600000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void this.sync();});window.addEventListener('online',()=>this.sync());}
}