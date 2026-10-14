import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import type { LookupAddress } from "node:dns";

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses (IPv4 and IPv6). */
export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  if (isIP(v) === 4) {
    const [a, b] = v.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (isIP(v) === 6) return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || /^fe[89ab]/.test(v) || v.startsWith("ff") || v.startsWith("64:ff9b");
  return true;
}

export class FetchError extends Error {}
export type SafeOpts = { maxBytes?: number; timeoutMs?: number; maxRedirects?: number; allowLocal?: boolean };

/** Only a local mock may be fetched, and only outside production, when explicitly allowed. */
const localOk = (o: SafeOpts) => !!o.allowLocal && process.env.NODE_ENV !== "production";

async function checkUrl(raw: string, o: SafeOpts): Promise<{u:URL;addresses:LookupAddress[]}> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new FetchError("invalid URL"); }
  const local = localOk(o) && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  if (u.protocol !== "https:" && !(local && u.protocol === "http:")) throw new FetchError("only https:// sources are allowed");
  if (u.username || u.password) throw new FetchError("credentials in URLs aren't allowed");
  if (local) return {u,addresses:[{address:"127.0.0.1",family:4}]};
  if (u.port && u.port !== "443") throw new FetchError("non-standard ports aren't allowed");
  const addrs = isIP(u.hostname) ? [{ address: u.hostname, family:isIP(u.hostname) }] : await lookup(u.hostname, { all: true }).catch(() => { throw new FetchError("host not found"); });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new FetchError("host isn't on the public internet");
  return {u,addresses:addrs};
}

/** Every socket connects to a previously validated address; redirects are resolved and validated independently. */
export async function safeFetchText(raw:string,o:SafeOpts={}):Promise<string> {
 const maxBytes=o.maxBytes??1_000_000,timeout=o.timeoutMs??8000;
 let url=raw;
 for(let hop=0;hop<=(o.maxRedirects??3);hop++){
  let dnsTimer:ReturnType<typeof setTimeout>|undefined;
  const {u,addresses}=await Promise.race([checkUrl(url,o),new Promise<never>((_,reject)=>{dnsTimer=setTimeout(()=>reject(new FetchError("timed out")),timeout);})]).finally(()=>clearTimeout(dnsTimer));
  const result=await new Promise<{text?:string;redirect?:string}>((resolve,reject)=>{
   let done=false;
   const finish=(error:Error|null,value?:{text?:string;redirect?:string})=>{if(done)return;done=true;clearTimeout(timer);if(error)reject(error instanceof FetchError?error:new FetchError("network error"));else resolve(value!);};
   const request=(u.protocol==='https:'?httpsRequest:httpRequest)(u,{
    agent:false,
    // Preserve the original hostname for Host/SNI/certificate validation, but never re-resolve it for the connection.
    lookup:(_hostname,options,callback)=>{if(options.all)callback(null,addresses);else callback(null,addresses[0].address,addresses[0].family);},
    headers:{'User-Agent':'LIN-news/1.0',Accept:'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1','Accept-Encoding':'identity'},
   },response=>{
    const status=response.statusCode??500;
    if(status>=300&&status<400){const location=response.headers.location;response.destroy();if(!location)finish(new FetchError('redirect without a location'));else {try{finish(null,{redirect:new URL(location,u).toString()});}catch{finish(new FetchError('invalid redirect URL'));}}return;}
    if(status<200||status>=300){response.destroy();finish(new FetchError(`HTTP ${status}`));return;}
    if(Number(response.headers['content-length']??0)>maxBytes){response.destroy();finish(new FetchError('response too large'));return;}
    const chunks:Buffer[]=[];let total=0;
    response.on('data',(chunk:Buffer)=>{total+=chunk.length;if(total>maxBytes){response.destroy();finish(new FetchError('response too large'));}else chunks.push(chunk);});
    response.on('error',error=>finish(error));response.on('end',()=>finish(null,{text:Buffer.concat(chunks).toString('utf8')}));
   });
   const timer=setTimeout(()=>{request.destroy();finish(new FetchError('timed out'));},timeout);
   request.on('error',error=>finish(error));request.end();
  });
  if(result.redirect){url=result.redirect;continue;}return result.text??'';
 }
 throw new FetchError('too many redirects');
}
