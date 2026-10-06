const weekdays=new Set(['monday','tuesday','wednesday','thursday','friday']);
export const wholeWeekPdfPath='assets/print-week/week-all-classes.pdf';

export function weekPosterForDay(config,dayOrIndex){
  const days=config?.dayOrder;
  if(!Array.isArray(days))return null;
  let day;
  if(typeof dayOrIndex==='number'){
    if(!Number.isInteger(dayOrIndex)||dayOrIndex<0)return null;
    day=days[dayOrIndex];
  }else{
    const value=typeof dayOrIndex==='string'?dayOrIndex:dayOrIndex?.id;
    if(typeof value!=='string'||!value)return null;
    day=days.find(item=>item.id===value||item.label===value);
  }
  if(!day||!weekdays.has(day.id)||typeof day.label!=='string'||!day.label)return null;
  return {
    dayId:day.id,
    label:day.label,
    imagePath:`assets/print-week/${day.id}.png`,
    pdfPath:`assets/print-week/${day.id}.pdf`,
    previewPath:`assets/print-week/${day.id}-preview.webp`,
    printImagePath:`assets/print-ready/${day.id}.png`,
    printPreviewPath:`assets/print-ready/${day.id}-preview.webp`,
    pagePath:`week-print.html?day=${encodeURIComponent(day.id)}`,
    kind:'school-week',
    downloadName:`Романівський ліцей ім. М. Т. Рильського — ${day.label} — усі класи — розклад 2026-2027.png`
  };
}

export function wholeWeekPosters(config){
  if(!Array.isArray(config?.dayOrder))return [];
  return config.dayOrder.map((_,index)=>weekPosterForDay(config,index)).filter(Boolean);
}
