import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {weekKey,shiftWeek,flatten,normalizeState,emptyState,togglePlan,setItem,itemState,mergeState,safeURL} from '../state.js';
test('Monday weeks correctly cross year and leap-day boundaries',()=>{
  assert.equal(weekKey(new Date('2026-09-13T12:00:00')),'2026-09-07');
  assert.equal(weekKey(new Date('2026-01-01T12:00:00')),'2025-12-29');
  assert.equal(shiftWeek('2025-12-29',1),'2026-01-05');
  assert.equal(shiftWeek('2024-02-26',1),'2024-03-04');
});
test('Removing a weekly selection preserves progress and linked document',()=>{
  let state=setItem(emptyState(),'dns',{status:'review',document:'Debian/DNS.docx',action:'Verify lookup'});
  state=togglePlan(state,'2026-09-07','dns');
  state=togglePlan(state,'2026-09-14','dns');
  state=togglePlan(state,'2026-09-07','dns');
  assert.deepEqual(state.weeks['2026-09-07'],[]);
  assert.deepEqual(state.weeks['2026-09-14'],['dns']);
  assert.equal(itemState(state,'dns').document,'Debian/DNS.docx');
  assert.equal(itemState(state,'dns').status,'review');
});
test('Backup round trip preserves study records, custom items and independent weeks',()=>{
  let state=emptyState();state.custom.push({id:'custom-123',title:'정리',category:'개인 계획'});
  state=setItem(state,'dns',{status:'studying',action:'DNS 테스트',url:'https://example.com/doc',document:'DNS.docx',due:'2026-09-10'});
  state=togglePlan(state,'2026-09-07','dns');state=togglePlan(state,'2026-09-14','custom-123');
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state)),['dns']),state);
});
test('Untrusted backup validates identifiers, duplicates, dates, statuses and URL schemes',()=>{
  const raw=JSON.parse('{"version":1,"items":{"dns":{"status":"__proto__","url":"javascript:alert(1)","due":"2026-02-31"},"__proto__":{"status":"done"},"unknown":{"status":"done"}},"weeks":{"2026-09-07":["dns","dns","unknown"],"2026-09-08":["dns"]},"custom":[{"id":"dns","title":"Collision"},{"id":"custom-1","title":"New","category":"other"},{"id":"custom-1","title":"Duplicate"}]}');
  const result=normalizeState(raw,['dns']);
  assert.equal(result.items.dns.status,'todo');assert.equal(result.items.dns.url,'');assert.equal(result.items.dns.due,'');
  assert.equal(Object.hasOwn(result.items,'__proto__'),false);assert.equal(Object.hasOwn(result.items,'unknown'),false);
  assert.deepEqual(result.weeks,{'2026-09-07':['dns']});assert.equal(result.custom.length,1);assert.equal(result.custom[0].category,'개인 계획');
  assert.equal(safeURL('file:///C:/Documents/test.docx'),'');assert.equal(safeURL('data:text/html,<script>alert(1)</script>'),'');
  assert.throws(()=>normalizeState({version:2},[]));
});
test('Merge retains existing plans while updating matching records from backup',()=>{
  const current={version:1,items:{dns:{status:'todo'},dhcp:{status:'done'}},weeks:{'2026-09-07':['dns']},custom:[]};
  const incoming={version:1,items:{dns:{status:'review'}},weeks:{'2026-09-07':['dns','dhcp'],'2026-09-14':['dns']},custom:[]};
  const merged=mergeState(current,incoming);
  assert.equal(merged.items.dhcp.status,'done');assert.equal(merged.items.dns.status,'review');
  assert.deepEqual(merged.weeks['2026-09-07'],['dns','dhcp']);assert.deepEqual(merged.weeks['2026-09-14'],['dns']);
});
test('Full original roadmap retains stable unique IDs and category paths',async()=>{
  const context={window:{}};vm.runInNewContext(await readFile(new URL('../roadmap-data.js',import.meta.url),'utf8'),context);
  const root=context.window.ROADMAP_DATA.root,nodes=flatten(root);
  assert.equal(nodes.length,context.window.ROADMAP_DATA.total);assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length);
  assert.deepEqual(Array.from(root.children,n=>n.title),['네트워크 구성','서비스','보안']);
  assert.ok(nodes.some(n=>n.title==='OSPF'));assert.ok(nodes.some(n=>n.title==='DHCP'));assert.ok(nodes.some(n=>n.title==='Auth-Proxy'));
});
