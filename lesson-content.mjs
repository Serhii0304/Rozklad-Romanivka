import {subjectIconMarkup} from './subject-icons.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
    return '<button type="button" class="subject '+esc(extraClass)+'" data-subject="'+esc(name)+'" title="Виділити цей предмет">'+subjectIconMarkup(config,name)+'<span class="subject-copy"><span class="subject-name">'+esc(name)+'</span>'+(qualifier?'<small class="subgroup">'+esc(qualifier)+'</small>':'')+'</span></button>';
  }).join('<span class="subject-divider" aria-hidden="true">/</span>')+'</div>';
}
