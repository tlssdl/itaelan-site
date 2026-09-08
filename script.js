import {STATUSES,emptyState,weekKey,shiftWeek,flatten,itemState,STORAGE_KEY,normalizeState,dateKey,safeURL,setItem,togglePlan,mergeState} from './state.js';
const $=s=>document.querySelector(s);
const base=flatten(window.ROADMAP_DATA.root),baseIds=base.map(n=>n.id),aliases=window.ROADMAP_DATA.aliases||{};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=emptyState(),selectedWeek=weekKey(),category='all',editingId=null,pendingImport=null,toastTimer,originalRaw='',blocked=false;
const monthDay=key=>new Date(key+'T12:00:00').toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'});
function weekEnd(key){const d=new Date(key+'T12:00:00');d.setDate(d.getDate()+6);return dateKey(d);}
function allNodes(){return [...base,...state.custom.map(c=>({...c,path:[window.ROADMAP_DATA.root.title,c.category,c.title],children:[]}))];}
function findNode(id){return allNodes().find(n=>n.id===id);}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000);}
function storageError(message){$('#storage-error').textContent=message;$('#storage-error').hidden=false;}
try{originalRaw=localStorage.getItem(STORAGE_KEY)||'';if(originalRaw)state=normalizeState(JSON.parse(originalRaw),baseIds,aliases);}catch{blocked=true;storageError('저장된 계획을 읽을 수 없어요. 먼저 ‘백업 저장’으로 원본을 보관한 뒤 정상 백업을 불러오거나 브라우저 저장 설정을 확인해주세요.');}
function commit(next,{recover=false}={}) {
  if(blocked&&!recover){toast('저장 문제를 먼저 해결해주세요. 원본은 백업 저장으로 보관할 수 있어요.');return false;}
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}catch{storageError('저장하지 못했어요. 저장 공간이나 브라우저 설정을 확인해주세요. 현재 계획은 ‘백업 저장’으로 보관할 수 있어요.');return false;}
  state=next;blocked=false;$('#storage-error').hidden=true;render();return true;
}
function badge(id){const s=itemState(state,id).status;return `<span class="status-badge ${s}">${STATUSES[s]}</span>`;}
function planButton(id){const has=(state.weeks[selectedWeek]||[]).includes(id);return `<button class="plan-add ${has?'added':''}" data-plan="${escape(id)}" aria-pressed="${has}" aria-label="${escape(findNode(id)?.title)} ${has?'선택한 주에서 빼기':'선택한 주에 담기'}">${has?'✓ 담음':'＋ 담기'}</button>`;}
function row(node,withPath=false){return `<div class="roadmap-row"><div class="row-main"><button class="item-title" data-edit="${escape(node.id)}">${escape(node.title)}</button>${withPath?`<p class="item-path">${escape(node.path.slice(1,-1).join(' › '))}</p>`:''}</div>${badge(node.id)}${planButton(node.id)}</div>`;}
function branch(node,opened){if(!node.children?.length)return row(node);return `<details class="branch" data-branch="${escape(node.id)}" ${opened.has(node.id)?'open':''}><summary>${escape(node.title)}<span class="group-count">${flatten(node).length}개 항목</span></summary><div class="branch-content"><div class="group-action"><button data-edit="${escape(node.id)}">${escape(node.title)} 전체 계획 편집</button>${badge(node.id)}${planButton(node.id)}</div>${node.children.map(c=>branch(c,opened)).join('')}</div></details>`;}
function planRow(node){const v=itemState(state,node.id),due=v.due?`<span class="due ${v.due<dateKey(new Date())&&v.status!=='done'?'overdue':''}">${v.due<dateKey(new Date())&&v.status!=='done'?'기한 지남 · ':''}${monthDay(v.due)}까지</span>`:'';return `<article class="plan-row"><button class="complete-button ${v.status==='done'?'done':''}" data-complete="${escape(node.id)}" aria-pressed="${v.status==='done'}" aria-label="${escape(node.title)} ${v.status==='done'?'완료 취소':'완료 표시'}">${v.status==='done'?'✓':''}</button><div class="plan-body"><div class="item-top"><div><button class="item-title" data-edit="${escape(node.id)}">${escape(node.title)}</button><p class="item-path">${escape(node.path.slice(1,-1).join(' › ')||'전체 분류')}</p></div>${badge(node.id)}</div><button class="item-action ${v.action?'':'placeholder'}" data-edit="${escape(node.id)}" style="text-align:left;padding:0">${escape(v.action||'＋ 다음 할 일 한 줄 남기기')}</button><div class="item-bottom">${v.url?`<a class="doc-button" href="${escape(safeURL(v.url))}" target="_blank" rel="noopener noreferrer">↗ ${escape(v.document||'연결한 문서 열기')}</a>`:v.document?`<button class="doc-button" data-copy="${escape(node.id)}" title="문서 위치 복사">▤ ${escape(v.document)} ⧉</button>`:''}${due}<button class="row-remove" data-plan="${escape(node.id)}" aria-label="${escape(node.title)} 선택한 주에서 빼기">계획에서 빼기</button></div></div></article>`;}
function renderWeekly(){
  const ids=state.weeks[selectedWeek]||[],nodes=ids.map(findNode).filter(Boolean),done=nodes.filter(n=>itemState(state,n.id).status==='done').length,percent=nodes.length?Math.round(done/nodes.length*100):0;
  $('#today').textContent=new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'short'});
  $('#week-title').textContent=`${monthDay(selectedWeek)} — ${monthDay(weekEnd(selectedWeek))}`;
  $('#this-week').disabled=selectedWeek===weekKey();
  $('#week-caption').textContent=selectedWeek===weekKey()?'이번 주 계획':`${selectedWeek.slice(0,4)}년 · 선택한 주 계획`;
  $('#plan-count').textContent=nodes.length;
  $('#weekly-list').innerHTML=nodes.length?nodes.map(planRow).join(''):'<div class="empty-plan"><span class="empty-icon" aria-hidden="true">＋</span><h3>이번 주의 첫 계획을 골라볼까요?</h3><p>로드맵에서 공부할 항목을 담고<br>다음 할 일을 한 줄로 남겨보세요.</p><a class="button primary" href="#roadmap">로드맵에서 고르기 ↗</a></div>';
  $('#week-percent').textContent=percent;$('#week-progress').setAttribute('aria-valuenow',percent);$('#week-progress>span').style.width=percent+'%';
  $('#week-summary').textContent=nodes.length?`${nodes.length}개 중 ${done}개 완료`:'계획을 선택해 시작하세요.';
  $('#status-summary').innerHTML=Object.entries(STATUSES).map(([s,label])=>`<div class="status-stat"><span><i class="status-dot ${s}"></i>${label}</span><strong>${nodes.filter(n=>itemState(state,n.id).status===s).length}</strong></div>`).join('');
  const continuing=allNodes().filter(n=>['studying','review'].includes(itemState(state,n.id).status)&&!ids.includes(n.id));
  $('#continuing-list').innerHTML=continuing.length?continuing.map(n=>`<article class="continuing-card"><div class="item-top"><button class="item-title" data-edit="${escape(n.id)}">${escape(n.title)}</button>${badge(n.id)}</div><p class="item-path">${escape(n.path.slice(1,-1).join(' › '))}</p>${itemState(state,n.id).action?`<p class="item-action">${escape(itemState(state,n.id).action)}</p>`:''}<div class="item-bottom">${planButton(n.id)}</div></article>`).join(''):'<p class="continuing-empty">공부 중이거나 복습이 필요한 항목이 여기에 모여요.</p>';
}
function renderRoadmap(){
  const opened=new Set([...document.querySelectorAll('details[open][data-branch]')].map(d=>d.dataset.branch));
  const nodes=allNodes(),q=$('#search').value.trim().toLocaleLowerCase(),status=$('#status-filter').value;
  $('#total-progress').textContent=`전체 ${nodes.length}개 중 ${nodes.filter(n=>itemState(state,n.id).status==='done').length}개 완료`;
  const filtered=nodes.filter(n=>{const v=itemState(state,n.id);return(category==='all'||n.path[1]===category)&&(status==='all'||v.status===status)&&(!q||[n.title,...n.path.slice(1),v.action,v.document].join(' ').toLocaleLowerCase().includes(q));});
  $('#search-summary').textContent=`${filtered.length}개 항목 · 제목을 누르면 계획과 문서 위치를 편집할 수 있어요`;
  if(q||status!=='all'){$('#roadmap-tree').innerHTML=filtered.length?`<div class="category-section search-results">${filtered.map(n=>row(n,true)).join('')}</div>`:'<div class="no-results">일치하는 항목이 없어요. 검색어나 상태 필터를 바꿔보세요.</div>';return;}
  let html=window.ROADMAP_DATA.root.children.filter(c=>category==='all'||c.title===category).map(c=>{
    const theme={'네트워크 구성':'','서비스':'service','보안':'security'}[c.title];
    const extras=state.custom.filter(n=>n.category===c.title).map(n=>findNode(n.id));
    return `<section class="category-section"><div class="category-header ${theme}"><button data-edit="${escape(c.id)}" style="text-align:left;font-weight:700;padding:0">${escape(c.title)}</button><span>${flatten(c).length+extras.length+1}개 항목</span></div><div class="group-action" style="padding:12px 20px 0">${badge(c.id)}${planButton(c.id)}</div>${c.children.map(n=>branch(n,opened)).join('')}${extras.length?`<div class="search-results">${extras.map(n=>row(n)).join('')}</div>`:''}</section>`;
  }).join('');
  if(category==='all'||category==='개인 계획'){
    const custom=state.custom.filter(n=>n.category==='개인 계획').map(n=>findNode(n.id));
    if(custom.length)html+=`<section class="category-section"><h3 class="category-header personal">개인 계획<span>${custom.length}개 항목</span></h3><div class="search-results">${custom.map(n=>row(n)).join('')}</div></section>`;
    else if(category==='개인 계획')html='<div class="no-results">아직 개인 계획이 없어요.<br><button class="button primary" data-new style="margin-top:18px">＋ 할 일 추가</button></div>';
  }
  $('#roadmap-tree').innerHTML=html;
}
function render(){
  const focused=document.activeElement;
  const focusAttribute=['data-plan','data-complete','data-edit'].find(attr=>focused?.hasAttribute(attr));
  const focusValue=focusAttribute?focused.getAttribute(focusAttribute):null;
  const focusRegion=focused?.closest('#roadmap-tree,#weekly-list,#continuing-list')?.id;
  renderWeekly();renderRoadmap();
  if(focusAttribute&&focusRegion){const replacement=document.querySelector(`#${focusRegion} [${focusAttribute}="${CSS.escape(focusValue)}"]`);replacement?.focus({preventScroll:true});}
}
function openEditor(id){const n=findNode(id);if(!n)return;editingId=id;const v=itemState(state,id);$('#editor-title').textContent=n.title;$('#editor-path').textContent=n.path.slice(1,-1).join(' › ');$('#edit-status').value=v.status;$('#edit-action').value=v.action;$('#edit-document').value=v.document;$('#edit-url').value=v.url;$('#edit-due').value=v.due;$('#edit-planned').checked=(state.weeks[selectedWeek]||[]).includes(id);$('#edit-week-label').textContent=`${monthDay(selectedWeek)} — ${monthDay(weekEnd(selectedWeek))} 계획에 담기`;$('#edit-error').textContent='';
  const prior=Object.entries(state.archive||{}).filter(([oldId])=>aliases[oldId]===id);
  $('#legacy-records').hidden=!prior.length;
  $('#legacy-content').innerHTML=prior.map(([oldId,r])=>'<article class="legacy-record"><strong>'+escape(window.ROADMAP_DATA.legacyLabels?.[oldId]||oldId)+'</strong><p>'+STATUSES[r.status]+'</p>'+(r.action?'<p>'+escape(r.action)+'</p>':'')+(r.document?'<p>문서: '+escape(r.document)+'</p>':'')+(r.url?'<a class="inline-link" href="'+escape(safeURL(r.url))+'" target="_blank" rel="noopener noreferrer">이전 문서 열기 ↗</a>':'')+(r.due?'<p>목표 날짜: '+escape(r.due)+'</p>':'')+'</article>').join('');
  $('#editor').showModal();}
function openNew(){$('#new-form').reset();$('#new-item').showModal();}
$('#editor-form').addEventListener('submit',e=>{
  e.preventDefault();const url=$('#edit-url').value.trim();if(url&&!safeURL(url)){$('#edit-error').textContent='http:// 또는 https:// 문서 링크를 입력해주세요.';return;}
  const patch={status:$('#edit-status').value,action:$('#edit-action').value.trim(),document:$('#edit-document').value.trim(),url:safeURL(url),due:$('#edit-due').value};
  let next=setItem(state,editingId,patch);if($('#edit-planned').checked!==(state.weeks[selectedWeek]||[]).includes(editingId))next=togglePlan(next,selectedWeek,editingId);
  if(commit(next)){$('#editor').close();toast('계획을 저장했어요.');}
});
$('#new-form').addEventListener('submit',e=>{e.preventDefault();const title=$('#new-name').value.trim();if(!title){$('#new-name').setCustomValidity('할 일 이름을 입력해주세요.');$('#new-name').reportValidity();return;}const id='custom-'+crypto.randomUUID(),next=togglePlan({...state,custom:[...state.custom,{id,title,category:$('#new-category').value}]},selectedWeek,id);if(commit(next)){$('#new-item').close();openEditor(id);toast('선택한 주에 할 일을 추가했어요.');}});
$('#new-name').addEventListener('input',()=>$('#new-name').setCustomValidity(''));
$('#new-btn').addEventListener('click',openNew);
$('#prev-week').addEventListener('click',()=>{selectedWeek=shiftWeek(selectedWeek,-1);render();});
$('#next-week').addEventListener('click',()=>{selectedWeek=shiftWeek(selectedWeek,1);render();});
$('#this-week').addEventListener('click',()=>{selectedWeek=weekKey();render();});
$('#search').addEventListener('input',renderRoadmap);$('#status-filter').addEventListener('change',renderRoadmap);
$('.category-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(!b)return;category=b.dataset.category;document.querySelectorAll('[data-category]').forEach(el=>{const active=el===b;el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active));});renderRoadmap();});
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.close){$('#'+b.dataset.close).close();return;}
  if(b.hasAttribute('data-new')){openNew();return;}
  if(b.dataset.edit){openEditor(b.dataset.edit);return;}
  if(b.dataset.plan){const id=b.dataset.plan,was=(state.weeks[selectedWeek]||[]).includes(id);if(commit(togglePlan(state,selectedWeek,id)))toast(was?'선택한 주에서 뺐어요. 학습 기록은 유지돼요.':'선택한 주 계획에 담았어요.');return;}
  if(b.dataset.complete){const id=b.dataset.complete,done=itemState(state,id).status==='done';if(commit(setItem(state,id,{status:done?'studying':'done'})))toast(done?'공부 중으로 변경했어요.':'완료했어요. 수고했어요!');return;}
  if(b.dataset.copy){try{await navigator.clipboard.writeText(itemState(state,b.dataset.copy).document);toast('문서 위치를 복사했어요.');}catch{openEditor(b.dataset.copy);toast('복사가 제한되어 있어요. 문서 위치를 직접 복사해주세요.');}}
});
function exportBackup(){const raw=blocked&&originalRaw?originalRaw:JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2),blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`itaelan-study-${dateKey(new Date())}${blocked?'-original':''}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('백업 파일을 저장했어요.');}
$('#export-btn').addEventListener('click',exportBackup);$('#before-import-export').addEventListener('click',exportBackup);
$('#import-btn').addEventListener('click',()=>$('#import-file').click());
$('#import-file').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>5*1024*1024)throw new Error('5MB 이하의 학습 계획 백업 파일을 선택해주세요.');pendingImport=normalizeState(JSON.parse(await f.text()),baseIds,aliases);$('#import-description').textContent=`기록 ${Object.keys(pendingImport.items).length}개, 주간 계획 ${Object.keys(pendingImport.weeks).length}개, 개인 항목 ${pendingImport.custom.length}개를 불러옵니다.`;$('#import-dialog').showModal();}catch(error){toast(error instanceof SyntaxError?'JSON 백업 파일을 읽을 수 없어요.':error.message);}finally{e.target.value='';}});
$('#confirm-import').addEventListener('click',()=>{if(!pendingImport)return;const merged=mergeState(state,pendingImport);if(commit(merged,{recover:true})){$('#import-dialog').close();pendingImport=null;toast('백업을 현재 계획과 합쳤어요.');}});
window.addEventListener('storage',e=>{if(e.key!==STORAGE_KEY)return;try{state=e.newValue?normalizeState(JSON.parse(e.newValue),baseIds,aliases):emptyState();blocked=false;$('#storage-error').hidden=true;render();toast($('#editor').open?'다른 탭의 변경을 반영했어요. 열린 편집 내용은 저장할 때 적용돼요.':'다른 탭의 변경을 반영했어요.');}catch{toast('다른 탭에서 변경한 데이터를 읽지 못했어요.');}});
function activeNav(){document.querySelectorAll('.nav-item[href^="#"]').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===(location.hash==='#roadmap'?'#roadmap':'#weekly')));$('.breadcrumb strong').textContent=location.hash==='#roadmap'?'전체 로드맵':'주간 계획';}
window.addEventListener('hashchange',activeNav);
$('.sidebar-bottom').classList.add('mobile-storage');
activeNav();render();
