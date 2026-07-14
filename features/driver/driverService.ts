// features/driver/driverService.ts
import { supabase } from '@/utils/supabaseClient';

export const driverService = {
  /**
   * Mengambil semua orderan masuk dari warga yang berstatus PENDING (belum diambil driver mana pun)
   */
  async getAvailableOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        total_harga,
        status,
        created_at,
        tipe_layanan,
        alamat_pengiriman,
        toko:toko_id (nama_toko, alamat_toko)
      `)
      .eq('status', 'PENDING')
      .is('driver_id', null)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Mengambil orderan yang saat ini sedang aktif diantarkan oleh driver tertentu
   */
  async getActiveDriverOrder(driverId: string) {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        total_harga,
        status,
        created_at,
        tipe_layanan,
        alamat_pengiriman,
        toko:toko_id (nama_toko, alamat_toko)
      `)
      .eq('driver_id', driverId)
      .in('status', ['ACCEPTED', 'PICKED_UP'])
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Aksi mengklaim/mengambil orderan masuk oleh Driver Migo
   */
  async claimOrder(orderId: string, driverId: string) {
    const { data, error } = await supabase
      .from('orders')
      .update({
        driver_id: driverId,
        status: 'ACCEPTED'
      })
      .eq('id', orderId)
      .is('driver_id', null) // Proteksi balapan klik antar-driver (race condition)
      .select()
      .single();

    if (error) throw new Error('Orderan ini sudah diambil oleh driver Migo lain!');
    return data;
  }
};