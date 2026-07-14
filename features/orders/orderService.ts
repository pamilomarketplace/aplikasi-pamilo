// features/orders/orderService.ts
import { supabase } from '@/utils/supabaseClient';

export const orderService = {
  /**
   * Mengambil daftar pesanan secara dinamis berdasarkan Role (User, Driver, atau Seller)
   */
  async getOrdersByRole(userId: string, role: 'WARGA' | 'DRIVER' | 'SELLER') {
    let query = supabase
      .from('orders')
      .select(`
        id,
        total_harga,
        status,
        created_at,
        tipe_layanan,
        profiles:user_id (nama),
        drivers:driver_id (nama)
      `);

    // Menyaring data berdasarkan hak akses role yang memanggil
    if (role === 'WARGA') {
      query = query.eq('user_id', userId);
    } else if (role === 'DRIVER') {
      query = query.eq('driver_id', userId);
    } else if (role === 'SELLER') {
      query = query.eq('toko_id', userId);
    }

    // Mengurutkan dari pesanan yang paling baru masuk
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Mengambil data satu pesanan secara spesifik beserta detail barang belandanya (Dynamic Route)
   */
  async getOrderById(orderId: string) {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        total_harga,
        status,
        created_at,
        tipe_layanan,
        alamat_pengiriman,
        metode_pembayaran,
        user_id,
        driver_id,
        toko_id,
        order_items (
          id,
          nama_produk,
          kuantitas,
          harga_satuan
        )
      `)
      .eq('id', orderId)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Mengubah status operasional pesanan di database (Alur aksi mutasi)
   */
  async updateOrderStatus(
    orderId: string, 
    status: 'PENDING' | 'ACCEPTED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED'
  ) {
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
};