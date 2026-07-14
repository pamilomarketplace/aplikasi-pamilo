// features/produk/produkRepository.ts
import { supabase } from '@/utils/supabaseClient';

export interface Produk {
  id_produk: string;
  id_toko_produk: string;
  nama_produk: string;
  harga_produk: number;
  deskripsi_produk: string | null;
  kategori_produk: string | null;
  kategori_label_produk: string | null;
  foto_produk: string | null;
  terjual_produk: number;
  stok_ready_produk: number;
  created_at: string;
  harga_coret_produk: number;
  is_promo: boolean;
  pilihan_varian: string | null;
}

export const produkRepository = {
  // Fungsi mengambil banyak produk (Untuk Beranda & Halaman Produk)
  async getDaftarProduk(kategoriLabel?: string | null, kataKunci?: string) {
    let query = supabase.from('produk').select('*');

    // 🚀 SISTEM NORMALISASI PINTAR KATEGORI
    if (kategoriLabel && kategoriLabel !== 'All' && kategoriLabel !== 'Semua') {
      
      // Mengubah ke huruf besar dan membuang kata "PAMILO " jika ada (Misal: "Pamilo Service" -> "SERVICE")
      const nilaiNormal = kategoriLabel.toUpperCase().replace('PAMILO ', '').trim();

      if (nilaiNormal === 'SERVICE' || nilaiNormal === 'SERVIS') {
        // 🛠️ Jika kategori yang diminta adalah service, kita ambil semua variasi penulisan 
        // yang mungkin tertinggal atau salah ketik di database Anda agar PASTI muncul di layar.
        query = query.in('kategori_label_produk', ['SERVICE', 'service', 'Service', 'SERVIS', 'servis']);
      } else {
        // Untuk kategori FOOD dan MART, kita cari variasi teks asli, huruf besar, maupun huruf kecilnya
        query = query.in('kategori_label_produk', [kategoriLabel, nilaiNormal, nilaiNormal.toLowerCase()]);
      }
    }

    // Filter Pencarian Teks (Jika user mengetik di kolom pencarian)
    if (kataKunci && kataKunci.trim() !== '') {
      query = query.ilike('nama_produk', `%${kataKunci}%`);
    }

    // Urutkan dari yang terbaru
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    
    return data as Produk[];
  },

  // Fungsi mengambil 1 produk spesifik (Untuk Halaman Detail)
  async getDetailProdukSpesifik(idProduk: string) {
    const { data, error } = await supabase
      .from('produk')
      .select('*')
      .eq('id_produk', idProduk)
      .maybeSingle();

    if (error) throw error;
    return data as Produk | null;
  }
};