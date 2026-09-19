# Rule: Automatic Dead Code Elimination & Cleanup

## Trigger & Scope
Aturan ini **WAJIB** diterapkan setiap kali:
- Menambahkan fitur baru atau menulis kode baru.
- Melakukan refactoring fungsi, komponen, atau styling yang sudah ada.
- Mengubah alur logika, dependensi, atau modul import.

---

## Prosedur Pembersihan Wajib (Mandatory Cleanup Protocol)
Sebelum menyelesaikan tugas coding dan menyerahkan hasil kerja ke pengguna, agen harus melakukan inspeksi dan pembersihan kode mati (*dead code*) secara menyeluruh:

### 1. Unused Imports & Modules
- Hapus semua statement `import` atau `require` yang sudah tidak dipanggil/digunakan di file.
- Jangan biarkan import yang tidak terpakai hanya di-comment; hapus secara bersih.

### 2. Variabel, Fungsi, & State yang Tidak Terpakai
- Deteksi dan hapus fungsi pembantu (*helper*), variabel, konstanta, atau state yang sudah digantikan oleh kode/fitur baru.
- Jika ada fungsi yang diekspor (*export*) namun sudah tidak ada file lain yang mengimpornya, hapus fungsi tersebut agar tidak menjadi sampah kode.

### 3. Kode yang Tidak Pernah Dieksekusi (Unreachable Code)
- Bersihkan percabangan `if/else` yang kondisinya sudah mustahil tercapai.
- Hapus blok kode yang berada di bawah statement `return`, `throw`, atau `break`.

### 4. File & Komponen Usang (Orphan Files)
- Jika sebuah komponen, utilitas, atau styling baru dibuat untuk menggantikan yang lama, pastikan file/komponen lama yang sudah tidak terpakai dihapus atau dikonfirmasi penghapusannya.
- Bersihkan class CSS atau styling yang sudah tidak lagi menempel pada elemen HTML/komponen mana pun.

### 5. Jangan Tinggalkan Sampah Komentar (Commented-out Code)
- Jangan tinggalkan potongan kode lama yang sengaja dimatikan dengan komentar (`//` atau `/* ... */`) dengan alasan "buat jaga-jaga". Versi lama sudah aman tercatat di riwayat Git.

### 6. Verifikasi via Linter / Static Checker
- Sebelum menandai pekerjaan selesai, jalankan linter atau type checker proyek (seperti `eslint`, `tsc`, atau scanner dead code jika tersedia) untuk memastikan tidak ada warning terkait *unused variables*, *unused imports*, atau *unreachable code*.
