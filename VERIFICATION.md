# Hasil verifikasi lokal

Snapshot latihan: kit `token-radar-01-kit/input/snapshot.json`, tanggal snapshot **2026-11-14**. Runtime: **Node v24.22.1**, Python **3.12.3** untuk server HTTP. Ini adalah pemeriksaan lokal; scorer tersegel tidak tersedia untuk dijalankan lokal.

| Pemeriksaan | Hasil |
| --- | --- |
| Baris board | 200, seluruh slug unik dan berasal dari snapshot |
| Rank | Tepat 1–200, tanpa duplikat |
| Nilai | Dolar bulat positif, maksimal 1e14, menurun menurut rank, tidak seragam |
| Watchlist | 40/40 tercakup |
| Di luar watchlist | 160 protokol |
| Referensi token tercatat | 416, terpisah dari board implied value |
| Farm steps | 6 per protokol, setiap string 20–600 karakter setelah trim |
| Sensitivitas model | Perubahan TVL, pertumbuhan, dan usia mengubah nilai; penggantian nama tidak mengubah nilai |
| Data yang tidak tersedia | Usia tetap null untuk tampilan, memakai fallback model; pertumbuhan memakai nilai netral |
| Vendor | SHA-256 identik dengan kit asli |
| Sintaks JavaScript | `node --check` lulus pada semua file JS dashboard dan data hasil build |
| Interaksi DOM | Smoke test Node VM dengan DOM tiruan lulus untuk render, pencarian, market cap live, dialog detail, dan rute watchlist; bukan pengujian browser |
| Jaringan dashboard | Pencarian `http://` / `https://` menghasilkan nol kecocokan |
| Determinisme | Dua build fixture menghasilkan manifest path dan SHA-256 identik |
| Dossier fixture | Cocok byte-per-byte dengan `buildDossier(output, {text_max_bytes:65536})`; sumber tidak terpotong |
| Gambar fixture | Jalur 3 dan 4 gambar berhasil; menggunakan gambar starter hanya di direktori sementara yang diabaikan Git |
| Tanpa gambar asli | Build default menolak dan tidak membuat dossier; mode `--preview` berhasil |
| HTTP lokal | `/dashboard/`, `/dashboard/app.css`, `/dashboard/app.js`, `/data.js`, `/board.json`: semuanya 200 |

Ukuran akhir: **3 file dashboard, 45.234 byte** (sumber seluruhnya masuk dossier), **board 379.334 byte**, dan **dossier fixture 720.963 byte**. Hasil final verifikasi seluruh pemeriksaan di atas lulus. Laporan yang dapat diulang tersedia melalui `node scripts/verify.ts /home/hatch/workspace/makefun/kit/token-radar-01-kit`, disimpan sebagai `out/verification.json`. Board hasil latihan tersimpan di root sebagai `board.json`; output pratinjau tersedia di `out/`.

Tidak ada screenshot baru yang dibuat atau dimasukkan ke entri. `screenshots/` hanya memiliki `.gitkeep`. Karena brief menyatakan gambar akan diambil kemudian dari Chrome asli, **gate screenshots serta dossier final belum dapat dinyatakan lulus**. Jalur kode dossier telah diuji memakai fixture; fixture tersebut bukan screenshot dashboard SIGNAL dan bukan artefak untuk submit.

Browser Chrome/Chromium/Firefox dan paket otomasi browser tidak tersedia pada runtime ini. Karena itu tampilan visual di browser serta screenshot asli belum diverifikasi. Pengujian HTTP, sintaks, data, dan build tidak menggantikan pemeriksaan visual.

Cara membuka dashboard lokal dan langkah penambahan screenshot final dijelaskan di `README.md`. Tidak ada submit, remote, atau push.
