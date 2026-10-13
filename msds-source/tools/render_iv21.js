const {chromium}=require('./nm/node_modules/playwright-core');
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'web');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.xlsx':'application/octet-stream'};
const srv=http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));
 fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(d);});});
srv.listen(0,async()=>{
 const port=srv.address().port;
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}).catch(async()=>chromium.launch({args:['--no-sandbox']}));
 const pg=await b.newPage();
 await pg.route(/cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard.*pretendard\.css/,async rt=>{
   const css='/* local Pretendard */';
   rt.fulfill({status:200,contentType:'text/css',body:css});});
 pg.on('requestfailed',q=>console.log('fail',q.url())); pg.on('response',r=>{if(r.status()>=400)console.log(r.status(),r.url())});
 await pg.goto(`http://localhost:${port}/manager/index.html`);
 const b64=await pg.evaluate(async()=>{
   const buf=new Uint8Array(await (await fetch('../iv021.xlsx')).arrayBuffer());
   const model=DY_MSDS_FRM.parse(buf,XLSX);
   const blob=await DY_MSDS_FRM.toPdf(model,{name:'내장형 D-30871 유광',code:'DY#1-IV021',msdsNo:'AA14944-0000000103'});
   const ab=new Uint8Array(await blob.arrayBuffer()); let s=''; for(let i=0;i<ab.length;i+=0x8000) s+=String.fromCharCode.apply(null,ab.subarray(i,i+0x8000));
   return btoa(s);});
 fs.writeFileSync('DY#1-IV021 D-30871 유광 MSDS.pdf',Buffer.from(b64,'base64'));
 await b.close(); srv.close(); console.log('ok');
});
