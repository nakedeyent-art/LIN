import { PDFDocument, type PDFFont, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
export const pdfHash=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex");
const fontBytes=()=>readFileSync(join(process.cwd(),"assets/fonts/NotoSans-Regular.ttf"));
async function embed(doc:PDFDocument) { doc.registerFontkit(fontkit);return doc.embedFont(fontBytes(),{subset:true}); }
function printable(s:string,font:PDFFont) {
 const supported=new Set(font.getCharacterSet());
 for(const char of s)if(char!=="\n"&&!supported.has(char.codePointAt(0)!))throw new Error("This document contains a character the PDF font cannot represent. Use an uploaded PDF or contact support for a matching font.");
 return s;
}
export async function textPdf(title:string,body:string) {
 const doc=await PDFDocument.create(),font=await embed(doc);
 let page=doc.addPage(),y=790;
 const lines:string[]=[],widths=new Map<string,number>(),maxWidth=page.getWidth()-90;
 const width=(text:string)=>{let n=widths.get(text);if(n===undefined){n=font.widthOfTextAtSize(text,11);widths.set(text,n);}return n;};
 for(const paragraph of `${title}\n\n${body}`.split("\n")) {
  let line='';
  for(const token of printable(paragraph,font).match(/\S+|\s+/g)??[]) {
   if(width(line+token)<=maxWidth){line+=token;continue;}
   if(line){lines.push(line);line='';}
   if(width(token)<=maxWidth){line=token;continue;}
   // An unbroken identifier/hash may need splitting, but ordinary prose wraps at words.
   for(const char of token){if(line&&width(line+char)>maxWidth){lines.push(line);line='';}line+=char;}
  }
  lines.push(line);
 }
 for(const line of lines) {
  if(y<50){page=doc.addPage();y=790;}
  page.drawText(line,{x:45,y,size:11,font});y-=16;
 }
 return doc.save();
}
export async function completedPdf(source:Uint8Array, fields:{id:string;page:number;x:number;y:number;width:number}[],values:Record<string,string>) {
 const doc=await PDFDocument.load(source),font=await embed(doc);
 for(const f of fields) {
  const page=doc.getPage(f.page-1),text=printable(values[f.id]??"",font);
  if(!text)continue;
  const maxWidth=page.getWidth()*Number(f.width), natural=font.widthOfTextAtSize(text,11);
  const size=Math.min(11,11*maxWidth/Math.max(1,natural));
  if(size<6)throw new Error("A field value is too long for its area. Shorten it before signing.");
  const x=Number(f.x)*page.getWidth(),y=(1-Number(f.y))*page.getHeight()-14;
  if(x<0||y<0||x+font.widthOfTextAtSize(text,size)>page.getWidth()+.01||y+size>page.getHeight())throw new Error("A field falls outside the page. Ask the sender to correct its position.");
  page.drawText(text,{x,y,font,size,color:rgb(.08,.12,.18)});
 }
 return doc.save();
}
