import { supabase } from '@/utils/supabaseClient';

export const orderRepository = {
  /**
   * Fungsi untuk mengambil orderan pasar (Anti Race-Condition)
   * menggunakan RPC 'ambil_orderan_pasar' di Supabase.
   */
  async ambilOrderanPasar(orderId: string, kurirId: string) {
    try {
      const { data, error } = await supabase.rpc('ambil_orderan_pasar', {
        p_order_id: orderId,
        p_kurir_id: kurirId,
      });

      if (error) {
        console.error('Supabase RPC Error:', error);
        throw new Error('Terjadi kesalahan jaringan saat mengambil orderan.');
      }

      return data;
    } catch (error: any) {
      console.error('orderRepository.ambilOrderanPasar Error:', error);
      throw error;
    }
  },

  /**
   * Mengambil data pesanan yang sedang diantar oleh kurir
   */
  async getActiveDelivery(kurirId: string) {
    const { data, error } = await supabase
      .from('orders')
      // Catatan: Jika di tabel Anda namanya 'kurir_id', ubah 'driver_id' di bawah menjadi 'kurir_id'
      .select('id, subtotal, ongkir, total_bayar, status, created_at, user_id, users(user_name), user_addresses(alamat_lengkap)')
      .eq('driver_id', kurirId) 
      .in('status', ['ACCEPTED', 'PICKED_UP'])
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Mengambil daftar orderan baru (PENDING) yang tersedia di pasar
   */
  async getPendingOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select('id, subtotal, ongkir, total_bayar, status, created_at, user_id, users(user_name), user_addresses(alamat_lengkap)')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Menyelesaikan pengantaran (Update status ke DELIVERED)
   */
  async selesaikanPengantaran(orderId: string) {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'DELIVERED' })
      .eq('id', orderId);

    if (error) throw error;
    return true;
  }
};