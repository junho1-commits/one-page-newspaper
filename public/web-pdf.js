/* Bundled libraries: PDF contents stay in the visitor's browser. */
async function loadPDFLibrary(src,ready){
  if(ready())return;
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('PDF 도구를 불러오지 못했습니다. 인쇄 버튼을 이용해 주세요.'));document.head.append(s);});
}
window.createBrowserPDF=async function(paper){
  await Promise.all([loadPDFLibrary('/vendor/html2canvas.min.js',()=>!!window.html2canvas),loadPDFLibrary('/vendor/jspdf.umd.min.js',()=>!!window.jspdf)]);
  await document.fonts.ready;
  const clone=paper.cloneNode(true);clone.removeAttribute('id');clone.removeAttribute('style');clone.classList.add('export-snapshot');
  for(const e of clone.querySelectorAll('[contenteditable]')){e.removeAttribute('contenteditable');e.removeAttribute('title');}
  const wrapper=document.createElement('div');wrapper.style.cssText='position:fixed;left:-12000px;top:0;width:794px;pointer-events:none;';wrapper.append(clone);document.body.append(wrapper);
  try{
    // Preserve contain/cover because html2canvas does not implement object-fit.
    for(const image of clone.querySelectorAll('img')){
      await image.decode();const w=image.clientWidth,h=image.clientHeight;const c=document.createElement('canvas');c.width=Math.ceil(w*2.5);c.height=Math.ceil(h*2.5);const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);const scale=(image.style.objectFit==='cover'?Math.max:Math.min)(c.width/image.naturalWidth,c.height/image.naturalHeight);const dw=image.naturalWidth*scale,dh=image.naturalHeight*scale;ctx.drawImage(image,(c.width-dw)/2,(c.height-dh)/2,dw,dh);image.src=c.toDataURL('image/png');await image.decode();
    }
    const canvas=await window.html2canvas(clone,{scale:2.5,backgroundColor:'#ffffff',logging:false,useCORS:false,allowTaint:false,windowWidth:1200,onclone:doc=>{for(const e of doc.querySelectorAll('.editable-text'))e.style.outline='none';}});
    const pdf=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});pdf.addImage(canvas.toDataURL('image/jpeg',.97),'JPEG',0,0,210,297);pdf.setProperties({title:paper.querySelector('.headline')?.textContent||'한 장 신문',creator:'한 장 신문'});return pdf.output('blob');
  }finally{wrapper.remove();}
};
