import catalog from './legacy-catalog.js';
import {normalizeState as oldNormalize} from './legacy-state.js';
import {normalizeState,weekKey} from './planner-state.js';
export function migrateLegacy(raw){
  const old=oldNormalize(raw,Object.keys(catalog.nodes),catalog.aliases);
  const custom=new Map(old.custom.map(n=>[n.id,n]));
  const chosen=new Set([...Object.keys(old.items),...old.custom.map(n=>n.id),...Object.values(old.weeks).flat()]);
  const tasks=[];
  for(const id of chosen){
    const meta=custom.get(id)||catalog.nodes[id];if(!meta)continue;
    const record=old.items[id]||{};
    const weeks=Object.entries(old.weeks).filter(([,ids])=>ids.includes(id)).map(([w])=>w);
    const priorRecords=Object.entries(old.archive||{}).filter(([key])=>catalog.aliases[key]===id).map(([key,v])=>({...v,title:catalog.labels[key]||key}));
    if(!weeks.length&&!custom.has(id)&&!record.action&&!record.document&&!record.url&&!record.due&&(!record.status||record.status==='todo')&&!priorRecords.length)continue;
    const dates=weeks.length?weeks:[''];
    for(const week of dates){
      const date=week?(record.due&&weekKey(new Date(record.due+'T12:00:00'))===week?record.due:week):(record.due||'');
      tasks.push({id:`migrated-${id}-${week||'undated'}`,title:meta.title,category:meta.category||meta.path?.[1]||'',date,status:record.status||'todo',action:record.action||'',document:record.document||'',url:record.url||'',deleted:false,priorRecords:[...priorRecords,...(record.due&&record.due!==date?[{...record,title:'이전 목표 날짜와 기록'}]:[])]});
    }
  }
  return normalizeState({version:2,tasks});
}
