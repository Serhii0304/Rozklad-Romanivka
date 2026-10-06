import {bellsMarkup,updateBellHighlights} from './bells-view.mjs?v=20261006-romanivka';
import {bellsPoster} from './bells-poster.mjs';
import {subjectCellMarkup,subjectsInLesson} from './lesson-content.mjs';
import {enhanceTableNavigation} from './table-navigation.mjs';
import {posterForClass} from './print-posters.mjs?v=20261006-romanivka';
import {weekPosterForDay,wholeWeekPosters} from './week-posters.mjs?v=20261006-romanivka';
import {pdfForPrintRequest,openPrintPdf} from './print-files.mjs?v=20261006-romanivka';
import {readViewState,selectViewMode} from './view-mode.mjs';
import {displaySchoolState} from './live-state.mjs';
import {classIndex,classGrade,classRangeLabel} from './time-core.mjs';
import {printPagesMarkup,fitPrintPages,settlePrintAssets} from './print-layout.mjs?v=20261006-romanivka';
import {subjectIconMarkup} from './subject-icons.mjs';
import {classWeekMarkup} from './schedule-view.mjs';
import './effects.mjs';
import {KyivClock} from './kyiv-clock.mjs';
import {kyivParts,silenceWindow,schoolState,durationLabel} from './time-core.mjs';
import {SilencePlayer} from './minute-of-silence.mjs';
import {SchoolBellPlayer} from './school-bell.mjs';
const C=window.SchoolScheduleConfig,D=C.dayOrder,B=C.bellSchedule;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=new KyivClock();
let today=kyivParts(clock.now()).weekday-1;
const params=new URLSearchParams(location.search);
const requestedGrade=(params.get('class')||'').replace(' клас','').trim();
let grade=classIndex(C,requestedGrade)>=0?requestedGrade:'all';
let {day,view,autoDay}=readViewState(params,clock.now(),C);
let section=location.hash==='#bells'||decodeURIComponent(location.pathname).endsWith('Розклад дзвінків.html')?'bells':'schedule',subject='',dayFilters={};
const timeFormatter=new Intl.DateTimeFormat('uk-UA',{timeZone:'Europe/Kyiv',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const dateFormatter=new Intl.DateTimeFormat('uk-UA',{timeZone:'Europe/Kyiv',weekday:'long',day:'numeric',month:'long'});
let lastSecond='',lastLive='',lastDate='';
const subjects=[...new Set(C.scheduleRows.flatMap(r=>r.classes).flatMap(subjectsInLesson))].sort((a,b)=>a.localeCompare(b,'uk'));
$('#subject-filter').innerHTML='<option value="">Усі предмети</option>'+subjects.map(s=>'<option>'+esc(s)+'</option>').join('');
const allButton=$('#class-tabs [data-class="all"]').outerHTML;
$('#class-tabs').innerHTML=allButton+C.classes.map((label,i)=>'<button type="button" data-class="'+esc(classGrade(C,i))+'" aria-label="'+esc(label)+'" aria-pressed="false"><span class="class-card-top"><span class="class-card-number" aria-hidden="true">'+esc(classGrade(C,i))+'</span><span class="class-card-check" aria-hidden="true"></span></span><span class="class-card-label">клас</span></button>').join('');
function color(s){if(/мова|література/.test(s))return '#436dde';if(/Математика|Алгебра|Геометрія|Інформатика|Фізика/.test(s))return '#8163bd';if(/Біологія|Географія|Природознавство|Хімія/.test(s))return '#3e927d';if(/мистецтво|Мистецтво|Технології/.test(s))return '#c48733';if(/Фізична|здоров/.test(s))return '#47889b';return '#b96b72';}
function subjectCell(s){return subjectCellMarkup(C,s);}
function table(index,allClasses=false){const columns=allClasses||grade==='all'?C.classes.map((_,i)=>i):[classIndex(C,grade)];const rows=C.scheduleRows.filter(r=>r.day===D[index].label);
return '<div class="table-wrap" tabindex="0" role="region" aria-label="'+D[index].label+' — розклад уроків"><table class="schedule-table '+(columns.length===1?'single-class':'')+'"><caption class="sr-only">'+D[index].label+' — '+(columns.length===1?grade+' клас':'5–11 класи')+'</caption><thead><tr><th scope="col">Урок / час</th>'+columns.map(i=>'<th scope="col" data-grade-head="'+classGrade(C,i)+'"><a class="class-link" href="class.html?class='+encodeURIComponent(C.classes[i])+'" data-grade-link="'+classGrade(C,i)+'">'+'<span class="class-number">'+classGrade(C,i)+'</span> клас <span aria-hidden="true">↗</span></a></th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr data-row-day="'+index+'" data-lesson="'+r.lesson+'"><th scope="row"><span class="lesson-number">'+r.lesson+'</span><span class="lesson-time"><span class="time-start">'+B.find(b=>b.lesson===r.lesson).start+'</span><span class="time-separator">–</span><span class="time-end">'+B.find(b=>b.lesson===r.lesson).end+'</span></span><span class="row-state"></span></th>'+columns.map(i=>'<td data-grade="'+classGrade(C,i)+'">'+subjectCell(r.classes[i])+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
function weekMatrix(){return classWeekMarkup(C,grade,today);}
function perDayFilter(i){return '<label class="day-subject-label"><span class="sr-only">Предмет: '+D[i].label+'</span><select data-day-subject="'+i+'"><option value="">Усі предмети цього дня</option>'+[...new Set(C.scheduleRows.filter(r=>r.day===D[i].label).flatMap(r=>r.classes).flatMap(subjectsInLesson))].sort((a,b)=>a.localeCompare(b,'uk')).map(s=>'<option'+(dayFilters[i]===s?' selected':'')+'>'+esc(s)+'</option>').join('')+'</select></label>';}
function dayBlock(index,withActions=false){const d=D[index];return '<article class="week-block '+(index===today?'is-today':'')+'" id="day-'+index+'" data-day-block="'+index+'"><div class="week-heading"><h3 class="week-title"><button type="button" class="weekday-title-button" data-day="'+index+'" data-weekday="'+index+'" data-focus-day aria-label="'+esc(d.label)+' — розклад дня">'+esc(d.label)+(index===today?' <span class="day-button-status">СЬОГОДНІ</span>':'')+'</button></h3>'+(withActions?'<div class="week-actions">'+perDayFilter(index)+'<button class="text-button" type="button" data-print-day="'+index+'">Друк дня ↗</button></div>':'')+'</div>'+table(index)+'</article>';}
function render(){today=kyivParts(clock.now()).weekday-1;
$('#day-tabs').innerHTML=D.map((d,i)=>'<button type="button" data-day="'+i+'" aria-label="'+d.label+'" class="'+(i===today?'is-today':'')+'" '+(i===today?'aria-current="date" ':'')+'aria-pressed="'+(i===day)+'"><span class="day-label-full">'+d.label+'</span><span class="day-label-short" aria-hidden="true">'+['Пн','Вт','Ср','Чт','Пт'][i]+'</span>'+(i===today?'<span class="today-dot" aria-label="сьогодні"></span>':'')+'</button>').join('');
$$('[data-class]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.class===grade)));
$$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
const captionDay=view==='week'?'Понеділок — п’ятниця':autoDay&&(today<0||today>=D.length)?'Сьогодні вихідний · Розклад на '+D[day].label.toLocaleLowerCase('uk'):D[day].label+(day===today?' · Сьогодні':'');
$('#schedule-caption').textContent=captionDay+' · '+(grade==='all'?'5–11 класи':grade+' клас');
$('#schedule-content').innerHTML=view==='day'?dayBlock(day):grade!=='all'?weekMatrix():D.map((d,i)=>dayBlock(i,true)).join('');
$('#print-button').innerHTML='<span aria-hidden="true">↗</span> '+(view==='week'?'Друк тижня':'Друк / PDF');
$('#subject-filter').value=subject;
applyPageLayout();applyFilters();updateLive(true);syncUrl();renderSection();enhanceTableNavigation($('#schedule-content'));}
function compactGeneralControls(isGeneral){
 const toolbar=$('#class-tabs').parentElement,days=$('#day-tabs').parentElement;
 const filter=$('#subject-filter').parentElement,todayButton=$('#today-button');
 document.body.classList.toggle('is-general-page',isGeneral);
 toolbar.hidden=isGeneral;
 const filterHost=isGeneral?days:toolbar;
 if(filter.parentElement!==filterHost){
  if(isGeneral)days.insertBefore(filter,$('.view-tabs'));
  else toolbar.append(filter);
 }
 const todayHost=isGeneral?days:$('.table-caption');
 if(todayButton.parentElement!==todayHost)todayHost.append(todayButton);
}
function applyPageLayout(){const isClass=grade!=='all'&&section==='schedule';compactGeneralControls(grade==='all'&&section==='schedule');const poster=posterForClass(C,grade);$('#poster-link').href=poster?.pagePath||'week-print.html';$('#poster-link').textContent=isClass?'Зображення для друку':'Зображення тижня';document.body.classList.toggle('is-class-page',isClass);document.body.classList.toggle('is-bells-page',section==='bells');$('#page-title').innerHTML=isClass?'Розклад уроків <span>'+grade+' клас</span>':section==='bells'?'Розклад <span>дзвінків</span>':'Розклад уроків<br><span>5–11 класи</span>';$('#page-description').textContent=C.school.name;$('#class-back').hidden=!isClass;$('#schedule-title').textContent=isClass?(view==='week'?'Навчальний тиждень · '+grade+' клас':'Розклад дня · '+grade+' клас'):'Загальний розклад уроків';$('#day-tabs').hidden=isClass&&view==='week';$('#table-legend').textContent=isClass&&view==='week'?'Синій рядок — поточний урок; найяскравіша клітинка — сьогодні. Натисніть на предмет, щоб виділити його за тиждень.':'Синій рядок — урок, який триває зараз.';}
function navigatePage(nextGrade='all',nextSection='schedule'){grade=nextGrade;section=nextSection;view='week';day=readViewState(new URLSearchParams(),clock.now(),C).day;autoDay=true;subject='';dayFilters={};const filename=section==='bells'?'Розклад дзвінків.html':grade==='all'?'index.html':'class.html';const url=new URL(filename,location.href);if(grade!=='all')url.searchParams.set('class',grade+' клас');url.searchParams.set('view','week');url.hash=section;history.pushState(null,'',url);render();if(section==='schedule'&&today>=0&&today<D.length)scrollToLiveLesson(true);else window.scrollTo({top:0,behavior:'instant'});}
function syncUrl(){const query=new URLSearchParams();if(grade!=='all')query.set('class',grade+' клас');query.set('view',view);if(!autoDay)query.set('day',D[day].id);const str=query.toString();history.replaceState(null,'',location.pathname+(str?'?'+str:'')+'#'+section);document.title=(section==='bells'?'Дзвінки':grade==='all'?'Розклад 5–11 класів':grade+' клас — розклад')+' · Романівка 2026–2027';}
function renderSection(){section=location.hash==='#bells'||decodeURIComponent(location.pathname).endsWith('Розклад дзвінків.html')?'bells':'schedule';applyPageLayout();$('#schedule').hidden=section!=='schedule';$('#bells').hidden=section!=='bells';$$('[data-nav]').forEach(a=>{if(a.dataset.nav===section)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});syncUrl();}
function applyFilters(){let count=0;$$('#schedule-content [data-subject]').forEach(btn=>{const row=btn.closest('[data-row-day]');const local=grade==='all'?(dayFilters[row?.dataset.rowDay]||''):'';const target=subject||local;const match=btn.dataset.subject===target;btn.classList.toggle('is-match',Boolean(target)&&match);btn.classList.remove('is-dim');btn.setAttribute('aria-pressed',String(Boolean(target)&&match));if(target&&match)count++;});$('#filter-result').textContent=subject||Object.values(dayFilters).some(Boolean)?'Знайдено уроків: '+count:'';}
function renderBells(){ $('#bells-content').innerHTML=bellsMarkup(C);}
function text(selector,value){const node=$(selector);if(node&&node.textContent!==value)node.textContent=value;}
function updateLive(force=false){const now=clock.now(),p=kyivParts(now),key=Math.floor(now/1000);if(!force&&key===lastSecond)return;lastSecond=key;
const time=timeFormatter.format(now);$('#clock').innerHTML=time.slice(0,5)+'<span>'+time.slice(5)+'</span>';$('#clock').dateTime=new Date(now).toISOString();text('#date',dateFormatter.format(now));text('#sync-status',clock.source);
if(lastDate&&p.dateKey!==lastDate){today=p.weekday-1;if(autoDay)day=today>=0&&today<5?today:0;lastDate=p.dateKey;render();return;}lastDate=p.dateKey;
const state=displaySchoolState(now,C,section==='bells'?'all':grade),w=silenceWindow(now);
text('#live-kind',state.kind==='lesson'?'ЗАРАЗ У ШКОЛІ':state.kind==='break'?'ЧАС ПЕРЕРВИ':'ШКІЛЬНИЙ ДЕНЬ');text('#live-title',w.active?'Загальнонаціональна хвилина мовчання':state.title);text('#live-detail',w.active?'Вшановуємо пам’ять усіх загиблих унаслідок війни.':state.detail);text('#countdown-label',w.active?'До завершення':state.timerLabel);text('#countdown',w.active?durationLabel(w.remaining):state.remaining?durationLabel(state.remaining):'—');$('#live-progress').style.width=(w.active?w.elapsed/60:state.progress)*100+'%';
$('#silence').classList.toggle('is-active',w.active);document.body.classList.toggle('is-silence-active',w.active);$('#silence-countdown').hidden=!w.active;text('#silence-countdown',durationLabel(w.remaining));text('#silence-title',w.active?'Пам’ятаємо. Вшановуємо.':'Хвилина мовчання');text('#silence-detail',w.active?'09:00–09:01 · Київський час':'Щодня о 09:00–09:01. Вшановуємо пам’ять загиблих.');
const liveKey=[p.dateKey,state.kind,state.lesson,state.nextLesson,grade,view,day,section].join('|');if(force||liveKey!==lastLive){lastLive=liveKey;$$('#schedule-content [data-row-day]').forEach(row=>{const current=Number(row.dataset.rowDay)===state.dayIndex&&Number(row.dataset.lesson)===state.lesson;const upcoming=Number(row.dataset.rowDay)===state.dayIndex&&Number(row.dataset.lesson)===state.nextLesson;row.classList.toggle('is-current',current);row.classList.toggle('is-upcoming',upcoming);row.querySelector('.row-state').textContent=current?'ЗАРАЗ':upcoming?'НАСТУПНИЙ':'';if(current)row.setAttribute('aria-current','time');else row.removeAttribute('aria-current');});
$$('#schedule-content [data-week-row]').forEach(row=>{const current=state.kind==='lesson'&& +row.dataset.weekRow===state.lesson;const next=(state.kind==='break'||state.kind==='before')&& +row.dataset.weekRow===state.nextLesson;row.classList.toggle('is-current',current);row.classList.toggle('is-upcoming',next);row.querySelector('.row-state').textContent=current?'ЗАРАЗ':next?'НАСТУПНИЙ':'';if(current)row.setAttribute('aria-current','time');else row.removeAttribute('aria-current');row.querySelectorAll('[data-cell-day]').forEach(cell=>{const live=current&& +cell.dataset.cellDay===state.dayIndex;cell.classList.toggle('is-current-cell',live);if(live)cell.setAttribute('aria-current','time');else cell.removeAttribute('aria-current');});});
}
$$('#schedule-content .is-current .row-state').forEach(node=>{node.textContent='ЗАРАЗ · '+durationLabel(state.remaining);});
$$('#schedule-content .is-upcoming .row-state').forEach(node=>{node.textContent=(state.kind==='break'?'ПЕРЕРВА · ':'ПОЧАТОК · ')+durationLabel(state.remaining);});
if(section==='bells'||force)updateBellHighlights($('#bells-content'),schoolState(now,C));}

function printView(printDay=null){
 const stage=$('#print-stage'),pages=[];
 if(section==='bells'&&printDay===null)pages.push({title:'Розклад дзвінків · 5–11 класи',poster:bellsPoster});
 else if(printDay!==null)pages.push({title:D[printDay].label+' · 5–11 класи',poster:weekPosterForDay(C,printDay)});
 else if(view==='week'&&grade!=='all')pages.push({title:grade+' клас · Навчальний тиждень',poster:posterForClass(C,grade)});
 else if(view==='week')wholeWeekPosters(C).forEach(poster=>pages.push({title:poster.label+' · 5–11 класи',poster}));
 else if(grade==='all')pages.push({title:D[day].label+' · 5–11 класи',poster:weekPosterForDay(C,day)});
 else pages.push({title:D[day].label+' · '+(grade==='all'?'5–11 класи':grade+' клас'),content:table(day)});
 stage.innerHTML=printPagesMarkup(pages);
 const state=displaySchoolState(clock.now(),C,section==='bells'?'all':grade);
 stage.querySelectorAll('[data-row-day],[data-week-row]').forEach(row=>{
  const lesson=Number(row.dataset.weekRow||row.dataset.lesson);
  const correctDay=row.dataset.weekRow!==undefined||Number(row.dataset.rowDay)===state.dayIndex;
  const current=correctDay&&state.kind==='lesson'&&lesson===state.lesson;
  const next=correctDay&&(state.kind==='break'||state.kind==='before')&&lesson===state.nextLesson;
  row.classList.toggle('is-current',current);row.classList.toggle('is-upcoming',next);
  row.querySelector('.row-state').textContent=current?'ЗАРАЗ':next?'НАСТУПНИЙ':'';
  row.querySelectorAll('[data-cell-day]').forEach(cell=>cell.classList.toggle('is-current-cell',current&&Number(cell.dataset.cellDay)===state.dayIndex));
 });
 stage.querySelectorAll('[data-subject]').forEach(node=>{
  const local=grade==='all'?dayFilters[node.closest('[data-row-day]')?.dataset.rowDay]:'';
  node.classList.toggle('is-match',Boolean(subject||local)&&node.dataset.subject===(subject||local));
 });
 stage.querySelectorAll('a,button.subject').forEach(node=>{
  const span=document.createElement('span');span.className=node.className;
  if(node.dataset.subject)span.dataset.subject=node.dataset.subject;
  span.append(...node.childNodes);node.replaceWith(span);
 });
 stage.dataset.ready='true';
}
async function printDocument(printDay=null){const pdf=pdfForPrintRequest(C,{section,grade,view,day,printDay});if(pdf){openPrintPdf(pdf);return;}printView(printDay);await settlePrintAssets($('#print-stage'));fitPrintPages($('#print-stage'));window.print();}
$('#print-button').addEventListener('click',()=>printDocument());
window.addEventListener('beforeprint',()=>{if($('#print-stage').dataset.ready!=='true')printView();fitPrintPages($('#print-stage'));});
window.addEventListener('afterprint',()=>{delete $('#print-stage').dataset.ready;$('#print-stage').innerHTML='';});
document.addEventListener('click',event=>{const button=event.target.closest('button,a');if(!button)return;
if(button.dataset.class!==undefined){navigatePage(button.dataset.class);}
if(button.dataset.day!==undefined){day=+button.dataset.day;autoDay=day===today;if(button.dataset.focusDay!==undefined)view='day';if(view==='week'&&grade==='all'){render();$('#day-'+day)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}else{view='day';render();}}
if(button.dataset.view){({view,day,autoDay}=selectViewMode(button.dataset.view,{view,day,autoDay},clock.now(),C));render();if(view==='day')scrollToLiveLesson();}
if(button.dataset.gradeLink){event.preventDefault();navigatePage(button.dataset.gradeLink);}
if(button.dataset.subject){const i=button.closest('[data-row-day]')?.dataset.rowDay;if(view==='week'&&grade==='all'){dayFilters[i]=dayFilters[i]===button.dataset.subject?'':button.dataset.subject;subject='';$('#subject-filter').value='';const select=$('[data-day-subject="'+i+'"]');if(select)select.value=dayFilters[i];}else{subject=subject===button.dataset.subject?'':button.dataset.subject;$('#subject-filter').value=subject;}applyFilters();}
if(button.dataset.home!==undefined){event.preventDefault();navigatePage();}if(button.dataset.nav!==undefined){event.preventDefault();navigatePage('all',button.dataset.nav);}if(button.dataset.printBells!==undefined){printDocument();}
if(button.dataset.printDay!==undefined){printDocument(+button.dataset.printDay);}});
$('#subject-filter').addEventListener('change',event=>{subject=event.target.value;dayFilters={};$$('[data-day-subject]').forEach(s=>s.value='');applyFilters();});
document.addEventListener('change',event=>{if(event.target.dataset.daySubject!==undefined){dayFilters[event.target.dataset.daySubject]=event.target.value;subject='';$('#subject-filter').value='';applyFilters();}});
function scrollToLiveLesson(instant=false){requestAnimationFrame(()=>{const row=$('#schedule-content tr.is-current')||$('#schedule-content tr.is-upcoming');const target=row||$('#schedule');target?.scrollIntoView({block:row?'center':'start',behavior:instant||document.documentElement.dataset.effects==='minimal'||matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});}
$('#today-button').addEventListener('click',()=>{({view,day,autoDay}=selectViewMode('day',{view,day,autoDay},clock.now(),C));render();scrollToLiveLesson();});
function goToTop(event){event.preventDefault();const title=$('#page-title');title.tabIndex=-1;title.focus({preventScroll:true});window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
function updateTopButton(){const hidden=window.scrollY<360;if($('#floating-top').hidden!==hidden)$('#floating-top').hidden=hidden;}
$('#back-top').addEventListener('click',goToTop);$('#floating-top').addEventListener('click',goToTop);window.addEventListener('scroll',updateTopButton,{passive:true});window.addEventListener('pageshow',updateTopButton);updateTopButton();
window.addEventListener('hashchange',()=>{renderSection();updateLive(true);});
window.addEventListener('popstate',()=>{section=location.hash==='#bells'||decodeURIComponent(location.pathname).endsWith('Розклад дзвінків.html')?'bells':'schedule';const q=new URLSearchParams(location.search),g=(q.get('class')||'').replace(' клас','').trim();grade=classIndex(C,g)>=0?g:'all';({view,day,autoDay}=readViewState(q,clock.now(),C));render();});
renderBells();render();if(section==='schedule'){if(view==='week'&&grade==='all'&&!autoDay)requestAnimationFrame(()=>$('#day-'+day)?.scrollIntoView({block:'start',behavior:'instant'}));else if(autoDay&&today>=0&&today<D.length)scrollToLiveLesson(true);}clock.onSync(()=>updateLive(true));clock.start();setInterval(()=>updateLive(),1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateLive(true);});
$('#sound-button').hidden=true;
let silenceAudio={},bellAudio={};
function updateAudioHelp(){
 const active=silenceAudio.active?silenceAudio:bellAudio.active?bellAudio:null;
 const unsupported=silenceAudio.state==='unsupported',ready=!!(silenceAudio.ready&&bellAudio.ready);
 const blocked=!!active&&(active.state==='blocked'||unsupported);
 $('#sound-button').hidden=!blocked;$('#sound-button').disabled=unsupported;
 $('#sound-button').setAttribute('aria-pressed',String(ready));text('#sound-button',unsupported?'Звук недоступний':'Увімкнути звук');
 text('#audio-help',unsupported?'Цей браузер не підтримує звук.':active?.otherTab?'Звук відтворюється в іншій відкритій вкладці сайту.':blocked?'Браузер призупинив звук. Торкніться сторінки, щоб його ввімкнути.':bellAudio.error?'Не вдалося завантажити шкільний дзвінок. Оновіть сторінку; хвилина мовчання працює окремо.':ready?'Звук готовий · Шкільні дзвінки та хвилина мовчання — автоматично.':silenceAudio.state==='loading'||bellAudio.state==='loading'?'Підготовка звуків…':'Звук активується після звичайного дотику до сайту. Тримайте сторінку відкритою, а пристрій — активним.');
}
const player=new SilencePlayer(clock,status=>{silenceAudio=status;updateAudioHelp();});
const bellPlayer=new SchoolBellPlayer(clock,C,player,status=>{bellAudio=status;updateAudioHelp();});
$('#sound-button').addEventListener('click',()=>player.enable());
