const MAX_HTML=5*1024*1024,MAX_IMAGE=3*1024*1024;
export function publicURL(value){
  let u;try{u=new URL(value);}catch{throw Error('http 또는 https로 시작하는 기사 주소를 입력해 주세요.');}
  const host=u.hostname.toLowerCase();
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port||!host.includes('.')||/^[\d.]+$/.test(host)||host.includes(':')||/(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host)||host.endsWith('.local'))throw Error('공개된 뉴스 기사 주소를 입력해 주세요.');
  return u;
}
async function readLimited(response,limit){
  if(!response.ok)throw Error('사이트가 기사 접근을 허용하지 않았습니다. 본문과 사진을 직접 넣을 수도 있습니다.');
  if(Number(response.headers.get('content-length')||0)>limit)throw Error('자료가 너무 큽니다. 작은 사진이나 직접 입력을 이용해 주세요.');
  const reader=response.body.getReader();let n=0;const chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;n+=value.length;if(n>limit){await reader.cancel();throw Error('자료가 너무 큽니다. 직접 입력을 이용해 주세요.');}chunks.push(value);}
  const bytes=new Uint8Array(n);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
async function get(value,limit=MAX_HTML){
  let url=publicURL(value);
  for(let i=0;i<5;i++){
    let response;try{response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0 (compatible; OnePageNewspaper/1.0)','Accept':'text/html,image/*;q=0.9,*/*;q=0.8'}});}catch{throw Error('기사 사이트에 연결하지 못했습니다. 본문 붙여넣기·사진 업로드를 이용해 주세요.');}
    if([301,302,303,307,308].includes(response.status)){const next=response.headers.get('location');if(!next)break;url=publicURL(new URL(next,url).href);await response.body?.cancel();continue;}
    return {bytes:await readLimited(response,limit),response,url:url.href};
  }
  throw Error('사이트의 이동 주소를 읽지 못했습니다. 원문 주소를 확인해 주세요.');
}
const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”',hellip:'…',middot:'·',deg:'°'};
export function plain(input){return String(input||'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<\/?(?:p|div|li|h[1-6])\b[^>]*>|<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&(#x[\da-f]+|#\d+|\w+);/gi,(whole,x)=>{try{return x[0]==='#'?String.fromCodePoint(x[1].toLowerCase()==='x'?parseInt(x.slice(2),16):+x.slice(1)):entities[x]??whole;}catch{return whole;}}).split('\n').map(s=>s.replace(/[\t \u00a0]+/g,' ').trim()).filter(Boolean).join('\n');}
function firstJSONObject(text,start){
  let depth=0,string=false,escape=false;
  for(let i=start;i<text.length;i++){const c=text[i];if(string){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')string=false;}else if(c==='"')string=true;else if(c==='{')depth++;else if(c==='}'&&!--depth)return JSON.parse(text.slice(start,i+1));}
  return null;
}
function articles(d){if(Array.isArray(d))return d.flatMap(articles);if(!d||typeof d!=='object')return [];return [...([].concat(d['@type']||[]).some(t=>['NewsArticle','Article','ReportageNewsArticle'].includes(t))?[d]:[]),...articles(d['@graph'])];}
function metadata(source){const result={};for(const m of source.matchAll(/<meta\b[^>]*>/gi)){const attrs={};for(const a of m[0].matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g))attrs[a[1].toLowerCase()]=plain(a[3]);if(attrs.property||attrs.name)result[attrs.property||attrs.name]=attrs.content||'';}return result;}
function kidsDongaContent(source,url){
  const block=source.match(/<article\b[^>]*\bid\s*=\s*["']article-view-content-div["'][^>]*>([\s\S]*?)<\/article\s*>/i)?.[1];
  if(!block)return null;
  const images=[];
  for(const figure of block.matchAll(/<figure\b[^>]*>([\s\S]*?)<\/figure\s*>/gi)){
    const img=figure[1].match(/<img\b[^>]*>/i)?.[0];if(!img)continue;
    const attrs={};for(const a of img.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g))attrs[a[1].toLowerCase()]=plain(a[3]);
    const src=attrs['data-src']||attrs.src;if(!src)continue;
    let imageURL;try{imageURL=new URL(src,url);if(!['http:','https:'].includes(imageURL.protocol))continue;}catch{continue;}
    if(images.some(p=>p.url===imageURL.href))continue;
    const caption=plain(figure[1].match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption\s*>/i)?.[1]||attrs.alt||'');
    images.push({url:imageURL.href,caption,selected:images.length===0});
  }
  const text=block.replace(/<(script|style|figure|iframe|aside)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  const paragraphs=[...text.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)].map(m=>plain(m[1])).filter(Boolean);
  return {body:paragraphs.length?paragraphs.join('\n\n'):plain(text),images};
}
export function parseArticle(source,url){
  const meta=metadata(source),host=new URL(url).hostname;
  const out={url,title:meta['og:title']||plain(source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]),subtitle:'',body:'',extra:'',questions:'',images:[],source:meta['og:site_name']||host,date:(meta['article:published_time']||'').slice(0,10),author:'',warnings:[]};
  const fusion=/Fusion\.globalContent\s*=\s*/.exec(source);let d;
  if(fusion)try{d=firstJSONObject(source,fusion.index+fusion[0].length);}catch{}
  if(d?.content_elements){
    if(![undefined,null,'',0,'0'].includes(d.content_restrictions?.content_code))throw Error('이 기사는 이용이 제한되어 있습니다. 이용 가능한 본문을 직접 넣어 주세요.');
    out.title=plain(d.headlines?.basic||out.title);out.subtitle=plain(d.subheadlines?.basic);out.date=(d.display_date||d.first_publish_date||'').slice(0,10);
    out.author=(d.credits?.by||[]).map(x=>plain(x.additional_properties?.original?.byline||x.name)).join(', ');
    if(host==='www.chosun.com'||host==='chosun.com')out.source=new URL(url).pathname.startsWith('/kid/')?'어린이조선일보':'조선일보';
    const body=[],extra=[],questions=[];
    for(const el of d.content_elements){const text=plain(el.content);
      if(['text','header','heading'].includes(el.type)&&text)body.push(text);
      else if(el.type==='raw_html'&&el.content?.includes('kid-literacybox'))extra.push(text);
      else if(el.type==='list')questions.push(...(el.items||[]).map(x=>plain(x.content)).filter(Boolean));
      else if(el.type==='image'&&el.url&&el.width/Math.max(1,el.height)<5)out.images.push({url:el.resizedUrls?.article_lg||el.url,caption:plain(el.caption),selected:out.images.length===0});
    }
    out.body=body.join('\n\n');out.extra=extra.join('\n\n');out.questions=questions.join('\n');
  }else{
    const candidates=[];for(const script of source.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))try{candidates.push(...articles(JSON.parse(script[1])));}catch{}
    const article=candidates.sort((a,b)=>String(b.articleBody||'').length-String(a.articleBody||'').length)[0];
    if(article){if([false,'false','False'].includes(article.isAccessibleForFree))throw Error('유료·구독 기사는 자동으로 가져올 수 없습니다. 이용 가능한 본문을 직접 넣어 주세요.');out.title=plain(article.headline||out.title);out.body=plain(article.articleBody);out.date=String(article.datePublished||out.date).slice(0,10);out.source=plain(article.publisher?.name||out.source);}
    const kidsDonga=host==='kids.donga.com'?kidsDongaContent(source,url):null;
    if(kidsDonga?.body){out.body=kidsDonga.body;out.images=kidsDonga.images;out.source='어린이동아';}
    if(!out.body){const block=source.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];if(block){out.body=[...block.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>plain(m[1])).filter(p=>p.length>35).join('\n\n');if(out.body)out.warnings.push('본문 영역에서 추출했습니다. 누락이나 광고 문구가 없는지 원문과 확인해 주세요.');}}
    if(!out.body)out.warnings.push('제목과 대표 사진만 가져왔습니다. 본문은 직접 붙여넣어 주세요.');
    if(!out.images.length&&meta['og:image'])out.images=[{url:new URL(meta['og:image'],url).href,caption:'',selected:true}];
  }
  out.images=out.images.slice(0,6);return out;
}
function base64(bytes){let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);}
export async function loadArticle(url){
  const {bytes,response,url:finalURL}=await get(url);let text;const charset=response.headers.get('content-type')?.match(/charset=([\w-]+)/i)?.[1]||'utf-8';
  try{text=new TextDecoder(charset,{fatal:true}).decode(bytes);}catch{text=new TextDecoder('utf-8').decode(bytes);}
  const out=parseArticle(text,finalURL);
  for(const img of out.images){try{const {bytes,response}=await get(new URL(img.url,finalURL).href,MAX_IMAGE);let type=response.headers.get('content-type')?.split(';')[0];
      const sig=String.fromCharCode(...bytes.subarray(0,12));
      if(bytes[0]===255&&bytes[1]===216)type='image/jpeg';else if(bytes[0]===137&&sig.slice(1,4)==='PNG')type='image/png';else if(sig.startsWith('GIF8'))type='image/gif';else if(sig.startsWith('RIFF')&&sig.slice(8)==='WEBP')type='image/webp';else throw Error();
      img.data=`data:${type};base64,${base64(bytes)}`;
    }catch{img.selected=false;img.error='사진을 가져오지 못했습니다. 파일로 업로드해 주세요.';}}
  if(out.images.some(x=>x.error))out.warnings.push('일부 사진을 가져오지 못했습니다. 사진 파일을 직접 올릴 수 있습니다.');
  return out;
}
