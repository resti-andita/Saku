#!/usr/bin/env bash
# Uji end-to-end Saku versi SQLite. Dijalankan terhadap server produksi yang hidup.
set -u
PORT="${PORT:-4300}"
B="http://127.0.0.1:$PORT"
O="Origin: $B"
D=/home/ubuntu/.hermes/cache/scratch/saku-run
J="$D/jar.txt"
pass=0; fail=0
chk(){ if [ "$2" = "$3" ]; then printf "  PASS  %-52s %s\n" "$1" "$2"; pass=$((pass+1)); else printf "  FAIL  %-52s harap=%s dapat=%s\n" "$1" "$2" "$3"; fail=$((fail+1)); fi }
code(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "=== A. Tanpa masuk: harus ditolak ==="
chk "GET /  -> redirect ke /login" 307 "$(code "$B/")"
chk "GET /api/ledger -> 401" 401 "$(code "$B/api/ledger")"
chk "GET /api/team -> 401" 401 "$(code "$B/api/team")"
chk "GET /api/receipts?id=x -> 401" 401 "$(code "$B/api/receipts?id=x")"
chk "GET /login tampil" 200 "$(code "$B/login")"

echo "=== B. Masuk dengan akun salah ==="
chk "password salah -> 401" 401 "$(code -X POST -H "$O" -H 'Content-Type: application/json' -d '{"email":"test@example.com","password":"salah-sekali"}' "$B/api/auth/login")"
chk "email tidak di allowlist -> 401" 401 "$(code -X POST -H "$O" -H 'Content-Type: application/json' -d '{"email":"orang-lain@example.com","password":"apapun123456"}' "$B/api/auth/login")"
chk "login tanpa Origin (CSRF) -> 403" 403 "$(code -X POST -H 'Content-Type: application/json' -d '{"email":"test@example.com","password":"RahasiaUji123"}' "$B/api/auth/login")"

echo "=== C. Masuk dengan akun benar ==="
chk "login benar -> 200" 200 "$(code -c "$J" -X POST -H "$O" -H 'Content-Type: application/json' -d '{"email":"test@example.com","password":"RahasiaUji123"}' "$B/api/auth/login")"
grep -q saku_session "$J" && chk "cookie sesi diterbitkan" ya ya || chk "cookie sesi diterbitkan" ya tidak

echo "=== D. Cookie asli berfungsi ==="
chk "GET /api/ledger -> 200" 200 "$(code -b "$J" "$B/api/ledger")"
chk "GET / -> 200" 200 "$(code -b "$J" "$B/")"
echo "=== E. Cookie palsu ditolak ==="
chk "cookie karangan -> 401" 401 "$(code -b 'saku_session=palsu-sekali' "$B/api/ledger")"

echo "=== F. Tulis data (trip baru) ==="
RESP=$(curl -s -b "$J" -X POST -H "$O" -H 'Content-Type: application/json' \
  -d '{"action":"trip","name":"Mexico Group — Bali","start":"2026-10-10","days":10,"version":0}' "$B/api/ledger")
chk "POST /api/ledger trip -> version 1" 1 "$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("version","?"))' 2>/dev/null)"
chk "trip tersimpan di database" "Mexico Group — Bali" "$(curl -s -b "$J" "$B/api/ledger" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["data"]["trips"][0]["name"] if d["data"]["trips"] else "?")' 2>/dev/null)"

echo "=== G. Concurrency optimistik ==="
ver(){ curl -s -b "$J" "$B/api/ledger" | python3 -c 'import sys,json;print(json.load(sys.stdin)["version"])' 2>/dev/null; }
tid(){ curl -s -b "$J" "$B/api/ledger" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["trips"][0]["id"])' 2>/dev/null; }
V=$(ver); T=$(tid)
chk "tulis dengan version basi -> 409" 409 "$(code -b "$J" -X POST -H "$O" -H 'Content-Type: application/json' -d "{\"action\":\"advance\",\"tripId\":\"$T\",\"day\":1,\"amount\":3500000,\"version\":0}" "$B/api/ledger")"
chk "tulis dengan version benar -> 200" 200 "$(code -b "$J" -X POST -H "$O" -H 'Content-Type: application/json' -d "{\"action\":\"advance\",\"tripId\":\"$T\",\"day\":1,\"amount\":3500000,\"version\":$V}" "$B/api/ledger")"
chk "cash advance tersimpan" 3500000 "$(curl -s -b "$J" "$B/api/ledger" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["trips"][0]["advances"][0])' 2>/dev/null)"

echo "=== H. Unggah struk (berkas ke disk) ==="
printf '%%PDF-1.7\ncontoh struk uji\n' > "$D/struk-uji.pdf"
UP=$(curl -s -b "$J" -X POST -H "$O" -F "file=@$D/struk-uji.pdf;type=application/pdf" "$B/api/receipts")
RID=$(echo "$UP" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))' 2>/dev/null)
[ -n "$RID" ] && chk "unggah PDF asli -> id diterima" ya ya || chk "unggah PDF asli -> id diterima" ya "tidak"
chk "berkas ada di disk" ada "$([ -f "$D/receipts/$RID" ] && echo ada || echo tidak)"
chk "GET struk -> 200" 200 "$(code -b "$J" "$B/api/receipts?id=$RID")"
chk "tipe konten PDF benar" "application/pdf" "$(curl -s -o /dev/null -w '%{content_type}' -b "$J" "$B/api/receipts?id=$RID")"
chk "GET struk tanpa masuk -> 401" 401 "$(code "$B/api/receipts?id=$RID")"

echo "=== I. Unggah berkas palsu (isi tidak sesuai MIME) ==="
printf '<script>alert(1)</script>' > "$D/palsu.pdf"
chk "PDF palsu ditolak -> 400" 400 "$(code -b "$J" -X POST -H "$O" -F "file=@$D/palsu.pdf;type=application/pdf" "$B/api/receipts")"
chk "tipe tidak diizinkan (.exe) -> 400" 400 "$(code -b "$J" -X POST -H "$O" -F "file=@$D/palsu.pdf;type=application/x-msdownload" "$B/api/receipts")"

echo "=== J. Repositori tempelan struk di ledger ==="
V2=$(ver)
chk "transaksi dengan struk -> 200" 200 "$(code -b "$J" -X POST -H "$O" -H 'Content-Type: application/json' -d "{\"action\":\"transaction\",\"tripId\":\"$T\",\"version\":$V2,\"transaction\":{\"day\":1,\"description\":\"Makan siang grup\",\"vendor\":\"Warung\",\"category\":\"Makan & minum\",\"amount\":250000,\"method\":\"cash\",\"source\":\"advance\",\"note\":\"\",\"receipts\":[{\"id\":\"$RID\"}]}}" "$B/api/ledger")"
chk "struk tercatat di transaksi" 1 "$(curl -s -b "$J" "$B/api/ledger" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(len(d["data"]["trips"][0]["transactions"][0]["receipts"]))' 2>/dev/null)"
chk "id struk palsu ditolak" "Struk tidak ditemukan." "$(curl -s -b "$J" -X POST -H "$O" -H 'Content-Type: application/json' -d "{\"action\":\"transaction\",\"tripId\":\"$T\",\"version\":$(ver),\"transaction\":{\"day\":1,\"description\":\"x\",\"vendor\":\"\",\"category\":\"Operasional\",\"amount\":1000,\"method\":\"cash\",\"source\":\"advance\",\"note\":\"\",\"receipts\":[{\"id\":\"00000000-0000-0000-0000-000000000000\"}]}}" "$B/api/ledger" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("error",""))' 2>/dev/null)"

echo "=== K. Keluar ==="
chk "POST /api/auth/logout -> 303" 303 "$(code -b "$J" -X POST -H "$O" "$B/api/auth/logout")"
chk "cookie lama tidak berlaku lagi -> 401" 401 "$(code -b "$J" "$B/api/ledger")"

echo
echo "HASIL: $pass lulus, $fail gagal"
exit $((fail > 0))
