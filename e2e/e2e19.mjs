import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { B,sql,browserOptions,submitAndWait as submitOnly } from './runtime.mjs';
// After the server action answers, let the re-rendered page finish loading before the next step touches it.
const submitAndWait=async(p,t)=>{await submitOnly(p,t);await p.waitForLoadState('networkidle');};
let checks=0;
function ok(value,label){assert.ok(value,label);checks++;console.log('PASS '+label);}
const q=s=>"'"+s.replaceAll("'","''")+"'";
sql('TRUNCATE users CASCADE');
function fixture(name,role){return sql(`INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES(${q(name.toLowerCase()+'@example.test')},${q(name)},${q(role)},'fixture',now()) RETURNING id`);}
const athlete=fixture('Athlete','athlete'),guardian=fixture('Guardian','parent'),stranger=fixture('Stranger','coach');
sql(`INSERT INTO athlete_profiles(user_id,sport,level,birth_date) VALUES('${athlete}','Soccer','high_school',CURRENT_DATE-INTERVAL '16 years')`);
sql(`INSERT INTO athlete_relationships(athlete_id,member_id,relationship,guardian_approved) VALUES('${athlete}','${guardian}','parent',true)`);
const br=await chromium.launch(browserOptions);
const errors=[];
async function pageFor(id,pending=false){const ctx=await br.newContext();
 // Server-action redirects re-render the page and can re-close <details> after the test has opened them; these tests are not about the disclosure widget, so keep them open.
 await ctx.addInitScript(()=>{const open=()=>document.querySelectorAll('details.upload-details').forEach(d=>{if(!d.open)d.open=true;});new MutationObserver(open).observe(document,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',open);});const token='test-'+id+(pending?'-pending':'');const hash=createHash('sha256').update(token).digest('hex');sql(`INSERT INTO sessions(token_hash,user_id,expires_at,mfa_verified_at) VALUES('${hash}','${id}',now()+INTERVAL '1 day',${pending?'NULL':'now()'})`);await ctx.addCookies([{name:'lin_session',value:token,url:B,httpOnly:true,sameSite:'Lax'}]);const p=await ctx.newPage();p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));return p;}
const a=await pageFor(athlete),g=await pageFor(guardian),x=await pageFor(stranger);
// Re-renders after a redirect can close <details> a moment after we looked, so open it and CONFIRM the form inside is usable, retrying if not.
const openDetails=async(p,text,probe)=>{for(let i=0;i<8;i++){await p.getByText(text,{exact:true}).first().locator('..').evaluate(d=>{d.open=true;});try{await p.locator(probe).first().waitFor({state:'visible',timeout:1500});return;}catch{}}throw new Error('could not open '+text);};
const goto=async(p,path)=>p.goto(B+path,{waitUntil:'domcontentloaded',timeout:90000});
try {
 await goto(g,`/dashboard/operations/${athlete}`);ok(await g.getByRole('navigation',{name:'Athlete sections'}).locator('a').count()===8,'athlete record exposes all eight sections');
 ok((await goto(x,`/dashboard/operations/${athlete}`)).status()===404,'unrelated account cannot open athlete record');
 // Fixtures simulate an already completed MFA challenge (creating, sending, voiding and signing agreements all need a recent second factor); actual enrollment is covered by e2e17/18.
 for(const id of [athlete,guardian])sql(`INSERT INTO user_mfa(user_id,secret_sealed,enabled_at) VALUES('${id}','fixture-sealed-not-used',now())`);
 await goto(g,`/dashboard/documents?athlete=${athlete}`);await g.getByText('Upload document',{exact:true}).first().click();
 await g.locator('input[name=title]').fill('Travel agreement');await g.locator('details select[name=category]').selectOption('contracts');
 const pdf=await PDFDocument.create();pdf.addPage();const bytes=await pdf.save();
 await g.locator('input[type=file]').setInputFiles({name:'agreement.pdf',mimeType:'application/pdf',buffer:Buffer.from(bytes)});
 await submitAndWait(g,g.getByRole('button',{name:'Upload document',exact:true}));await g.getByRole('heading',{name:'Travel agreement'}).waitFor();
 const doc=new URL(g.url()).pathname.split('/').pop();ok(!!doc,'document upload creates a record');
 ok((await x.request.get(`${B}/dashboard/documents/${doc}/download`)).status()===404,'document bytes are denied to unrelated users');
 ok((await g.request.get(`${B}/dashboard/documents/${doc}/download`)).headers()['cache-control']==='private, no-store','private document downloads cannot be cached');
 await submitAndWait(g,g.getByRole('button',{name:'Prepare in Forg3'}));await g.getByRole('heading',{name:'Review the agreement'}).waitFor();const envelope=new URL(g.url()).pathname.split('/').pop();
 for(const [id,capacity,order] of [[athlete,'athlete','1'],[guardian,'guardian','2']]){
  await openDetails(g,'Add recipient','form:has([name=action][value=recipient]) [name=user_id]');const f=g.locator('form').filter({has:g.locator('[name=action][value=recipient]')});await f.locator('[name=user_id]').selectOption(id);await f.locator('[name=capacity]').selectOption(capacity);await f.locator('[name=order]').fill(order);await submitAndWait(g,f.getByRole('button',{name:'Add recipient'}));
 }
 const recipients=sql(`SELECT id FROM signing_recipients WHERE envelope_id='${envelope}' ORDER BY signing_order`).split('\n');
 await openDetails(g,'Add signing field','form:has([name=action][value=field]) [name=recipient_id]');
 { const page1=g.locator('.placer-page').first();await page1.waitFor({timeout:45000});const box=await page1.boundingBox();
   await page1.hover({position:{x:box.width*0.5,y:box.height*0.2}});await g.mouse.down();await page1.hover({position:{x:box.width*0.8,y:box.height*0.2}});await g.mouse.up();await g.waitForTimeout(200);
   const f=g.locator('form').filter({has:g.locator('[name=action][value=field]')});const x=Number(await f.locator('[name=x]').inputValue()),y=Number(await f.locator('[name=y]').inputValue()),w=Number(await f.locator('[name=width]').inputValue());
   ok(Math.abs(x-50)<=2&&Math.abs(y-20)<=2&&Math.abs(w-30)<=3,`clicking the rendered page places the field (got ${x},${y},${w})`); }
 for(const [i,id] of recipients.entries()){
  await g.goto(g.url(),{waitUntil:'networkidle'});   // after a server-action redirect Next re-commits the tree a moment later, remounting client forms: start each field from a settled page
  await openDetails(g,'Add signing field','form:has([name=action][value=field]) [name=recipient_id]');await g.locator('.placer-page').first().waitFor({timeout:45000});   // rendered pages mean React has hydrated; choosing before that is reset by hydration
  const f=g.locator('form').filter({has:g.locator('[name=action][value=field]')});await f.locator('[name=recipient_id]').selectOption(id);await f.locator('[name=label]').fill('Full name');await f.locator('[name=y]').fill(String(30+i*20));
  if(process.env.E2E_DEBUG){g.on('console',m=>console.log('CONSOLE',m.type(),m.text().slice(0,200)));g.on('request',r=>{if(r.method()==='POST')console.log('REQ',r.url(),r.headers()['next-action']?'action':'');});g.on('requestfailed',r=>console.log('REQFAIL',r.url(),r.failure()?.errorText));
   console.log('DBG valid',await f.evaluate(fm=>fm.checkValidity()),'values',await f.evaluate(fm=>JSON.stringify(Object.fromEntries(new FormData(fm)))));}
  await submitAndWait(g,f.getByRole('button',{name:'Add field'}));
 }
 await g.goto(g.url(),{waitUntil:'networkidle'});
 await submitAndWait(g,g.getByRole('button',{name:'Send for signature'}));ok(sql(`SELECT status FROM signing_envelopes WHERE id='${envelope}'`)==='sent','configured agreement can be sent');
 const half=await pageFor(athlete,true);ok((await half.request.get(`${B}/dashboard/signing/${envelope}/download`)).status()===401,'MFA-pending session cannot download the agreement');await half.context().close();
 for(const [p,name] of [[a,'Athlete'],[g,'Guardian']]){
  await goto(p,`/dashboard/signing/${envelope}`);await submitAndWait(p,p.getByRole('button',{name:'Begin signing'}));await p.getByRole('heading',{name:'Complete your fields'}).waitFor();await p.locator('input[name^=field_]').fill(name);await p.locator('[name=consent]').check();await submitAndWait(p,p.getByRole('button',{name:'Sign agreement',exact:true}));
 }
 ok(sql(`SELECT status FROM signing_envelopes WHERE id='${envelope}'`)==='completed','ordered signing completes through the browser');
 const completed=await g.request.get(`${B}/dashboard/signing/${envelope}/download?kind=completed`);ok(completed.status()===200&&(await completed.body()).subarray(0,5).toString()==='%PDF-','completed PDF is downloadable');
 ok((await g.request.get(`${B}/dashboard/signing/${envelope}/download?kind=certificate`)).status()===200,'audit certificate is downloadable');
 await goto(g,`/dashboard/schedule?athlete=${athlete}`);await g.getByText('Add event',{exact:true}).click();await g.locator('input[name=name]').first().fill('Saturday game');await g.locator('[name=starts_at]').fill('2027-01-10T15:00');await g.locator('[name=ends_at]').fill('2027-01-10T17:00');await submitAndWait(g,g.getByRole('button',{name:'Save event'}));ok(await g.getByRole('cell',{name:'Saturday game'}).count()===1,'game appears on athlete schedule');
 const row0=g.locator('tr',{hasText:'Saturday game'});await row0.getByText(/EST|EDT/).first().waitFor({timeout:15000});await row0.getByRole('button',{name:'Show in my time zone'}).click();await row0.getByText(/UTC/).first().waitFor({timeout:15000});ok(true,'event shows venue time and can be shown in the viewer’s zone');
 const row=()=>g.locator('tr',{hasText:'Saturday game'});
 await row().locator('select[name=consent]').selectOption('give');await submitAndWait(g,row().getByRole('button',{name:'Update',exact:true}));
 await row().getByText(/^Guardian consent recorded$/).waitFor({timeout:15000});ok(true,'a guardian can record consent for an event');
 await row().locator('select[name=consent]').selectOption('revoke');await submitAndWait(g,row().getByRole('button',{name:'Update',exact:true}));
 await row().getByText(/^No guardian consent recorded$/).waitFor({timeout:15000});ok(true,'a guardian can withdraw that consent');
 await row().locator('select[name=consent]').selectOption('give');await submitAndWait(g,row().getByRole('button',{name:'Update',exact:true}));
 const ef=row().locator('form:has(button:text-is("Save changes"))');
 for(let n=0;n<5;n++){await ef.locator('[name=starts_at]').fill('2027-01-10T16:00');await ef.locator('[name=ends_at]').fill('2027-01-10T18:00');await g.waitForTimeout(300);if(await ef.locator('[name=starts_at]').inputValue()==='2027-01-10T16:00'&&await ef.locator('[name=ends_at]').inputValue()==='2027-01-10T18:00')break;}
 await submitAndWait(g,row().getByRole('button',{name:'Save changes'}));
 await g.getByText(/Guardian consent was cleared/).waitFor({timeout:15000});await row().getByText(/^No guardian consent recorded$/).waitFor({timeout:15000});ok(true,'moving an event clears guardian consent and says so');
 await submitAndWait(g,row().getByRole('button',{name:'Cancel this event'}));
 await row().getByText('Cancelled').first().waitFor({timeout:15000});ok(await row().getByRole('button',{name:'Cancel this event'}).count()===0,'a cancelled event is marked and can no longer be edited');
 await goto(g,`/dashboard/routes?athlete=${athlete}`);await g.locator('input[name=name]').fill('Winter showcase trip');await submitAndWait(g,g.getByRole('button',{name:'Create route'}));ok(await g.getByRole('heading',{name:'Winter showcase trip'}).count()===1,'route is a persistent athlete record');
 await g.setViewportSize({width:390,height:844});await goto(g,`/dashboard/operations/${athlete}`);await g.screenshot({path:'.test-output/athlete-mobile.png',fullPage:true});ok(await g.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'athlete record fits a mobile viewport');
 ok(errors.length===0,'no browser runtime errors: '+errors.join('; '));console.log(`ALL PASSED (${checks} checks)`);
} finally {await br.close();}
