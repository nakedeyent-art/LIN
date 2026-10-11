import {afterAll,beforeAll,describe,it,expect} from 'vitest';
import {createServer,type Server} from 'node:http';
import {safeFetchText} from '../lib/safefetch';
let server:Server,url:string;
beforeAll(async()=>{server=createServer((req,res)=>{
 if(req.url==='/redirect'){res.writeHead(302,{Location:'/feed'});res.end();}
 else if(req.url==='/private'){res.writeHead(302,{Location:'https://127.0.0.2/'});res.end();}
 else if(req.url==='/large'){res.end('x'.repeat(2000));}
 else if(req.url==='/loop'){res.writeHead(302,{Location:'/loop'});res.end();}
 else{res.setHeader('Content-Type','application/xml');res.end('<rss><channel/></rss>');}
 });await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${(server.address() as {port:number}).port}`;});
afterAll(async()=>{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));});
describe('bounded news transport',()=>{
 it('allows only an explicitly enabled local test source',async()=>{await expect(safeFetchText(url+'/feed')).rejects.toThrow('https');expect(await safeFetchText(url+'/feed',{allowLocal:true})).toContain('<rss>');});
 it('checks redirect targets and enforces a redirect limit',async()=>{expect(await safeFetchText(url+'/redirect',{allowLocal:true})).toContain('<rss>');await expect(safeFetchText(url+'/private',{allowLocal:true})).rejects.toThrow('public internet');await expect(safeFetchText(url+'/loop',{allowLocal:true,maxRedirects:1})).rejects.toThrow('too many redirects');});
 it('bounds streamed response bytes',async()=>{await expect(safeFetchText(url+'/large',{allowLocal:true,maxBytes:100})).rejects.toThrow('too large');});
});
