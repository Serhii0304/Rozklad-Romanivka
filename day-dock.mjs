// A slim day switcher that stays pinned to the top once the main day buttons
// leave the screen, whichever way the page scrolls. Observers only, no scroll
// handler, so phones keep scrolling smoothly.
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SHORT=['Пн','Вт','Ср','Чт','Пт'];

export function createDayDock(days,{anchor,content}){
  const dock=document.createElement('nav');
  dock.className='day-dock';
  dock.setAttribute('aria-label','Швидкий перехід між днями');
  dock.innerHTML='<div class="day-dock-inner">'+days.map((d,i)=>'<button type="button" data-day="'+i+'" data-dock-day="'+i+'" aria-label="'+esc(d.label)+'"><span class="day-label-full">'+esc(d.label)+'</span><span class="day-label-short" aria-hidden="true">'+SHORT[i]+'</span></button>').join('')+'</div>';
  document.body.append(dock);
  const buttons=[...dock.querySelectorAll('[data-dock-day]')];
  let enabled=false,pastAnchor=false,inView=-1;

  function sync(){dock.classList.toggle('is-shown',enabled&&pastAnchor);}
  function markInView(index){
    if(index===inView)return;
    inView=index;
    buttons.forEach((b,i)=>{
      b.classList.toggle('is-in-view',i===index);
      if(i===index)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');
    });
  }
  new IntersectionObserver(([entry])=>{
    pastAnchor=!entry.isIntersecting&&entry.boundingClientRect.bottom<0;sync();
  }).observe(anchor);
  // The block crossing the upper middle of the screen is the day being read.
  const blockObserver=new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting)markInView(Number(entry.target.dataset.dayBlock));
  },{rootMargin:'-40% 0px -55% 0px'});

  return {
    update({active,today}){
      enabled=active;
      buttons.forEach((b,i)=>b.classList.toggle('is-today',i===today));
      blockObserver.disconnect();inView=-1;
      if(active)content.querySelectorAll('[data-day-block]').forEach(block=>blockObserver.observe(block));
      sync();
    }
  };
}
