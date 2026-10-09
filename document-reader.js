import {readDocx} from './docx-engine.js';
import {ZipCMapReaderFactory} from './pdf-cmaps.js';
import {roleFor} from './article-ai.js';
import {norm,wc,checkAbort,tick} from './utils.js';
if(!Promise.withResolvers)Promise.withResolvers=function(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
let ocrLibPromise;
function loadOCR(){
  if(!ocrLibPromise)ocrLibPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('./vendor/ocr/tesseract.min.js',import.meta.url).href;script.onload=()=>resolve(globalThis.Tesseract);script.onerror=()=>reject(new Error('Mesin OCR gagal dimuat. Pastikan folder vendor ikut diunggah.'));document.head.append(script);}).catch(e=>{ocrLibPromise=null;throw e});return ocrLibPromise;
}
async function ocrWorker(onProgress,signal){
  checkAbort(signal);const api=await loadOCR();const base=new URL('./vendor/ocr/',import.meta.url).href;
  const worker=await api.createWorker('ind+eng',1,{workerPath:base+'worker.min.js',corePath:base,langPath:base+'lang',logger:m=>onProgress?.({text:'OCR: '+m.status,progress:m.progress||0})});
  const abort=()=>{worker.terminate().catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});
  return {worker,release:async()=>{signal?.removeEventListener('abort',abort);await worker.terminate().catch(()=>{});}};
}
function plainItem(text,index,page=null,extra={}){return {index,type:'p',text:norm(text),rawText:text,page,style:'',outline:null,boldRatio:0,isToc:false,footnoteIds:[],drawings:[],equations:[],...extra};}
export function textItems(text,page=null){
  const clean=String(text).replace(/\r\n?/g,'\n');const chunks=[];let pending=[],metaFollowing=false;
  const heading=t=>wc(t)<24&&(roleFor(t)!=='unknown'||/^(?:(?:BAB|CHAPTER)\s+(?:[IVXLCDM]+|\d+)\b|\d+(?:\.\d+)+\s|[A-H][.)]\s)/i.test(t));
  const flush=()=>{if(pending.length)chunks.push(pending.join(' '));pending=[];};
  for(const line of clean.split('\n')){const t=norm(line);if(!t){flush();continue;}if(metaFollowing||/^(?:oleh|by|nim|program studi|prodi|universitas|institut)\b/i.test(t)&&wc(t)<18||t===t.toUpperCase()&&wc(t)<22){flush();chunks.push(t);metaFollowing=/^(?:oleh|by|program studi|prodi)\s*:?$/i.test(t);continue;}if(heading(t)){flush();chunks.push(t);}else{pending.push(t);if(wc(pending.join(' '))>=160||/[.!?]$/.test(t)&&wc(pending.join(' '))>=25)flush();}}flush();
  return chunks.map((text,i)=>plainItem(text,i,page,{boldRatio:heading(text)?1:0}));
}
export function pdfLines(content){
  const groups=[];for(const item of content.items||[]){if(!item.str?.trim())continue;const y=item.transform[5],x=item.transform[4],height=Math.abs(item.height||item.transform[3]||10);let line=groups.find(g=>Math.abs(g.y-y)<Math.max(2,height*.35));if(!line){line={y,height,parts:[]};groups.push(line);}line.parts.push({text:item.str,x,width:item.width,height,font:item.fontName});}
  return groups.sort((a,b)=>b.y-a.y).map(g=>{const parts=g.parts.sort((a,b)=>a.x-b.x);return {...g,x:parts[0]?.x||0,text:parts.map((p,i)=>{const prev=parts[i-1];const gap=prev?p.x-prev.x-prev.width:0;return (i&&gap>p.height*2?'   ':i&&gap>p.height*.12?' ':'')+p.text;}).join('')};});
}
function paragraphize(lines,page){
  if(!lines.length)return [];const sizes=lines.map(x=>x.height).sort((a,b)=>a-b);const normal=sizes[Math.floor(sizes.length*.5)]||12;const out=[];let text='',prev=null;
  const flush=()=>{if(norm(text))out.push(plainItem(text,out.length,page));text='';};
  for(const line of lines){const t=norm(line.text);const isHeading=wc(t)<22&&(line.height>normal*1.14||/^(?:BAB|CHAPTER)\b|^(?:ABSTRAK|ABSTRACT|PENDAHULUAN|METODE PENELITIAN|HASIL DAN PEMBAHASAN|KESIMPULAN|DAFTAR PUSTAKA|REFERENCES|LAMPIRAN)$/i.test(t));
    const gap=prev?prev.y-line.y:0;const isTable=/ {3,}/.test(line.text);
    if(isHeading){flush();out.push(plainItem(t,out.length,page,{boldRatio:1}));}
    else if(isTable){flush();out.push(plainItem(line.text,out.length,page,{pdfColumns:true}));}
    else{if(prev&&(gap>normal*1.9||gap<0||Math.abs(line.x-prev.x)>normal*2.5)||wc(text)>220)flush();text+=(text&&/-$/.test(text)?'':' ')+t;if(/[.!?]$/.test(t)&&wc(text)>35)flush();}
    prev=line;
  }flush();return out;
}
export async function readPDF(file,{ocr=true,onProgress,signal}={}){
  const pdfjs=await import('./vendor/pdfjs/pdf.mjs');checkAbort(signal);pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
  const base=new URL('./vendor/pdfjs/',import.meta.url).href;const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:base,cMapPacked:true,CMapReaderFactory:ZipCMapReaderFactory,useWorkerFetch:false,standardFontDataUrl:base+'standard_fonts/',wasmUrl:base+'wasm/',isEvalSupported:false});
  const abort=()=>{task.destroy().catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});let worker=null;const pages=[],warnings=[];let scanned=0;
  try{const pdf=await task.promise;if(pdf.numPages>700)throw new Error('PDF melebihi 700 halaman. Pecah berkas terlebih dahulu.');
    for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){checkAbort(signal);onProgress?.({text:`Membaca halaman PDF ${pageNo}/${pdf.numPages}`,progress:pageNo/pdf.numPages*.85});const page=await pdf.getPage(pageNo);const viewport=page.getViewport({scale:1});const content=await page.getTextContent();let lines=pdfLines(content),items;
      if(wc(lines.map(x=>x.text).join(' '))<18){if(!ocr){warnings.push(`Halaman ${pageNo} berisi scan atau sedikit teks. Aktifkan OCR untuk membacanya.`);items=paragraphize(lines,pageNo);}else{scanned++;worker ||= await ocrWorker(onProgress,signal);const scale=Math.min(2,2600/Math.max(viewport.width,viewport.height));const view=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;checkAbort(signal);const result=await worker.worker.recognize(canvas,{rotateAuto:true});checkAbort(signal);items=textItems(result.data.text,pageNo).map(x=>({...x,ocr:true,ocrConfidence:result.data.confidence}));if(result.data.confidence<75)warnings.push(`OCR halaman ${pageNo} memiliki keyakinan rendah (${Math.round(result.data.confidence)}%). Periksa angka dan ejaannya.`);canvas.width=canvas.height=0;}}
      else items=paragraphize(lines,pageNo);
      pages.push({lines,items,height:viewport.height});page.cleanup();await tick();
    }
    // Remove only recurring header/footer lines; preserve ordinary content and its page provenance.
    const frequency=new Map();for(const p of pages){const strings=new Set(p.lines.filter(l=>l.y>p.height*.93||l.y<p.height*.07).map(l=>norm(l.text)));for(const t of strings)frequency.set(t,(frequency.get(t)||0)+1);}
    const repeat=new Set([...frequency].filter(([t,n])=>pages.length>=3&&n>=Math.max(3,pages.length*.4)&&wc(t)<22).map(([t])=>t));
    const items=pages.flatMap(p=>p.items).filter(x=>!repeat.has(x.text)&&!/^\d{1,4}$/.test(x.text)).map((x,index)=>({...x,index}));
    if(scanned)warnings.push(`${scanned} halaman diproses dengan OCR. Tata letak tabel, sitasi, dan simbol scan perlu diperiksa.`);
    if(items.some(x=>x.pdfColumns))warnings.push('PDF memiliki teks berkolom atau tabel. Nilai disimpan sebagai teks; gunakan DOCX sumber untuk mempertahankan tabel asli.');
    return {items,footnotes:new Map(),relationships:new Map(),format:'pdf',filename:file.name,warnings,pageCount:pdf.numPages,ocrPages:scanned};
  }catch(e){checkAbort(signal);if(e.name==='PasswordException')throw new Error('PDF dilindungi kata sandi. Buka proteksinya sebelum diunggah.');throw e;}
  finally{signal?.removeEventListener('abort',abort);await worker?.release();await task.destroy().catch(()=>{});}
}
async function ocrDocxImages(doc,options){
  const {onProgress,signal}=options;let session=null,count=0;
  try{for(const item of doc.items){if(!item.drawings?.length||wc(item.text)>15)continue;for(const drawing of item.drawings){const dom=new DOMParser().parseFromString(drawing,'application/xml');const nodes=dom.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main','blip');for(const n of nodes){checkAbort(signal);const id=n.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','embed');const rel=doc.relationships.get(id);if(!rel||rel.external||! /\.(?:png|jpe?g|bmp)$/i.test(rel.target))continue;const path=new URL(rel.target,'https://local/word/document.xml').pathname.slice(1);const f=doc.zip.file(path);if(!f)continue;const blob=new Blob([await f.async('uint8array')]);let bitmap;try{bitmap=await createImageBitmap(blob);}catch{continue;}if(bitmap.width<500||bitmap.height<500){bitmap.close();continue;}bitmap.close();session ||= await ocrWorker(onProgress,signal);count+=1;onProgress?.({text:`Membaca gambar scan DOCX ${count}`,progress:0});const result=await session.worker.recognize(blob,{rotateAuto:true});checkAbort(signal);item.text=norm(result.data.text);item.rawText=result.data.text;item.ocr=true;item.ocrConfidence=result.data.confidence;item.drawings=[];if(result.data.confidence<75)doc.warnings.push(`OCR gambar DOCX ${count} perlu diperiksa (${Math.round(result.data.confidence)}%).` );}}}
  }finally{await session?.release();}
  if(count){const split=[];for(const item of doc.items){if(item.ocr)split.push(...textItems(item.rawText).map(x=>({...x,ocr:true,ocrConfidence:item.ocrConfidence})));else split.push(item);}doc.items=split.map((x,index)=>({...x,index}));doc.warnings.push(`${count} gambar halaman DOCX dibaca dengan OCR. Periksa angka, sitasi, dan tabel.`);}return doc;
}
export async function readDocument(file,options={}){
  checkAbort(options.signal);if(file.size>100*1024*1024)throw new Error('Berkas melebihi 100 MB. Kompres gambar atau pecah dokumen terlebih dahulu.');
  const ext=file.name.split('.').pop().toLowerCase();let doc;
  if(ext==='docx'){doc=await readDocx(file,options);if(options.ocr&&doc.items.reduce((n,x)=>n+wc(x.text),0)<100)doc=await ocrDocxImages(doc,options);}
  else if(ext==='pdf')doc=await readPDF(file,options);
  else if(ext==='txt'){doc={items:textItems(await file.text()),footnotes:new Map(),relationships:new Map(),format:'txt',filename:file.name,warnings:['TXT tidak memuat format tabel atau footnote Word. Periksa referensi sumber.']};}
  else if(['png','jpg','jpeg'].includes(ext)){if(!options.ocr)throw new Error('Aktifkan OCR untuk membaca gambar.');const session=await ocrWorker(options.onProgress,options.signal);try{const result=await session.worker.recognize(file,{rotateAuto:true});doc={items:textItems(result.data.text,1),footnotes:new Map(),relationships:new Map(),format:'image',filename:file.name,warnings:['Hasil OCR gambar perlu diperiksa sebelum digunakan.'],ocrPages:1};}finally{await session.release();}}
  else if(ext==='doc')throw new Error('Format Word lama (.doc) perlu disimpan ulang menjadi .docx di Microsoft Word atau LibreOffice.');
  else throw new Error('Pilih DOCX, PDF, TXT, atau gambar scan PNG/JPG.');
  checkAbort(options.signal);if(!doc.items.some(x=>wc(x.text)>3))throw new Error('Tidak ada teks yang dapat dibaca. Aktifkan OCR untuk scan, atau simpan ulang dokumen sebagai DOCX.');return doc;
}
