const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
http.createServer((req,res)=>{let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html'}catch{res.writeHead(400);return res.end()}
if(!['index.html','style.css','engine.js','game.js'].includes(name)){res.writeHead(404);return res.end('Not found')}
fs.readFile(path.join(__dirname,name),(err,data)=>{if(err){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':types[path.extname(name)],'Cache-Control':'no-store'});res.end(data)});
}).listen(4173,'127.0.0.1',()=>console.log('Arcade ready: http://localhost:4173'));
