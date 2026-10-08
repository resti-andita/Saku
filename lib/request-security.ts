/**
 * Pemeriksaan same-origin untuk permintaan yang mengubah data (CSRF).
 *
 * JANGAN memakai `new URL(req.url).origin` sebagai pembanding: Next menormalkan
 * req.url ke host internalnya sendiri (mis. http://localhost:3000), sehingga di
 * server dengan port/domain berbeda pemeriksaan ini selalu gagal dan SEMUA
 * permintaan POST ditolak 403.
 *
 * Pembanding yang benar adalah host yang benar-benar diminta klien, yaitu header
 * Host — atau X-Forwarded-Host bila berada di belakang reverse proxy.
 */
export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  if (req.headers.get('sec-fetch-site') === 'cross-site') return false;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!host) return false;
  const proto = (req.headers.get('x-forwarded-proto') || 'http').split(',')[0].trim();
  return origin.toLowerCase() === `${proto}://${host}`.toLowerCase();
}
