// context/DriverContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Vibration } from 'react-native';
import { Audio } from 'expo-av'; 
import { supabase } from '@/utils/supabaseClient';
import { migoRepository } from '@/features/migo/migoRepository'; 

export interface MigoOrderData {
  id: string;
  tipe_order: 'MIGO' | 'PAMILO'; 
  tipe_layanan: string; 
  alamat_jemput: string; 
  alamat_antar: string;
  total_pembayaran: number;
  ongkos_kirim: number;
  metode_pembayaran: string;
  jarak_km: number;
  status_order: string; 
  driver_id?: string | null;
  nama_penumpang?: string; 
  toko_data?: { nama_toko: string }; 
  db_table: 'migo_orders' | 'pesanan'; 
}

interface DriverContextType {
  isDriver: boolean | null;
  isOnline: boolean;
  todayTrips: number;
  todayEarnings: number;
  availableOrders: MigoOrderData[];
  currentActiveOrder: MigoOrderData | null;
  loading: boolean;
  error: string | null;
  popupVisible: boolean;
  incomingOrder: MigoOrderData | null;
  setPopupVisible: (visible: boolean) => void;
  toggleOnlineStatus: () => Promise<void>;
  acceptOrder: (orderId: string, dbTable: 'migo_orders' | 'pesanan') => Promise<{ success: boolean; message: string }>;
  updateOrderProgress: (orderId: string, nextStatus: string, dbTable: 'migo_orders' | 'pesanan') => Promise<{ success: boolean; message: string }>;
  hitungPendapatanBersihMigo: (totalBayarWarga: number) => number;
  refreshPool: () => void;
}

const DriverContext = createContext<DriverContextType | undefined>(undefined);

export const DriverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [isDriver, setIsDriver] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [todayTrips, setTodayTrips] = useState<number>(0);
  const [todayEarnings, setTodayEarnings] = useState<number>(0);
  const [availableOrders, setAvailableOrders] = useState<MigoOrderData[]>([]);
  const [currentActiveOrder, setCurrentActiveOrder] = useState<MigoOrderData | null>(null);

  const [popupVisible, setPopupVisible] = useState<boolean>(false);
  const [incomingOrder, setIncomingOrder] = useState<MigoOrderData | null>(null);
  
  const [potonganDriverPersen, setPotonganDriverPersen] = useState<number>(0); 
  const [biayaLayanan, setBiayaLayanan] = useState<number>(1000); 
  
  const currentDriverId = useRef<string | null>(null);
  const driverProfileData = useRef<{ nama: string; plat: string; telp: string } | null>(null);
  const soundObjectRef = useRef<Audio.Sound | null>(null);

  const hitungPendapatanBersihMigo = useCallback((totalBayarWarga: number) => {
    const ongkosKotor = (totalBayarWarga - biayaLayanan > 0) ? (totalBayarWarga - biayaLayanan) : totalBayarWarga;
    const komisiAplikasi = (ongkosKotor * potonganDriverPersen) / 100;
    return ongkosKotor - komisiAplikasi;
  }, [biayaLayanan, potonganDriverPersen]);

  const fetchDriverSpecsAndData = useCallback(async (driverId: string, isBackgroundRefresh = false) => {
    try {
      if (!isBackgroundRefresh) setLoading(true);
      
      let konfigKomisi = 0; let konfigLayanan = 1000;
      try {
        const { data: globalConfig } = await supabase.from('pengaturan_aplikasi').select('kunci_konfigurasi, nilai_konfigurasi');
        if (globalConfig) {
          const k1 = globalConfig.find(item => item.kunci_konfigurasi === 'POTONGAN_DRIVER_PERSEN');
          const k2 = globalConfig.find(item => item.kunci_konfigurasi === 'BIAYA_LAYANAN_TRANSAKSI');
          if (k1) { konfigKomisi = Number(k1.nilai_konfigurasi); setPotonganDriverPersen(konfigKomisi); }
          if (k2) { konfigLayanan = Number(k2.nilai_konfigurasi); setBiayaLayanan(konfigLayanan); }
        }
      } catch (e) {}

      const { data: userProfile, error: userErr } = await supabase.from('users').select('role, user_name, user_phone, is_driver').eq('user_id', driverId).maybeSingle();
      if (userErr || !userProfile || (userProfile.is_driver !== true && userProfile.role !== 'DRIVER')) {
        setIsDriver(false);
        if (!isBackgroundRefresh) setLoading(false);
        return;
      }
      setIsDriver(true);

      const { data: driverProfile, error: driverErr } = await supabase.from('drivers').select('plat_nomor, status_driver').eq('user_id_driver', driverId).maybeSingle();
      if (driverErr || !driverProfile) {
        setError('Profil kemitraan driver belum terkonfigurasi.');
        if (!isBackgroundRefresh) setLoading(false);
        return;
      }

      const onlineStatusLive = driverProfile.status_driver === 'ONLINE';
      setIsOnline(onlineStatusLive);
      driverProfileData.current = { nama: userProfile.user_name, plat: driverProfile.plat_nomor, telp: userProfile.user_phone };

      const awalHariIni = new Date(); awalHariIni.setHours(0, 0, 0, 0);
      let totalUangSaku = 0; let totalTrip = 0;

      try {
        const { data: migoRecords } = await supabase.from('migo_orders').select('total_pembayaran').eq('driver_id', driverId).eq('status_order', 'SELESAI').gte('created_at', awalHariIni.toISOString());
        totalTrip += (migoRecords?.length || 0);
        migoRecords?.forEach(cur => {
          const ongkosKotor = (Number(cur.total_pembayaran) - konfigLayanan > 0) ? (Number(cur.total_pembayaran) - konfigLayanan) : Number(cur.total_pembayaran);
          totalUangSaku += (ongkosKotor - ((ongkosKotor * konfigKomisi) / 100));
        });
      } catch (e) {}

      try {
        const { data: pamiloRecords } = await supabase.from('pesanan').select('ongkos_kirim').eq('driver_id', driverId).eq('status_pesanan', 'SELESAI').gte('created_at', awalHariIni.toISOString());
        totalTrip += (pamiloRecords?.length || 0);
        pamiloRecords?.forEach(cur => {
          const ongkosKotor = (Number(cur.ongkos_kirim) - konfigLayanan > 0) ? (Number(cur.ongkos_kirim) - konfigLayanan) : Number(cur.ongkos_kirim);
          totalUangSaku += (ongkosKotor - ((ongkosKotor * konfigKomisi) / 100));
        });
      } catch (e) {}

      setTodayTrips(totalTrip);
      setTodayEarnings(totalUangSaku);

      let foundActiveOrder = false;

      try {
        const { data: activeMigo } = await supabase.from('migo_orders').select('*').eq('driver_id', driverId).in('status_order', ['MENUJU_LOKASI', 'DIANTAR']).maybeSingle();
        if (activeMigo) {
          setCurrentActiveOrder({
            id: activeMigo.id, tipe_order: 'MIGO', db_table: 'migo_orders', tipe_layanan: activeMigo.tipe_layanan,
            alamat_jemput: activeMigo.alamat_jemput, alamat_antar: activeMigo.alamat_antar,
            total_pembayaran: activeMigo.total_pembayaran, ongkos_kirim: activeMigo.total_pembayaran, 
            metode_pembayaran: activeMigo.metode_pembayaran, jarak_km: activeMigo.jarak_km || 0,
            status_order: activeMigo.status_order, nama_penumpang: activeMigo.nama_penumpang
          });
          setAvailableOrders([]);
          foundActiveOrder = true;
        }
      } catch (e) {}

      if (!foundActiveOrder) {
        try {
          const { data: activePamilo } = await supabase.from('pesanan').select('*').eq('driver_id', driverId).in('status_pesanan', ['MENUJU_TOKO', 'MENUJU_LOKASI']).maybeSingle();
          if (activePamilo) {
            let namaToko = 'Toko UMKM';
            if (activePamilo.id_toko) {
              const { data: toko } = await supabase.from('toko').select('nama_toko').eq('id_toko', activePamilo.id_toko).maybeSingle();
              if (toko) namaToko = toko.nama_toko;
            }
            setCurrentActiveOrder({
              id: activePamilo.id, tipe_order: 'PAMILO', db_table: 'pesanan', tipe_layanan: 'LOGISTIK',
              alamat_jemput: namaToko, alamat_antar: activePamilo.alamat_pengiriman || '',
              total_pembayaran: activePamilo.total_pembayaran, ongkos_kirim: activePamilo.ongkos_kirim, 
              metode_pembayaran: activePamilo.metode_pembayaran, jarak_km: 0,
              status_order: activePamilo.status_pesanan, toko_data: { nama_toko: namaToko }
            });
            setAvailableOrders([]);
            foundActiveOrder = true;
          }
        } catch (e) {}
      }

      if (!foundActiveOrder) setCurrentActiveOrder(null);

      if (!onlineStatusLive || foundActiveOrder) {
        if (!isBackgroundRefresh) setLoading(false);
        return;
      }

      let migoMapped: MigoOrderData[] = [];
      let pamiloMapped: MigoOrderData[] = [];

      try {
        const { data: activeBlasts } = await supabase.from('migo_order_blasts').select(`migo_orders (*)`).eq('driver_id', driverId).eq('status_blast', 'DIBLAST');
        const validMigo = (activeBlasts || [])
          .map((b: any) => {
            const m: any = Array.isArray(b.migo_orders) ? b.migo_orders[0] : b.migo_orders;
            return { blastId: b.id, migoObj: m };
          })
          .filter((b: any) => b.migoObj && b.migoObj.status_order === 'MENCARI_DRIVER');

        migoMapped = validMigo.map((b: any) => {
          const m = b.migoObj;
          return {
            id: m.id, tipe_order: 'MIGO', db_table: 'migo_orders', tipe_layanan: m.tipe_layanan,
            alamat_jemput: m.alamat_jemput, alamat_antar: m.alamat_antar,
            total_pembayaran: Number(m.total_pembayaran), ongkos_kirim: Number(m.total_pembayaran),
            metode_pembayaran: m.metode_pembayaran, jarak_km: Number(m.jarak_km || 1), 
            status_order: m.status_order, nama_penumpang: m.nama_penumpang
          };
        });
      } catch (err) {}

      try {
        const { data: logistikBlasts } = await supabase.from('pamilo_logistik_blasts').select('pesanan(*)').eq('driver_id', driverId);
        const validLogistik = (logistikBlasts || [])
          .map((b: any) => {
            const p: any = Array.isArray(b.pesanan) ? b.pesanan[0] : b.pesanan;
            return { blastId: b.id, pesananObj: p };
          })
          .filter((b: any) => b.pesananObj && b.pesananObj.status_pesanan === 'SIAP_PICKUP');
        
        for (const b of validLogistik) {
          const p = b.pesananObj;
          let namaToko = 'Toko UMKM';
          if (p.id_toko) {
            const { data: t } = await supabase.from('toko').select('nama_toko').eq('id_toko', p.id_toko).maybeSingle();
            if (t) namaToko = t.nama_toko;
          }
          pamiloMapped.push({
            id: p.id, tipe_order: 'PAMILO', db_table: 'pesanan', tipe_layanan: 'LOGISTIK',
            alamat_jemput: namaToko, alamat_antar: p.alamat_pengiriman || '',
            total_pembayaran: Number(p.total_pembayaran), ongkos_kirim: Number(p.ongkos_kirim),
            metode_pembayaran: p.metode_pembayaran, jarak_km: 1, 
            status_order: p.status_pesanan, toko_data: { nama_toko: namaToko }
          });
        }
      } catch (err) {}

      setAvailableOrders([...migoMapped, ...pamiloMapped]);

    } catch (err: any) {
      setError(err.message);
    } finally {
      if (!isBackgroundRefresh) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const bootDriverMigoContext = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        currentDriverId.current = user.id;
        await fetchDriverSpecsAndData(user.id, false);
      } else {
        setLoading(false);
      }
    };
    bootDriverMigoContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const channelName = `radar_superapp_${Date.now()}`;
    const channel = supabase.channel(channelName);

    const triggerRefresh = () => {
      console.log('📡 [RADAR] Sinyal Orderan Masuk Tertangkap!');
      const activeId = currentDriverId.current;
      if (activeId) fetchDriverSpecsAndData(activeId, true);
    };

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'migo_order_blasts' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pamilo_logistik_blasts' }, triggerRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'migo_orders' }, triggerRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pesanan' }, triggerRefresh)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ [SATELIT] Terhubung ke Supabase Realtime! (Channel: ${channelName})`);
        }
      });

    return () => { 
      supabase.removeChannel(channel); 
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useEffect(() => {
    if (isOnline && availableOrders && availableOrders.length > 0 && !currentActiveOrder) {
      const orderTerbaru = availableOrders[0];
      if (!incomingOrder || incomingOrder.id !== orderTerbaru.id) {
        setIncomingOrder(orderTerbaru);
        setPopupVisible(true);
      }
    } else {
      setPopupVisible(false);
    }
  }, [availableOrders, isOnline, currentActiveOrder]);

  useEffect(() => {
    let isMounted = true;
    async function startHardwareAlarm() {
      if (popupVisible && incomingOrder) {
        try {
          Vibration.vibrate([500, 1000, 500, 1000], true);
          await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true });
          const { sound } = await Audio.Sound.createAsync(require('../assets/migo.mp3'), { shouldPlay: true, isLooping: true, volume: 1.0 });
          if (isMounted) soundObjectRef.current = sound;
          else await sound.unloadAsync();
        } catch (e) { console.warn('[ALARM EXPO ERROR]', e); }
      }
    }
    async function stopHardwareAlarm() {
      if (!popupVisible) {
        if (soundObjectRef.current) {
          try {
            await soundObjectRef.current.stopAsync();
            await soundObjectRef.current.unloadAsync();
            soundObjectRef.current = null;
          } catch (e) {}
        }
        Vibration.cancel();
      }
    }
    if (popupVisible) startHardwareAlarm();
    else stopHardwareAlarm();

    return () => {
      isMounted = false;
      Vibration.cancel();
      if (soundObjectRef.current) soundObjectRef.current.unloadAsync().catch(() => {});
    };
  }, [popupVisible, incomingOrder]);

  const toggleOnlineStatus = async () => {
    const snapshotId = currentDriverId.current;
    if (!snapshotId) return;
    const nextStatusStr = isOnline ? 'OFFLINE' : 'ONLINE';
    try {
      const { error } = await supabase.from('drivers').update({ status_driver: nextStatusStr }).eq('user_id_driver', snapshotId);
      if (error) throw error;
      await fetchDriverSpecsAndData(snapshotId, true);
    } catch (err: any) { Alert.alert('Gagal Mengubah Status ❌', err.message); }
  };

  const acceptOrder = async (orderId: string, dbTable: 'migo_orders' | 'pesanan') => {
    const snapshotId = currentDriverId.current;
    if (!snapshotId || !driverProfileData.current) return { success: false, message: 'Identifikasi driver tidak valid.' };
    
    try {
      if (dbTable === 'migo_orders') {
        const { data, error } = await supabase.from('migo_orders')
          .update({ driver_id: snapshotId, biaya_layanan: biayaLayanan, status_order: 'MENUJU_LOKASI' })
          .eq('id', orderId)
          .eq('status_order', 'MENCARI_DRIVER')
          .select('id').single();
          
        if (error || !data) return { success: false, message: 'Telat! Orderan Migo sudah diambil driver lain.' };
        
        await supabase.from('migo_order_blasts').update({ status_blast: 'DITERIMA' }).eq('order_id', orderId).eq('driver_id', snapshotId);
      } else {
        // 🚀 FIX: LOGISTIK SEKARANG MEMANGGIL JALUR VVIP (RPC) BUKAN UPDATE LANGSUNG
        const { data, error } = await supabase.rpc('ambil_pesanan_logistik', {
          p_order_id: orderId,
          p_driver_id: snapshotId
        });

        if (error) return { success: false, message: error.message };
        
        // Membaca balasan dari RPC (Apakah sukses mengunci atau keduluan driver lain)
        if (data && data.success === false) {
          return { success: false, message: data.message };
        }
      }

      await fetchDriverSpecsAndData(snapshotId, true);
      return { success: true, message: 'Orderan berhasil dikunci! Segera meluncur.' };
    } catch (err: any) { return { success: false, message: err.message }; }
  };

  const updateOrderProgress = async (orderId: string, nextStatus: string, dbTable: 'migo_orders' | 'pesanan') => {
    const snapshotId = currentDriverId.current;
    if (!snapshotId) return { success: false, message: 'Sesi kedaluwarsa.' };
    
    try {
      if (dbTable === 'migo_orders') {
        if (nextStatus === 'SELESAI') {
          await migoRepository.selesaikanOrderanFinansial(orderId);
        } else {
          await supabase.from('migo_orders').update({ status_order: nextStatus }).eq('id', orderId);
        }
      } else {
        if (nextStatus === 'SELESAI') {
          const { error } = await supabase.rpc('selesaikan_pesanan_logistik', { p_order_id: orderId });
          if (error) throw error;
        } else {
          await supabase.from('pesanan').update({ status_pesanan: nextStatus }).eq('id', orderId);
        }
      }

      await fetchDriverSpecsAndData(snapshotId, true);
      return { success: true, message: 'Status rute diperbarui.' };
    } catch (err: any) { 
      return { success: false, message: err.message }; 
    }
  };

  return (
    <DriverContext.Provider value={{
      isDriver, isOnline, todayTrips, todayEarnings, availableOrders, currentActiveOrder,
      loading, error, popupVisible, incomingOrder, setPopupVisible,
      toggleOnlineStatus, acceptOrder, updateOrderProgress, hitungPendapatanBersihMigo,
      refreshPool: () => {
        const activeId = currentDriverId.current;
        if (activeId) fetchDriverSpecsAndData(activeId, true);
      }
    }}>
      {children}
    </DriverContext.Provider>
  );
};

export const useGlobalDriver = () => {
  const context = useContext(DriverContext);
  if (!context) throw new Error('useGlobalDriver harus dibungkus dalam DriverProvider');
  return context;
};