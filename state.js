export const STATUSES = {todo:'시작 전',studying:'공부 중',review:'복습 필요',done:'완료'};
export const STORAGE_KEY = 'itaelan.study-planner.v1';
export const emptyState = () => ({version:1,items:{},weeks:{},custom:[]});
export const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function weekKey(date=new Date()) { const d = new Date(date);d.setHours(12,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return dateKey(d); }
export function shiftWeek(key,offset) { const d = new Date(key+'T12:00:00');d.setDate(d.getDate()+offset*7);return dateKey(d); }
export function flatten(root) { return (root.children||[]).flatMap(n=>[n,...flatten(n)]); }
export function itemState(state,id) { return state.items[id] || {status:'todo',action:'',document:'',url:'',due:''}; }
export function safeURL(value) { try { const u = new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';} }
const isObject = x => x!==null && typeof x==='object' && !Array.isArray(x);
const text = (x,max=1000)=> typeof x==='string'?x.slice(0,max):'';
const validDate = x => typeof x==='string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && Number.isFinite(Date.parse(x+'T12:00:00')) && dateKey(new Date(x+'T12:00:00'))===x;
export function normalizeState(raw,baseIds,aliases={}) {
  if(!isObject(raw)||raw.version!==1||!isObject(raw.items)||!isObject(raw.weeks)||!Array.isArray(raw.custom)) throw new Error('학습 계획 백업 파일 형식이 아니에요.');
  const state=emptyState();const ids=new Set(baseIds);
  for(const c of raw.custom.slice(0,1000)) {
    if(!isObject(c)||!/^custom-[\w-]+$/.test(c.id)||ids.has(c.id)||!text(c.title,120).trim())continue;
    state.custom.push({id:c.id,title:text(c.title,120).trim(),category:['네트워크 구성','서비스','보안','개인 계획'].includes(c.category)?c.category:'개인 계획'});ids.add(c.id);
  }
  const clean=v=>({status:Object.hasOwn(STATUSES,v.status)?v.status:'todo',action:text(v.action,2000),document:text(v.document,1000),url:safeURL(text(v.url,2000)),due:validDate(v.due)?v.due:''});
  const resolve=id=>ids.has(id)?id:(Object.hasOwn(aliases,id)&&ids.has(aliases[id])?aliases[id]:null);
  const grouped=new Map();const archive={};
  if(isObject(raw.archive))for(const [id,v] of Object.entries(raw.archive)){
    if(Object.hasOwn(aliases,id)&&resolve(id)&&isObject(v))archive[id]=clean(v);
  }
  for(const [id,v] of Object.entries(raw.items)) {
    const target=resolve(id);if(!target||!isObject(v))continue;
    const record=clean(v);const group=grouped.get(target)||[];
    if(target===id)group.unshift(record);else{group.push(record);archive[id]=record;}
    grouped.set(target,group);
  }
  for(const [id,records] of grouped){
    const statuses=records.map(r=>r.status);
    const status=statuses.includes('review')?'review':statuses.every(s=>s==='done')?'done':statuses.some(s=>s!=='todo')?'studying':'todo';
    const documentRecord=records.find(r=>r.document||r.url);
    state.items[id]={status,...Object.fromEntries(['action','due'].map(field=>[field,records.find(r=>r[field])?.[field]||''])),document:documentRecord?.document||'',url:documentRecord?.url||''};
  }
  if(Object.keys(archive).length)state.archive=archive;
  for(const [key,v] of Object.entries(raw.weeks)) {
    if(validDate(key)&&weekKey(new Date(key+'T12:00:00'))===key&&Array.isArray(v))state.weeks[key]=[...new Set(v.map(resolve).filter(Boolean))];
  }
  return state;
}
export function setItem(state,id,patch) { return {...state,items:{...state.items,[id]:{...itemState(state,id),...patch}}}; }
export function togglePlan(state,week,id) { const list=state.weeks[week]||[];return {...state,weeks:{...state.weeks,[week]:list.includes(id)?list.filter(x=>x!==id):[...list,id]}}; }
export function mergeState(current,incoming) {
  const custom=[...current.custom];const ids=new Set(custom.map(x=>x.id));for(const c of incoming.custom)if(!ids.has(c.id)){custom.push(c);ids.add(c.id);}
  const weeks={...current.weeks};for(const [key,list] of Object.entries(incoming.weeks))weeks[key]=[...new Set([...(weeks[key]||[]),...list])];
  const archive={...current.archive,...incoming.archive};
  return {version:1,custom,items:{...current.items,...incoming.items},weeks,...(Object.keys(archive).length?{archive}:{})};
}
