/** Public-only transport: bounded streaming, DNS pinning, redirect policy and robots. */
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import {isIP} from 'node:net';
import {isAllowedByRobots} from '../crawler/robots.ts';
export const AGENT='seznam-skol/0.2 (+https://github.com/KadlecekTomas/seznam-skol)';
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const queues=new Map(), dnsCache=new Map(), policies=new Map();
export class CrawlError extends Error {constructor(code){super(code);this.code=code;}}
export function publicIP(ip){
  if(isIP(ip)===4){const [a,b]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19))||(a===192&&b===0));}
  if(isIP(ip)===6){let s=ip.toLowerCase();return /^[23][0-9a-f]{3}:/.test(s)&&!s.startsWith('2001:db8:')&&!s.startsWith('2002:');}return false;
}
export function safeURL(value){const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||(u.port&&!['80','443'].includes(u.port)))throw new CrawlError('UNSAFE_URL');const h=u.hostname.replace(/^\[|\]$/g,'');if(!h.includes('.')&&!isIP(h))throw new CrawlError('UNSAFE_HOST');if(isIP(h)&&!publicIP(h))throw new CrawlError('PRIVATE_ADDRESS');if(/(?:^|\.)(?:localhost|local|internal|home|test|invalid)$/.test(h))throw new CrawlError('PRIVATE_HOST');u.hash='';return u;}
export async function address(host){host=host.replace(/^\[|\]$/g,'');if(isIP(host))return {address:host,family:isIP(host)};let cached=dnsCache.get(host);if(cached&&Date.now()-cached.at<60000)return cached.value;const list=await dns.lookup(host,{all:true});if(!list.length||list.some(x=>!publicIP(x.address)))throw new CrawlError('PRIVATE_DNS');const value=list.find(x=>x.family===4)||list[0];dnsCache.set(host,{at:Date.now(),value});return value;}
async function throttled(host,fn){const key=host.replace(/^www\./,'');const before=queues.get(key)||Promise.resolve();let done;const after=new Promise(r=>done=r);queues.set(key,after);await before;try{return await fn();}finally{await sleep(650);done();if(queues.get(key)===after)queues.delete(key);}}
async function request(url,{timeoutMs=11000,maxBytes=2500000}={}){
 const u=safeURL(url), ip=await address(u.hostname);return throttled(u.hostname,()=>new Promise((resolve,reject)=>{
  const req=(u.protocol==='https:'?https:http).request(u,{method:'GET',headers:{'user-agent':AGENT,accept:'text/html,application/xhtml+xml,application/xml,text/plain;q=0.8','accept-encoding':'identity'},lookup:(_h,opts,cb)=>{if(opts?.all)cb(null,[ip]);else cb(null,ip.address,ip.family);}},res=>{
   const headers=res.headers,status=res.statusCode||0;
   if(Number(headers['content-length']||0)>maxBytes){res.destroy();reject(new CrawlError('SIZE_LIMIT'));return;}
   const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){res.destroy(new CrawlError('SIZE_LIMIT'));}else chunks.push(chunk);});
   res.on('error',reject);res.on('end',()=>{const b=Buffer.concat(chunks);const c=String(headers['content-type']||'');let enc=c.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1]||'utf-8';if(enc==='utf-8'){const head=b.subarray(0,4096).toString('ascii');enc=head.match(/charset\s*=\s*["']?([a-z0-9-]+)/i)?.[1]||enc;}let text;try{text=new TextDecoder(enc).decode(b);}catch{text=b.toString('utf8');}resolve({url:u.href,status,headers,text,bytes:size});});
  });
  const timer=setTimeout(()=>req.destroy(new CrawlError('TIMEOUT')),timeoutMs);req.on('close',()=>clearTimeout(timer));req.on('error',reject);req.end();
 }));
}
async function robotsRequest(url){let u=url;for(let i=0;i<=5;i++){const r=await request(u,{timeoutMs:9000,maxBytes:512000});if(r.status>=300&&r.status<400&&r.headers.location){u=safeURL(new URL(r.headers.location,u).href).href;continue;}return r;}throw new CrawlError('ROBOTS_REDIRECT_LIMIT');}
export async function robotsPolicy(url){const origin=safeURL(url).origin;if(policies.has(origin))return policies.get(origin);const task=(async()=>{try{const r=await robotsRequest(origin+'/robots.txt');if([404,410].includes(r.status))return {text:'',status:'UNAVAILABLE',sitemaps:[]};if(r.status>=200&&r.status<300)return {text:r.text,status:'AVAILABLE',sitemaps:[...r.text.matchAll(/^sitemap:\s*(https?:\/\/\S+)/gim)].map(m=>m[1])};return {text:'User-agent: *\nDisallow: /',status:'BLOCKED_'+r.status,sitemaps:[]};}catch(e){return {text:'User-agent: *\nDisallow: /',status:'UNREACHABLE',sitemaps:[]};}})();policies.set(origin,task);return task;}
export const sameSite=(a,b)=>new URL(a).hostname.replace(/^www\./,'')===new URL(b).hostname.replace(/^www\./,'');
export async function fetchPublic(url,{sameSiteAs=null,timeoutMs=11000,maxBytes=2500000}={}){let u=safeURL(url).href;const redirects=[];for(let i=0;i<=5;i++){if(sameSiteAs&&!sameSite(sameSiteAs,u))throw new CrawlError('EXTERNAL_REDIRECT');const p=await robotsPolicy(u);if(!isAllowedByRobots(p.text,u))throw new CrawlError('ROBOTS_'+p.status);let r=await request(u,{timeoutMs,maxBytes});if([502,503].includes(r.status)){const after=Number(r.headers['retry-after']||1);if(after<=4){await sleep(Math.max(1,after)*1000);r=await request(u,{timeoutMs,maxBytes});}}
 if(r.status>=300&&r.status<400&&r.headers.location){redirects.push(u);u=safeURL(new URL(r.headers.location,u).href).href;continue;}return {...r,redirects,robotsStatus:p.status,at:new Date().toISOString()};}throw new CrawlError('REDIRECT_LIMIT');}
