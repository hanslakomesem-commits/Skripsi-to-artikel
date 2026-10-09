# ZAIN.NET Article Studio V2.1

Versi perbaikan V1.4. Aplikasi statis untuk GitHub Pages atau localhost, tanpa API token berbayar. Pemrosesan dokumen dilakukan di perangkat pengguna.

## Yang berubah

- Paket GitHub Pages dipadatkan dari 230 menjadi 62 berkas agar bisa diunggah sekali melalui browser. Seluruh 168 peta karakter PDF beserta lisensinya tetap disertakan dalam `vendor/pdfjs/cmaps.zip` dan dibaca otomatis saat diperlukan. Arsip ini tidak perlu diekstrak.
- Model bahasa asli WebLLM (Qwen3 1.7B / 4B / 8B) untuk membantu pemetaan, ringkasan akademik, terjemahan abstrak, dan tanya dokumen. Alternatif Ollama menjalankan model lokal pada laptop.
- Judul dan isi bagian diutamakan daripada asumsi nomor BAB. Metode pada BAB II dan hasil pada BAB III tetap dapat dipetakan.
- DOCX membaca tabel, isi dalam content controls, daftar isi, heading styles, footnote, endnote, gambar, serta rumus Word. Format .doc lama perlu dikonversi terlebih dahulu.
- PDF teks dibaca dengan PDF.js. PDF scan, gambar PNG/JPG, dan DOCX yang seluruhnya berupa gambar dapat dibaca menggunakan OCR Indonesia + Inggris.
- Pemilihan paragraf menjaga urutan sumber dan memberi ruang pada setiap subbagian. Tabel hasil/metode disertakan secara utuh bila opsi tabel aktif.
- AI bekerja per potongan sumber terpilih; tidak memasukkan seluruh skripsi ke konteks kecil sekaligus. Paragraf yang melampaui batas konteks dipertahankan sebagai sumber asli.
- Validasi menolak penanda sumber palsu, angka baru/hilang, sitasi berubah, serta sebagian perubahan arah temuan statistik. Potongan gagal kembali ke sumber asli dan dicatat.
- Referensi hanya berasal dari daftar pustaka sumber. Pilihan “semua referensi” tersedia. Footnote yang belum memiliki pasangan referensi tetap dipertahankan dan diberi catatan; AI tidak mengarang daftar pustaka.
- Ekspor membuat paket DOCX baru, dengan A4, margin 3 cm, Times New Roman, spasi isi yang dapat diatur, abstrak spasi 1, judul ABSTRAK/ABSTRACT di tengah, identitas, nomor halaman, dan inden menggantung referensi. Gambar yang dipilih dan footnote terpakai disalin; seluruh arsip skripsi tidak ikut terbawa.
- Tampilan studio responsif dengan sunting paragraf, pemetaan beberapa blok, pemeriksaan, jejak sumber, chat dokumen, pembatalan proses, serta penguncian tombol untuk mencegah proses bertumpuk.
- Unduhan DOCX otomatis setelah selesai tetap tersedia. English Abstract sekarang opsional; kegagalan terjemahan tidak memblokir draft Indonesia.

## Cara menjalankan

### GitHub Pages

Ekstrak ZIP utama ke folder baru/kosong. Masuk ke folder yang memuat `index.html`, pilih seluruh isinya (Ctrl+A), lalu seret file DAN folder ke **Add file > Upload files** pada root repository. Folder `vendor`, `contoh`, dan `tests` harus ikut. Jika unggahan lama gagal, buka ulang halaman unggah agar antrean kosong. Commit changes, lalu aktifkan **Settings > Pages > Deploy from a branch > main > /(root)**; sesuaikan nama branch bila berbeda. `index.html` harus berada di root. Tidak perlu npm install atau build.

Paket ini memuat **62 berkas**, di bawah batas GitHub **100 berkas sekali unggah** dan **25 MiB per berkas**. Jangan unggah ZIP utama sebagai satu file untuk menjalankan web. Sebaliknya, `vendor/pdfjs/cmaps.zip` harus tetap utuh: aplikasi membacanya langsung. Panduan lengkap ada di `CARA_UPLOAD.txt`. GitHub Desktop / git juga dapat dipakai.

### Laptop

Pasang Python 3, ekstrak ZIP, lalu klik `MULAI_WINDOWS.bat`. Mac/Linux: `python3 serve.py`. Peluncur membuka http://127.0.0.1:8765/ dan melayani file dari folder aplikasi. Jika port terpakai, peluncur mencoba port berikutnya.

Jangan hanya klik index.html melalui file://. Modul JavaScript, worker PDF, dan AI membutuhkan server lokal atau HTTPS. Biarkan jendela terminal tetap terbuka saat memakai aplikasi.

## Mengaktifkan AI browser

1. Gunakan Chrome/Edge terbaru pada perangkat yang mendukung WebGPU.
2. Klik **Siapkan AI lokal**.
3. Pilih model sesuai perangkat, lalu **Aktifkan AI lokal**.
4. Unduhan bobot model terjadi satu kali dan berukuran besar. Bobot Qwen tidak disertakan dalam ZIP. Runtime WebLLM disertakan, sedangkan bobot dan kernel model diunduh dari sumber resmi konfigurasi WebLLM.
5. Tunggu indikator AI aktif, unggah skripsi, lalu klik **Susun artikel**.

Perkiraan kebutuhan memori GPU menurut konfigurasi WebLLM: Qwen3 1.7B ~2.1 GB, 4B ~3.5 GB, dan 8B ~5.7 GB. Ini bukan ukuran unduhan atau jaminan kecocokan perangkat. Perangkat tanpa shader-f16 memakai varian q4f32, yang memerlukan memori lebih besar. Browser dapat membuang cache bila penyimpanan penuh.

Model ringan mengorbankan kemampuan bahasa/penalaran; model lebih besar memerlukan perangkat yang lebih kuat. HP tanpa WebGPU dapat menggunakan draft sumber. AI tidak menyala secara diam-diam: jika model belum aktif, mode AI meminta aktivasi.

## Menggunakan Ollama lokal

1. Pasang Ollama dari https://ollama.com/download.
2. Jalankan `ollama pull qwen3:8b` untuk mengunduh model lokal. Model lebih kecil dapat dipilih bila perangkat terbatas.
3. Pastikan Ollama berjalan, dan buka aplikasi melalui peluncur lokal.
4. Pilih **Ollama laptop** pada pengaturan AI. Alamat default http://127.0.0.1:11434, nama model qwen3:8b.
5. Klik **Aktifkan AI lokal**. Nama model harus sama dengan model terpasang (`ollama list`). Model berakhiran cloud ditolak.

Tidak ada API token pada Ollama lokal. Endpoint hanya diizinkan menuju localhost/127.0.0.1/::1. Aplikasi tidak mengirim skripsi ke layanan AI cloud.

Jika CORS menolak origin, Windows dapat memakai:

```
setx OLLAMA_ORIGINS "http://127.0.0.1:8765,http://localhost:8765,https://NAMA-PENGGUNA.github.io"
```

Ganti origin GitHub dengan origin sebenarnya, lalu tutup dan buka ulang Ollama. Jika peluncur memakai port berbeda, tambahkan origin port tersebut. Browser mungkin meminta izin akses jaringan lokal. Jika koneksi GitHub Pages ke localhost diblokir, jalankan web lewat peluncur localhost. Tidak perlu membuka Ollama ke internet.

## OCR dan format dokumen

Mesin OCR, WASM, dan data bahasa Indonesia/Inggris sudah disertakan dalam ZIP. Tidak perlu mengirim halaman ke layanan OCR. Hasil scan buram tetap perlu diperiksa. OCR otomatis pada DOCX hanya dicoba jika teks dokumen kurang dari 100 kata dan gambar halaman cukup besar; DOCX campuran teks + scan tidak melakukan OCR untuk setiap gambar.

Tabel DOCX dipertahankan sebagai tabel Word. Tabel PDF/scan dibaca sebagai teks dan perlu diperiksa atau disusun ulang secara manual. Gambar/diagram PDF tidak direkonstruksi. Gambar DOCX yang dipilih disalin; grafik/chart Word perlu dikonversi menjadi gambar sebelum pemrosesan. Footnote dan endnote terpakai diekspor sebagai footnote; penandanya ditempatkan pada akhir paragraf terkait. Rumus Word dipertahankan sebagai objek matematika pada paragraf; posisinya perlu diperiksa untuk rumus campuran inline.

Batas: berkas masukan 100 MB, isi DOCX terurai 300 MB, XML DOCX 45 MB, PDF 700 halaman. Kinerja juga mengikuti memori perangkat. Daftar isi dengan tab/dot leaders dan gaya TOC dilewati. Format aneh yang tidak memiliki judul jelas dapat dipetakan AI atau manual pada tab Peta sumber.

## Validasi bukan jaminan kebenaran

Tidak ada model yang dapat menjamin semua bentuk skripsi terbaca sempurna atau ringkasan selalu benar. Kecocokan angka, sitasi, dan kosakata tidak membuktikan bahwa seluruh makna sudah terjaga. Semua paragraf AI ditandai perlu review. Tidak ada data, simpulan, atau referensi yang sengaja diisi dari tebakan ketika bagian belum ditemukan.

Arahan tambahan dipakai untuk penyuntingan isi pada mode AI. Struktur artikel dan pilihan format mengikuti pengaturan aplikasi. Pada mode draft sumber, arahan bahasa/parafrasa tidak diproses oleh model.

Suntingan manual membutuhkan pemeriksaan pengguna. Setelah mengubah abstrak Indonesia, terjemahan Inggris sebelumnya dibatalkan untuk menghindari abstrak yang tidak sinkron. Menyusun ulang artikel membangun kembali draft dari sumber dan mengganti suntingan manual pada draft.

## Privasi dan offline

Berkas tidak diunggah ke server analisis. Tidak ada analytics atau penyimpanan skripsi otomatis. Service worker menyimpan shell/runtime aplikasi; tidak menyimpan berkas skripsi atau request Ollama. Model AI menggunakan cache browser. Proses lokal dapat digunakan tanpa internet setelah seluruh model/kernel yang dibutuhkan tersedia di cache, atau dengan Ollama yang sudah terpasang. Cache browser bukan jaminan penyimpanan permanen.

## Pengujian versi ini

- 16 pengujian mesin: pemetaan, pemisahan TOC/lampiran, sumber palsu, angka, sitasi, fallback, pembatalan, dan transport Ollama. Jalankan `node --test tests/engine.test.mjs` untuk mengulangnya.
- Browser Chromium: DOCX standar, nomor BAB berbeda, daftar isi berulang/content controls, TXT, PDF teks, penomoran Word otomatis, reset unggahan baru, suntingan manual, unduhan, dan lebar tampilan HP. Alur aktivasi Ollama, penyusunan, dan chat juga diuji melalui endpoint uji lokal (bukan inferensi model sungguhan).
- OCR sungguhan: gambar PNG, PDF scan, DOCX berisi gambar halaman; empat bagian utama terpetakan pada contoh uji yang jelas.
- Paket 62 berkas diperiksa terhadap batas unggahan browser. PDF dengan peta karakter CJK diuji memakai arsip lokal, termasuk alamat situs dalam subfolder seperti GitHub Pages.
- Runtime WebLLM dan keenam ID model q4f16/q4f32 berhasil dimuat; alur GPU tidak tersedia diuji.
- DOCX hasil diperiksa validitas seluruh XML, dibuka dengan python-docx, dan dirender dengan LibreOffice untuk memastikan tabel, gambar, footnote, margin, serta nomor halaman tampil.

**Inferensi model Qwen sebenarnya belum diuji pada GPU di lingkungan pengembangan ini**, karena adapter GPU tidak tersedia. Pengujian ringkasan menggunakan respons model uji untuk menguji validasi dan fallback; itu bukan pengukuran kualitas model. Ollama nyata belum tersedia di lingkungan pengujian. Uji pada perangkat tujuan setelah aktivasi.

## Sumber teknis dan lisensi

- WebLLM 0.2.85: https://webllm.mlc.ai/docs/user/basic_usage.html
- Daftar model resmi: https://github.com/mlc-ai/web-llm/blob/main/src/config.ts
- Ollama chat: https://docs.ollama.com/api/chat
- Ollama CORS: https://docs.ollama.com/faq
- PDF.js 5.4.296: https://mozilla.github.io/pdf.js/
- Tesseract.js 7.0.0: https://github.com/naptha/tesseract.js

Lisensi runtime disertakan pada folder vendor. Bobot Qwen diunduh secara terpisah; syarat lisensinya mengikuti model pilihan. JSZip 3.10.1 pada paket awal dipertahankan dan memiliki header lisensi di file-nya.
