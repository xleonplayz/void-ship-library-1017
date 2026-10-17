import http from 'node:http';
import fs from 'node:fs';
const release = 3;
const directory = process.env.DATA_DIR || './ship-data';
const indexHtml = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Fieldnotes Library</title><style>body{font:18px system-ui;color:#203c39;background:#f4f0e7;max-width:860px;margin:5vh auto;padding:24px}h1{font-size:52px}main{display:grid;grid-template-columns:1fr 1fr;gap:24px}section{padding:24px;background:white;border-radius:12px}label{display:block;margin:16px 0}input,textarea,button{font:inherit;width:100%;box-sizing:border-box;padding:12px}button{background:#245c4c;color:white;border:0;border-radius:6px;cursor:pointer}li{padding:12px 0}a{color:#245c4c}#result{min-height:44px}small{letter-spacing:2px}@media(max-width:650px){main{grid-template-columns:1fr}}</style></head><body><small>FIELDNOTES / RELEASE ${release}</small><h1>Eine kleine Bibliothek.</h1><p>Notizen ablegen, wieder öffnen und als Text herunterladen.</p><main><section><h2>Neue Notiz</h2><form id="note"><label>Titel<input id="title" required maxlength="80" value="Versandliste"></label><label>Text<textarea id="text" required rows="5">Zwei Farne für das Nordfenster.</textarea></label><button>Notiz speichern</button></form><p id="result">Bereit</p></section><section><h2>Ablage</h2><ul id="notes"></ul><button id="refresh">Neu laden</button></section></main><script src="/app.js"></script></body></html>`;
const appJs = `async function refresh(){const response=await fetch('/api/notes');const data=await response.json();const list=document.querySelector('#notes');list.replaceChildren();if(!response.ok)throw new Error(data.error);for(const note of data.notes){const row=document.createElement('li');const link=document.createElement('a');link.textContent=note.title;link.href='/download/'+note.id;row.append(link);list.append(row);}}document.querySelector('#note').addEventListener('submit',async event=>{event.preventDefault();const result=document.querySelector('#result');try{const response=await fetch('/api/notes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:document.querySelector('#title').value,text:document.querySelector('#text').value})});const data=await response.json();if(!response.ok)throw new Error(data.error);result.textContent='Gespeichert: '+data.id;await refresh();}catch(error){result.textContent='Fehler: '+error.message;}});document.querySelector('#refresh').addEventListener('click',()=>refresh().catch(error=>document.querySelector('#result').textContent='Fehler: '+error.message));refresh().catch(error=>document.querySelector('#result').textContent='Fehler: '+error.message);`;
function reply(res,status,value,headers={}){res.writeHead(status,{'content-type':'application/json',...headers});res.end(JSON.stringify(value));}
function file(id){if(!/^[0-9]+$/.test(id))throw new Error('invalid id');return directory+'/'+id+'.json';}
function readBody(req){return new Promise((resolve,reject)=>{let body='';req.on('data',part=>{body+=part;if(body.length>8192)reject(new Error('body too large'));});req.on('end',()=>resolve(body));req.on('error',reject);});}
http.createServer(async(req,res)=>{
 console.info('ship-library',req.method,req.url);
 try{
  if(req.url==='/'&&req.method==='GET'){res.writeHead(200,{'content-type':'text/html;charset=utf-8'});res.end(indexHtml);return;}
  if(req.url==='/app.js'){res.writeHead(200,{'content-type':'application/javascript'});res.end(appJs);return;}
  if(req.url==='/health'){reply(res,200,{ok:true,release,service:'fieldnotes'});return;}
  if(req.url==='/probe/parse'){const data=JSON.parse(await readBody(req));reply(res,200,{title:data.title,text:data.text});return;}
  if(req.url==='/probe/parse-summary'){const data=JSON.parse(await readBody(req));reply(res,200,{title:data.title,textChars:data.text.length});return;}
  if(req.url==='/probe/raw'){const body=await readBody(req);reply(res,200,{chars:body.length});return;}
  if(req.url==='/probe/fs-paths'){
   const results=[];
   for(const base of ['./ship-data','/data/ship-library','/tmp/ship-library']){
    try{fs.mkdirSync(base,{recursive:true});fs.writeFileSync(base+'/probe.txt','fern','utf8');results.push({path:base,text:fs.readFileSync(base+'/probe.txt','utf8')});}
    catch(error){results.push({path:base,error:String(error)});}
   }
   reply(res,200,{results});return;
  }
  if(req.url==='/probe/fs-read'){
   const results=[];
   for(const base of ['./ship-data','/data/ship-library','/tmp/ship-library']){
    try{results.push({path:base,text:fs.readFileSync(base+'/probe.txt','utf8')});}
    catch(error){results.push({path:base,error:String(error)});}
   }
   reply(res,200,{results});return;
  }
  if(req.url==='/probe/clock'){reply(res,200,{id:String(Date.now())});return;}
  if(req.url==='/probe/mkdir'){fs.mkdirSync(directory,{recursive:true});reply(res,200,{created:true,exists:fs.existsSync(directory)});return;}
  if(req.url==='/probe/write'){fs.writeFileSync(directory+'/probe.txt','fern','utf8');reply(res,200,{written:true});return;}
  if(req.url==='/probe/read'){const text=fs.readFileSync(directory+'/probe.txt','utf8');reply(res,200,{text});return;}
  if(req.url==='/probe/list'){reply(res,200,{exists:fs.existsSync(directory),files:fs.readdirSync(directory)});return;}
  if(req.url==='/api/notes'&&req.method==='GET'){
   const files=fs.existsSync(directory)?fs.readdirSync(directory):[];
   const notes=files.filter(name=>/^[0-9]+\.json$/.test(name)).map(name=>JSON.parse(fs.readFileSync(directory+'/'+name,'utf8')));
   reply(res,200,{notes});return;
  }
  if(req.url==='/api/notes'&&req.method==='POST'){
   let data;try{data=JSON.parse(await readBody(req));}catch(error){reply(res,400,{error:'invalid JSON body'});return;}
   if(typeof data.title!=='string'||typeof data.text!=='string'||!data.title.trim()||data.title.length>80||data.text.length>4096){reply(res,422,{error:'title and text required; maximum 80/4096 characters'});return;}
   const id=String(Date.now());const note={id,title:data.title,text:data.text};
   fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(file(id),JSON.stringify(note),'utf8');
   reply(res,201,note,{'location':'/api/notes/'+id});return;
  }
  const matched=/^\/(api\/notes|download)\/([0-9]+)$/.exec(req.url);
  if(matched){
   const path=file(matched[2]);if(!fs.existsSync(path)){reply(res,404,{error:'note not found'});return;}
   if(req.method==='DELETE'&&matched[1]==='api/notes'){fs.unlinkSync(path);res.writeHead(204);res.end();return;}
   const note=JSON.parse(fs.readFileSync(path,'utf8'));
   if(matched[1]==='api/notes'){reply(res,200,note);return;}
   const etag='"note-'+note.id+'"';
   if(req.headers['if-none-match']===etag){res.writeHead(304,{'etag':etag});res.end();return;}
   const body=Buffer.from(note.text,'utf8');
   res.writeHead(200,{'content-type':'text/plain;charset=utf-8','content-length':body.length,'content-disposition':'attachment; filename="fieldnote-'+note.id+'.txt"','etag':etag});res.end(req.method==='HEAD'?undefined:body);return;
  }
  reply(res,404,{error:'not found'});
 }catch(error){console.error('ship-library-failure',String(error));reply(res,500,{error:'storage operation failed',detail:String(error)});}
}).listen(Number(process.env.PORT||3210),'0.0.0.0');
