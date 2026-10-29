const {chromium}=require('./nm/node_modules/playwright-core');
const http=require('http'),fs=require('fs'),path=require('path');
const root='/tmp/claude-0/uitest';
const mats=JSON.parse(fs.readFileSync('/tmp/claude-0/gdata/materials.json')).filter(m=>m.key!=='E-12').map(m=>({key:m.key,name:m.key,cas:m.cas}));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const srv=http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(d);});});
srv.listen(0,async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1100,height:1400}}); const pg=await ctx.newPage();
 pg.on('console',m=>console.log('console:',m.type(),m.text())); pg.on('requestfailed',q=>console.log('fail',q.url())); pg.on('response',r=>{if(r.status()>=400)console.log(r.status(),r.url())}); pg.on('pageerror',e=>console.log('pageerror',e.message));
 await pg.addInitScript(m=>{window.TEST_MATS=m;},mats);
 await pg.goto(`http://localhost:${srv.address().port}/manager/test.html`);
 await pg.evaluate(()=>START());
 const save=async n=>{await pg.screenshot({path:`/tmp/claude-0/uitest/${n}.png`,fullPage:true});};
 // 1) BE226 (E-12 미등록) .xls 원본
 await pg.setInputFiles('input[type=file]','/tmp/claude-0/zip1/x/BE226 30691(MC) #Uc720#Uad11.xls');
 await pg.waitForTimeout(500); await save('a1');
 console.log('unknown boxes:',await pg.locator('h3').allTextContents(), 'gen disabled', await pg.locator('button:has-text("엑셀·PDF")').isDisabled());
 await pg.fill('input[placeholder^="CAS 번호"]','25036-25-3'); await pg.click('button:has-text("원료 사전에 저장")'); await pg.waitForTimeout(300);
 console.log('saved',await pg.evaluate(()=>JSON.stringify(SAVED)), 'gen disabled', await pg.locator('button:has-text("엑셀·PDF")').isDisabled());
 await pg.fill('input[placeholder^="예: 174"]','140');
 const dls=[]; pg.on('download',d=>dls.push(d));
 await pg.click('button:has-text("엑셀·PDF")');
 for(let i=0;i<60;i++){const t=await pg.locator('.a-msg').allTextContents(); if(/만들었습니다|못했습니다/.test(t.join())) break; if(i%10==0) console.log('wait',t); await pg.waitForTimeout(1000);}
 console.log('msg:',await pg.locator('.a-msg').last().textContent());
 await pg.waitForTimeout(1000);
 for(const d of dls){const p=`/tmp/claude-0/uitest/out_${d.suggestedFilename()}`; await d.saveAs(p); console.log('download',d.suggestedFilename(),fs.statSync(p).size);}
 await save('a2');
 // 2) POWDER 제품 + 베이스 업로드
 await pg.setInputFiles('input[type=file] >> nth=0','/tmp/claude-0/zip1/x/'+fs.readdirSync('/tmp/claude-0/zip1/x').find(f=>f.startsWith('BK015 BLACK(D)')));
 await pg.waitForTimeout(500);
 console.log('unknown2:',await pg.locator('.a-card--gap strong').allTextContents());
 await pg.setInputFiles('.a-card--gap input[type=file]','/tmp/claude-0/pw/black.xls'); await pg.waitForTimeout(500);
 console.log('rows:',await pg.locator('tbody tr').count(), 'gen disabled', await pg.locator('button:has-text("엑셀·PDF")').isDisabled());
 console.log(await pg.locator('tbody').innerText());
 await save('b1');
 await b.close(); srv.close();
});
