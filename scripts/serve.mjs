import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const allowed = ['index.html','style.css','script.js','planner-state.js','legacy-migration.js','legacy-state.js','legacy-catalog.js','icon.svg'];
const types = {html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',svg:'image/svg+xml'};
createServer(async(req,res)=>{
  const file = new URL(req.url,'http://localhost').pathname.slice(1) || 'index.html';
  if (!allowed.includes(file)) {res.writeHead(404);res.end('Not found');return;}
  try {const body=await readFile(new URL('../'+file,import.meta.url));res.writeHead(200,{'Content-Type':types[file.split('.').pop()]});res.end(body);}
  catch {res.writeHead(500);res.end('Unable to load page');}
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
