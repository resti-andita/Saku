export function sameOrigin(req:Request){const origin=req.headers.get('origin');return !!origin&&origin===new URL(req.url).origin&&req.headers.get('sec-fetch-site')!=='cross-site';}
