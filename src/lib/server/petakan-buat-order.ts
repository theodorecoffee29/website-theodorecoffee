// File ini: mengubah hasil fungsi database create_order menjadi bentuk yang
// dipakai browser.
//
// Kenapa perlu: fungsi database memakai gaya snake_case (order_id, queue_number,
// queue_date, ...), sedangkan docs/api-contract.md bagian 4 menetapkan balasan
// POST /api/orders memakai gaya camelCase (orderId, queueNumber, queueDate,
// status, total). Kalau hasil database dikirim mentah, field "orderId" tidak
// ada, dan browser akan membaca id order yang kosong. Itu penyebab halaman
// status terlanjur memanggil "/api/orders/undefined/status".
//
// File ini MURNI (tanpa database maupun Supabase), jadi mudah diuji.

// Bentuk balasan POST /api/orders yang benar (docs/api-contract.md bagian 4).
export type HasilBuatOrder = {
  orderId: string;
  queueNumber: number;
  queueDate: string;
  status: string;
  total: number;
};

/**
 * Mengubah hasil create_order (snake_case) menjadi bentuk camelCase.
 *
 * Input: data apa pun hasil pemanggilan fungsi create_order.
 * Output: HasilBuatOrder.
 *
 * Cara kerja: setiap field dibaca dari nama snake_case-nya, lalu diubah ke
 * tipe yang benar. Field yang tidak ada diisi nilai netral (teks kosong atau 0)
 * supaya bentuk balasannya tetap lengkap, tanpa melempar error.
 */
export function petakanHasilBuatOrder(data: unknown): HasilBuatOrder {
  // Data dari fungsi database berbentuk objek. Kalau bukan objek (mis. null),
  // dianggap objek kosong supaya pembacaan di bawah tetap aman.
  const kolom =
    data !== null && typeof data === "object"
      ? (data as Record<string, unknown>)
      : {};

  return {
    orderId: jadikanTeks(kolom.order_id),
    queueNumber: jadikanAngka(kolom.queue_number),
    queueDate: jadikanTeks(kolom.queue_date),
    status: jadikanTeks(kolom.status),
    total: jadikanAngka(kolom.total),
  };
}

// Mengubah nilai menjadi teks. Selain teks (atau angka) dianggap kosong.
function jadikanTeks(nilai: unknown): string {
  if (typeof nilai === "string") {
    return nilai;
  }
  if (typeof nilai === "number") {
    return String(nilai);
  }
  return "";
}

// Mengubah nilai menjadi angka. Kalau bukan angka yang valid, hasilnya 0.
function jadikanAngka(nilai: unknown): number {
  if (typeof nilai === "number" && Number.isFinite(nilai)) {
    return nilai;
  }
  if (typeof nilai === "string") {
    const angka = Number(nilai);
    return Number.isFinite(angka) ? angka : 0;
  }
  return 0;
}
