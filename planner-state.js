export const STORAGE_KEY = 'itaelan.free-study-planner.v2';
export const LEGACY_KEY = 'itaelan.study-planner.v1';
export const STATUSES = {todo:'시작 전', studying:'공부 중', review:'복습 필요', done:'완료'};
export const emptyState = () => ({version:2,tasks:[]});
export const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function weekKey(date=new Date()) {const d=new Date(date);d.setHours(12,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return dateKey(d);}
export function shiftDate(key,days) {const d=new Date(key+'T12:00:00');d.setDate(d.getDate()+days);return dateKey(d);}
export function validDate(x) {return typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00'))&&dateKey(new Date(x+'T12:00:00'))===x;}
export function safeURL(x) {try{const u=new URL(x);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const text=(x,max=1000)=>typeof x==='string'?x.slice(0,max):'';
export function cleanTask(raw) {
  if(!object(raw)||typeof raw.id!=='string'||!/^[\w-]{1,200}$/.test(raw.id)||!text(raw.title,160).trim())return null;
  return {id:raw.id,title:text(raw.title,160).trim(),category:text(raw.category,80).trim(),date:validDate(raw.date)?raw.date:'',status:Object.hasOwn(STATUSES,raw.status)?raw.status:'todo',action:text(raw.action,4000),document:text(raw.document,1000),url:safeURL(text(raw.url,2000)),deleted:raw.deleted===true,
    priorRecords:Array.isArray(raw.priorRecords)?raw.priorRecords.filter(object).slice(0,300).map(r=>({title:text(r.title,500),status:Object.hasOwn(STATUSES,r.status)?r.status:'todo',action:text(r.action,4000),document:text(r.document,1000),url:safeURL(text(r.url,2000)),due:validDate(r.due)?r.due:''})):[]};
}
export function normalizeState(raw) {
  if(!object(raw)||raw.version!==2||!Array.isArray(raw.tasks))throw new Error('스터디 플래너 백업 파일을 선택해주세요.');
  if(raw.tasks.length>20000)throw new Error('백업의 계획 수가 너무 많아요.');
  const tasks=[],ids=new Set();
  for(const item of raw.tasks){const t=cleanTask(item);if(t&&!ids.has(t.id)){tasks.push(t);ids.add(t.id);}}
  return {version:2,tasks};
}
export function saveTask(state,raw) {const task=cleanTask(raw);if(!task)throw new Error('공부할 내용을 입력해주세요.');const exists=state.tasks.some(t=>t.id===task.id);return {...state,tasks:exists?state.tasks.map(t=>t.id===task.id?task:t):[...state.tasks,task]};}
export function updateTask(state,id,patch){const task=state.tasks.find(t=>t.id===id);return task?saveTask(state,{...task,...patch}):state;}
export function mergeState(current,incoming){const map=new Map(current.tasks.map(t=>[t.id,t]));for(const t of incoming.tasks)map.set(t.id,t);return {version:2,tasks:[...map.values()]};}
export function filterTasks(state,{view='week',week=weekKey(),day='',query='',status='all'}={}){
  const q=query.trim().toLocaleLowerCase();
  return state.tasks.filter(t=>{
    if(view==='trash'?!t.deleted:t.deleted)return false;
    if(view==='week'&&(!t.date||t.date<week||t.date>shiftDate(week,6)||(day&&t.date!==day)))return false;
    if(view==='unscheduled'&&t.date)return false;
    return(status==='all'||t.status===status)&&(!q||[t.title,t.category,t.action,t.document].join(' ').toLocaleLowerCase().includes(q));
  }).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||a.title.localeCompare(b.title,'ko'));
}
