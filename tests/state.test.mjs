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
test('Concept roadmap keeps unique IDs, removes OS branches and maps every original item',async()=>{
  const context={window:{}};vm.runInNewContext(await readFile(new URL('../roadmap-data.js',import.meta.url),'utf8'),context);
  const root=context.window.ROADMAP_DATA.root,nodes=flatten(root);
  assert.equal(nodes.length,context.window.ROADMAP_DATA.total);assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length);
  assert.deepEqual(Array.from(root.children,n=>n.title),['네트워크 구성','서비스','보안']);
  assert.ok(nodes.some(n=>n.title==='OSPF'));assert.ok(nodes.some(n=>n.title==='DHCP'));assert.ok(nodes.some(n=>n.title==='Auth-Proxy'));
  const ids=new Set(nodes.map(n=>n.id)),aliases=context.window.ROADMAP_DATA.aliases;
  assert.equal(nodes.length,164);assert.equal(nodes.length+Object.keys(aliases).length,233);
  assert.ok(nodes.every(n=>!/Debian|Window|Cisco Router|IIS|Apache2|Nginix/.test(n.title)));
  for(const [oldId,target] of Object.entries(aliases)){assert.ok(!ids.has(oldId));assert.ok(ids.has(target));}
  const ca=nodes.find(n=>n.title==='인증서 · PKI');assert.deepEqual(Array.from(ca.children,n=>n.title),['Root CA','Sub CA']);
});
test('Old OS-specific records migrate without losing separate documents or plans',()=>{
  const raw={version:1,items:{win:{status:'done',action:'Windows action',document:'C:/DHCP.docx'},deb:{status:'review',action:'Debian action',url:'https://www.notion.so/debian'}},weeks:{'2026-09-07':['win','deb'],'2026-09-14':['deb']},custom:[]};
  const aliases={win:'dhcp',deb:'dhcp'},migrated=normalizeState(raw,['dhcp'],aliases);
  assert.deepEqual(migrated.weeks,{'2026-09-07':['dhcp'],'2026-09-14':['dhcp']});
  assert.equal(migrated.items.dhcp.status,'review');
  assert.equal(migrated.items.dhcp.document,'C:/DHCP.docx');assert.equal(migrated.items.dhcp.url,'');
  assert.equal(migrated.archive.win.action,'Windows action');assert.equal(migrated.archive.deb.url,'https://www.notion.so/debian');
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(migrated)),['dhcp'],aliases),migrated);
  assert.deepEqual(mergeState(emptyState(),migrated).archive,migrated.archive);
});
test('An incomplete legacy branch does not turn a merged concept into completed',()=>{
  const raw={version:1,items:{win:{status:'done'},deb:{status:'todo'}},weeks:{},custom:[]};
  assert.equal(normalizeState(raw,['dns'],{win:'dns',deb:'dns'}).items.dns.status,'studying');
});
