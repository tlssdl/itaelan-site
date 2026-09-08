import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,normalizeState,saveTask,updateTask,filterTasks,mergeState,weekKey,shiftDate,safeURL} from '../planner-state.js';
import {migrateLegacy} from '../legacy-migration.js';
import catalog from '../legacy-catalog.js';

test('Independent tasks may share a title without sharing dates or progress',()=>{
  let state=saveTask(emptyState(),{id:'task-1',title:'DHCP 복습',date:'2026-09-08'});
  state=saveTask(state,{id:'task-2',title:'DHCP 복습',date:'2026-09-09'});
  state=updateTask(state,'task-1',{status:'done'});
  assert.equal(state.tasks[0].status,'done');assert.equal(state.tasks[1].status,'todo');
  assert.equal(filterTasks(state,{view:'week',week:'2026-09-07',day:'2026-09-09'}).length,1);
});
test('Moving a date changes week membership; an empty date moves to later plans',()=>{
  let state=saveTask(emptyState(),{id:'task-1',title:'실습',date:'2026-09-08',category:'나만의 분류'});
  state=updateTask(state,'task-1',{date:'2026-09-21'});
  assert.equal(filterTasks(state,{view:'week',week:'2026-09-07'}).length,0);
  assert.equal(filterTasks(state,{view:'week',week:'2026-09-21'}).length,1);
  state=updateTask(state,'task-1',{date:''});assert.equal(filterTasks(state,{view:'unscheduled'}).length,1);
  assert.equal(filterTasks(state,{view:'all',query:'나만의 분류'}).length,1);
});
test('Trash is reversible and preserves notes and document links',()=>{
  const state=saveTask(emptyState(),{id:'task-1',title:'학습',action:'이어서 하기',url:'https://www.notion.so/study'});
  const deleted=updateTask(state,'task-1',{deleted:true});assert.equal(filterTasks(deleted,{view:'all'}).length,0);assert.equal(filterTasks(deleted,{view:'trash'}).length,1);
  assert.deepEqual(updateTask(deleted,'task-1',{deleted:false}),state);
});
test('Backup round trip, deduplication, merge and unsafe content validation',()=>{
  const state=saveTask(emptyState(),{id:'task-1',title:'자유 계획',category:'Debian',date:'2026-09-08',document:'C:/study.docx',priorRecords:[{title:'기록',action:'내용',url:'https://example.com'}]});
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))),state);
  const incoming=saveTask(emptyState(),{id:'task-1',title:'수정한 제목',date:'2026-09-09'});
  assert.equal(mergeState(state,incoming).tasks.length,1);assert.equal(mergeState(state,incoming).tasks[0].title,'수정한 제목');
  const malicious=normalizeState({version:2,tasks:[{id:'task-x',title:'<img onerror="alert(1)">',url:'javascript:alert(1)',date:'2026-02-31',status:'__proto__'},{id:'task-x',title:'중복'}]});
  assert.equal(malicious.tasks.length,1);assert.equal(malicious.tasks[0].url,'');assert.equal(malicious.tasks[0].date,'');assert.equal(malicious.tasks[0].status,'todo');
  assert.equal(safeURL('file:///C:/secret'),'');assert.throws(()=>normalizeState({version:2}));
});
test('Week arithmetic covers year boundaries and leap days',()=>{
  assert.equal(weekKey(new Date('2026-01-01T12:00:00')),'2025-12-29');assert.equal(shiftDate('2024-02-28',1),'2024-02-29');assert.equal(shiftDate('2025-12-29',7),'2026-01-05');
});
test('Empty legacy data does not populate a catalog of predefined tasks',()=>{
  assert.deepEqual(migrateLegacy({version:1,items:{},weeks:{},custom:[]}),emptyState());
});
test('Legacy selected weeks and separate source records survive migration and repeat imports',()=>{
  const oldId='FMID_1596180124FM',id=catalog.aliases[oldId];
  const raw={version:1,items:{[oldId]:{status:'review',action:'DNS 확인',document:'Debian DNS',url:'https://www.notion.so/dns'}},weeks:{'2026-09-07':[oldId],'2026-09-14':[oldId]},custom:[{id:'custom-note',title:'필기 정리',category:'개인 계획'}]};
  const migrated=migrateLegacy(raw);assert.equal(migrated.tasks.length,3);
  const dns=migrated.tasks.filter(t=>t.id.includes(id));assert.equal(dns.length,2);assert.equal(dns[0].title,'DNS');assert.equal(dns[0].status,'review');
  assert.equal(dns[0].priorRecords[0].action,'DNS 확인');assert.equal(dns[0].url,'https://www.notion.so/dns');assert.notEqual(dns[0].date,dns[1].date);
  assert.deepEqual(mergeState(migrated,migrateLegacy(raw)),migrated);
});
