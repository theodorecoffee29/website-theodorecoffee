// Halaman awal (/) aplikasi.
// Isinya sengaja masih sederhana: baru menampilkan nama booth.
// Nanti diganti jadi halaman per peran (customer, cashier, barista, admin).

export default function Home() {
  return (
    // min-h-screen = setinggi layar, items-center + justify-center
    // dipakai supaya teks berada di tengah.
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-4xl font-bold">Theodore Coffee</h1>
    </main>
  );
}
