// A slim day switcher for the long whole-week page. It appears once the main
// controls leave the screen, tucks away while reading downward and returns on
// the way back up. Only transform animates, so phones keep scrolling smoothly.
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SHORT=['Пн','Вт','Ср','Чт','Пт'];

export function createDayDock(days,{anchor,content}){
  const view=document.defaultView;
  const dock=document.createElement('nav');
  dock.className='day-dock';
  dock.setAttribute('aria-label','Швидкий перехід між днями');
  dock.innerHTML='<div class="day-dock-inner">'+days.map((d,i)=>'<button type="button" data-day="'+i+'" data-dock-day="'+i+'" aria-label="'+esc(d.label)+'"><span class="day-label-full">'+esc(d.label)+'</span><span class="day-label-short" aria-hidden="true">'+SHORT[i]+'</span></button>').join('')+'</div>';
  document.body.append(dock);
  const buttons=[...dock.querySelectorAll('[data-dock-day]')];
  let enabled=false,pastAnchor=false,tucked=false,lockedUntil=0,lastY=view.scrollY,frame=0,inView=-1;

  function sync(){
    const shown=enabled&&pastAnchor&&(!tucked||performance.now()<lockedUntil||!!dock.querySelector(':focus-visible'));
    dock.classList.toggle('is-shown',shown);
  }
  function markInView(index){
    if(index===inView)return;
    inView=index;
    buttons.forEach((b,i)=>{
      b.classList.toggle('is-in-view',i===index);
      if(i===index)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');
    });
  }
  function onScroll(){
    if(frame)return;
    frame=view.requestAnimationFrame(()=>{
      frame=0;
      const y=view.scrollY,delta=y-lastY;
      if(Math.abs(delta)<8)return;
      tucked=delta>0;lastY=y;sync();
    });
  }
  const anchorObserver=new IntersectionObserver(([entry])=>{
    pastAnchor=!entry.isIntersecting&&entry.boundingClientRect.bottom<0;sync();
  });
  anchorObserver.observe(anchor);
  // The block crossing the upper middle of the screen is the day being read.
  const blockObserver=new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting)markInView(Number(entry.target.dataset.dayBlock));
  },{rootMargin:'-40% 0px -55% 0px'});

  view.addEventListener('scroll',onScroll,{passive:true});
  // A jump to another day scrolls the page; keep the dock visible during that scroll.
  document.addEventListener('click',event=>{
    if(enabled&&event.target instanceof Element&&event.target.closest('[data-day]')){lockedUntil=performance.now()+1200;sync();}
  });
  dock.addEventListener('focusin',sync);
  dock.addEventListener('focusout',()=>requestAnimationFrame(sync));

  return {
    update({active,today}){
      enabled=active;
      buttons.forEach((b,i)=>b.classList.toggle('is-today',i===today));
      blockObserver.disconnect();inView=-1;
      if(active)content.querySelectorAll('[data-day-block]').forEach(block=>blockObserver.observe(block));
      lastY=view.scrollY;sync();
    }
  };
}
