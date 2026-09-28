// unit test of the two pure helpers, extracted from app.js by name
const fs=require('fs'); const path=require('path'); const REPO=process.argv[2] || path.resolve(__dirname, '..'); const src=fs.readFileSync(path.join(REPO,'app.js'),'utf8');
const grab=(name)=>{ const i=src.indexOf('function '+name+'('); let depth=0,j=src.indexOf('{',i); for(let k=j;k<src.length;k++){ if(src[k]==='{')depth++; else if(src[k]==='}'){depth--; if(!depth) return src.slice(i,k+1);} } };
eval(grab('fmt')+grab('fmtDate')+grab('escapeHtml')+grab('fmtLedgerDate'));
const out={ neg:fmt(-8), pos:fmt(1234.5), zero:fmt(0), str:fmt("-1.25"), nan:fmt("x"),
  serverDate:fmtLedgerDate("Wed Sep 23 2026 10:48:00 GMT-0500 (Central Daylight Time)"),
  clientDate:fmtLedgerDate("Sep 23, 2026 10:48 AM"), junk:fmtLedgerDate("<not a date>"), empty:fmtLedgerDate(undefined) };
console.log(JSON.stringify(out,null,1));
if(out.neg!=="-$8.00"||out.pos!=="$1,234.50"||out.zero!=="$0.00"||out.str!=="-$1.25"||out.nan!=="$0.00") { console.log("FAIL fmt"); process.exit(1); }
if(!/^Sep 23, 2026/.test(out.serverDate)||out.junk!=="&lt;not a date&gt;"||out.empty!=="") { console.log("FAIL date"); process.exit(1); }
console.log("helpers PASS");
