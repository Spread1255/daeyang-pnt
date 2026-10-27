const {chromium}=require('./nm/node_modules/playwright-core');
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'web'); const OUT='/tmp/claude-0/out3/MSDS';
const res=JSON.parse(fs.readFileSync('/tmp/claude-0/out3/result.json','utf8')).filter(r=>r.file);
const mime={'.html':'text/html','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png'};
const srv=http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));
 fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(d);});});
srv.listen(0,async()=>{
 const port=srv.address().port;
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const pg=await b.newPage();
 await pg.route(/cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard.*pretendard\.css/,rt=>rt.fulfill({status:200,contentType:'text/css',body:'/* local */'}));
 await pg.goto(`http://localhost:${port}/manager/index.html`);
 for(const [i,r] of res.entries()){
   const t0=Date.now();
   fs.copyFileSync(path.join(OUT,r.file+'.xlsx'),path.join(root,'batch','cur.xlsx'));
   const b64=await pg.evaluate(async([name,code,no])=>{
     const buf=new Uint8Array(await (await fetch('../batch/cur.xlsx?'+Math.random())).arrayBuffer());
     const model=DY_MSDS_FRM.parse(buf,XLSX);
     const blob=await DY_MSDS_FRM.toPdf(model,{name,code,msdsNo:no});
     const ab=new Uint8Array(await blob.arrayBuffer()); let s=''; for(let i=0;i<ab.length;i+=0x8000) s+=String.fromCharCode.apply(null,ab.subarray(i,i+0x8000));
     return btoa(s);},[r.name,r.code,r.no]);
   fs.writeFileSync(path.join(OUT,r.file+'.pdf'),Buffer.from(b64,'base64'));
   console.log(i+1,'/',res.length,r.file,((Date.now()-t0)/1000).toFixed(1)+'s');
 }
 await b.close(); srv.close();
});
