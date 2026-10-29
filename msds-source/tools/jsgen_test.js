const fs=require('fs');const XLSX=require('./nm/node_modules/xlsx');const JSZip=require('./nm/node_modules/jszip');
global.window=global;global.self=global;
new Function('window','self',fs.readFileSync('/home/user/daeyang-pnt/manager/msds-frm.js','utf8')).call(global,global,global);
require('/home/user/daeyang-pnt/manager/msds-gen.js');
const G=global.DY_MSDS_GEN;
const P=JSON.parse(fs.readFileSync('/tmp/claude-0/zip1/products.json'));
const subs={};for(const s of JSON.parse(fs.readFileSync('/tmp/claude-0/gdata/substances.json')))subs[s.cas]=s;
const mats={};for(const m of JSON.parse(fs.readFileSync('/tmp/claude-0/gdata/materials.json')))mats[m.key]=m.cas;
const tpl=fs.readFileSync('/home/user/daeyang-pnt/manager/msds-template.xlsx');
const baseOf=f=>G.readWorkOrder(new Uint8Array(fs.readFileSync(f)),XLSX)[0].items;
const BASE={'DY#1-BK015':'/tmp/claude-0/pw/black.xlsx','DY#1-GY014':'/tmp/claude-0/pw/gray.xlsx','DY#6-GY002':'/tmp/claude-0/hm/gy002.xlsx','DY#6-SI002':'/tmp/claude-0/hm/sibk.xlsx','DY#6-GD006':'/tmp/claude-0/hm/bk.xlsx','DY#6-GD007':'/tmp/claude-0/hm/bk.xlsx','DY#6-GY015':'/tmp/claude-0/hm/gy008.xlsx'};
const outDir='/tmp/claude-0/jsout'; fs.mkdirSync(outDir,{recursive:true});
(async()=>{
 let bad=0,n=0;
 for(const o of ['out1','out2','out3']) for(const r of JSON.parse(fs.readFileSync(`/tmp/claude-0/${o}/result.json`))){
  if(!r.file) continue; if(o==='out1'&&['DY#1-BE226','DY#2-WH001'].includes(r.code)) continue;
  const items=P[r.k].items.map(x=>({no:String(x[0]),raw:x[1],val:x[2]}));
  const bases={};
  if(BASE[r.code]){const i=items.findIndex(x=>!x.no||true)&&0; const idx=items.findIndex(x=>G.nkey(x.raw)==='POWDER'); bases[idx>=0?idx:0]=baseOf(BASE[r.code]);}
  const prep=G.prepare(items,mats,{bases,name:r.name});
  if(prep.unknown.length){console.log('UNKNOWN',r.code,prep.unknown);bad++;continue;}
  const res=await G.generate(tpl,{code:r.code,name:r.name,no:r.no,rows:prep.rows,carc:'auto',rangeOverride:prep.rangeOverride},subs,JSZip);
  fs.writeFileSync(`${outDir}/${r.file}.xlsx`,res.bytes);
  const mj=DY_MSDS_FRM.parse(res.bytes,XLSX), mp=DY_MSDS_FRM.parse(new Uint8Array(fs.readFileSync(`/tmp/claude-0/${o}/MSDS/${r.file}.xlsx`)),XLSX);
  const a=JSON.stringify(mj),b=JSON.stringify(mp); n++;
  const rowsSame=JSON.stringify(res.report.rows)===JSON.stringify(r.rows.map(x=>[x[0],x[1],x[2],x[3]]));
  if(a!==b||!rowsSame){bad++;
    let i=0;while(i<a.length&&a[i]===b[i])i++;
    console.log('DIFF',r.code,'rows',rowsSame,'\n  js:',a.slice(Math.max(0,i-150),i+150),'\n  py:',b.slice(Math.max(0,i-150),i+150));
    if(!rowsSame){console.log(JSON.stringify(res.report.rows));console.log(JSON.stringify(r.rows));}
  }
 }
 console.log('compared',n,'bad',bad);
})().catch(e=>{console.error(e);process.exit(1)});
