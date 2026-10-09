import {norm,wc,xmlEsc,sourceIds,itemText,checkAbort} from './utils.js';
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const M='http://schemas.openxmlformats.org/officeDocument/2006/math';
const REL='http://schemas.openxmlformats.org/package/2006/relationships';
const NS=`xmlns:w="${W}" xmlns:r="${R}" xmlns:m="${M}"`;
const q=(node,name,ns=W)=>[...node.getElementsByTagNameNS(ns,name)];
const attr=(node,name)=>node?.getAttributeNS(W,name)||node?.getAttribute('w:'+name)||'';
const serialize=node=>new XMLSerializer().serializeToString(node);
function parse(xml){const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw new Error('XML dokumen rusak atau tidak dapat dibaca.');return doc;}
function textOf(node){
  let text='';
  function walk(n){if(n.nodeType!==1)return;if(n.namespaceURI===W&&['del','instrText','delText'].includes(n.localName))return;
    if((n.namespaceURI===W||n.namespaceURI===M)&&n.localName==='t'){text+=n.textContent;return;}
    if(n.namespaceURI===W&&n.localName==='tab'){text+='\t';return;}
    if(n.namespaceURI===W&&['br','cr'].includes(n.localName)){text+='\n';return;}
    for(const child of n.childNodes)walk(child);
  }walk(node);return text;
}
function notesOf(node){return [...q(node,'footnoteReference'),...q(node,'endnoteReference')].map(x=>(x.localName==='endnoteReference'?'end:':'')+attr(x,'id')).filter(x=>!/^(-1|0)$/.test(x));}
function visualsOf(node){return q(node,'drawing').filter(x=>x.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main','blip').length).map(serialize);}
function equationsOf(node){return q(node,'oMath',M).filter(x=>!x.parentElement?.closest?.('m\\:oMath')).map(serialize);}
function bodyBlocks(root){const out=[];for(const n of root.children){if(n.namespaceURI===W&&['p','tbl'].includes(n.localName))out.push(n);else if(['sdtContent','sdt','customXml','ins'].includes(n.localName))out.push(...bodyBlocks(n));}return out;}
function styleDefinitions(doc){
  const map=new Map();for(const n of q(doc,'style'))map.set(attr(n,'styleId'),{name:attr(q(n,'name')[0],'val'),based:attr(q(n,'basedOn')[0],'val'),outline:attr(q(n,'outlineLvl')[0],'val')});
  return id=>{let level=null,name='',visited=new Set();while(id&&!visited.has(id)){visited.add(id);const s=map.get(id);if(!s)break;name+=' '+s.name;if(s.outline!==''&&level==null)level=+s.outline+1;id=s.based;}return {level,name};};
}
function withoutMath(node){const copy=node.cloneNode(true);for(const m of [...q(copy,'oMathPara',M),...q(copy,'oMath',M)])m.remove();return norm(textOf(copy));}
function tableData(node){return [...node.children].filter(x=>x.localName==='tr').map(row=>[...row.children].filter(x=>x.localName==='tc').map(cell=>({text:[...cell.children].filter(x=>x.localName==='p').map(p=>norm(textOf(p))).join('\n'),textWithoutMath:withoutMath(cell),span:+attr(q(cell,'gridSpan')[0],'val')||1,merge:q(cell,'vMerge').length?(attr(q(cell,'vMerge')[0],'val')||'continue'):'',footnoteIds:notesOf(cell),drawings:visualsOf(cell),equations:equationsOf(cell)})));}
function numberingResolver(dom){
 const abstracts=new Map(),nums=new Map(),counts=new Map();
 for(const a of q(dom,'abstractNum')){const levels=new Map();for(const l of q(a,'lvl'))levels.set(+attr(l,'ilvl'),{format:attr(q(l,'numFmt')[0],'val'),pattern:attr(q(l,'lvlText')[0],'val'),start:+attr(q(l,'start')[0],'val')||1});abstracts.set(attr(a,'abstractNumId'),levels);}
 for(const n of q(dom,'num'))nums.set(attr(n,'numId'),abstracts.get(attr(q(n,'abstractNumId')[0],'val')));
 const roman=n=>{const pairs=[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];let s='';for(const [v,c] of pairs)while(n>=v){s+=c;n-=v;}return s;};
 const render=(n,f)=>f==='lowerLetter'?String.fromCharCode(97+(n-1)%26):f==='upperLetter'?String.fromCharCode(65+(n-1)%26):f==='lowerRoman'?roman(n).toLowerCase():f==='upperRoman'?roman(n):String(n);
 return node=>{const props=q(node,'numPr')[0];if(!props)return '';const id=attr(q(props,'numId')[0],'val'),level=+attr(q(props,'ilvl')[0],'val')||0;const defs=nums.get(id),def=defs?.get(level);if(!def)return '';if(def.format==='bullet')return '• ';const c=counts.get(id)||[];c[level]=(c[level]??def.start-1)+1;for(let i=level+1;i<c.length;i++)c[i]=undefined;counts.set(id,c);return (def.pattern||'%'+(level+1)+'.').replace(/%(\d+)/g,(_,l)=>render(c[+l-1]??defs.get(+l-1)?.start??1,defs.get(+l-1)?.format))+' ';};
}

export async function readDocx(file,{signal,onProgress}={}){
  checkAbort(signal);const ab=file instanceof ArrayBuffer?file:await file.arrayBuffer();
  let zip;try{zip=await globalThis.JSZip.loadAsync(ab);}catch{throw new Error('DOCX tidak valid, rusak, atau dilindungi kata sandi. Simpan ulang dari Word sebagai .docx.');}
  const entry=zip.file('word/document.xml');if(!entry)throw new Error('Berkas ini bukan DOCX Word.');
  let unpacked=0;for(const f of Object.values(zip.files))unpacked+=f._data?.uncompressedSize||0;if(unpacked>300*1024*1024)throw new Error('Isi DOCX melebihi 300 MB. Kompres gambar atau pecah dokumen terlebih dahulu.');
  const xml=await entry.async('string');if(xml.length>45*1024*1024)throw new Error('XML DOCX terlalu besar untuk pemrosesan browser.');
  const dom=parse(xml),body=q(dom,'body')[0];if(!body)throw new Error('Isi dokumen Word tidak ditemukan.');
  const styles=zip.file('word/styles.xml');const resolveStyle=styles?styleDefinitions(parse(await styles.async('string'))):()=>({});
  const numbering=zip.file('word/numbering.xml');const prefix=numbering?numberingResolver(parse(await numbering.async('string'))):()=>'';
  const items=[];const unsupported=[];
  for(const node of bodyBlocks(body)){
    checkAbort(signal);const table=node.localName==='tbl';const raw=table?'':prefix(node)+textOf(node);const style=attr(q(node,'pStyle')[0],'val');const def=resolveStyle(style);const direct=attr(q(node,'outlineLvl')[0],'val');
    const runs=q(node,'r').filter(x=>norm(textOf(x)));const bold=runs.reduce((n,r)=>n+(q(r,'b').some(x=>!['0','false','off'].includes(attr(x,'val')))?1:0),0);
    const cells=table?tableData(node):null;const text=table?cells.map(row=>row.map(c=>c.text).join(' | ')).join('\n'):norm(raw);
    const toc=/toc|table of contents|daftar\s*isi/i.test(style+' '+def.name)||q(node,'instrText').some(x=>/\bTOC\b/.test(x.textContent))||q(node,'hyperlink').some(x=>/^_Toc/.test(attr(x,'anchor')))||/\.{3,}\s*(?:\d+|[ivxlcdm]+)\s*$/i.test(raw)||/\t\s*(?:\d+|[ivxlcdm]+)\s*$/i.test(raw);
    const drawings=visualsOf(node),equations=equationsOf(node);if(q(node,'chart','http://schemas.openxmlformats.org/drawingml/2006/chart').length)unsupported.push('Grafik Word perlu diperiksa; konversikan grafik menjadi gambar sebelum diproses.');
    const common={type:table?'table':'p',text,textWithoutMath:withoutMath(node),rawText:raw,style,outline:direct!==''?+direct+1:def.level,boldRatio:runs.length?bold/runs.length:0,isToc:toc,footnoteIds:notesOf(node),cells,drawings,equations,xml:serialize(node),page:null};
    // A manual line break is often used to combine BAB and its title in one paragraph.
    const lines=raw.split(/\n/).map(norm).filter(Boolean);
    if(!table&&lines.length>1&&/^BAB\s+(?:[IVXLCDM]+|\d+)\b/i.test(lines[0])&&lines.slice(1).every(t=>wc(t)<=18)){
      for(const line of lines)items.push({...common,index:items.length,text:line,rawText:line,drawings:[],equations:[]});
    }else if(text||drawings.length||equations.length)items.push({...common,index:items.length});
  }
  const footnotes=new Map();
  for(const [path,kind] of [['word/footnotes.xml','footnote'],['word/endnotes.xml','endnote']]){const f=zip.file(path);if(!f)continue;const d=parse(await f.async('string'));for(const n of q(d,kind)){const id=attr(n,'id');if(+id>0)footnotes.set((kind==='endnote'?'end:':'')+id,norm(textOf(n)));}}
  const relationships=new Map();const rels=zip.file('word/_rels/document.xml.rels');if(rels){for(const n of parse(await rels.async('string')).documentElement.children)relationships.set(n.getAttribute('Id'),{target:n.getAttribute('Target'),type:n.getAttribute('Type'),external:n.getAttribute('TargetMode')==='External'});}
  // Resolve Ibid against the original note order before excerpts reorder or omit notes.
  let lastFull='';for(const id of [...new Set(items.flatMap(x=>x.footnoteIds))]){const text=footnotes.get(id)||'';const repeat=text.match(/^Ibid(?:em)?\.?[\s,]*(.*)$/i);if(repeat){if(lastFull){const base=repeat[1]?lastFull.replace(/[,;]?\s*(?:hlm|hal|p|pp)\.?\s*\d+(?:[-–]\d+)?\.?$/i,''):lastFull;const resolved=repeat[1]?base+', '+repeat[1]:base;footnotes.set(id,resolved);lastFull=resolved;}else unsupported.push('Footnote Ibid tidak memiliki sumber sebelumnya yang dapat ditemukan. Periksa rujukannya.');}else if(text)lastFull=text;}
  onProgress?.({progress:1,text:'Struktur DOCX berhasil dibaca.'});
  return {items,footnotes,zip,relationships,warnings:[...new Set(unsupported)],format:'docx',filename:file.name||'Skripsi.docx',wordCount:items.reduce((n,x)=>n+wc(x.text),0)};
}
const headingRole=role=>['title','author','section','sectionCenter','subheading','keywords'].includes(role);
function pPr(role,format={}){
  const center=['title','author','identity','sectionCenter','image'].includes(role);const left=['section','subheading','bibliography','keywords','table'].includes(role);
  const line=['abstract','keywords'].includes(role)?240:role==='body'||role==='subheading'?Math.round((format.lineSpacing||1.5)*240):240;
  const before=role==='section'||role==='sectionCenter'?240:role==='subheading'?120:0;
  const after=role==='title'?300:role==='author'?60:role==='identity'?30:role==='section'||role==='sectionCenter'?120:60;
  const ind=['body','abstract'].includes(role)?`<w:ind w:firstLine="${role==='abstract'?720:425}"/>`:role==='bibliography'?'<w:ind w:left="720" w:hanging="720"/>':'';
  return `<w:pPr><w:jc w:val="${center?'center':left?'left':'both'}"/><w:spacing w:before="${before}" w:after="${after}" w:line="${line}" w:lineRule="auto"/>${ind}<w:widowControl/>${['section','sectionCenter','subheading'].includes(role)?'<w:keepNext/>':''}</w:pPr>`;
}
function makeP(text,role='body',{noteIds=[],drawings=[],equations=[],format={}}={}){
  const font=xmlEsc(format.font||'Times New Roman'),size=role==='title'?28:role==='identity'?26:role==='table'?20:Math.round((format.fontSize||12)*2);
  const rPr=`<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${font}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${headingRole(role)?'<w:b/>':''}</w:rPr>`;
  const lines=String(text||'').split(/\n/);const runs=lines.map((t,i)=>`<w:r>${rPr}${i?'<w:br/>':''}<w:t xml:space="preserve">${xmlEsc(t)}</w:t></w:r>`).join('');
  const notes=noteIds.map(id=>`<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteReference w:id="${xmlEsc(id)}"/></w:r>`).join('');
  return `<w:p>${pPr(role,format)}${runs}${equations.join('')}${notes}${drawings.map(d=>`<w:r>${d}</w:r>`).join('')}</w:p>`;
}
function tableXML(src,context){
  const cols=Math.max(1,...(src.cells||[]).map(r=>r.reduce((s,c)=>s+c.span,0))),width=Math.floor(8504/cols);
  const cell=(c)=>`<w:tc><w:tcPr><w:tcW w:w="${width*c.span}" w:type="dxa"/>${c.span>1?`<w:gridSpan w:val="${c.span}"/>`:''}${c.merge?`<w:vMerge${c.merge==='restart'?' w:val="restart"':''}/>`:''}</w:tcPr>${makeP(c.equations.length?c.textWithoutMath:c.text,'table',{...context,noteIds:c.footnoteIds.map(id=>context.noteMap.get(id)).filter(Boolean),drawings:c.drawings,equations:[]})}${c.equations.map(m=>makeP('','table',{format:context.format,equations:[m]})).join('')}</w:tc>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="8504" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(x=>`<w:${x} w:val="single" w:sz="4" w:color="B8C7C2"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid>${Array.from({length:cols},()=>`<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>${src.cells.map((row,i)=>`<w:tr>${i===0?'<w:trPr><w:tblHeader/></w:trPr>':''}${row.map(cell).join('')}</w:tr>`).join('')}</w:tbl>`;
}
export function sourceFootnotes(doc,plan){const used=new Set();for(const s of plan.sections)if(s.id!=='biblio')for(const x of s.items)for(const i of sourceIds(x))for(const id of doc.items[i]?.footnoteIds||[])used.add(id);return [...used].map(id=>({id,text:doc.footnotes?.get(id)||''})).filter(x=>x.text);}
export async function buildArticleDocx(doc,analysis,plan,metaOverride={},options={}){
  const signal=options.signal;checkAbort(signal);const zip=new globalThis.JSZip(),meta={...analysis.meta,...metaOverride},format=options.format||{};
  const usedNotes=sourceFootnotes(doc,plan),noteMap=new Map(usedNotes.map((n,i)=>[n.id,String(i+1)]));
  let content=makeP((meta.title||'ARTIKEL ILMIAH').toUpperCase(),'title',{format})+makeP(meta.author||'Nama Penulis','author',{format});
  if(meta.prodi)content+=makeP(meta.prodi,'identity',{format});if(meta.univ)content+=makeP(meta.univ,'identity',{format});
  const drawings=[];
  for(const section of plan.sections){
    if(!section.items.length)continue;content+=makeP(section.title,section.id==='abstract'?'sectionCenter':'section',{format});
    for(const item of section.items){checkAbort(signal);const src=doc.items[item.index];
      if(src?.type==='table'&&item.text==null){content+=tableXML(src,{format,noteMap});drawings.push(...src.drawings);continue;}
      const ids=sourceIds(item);const notes=[...new Set(ids.flatMap(i=>doc.items[i]?.footnoteIds||[]))].map(id=>noteMap.get(id)).filter(Boolean);
      const role=section.id==='biblio'?'bibliography':item.role==='keywords'?'keywords':section.id==='abstract'?'abstract':item.role==='subheading'?'subheading':'body';
      const visual=item.text==null&&src?.drawings||[];const math=item.text==null&&src?.equations||[];
      // Math already contributes to the analysis text; do not render it twice.
      let text=itemText(doc,item);if(math.length&&src?.textWithoutMath!=null)text=src.textWithoutMath;
      content+=makeP(text,role,{format,noteIds:notes,drawings:visual,equations:math});drawings.push(...visual);
    }
    if(section.id==='abstract'&&options.englishAbstract?.paragraphs?.length){content+=makeP('ABSTRACT','sectionCenter',{format});for(const text of options.englishAbstract.paragraphs)content+=makeP(text,'abstract',{format});if(options.englishAbstract.keywords)content+=makeP('Keywords: '+options.englishAbstract.keywords,'keywords',{format});}
  }
  const rels=[{id:'rIdStyles',type:'styles',target:'styles.xml'},{id:'rIdFooter',type:'footer',target:'footer.xml'}];
  const extraTypes=[];const seen=new Set();
  for(const drawing of drawings){const d=parse(drawing);for(const n of q(d,'blip','http://schemas.openxmlformats.org/drawingml/2006/main')){const id=n.getAttributeNS(R,'embed');if(!id||seen.has(id))continue;seen.add(id);const rel=doc.relationships?.get(id);if(!rel||rel.external)continue;
    const path=new URL(rel.target,'https://local/word/document.xml').pathname.slice(1);const entry=doc.zip?.file(path);if(!entry)continue;zip.file(path,await entry.async('uint8array'));rels.push({id,type:'image',target:rel.target});
    const ext=path.split('.').pop().toLowerCase();const mime={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',bmp:'image/bmp',tif:'image/tiff',tiff:'image/tiff',svg:'image/svg+xml',emf:'image/x-emf',wmf:'image/x-wmf'}[ext]||'application/octet-stream';extraTypes.push(`<Default Extension="${xmlEsc(ext)}" ContentType="${mime}"/>`);
  }}
  if(usedNotes.length){rels.push({id:'rIdFootnotes',type:'footnotes',target:'footnotes.xml'});zip.file('word/footnotes.xml',`<?xml version="1.0" encoding="UTF-8"?><w:footnotes ${NS}><w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>${usedNotes.map(n=>`<w:footnote w:id="${noteMap.get(n.id)}">${makeP(n.text,'table',{format})}</w:footnote>`).join('')}</w:footnotes>`);}
  const margin=Math.round((format.marginCm||3)*567);content+=`<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="720" w:footer="720"/><w:cols w:space="720"/></w:sectPr>`;
  zip.file('word/document.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${content}</w:body></w:document>`);
  zip.file('word/styles.xml',`<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`);
  zip.file('word/footer.xml',`<?xml version="1.0" encoding="UTF-8"?><w:ftr xmlns:w="${W}"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`);
  zip.file('word/_rels/document.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${REL}">${rels.map(r=>`<Relationship Id="${xmlEsc(r.id)}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${r.type}" Target="${xmlEsc(r.target)}"/>`).join('')}</Relationships>`);
  zip.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${REL}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  zip.file('docProps/core.xml',`<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xmlEsc(meta.title)}</dc:title><dc:creator>${xmlEsc(meta.author)}</dc:creator><dc:description>Artikel disusun dari skripsi dengan ZAIN.NET V2.0. Periksa isi sebelum publikasi.</dc:description></cp:coreProperties>`);
  const types=[['document','application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'],['styles','application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml'],['footer','application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml'],...(usedNotes.length?[['footnotes','application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml']]:[])];
  zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${[...new Set(extraTypes)].join('')}${types.map(([name,type])=>`<Override PartName="/word/${name}.xml" ContentType="${type}"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  checkAbort(signal);return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',compression:'DEFLATE'});
}
