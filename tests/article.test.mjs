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
test('Kids Donga reads the body after author/tool articles and preserves photo captions',()=>{
  const source=`<meta property="og:image" content="https://cdn.kids.donga.com/cover.jpg">
  <script type="application/ld+json">{"@type":"NewsArticle","headline":"달의 변화","datePublished":"2026-10-30"}</script>
  <article class="group-left"><p>기자 정보</p></article><article class="tool-box">공유</article>
  <article class="article-veiw-body" id="article-view-content-div" itemprop="articleBody">
  <figure><img src="/photo/moon.jpg"><figcaption>달 사진. NASA 제공</figcaption></figure>
  <p>짧은 첫 문단.</p><p>두 번째 문단에는 <strong>관측 자료</strong>가 있어요.</p>
  <figure><img src="/photo/moon2.jpg"><figcaption>탐사 사진 설명</figcaption></figure>
  <script>광고 코드</script></article><p>관련 기사 광고</p>`;
  const d=parseArticle(source,'https://kids.donga.com/news/articleView.html?idxno=170169');
  assert.equal(d.body,'짧은 첫 문단.\n\n두 번째 문단에는 관측 자료가 있어요.');
  assert.equal(d.source,'어린이동아');assert.equal(d.date,'2026-10-30');
  assert.deepEqual(d.images.map(p=>[p.url,p.caption,p.selected]),[['https://kids.donga.com/photo/moon.jpg','달 사진. NASA 제공',true],['https://kids.donga.com/photo/moon2.jpg','탐사 사진 설명',false]]);
  assert.deepEqual(d.warnings,[]);
});
test('Kids Donga respects restricted structured data and limits dedicated parsing to its host',()=>{
  const body='<article id="article-view-content-div"><p>본문</p></article>';
  assert.throws(()=>parseArticle('<script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":false}</script>'+body,'https://kids.donga.com/news/articleView.html?idxno=1'));
  assert.equal(parseArticle('<article>도구</article>'+body,'https://other.example.com/news').body,'');
});
