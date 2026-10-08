import fs from 'node:fs/promises';
import path from 'node:path';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { createReceipt, receiptById } from '@/lib/storage';
import { filesDir } from '@/lib/db';
import { sameOrigin } from '@/lib/request-security';
import { MAX_RECEIPT_SIZE, RECEIPT_TYPES, validReceipt } from '@/lib/receipt-validation';

export const dynamic = 'force-dynamic';
const UUID = /^[a-f0-9-]{36}$/;
const WRONG = 'Gunakan JPG, PNG, WebP, atau PDF hingga 10 MB.';

/**
 * Unggah struk ke disk lokal, satu langkah.
 *
 * Dulu alurnya dua langkah (prepare → unggah langsung ke Supabase Storage →
 * complete). Sekarang berkas dikirim ke route ini, dan isinya diperiksa
 * (ukuran + magic bytes) SEBELUM ditulis ke disk — berkas yang tidak sesuai
 * tidak pernah meninggalkan jejak.
 */
export async function POST(req: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Masuk diperlukan.' }, { status: 401 });
  if (!sameOrigin(req)) return Response.json({ error: 'Ditolak.' }, { status: 403 });
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw Error('File struk tidak ditemukan.');
    if (!RECEIPT_TYPES.includes(file.type)) throw Error(WRONG);
    if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_RECEIPT_SIZE) throw Error(WRONG);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validReceipt(bytes, file.type)) throw Error('Isi file tidak sesuai format atau ukuran.');
    const id = crypto.randomUUID();
    const name = file.name.trim().slice(0, 180) || 'struk';
    await fs.writeFile(path.join(filesDir(), id), bytes, { mode: 0o600 });
    createReceipt({ id, name, type: file.type, size: file.size, actor: user.email });
    return Response.json({ id, name }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('Receipt upload failed', e);
    return Response.json({ error: e instanceof Error ? e.message : 'Unggah gagal. Coba lagi.' }, { status: 400 });
  }
}

/** Sajikan struk hanya kepada pengguna yang sudah masuk. */
export async function GET(req: Request) {
  if (!(await getChatGPTUser())) return new Response('Masuk diperlukan', { status: 401 });
  try {
    const id = new URL(req.url).searchParams.get('id') || '';
    if (!UUID.test(id)) return new Response('Tidak ditemukan', { status: 404 });
    const row = receiptById(id);
    if (!row) return new Response('Tidak ditemukan', { status: 404 });
    const buffer = await fs.readFile(path.join(filesDir(), row.id));
    return new Response(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength), {
      headers: {
        'Content-Type': row.type,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.name)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Struk belum bisa dimuat', { status: 503 });
  }
}
