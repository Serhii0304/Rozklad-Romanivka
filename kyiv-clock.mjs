import {kyivParts} from './time-core.mjs';
const TIMEOUT=4500;
// The public time API is tried first; after it fails, the site's own server Date header (whole seconds) is used.
async function worldTime(){const t0=performance.now();const response=await fetch('https://worldtimeapi.org/api/timezone/Europe/Kyiv',{cache:'no-store',signal:AbortSignal.timeout(TIMEOUT)});if(!response.ok)throw new Error('time service');const data=await response.json();const remote=Date.parse(data.utc_datetime||data.datetime);const t1=performance.now();if(!Number.isFinite(remote)||t1-t0>TIMEOUT)throw new Error('invalid time');return {epoch:remote+(t1-t0)/2,mono:t1};}
async function serverDate(){const t0=performance.now();const response=await fetch(location.href.split('#')[0],{method:'HEAD',cache:'no-store',signal:AbortSignal.timeout(TIMEOUT)});const remote=Date.parse(response.headers.get('date')||'');const t1=performance.now();if(!response.ok||!Number.isFinite(remote)||t1-t0>TIMEOUT)throw new Error('invalid server time');return {epoch:remote+500+(t1-t0)/2,mono:t1,coarse:true};}
export class KyivClock{
constructor(){this.baseEpoch=Date.now();this.baseMono=performance.now();this.lastDevice=Date.now();this.lastMono=performance.now();this.synced=false;this.source='Час пристрою';this.busy=false;this.listeners=new Set();}
now(){const mono=performance.now(),device=Date.now();if(Math.abs((device-this.lastDevice)-(mono-this.lastMono))>2000){this.baseEpoch=device;this.baseMono=mono;this.synced=false;this.source='Час пристрою';queueMicrotask(()=>this.sync());}this.lastMono=mono;this.lastDevice=device;return this.baseEpoch+mono-this.baseMono;}
async sync(){if(this.busy)return;this.busy=true;try{let reading;if(!this.serverOnly)reading=await worldTime().catch(()=>{this.serverOnly=true;});reading??=await serverDate();
// The server Date header has whole-second precision: smaller differences are noise, not a correction.
const drift=reading.epoch-(this.baseEpoch+reading.mono-this.baseMono);if(!reading.coarse||Math.abs(drift)>=1000){this.baseEpoch=reading.epoch;this.baseMono=reading.mono;}this.synced=true;this.source='Звірено онлайн';}catch{this.source=this.synced?'Остання онлайн-звірка':'Час пристрою';}finally{this.busy=false;for(const listener of this.listeners)listener();}}
onSync(fn){this.listeners.add(fn);}
parts(){return kyivParts(this.now());}
start(){void this.sync();this.timer=setInterval(()=>this.sync(),600000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void this.sync();});window.addEventListener('online',()=>this.sync());}
}