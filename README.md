[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/0xyfann/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/0xyfann/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# SIGNAL — Token launch radar

Dashboard intelijen peluncuran token untuk make.fun `token-radar-01`. Seluruh data berasal dari satu snapshot DefiLlama; halaman berjalan offline tanpa dependensi, font eksternal, atau panggilan API. Build memakai Node.js 22.18+ dan standard library saja.

## Jalankan lokal

Dari direktori repositori:

```sh
node main.ts --preview --input /home/hatch/workspace/makefun/kit/token-radar-01-kit/input/snapshot.json --output out
python3 -m http.server 37693 --bind 127.0.0.1 --directory out
```

Buka `http://127.0.0.1:37693/dashboard/`. Server hanya menyajikan berkas lokal; dashboard tidak membutuhkan koneksi internet. `data.js` berada di sebelah direktori dashboard, berisi persis nilai dan rencana farming board serta referensi token tercatat. Jangan membuka sumber `dashboard/` sebelum build karena belum memiliki data hasil snapshot.

Gunakan pencarian, filter chain/kategori/watchlist, dan kontrol urutan tabel untuk menjelajahi board. Pilih protokol untuk membuka detail nilai dan rencana farming. Tampilan token tercatat memisahkan market cap observasi dari implied value model.

## Model nilai

Untuk setiap protokol dengan token tidak tercatat, model menggunakan:

```text
age = max(0, hari UTC antara listed_at dan as_of)
g = clamp(change_7d, -50, 100)
growth_multiplier = 1 + g / 200
maturity_multiplier = 0.65 + 0.35 × min(age, 1095) / 1095
implied_value_usd = round(TVL_USD × 0.35 × growth_multiplier × maturity_multiplier)
```

Nilai dibatasi ke dolar bulat positif sesuai batas board. Pertumbuhan tidak tersedia memakai 0%; usia tidak tersedia memakai 365 hari dan tetap ditampilkan sebagai tidak diketahui. Semua tanggal berasal dari snapshot, sehingga hasil tidak berubah karena waktu menjalankan program. Faktor pertumbuhan dibatasi agar lonjakan satu minggu tidak mendominasi nilai. Faktor maturitas bertambah secara terbatas selama tiga tahun. Konstanta 0.35 merupakan asumsi valuasi eksplisit, bukan estimasi empiris atau harga token yang dapat diperdagangkan.

`listed_at` adalah hari DefiLlama mulai melacak protokol. Selisih tanggal merupakan proksi rekam jejak selama token tidak tercatat, bukan bukti tanggal berdiri atau periode tanpa token yang sebenarnya. TVL juga bukan pendapatan. Rentang skenario di detail, jika ditampilkan, bukan interval statistik. Model tidak memprediksi jadwal peluncuran, alokasi, kelayakan, atau adanya airdrop.

Semua slug watchlist dipertahankan. Kandidat tambahan mengecualikan kategori CEX, Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, dan Restaked BTC, nama versi, indikasi wrapped/staked/bridged, serta produk berawalan nama exchange yang disebut aturan kit. Sisa kandidat dipilih menurut TVL menurun sampai total 200 baris, lalu seluruh board diberi peringkat berdasarkan rumus nilai. Seleksi ini bukan daftar protokol pilihan buatan. Snapshot tidak membawa parentProtocol, sehingga klasifikasi kandidat tambahan tetap memiliki keterbatasan. Protokol dengan identitas token atau market cap tercatat ditempatkan dalam referensi terpisah. Nilai seri dipecahkan menurut slug. Rincian seleksi tersedia di `lib/model.ts`. Rank board selalu 1..N berdasarkan implied value menurun; pengurutan di halaman hanya mengubah tampilan.

Rencana farming dibuat dari kategori, chain, TVL, dan usia rekam jejak. Rencana menyertakan estimasi modal, biaya, waktu, serta pemeriksaan dukungan aset dan fitur sebelum transaksi. Ini adalah template tindakan kondisional dari snapshot terbatas, bukan dokumentasi integrasi yang telah diverifikasi langsung. Saldo pokok yang dialokasikan dibedakan dari biaya transaksi. Jangan menganggap aktivitas berulang atau periode menahan posisi menjamin reward.

## Build final dan screenshot

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Tanpa argumen, input adalah `/input/snapshot.json` dan output `/output`. `MAKEFUN_INPUT_DIR` serta `MAKEFUN_OUTPUT_DIR` dapat mengganti direktori; `--input` dan `--output` memiliki prioritas tertinggi. Entry membaca snapshot, memvalidasi board, menulis `board.json` dan `data.js`, menyalin `dashboard/` dan `screenshots/`, lalu memanggil `buildDossier` dari vendor asli untuk menulis `dossier.json`. Direktori tujuan sebaiknya baru untuk setiap build.

Sesuai brief, repositori belum membawa gambar screenshot. Mode default sengaja gagal bila belum ada 3–4 gambar; `--preview` menghasilkan board dan halaman tanpa dossier. Mode ini bukan artefak final yang dapat lolos seluruh gate.

Sesudah dashboard dibuka di Chrome, tambahkan tiga tangkapan asli ke `screenshots/`: `1-board.png`, `2-detail.png`, `3-filtered.png` (opsional gambar keempat). Setiap gambar PNG/JPEG harus utuh, sisi panjang maksimal 1440 px, sisi pendek minimal 800 px, maksimal 512 KiB. Targetkan sekitar 300–350 KB per gambar dan dossier total maksimal 1.5 MiB. Jalankan ulang build default sesudah menambah gambar. Jangan memakai screenshot starter sebagai gambar entri.

## Verifikasi lokal

```sh
node scripts/verify.ts /home/hatch/workspace/makefun/kit/token-radar-01-kit
```

Script memeriksa jumlah/keunikan slug dan rank, cakupan watchlist, nilai menurun dan tidak seragam, format farm steps, ukuran berkas, sumber dashboard di bawah 64 KB, ketiadaan URL jaringan, sintaks JS, dan integritas vendor. Dua build final dalam direktori fixture sementara harus identik byte-per-byte. Dossier dibandingkan dengan hasil panggilan ulang vendor; jalur 3 dan 4 gambar diuji memakai gambar starter hanya di direktori `.verify-*` yang diabaikan Git. Gambar tersebut bukan hasil dashboard ini dan tidak menyatakan screenshot gate final telah lolos. `out/verification.json` menyimpan laporan lokal.

`board.json` di root adalah hasil snapshot latihan untuk ditinjau. Build grader selalu menghitung ulang dari input, tidak membaca salinan ini. Lihat `VERIFICATION.md` untuk hasil pemeriksaan sesi ini dan keterbatasan verifikasi visual.

## Susunan sumber

- `main.ts`: entrypoint build deterministik, mode preview, dan pembuatan dossier.
- `lib/model.ts`: seleksi protokol, model nilai, rencana farming, validasi board.
- `dashboard/index.html`, `dashboard/app.css`, `dashboard/app.js`: antarmuka offline.
- `vendor/makefun-board.ts`: vendor kit, tidak diubah.
- `scripts/verify.ts`: validasi data dan integrasi build lokal.
- `screenshots/.gitkeep`: tempat tangkapan layar asli yang akan ditambahkan.
- `board.json`: board snapshot latihan.
- `LICENSE`: lisensi MIT.

Tidak ada submit, push, remote Git, keypair, atau bundling transcript dalam pekerjaan ini. Saat akan submit, gunakan log asli harness sesuai transcript gate; jangan merekonstruksi transcript. Verifikasi server make.fun tetap menjadi penentu gate resmi.

[Bounty make.fun](https://make.fun/bounty/token-radar-01)

Referral: https://make.fun/r/p1x954ca
