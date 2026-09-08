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
export function normalizeState(raw,baseIds) {
  if(!isObject(raw)||raw.version!==1||!isObject(raw.items)||!isObject(raw.weeks)||!Array.isArray(raw.custom)) throw new Error('학습 계획 백업 파일 형식이 아니에요.');
  const state=emptyState();const ids=new Set(baseIds);
  for(const c of raw.custom.slice(0,1000)) {
    if(!isObject(c)||!/^custom-[\w-]+$/.test(c.id)||ids.has(c.id)||!text(c.title,120).trim())continue;
    state.custom.push({id:c.id,title:text(c.title,120).trim(),category:['네트워크 구성','서비스','보안','개인 계획'].includes(c.category)?c.category:'개인 계획'});ids.add(c.id);
  }
  for(const [id,v] of Object.entries(raw.items)) {
    if(!ids.has(id)||!isObject(v)) continue;
    state.items[id]={status:Object.hasOwn(STATUSES,v.status)?v.status:'todo',action:text(v.action,2000),document:text(v.document,1000),url:safeURL(text(v.url,2000)),due:validDate(v.due)?v.due:''};
  }
  for(const [key,v] of Object.entries(raw.weeks)) {
    if(validDate(key)&&weekKey(new Date(key+'T12:00:00'))===key&&Array.isArray(v))state.weeks[key]=[...new Set(v.filter(id=>ids.has(id)))];
  }
  return state;
}
export function setItem(state,id,patch) { return {...state,items:{...state.items,[id]:{...itemState(state,id),...patch}}}; }
export function togglePlan(state,week,id) { const list=state.weeks[week]||[];return {...state,weeks:{...state.weeks,[week]:list.includes(id)?list.filter(x=>x!==id):[...list,id]}}; }
export function mergeState(current,incoming) {
  const custom=[...current.custom];const ids=new Set(custom.map(x=>x.id));for(const c of incoming.custom)if(!ids.has(c.id)){custom.push(c);ids.add(c.id);}
  const weeks={...current.weeks};for(const [key,list] of Object.entries(incoming.weeks))weeks[key]=[...new Set([...(weeks[key]||[]),...list])];
  return {version:1,custom,items:{...current.items,...incoming.items},weeks};
}
