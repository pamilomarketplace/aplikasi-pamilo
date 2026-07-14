// features/migo/migoRepository.ts
import { supabase } from '@/utils/supabaseClient';

export const migoRepository = {
  async getDefaultAddress(userId: string) {
    const { data, error } = await supabase
      .from('user_addresses')
      .select('alamat_lengkap, latitude, longitude')
      .eq('user_id', userId)
      .eq('is_utama', true)
      .maybeSingle();
      
    if (error || !data) return null;
    return data;
  },

  async createOrder(payload: any) {
    const { data, error } = await supabase
      .from('migo_orders')
      .insert(payload)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  },

  async ambilOrderan(orderId: string, driverId: string) {
    try {
      const { data, error } = await supabase.rpc('ambil_orderan_migo', {
        p_order_id: orderId,
        p_driver_id: driverId,
      });
      if (error) throw new Error(error.message || 'Terjadi kesalahan jaringan.');
      return data; 
    } catch (error) {
      throw error;
    }
  },

  // 🚀 FITUR BARU: Jembatan Eksekusi Finansial (Menyambung ke RPC Database)
  async selesaikanOrderanFinansial(orderId: string) {
    try {
      const { data, error } = await supabase.rpc('selesaikan_orderan_migo', {
        p_order_id: orderId
      });

      // supabase.rpc dengan fungsi custom biasanya mengembalikan objek JSON success & message
      if (error) {
        throw new Error(error.message || 'Sistem dompet gagal merespons.');
      }
      
      if (data && data.success === false) {
         throw new Error(data.message || 'Gagal menyelesaikan rute secara finansial.');
      }
      
      return data;
    } catch (error: any) {
      throw error;
    }
  },

  async getOrderById(orderId: string) {
    const { data: orderData, error: orderErr } = await supabase
      .from('migo_orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr) throw orderErr;
    if (!orderData) return null;

    let penumpangAvatar = null;
    let namaPenumpang = orderData.nama_penumpang || null;

    if (orderData.pembeli_id) {
      const { data: userData } = await supabase
        .from('users')
        .select('user_name, user_avatar')
        .eq('user_id', orderData.pembeli_id)
        .maybeSingle();
      
      if (userData) {
        penumpangAvatar = userData.user_avatar;
        if (userData.user_name) namaPenumpang = userData.user_name; 
      }
    }

    return { 
      ...orderData, 
      penumpang_avatar: penumpangAvatar,
      nama_penumpang: namaPenumpang 
    };
  },

  async getDriverProfile(driverId: string) {
    const { data, error } = await supabase
      .from('drivers')
      .select('nama_driver, plat_nomor, merek_kendaraan, foto_wajah')
      .eq('user_id_driver', driverId)
      .maybeSingle();

    if (error) return null;
    return {
      driver_nama: data?.nama_driver,
      driver_plat: data?.plat_nomor,
      driver_merek: data?.merek_kendaraan,
      driver_avatar: data?.foto_wajah 
    };
  },

  async batalkanPesanan(orderId: string) {
    const { error } = await supabase
      .from('migo_orders')
      .update({ status_order: 'BATAL' })
      .eq('id', orderId);

    if (error) throw error;
    return true;
  }
};