export function GET() {
  return Response.json({token:'web-editor-v1',pdf:'browser'}, {headers:{'cache-control':'no-store'}});
}
