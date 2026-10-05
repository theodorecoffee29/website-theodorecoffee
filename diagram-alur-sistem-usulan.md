# 3. Diagram Alur Sistem Usulan

Berikut adalah visualisasi alur proses terpadu **online** dan **offline** pada sistem usulan Theodore Coffee:

```text
PELANGGAN                    KASIR / SISTEM                 MIDTRANS                  BARISTA

    │                              │                           │                         │
    │                              │                           │                         │
    ├── [ONLINE] Scan QR Web ─────>│                           │                         │
    │                              │                           │                         │
    ├── Pilih Menu & Kustomisasi ─>│                           │                         │
    │                              │                           │                         │
    ├── Konfirmasi Pesanan ───────>│ Status: MENUNGGU          │                         │
    │                              │ KONFIRMASI                │                         │
    │                              │                           │                         │
    │                              ├── Periksa Pesanan         │                         │
    │                              │                           │                         │
    │                    ┌─────────┴─────────┐                 │                         │
    │                    │                   │                 │                         │
    │                  TOLAK               TERIMA              │                         │
    │                    │                   │                 │                         │
    │                    │                   ├──> MENUNGGU PEMBAYARAN                     │
    │                    │                   │                 │                         │
    │                    │                   ├── Bayar QRIS ────────────────>            │
    │                    │                   │                 │                         │
    │                    │                   │<── Webhook / Verifikasi ─────┤            │
    │                    │                   │                 │                         │
    │                    │                   ├── DIBAYAR       │                         │
    │                    │                   │                 │                         │
    │                    │                   ├── MENUNGGU DIPROSES ─────────────────────>│
    │                    │                   │                                           │
    │                    │                   │                                           │
    │                    │                   │                 │             ┌───────────┤
    │                    │                   │                 │             │ BUAT      │
    │                    │                   │                 │             │ PESANAN   │
    │                    │                   │                 │             │     ↓     │
    │                    │                   │                 │             │ SEDANG    │
    │                    │                   │                 │             │ DIBUAT    │
    │                    │                   │                 │             │ (TERKUNCI)│
    │                    │                   │                 │             │     ↓     │
    │                    │                   │                 │             │ PESANAN   │
    │                    │                   │                 │             │ SELESAI   │
    │                    │                   │                 │             └───────────┤
    │                    │                   │                 │                         │
    │<──── Notifikasi Realtime: Pesanan Sedang Dibuat ──────────────────────────────────┤
    │                              │                           │                         │
    │<──── Notifikasi Realtime: Pesanan Selesai ────────────────────────────────────────┤
    │                              │                           │                         │
    │                              │                           │                         │
    │                              │                           │                         │
    ├── [OFFLINE] Datang Booth ───>│                           │                         │
    │                              │                           │                         │
    ├── Pesan & Kustomisasi ──────>│ Kasir Input di POS        │                         │
    │                              │                           │                         │
    ├── Bayar Cash / QRIS ────────>│ Kasir Verifikasi          │                         │
    │                              │                           │                         │
    │                              ├── DIBAYAR                 │                         │
    │                              │                           │                         │
    │                              ├── MENUNGGU DIPROSES ───────────────────────────────>│
    │                              │                                                     │
    │                              │                                                     ├── BUAT PESANAN
    │                              │                                                     │      ↓
    │                              │                                                     │ SEDANG DIBUAT
    │                              │                                                     │  (TERKUNCI)
    │                              │                                                     │      ↓
    │                              │                                                     │ PESANAN SELESAI
    │                              │                                                     │
    │<──────── Notifikasi Realtime ─┴────────────────────────────────────────────────────┤
    │                              │                                                     │
    │                              │                                                     │
    └── Ambil Minuman di Booth ──────────────────────────────────────────────────────────>│
```

**Catatan:** Pengurangan stok dilakukan berdasarkan resep ketika transaksi telah berhasil dan pesanan memenuhi syarat untuk diproses, bukan baru setelah pesanan berstatus **SELESAI**.
