import editor from './editor.html?raw';
export function GET() {
  return new Response(editor, {headers: {'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
