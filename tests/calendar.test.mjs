import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDays,shiftMonth,emptyState,saveTask,normalizeState,filterTasks,updateTask} from '../planner-state.js';

test('Monthly grid spans complete Monday-Sunday weeks including leap days and year boundaries',()=>{
  assert.equal(shiftMonth('2026-12',1),'2027-01');assert.equal(shiftMonth('2026-01',-1),'2025-12');
  const leap=calendarDays('2024-02');assert.equal(leap[0],'2024-01-29');assert.equal(leap.at(-1),'2024-03-03');assert.ok(leap.includes('2024-02-29'));
  assert.equal(calendarDays('2021-02').length,28);assert.equal(calendarDays('2026-03').length,42);
  for(const month of ['2026-01','2024-02','2026-03','2026-12']){const days=calendarDays(month);assert.equal(days.length%7,0);assert.equal(new Set(days).size,days.length);assert.equal(new Date(days[0]+'T12:00:00').getDay(),1);assert.equal(new Date(days.at(-1)+'T12:00:00').getDay(),0);}
});
test('Calendar unifies study plans and appointments, sorted by time, omitting trash and undated items',()=>{
  let s=emptyState();for(const t of [{id:'a',title:'DNS 공부',date:'2026-09-08',time:'15:00'},{id:'b',title:'친구 약속',date:'2026-09-08',time:'10:00',location:'도서관'},{id:'c',title:'종일 일정',date:'2026-09-08'},{id:'d',title:'다음 달',date:'2026-10-01'},{id:'e',title:'미정'},{id:'f',title:'삭제',date:'2026-09-08',deleted:true}])s=saveTask(s,t);
  assert.deepEqual(filterTasks(s,{view:'calendar',month:'2026-09'}).map(t=>t.id),['c','b','a']);
  assert.deepEqual(filterTasks(s,{view:'calendar',month:'2026-09',query:'도서관'}).map(t=>t.id),['b']);
  assert.equal(filterTasks(s,{view:'calendar',month:'2026-09',day:'2026-09-09'}).length,0);
  s=updateTask(s,'a',{date:'2026-10-02'});assert.equal(filterTasks(s,{view:'calendar',month:'2026-10'}).length,2);
});
test('Time and place persist in backup; older entries remain all-day and invalid times are sanitized',()=>{
  const s=saveTask(emptyState(),{id:'a',title:'약속',date:'2026-09-08',time:'14:00',endTime:'15:30',location:'학교'});
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(s))),s);
  const old=normalizeState({version:2,tasks:[{id:'b',title:'기존 계획',date:'2026-09-08'}]});assert.equal(old.tasks[0].time,'');assert.equal(old.tasks[0].location,'');
  const invalid=saveTask(emptyState(),{id:'x',title:'시간',time:'25:00',endTime:'26:00'});assert.equal(invalid.tasks[0].time,'');assert.equal(invalid.tasks[0].endTime,'');
});
