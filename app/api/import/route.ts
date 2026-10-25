import { loadArticle } from '../../lib/article.mjs';
export async function POST(request: Request) {
  try {
    const origin=request.headers.get('origin');
    if(origin && origin!==new URL(request.url).origin) return Response.json({error:'같은 편집실에서 요청해 주세요.'},{status:403});
    if(request.headers.get('x-editor-token')!=='web-editor-v1') return Response.json({error:'화면을 새로고침해 주세요.'},{status:403});
    if(Number(request.headers.get('content-length')||0)>12000) return Response.json({error:'기사 주소가 너무 깁니다.'},{status:400});
    const input=await request.text();if(input.length>12000)throw Error('기사 주소가 너무 깁니다.');
    const {url}=JSON.parse(input);
    return Response.json(await loadArticle(String(url||'')),{headers:{'cache-control':'no-store'}});
  } catch(error) {
    return Response.json({error:error instanceof Error?error.message:'기사를 가져오지 못했습니다.'},{status:400,headers:{'cache-control':'no-store'}});
  }
}
