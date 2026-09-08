import { mkdir, copyFile, rm } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
if (output.href !== root.href + 'dist/') throw new Error('Unexpected output directory');
await rm(output, {recursive:true,force:true});
await mkdir(new URL('dist/', root), {recursive:true});
for (const file of ['index.html','style.css','script.js','planner-state.js','legacy-migration.js','legacy-state.js','legacy-catalog.js','icon.svg']) {
  await copyFile(new URL(file, root),new URL('dist/'+file,root));
}
console.log('Study planner built to dist.');
