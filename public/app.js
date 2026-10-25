'use strict';
const $ = id => document.getElementById(id);
const fields = ['url','title','subtitle','source','date','author','body','extra','questions','columns','font','font-size','image-height','image-fit','image-layout','theme','auto-fit','name-line','paper-label','include-extra','include-questions'];
let lastPDFURL = '', photos = [], token = '', ready = false, fits = false, zoom = .8, fitFrame = 0, saveTimer, importing = false, exporting = false;
const paper = $('paper');
const defaultOptions = {columns:'2',font:'sans','font-size':12,'image-height':58,'image-fit':'contain','image-layout':'inline',theme:'green','auto-fit':true,'name-line':true,'paper-label':'오늘의 신문 읽기'};
function element(tag, cls, text) { const e=document.createElement(tag); if(cls)e.className=cls; if(text!==undefined)e.textContent=text; return e; }
function value(id) { const e=$(id); return e.type==='checkbox'?e.checked:e.value; }
function set(id,v) { const e=$(id); if(e.type==='checkbox')e.checked=!!v; else e.value=v??''; }
function notify(text, type='') { $('notice').hidden=!text; $('notice').textContent=text; $('notice').className=type; }
function state() { const data={version:1,photos}; for(const id of fields)data[id]=value(id); return data; }
function saveDraft() { clearTimeout(saveTimer); saveTimer=setTimeout(()=>{try{localStorage.setItem('one-page-news-draft-v1',JSON.stringify(state()));$('save-state').textContent='이 브라우저에 임시 저장됨';}catch{$('save-state').textContent='편집 파일로 저장해 주세요';}},700); }
function cleanState(data) {
  if(!data || typeof data!=='object' || Array.isArray(data)) throw Error('편집 파일 형식을 확인해 주세요.');
  const result={};
  for(const id of fields) {
    const e=$(id), v=data[id]??defaultOptions[id]??(e.type==='checkbox'?false:'');
    if(e.type==='checkbox') result[id]=v===true;
    else if(e.type==='range') result[id]=Math.max(+e.min,Math.min(+e.max,Number(v)||+e.min));
    else if(e.tagName==='SELECT') result[id]=[...e.options].some(o=>o.value===String(v))?String(v):e.options[0].value;
    else result[id]=String(v).slice(0,['body','extra','questions'].includes(id)?100000:1000);
  }
  let selected=0;
  result.photos=(Array.isArray(data.photos)?data.photos:[]).slice(0,8).filter(p=>p&&typeof p.data==='string'&&/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(p.data)&&p.data.length<12*1024*1024).map(p=>({data:p.data,caption:String(p.caption||'').slice(0,3000),selected:!!p.selected&&++selected<=3}));
  return result;
}
function restore(data) { const d=cleanState(data); for(const id of fields)set(id,d[id]); photos=d.photos; updateExtras();renderPhotos();render(); }
function updateExtras(){ $('extras').hidden=!(value('extra')||value('questions')); }
function editable(node,field,photo=null){
  node.contentEditable='plaintext-only';node.spellcheck=false;node.classList.add('editable-text');
  node.dataset.editField=field;node.setAttribute('aria-label',photo===null?({'title':'지면에서 기사 제목 편집','body':'지면에서 기사 본문 편집','extra':'지면에서 추가 읽을거리 편집','questions':'지면에서 생각 문제 편집','subtitle':'지면에서 부제 편집','paper-label':'지면 이름 편집'}[field]||field):'지면에서 사진 설명 편집');
  node.title='눌러서 글자를 직접 고칠 수 있어요';
  node.addEventListener('input',()=>{
    if(photo!==null){photo.caption=node.innerText;const index=photos.indexOf(photo);const caption=$('photos').querySelectorAll('textarea')[index];if(caption)caption.value=photo.caption;}
    else if(['body','extra','questions'].includes(field)){set(field,[...paper.querySelectorAll(`[data-edit-field="${field}"]`)].map(p=>p.innerText.replace(/\r/g,'')).join('\n\n'));}
    else set(field,node.innerText.replace(/\r/g,''));
    $('char-count').textContent=value('body').replace(/\s/g,'').length.toLocaleString()+'자';
    fits=false;updateExport();scheduleFit();saveDraft();
  });
  node.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();node.blur();}});
  return node;
}
function addParas(target,text,field){const paras=text.split(/\n\s*\n/).filter(p=>p.trim());if(!paras.length)paras.push('');for(const p of paras)target.append(editable(element('p','',p.trim()),field));}
function render(){
  fits=false; updateExport(); cancelAnimationFrame(fitFrame);
  paper.replaceChildren();paper.className='paper'+(value('theme')==='ink'?' theme-ink':'');
  const mast=element('header','masthead');mast.append(editable(element('span','paper-label',value('paper-label')||'오늘의 신문 읽기'),'paper-label'));
  if(value('name-line')){
    const names=element('div','name-line');names.setAttribute('aria-label','학생이 직접 적는 학년, 반, 이름 빈칸');
    for(const [label,width] of [['학년','short'],['반','short'],['이름','long']]){
      const field=element('span','student-field'),blank=element('span','write-space '+width);
      if(label==='이름')field.append(document.createTextNode(label+' '),blank);else field.append(blank,document.createTextNode(' '+label));
      names.append(field);
    }
    mast.append(names);
  }
  paper.append(mast);
  $('char-count').textContent=value('body').replace(/\s/g,'').length.toLocaleString()+'자';
  $('font-size-value').textContent=value('font-size')+' pt';$('image-height-value').textContent=value('image-height')+' mm';
  if(!value('title').trim()&&!value('body').trim()){
    const empty=element('div','empty-paper');empty.append(element('strong','','한 장에 담는 세상'),element('p','','기사 링크를 불러오거나\n제목과 본문을 직접 입력해 보세요.'));
    paper.append(empty);$('fit-status').textContent='내용을 입력하면 미리보기가 표시됩니다.';$('fit-status').className='';return;
  }
  paper.append(editable(element('h1','headline',value('title')),'title'));
  if(value('subtitle'))paper.append(editable(element('p','subtitle',value('subtitle')),'subtitle'));
  paper.append(element('div','byline',[value('source'),value('author'),value('date')].filter(Boolean).join('  ·  ')));
  const selected=photos.filter(p=>p.selected&&p.data);
  const region=element('section','body-region'),body=element('div','article-text'+(value('font')==='serif'?' serif':''));body.style.columnCount=value('columns');body.style.fontSize=value('font-size')+'pt';
  if(selected.length){const row=element('section','photo-row');for(const p of selected){const figure=element('figure'),img=element('img');img.src=p.data;img.alt=p.caption||'기사 사진';img.style.height=value('image-height')+'mm';img.style.objectFit=value('image-fit');img.addEventListener('load',scheduleFit,{once:true});img.addEventListener('error',()=>{notify('손상된 사진이 있습니다. 해당 사진을 해제한 뒤 다시 저장해 주세요.','error');fits=false;updateExport();});figure.append(img);if(p.caption)figure.append(editable(element('figcaption','',p.caption),'caption',p));row.append(figure);}if(value('image-layout')==='inline')body.append(row);else paper.append(row);}
  addParas(body,value('body'),'body');
  if(value('include-extra')&&value('extra')){body.append(element('h2','','더 읽어 보기'));addParas(body,value('extra'),'extra');}
  if(value('include-questions')&&value('questions')){body.append(element('h2','','생각해 보기'));addParas(body,value('questions'),'questions');}
  region.append(body);paper.append(region);
  const footer=element('footer','paper-footer');footer.append(element('span','footer-label','기사 출처'),element('span','source-details',[value('source'),value('date'),value('url')].filter(Boolean).join(' · ')),element('span','page-number','01'));paper.append(footer);
  scheduleFit();saveDraft();
}
function scheduleFit(){cancelAnimationFrame(fitFrame);fitFrame=requestAnimationFrame(fitText);}
function overflow(){const b=paper.querySelector('.article-text'),r=paper.querySelector('.body-region');return !b||!r||r.clientHeight<40||b.scrollWidth>b.clientWidth+2||b.scrollHeight>b.clientHeight+2||paper.scrollHeight>paper.clientHeight+2;}
function fitText(){
  const b=paper.querySelector('.article-text');if(!b)return;
  const target=+value('font-size');let actual=target;b.style.fontSize=actual+'pt';
  if(value('auto-fit'))while(actual>10&&overflow()){actual=Math.max(10,actual-.25);b.style.fontSize=actual+'pt';}
  const imagesReady=[...paper.querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth>0);
  fits=imagesReady&&!overflow()&&!!value('title').trim()&&!!value('body').trim();
  if(!imagesReady){$('fit-status').textContent='사진을 준비하고 있습니다…';$('fit-status').className='';}
  else if(!value('title').trim()||!value('body').trim()){$('fit-status').textContent='제목과 본문을 모두 입력해 주세요.';$('fit-status').className='overflow';}
  else if(!fits){$('fit-status').textContent='지면을 넘었습니다. 사진 높이·본문 분량을 줄이거나 한 장 자동 맞춤을 눌러 주세요.';$('fit-status').className='overflow';}
  else{$('fit-status').textContent=`한 장에 잘 들어갑니다 · 본문 ${Number(actual.toFixed(2))}pt${actual<target?' (자동 조정)':''}`;$('fit-status').className='fits';}
  updateExport();
}
function updateExport(){$('download').disabled=!ready||!fits||exporting||importing;$('print').disabled=!fits||importing;}
function renderPhotos(){
  $('photos').replaceChildren();$('no-photos').hidden=photos.length>0;
  photos.forEach((p,i)=>{
    const card=element('div','photo-card'+(p.selected?' selected':'')),thumb=element('img');if(p.data)thumb.src=p.data;thumb.alt='기사 사진 '+(i+1);card.append(thumb);
    const content=element('div'),actions=element('div','photo-actions'),label=element('label','check'),check=document.createElement('input');check.type='checkbox';check.checked=p.selected;check.disabled=!p.data;label.append(check,document.createTextNode('지면에 넣기'));const remove=element('button','remove-photo','삭제');remove.type='button';remove.setAttribute('aria-label',`사진 ${i+1} 삭제`);actions.append(label,remove);content.append(actions);
    check.addEventListener('change',()=>{if(check.checked&&photos.filter(x=>x.selected).length>=3){check.checked=false;notify('사진은 최대 3장까지 선택할 수 있습니다.','error');return;}p.selected=check.checked;card.classList.toggle('selected',p.selected);render();});
    remove.addEventListener('click',()=>{photos.splice(i,1);renderPhotos();render();});
    const caption=document.createElement('textarea');caption.rows=2;caption.placeholder='사진 설명 · 출처';caption.value=p.caption||'';caption.setAttribute('aria-label',`사진 ${i+1} 설명`);caption.addEventListener('input',()=>{p.caption=caption.value;render();});content.append(caption);if(p.error)content.append(element('p','',p.error));card.append(content);$('photos').append(card);
  });
}
async function api(path,data){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Token':token},body:JSON.stringify(data)});if(!r.ok){let message='처리하지 못했습니다.';try{message=(await r.json()).error||message;}catch{}throw Error(message);}return r;}
function applyArticle(d){
  for(const id of ['title','subtitle','source','date','author','body','extra','questions'])set(id,d[id]||'');
  set('url',d.url||value('url'));set('include-extra',false);set('include-questions',false);
  photos=(d.images||[]).map(x=>({...x,selected:!!x.selected&&!!x.data}));updateExtras();renderPhotos();render();
  const count=photos.filter(p=>p.data).length;notify([`기사를 가져왔습니다. 본문과 사진 ${count}장을 확인해 주세요.`,...(d.warnings||[])].join('\n'),d.warnings?.length?'error':'');
}
$('import').addEventListener('click',async()=>{
  if(importing)return;const url=value('url').trim();if(!/^https?:\/\//i.test(url)){notify('http 또는 https로 시작하는 기사 주소를 넣어 주세요.','error');return;}
  importing=true;$('import').disabled=true;$('sample').disabled=true;updateExport();notify('제목·본문·사진을 불러오고 있습니다…','busy');
  try{applyArticle(await(await api('/api/import',{url})).json());}catch(e){notify(e.message,'error');}finally{importing=false;$('import').disabled=false;$('sample').disabled=false;updateExport();}
});
async function sample(){try{const r=await fetch('/sample.json');if(!r.ok)throw Error('예제 파일이 없습니다. 기사 링크를 불러와 주세요.');applyArticle(await r.json());}catch(e){notify(e.message,'error');}}
$('sample').addEventListener('click',sample);
for(const id of fields)$(id).addEventListener('input',()=>{updateExtras();render();});
function setZoom(v){zoom=Math.max(.35,Math.min(1.3,v));paper.style.transform=`scale(${zoom})`;$('paper-wrap').style.width=(210*96/25.4*zoom)+'px';$('paper-wrap').style.height=(297*96/25.4*zoom)+'px';$('zoom-value').textContent=Math.round(zoom*100)+'%';}
function fitZoom(){const preview=document.querySelector('.preview-scroll');const width=preview.clientWidth-64,height=preview.clientHeight-64;setZoom(Math.min(.9,width/(210*96/25.4),height/(297*96/25.4)));}
$('zoom-out').addEventListener('click',()=>setZoom(zoom-.1));$('zoom-in').addEventListener('click',()=>setZoom(zoom+.1));window.addEventListener('resize',()=>{fitZoom();scheduleFit();});
$('fit').addEventListener('click',()=>{set('auto-fit',true);render();fitText();let h=+value('image-height');while(!fits&&h>28&&photos.some(p=>p.selected)){h-=2;set('image-height',Math.max(28,h));for(const img of paper.querySelectorAll('figure img'))img.style.height=value('image-height')+'mm';fitText();}$('image-height-value').textContent=value('image-height')+' mm';saveDraft();if(!fits)notify('최소 10pt에서도 한 장을 넘습니다. 본문을 직접 다듬거나 사진을 줄여 주세요. 내용은 생략하지 않았습니다.','error');else notify('본문과 사진을 한 장 안에 맞췄습니다. 미리보기에서 읽기 편한지 확인해 주세요.');});
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function filename(ext){return (value('title').trim()||'한 장 신문').replace(/[\\/:*?"<>|\x00-\x1f]/g,'').slice(0,70)+ext;}
$('download').addEventListener('click',async()=>{fitText();if(!fits)return;exporting=true;updateExport();$('download').textContent='PDF 만드는 중…';notify('미리보기와 같은 A4 PDF를 만들고 있습니다…','busy');try{const blob=await window.createBrowserPDF(paper);downloadBlob(blob,filename('.pdf'));notify('PDF를 저장했습니다. 브라우저의 다운로드 목록에서 열 수 있습니다. ');if(lastPDFURL)URL.revokeObjectURL(lastPDFURL);lastPDFURL=URL.createObjectURL(blob);const link=document.createElement('a');link.href=lastPDFURL;link.target='_blank';link.textContent='PDF 미리보기';link.id='last-pdf';$('notice').append(link);}catch(e){notify(e.message,'error');}finally{exporting=false;$('download').innerHTML='PDF 저장 <span>↗</span>';updateExport();}});
$('print').addEventListener('click',()=>{fitText();if(fits)window.print();});
$('save-project').addEventListener('click',()=>{downloadBlob(new Blob([JSON.stringify(state(),null,2)],{type:'application/json'}),filename('.json'));notify('편집 파일을 저장했습니다. 나중에 사진과 글을 그대로 이어서 편집할 수 있습니다.');});
$('open-project').addEventListener('click',()=>$('project-file').click());
$('project-file').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>40*1024*1024)throw Error('40MB 이하 편집 파일을 열어 주세요.');restore(JSON.parse(await f.text()));notify('저장한 편집 내용을 열었습니다.');}catch(err){notify('편집 파일을 읽을 수 없습니다. '+err.message,'error');}e.target.value='';});
$('upload').addEventListener('click',()=>$('photo-file').click());
async function readImage(file){
  if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))throw Error('JPG, PNG, WebP, GIF 사진을 선택해 주세요.');
  if(file.size>20*1024*1024)throw Error('사진 한 장은 20MB 이하여야 합니다.');
  const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
  const img=new Image();img.src=data;await img.decode();if(img.width*img.height>80*1000*1000)throw Error('사진 해상도가 너무 큽니다. 작은 사진을 선택해 주세요.');
  const scale=Math.min(1,1800/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  return {data:canvas.toDataURL('image/png'),caption:'',selected:photos.filter(p=>p.selected).length<3};
}
$('photo-file').addEventListener('change',async e=>{try{for(const f of e.target.files){if(photos.length>=8)throw Error('사진 보관함은 최대 8장입니다. 기존 사진을 삭제해 주세요.');photos.push(await readImage(f));}notify('사진을 추가했습니다. 사진 설명에 출처도 적어 주세요.');}catch(err){notify(err.message||'사진을 읽을 수 없습니다.','error');}finally{e.target.value='';renderPhotos();render();}});
async function init(){
  try{const c=await(await fetch('/api/config')).json();token=c.token;ready=true;if(!c.pdf)notify('PDF 저장 도구를 불러오지 못했습니다. 인쇄 버튼에서도 PDF로 저장할 수 있습니다.');
    let restored=false;try{const draft=localStorage.getItem('one-page-news-draft-v1');if(draft){restore(JSON.parse(draft));restored=true;}}catch{}
    if(!restored)await sample();fitZoom();updateExport();
  }catch{render();fitZoom();notify('편집실에 연결하지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.','error');}
}
init();
