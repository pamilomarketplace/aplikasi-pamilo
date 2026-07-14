// features/migo/useDriverRadar.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { Alert, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';

export const useDriverRadar = (driverId: string | null) => {
  const [orderanTerbuka, setOrderanTerbuka] = useState<any[]>([]);

  useEffect(() => {
    if (!driverId) return;

    console.log(`[🛵 Radar Driver Aktif] Menunggu orderan Migo...`);

    // MENDENGARKAN STATUS 'MENCARI_DRIVER' DARI SELURUH KOTA
    const driverSubscription = supabase
      .channel('migo_radar_channel')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', // Tangkap perubahan status dari DIPROSES ke MENCARI_DRIVER
          schema: 'public',
          table: 'pesanan',
          filter: `status_pesanan=eq.MENCARI_DRIVER`
        },
        (payload) => {
          const orderanBaru = payload.new;
          
          // 1. Bunyikan/Getarkan HP Driver
          Vibration.vibrate([1000, 2000, 1000, 2000]); 

          // 2. Munculkan Notifikasi Sistem HP Driver
          Notifications.scheduleNotificationAsync({
            content: {
              title: "🛵 ORDERAN MIGO MASUK!",
              body: `Argo Ongkir: Rp ${orderanBaru.ongkos_kirim.toLocaleString('id-ID')}. Cepat ambil sebelum keduluan!`,
              sound: 'default',
            },
            trigger: null,
          });

          // 3. Masukkan ke Radar UI Driver
          setOrderanTerbuka((prev) => {
            // Hindari duplikasi jika sudah ada di radar
            if (prev.find(o => o.id === orderanBaru.id)) return prev;
            return [orderanBaru, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(driverSubscription);
    };
  }, [driverId]);

  // FUNGSI UNTUK DRIVER BEREBUT/MENGAMBIL ORDERAN
  const ambilOrderan = async (idPesanan: string) => {
    try {
      // Kita gunakan mekanisme penguncian (Locking) agar tidak ada 2 driver mengambil orderan yang sama
      const { data, error } = await supabase
        .from('pesanan')
        .update({ 
          status_pesanan: 'MENUJU_LOKASI',
          driver_id: driverId // 🚀 Kunci orderan dengan ID Driver ini!
        })
        .eq('id', idPesanan)
        .eq('status_pesanan', 'MENCARI_DRIVER') // Syarat mutlak: pastikan belum diambil orang lain
        .select()
        .single();

      if (error || !data) {
        throw new Error("Yah! Orderan ini sudah diambil driver lain (Kalah cepat).");
      }

      Alert.alert('Sukses 🎉', 'Orderan berhasil Anda ambil! Segera meluncur ke titik jemput.');
      
      // Hapus orderan dari daftar radar karena sudah kita ambil
      setOrderanTerbuka((prev) => prev.filter(o => o.id !== idPesanan));

    } catch (err: any) {
      Alert.alert('Gagal', err.message);
      // Hapus dari radar karena sudah hilang/diambil orang
      setOrderanTerbuka((prev) => prev.filter(o => o.id !== idPesanan));
    }
  };

  return { orderanTerbuka, ambilOrderan };
};