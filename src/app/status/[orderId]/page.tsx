// File ini: halaman status pesanan (/status/[orderId]).
//
// File halaman sengaja TIPIS (sesuai aturan di AGENTS.md bagian "Tampilan"):
// hanya merakit hook dari src/features/ dan komponen dari src/components/.
//
// Halaman ini membaca localStorage dan memanggil API, jadi berjalan di sisi
// browser.

"use client";

import { use } from "react";
import { KerangkaCustomer } from "@/components/customer/beranda-customer";
import { StatusOrder } from "@/components/customer/status-order";
import { useStatusOrder } from "@/features/customer/use-status-order";
import { teksCustomer } from "@/features/customer/teks";

// use() dipakai untuk membaca params (Promise) di Next.js 15+.
// params.orderId adalah id order dari URL.
export default function HalamanStatusOrder({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  // use() membaca nilai dari Promise params, ini cara Next.js 15+ menyediakan
  // parameter halaman ke Client Component.
  const { orderId } = use(params);

  // Semua logika polling dan pembatalan ada di hook.
  const keadaan = useStatusOrder(orderId);

  return (
    <KerangkaCustomer judul={teksCustomer.status.judul}>
      <StatusOrder
        order={keadaan.order}
        customerName={keadaan.customerName}
        teksStatus={keadaan.teksStatus}
        bolehBatalkan={keadaan.bolehBatalkan}
        dialogBatalTerbuka={keadaan.dialogBatalTerbuka}
        sedangMembatalkan={keadaan.sedangMembatalkan}
        memuat={keadaan.memuat}
        gagalMuat={keadaan.gagalMuat}
        tidakDitemukan={keadaan.tidakDitemukan}
        pesan={keadaan.pesan}
        bukaDialogBatal={keadaan.bukaDialogBatal}
        tutupDialogBatal={keadaan.tutupDialogBatal}
        konfirmasiBatal={keadaan.konfirmasiBatal}
      />
    </KerangkaCustomer>
  );
}
