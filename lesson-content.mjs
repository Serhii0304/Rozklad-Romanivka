import {subjectIconMarkup} from './subject-icons.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Phone-width tables show these labels; screen readers, filters and print keep the full name.
// Kept outside schedule-config.js, whose checksum protects the printed posters.
const SHORT_NAMES={
  'Англійська мова':'Англ. мова',
  'Українська мова':'Укр. мова',
  'Українська література':'Укр. літ.',
  'Зарубіжна література':'Зар. літ.',
  'Фізична культура':'Фізкультура',
  "Здоров'я, безпека та добробут":'ЗБД',
  'Фінансова грамотність':'Фін. грамотність',
  'Громадянська освіта':'Громад. освіта',
  'Правознавство':'Право'
};
export function shortSubjectName(name){
  return SHORT_NAMES[String(name).normalize('NFC').replace(/[’ʼ]/g,"'")]||'';
}
function subjectNameMarkup(name){
  const short=shortSubjectName(name);
  if(!short)return '<span class="subject-name">'+esc(name)+'</span>';
  return '<span class="subject-name"><span class="subject-name-full">'+esc(name)+'</span><span class="subject-name-short" aria-hidden="true">'+esc(short)+'</span></span>';
}
function lessonEntries(value){
  const entries=new Map();
  for(const part of String(value||'').split(/\s*\/\s*/)){
    const name=part.replace(/\s*\(\d+\s+(?:під)?група\)/g,'').replace(/\s+/g,' ').trim();
    if(!name)continue;
    const key=name.normalize('NFC').replace(/[’ʼ]/g,"'").toLocaleLowerCase('uk');
    if(!entries.has(key))entries.set(key,{name,groups:new Set()});
    for(const group of part.match(/\(\d+\s+(?:під)?група\)/g)||[])entries.get(key).groups.add(group);
  }
  return [...entries.values()];
}
export function subjectsInLesson(value){
  return lessonEntries(value).map(entry=>entry.name);
}
export function subjectCellMarkup(config,value,extraClass=''){
  const parts=lessonEntries(value);
  if(!parts.length)return '<span class="empty" aria-label="Уроку немає">—</span>';
  return '<div class="lesson-subjects'+(parts.length>1?' has-groups':'')+'">'+parts.map(({name,groups})=>{
    const qualifier=[...groups].join(' · ');
    return '<button type="button" class="subject '+esc(extraClass)+'" data-subject="'+esc(name)+'" title="Виділити цей предмет">'+subjectIconMarkup(config,name)+'<span class="subject-copy">'+subjectNameMarkup(name)+(qualifier?'<small class="subgroup">'+esc(qualifier)+'</small>':'')+'</span></button>';
  }).join('<span class="subject-divider" aria-hidden="true">/</span>')+'</div>';
}
