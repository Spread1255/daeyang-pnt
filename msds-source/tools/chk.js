const fs=require('fs');const XLSX=require('./nm/node_modules/xlsx');
global.window=global;global.self=global;
const src=fs.readFileSync('/home/user/daeyang-pnt/manager/msds-frm.js','utf8');
new Function('window','self',src+'\n').call(global,global,global);
const F=global.DY_MSDS_FRM;
for(const f of process.argv.slice(2)){
  const m=F.parse(new Uint8Array(fs.readFileSync(f)),XLSX);
  const s3=m.sections.find(s=>s.num===3);
  console.log(f.split('/').pop(),'sections:',m.sections.map(s=>s.num).join(','));
  console.log(JSON.stringify(s3.blocks.filter(b=>b.type==='table')[0].rows.map(r=>[r.name.slice(0,22),r.cas,r.pct])));
  console.log('ghs/H:',JSON.stringify(m.ghs||m.pictograms||null), Object.keys(m).join(','));
}
