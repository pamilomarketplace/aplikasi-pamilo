// features/driver/useDriverOrders.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';

export const useDriverOrders = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);
  
  // Radar pesanan (Belum ada driver yang ambil)
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  // Pesanan yang saat ini sedang dikerjakan driver (Eksklusif 1 Pesanan)
  const [myActiveOrder, setMyActiveOrder] = useState<any>(null);

  const fetchDriverData = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;
    setDriverId(auth.user.id);

    // 1. Cek apakah driver punya orderan yang sedang berjalan
    const { data: activeOrder } = await supabase
      .from('pesanan')
      .select('*')
      .eq('driver_id', auth.user.id)
      .not('status_pesanan', 'in', '("SELESAI", "BATAL")')
      .maybeSingle();

    if (activeOrder) {
      // Manual Join untuk ambil nama Toko (Anti-Error tanpa Foreign Key)
      if (activeOrder.id_toko) {
        const { data: toko } = await supabase.from('toko').select('nama_toko, alamat_toko').eq('id_toko', activeOrder.id_toko).single();
        activeOrder.toko_data = toko;
      }
      setMyActiveOrder(activeOrder);
      setAvailableOrders([]); // Kosongkan radar, fokus ke 1 pesanan!
    } else {
      setMyActiveOrder(null);
      
      // 2. Jika nganggur, tampilkan semua pesanan di Radar (Status: SIAP_PICKUP & Belum ada driver)
      const { data: radarOrders } = await supabase
        .from('pesanan')
        .select('*')
        .eq('status_pesanan', 'SIAP_PICKUP')
        .is('driver_id', null)
        .order('created_at', { ascending: true });

      if (radarOrders && radarOrders.length > 0) {
        const tokoIds = radarOrders.map(r => r.id_toko).filter(Boolean);
        if (tokoIds.length > 0) {
          const { data: tokos } = await supabase.from('toko').select('id_toko, nama_toko, alamat_toko').in('id_toko', tokoIds);
          radarOrders.forEach(r => {
            r.toko_data = tokos?.find(t => t.id_toko === r.id_toko) || null;
          });
        }
        setAvailableOrders(radarOrders);
      } else {
        setAvailableOrders([]);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDriverData();

    // RADAR REAL-TIME: Otomatis berbunyi jika ada pesanan "SIAP_PICKUP" dari Toko
    const subscription = supabase
      .channel('driver_radar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pesanan' }, 
      () => {
        fetchDriverData();
      })
      .subscribe();
      
    return () => { supabase.removeChannel(subscription); };
  }, [fetchDriverData]);

  // AKSI 1: AMBIL ORDERAN DARI RADAR
  const handleTerimaOrder = async (orderId: string) => {
    if (!driverId) return;
    try {
      const { error } = await supabase
        .from('pesanan')
        .update({ status_pesanan: 'MENUJU_TOKO', driver_id: driverId })
        .eq('id', orderId)
        .is('driver_id', null); // Mengunci agar tidak bentrok (direbut driver lain)
        
      if (error) throw error;
      Alert.alert('Tugas Diterima! 🛵', 'Silakan luncur ke lokasi Toko untuk mengambil barang.');
      fetchDriverData();
    } catch (err: any) {
      Alert.alert('Gagal Mengambil', 'Pesanan ini mungkin baru saja diambil oleh driver Migo lain.');
      fetchDriverData();
    }
  };

  // AKSI 2: BARANG SUDAH DI TANGAN -> ANTAR KE PEMBELI
  const handleAntarPesanan = async (orderId: string) => {
    try {
      const { error } = await supabase.from('pesanan').update({ status_pesanan: 'MENUJU_LOKASI' }).eq('id', orderId);
      if (error) throw error;
      fetchDriverData();
    } catch (err: any) {
      Alert.alert('Gagal', err.message);
    }
  };

  // AKSI 3: TIBA DI LOKASI -> SELESAIKAN PESANAN (Persiapan RPC Finansial)
  const handleSelesaikanPesanan = async (orderId: string) => {
    try {
      // ⚠️ PERHATIAN TUAN MASTER: Di file ini, kita hanya update UI sementara.
      // Nanti logika update ini akan kita HAPUS dan GANTI dengan panggil fungsi RPC Database Finansial!
      const { error } = await supabase.from('pesanan').update({ status_pesanan: 'SELESAI' }).eq('id', orderId);
      if (error) throw error;
      
      Alert.alert('Pesanan Selesai! 🎉', 'Terima kasih telah menyelesaikan tugas. Pembagian saldo akan segera dieksekusi.');
      fetchDriverData();
    } catch (err: any) {
      Alert.alert('Gagal Menyelesaikan', err.message);
    }
  };

  return { 
    loading, availableOrders, myActiveOrder, router,
    handleTerimaOrder, handleAntarPesanan, handleSelesaikanPesanan, refreshData: fetchDriverData
  };
};