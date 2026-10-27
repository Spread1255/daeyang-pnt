const fs=require('fs');const XLSX=require('./nm/node_modules/xlsx');global.window=global;global.self=global;
new Function('window','self',fs.readFileSync('/home/user/daeyang-pnt/manager/msds-frm.js','utf8')+'\n').call(global,global,global);
const res=JSON.parse(fs.readFileSync('/tmp/claude-0/out1/result.json','utf8'));
const TPLCOMP={'에폭시 수지':'25036-25-3','벤조인':'119-53-9','폴리에틸렌(POLYETHYLENE)':'9002-88-4','Barite (Ba(SO4))':'13462-86-7','이산화티타늄':'13463-67-7','Limestone':'1317-65-3','산화철':'1309-37-1'};
for(const r of res){ if(!r.file) continue;
  const m=DY_MSDS_FRM.parse(new Uint8Array(fs.readFileSync('/tmp/claude-0/out1/MSDS/'+r.file+'.xlsx')),XLSX);
  const t=m.sections[2].blocks.find(b=>b.type==='table'); const cas=new Set(t.rows.map(x=>x.cas));
  const js=JSON.stringify(m); const stray=Object.entries(TPLCOMP).filter(([l,c])=>!cas.has(c)&&js.includes('"label":"'+l+'"')).map(x=>x[0]);
  const H=(JSON.stringify(m.sections[1]).match(/H\d{3}/g)||[]).join(' ');
  const ok=m.sections.length===16 && t.rows.length===r.rows.length && m.msdsNo===r.no && !stray.length;
  console.log(ok?'OK ':'XX ',r.no.slice(-3),r.code,'sec',m.sections.length,'rows',t.rows.length+'/'+r.rows.length,'no',m.msdsNo.slice(-3),H,stray.length?'STRAY:'+stray:'');
}
