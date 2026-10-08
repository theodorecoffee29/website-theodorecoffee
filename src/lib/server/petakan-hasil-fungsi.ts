// File ini: mengubah hasil fungsi database (snake_case) menjadi bentuk yang
// dipakai browser (camelCase), sesuai docs/api-contract.md bagian 4.
//
// Kenapa perlu: fungsi database ditulis dengan gaya snake_case (order_id,
// queue_number, stock_warnings, ...), sedangkan dokumen menetapkan balasan API
// memakai camelCase (orderId, queueNumber, stockWarnings, ...). Kalau hasil
// database dikirim mentah, field camelCase tidak ada di browser. Akibatnya
// browser membaca nilai kosong; itulah yang pernah membuat halaman status
// memanggil "/api/orders/undefined/status".
//
// File ini mengumpulkan pemetaan untuk SEMUA fungsi yang keluarannya dikirim ke
// browser, supaya konsisten di semua route handler:
//
//   petakanHasilBuatOrder    -> POST  /api/orders
//   petakanOrderManual       -> POST  /api/cashier/orders (order manual)
//   petakanHasilStatusOrder  -> GET   /api/orders/[id]/status
//   petakanHasilMenu         -> GET   /api/menu
//   petakanHasilKonfirmasi   -> POST  /api/cashier/orders/[id]/confirm
//   petakanHasilBatal        -> POST  .../cancel (customer dan staf)
//   petakanHasilMulai        -> POST  /api/barista/orders/[id]/start
//   petakanHasilSelesai      -> POST  /api/barista/orders/[id]/finish
//
// Semua fungsi di file ini MURNI (tanpa database dan tanpa Supabase), jadi bisa
// diuji langsung. Tidak ada yang melempar error: data yang bentuknya tidak
// sesuai diubah jadi nilai netral supaya halaman tidak ikut error.

// ---------------------------------------------------------------------------
// Bentuk balasan yang benar (docs/api-contract.md bagian 4)
// ---------------------------------------------------------------------------

// Hasil POST /api/orders (fungsi create_order).
export type HasilBuatOrder = {
  orderId: string;
  queueNumber: number;
  queueDate: string;
  status: string;
  total: number;
};

// Satu item di halaman status customer.
export type ItemStatusOrder = {
  name: string;
  qty: number;
  note: string | null;
};

// Hasil GET /api/orders/[id]/status (fungsi get_order_status).
export type HasilStatusOrder = {
  status: string;
  queueNumber: number;
  queueDate: string;
  items: ItemStatusOrder[];
  total: number;
};

// Satu menu dari GET /api/menu (fungsi get_menu).
export type ItemMenu = {
  id: string;
  name: string;
  price: number;
  available: boolean;
};

// Hasil GET /api/menu.
export type HasilMenu = {
  items: ItemMenu[];
};

// Satu peringatan stok dari konfirmasi (fungsi confirm_order).
// Peringatan BUKAN error: konfirmasi tetap sukses (api-contract bagian 4).
export type PeringatanStok = {
  ingredientName: string;
  stockAfter: number;
};

// Hasil POST /api/cashier/orders (fungsi create_manual_order).
//
// Perbedaan dari HasilBuatOrder: order manual LANGSUNG berstatus "antrean"
// (tidak ada tahap Menunggu konfirmasi), dan tidak ada queueDate karena nomor
// antrean selalu untuk hari ini (docs/Order-flow.md bagian 3).
export type HasilOrderManual = {
  orderId: string;
  queueNumber: number;
  // Selalu "antrean" untuk order manual.
  status: string;
  // Peringatan stok (bukan error). Sama bentuknya dengan konfirmasi.
  stockWarnings: PeringatanStok[];
};

// Hasil POST /api/cashier/orders/[id]/confirm (fungsi confirm_order).
export type HasilKonfirmasi = {
  status: string;
  queueNumber: number;
  stockWarnings: PeringatanStok[];
};

// Hasil pembatalan (fungsi cancel_order), dan juga hasil Mulai/Selesai yang
// bentuknya sama-sama cuma satu status.
export type HasilStatusSederhana = {
  status: string;
};

// ---------------------------------------------------------------------------
// Fungsi pemeta
// ---------------------------------------------------------------------------

/**
 * Mengubah hasil create_order (snake_case) menjadi bentuk camelCase.
 *
 * Input: data apa pun hasil pemanggilan fungsi create_order.
 * Output: HasilBuatOrder.
 *
 * Field yang tidak ada diisi nilai netral (teks kosong atau 0) supaya bentuk
 * balasannya tetap lengkap, tanpa melempar error.
 */
export function petakanHasilBuatOrder(data: unknown): HasilBuatOrder {
  const kolom = jadiObjek(data);

  return {
    orderId: jadiTeks(kolom.order_id),
    queueNumber: jadiAngka(kolom.queue_number),
    queueDate: jadiTeks(kolom.queue_date),
    status: jadiTeks(kolom.status),
    total: jadiAngka(kolom.total),
  };
}

/**
 * Mengubah hasil create_manual_order (snake_case) menjadi bentuk camelCase.
 *
 * Input: data apa pun hasil pemanggilan fungsi create_manual_order.
 * Output: HasilOrderManual.
 *
 * Perbedaan dari petakanHasilBuatOrder: field queueDate tidak ada di sini,
 * karena nomor antrean order manual selalu untuk hari ini (dihitung database).
 * Field stockWarnings tetap diteruskan, karena order manual juga mengurangi
 * stok dan bisa memunculkan peringatan stok yang sama seperti konfirmasi.
 */
export function petakanOrderManual(data: unknown): HasilOrderManual {
  const kolom = jadiObjek(data);

  return {
    orderId: jadiTeks(kolom.order_id),
    queueNumber: jadiAngka(kolom.queue_number),
    status: jadiTeks(kolom.status),
    stockWarnings: petakanPeringatanStok(kolom.stock_warnings),
  };
}

/**
 * Mengubah hasil get_order_status (snake_case) menjadi bentuk camelCase.
 *
 * Input: data apa pun hasil pemanggilan fungsi get_order_status.
 * Output: HasilStatusOrder. Daftar items ikut dipetakan: kalau isinya bukan
 *         array, hasilnya array kosong (bukan error), supaya halaman status tetap
 *         tampil walau server mengirim data tak terduga.
 */
export function petakanHasilStatusOrder(data: unknown): HasilStatusOrder {
  const kolom = jadiObjek(data);

  return {
    status: jadiTeks(kolom.status),
    queueNumber: jadiAngka(kolom.queue_number),
    queueDate: jadiTeks(kolom.queue_date),
    items: petakanItemStatus(kolom.items),
    total: jadiAngka(kolom.total),
  };
}

/**
 * Mengubah hasil get_menu menjadi bentuk camelCase.
 *
 * Input: data apa pun hasil pemanggilan fungsi get_menu.
 * Output: HasilMenu. Kalau data tidak berisi array items, hasilnya array kosong.
 *
 * Catatan: fungsi get_menu memang sudah memakai nama field yang sama dengan
 * bentuk camelCase (id, name, price, available). Pemeta ini tetap ditulis supaya
 * (1) bentuknya dijamin lengkap walau fungsi database berubah, dan (2) semua
 * route memakai satu cara yang sama.
 */
export function petakanHasilMenu(data: unknown): HasilMenu {
  const kolom = jadiObjek(data);
  const itemsMentah = kolom.items;

  if (!Array.isArray(itemsMentah)) {
    return { items: [] };
  }

  const items: ItemMenu[] = [];
  for (const satuMentah of itemsMentah) {
    const satuItem = jadiObjek(satuMentah);
    items.push({
      id: jadiTeks(satuItem.id),
      name: jadiTeks(satuItem.name),
      price: jadiAngka(satuItem.price),
      // available dihitung database sebagai boolean. Kalau bukan boolean
      // (mis. null), dianggap false supaya menu tidak bisa dipilih.
      available: satuItem.available === true,
    });
  }

  return { items: items };
}

/**
 * Mengubah hasil confirm_order (snake_case) menjadi bentuk camelCase.
 *
 * Input: data apa pun hasil pemanggilan fungsi confirm_order.
 * Output: HasilKonfirmasi dengan daftar stockWarnings yang sudah camelCase.
 *
 * Kenapa stockWarnings penting: daftar ini peringatan stok yang harus dibaca
 * Cashier (bukan error). Kalau field-nya tidak dipetakan, browser akan
 * membacanya kosong dan peringatan tidak pernah tampil.
 */
export function petakanHasilKonfirmasi(data: unknown): HasilKonfirmasi {
  const kolom = jadiObjek(data);

  return {
    status: jadiTeks(kolom.status),
    queueNumber: jadiAngka(kolom.queue_number),
    stockWarnings: petakanPeringatanStok(kolom.stock_warnings),
  };
}

/**
 * Mengubah hasil cancel_order, start_order, dan finish_order menjadi bentuk
 * camelCase.
 *
 * Input: data apa pun hasil pemanggilan salah satu fungsi itu.
 * Output: HasilStatusSederhana ({ status }).
 *
 * Kenapa digabung: ketiga fungsi mengembalikan jsonb yang hanya berisi satu
 * kunci "status" (sudah camelCase di database), jadi bentuk pemetaannya sama.
 * Fungsi tetap dipisah supaya tiap route menulis pemanggilan yang jelas:
 * petakanHasilBatal untuk cancel, petakanHasilMulai untuk start, dan
 * petakanHasilSelesai untuk finish.
 */
export function petakanHasilBatal(data: unknown): HasilStatusSederhana {
  return petakanStatusSederhana(data);
}

/** Sama seperti petakanHasilBatal, untuk hasil start_order. */
export function petakanHasilMulai(data: unknown): HasilStatusSederhana {
  return petakanStatusSederhana(data);
}

/** Sama seperti petakanHasilBatal, untuk hasil finish_order. */
export function petakanHasilSelesai(data: unknown): HasilStatusSederhana {
  return petakanStatusSederhana(data);
}

// ---------------------------------------------------------------------------
// Helper internal
// ---------------------------------------------------------------------------

/**
 * Mengubah data apa pun menjadi objek yang bisa dibaca dengan aman.
 *
 * Input: data dari database.
 * Output: objek. Kalau data bukan objek (mis. null), objek kosong dikembalikan
 *         supaya pembacaan field di bawah tidak gagal.
 */
function jadiObjek(data: unknown): Record<string, unknown> {
  if (data !== null && typeof data === "object") {
    return data as Record<string, unknown>;
  }
  return {};
}

/** Mengubah nilai menjadi teks. Selain teks atau angka dianggap kosong. */
function jadiTeks(nilai: unknown): string {
  if (typeof nilai === "string") {
    return nilai;
  }
  if (typeof nilai === "number") {
    return String(nilai);
  }
  return "";
}

/** Mengubah nilai menjadi angka. Kalau bukan angka yang valid, hasilnya 0. */
function jadiAngka(nilai: unknown): number {
  if (typeof nilai === "number" && Number.isFinite(nilai)) {
    return nilai;
  }
  if (typeof nilai === "string") {
    const angka = Number(nilai);
    return Number.isFinite(angka) ? angka : 0;
  }
  return 0;
}

/**
 * Mengubah daftar item status (get_order_status) menjadi daftar item camelCase.
 *
 * Input: kolom items dari database (yang virou array).
 * Output: daftar { name, qty, note }.
 *
 * Entri yang bukan objek atau tidak punya nama dilewati, sama seperti
 * petakanItem di petakan-antrean.ts: lebih baik menampilkan beberapa item
 * daripada membuat halaman error.
 */
function petakanItemStatus(itemsMentah: unknown): ItemStatusOrder[] {
  if (!Array.isArray(itemsMentah)) {
    return [];
  }

  const hasil: ItemStatusOrder[] = [];
  for (const satuMentah of itemsMentah) {
    const satuItem = jadiObjek(satuMentah);
    const nama = satuItem.name;
    const qty = satuItem.qty;

    // Nama dan jumlah wajib ada supaya baris pesanan berarti.
    if (typeof nama !== "string" || typeof qty !== "number") {
      continue;
    }

    const note = satuItem.note;
    hasil.push({
      name: nama,
      qty: qty,
      note: typeof note === "string" ? note : null,
    });
  }

  return hasil;
}

/**
 * Mengubah daftar peringatan stok (confirm_order) menjadi bentuk camelCase.
 *
 * Input: kolom stock_warnings dari database.
 * Output: daftar { ingredientName, stockAfter }.
 *
 * Peringatan di database berisi ingredient_id, ingredient_name, dan stock_after.
 * Yang dipakai Cashier cuma ingredientName dan stockAfter (docs/api-contract.md
 * bagian 4: stockWarnings: [{ ingredientName, stockAfter }]), jadi hanya dua
 * field itu yang diteruskan.
 */
function petakanPeringatanStok(warningsMentah: unknown): PeringatanStok[] {
  if (!Array.isArray(warningsMentah)) {
    return [];
  }

  const hasil: PeringatanStok[] = [];
  for (const satuMentah of warningsMentah) {
    const satuWarning = jadiObjek(satuMentah);
    hasil.push({
      ingredientName: jadiTeks(satuWarning.ingredient_name),
      stockAfter: jadiAngka(satuWarning.stock_after),
    });
  }

  return hasil;
}

/**
 * Mengubah hasil fungsi yang hanya mengembalikan satu field status.
 *
 * Input: data dari cancel_order, start_order, atau finish_order.
 * Output: { status }.
 */
function petakanStatusSederhana(data: unknown): HasilStatusSederhana {
  const kolom = jadiObjek(data);
  return { status: jadiTeks(kolom.status) };
}
