const fs=require('fs');const T='/tmp/claude-0/-home-user-daeyang-pnt/2033b4cc-c1d6-564d-aabd-aad9c8c77bed/scratchpad/';const XLSX=require(T+'nm/node_modules/xlsx');const JSZip=require(T+'nm/node_modules/jszip');
global.window=global;global.self=global;
new Function('window','self',fs.readFileSync('/home/user/daeyang-pnt/manager/msds-frm.js','utf8')).call(global,global,global);
require('/home/user/daeyang-pnt/manager/msds-gen.js');
const G=global.DY_MSDS_GEN;
const P=JSON.parse(fs.readFileSync('/tmp/claude-0/zip1/products.json'));
const S=JSON.parse(fs.readFileSync('/home/user/daeyang-pnt/manager/msds-substances.json'));const subs={};for(const c in S)subs[c]=Object.assign({cas:c},S[c]);
const mats={};for(const m of JSON.parse(fs.readFileSync('/tmp/claude-0/gdata/materials.json')))mats[m.key]=m.cas; mats[G.nkey('YELLOW P261')]='31837-42-0';
const tpl=fs.readFileSync('/home/user/daeyang-pnt/manager/msds-template.xlsx');
(async()=>{
 const items=P[process.env.K].items.map(x=>({no:String(x[0]),raw:x[1],val:x[2]}));
 const prep=G.prepare(items,mats,{bases:{},name:process.env.NM});
 const res=await G.generate(tpl,{code:process.env.CODE,name:process.env.NM,no:process.env.NO,rows:prep.rows,carc:'auto',rangeOverride:prep.rangeOverride},subs,JSZip);
 const mj=DY_MSDS_FRM.parse(res.bytes,XLSX), mp=DY_MSDS_FRM.parse(new Uint8Array(fs.readFileSync(process.env.F)),XLSX);
 const a=JSON.stringify(mj),b=JSON.stringify(mp); console.log('same?',a===b, prep.unknown);
 if(a!==b){const x=JSON.stringify(mj,null,1).split('\n'),y=JSON.stringify(mp,null,1).split('\n');for(let i=0;i<Math.max(x.length,y.length);i++)if(x[i]!==y[i]){console.log(i,'JS',x[i],'\nPY',y[i]);break;}}
})();
