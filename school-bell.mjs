import {kyivParts,hhmmSeconds} from './time-core.mjs';

// A bell is one recording at lesson start and one at lesson end.
// The elapsed part is skipped on a late visit; missed bells are never replayed.
export function schoolBellPlan(ms,config,duration,audioTime=0){
  const p=kyivParts(ms);
  if(p.weekday<1||p.weekday>5||!Number.isFinite(duration)||duration<=0)return null;
  const silenceStart=9*3600,silenceEnd=silenceStart+60;
  const events=config.bellSchedule.flatMap(b=>[
    {lesson:b.lesson,kind:'start',seconds:hhmmSeconds(b.start)},
    {lesson:b.lesson,kind:'finish',seconds:hhmmSeconds(b.end)}
  ]).sort((a,b)=>a.seconds-b.seconds);
  for(const event of events){
    if(event.seconds>=silenceStart&&event.seconds<silenceEnd)continue;
    const clipDuration=event.seconds<silenceStart?Math.min(duration,silenceStart-event.seconds):duration;
    const end=event.seconds+clipDuration;
    if(p.seconds>=end||event.seconds-p.seconds>120)continue;
    const delay=Math.max(0,event.seconds-p.seconds),offset=Math.max(0,p.seconds-event.seconds);
    return {...event,id:p.dateKey+':'+event.kind+':'+event.lesson,dateKey:p.dateKey,
      active:delay===0,offset,duration:clipDuration-offset,
      when:audioTime+delay,stopAt:audioTime+delay+clipDuration-offset,
      endEpoch:ms+(delay+clipDuration-offset)*1000};
  }
  return null;
}

export class SchoolBellPlayer{
  constructor(clock,config,audioEngine,onState=()=>{}){
    this.clock=clock;this.config=config;this.context=audioEngine.context;this.onState=onState;
    this.buffer=null;this.source=null;this.plan=null;this.releaseLock=null;this.claiming=false;
    this.otherTab=false;this.error=false;this.closed=false;this.generation=0;this.completed=new Set();
    this.tabId=globalThis.crypto?.randomUUID?.()||String(Math.random());
    this.leaseKey='romanivka.school-bell.lease';this.fallback=false;
    this.prepare();
    this.timer=setInterval(()=>this.reconcile(),200);
    this.context?.addEventListener('statechange',()=>{this.cancel();this.reconcile();});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){this.cancel();this.reconcile();}});
    window.addEventListener('pagehide',()=>{this.closed=true;this.cancel();});
    window.addEventListener('pageshow',()=>{this.closed=false;this.cancel();this.reconcile();});
    clock.onSync(()=>{this.cancel();this.reconcile();});
  }
  async prepare(){
    if(!this.context)return this.publish();
    try{
      const response=await fetch('./Звук шкільного дзвінка.mp3');
      if(!response.ok)throw new Error('School bell audio unavailable');
      this.buffer=await this.context.decodeAudioData(await response.arrayBuffer());
      if(!Number.isFinite(this.buffer.duration)||this.buffer.duration<=0)throw new Error('Invalid school bell audio');
    }catch{this.error=true;}
    this.reconcile();
  }
  currentPlan(){return this.buffer?schoolBellPlan(this.clock.now(),this.config,this.buffer.duration,this.context.currentTime):null;}
  publish(){
    const plan=this.currentPlan(),ready=this.context?.state==='running'&&!!this.buffer;
    this.onState({ready,active:!!plan?.active,error:this.error,otherTab:this.otherTab&&!!plan?.active,
      state:!this.context?'unsupported':this.error?'error':!this.buffer?'loading':!ready?'blocked':this.source&&plan?.active?'playing':'ready'});
  }
  cancel(){
    this.generation++;
    if(this.source){const source=this.source;this.source=null;source.onended=null;try{source.stop();}catch{}source.disconnect();}
    this.plan=null;
    if(this.releaseLock){const release=this.releaseLock;this.releaseLock=null;release();}
    if(this.fallback){
      try{const lease=JSON.parse(localStorage.getItem(this.leaseKey)||'null');if(lease?.owner===this.tabId)localStorage.removeItem(this.leaseKey);}catch{}
      this.fallback=false;
    }
  }
  start(eventId){
    const plan=this.currentPlan();
    if(this.closed||this.context.state!=='running'||!plan||plan.id!==eventId||this.completed.has(plan.id))return;
    const source=this.context.createBufferSource();source.buffer=this.buffer;source.connect(this.context.destination);
    this.source=source;this.plan=plan;this.otherTab=false;
    source.start(plan.when,plan.offset,plan.duration);source.stop(plan.stopAt);
    source.onended=()=>{
      if(this.source!==source)return;
      this.completed.add(plan.id);this.cancel();this.publish();
    };
    this.publish();
  }
  claim(plan){
    if(this.claiming)return;
    this.claiming=true;
    const generation=this.generation;
    if(this.useLocks!==false&&navigator.locks?.request){
      navigator.locks.request('romanivka-school-bell:'+plan.id,{ifAvailable:true},async lock=>{
        if(generation!==this.generation||this.closed)return;
        if(!lock){this.otherTab=true;return;}
        await new Promise(resolve=>{
          this.releaseLock=resolve;this.start(plan.id);
          if(!this.source){this.releaseLock=null;resolve();}
        });
      }).catch(()=>{this.useLocks=false;}).finally(()=>{this.claiming=false;this.publish();});
    }else this.claimFallback(plan,generation);
  }
  claimFallback(plan,generation){
    // Reserve through the scheduled stop even when background timers are slowed.
    // Web Locks is preferred; this lease is for older browsers.
    try{
      const existing=JSON.parse(localStorage.getItem(this.leaseKey)||'null');
      if(existing&&existing.owner!==this.tabId&&existing.until>Date.now()){
        this.otherTab=true;this.claiming=false;return;
      }
      localStorage.setItem(this.leaseKey,JSON.stringify({owner:this.tabId,until:Date.now()+Math.max(0,plan.stopAt-this.context.currentTime)*1000+1000}));
      this.fallback=true;
      setTimeout(()=>{
        this.claiming=false;
        if(generation!==this.generation||this.closed)return;
        try{
          const lease=JSON.parse(localStorage.getItem(this.leaseKey)||'null');
          if(lease?.owner!==this.tabId){this.fallback=false;this.otherTab=true;return;}
        }catch{}
        this.start(plan.id);if(!this.source)this.cancel();
      },80);
    }catch{
      this.claiming=false;this.start(plan.id);
    }
  }
  reconcile(){
    if(this.closed)return;
    if(this.fallback&&this.source){
      try{
        const lease=JSON.parse(localStorage.getItem(this.leaseKey)||'null');
        if(lease?.owner!==this.tabId)this.cancel();
      }catch{}
    }
    const plan=this.currentPlan();
    if(plan&&this.lastDate!==plan.dateKey){this.lastDate=plan.dateKey;this.completed.clear();}
    if(this.source&&(!plan||this.context.state!=='running'||this.plan.id!==plan.id||Math.abs(this.plan.stopAt-plan.stopAt)>.2))this.cancel();
    if(!this.source&&plan&&this.context.state==='running'&&!this.completed.has(plan.id))this.claim(plan);
    this.publish();
  }
}
