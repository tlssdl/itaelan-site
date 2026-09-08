import {STORAGE_KEY,LEGACY_KEY,STATUSES,emptyState,dateKey,weekKey,shiftDate,safeURL,normalizeState,saveTask,updateTask,mergeState,filterTasks} from './planner-state.js';
const $=s=>document.querySelector(s);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>dateKey(new Date());
const displayDate=key=>new Date(key+'T12:00:00').toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'});
const shortDate=key=>new Date(key+'T12:00:00').toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'});
const views={week:'주간 계획',all:'전체 계획',unscheduled:'날짜 미정',trash:'휴지통'};
let state=emptyState(),view='week',week=weekKey(),day='',editingId=null,pendingImport=null,blocked=false,originalRaw='',toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function storageError(message){$('#storage-error').textContent=message;$('#storage-error').hidden=false;}
async function readBackup(raw){if(raw.version===1){const {migrateLegacy}=await import('./legacy-migration.js');return migrateLegacy(raw);}return normalizeState(raw);}
try {
  originalRaw=localStorage.getItem(STORAGE_KEY)||'';
  if(originalRaw) state=normalizeState(JSON.parse(originalRaw));
  else {
    originalRaw=localStorage.getItem(LEGACY_KEY)||'';
    if(originalRaw){state=await readBackup(JSON.parse(originalRaw));localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
  }
} catch {blocked=true;storageError('저장된 계획을 읽거나 옮기지 못했어요. 백업 저장으로 원본을 보관한 뒤 정상 백업을 불러오거나 브라우저 저장 설정을 확인해주세요.');}
function commit(next,{recover=false}={}){
  if(blocked&&!recover){toast('저장 문제를 먼저 해결해주세요. 백업 저장으로 원본을 보관할 수 있어요.');return false;}
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}catch{storageError('저장하지 못했어요. 브라우저 저장 공간과 설정을 확인해주세요. 현재 계획은 백업으로 보관할 수 있어요.');return false;}
  state=next;blocked=false;$('#storage-error').hidden=true;render();return true;
}
function selectedTasks({filtered=true}={}){return filterTasks(state,{view,week,day,query:filtered?$('#search').value:'',status:filtered?$('#status-filter').value:'all'});}
function badge(task){return `<span class="status-badge ${task.status}">${STATUSES[task.status]}</span>`;}
function taskRow(t){
  return `<article class="task-row ${t.status==='done'?'is-done':''}">${t.deleted?'':`<button class="complete-button ${t.status==='done'?'done':''}" data-complete="${escape(t.id)}" aria-pressed="${t.status==='done'}" aria-label="${escape(t.title)} ${t.status==='done'?'완료 취소':'완료 표시'}">${t.status==='done'?'✓':''}</button>`}<div class="task-body"><div class="task-heading"><button class="task-title" data-edit="${escape(t.id)}">${escape(t.title)}</button>${badge(t)}</div>${t.action?`<p class="task-action">${escape(t.action)}</p>`:''}<div class="task-meta">${t.category?`<span class="category-tag">${escape(t.category)}</span>`:''}${t.url?`<a class="doc-link" href="${escape(safeURL(t.url))}" target="_blank" rel="noopener noreferrer">↗ ${escape(t.document||'자료 열기')}</a>`:t.document?`<button class="doc-link" data-copy="${escape(t.id)}">▤ ${escape(t.document)} ⧉</button>`:''}${t.deleted?`<button class="restore-button" data-restore="${escape(t.id)}">복원하기</button>`:`<button class="row-edit" data-edit="${escape(t.id)}" aria-label="${escape(t.title)} 수정">수정 ↗</button>`}</div></div></article>`;
}
function render(){
  const focused=document.activeElement,attr=['data-complete','data-edit','data-restore','data-day'].find(a=>focused?.hasAttribute(a)),value=attr?focused.getAttribute(attr):null;
  const active=state.tasks.filter(t=>!t.deleted),weekTasks=filterTasks(state,{view:'week',week}),tasks=selectedTasks();
  $('#today').textContent=new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'short'});
  $('#view-crumb').textContent=views[view];
  $('#page-title').textContent=view==='trash'?'휴지통':view==='unscheduled'?'날짜는 나중에.':'나의 공부 계획';
  $('#page-subtitle').textContent=view==='trash'?'지운 계획을 다시 꺼낼 수 있어요.':view==='unscheduled'?'언젠가 공부하고 싶은 것들을 적어두세요.':'오늘 할 공부부터, 다음 주 목표까지.';
  $('#quick-panel').hidden=view==='trash';$('#new-btn').hidden=view==='trash';$('#week-controls').hidden=view!=='week';$('.overview').hidden=view==='trash';$('.plan-layout').classList.toggle('single-column',view==='trash');
  document.querySelectorAll('.nav-item').forEach(a=>{const selected=a.hash==='#'+view;a.classList.toggle('active',selected);if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('#nav-week').textContent=filterTasks(state,{view:'week',week:weekKey()}).length;$('#nav-all').textContent=active.length;$('#nav-unscheduled').textContent=active.filter(t=>!t.date).length;$('#nav-trash').textContent=state.tasks.filter(t=>t.deleted).length;
  $('#week-title').textContent=`${shortDate(week)} — ${shortDate(shiftDate(week,6))}`;$('#this-week').disabled=week===weekKey()&&!day;$('#whole-week').disabled=!day;
  $('#day-strip').innerHTML=Array.from({length:7},(_,i)=>{const key=shiftDate(week,i),count=weekTasks.filter(t=>t.date===key).length;return `<button class="day ${key===today()?'is-today':''} ${key===day?'selected':''} ${i===6?'sunday':''}" data-day="${key}" aria-pressed="${key===day}" aria-label="${displayDate(key)}, ${count}개 계획"><span class="weekday">${['월','화','수','목','금','토','일'][i]}${key===today()?' · 오늘':''}</span><span class="day-number">${Number(key.slice(-2))}</span><span class="day-count">${count}개 계획</span></button>`;}).join('');
  const title=view==='week'?(day?displayDate(day)+' 계획':week===weekKey()?'이번 주 계획':'선택한 주 계획'):views[view];
  $('#list-title').innerHTML=`${escape(title)} <span class="count">${tasks.length}</span>`;
  if(tasks.length){let previous;$('#task-list').innerHTML=tasks.map(t=>{const heading=t.date!==previous;previous=t.date;return (heading?`<h3 class="date-heading ${t.date&&t.date<today()?'overdue':''}">${t.date?displayDate(t.date):'날짜 미정'}</h3>`:'')+taskRow(t);}).join('');}
  else {const filtering=$('#search').value.trim()||$('#status-filter').value!=='all';const heading=filtering?'찾는 계획이 없어요.':view==='trash'?'휴지통이 비어 있어요.':view==='unscheduled'?'나중에 할 공부를 적어두세요.':'아직 적어둔 계획이 없어요.';const message=filtering?'검색어나 상태 필터를 바꿔보세요.':view==='trash'?'지운 계획은 이곳에서 복원할 수 있어요.':'위 입력란에 공부할 내용을 적거나 계획을 추가해보세요.';$('#task-list').innerHTML=`<div class="empty-plan"><span class="empty-icon" aria-hidden="true">${view==='trash'?'⌫':'＋'}</span><h3>${heading}</h3><p>${message}</p>${!filtering&&view!=='trash'?'<button class="button" data-new>＋ 계획 추가</button>':''}</div>`;}
  const overview=view==='week'?weekTasks:filterTasks(state,{view}),done=overview.filter(t=>t.status==='done').length,percent=overview.length?Math.round(done/overview.length*100):0;
  $('#overview-title').textContent=view==='week'?'한 주의 진행':view==='all'?'전체 진행':'계획 진행';$('#progress-percent').textContent=percent;$('#progress-bar').setAttribute('aria-valuenow',percent);$('#progress-bar>span').style.width=percent+'%';$('#progress-summary').textContent=`${overview.length}개 중 ${done}개 완료`;
  $('#status-summary').innerHTML=Object.entries(STATUSES).map(([s,label])=>`<div class="status-stat"><span><i class="status-dot ${s}"></i>${label}</span><strong>${overview.filter(t=>t.status===s).length}</strong></div>`).join('');
  $('#categories').innerHTML=[...new Set(active.map(t=>t.category).filter(Boolean))].sort().map(c=>`<option value="${escape(c)}"></option>`).join('');
  if(attr)document.querySelector(`[${attr}="${CSS.escape(value)}"]`)?.focus({preventScroll:true});
}
function defaultDate(){return view==='unscheduled'?'':view==='week'?(day||(week===weekKey()?today():week)):today();}
function resetQuickDate(){$('#quick-date').value=defaultDate();}
function changeView(next){view=Object.hasOwn(views,next)?next:'week';day='';$('#search').value='';$('#status-filter').value='all';resetQuickDate();render();}
function reveal(task){$('#search').value='';$('#status-filter').value='all';if(view!=='all'){view=task.date?'week':'unscheduled';if(task.date){week=weekKey(new Date(task.date+'T12:00:00'));day=task.date;}history.replaceState(null,'','#'+view);}resetQuickDate();render();}
function openEditor(id=null){
  const t=id?state.tasks.find(t=>t.id===id):{title:'',date:defaultDate(),status:'todo',category:'',action:'',document:'',url:'',priorRecords:[]};if(!t)return;
  editingId=id;$('#editor-heading').textContent=t.deleted?'휴지통의 계획':id?'계획 수정':'계획 추가';
  if(t.deleted)$('#editor-heading').textContent='휴지통의 계획';
  $('#edit-title').value=t.title;$('#edit-title').setCustomValidity('');$('#edit-date').value=t.date;$('#edit-status').value=t.status;$('#edit-category').value=t.category;$('#edit-action').value=t.action;$('#edit-document').value=t.document;$('#edit-url').value=t.url;$('#document-fields').open=!!(t.document||t.url);$('#edit-error').textContent='';$('#trash-btn').hidden=!id||t.deleted;
  $('#prior-records').hidden=!t.priorRecords.length;$('#prior-records').open=false;$('#prior-content').innerHTML=t.priorRecords.map(r=>`<article class="prior-record"><strong>${escape(r.title)}</strong><p>${STATUSES[r.status]}</p>${r.action?`<p>${escape(r.action)}</p>`:''}${r.document?`<p>문서: ${escape(r.document)}</p>`:''}${r.url?`<a class="doc-link" target="_blank" rel="noopener noreferrer" href="${escape(r.url)}">이전 문서 열기 ↗</a>`:''}${r.due?`<p>목표 날짜: ${escape(r.due)}</p>`:''}</article>`).join('');
  $('#editor').showModal();
}
$('#quick-form').addEventListener('submit',e=>{e.preventDefault();const title=$('#quick-title-input').value.trim();if(!title){$('#quick-title-input').setCustomValidity('공부할 내용을 입력해주세요.');$('#quick-title-input').reportValidity();return;}const task={id:'task-'+crypto.randomUUID(),title,date:$('#quick-date').value,status:'todo'};const next=saveTask(state,task);if(commit(next)){$('#quick-title-input').value='';reveal(next.tasks.find(t=>t.id===task.id));$('#quick-title-input').focus();toast('계획을 추가했어요.');}});
$('#quick-title-input').addEventListener('input',()=>$('#quick-title-input').setCustomValidity(''));
$('#new-btn').addEventListener('click',()=>openEditor());
$('#edit-title').addEventListener('input',()=>$('#edit-title').setCustomValidity(''));
$('#editor-form').addEventListener('submit',e=>{
  e.preventDefault();const title=$('#edit-title').value.trim(),url=$('#edit-url').value.trim();if(!title){$('#edit-title').setCustomValidity('공부할 내용을 입력해주세요.');$('#edit-title').reportValidity();return;}if(url&&!safeURL(url)){$('#edit-error').textContent='http:// 또는 https:// 문서 링크를 입력해주세요.';return;}
  const old=state.tasks.find(t=>t.id===editingId),task={...old,id:editingId||'task-'+crypto.randomUUID(),title,date:$('#edit-date').value,category:$('#edit-category').value.trim(),status:$('#edit-status').value,action:$('#edit-action').value.trim(),document:$('#edit-document').value.trim(),url};
  const next=saveTask(state,task);if(commit(next)){$('#editor').close();if(!task.deleted)reveal(next.tasks.find(t=>t.id===task.id));toast('계획을 저장했어요.');}
});
$('#trash-btn').addEventListener('click',()=>{if(editingId&&commit(updateTask(state,editingId,{deleted:true}))){$('#editor').close();toast('휴지통으로 옮겼어요. 언제든 복원할 수 있어요.');}});
$('#prev-week').addEventListener('click',()=>{week=shiftDate(week,-7);day='';resetQuickDate();render();});$('#next-week').addEventListener('click',()=>{week=shiftDate(week,7);day='';resetQuickDate();render();});$('#this-week').addEventListener('click',()=>{week=weekKey();day='';resetQuickDate();render();});$('#whole-week').addEventListener('click',()=>{day='';resetQuickDate();render();});
$('#search').addEventListener('input',render);$('#status-filter').addEventListener('change',render);
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.close){$('#'+b.dataset.close).close();return;}if(b.hasAttribute('data-new')){openEditor();return;}
  if(b.dataset.day){day=day===b.dataset.day?'':b.dataset.day;resetQuickDate();render();return;}
  if(b.dataset.edit){openEditor(b.dataset.edit);return;}
  if(b.dataset.complete){const t=state.tasks.find(t=>t.id===b.dataset.complete);if(t&&commit(updateTask(state,t.id,{status:t.status==='done'?'studying':'done'})))toast(t.status==='done'?'공부 중으로 변경했어요.':'완료했어요. 수고했어요!');return;}
  if(b.dataset.restore){if(commit(updateTask(state,b.dataset.restore,{deleted:false})))toast('계획을 복원했어요. 전체 계획에서 확인할 수 있어요.');return;}
  if(b.dataset.copy){const t=state.tasks.find(t=>t.id===b.dataset.copy);try{await navigator.clipboard.writeText(t.document);toast('파일 위치를 복사했어요.');}catch{openEditor(t.id);toast('복사가 제한되어 있어요. 파일 위치를 직접 복사해주세요.');}}
});
function exportBackup(){const raw=blocked&&originalRaw?originalRaw:JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2),url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`itaelan-study-${today()}${blocked?'-original':''}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('백업 파일을 저장했어요.');}
$('#export-btn').addEventListener('click',exportBackup);$('#before-import-export').addEventListener('click',exportBackup);$('#import-btn').addEventListener('click',()=>$('#import-file').click());
$('#import-file').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>8*1024*1024)throw new Error('8MB 이하의 백업 파일을 선택해주세요.');pendingImport=await readBackup(JSON.parse(await f.text()));$('#import-description').textContent=`계획 ${pendingImport.tasks.filter(t=>!t.deleted).length}개와 휴지통 ${pendingImport.tasks.filter(t=>t.deleted).length}개를 불러옵니다.`;$('#import-dialog').showModal();}catch(error){toast(error instanceof SyntaxError?'JSON 백업 파일을 읽을 수 없어요.':error.message);}finally{e.target.value='';}});
$('#confirm-import').addEventListener('click',()=>{if(pendingImport&&commit(mergeState(state,pendingImport),{recover:true})){$('#import-dialog').close();pendingImport=null;toast('백업을 현재 계획과 합쳤어요.');}});
window.addEventListener('storage',e=>{if(e.key!==STORAGE_KEY)return;try{state=e.newValue?normalizeState(JSON.parse(e.newValue)):emptyState();blocked=false;$('#storage-error').hidden=true;render();toast($('#editor').open?'다른 탭의 변경을 반영했어요. 열린 편집 내용은 저장할 때 적용돼요.':'다른 탭의 변경을 반영했어요.');}catch{storageError('다른 탭에서 저장한 내용을 읽지 못했어요. 백업을 저장하고 다시 열어주세요.');blocked=true;}});
window.addEventListener('hashchange',()=>changeView(location.hash.slice(1)));
changeView(location.hash.slice(1));
