const fs=require('fs'),vm=require('vm');const c=vm.createContext({});
vm.runInContext(fs.readFileSync('/home/user/workspace/parcheban/js/00-core.js','utf8'),c);
const J=c.Jalali;
const fmt=new Intl.DateTimeFormat('en-u-ca-persian-nu-latn',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'UTC'});
let fwd=0,rev=0,n=0,ex=[];
for(let y=1350;y<=1450;y++)for(let m=1;m<=12;m++){const dm=J.monthDays(y,m);for(let d=1;d<=dm;d++){
  n++;const s=J.format(y,m,d);const g=J.toGregorian(y,m,d);
  const gu=new Date(Date.UTC(g.getFullYear(),g.getMonth(),g.getDate()));
  const o={};fmt.formatToParts(gu).forEach(p=>o[p.type]=p.value);
  const intl=o.year+'/'+o.month+'/'+o.day;
  if(intl!==s){fwd++;if(ex.length<4)ex.push('FWD '+s+' -> '+gu.toISOString().slice(0,10)+' intl='+intl);}
  const b=J.fromDate(g);
  if(J.format(b[0],b[1],b[2])!==s){rev++;if(ex.length<8)ex.push('REV '+s+' -> '+J.format(b[0],b[1],b[2]));}
}}
console.log('days tested: '+n);
console.log('forward (jalali->greg vs Intl) mismatches: '+fwd);
console.log('reverse (greg->jalali round-trip) mismatches: '+rev);
if(ex.length)console.log(ex.join('\n'));
