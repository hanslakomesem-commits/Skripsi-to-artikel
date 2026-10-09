export const VERSION = '2.0';
export const ROLES = {abstract:'Abstrak',intro:'Pendahuluan',theory:'Kajian pustaka',method:'Metode penelitian',results:'Hasil penelitian',discussion:'Pembahasan',conclusion:'Kesimpulan',biblio:'Daftar pustaka',appendix:'Lampiran',front:'Bagian awal',unknown:'Belum terpetakan'};
export const norm = value => String(value ?? '').normalize('NFKC').replace(/[\u00ad\u200b\ufeff\ufffe]/g,'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
export const wc = value => (norm(value).match(/[\p{L}\p{N}]+(?:[’'_-][\p{L}\p{N}]+)*/gu)||[]).length;
export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const xmlEsc = value => esc(value).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');
export function checkAbort(signal){if(signal?.aborted)throw new DOMException('Proses dibatalkan.','AbortError');}
export const tick = () => new Promise(resolve=>setTimeout(resolve,0));
export function tokens(text){return (norm(text).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]).filter(t=>!STOP.has(t));}
const STOP = new Set('yang dan dari pada untuk dengan dalam ini itu adalah sebagai atau oleh akan telah dapat juga karena agar maka namun serta suatu tersebut menjadi lebih tidak ada antara bagi terhadap tentang yaitu yakni saat bila jika sudah masih sangat mereka kami kita saya dia para setiap sampai setelah sebelum melalui selama tanpa ketika sehingga merupakan dilakukan penelitian peneliti hasil berdasarkan data digunakan menggunakan memiliki mengenai terkait secara hal bagian bahwa the and with from this that into were was are for of to in is be as'.split(' '));
export function clonePlan(plan){return JSON.parse(JSON.stringify(plan));}
export function itemText(doc,item){return item.text!=null ? item.text : doc.items[item.index]?.text||'';}
export function sourceIds(item){return [...new Set(item.sourceIds || (Number.isInteger(item.index)?[item.index]:[]))];}
export function recalc(plan,doc){plan.totalWords=plan.sections.reduce((sum,s)=>sum+s.items.reduce((n,x)=>n+wc(itemText(doc,x)),0),0);return plan;}
export function safeFilename(value){return (norm(value).replace(/[^\p{L}\p{N}_-]+/gu,'_').replace(/^_+|_+$/g,'').slice(0,70)||'Mahasiswa');}
export function numericTokens(text){return norm(text).match(/(?<![\p{L}])[-+]?\d+(?:[.,:/–-]\d+)*(?:\s*%)?/gu)?.map(x=>x.replace(/\s/g,''))||[];}
export function parseJSON(text){
  let value=String(text||'').replace(/<think>[\s\S]*?<\/think>/gi,'').trim().replace(/^```(?:json)?\s*|\s*```$/g,'');
  const begin=value.indexOf('{'),end=value.lastIndexOf('}');
  if(begin<0||end<begin)throw new Error('Jawaban model belum berbentuk JSON yang valid.');
  return JSON.parse(value.slice(begin,end+1));
}
