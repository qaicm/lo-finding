# Panduan Instalasi — Learning Objective Finding

Aplikasi terdiri dari dua bagian:

| Bagian | Tempat | Berkas |
|---|---|---|
| **Backend** (REST API + database) | Google Apps Script + Google Sheets/Drive | `Kode.gs`, `Auth.gs`, `Gemini.gs`, `Pencarian.gs`, `Sumber.gs`, `Admin.gs`, `appsscript.json` |
| **Frontend** (tampilan web) | GitHub Pages | isi ZIP `lo-finding-frontend.zip` |

Waktu yang dibutuhkan: ±30 menit.

---

## TAHAP A — Backend (Google Apps Script)

### A1. Buat proyek
1. Buka **https://script.google.com** → **New project** (Proyek baru).
2. Ganti nama proyek menjadi **LO Finding API**.

> ⚠️ Gunakan akun Google yang akan menjadi pemilik aplikasi. Semua data (Sheets, Drive), email OTP, dan kuota akan memakai akun ini. Sebaiknya akun **Google Workspace sekolah** (kuota email ±1.500/hari). Akun Gmail biasa hanya ±100 email/hari.

### A2. Tempel berkas backend
1. Hapus isi `Code.gs`, lalu **rename** menjadi `Kode` dan tempel isi **`Kode.gs`**.
2. Klik **＋ → Script**, beri nama `Auth`, tempel isi **`Auth.gs`**. Ulangi untuk `Gemini`, `Pencarian`, `Sumber`, dan `Admin`.
3. Tampilkan manifest: ⚙️ **Project Settings** → centang **Show "appsscript.json" manifest file in editor**. Buka `appsscript.json`, ganti seluruh isinya dengan **`appsscript.json`** dari paket ini. File ini otomatis mengaktifkan layanan **Drive API** yang dipakai untuk konversi Word/PowerPoint.
4. Klik 💾 **Save**.

### A3. Jalankan setup (sekali)
1. Di dropdown fungsi, pilih **`setupAppEnvironment`** → ▶ **Run**.
2. Klik **Review permissions**, pilih akun, lalu **Advanced → Go to LO Finding API (unsafe) → Allow**. Peringatan "unsafe" ini normal untuk skrip buatan sendiri.
3. Buka **Execution log**. Di sana tertulis:
   - link Spreadsheet database dan folder Drive yang baru dibuat
   - 🔐 **email dan kata sandi superadmin. CATAT SEKARANG**, karena hanya tampil sekali. Anda wajib menggantinya saat login pertama.

Setup ini **aman dijalankan ulang**: tidak menimpa data maupun rahasia yang sudah ada. Setup juga memasang pemicu otomatis `prosesAntrean` (tiap 1 menit) untuk memproses dokumen di latar belakang.

### A4. Deploy sebagai Web App
1. **Deploy → New deployment** → ikon ⚙️ → **Web app**.
2. **Execute as: Me** · **Who has access: Anyone**.
3. **Deploy**, lalu **salin URL Web App** (berakhiran `/exec`).

> 🔁 **Saat memperbarui kode nanti**, JANGAN membuat "New deployment" (URL akan berubah dan aplikasi mati). Gunakan **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.

### A5. Isi kunci AI (Gemini)
1. Buat API key di **https://aistudio.google.com/apikey** (gratis dengan batas pemakaian; untuk sekolah besar disarankan mengaktifkan billing).
2. Setelah frontend online, masuk sebagai superadmin → **Settings → AI** → tempel key → **Save key**.
   Cara cadangan: Apps Script → ⚙️ Project Settings → **Script Properties** → tambah `GEMINI_API_KEY`.

---

## TAHAP B — Frontend (GitHub Pages)

### B1. Ekstrak ZIP & isi konfigurasi
1. Ekstrak `lo-finding-frontend.zip`. Anda akan mendapat folder berisi **`index.html`**, `css/`, `js/`, `README.md`.
2. Buka **`js/config.js`** dengan Notepad/VS Code, lalu ganti URL dengan URL `/exec` dari langkah A4:
   ```js
   GAS_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
   ```
3. Simpan.

### B2. Unggah ke GitHub (lewat terminal)
> 📁 **Folder kerja = folder hasil ekstraksi ZIP** (yang langsung berisi `index.html`). Jalankan semua perintah di folder ini, jangan di folder induknya.

1. Pasang Git (https://git-scm.com), buat akun di https://github.com.
2. Di GitHub: **＋ → New repository**, beri nama misalnya `lo-finding`, pilih **Public**, dan **jangan** centang README.
3. Buka PowerShell/Terminal **di folder hasil ekstraksi**, lalu pastikan `index.html` terlihat:
   ```bash
   dir        # Windows (atau: ls)
   ```
4. Jalankan satu per satu:
   ```bash
   git init
   git add .
   git commit -m "Upload pertama"
   git branch -M main
   git remote add origin https://github.com/USERNAME/lo-finding.git
   git push -u origin main
   ```
   Saat diminta password, tempel **Personal Access Token** (github.com/settings/tokens → *Generate new token (classic)* → centang **repo**). Layar memang tidak menampilkan apa pun saat token ditempel; itu normal.
5. Di repo GitHub: **Settings → Pages** → Source **Deploy from a branch** → Branch **main / (root)** → **Save**. Centang **Enforce HTTPS**.
6. Tunggu 1–2 menit. Situs tayang di `https://USERNAME.github.io/lo-finding/`.

**Update berikutnya** cukup:
```bash
git add .
git commit -m "Perubahan"
git push
```
Lalu tekan **Ctrl+Shift+R** di browser.

---

## TAHAP C — Mulai pakai

1. Buka situs → **Admin login** → masuk dengan email + kata sandi superadmin dari log setup → **ganti sandi**.
2. **Settings → AI**: isi Gemini API key.
3. **Settings → General**: isi nama sekolah, term aktif, dan daftar mapel.
4. **Teachers → Import Excel**: daftarkan email guru. Template ada di dalam dialog impor.
5. **Isi Bank LO** (langkah terpenting): **Upload Source → Syllabus**. Paling cepat dengan file Excel daftar LO (impor tabel, tanpa AI). Centang **Verify & share immediately** agar langsung dipakai semua guru. Mulai dari Math, English, dan Science.
6. Bagikan link situs ke guru. Guru cukup mengetik email sekolahnya dan memasukkan kode 6 digit yang dikirim ke email.

> 💡 Peluncuran bertahap per unit (1–2 hari jeda) menjaga kuota email OTP tetap aman.

---

## Penyimpanan rahasia (wajib dibaca)

| Nilai | Diisi oleh | Disimpan di |
|---|---|---|
| `SPREADSHEET_ID`, `ROOT_FOLDER_ID`, `FOLDER_*` | otomatis (setup) | Script Properties |
| `TOKEN_SECRET` (penanda tangan sesi) | otomatis (setup) | Script Properties |
| Hash kata sandi admin | otomatis | sheet `Admin` (hanya hash + salt, tidak bisa dibaca balik) |
| `GEMINI_API_KEY` | superadmin lewat Settings → AI | Script Properties (hanya tampil tersamar) |
| `ACCESS_CODE` (kode tamu) | superadmin lewat Settings → Access Code | Script Properties |
| URL `/exec` | Anda, di `js/config.js` | frontend (bukan rahasia) |

- **Jangan bagikan** spreadsheet database ke banyak orang, dan **jangan menambah editor** proyek Apps Script sembarangan (editor bisa melihat Script Properties).
- Lupa sandi superadmin: di editor Apps Script jalankan **`resetSandiSuperadmin`**. Sandi baru muncul di Execution log.
- Curiga ada kebocoran: jalankan **`rotasiSecretSesi`** (semua pengguna keluar), lalu ganti API key Gemini.

---

## Pemecahan masalah

| Gejala | Solusi |
|---|---|
| Halaman login menampilkan "App configuration is incomplete" | `GAS_URL` di `js/config.js` belum diisi atau masih `GANTI_...`. |
| "This email is not registered" | Daftarkan email di **Teachers**, status **Active**. |
| Kode OTP tidak masuk | Cek folder Spam. Lihat sisa kuota email di **Settings → Quotas**. |
| "AI is not configured yet" | Isi Gemini API key di **Settings → AI**. |
| AI error 404/model | Model Gemini diganti Google. Ubah **Settings → AI → Model** ke versi terbaru (mis. `gemini-2.5-flash` atau penerusnya). |
| Dokumen "Queued" terus | Pastikan pemicu `prosesAntrean` ada: Apps Script → ⏰ **Triggers**. Jalankan ulang `setupAppEnvironment` bila hilang. |
| Pratinjau PDF di layar verifikasi kosong | Akun Google admin perlu akses ke folder Drive aplikasi. Admin baru otomatis diberi akses Viewer; atau bagikan folder **Sumber Bank LO** secara manual. |
| Situs tidak berubah setelah update | **Ctrl+Shift+R** atau jendela Incognito. Untuk backend: *Manage deployments → New version*. |
| GitHub Pages 404 | `index.html` harus ada di root repository (lihat B2, langkah 3). |

Cek performa: buka Console browser (F12), lalu ketik `Perf.table()` untuk melihat waktu tiap panggilan API (`server` = waktu kerja GAS, `net` = jaringan + cold start).
