import { fromBuffer, type Entry } from 'yauzl';
import { XMLParser } from 'fast-xml-parser';
const wanted=(name:string)=>name==='[Content_Types].xml'||name==='word/document.xml'||name==='xl/workbook.xml'||name==='xl/sharedStrings.xml'||/^xl\/worksheets\/sheet\d+\.xml$/.test(name)||name==='ppt/presentation.xml'||/^ppt\/slides\/slide\d+\.xml$/.test(name);
/** Bounded, in-memory text extraction. No files are written; links, formulas and macros never execute. */
export function officeEntries(bytes:Buffer):Promise<Map<string,string>> {
 return new Promise((resolve,reject)=>{fromBuffer(bytes,{lazyEntries:true,validateEntrySizes:true,strictFileNames:true},(error,zip)=>{
  if(error)return reject(new Error('The Office file is not a valid ZIP package.'));
  let total=0,count=0,finished=false;const entries=new Map<string,string>();
  const timer=setTimeout(()=>fail(new Error('Office preview exceeded its processing limit.')),5000);
  function fail(e:Error){if(finished)return;finished=true;clearTimeout(timer);zip.close();reject(e);}
  zip.on('error',fail);zip.on('end',()=>{if(finished)return;finished=true;clearTimeout(timer);resolve(entries);});
  zip.on('entry',(entry:Entry)=>{
   if(++count>2000)return fail(new Error('The Office package contains too many entries.'));
   if(/vbaProject\.bin$/i.test(entry.fileName))return fail(new Error('Macro-enabled documents are not accepted.'));
   if(!wanted(entry.fileName)){zip.readEntry();return;}
   if(entry.uncompressedSize>2*1024*1024||total+entry.uncompressedSize>8*1024*1024||entries.has(entry.fileName))return fail(new Error('The Office package exceeds preview limits.'));
   zip.openReadStream(entry,(error,stream)=>{
    if(error||!stream)return fail(new Error('Unable to read the Office package.'));
    const chunks:Buffer[]=[];let size=0;
    stream.on('error',fail);stream.on('data',(chunk:Buffer)=>{size+=chunk.length;total+=chunk.length;if(size>2*1024*1024||total>8*1024*1024){stream.destroy();fail(new Error('The expanded Office file is too large.'));return;}chunks.push(chunk);});
    stream.on('end',()=>{if(finished)return;entries.set(entry.fileName,Buffer.concat(chunks).toString('utf8'));zip.readEntry();});
   });
  });zip.readEntry();
 });});
}
export async function validateOfficePackage(name:string,bytes:Buffer) {
 const ext=name.split('.').pop()?.toLowerCase();if(!['docx','xlsx','pptx'].includes(ext??''))return;
 const entries=await officeEntries(bytes),required=ext==='docx'?'word/document.xml':ext==='xlsx'?'xl/workbook.xml':'ppt/presentation.xml';
 if(!entries.has('[Content_Types].xml')||!entries.has(required))throw new Error('The Office package does not match the selected document type.');
}
function texts(value:unknown,keys:Set<string>,out:string[]=[]):string[] {
 if(out.length>10000)return out;
 if(Array.isArray(value)){for(const v of value)texts(v,keys,out);}
 else if(value&&typeof value==='object')for(const [key,v] of Object.entries(value)){
  if(keys.has(key)){for(const x of Array.isArray(v)?v:[v]){const text=typeof x==='object'&&x!==null?(x as Record<string,unknown>)['#text']:x;if(typeof text==='string'||typeof text==='number')out.push(String(text));else texts(x,keys,out);}}
  else texts(v,keys,out);
 }
 return out;
}
export async function officeTextPreview(bytes:Buffer) {
 const entries=await officeEntries(bytes),parser=new XMLParser({ignoreAttributes:false,processEntities:false,parseTagValue:false});
 const parts:string[]=[];
 for(const [name,xml] of [...entries].sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}))){
  if(name==='word/document.xml'||/^ppt\/slides\/slide\d+\.xml$/.test(name))parts.push(texts(parser.parse(xml),new Set(['w:t','a:t'])).join(' '));
 }
 if(entries.has('xl/workbook.xml')){
  const shared=entries.has('xl/sharedStrings.xml')?texts(parser.parse(entries.get('xl/sharedStrings.xml')!),new Set(['t'])):[];
  for(const [name,xml] of entries)if(/^xl\/worksheets\/sheet\d+\.xml$/.test(name)){
   const sheet=parser.parse(xml),rawRows=sheet.worksheet?.sheetData?.row??[],rows=Array.isArray(rawRows)?rawRows:[rawRows];
   parts.push(name.split('/').pop()!);
   for(const row of rows.slice(0,200)){const rawCells=row.c??[],cells=Array.isArray(rawCells)?rawCells:[rawCells];parts.push(cells.slice(0,40).map(cell=>cell['@_t']==='s'?(shared[Number(cell.v)]??''):cell['@_t']==='inlineStr'?texts(cell.is,new Set(['t'])).join(''):String(cell.v??'')).join(' | '));}
  }
 }
 return parts.join('\n\n').slice(0,60000)||'No extractable text. Download the original to view images, charts or complex layouts.';
}
