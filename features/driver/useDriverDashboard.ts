import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/utils/supabaseClient';
import { orderRepository } from '@/features/orders/orderRepository'; // Pastikan path ini sesuai

export interface AvailableOrder {
  id: string;
  subtotal: number;
  ongkir: number;
  total_bayar: number;
  status: string;
  created_at: string;
  user_id: string;
  users: {
    user_name: string;
  } | null;
  user_addresses: {
    alamat_lengkap: string;
  } | null;
}

export const useDriverDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<AvailableOrder | null>(null);
  
  const currentDriverId = useRef<string | null>(null);

  // 🚀 LOGIKA 1: PENARIK DAFTAR ORDERAN VIA REPOSITORY
  const fetchDriverScreenData = useCallback(async (driverId: string) => {
    try {
      setLoading(true);

      // 1. Cek apakah driver ini sedang mengantar orderan
      const activeData = await orderRepository.getActiveDelivery(driverId);
      
      if (activeData) {
        setActiveDelivery(activeData as any);
        setAvailableOrders([]); // Kosongkan list rebutan jika sedang mengantar barang
        return; // Hentikan eksekusi, tidak perlu ambil orderan pending jika sedang sibuk
      } else {
        setActiveDelivery(null);
      }

      // 2. Jika bebas tugas, tarik daftar orderan pasar
      const pendingOrders = await orderRepository.getPendingOrders();
      
      if (pendingOrders) {
        setAvailableOrders(pendingOrders as any);
      }

    } catch (err: any) {
      Alert.alert('Gagal Memuat Dashboard Kurir', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Inisialisasi awal identitas auth driver
  useEffect(() => {
    const initDriver = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        currentDriverId.current = user.id;
        await fetchDriverScreenData(user.id);
      }
    };
    initDriver();
  }, [fetchDriverScreenData]);

  // 🚀 LOGIKA 2: REAL-TIME SUBSCRIPTION YANG DIOPTIMALKAN (ANTI-THUNDERING HERD)
  useEffect(() => {
    const idSopir = currentDriverId.current;
    if (!idSopir) return;
    
    const channel = supabase
      .channel('realtime-driver-market')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          const newData = payload.new as any;

          if (payload.eventType === 'INSERT') {
            // Jika ada orderan baru dengan status PENDING masuk
            if (newData.status === 'PENDING') {
              fetchDriverScreenData(idSopir);
            }
          } 
          else if (payload.eventType === 'UPDATE') {
            // Skenario 1: Orderan diambil KURIR LAIN (Sembunyikan dari layar tanpa fetch database)
            if (newData.status !== 'PENDING' && newData.driver_id !== idSopir) {
              setAvailableOrders((prevOrders) => 
                prevOrders.filter((order) => order.id !== newData.id)
              );
            }
            // Skenario 2: Orderan ini milik KITA SENDIRI (Sinkronisasi dengan database)
            else if (newData.driver_id === idSopir) {
              fetchDriverScreenData(idSopir);
            }
          }
          else if (payload.eventType === 'DELETE') {
            // Jika pesanan dihapus/dibatalkan, hilangkan dari layar
            const oldData = payload.old as any;
            setAvailableOrders((prevOrders) => 
              prevOrders.filter((order) => order.id !== oldData.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDriverScreenData]);

  // 🚀 LOGIKA 3: AKSI REBUT / AMBIL ALIH ORDERAN WARGA (VIA REPOSITORY)
  const handleAcceptOrder = async (orderId: string) => {
    if (!currentDriverId.current || processingId) return;

    try {
      setProcessingId(orderId);

      // Panggil fungsi RPC satu baris yang kebal Race-Condition
      const result = await orderRepository.ambilOrderanPasar(orderId, currentDriverId.current);

      if (result.success) {
        Alert.alert('Sukses 🎉', 'Orderan berhasil Anda kunci! Silakan segera menuju kios pasar dan koordinasikan belanjaan via chat.');
        if (currentDriverId.current) fetchDriverScreenData(currentDriverId.current);
      } else {
        Alert.alert('Gagal ❌', result.message);
        if (currentDriverId.current) fetchDriverScreenData(currentDriverId.current);
      }

    } catch (err: any) {
      Alert.alert('Gagal Mengambil Orderan', err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // 🚀 LOGIKA 4: AKSI SELESAIKAN PENGANTARAN (VIA REPOSITORY)
  const handleCompleteDelivery = async (orderId: string) => {
    if (processingId) return;

    try {
      setProcessingId(orderId);

      await orderRepository.selesaikanPengantaran(orderId);

      Alert.alert('Tugas Selesai ✨', 'Alhamdulillah, ongkir berhak Anda terima. Tetap utamakan keselamatan berkendara di jalan!');
      if (currentDriverId.current) fetchDriverScreenData(currentDriverId.current);

    } catch (err: any) {
      Alert.alert('Gagal Menyelesaikan Pengantaran', err.message);
    } finally {
      setProcessingId(null);
    }
  };

  return {
    loading,
    processingId,
    availableOrders,
    activeDelivery,
    driverId: currentDriverId.current,
    handleAcceptOrder,
    handleCompleteDelivery,
    refreshDashboard: () => currentDriverId.current && fetchDriverScreenData(currentDriverId.current)
  };
};