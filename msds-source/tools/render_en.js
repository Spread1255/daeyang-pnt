const {chromium}=require('./nm/node_modules/playwright-core');
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'web');
const [XLSX_IN,OUT,NAME,CODE,NO]=process.argv.slice(2);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const srv=http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));
 fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(d);});});
srv.listen(0,async()=>{
 const port=srv.address().port;
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const pg=await b.newPage();
 await pg.route(/cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard.*pretendard\.css/,rt=>rt.fulfill({status:200,contentType:'text/css',body:'/* local */'}));
 await pg.goto(`http://localhost:${port}/manager/index.html`);
 const res=await pg.evaluate(async([xf,name,code,no])=>{
   const dict=await (await fetch('../ko_en.json')).json();
   const buf=new Uint8Array(await (await fetch('../'+xf)).arrayBuffer());
   const model=DY_MSDS_FRM.parse(buf,XLSX);
   const miss=new Set();
   const tr=s=>{ if(typeof s!=='string'||!/[가-힣]/.test(s)) return s; const k=s.trim(); if(dict[k]!==undefined) return dict[k]; miss.add(k); return s; };
   const walk=x=>{ if(Array.isArray(x)) return x.map(walk); if(x&&typeof x==='object'){ for(const k of Object.keys(x)) x[k]=walk(x[k]); return x;} return tr(x); };
   walk(model);
   const blob=await DY_MSDS_FRM_EN.toPdf(model,{name,code,msdsNo:no});
   const ab=new Uint8Array(await blob.arrayBuffer()); let s=''; for(let i=0;i<ab.length;i+=0x8000) s+=String.fromCharCode.apply(null,ab.subarray(i,i+0x8000));
   return {pdf:btoa(s),miss:[...miss]};
 },[XLSX_IN,NAME,CODE,NO]);
 fs.writeFileSync(OUT,Buffer.from(res.pdf,'base64'));
 console.log('missing translations:',JSON.stringify(res.miss));
 await b.close(); srv.close();
});
