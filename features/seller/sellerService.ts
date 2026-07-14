// features/seller/sellerService.ts
import { supabase } from '@/utils/supabaseClient';

export const sellerService = {
  /**
   * Mengambil seluruh daftar produk yang terdaftar di toko milik merchant
   */
  async getTokoProducts(tokoId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('toko_id', tokoId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Memajang menu/produk baru ke dalam database pasar
   */
  async addProduct(payload: { tokoId: string; nama: string; harga: number; tipe: 'FOOD' | 'MART' | 'SERVICE'; deskripsi: string }) {
    const { data, error } = await supabase
      .from('products')
      .insert([
        {
          toko_id: payload.tokoId,
          nama: payload.nama,
          harga: payload.harga,
          tipe: payload.tipe,
          deskripsi: payload.deskripsi
        }
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Menurunkan/menghapus produk dari etalase toko
   */
  async deleteProduct(productId: string) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) throw new Error(error.message);
    return true;
  }
};