import { mkdir, copyFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
await mkdir(new URL('dist/', root), {recursive:true});
for (const file of ['index.html','style.css','script.js','state.js','roadmap-data.js','icon.svg']) {
  await copyFile(new URL(file, root),new URL('dist/'+file,root));
}
console.log('Study planner built to dist.');
