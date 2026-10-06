import {schoolState,classIndex} from './time-core.mjs';

// The school bell clock stays the same on every page; a class adds its subject.
export function displaySchoolState(now,config,grade='all'){
  const state=schoolState(now,config);
  const day=config.dayOrder[state.dayIndex];
  const index=grade==='all'?-1:classIndex(config,grade);
  if(state.kind==='lesson'&&index>=0){
    const row=config.scheduleRows.find(item=>item.day===day.label&&item.lesson===state.lesson);
    const subject=row?.classes[index]||'';
    const bell=config.bellSchedule.find(item=>item.lesson===state.lesson);
    return {...state,
      title:subject||state.lesson+'-й урок у ліцеї',
      detail:day.label+' · '+config.classes[index]+' · '+(subject?state.lesson+'-й урок':'уроку в розкладі немає')+' · '+bell.start+'–'+bell.end
    };
  }
  return day?{...state,detail:day.label+' · '+state.detail}:state;
}
