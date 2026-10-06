import {kyivParts} from './time-core.mjs';

function currentDay(nowEpochMs,config){
  const weekday=kyivParts(nowEpochMs).weekday;
  return weekday>=1&&weekday<=5&&weekday<=config.dayOrder.length?weekday-1:0;
}

export function readViewState(params,nowEpochMs,config){
  const requestedDay=config.dayOrder.findIndex(day=>day.id===params.get('day'));
  return {
    view:params.get('view')==='day'?'day':'week',
    day:requestedDay>=0?requestedDay:currentDay(nowEpochMs,config),
    autoDay:requestedDay<0
  };
}

export function selectViewMode(mode,currentState,nowEpochMs,config){
  return mode==='day'
    ?{view:'day',day:currentDay(nowEpochMs,config),autoDay:true}
    :{view:'week',day:currentState.day,autoDay:currentState.autoDay};
}
