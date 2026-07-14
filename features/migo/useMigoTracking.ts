// features/migo/useMigoTracking.ts
import { useState, useEffect, useRef } from 'react';
import { BackHandler } from 'react-native'; 
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '@/utils/supabaseClient';
import { migoRepository } from './migoRepository';
import { useGlobalDriver } from '@/context/DriverContext';

export interface OrderData {
  id: string;
  pembeli_id?: string;
  status_order: 'MENCARI_DRIVER' | 'MENUJU_LOKASI' | 'DIANTAR' | 'SELESAI' | 'BATAL' | 'DITERIMA'; 
  alamat_jemput: string;
  alamat_antar: string;
  total_pembayaran: number;
  metode_pembayaran: string;
  jarak_km: number;
  latitude_jemput: number;
  longitude_jemput: number;
  latitude_tujuan: number;
  longitude_tujuan: number;
  tipe_layanan?: 'MIGO_RIDE' | 'MIGO_CAR'; 
  driver_id?: string | null;
  nama_penumpang?: string;
  penumpang_avatar?: string | null;
  driver_nama?: string;
  driver_plat?: string;
  driver_merek?: string;
  driver_avatar?: string | null;
  biaya_layanan?: number;
}

// 🚀 FIX: Tambahkan tempat khusus untuk nominal uang
export interface CustomAlertState {
  visible: boolean;
  title: string;
  message: string;
  isConfirm?: boolean;
  nominal?: string; // <--- UANG JUMBO
  onConfirm?: () => Promise<void> | void;
}

interface LiveLocation {
  lat: number;
  lng: number;
  heading: number;
}

export const useMigoTracking = (orderId: string | undefined, currentUserId: string | null) => {
  const router = useRouter();
  const { updateOrderProgress, hitungPendapatanBersihMigo } = useGlobalDriver();
  
  const [loadingTracking, setLoadingTracking] = useState<boolean>(true);
  const [btnLoading, setBtnLoading] = useState<boolean>(false); 
  const [order, setOrder] = useState<OrderData | null>(null);
  const [driverLiveLocation, setDriverLiveLocation] = useState<LiveLocation | null>(null);
  const [hasUnreadChat, setHasUnreadChat] = useState<boolean>(false);

  const [alertState, setAlertState] = useState<CustomAlertState>({ visible: false, title: '', message: '' });
  const [alertLoading, setAlertLoading] = useState<boolean>(false);
  const isCancellingRef = useRef<boolean>(false);

  const amIDriver = order?.driver_id === currentUserId;

  // 🚀 FIX: Menerima nominal opsional
  const showAlert = (title: string, message: string, onConfirm?: () => void, nominal?: string) => {
    setAlertState({ visible: true, title, message, isConfirm: false, onConfirm, nominal });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => Promise<void> | void) => {
    setAlertState({ visible: true, title, message, isConfirm: true, onConfirm });
  };

  const closeAlert = () => setAlertState(prev => ({ ...prev, visible: false }));

  const handleAlertConfirm = async () => {
    if (alertState.onConfirm) {
      setAlertLoading(true);
      try {
        await alertState.onConfirm();
      } finally {
        setAlertLoading(false);
      }
    } else {
      closeAlert();
    }
  };

  const syncOrderData = async (isFirstLoad = false) => {
    if (!orderId) return;
    try {
      if (isFirstLoad) setLoadingTracking(true);
      
      const orderData = await migoRepository.getOrderById(orderId);
      if (!orderData) throw new Error('Pesanan tidak ditemukan.');

      let finalOrder = { ...orderData } as OrderData;
      
      if (orderData.driver_id) {
        const dInfo = await migoRepository.getDriverProfile(orderData.driver_id);
        if (dInfo) {
          finalOrder.driver_nama = dInfo.driver_nama;
          finalOrder.driver_plat = dInfo.driver_plat;
          finalOrder.driver_merek = dInfo.driver_merek;
          finalOrder.driver_avatar = dInfo.driver_avatar;
        }
      }

      if (orderData.pembeli_id) {
        const { data: userData } = await supabase.from('users').select('user_name, user_avatar').eq('user_id', orderData.pembeli_id).maybeSingle();
        if (userData) {
          finalOrder.nama_penumpang = userData.user_name;
          finalOrder.penumpang_avatar = userData.user_avatar;
        }
      }

      setOrder(finalOrder);
    } catch (err) {
      if (isFirstLoad) showAlert('Gagal', 'Gagal memuat pesanan.', () => { closeAlert(); router.replace('/(tabs)' as any); });
    } finally {
      if (isFirstLoad) setLoadingTracking(false);
    }
  };

  useEffect(() => {
    syncOrderData(true);
    const pollInterval = setInterval(() => { syncOrderData(false); }, 5000);
    return () => clearInterval(pollInterval);
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;

    const orderChannel = supabase
      .channel(`migo_live_track_${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'migo_orders', filter: `id=eq.${orderId}` }, () => {
        syncOrderData(false);
      })
      .on('broadcast', { event: 'driver_location' }, (payload) => {
        setOrder((prev) => {
          if (prev && currentUserId !== prev.driver_id) {
            setDriverLiveLocation(payload.payload);
          }
          return prev;
        });
      })
      .subscribe();

    const chatChannel = supabase
      .channel(`chat_notif_${orderId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_pengguna', filter: `order_id=eq.${orderId}` }, (payload) => {
        const pesanBaru = payload.new;
        if (pesanBaru.sender_id !== currentUserId) setHasUnreadChat(true);
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(orderChannel); 
      supabase.removeChannel(chatChannel); 
    };
  }, [orderId, currentUserId]);

  useEffect(() => {
    if (!order) return;
    const isSopir = currentUserId === order.driver_id;
    
    if (order.status_order === 'BATAL') {
      if (isCancellingRef.current) return;
      showAlert('Dibatalkan 🛑', isSopir ? 'Mohon maaf, penumpang membatalkan pesanan ini.' : 'Mohon maaf, driver membatalkan perjalanan ini.', () => {
        closeAlert(); router.replace(isSopir ? '/driver' as any : '/(tabs)' as any);
      });
    } 
    else if (order.status_order === 'SELESAI') {
      const totalRupiah = `Rp ${Number(order.total_pembayaran).toLocaleString('id-ID')}`;
      
      const pesanDriver = `Perjalanan selesai! Pendapatan telah masuk ke dompet Anda.\n\nTotal Tagihan:`;
      const pesanPenumpang = `Perjalanan Selesai! Terima kasih telah menggunakan layanan Migo.\n\nTotal Tagihan:`;

      // 🚀 FIX: Mengirim nominal (uang) secara terpisah di argumen ke-4
      showAlert(
        'Selesai ✨', 
        isSopir ? pesanDriver : pesanPenumpang, 
        () => {
          closeAlert(); router.replace(isSopir ? '/driver' as any : '/(tabs)' as any);
        },
        totalRupiah 
      );
    }
  }, [order?.status_order, order?.total_pembayaran, currentUserId]);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    async function jalankanBroadcastGPS() {
      if (!amIDriver || !order || (order.status_order !== 'MENUJU_LOKASI' && order.status_order !== 'DIANTAR')) return;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      locationSubscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
        (locationData) => {
          const kordinatSemburan = {
            lat: locationData.coords.latitude,
            lng: locationData.coords.longitude,
            heading: locationData.coords.heading || 0,
          };
          setDriverLiveLocation(kordinatSemburan);
          supabase.channel(`migo_live_track_${orderId}`).send({ type: 'broadcast', event: 'driver_location', payload: kordinatSemburan });
        }
      );
    }
    jalankanBroadcastGPS();
    return () => { if (locationSubscription) locationSubscription.remove(); };
  }, [amIDriver, order?.status_order]);

  useEffect(() => {
    const handleHardwareBack = () => {
      router.replace(amIDriver ? '/driver' as any : '/(tabs)' as any);
      return true; 
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
    return () => subscription.remove();
  }, [amIDriver]);

  const handleCancelOrder = async () => {
    showConfirm('Batalkan Pesanan? 🛑', 'Apakah Anda yakin ingin membatalkan pesanan ini?', async () => {
      try {
        isCancellingRef.current = true;
        await migoRepository.batalkanPesanan(orderId as string);
        closeAlert(); 
        
        setOrder(prev => prev ? { ...prev, status_order: 'BATAL' } : null);
      } catch (err) { 
        isCancellingRef.current = false;
        showAlert('Gagal ❌', 'Gagal membatalkan pesanan. Cek koneksi Anda.', () => closeAlert()); 
      }
    });
  };

  const handleProgressDriver = async () => {
    if (!order) return;
    setBtnLoading(true);
    const statusBerikutnya = order.status_order === 'MENUJU_LOKASI' ? 'DIANTAR' : 'SELESAI';
    
    const hasil = await updateOrderProgress(order.id, statusBerikutnya, 'migo_orders');
    
    if (hasil.success) {
      setOrder(prev => prev ? { ...prev, status_order: statusBerikutnya } : null);
    } else {
      showAlert('Gagal Memperbarui ❌', hasil.message);
    }
    
    setBtnLoading(false);
  };

  return { 
    loadingTracking, btnLoading, order, amIDriver, driverLiveLocation, handleCancelOrder, handleProgressDriver,
    alertState, alertLoading, handleAlertConfirm, closeAlert, showAlert, showConfirm, hitungPendapatanBersihMigo,
    hasUnreadChat, setHasUnreadChat 
  };
};