import {norm,wc,tokens,ROLES,itemText,sourceIds,recalc} from './utils.js';
const MAIN=['abstract','intro','theory','method','results','discussion','conclusion','biblio','appendix','front'];
const chapterRE=/^(?:BAB|CHAPTER)\s+([IVXLCDM]+|\d+)\b[\s.:–—-]*(.*)$/i;
export function cleanHeading(text){return norm(text).replace(chapterRE,(_,n,t)=>t||'').replace(/^(?:[A-H][.)]|\d+(?:\.\d+){0,4}[.)]?)\s+/i,'').replace(/[:.]$/,'').trim();}
export function roleFor(text){
  const s=cleanHeading(text).toLowerCase();if(wc(s)>20)return 'unknown';
  if(/^(?:abstrak|abstract|ringkasan|summary)$/.test(s))return 'abstract';
  if(/^(?:daftar\s+pustaka|bibliografi|bibliography|references|referensi|rujukan)$/.test(s))return 'biblio';
  if(/^(?:lampiran\b|appendix\b|appendices\b|riwayat hidup\b|biodata\b)/.test(s))return 'appendix';
  if(/^(?:kata pengantar|daftar isi|daftar tabel|daftar gambar|table of contents|acknowledg?ements?|lembar (?:persetujuan|pengesahan)|halaman .*|pernyataan .*|motto|persembahan)$/.test(s))return 'front';
  if(/^(?:pendahuluan|introduction|latar belakang(?: masalah| penelitian)?|konteks penelitian|background(?: of the study)?)$/.test(s))return 'intro';
  if(/^(?:metode(?: penelitian)?|metodologi(?: penelitian)?|methodology|research method(?:s|ology)?|materials and methods|metode dan bahan|bahan dan metode)$/.test(s))return 'method';
  if(/^(?:hasil(?: penelitian)?(?: dan pembahasan)?|results(?: and discussion)?|temuan(?: penelitian)?|paparan data(?: dan temuan penelitian)?|analisis (?:hasil|temuan)(?: penelitian)?)$/.test(s))return 'results';
  if(/^(?:pembahasan(?: hasil penelitian)?|discussion(?: of findings)?|hasil dan pembahasan)$/.test(s))return 'discussion';
  if(/^(?:kesimpulan(?: dan saran)?|simpulan(?: dan saran)?|penutup|conclusions?(?: and recommendations)?|saran|recommendations?)$/.test(s))return 'conclusion';
  if(/^(?:kajian(?: teori| pustaka| literatur| teoretis)|tinjauan(?: pustaka| teori| literatur)|landasan(?: teori| teoretis)|kerangka(?: teori| teoretis)|literature review|theoretical framework)$/.test(s))return 'theory';
  return 'unknown';
}
export function isHeadingLike(item){
  if(item.type!=='p'||item.isToc)return false;const t=norm(item.text);if(!t||wc(t)>24||t.length>230)return false;
  return chapterRE.test(t)||roleFor(t)!=='unknown'||item.outline>0&&item.outline<9||item.boldRatio>.6&&wc(t)<17&&!/[.!?]$/.test(t)||/^(?:[A-H][.)]|\d+(?:\.\d+){1,4}[.)]?)\s+[\p{L}]/u.test(t)&&wc(t)<17;
}
export function headingLevel(item){if(chapterRE.test(item.text))return 1;if(item.outline)return item.outline;if(/^[A-H][.)]\s/i.test(item.text))return 2;const m=item.text.match(/^(\d+(?:\.\d+){0,4})[.)]?\s/);if(m)return m[1].split('.').length;return roleFor(item.text)!=='unknown'?1:2;}
function chapterNumber(text){const match=text.match(chapterRE);if(!match)return 0;if(/^\d+$/.test(match[1]))return +match[1];const v={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};let sum=0,prev=0;for(const c of [...match[1].toUpperCase()].reverse()){sum+=v[c]<prev?-v[c]:v[c];prev=Math.max(prev,v[c]);}return sum;}
function metadata(items){
  const front=items.filter(x=>!x.isToc&&x.type==='p').slice(0,70);let title='',author='',prodi='',univ='',year='';
  const skip=/^(?:skripsi|tesis|disertasi|thesis|oleh|by|bab\b|chapter\b|nim\b|nomor induk|fakultas\b|program studi\b|prodi\b|universitas\b|institut\b|sekolah tinggi\b|diajukan\b|untuk\b|sebagai\b|20\d{2}$)/i;
  const candidates=front.slice(0,18).filter(x=>wc(x.text)>=4&&wc(x.text)<45&&!skip.test(x.text)&&roleFor(x.text)==='unknown');
  title=(candidates.find(x=>x.boldRatio>.4||x.text===x.text.toUpperCase())||candidates[0])?.text||'';
  for(let i=0;i<front.length;i++){const t=front[i].text;let match;
    if((match=t.match(/^(?:oleh|by)\s*:?\s*(.*)$/i))){const next=match[1]||front[i+1]?.text;if(next&&wc(next)<10&&!skip.test(next))author=next;}
    if(!author&&/^NIM\s*[:.]?\s*[\d. -]+/i.test(t)){const prev=front[i-1]?.text;if(prev&&wc(prev)<10&&!skip.test(prev))author=prev;}
    if(!prodi&&(match=t.match(/^(?:program studi|prodi)\s*:?\s*(.*)$/i)))prodi=match[1]||front[i+1]?.text||'';
    if(!univ&&/^(?:universitas|institut|sekolah tinggi|UIN |IAIN )/i.test(t))univ=t;
    if(!year&&/^20\d{2}$/.test(t))year=t;
  }
  return {title,author,prodi,univ,year};
}
function bodyIndices(doc,block){return doc.items.slice(block.start+1,block.end).filter(x=>!x.isToc&&!x.noise&&norm(x.text)||x.index>block.start&&x.index<block.end&&x.drawings?.length).map(x=>x.index);}
function strongToc(items,i){if(items[i].isToc)return true;if(!chapterRE.test(items[i].text))return false;const window=items.slice(i+1,i+11);const short=window.filter(x=>wc(x.text)<20).length;return window.filter(x=>chapterRE.test(x.text)).length>=2&&short>=window.length-1;}
function contentRole(text){
  const t=norm(text).toLowerCase();const scores={intro:0,method:0,results:0,conclusion:0};
  for(const [role,re] of Object.entries({intro:/latar belakang|permasalahan|fenomena|research gap|tujuan penelitian/g,method:/pendekatan penelitian|penelitian ini menggunakan|populasi|sampel|wawancara|instrumen|responden|teknik pengumpulan|research design/g,results:/hasil penelitian|temuan penelitian|hasil analisis|menunjukkan bahwa|uji hipotesis|nilai signifikansi|research findings/g,conclusion:/dapat disimpulkan|kesimpulan|disimpulkan bahwa|peneliti menyarankan|in conclusion/g}))scores[role]=(t.match(re)||[]).length;
  const best=Object.entries(scores).sort((a,b)=>b[1]-a[1]);return best[0][1]>=3&&best[0][1]>best[1][1]+1?{role:best[0][0],confidence:.52}:{role:'unknown',confidence:.25};
}
export function analyzeThesis(doc){
  const items=doc.items;const meta=metadata(items);const boundaries=[];
  for(let i=0;i<items.length;i++){
    const it=items[i];if(it.isToc||strongToc(items,i)||it.type!=='p')continue;
    const chapter=chapterNumber(it.text);let label=it.text,role=roleFor(label);let labelEnd=i;
    if(chapter){const next=items[i+1];if(next&&!next.isToc&&isHeadingLike(next)&&!chapterRE.test(next.text)){label+=' — '+next.text;labelEnd=i+1;role=roleFor(next.text);}}
    const heading=isHeadingLike(it);const level=headingLevel(it);
    const main=chapter||heading&&(role!=='unknown'&&level===1||it.outline===1);
    if(main){const prev=boundaries.at(-1);if(prev?.labelEnd===i)continue;boundaries.push({start:i,labelEnd,label,role,num:chapter,level:1,confidence:role!=='unknown'?.92:.35});}
  }
  let blocks=boundaries.map((b,i)=>{const end=boundaries[i+1]?.start??items.length;const inside=items.slice(b.labelEnd+1,end).filter(x=>!x.isToc);let {role,confidence}=b;
    if(role==='unknown'){const classification=contentRole(inside.slice(0,25).map(x=>x.text).join(' '));role=classification.role;confidence=classification.confidence;}
    return {...b,id:'block-'+b.start,end,role,confidence,wordCount:inside.reduce((n,x)=>n+wc(x.text),0),textStart:b.labelEnd+1};
  }).filter(b=>b.end>b.textStart);
  // An explicit subsection is a candidate, even when its chapter has an unusual name.
  for(let i=0;i<items.length;i++){const it=items[i];const role=roleFor(it.text);if(it.isToc||role==='unknown'||!isHeadingLike(it)||boundaries.some(b=>i===b.start||i===b.labelEnd))continue;const parent=blocks.find(b=>i>=b.textStart&&i<b.end);if(!parent||['front','biblio','appendix','abstract'].includes(parent.role))continue;let end=parent.end;const level=headingLevel(it);for(let j=i+1;j<parent.end;j++){if(isHeadingLike(items[j])&&headingLevel(items[j])<=level){end=j;break;}}const wordCount=items.slice(i+1,end).reduce((n,x)=>n+wc(x.text),0);if(wordCount>=15)blocks.push({id:'sub-'+i,start:i,textStart:i+1,end,label:it.text,role,num:0,level,parentId:parent.id,confidence:.85,wordCount});}
  // Preserve readable content with no headings as neutral candidates for AI/manual mapping.
  const covered=new Set(blocks.flatMap(b=>Array.from({length:b.end-b.start},(_,i)=>b.start+i)));
  let pending=[];const flush=()=>{if(!pending.length)return;const start=pending[0];const end=pending.at(-1)+1;const text=pending.map(i=>items[i].text).join(' ');if(wc(text)>=40){const c=contentRole(text);blocks.push({id:'text-'+start,start:start-1,textStart:start,end,label:`Blok teks ${start+1}–${end}`,num:0,level:1,wordCount:wc(text),...c});}pending=[];};
  for(const it of items){if(covered.has(it.index)||it.isToc){flush();continue;}pending.push(it.index);if(pending.length>=18)flush();}flush();
  blocks.sort((a,b)=>a.start-b.start||a.level-b.level);
  const roleBlocks={};for(const role of MAIN){let list=blocks.filter(b=>b.role===role&&b.wordCount>=(role==='biblio'?4:12));const mains=list.filter(b=>!b.parentId);if(mains.length)list=mains;roleBlocks[role]=list;}
  const required=['intro','method','conclusion'];const found=required.filter(r=>roleBlocks[r].length).length+(roleBlocks.results.length||roleBlocks.discussion.length?1:0);
  const confidence=(found/4)*.9;
  return {meta,blocks,roleBlocks,confidence,wordCount:items.reduce((n,x)=>n+wc(x.text),0),itemsCount:items.length,keywords:[...new Set(tokens(meta.title))],warnings:[]};
}
export function applyAIMapping(analysis,assignments){
  for(const a of assignments||[]){const block=analysis.blocks.find(b=>b.id===a.blockId);if(!block||!MAIN.includes(a.role)||!Number.isFinite(a.confidence)||a.confidence<.65||block.confidence>=.8)continue;block.role=a.role;block.confidence=Math.min(.84,a.confidence);block.aiMapped=true;}
  for(const role of MAIN){let list=analysis.blocks.filter(b=>b.role===role&&b.wordCount>=(role==='biblio'?4:12));const main=list.filter(b=>!b.parentId);analysis.roleBlocks[role]=main.length?main:list;}
  const found=['intro','method','conclusion'].filter(r=>analysis.roleBlocks[r].length).length+(analysis.roleBlocks.results.length||analysis.roleBlocks.discussion.length?1:0);analysis.confidence=found/4*.9;return analysis;
}
function subGroups(doc,block){const groups=[];let cur={heading:null,indices:[]};for(let i=block.textStart;i<block.end;i++){const it=doc.items[i];if(it.isToc||it.noise)continue;if(isHeadingLike(it)&&wc(it.text)<25){if(cur.indices.length)groups.push(cur);cur={heading:i,indices:[]};}else if(it.text||it.drawings?.length)cur.indices.push(i);}if(cur.indices.length)groups.push(cur);return groups;}
function groupScore(doc,group,role,keywords){const text=group.indices.map(i=>doc.items[i].text).join(' ').toLowerCase();let score=tokens(text).filter(t=>keywords.has(t)).length/Math.max(1,Math.sqrt(wc(text)));if(role==='results'||role==='discussion'){if(/hasil|temuan|menunjukkan|tabel|pengaruh|signifikansi/.test(text))score+=6;if(/visi dan misi|sejarah berdirinya|struktur organisasi/.test(text))score-=8;}if(role==='method'&&/sampel|informan|responden|desain|pendekatan|pengumpulan|analisis|instrumen/.test(text))score+=5;return score;}
function extractBlocks(doc,blocks,role,budget,{includeTables=true,includeImages=true}={},keywords=new Set()){
  const groups=blocks.flatMap(b=>subGroups(doc,b).map(g=>({...g,block:b})));let output=[];const used=new Set();const remaining=budget;
  const weights=groups.map(g=>Math.max(.4,groupScore(doc,g,role,keywords)+2));const sum=weights.reduce((a,b)=>a+b,0)||1;
  for(let k=0;k<groups.length;k++){const g=groups[k];const limit=Math.max(70,remaining*weights[k]/sum);let count=0;const picked=[];
    const content=g.indices.filter(i=>!used.has(i)&&(includeTables||doc.items[i].type!=='table')&&(includeImages||doc.items[i].text));
    // Use adjacent complete paragraphs, never sentence fragments. Give each subsection room.
    for(const i of content){const it=doc.items[i];if(count>=limit&&it.type!=='table'&&!it.drawings?.length)break;if(wc(it.text)<5&&it.type!=='table'&&!it.drawings?.length&&!/^(?:tabel|table|gambar|figure)\s+\d+/i.test(it.text))continue;picked.push({index:i,role:it.type==='table'?'table':'body',sourceIds:[i],source:g.block.label});count+=wc(it.text);used.add(i);}
    if(picked.length){if(g.heading!=null&&!used.has(g.heading)){output.push({index:g.heading,role:'subheading',sourceIds:[g.heading],source:g.block.label});used.add(g.heading);}output.push(...picked);}
  }
  // Preserve selected data tables and the caption immediately before each table, in source order.
  if(includeTables&&['results','discussion','method'].includes(role))for(const block of blocks)for(let i=block.textStart;i<block.end;i++){if(doc.items[i].type==='table'){if(i>0&&/^(?:tabel|table)\b/i.test(doc.items[i-1].text)&&!used.has(i-1)){output.push({index:i-1,role:'body',sourceIds:[i-1],source:block.label});used.add(i-1);}if(!used.has(i)){output.push({index:i,role:'table',sourceIds:[i],source:block.label});used.add(i);}}}
  return output.sort((a,b)=>a.index-b.index);
}
function biblioItems(doc,analysis){const ranges=analysis.roleBlocks.biblio||[];let out=[];for(const b of ranges){let pending=null;for(let i=b.textStart;i<b.end;i++){const item=doc.items[i];if(item.isToc||!item.text||isHeadingLike(item))continue;const text=item.text;const newEntry=/\b(?:18|19|20)\d{2}[a-z]?\b/.test(text)||/^[\p{L}][\p{L}'’ -]+,\s*/u.test(text);if(pending&&!newEntry){pending.text+=' '+text;pending.sourceIds.push(i);}else{pending={text,sourceIds:[i],role:'bibliography',source:b.label,original:true};out.push(pending);}}}const seen=new Set();return out.filter(x=>{const key=norm(x.text).toLowerCase();if(seen.has(key))return false;seen.add(key);return wc(x.text)>3;});}
export function syncReferences(doc,analysis,plan,policy='cited'){
  plan.sections=plan.sections.filter(s=>s.id!=='biblio');const all=biblioItems(doc,analysis);const usedText=plan.sections.flatMap(s=>s.items.map(x=>itemText(doc,x))).join(' ');const noteIds=new Set(plan.sections.flatMap(s=>s.items.flatMap(x=>sourceIds(x).flatMap(i=>doc.items[i]?.footnoteIds||[]))));const notes=[...noteIds].map(id=>doc.footnotes?.get(id)).filter(Boolean);const refs=[];const warnings=[];
  for(const ref of all){const year=ref.text.match(/\b(?:18|19|20)\d{2}[a-z]?\b/)?.[0];const surname=tokens(ref.text.split(/[,.]/)[0]);const author=surname.slice(0,2);const cited=year&&usedText.includes(year)&&author.some(n=>usedText.toLowerCase().includes(n));const footnoteMatch=notes.some(n=>{const nTokens=new Set(tokens(n));const rTokens=tokens(ref.text);const hits=rTokens.filter(t=>nTokens.has(t));return hits.length>=Math.min(5,Math.max(3,rTokens.length*.4))&&(!year||n.includes(year));});if(policy==='all'||cited||footnoteMatch)refs.push(ref);}
  for(const note of notes){if(!all.some(r=>tokens(r.text).filter(t=>new Set(tokens(note)).has(t)).length>=3))warnings.push('Sebuah footnote tidak dapat dipasangkan dengan daftar pustaka. Footnote tetap dipertahankan; lengkapi referensinya saat review.');}
  const unmatched=all.length&&!refs.length&&policy==='cited';if(unmatched)warnings.push('Belum ada referensi yang dapat dicocokkan secara meyakinkan. Gunakan opsi semua referensi sumber atau periksa sitasi.');
  if(refs.length)plan.sections.push({id:'biblio',title:'DAFTAR PUSTAKA',items:refs});
  plan.referenceWarnings=[...new Set(warnings)];plan.referencePolicy=policy;return recalc(plan,doc);
}
export function generatePlan(doc,analysis,opts={}){
  const mode=opts.mode||'contoh';const budget=mode==='ringkas'?{intro:450,method:350,results:1100,conclusion:350}:mode==='lengkap'?{intro:1100,method:750,results:2600,conclusion:750}:{intro:800,method:500,results:1600,conclusion:500};const mapping=opts.mapping||{};const sections=[];const usedBlocks={};
  const choose=role=>{const ids=mapping[role];if(Array.isArray(ids))return ids.map(id=>analysis.blocks.find(b=>b.id===id)).filter(Boolean);return analysis.roleBlocks[role]||[];};
  const abs=choose('abstract').filter(b=>!/^abstract$/i.test(cleanHeading(b.label))).slice(0,1);if(abs.length){const b=abs[0];const contents=doc.items.slice(b.textStart,b.end).filter(x=>!x.isToc&&x.type==='p'&&!isHeadingLike(x));let list=[];let words=0;for(const it of contents){if(/^kata\s*kunci|^keywords/i.test(it.text)){list.push({index:it.index,role:'keywords',sourceIds:[it.index],source:b.label});continue;}if(wc(it.text)<15||/^nim\b|^(?:pembimbing|dosen pembimbing|kata pengantar)\b/i.test(it.text))continue;if(words>650)break;list.push({index:it.index,role:'body',sourceIds:[it.index],source:b.label});words+=wc(it.text);}if(list.length)sections.push({id:'abstract',title:'ABSTRAK',items:list});}
  const combined=[...choose('results'),...choose('discussion')].filter((x,i,a)=>a.findIndex(b=>b.id===x.id)===i).sort((a,b)=>a.start-b.start);
  for(const [role,blocks,title] of [['intro',choose('intro'),'PENDAHULUAN'],['method',choose('method'),'METODE PENELITIAN'],['results',combined,'HASIL DAN PEMBAHASAN'],['conclusion',choose('conclusion'),'KESIMPULAN']]){usedBlocks[role]=blocks;const items=extractBlocks(doc,blocks,role,budget[role],opts,new Set(analysis.keywords));if(items.length)sections.push({id:role,title,items});}
  const plan={sections,mode,budgets:budget,usedBlocks,mapping,ai:false,validation:[],warnings:[],createdAt:new Date().toISOString()};return syncReferences(doc,analysis,plan,opts.referencePolicy||'cited');
}
export function diagnostics(doc,analysis,plan){
  const notes=[...(doc.warnings||[]),...(analysis.warnings||[]),...(plan.warnings||[]),...(plan.referenceWarnings||[])];
  for(const [id,name] of [['abstract','Abstrak'],['intro','Pendahuluan'],['method','Metode'],['results','Hasil/pembahasan'],['conclusion','Kesimpulan']])if(!plan.sections.some(s=>s.id===id&&s.items.length))notes.push(`${name} belum ditemukan. Peta sumber dapat dilengkapi secara manual; isi yang hilang tidak dibuat-buat.`);
  if(!analysis.meta.title)notes.push('Judul belum terdeteksi. Lengkapi pada data artikel.');if(!analysis.meta.author)notes.push('Nama penulis belum terdeteksi. Lengkapi pada data artikel.');
  if(analysis.blocks.some(b=>b.confidence<.65&&b.wordCount>80))notes.push('Ada blok dengan struktur belum pasti. Periksa Peta sumber atau gunakan bantuan AI lokal.');
  if(plan.totalWords<800)notes.push('Draft masih pendek. Periksa bagian sumber yang terpilih atau gunakan mode lengkap.');
  if(plan.sections.some(s=>s.items.some(x=>x.edited)))notes.push('Ada suntingan manual. Angka dan maknanya perlu Anda periksa kembali.');
  return [...new Set(notes)];
}
export const helpers={norm,wc,isHeadingLike,headingLevel};
