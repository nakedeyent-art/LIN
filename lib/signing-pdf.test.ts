import { describe,it,expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { completedPdf,textPdf } from './signing-pdf';

describe('signed PDF rendering',()=>{
 it('rejects invisible fields below the edge of a small source page',async()=>{
  const source=await PDFDocument.create();source.addPage([100,100]);
  await expect(completedPdf(await source.save(),[{id:'name',page:1,x:.1,y:.95,width:.8}],{name:'Alex'})).rejects.toThrow('outside the page');
 });
 it('rejects field text too long to remain legible',async()=>{
  const source=await PDFDocument.create();source.addPage();
  await expect(completedPdf(await source.save(),[{id:'name',page:1,x:.1,y:.5,width:.05}],{name:'A very long account name that cannot fit'})).rejects.toThrow('too long');
 });
 it('paginates long multilingual agreement text into readable PDFs',async()=>{
  const pdf=await PDFDocument.load(await textPdf('Agreement — José','WWWWWWWWWW Émilie '.repeat(1000)));
  expect(pdf.getPageCount()).toBeGreaterThan(1);
 });
});
