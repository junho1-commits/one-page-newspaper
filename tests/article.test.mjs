import test from 'node:test';
import assert from 'node:assert/strict';
import {parseArticle,plain,publicURL} from '../app/lib/article.mjs';
test('Arc JSON preserves paragraphs and separates optional material',()=>{
  const data={headlines:{basic:'제목 {괄호} &amp; 글'},content_elements:[{type:'text',content:'첫 문단'},{type:'text',content:'둘째 문단'},{type:'raw_html',content:'<div class="kid-literacybox">추가 읽기</div>'},{type:'list',items:[{content:'질문'}]},{type:'image',url:'https://example.com/photo.jpg',width:800,height:600},{type:'image',url:'https://example.com/banner.jpg',width:2400,height:100}]};
  const d=parseArticle('Fusion.globalContent='+JSON.stringify(data)+'; unrelated()', 'https://www.chosun.com/kid/test/');
  assert.equal(d.title,'제목 {괄호} & 글');assert.equal(d.body,'첫 문단\n\n둘째 문단');assert.equal(d.extra,'추가 읽기');assert.equal(d.questions,'질문');assert.equal(d.images.length,1);
});
test('JSON-LD graph and restricted articles',()=>{
  const d=parseArticle('<script type="application/ld+json">'+JSON.stringify({'@graph':[{'@type':'NewsArticle',headline:'뉴스',articleBody:'본문'}]})+'</script>','https://example.com/news');assert.equal(d.body,'본문');
  assert.throws(()=>parseArticle('<script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":false}</script>','https://example.com/news'));
});
test('Private and non-web URLs are rejected',()=>{for(const u of ['file:///a','http://localhost/a','http://127.0.0.1/','http://[::1]/','http://a.local/','https://user:pw@example.com'])assert.throws(()=>publicURL(u));});
test('Non-article site paragraphs are not imported',()=>{assert.equal(parseArticle('<p>'+('광고 '.repeat(100))+'</p>','https://example.com/news').body,'');});
test('HTML scripts and styles are never imported as article text',()=>{assert.equal(plain('<style>bad</style><p>안녕 &amp; 친구</p><script>bad()</script>'),'안녕 & 친구');});
