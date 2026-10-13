const fs=require('fs');const XLSX=require('./nm/node_modules/xlsx');global.window=global;global.self=global;
new Function('window','self',fs.readFileSync('/home/user/daeyang-pnt/manager/msds-frm.js','utf8')+'\n').call(global,global,global);
console.log(JSON.stringify(global.DY_MSDS_FRM.parse(new Uint8Array(fs.readFileSync(process.argv[2])),XLSX),null,1));
