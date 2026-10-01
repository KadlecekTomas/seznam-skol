import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isAllowedByRobots } from '../crawler/robots.ts';
export const UA = 'seznam-skol/0.2 (+https://github.com/KadlecekTomas/seznam-skol; public school contacts audit)';
export const hostKey = host => host.toLowerCase().replace(/^www\./u, '');
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export function safeUrl(value, base) {
  try { const u = new URL(value, base); if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || (u.port && !['80','443'].includes(u.port)) || isIP(u.hostname.replace(/[\[\]]/g,'')) || !u.hostname.includes('.') || /(^|\.)(localhost|local|internal|test|invalid)$/i.test(u.hostname)) return null;
    u.hash=''; for(const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(k)) u.searchParams.delete(k); return u.toString();
  } catch { return null; }
}
export function publicIp(address) {
  if (isIP(address) === 4) {
    const [a,b,c] = address.split('.').map(Number);
    return !(a===0 || a===10 || a===127 || a>=224 || (a===100&&b>=64&&b<=127) || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&(b===168||b===0||(b===0&&c===2))) || (a===198&&(b===18||b===19||b===51)) || (a===203&&b===0&&c===113));
  }
  return isIP(address)===6 && /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:(?:db8|0|2|10|20):/i.test(address) && !address.includes('.');
}
export function robotsPolicy(status, text='') {
  if (status===404 || status===410) return {kind:'ABSENT',text:''};
  if (status>=200&&status<300 && !/<(?:!doctype|html)/i.test(text)) return {kind:'FOUND',text};
  return {kind:'UNAVAILABLE',text:''};
}
export class PublicSession {
  constructor(root, opts={}) { this.root=new URL(root); this.key=hostKey(this.root.hostname); this.robots=new Map(); this.nextAt=0; this.requests=0; this.maxRequests=opts.maxRequests??40; this.deadline=Date.now()+(opts.maxMs??100000); this.delayMs=opts.delayMs??400; this.signal=opts.signal; }
  async request(raw,{robots=false,redirects=0}={}) {
    const address=safeUrl(raw); if(!address) throw new Error('UNSAFE_URL');
    const u=new URL(address); if(hostKey(u.hostname)!==this.key) throw new Error('EXTERNAL_REDIRECT_REVIEW');
    if(this.signal?.aborted) throw new Error('CANCELLED');
    if(Date.now()>this.deadline || this.requests>=this.maxRequests) throw new Error('BUDGET_EXHAUSTED');
    if(!robots) { const policy=await this.policy(u.origin); if(policy.kind==='UNAVAILABLE') throw new Error('ROBOTS_UNAVAILABLE'); if(!isAllowedByRobots(policy.text,address,'seznam-skol')) throw new Error('ROBOTS_DISALLOWED'); }
    await sleep(Math.max(0,this.nextAt-Date.now())); this.nextAt=Date.now()+this.delayMs;
    const records=await Promise.race([lookup(u.hostname,{all:true}),sleep(7000).then(()=>{throw new Error('DNS_TIMEOUT');})]);
    if(!records.length || records.some(r=>!publicIp(r.address))) throw new Error('UNSAFE_DNS');
    const selected=records.find(r=>r.family===4)??records[0]; this.requests++;
    const response=await new Promise((resolve,reject)=>{
      const transport=u.protocol==='https:'?https:http;
      const req=transport.get(u,{headers:{'user-agent':UA,accept:'text/html,application/xhtml+xml,application/xml,text/xml,text/plain;q=0.9','accept-encoding':'identity'},family:selected.family,lookup:(_h,_o,cb)=>cb(null,selected.address,selected.family)},res=>{
        const parts=[]; let bytes=0; const max=2500000;
        if(Number(res.headers['content-length']??0)>max){res.destroy();reject(new Error('TOO_LARGE'));return;}
        res.on('data',chunk=>{bytes+=chunk.length;if(bytes>max){req.destroy(new Error('TOO_LARGE'));return;}parts.push(chunk);});
        res.on('error',reject); res.on('end',()=>{
          clearTimeout(timer); const ct=String(res.headers['content-type']??''); const enc=ct.match(/charset=["']?([\w-]+)/i)?.[1]??'utf-8';
          let text; try{text=new TextDecoder(enc).decode(Buffer.concat(parts));}catch{text=Buffer.concat(parts).toString('utf8');}
          resolve({url:address,status:res.statusCode??0,text,contentType:ct,location:res.headers.location,bytes});
        });
      });
      const timer=setTimeout(()=>req.destroy(new Error('FETCH_TIMEOUT')),Math.min(10000,Math.max(500,this.deadline-Date.now())));
      req.on('error',err=>{clearTimeout(timer);reject(err);});
    });
    if(response.status>=300&&response.status<400&&response.location){if(redirects>=5)throw new Error('REDIRECT_LIMIT');return this.request(new URL(response.location,address).href,{robots,redirects:redirects+1});}
    return response;
  }
  async policy(origin) {
    if(!this.robots.has(origin))this.robots.set(origin,(async()=>{try {const r=await this.request(origin+'/robots.txt',{robots:true});return robotsPolicy(r.status,r.text);}catch{return {kind:'UNAVAILABLE',text:''};}})());
    return this.robots.get(origin);
  }
}
