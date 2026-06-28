// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { 
  StatusBar, Platform, LogBox, Alert, Vibration, DeviceEventEmitter, 
  Modal, View, Text, TouchableOpacity, StyleSheet 
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';

LogBox.ignoreLogs(['setBackgroundColorAsync', 'Invalid Refresh Token', 'activateKeepAwake']);
import * as NavigationBar from 'expo-navigation-bar'; 

import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av'; 
import Constants from 'expo-constants';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';

import { supabase } from '@/supabaseConfig';
import { CartProvider } from '../context/CartContext';

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

const TASK_GPS_MIGO_BACKGROUND = 'TUGAS_PELACAK_BACKGROUND_MIGO_V1';

TaskManager.defineTask(TASK_GPS_MIGO_BACKGROUND, async ({ data, error }) => {
  if (error || !data) return;
  const lokasi = data.locations[0];
  if (lokasi) {
    try {
      const driverId = await AsyncStorage.getItem('DRIVER_USER_ID');
      const isOnline = await AsyncStorage.getItem('DRIVER_ONLINE_STATUS');
      const activeOrderId = await AsyncStorage.getItem('ACTIVE_ORDER_ID'); 
      
      if (driverId && isOnline === 'true') {
        const lat = lokasi.coords.latitude;
        const lng = lokasi.coords.longitude;

        await supabase.from('drivers').update({ 
          latitude_driver: lat, 
          longitude_driver: lng,
          updated_at: new Date().toISOString()
        }).eq('user_id_driver', driverId);

        if (activeOrderId) {
          const channel = supabase.channel(`live-tracking-${activeOrderId}`);
          await channel.send({ type: 'broadcast', event: 'POSISI_DRIVER_UPDATE', payload: { lat, lng } });
          supabase.removeChannel(channel);
        }
      }
    } catch (err) {}
  }
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }),
});

SplashScreen.preventAutoHideAsync().catch(() => {});

let globalAudioInstance: Audio.Sound | null = null;
let audioTimeout: NodeJS.Timeout | null = null;
let isMemuatAudio = false; 

const putarSuaraMigoGlobal = async () => {
  if (isMemuatAudio) return; 
  isMemuatAudio = true;
  try {
    if (globalAudioInstance) {
      await globalAudioInstance.stopAsync().catch(() => {});
      await globalAudioInstance.unloadAsync().catch(() => {});
      globalAudioInstance = null;
    }
    
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false, staysActiveInBackground: true, playsInSilentModeIOS: true,
      shouldRouteThroughEarpieceAndroid: false, playThroughEarpieceAndroid: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      require('../assets/sounds/migo.mp3'),
      { shouldPlay: true, isLooping: true, volume: 1.0 }
    );
    globalAudioInstance = sound;

    if (audioTimeout) clearTimeout(audioTimeout);
    audioTimeout = setTimeout(() => {
      matikanSuaraMigoGlobal();
      DeviceEventEmitter.emit('TUTUP_MODAL_KADALUARSA'); 
    }, 30000);

  } catch (error) { 
    console.log("❌ Gagal memutar audio:", error); 
  } finally {
    isMemuatAudio = false;
  }
};

const matikanSuaraMigoGlobal = async () => {
  Vibration.cancel();
  if (audioTimeout) clearTimeout(audioTimeout);
  if (globalAudioInstance) {
    await globalAudioInstance.stopAsync().catch(() => {});
    await globalAudioInstance.unloadAsync().catch(() => {});
    globalAudioInstance = null;
  }
};

async function daftarkanNotifikasiDanToken(userId?: string) {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('channel-pamilo-jebol-v5', {
        name: 'Orderan Masuk Super MIGO', importance: Notifications.AndroidImportance.MAX,              
        vibrationPattern: [0, 500, 200, 500], lightColor: '#D35400', sound: 'migo.mp3', lockscreenVisibility: 1, bypassDnd: true,            
      });
      await Notifications.setNotificationChannelAsync('pamilo-urgent', {
        name: 'Notifikasi Penting PAMILO', importance: Notifications.AndroidImportance.MAX, 
        vibrationPattern: [0, 250, 250, 250], lightColor: '#2E7D32', sound: 'default', lockscreenVisibility: 1, bypassDnd: true,            
      });
    }

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    if (tokenData.data) {
      await AsyncStorage.setItem('PUSH_TOKEN', tokenData.data);
      if (userId) await supabase.from('users').update({ push_token: tokenData.data }).eq('user_id', userId);
    }
    return tokenData.data;
  } catch (error) { return null; }
}

export default function RootLayout() {
  const [session, setSession] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);
  const [checkingSystem, setCheckingSystem] = useState(true);

  const [globalOrder, setGlobalOrder] = useState<any>(null); 
  const [globalSellerOrder, setGlobalSellerOrder] = useState<any>(null); 

  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const isNavReady = !!rootNavigationState?.key; 

  const kirimKeSystemTray = async (title: string, body: string, orderId: string, table: string, tipe: string, nama: string, ongkir: number) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        sound: 'migo.mp3', 
        data: { orderId, table, tipe, nama, ongkir },
        channelId: 'channel-pamilo-jebol-v5',
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null, 
    });
  };

  useEffect(() => {
    const subs1 = DeviceEventEmitter.addListener('TUTUP_MODAL_RADAR_OTOMATIS', (orderId) => {
      setGlobalOrder((prev: any) => {
        if (prev && prev.orderId === orderId) { matikanSuaraMigoGlobal(); return null; }
        return prev;
      });
    });

    const subs2 = DeviceEventEmitter.addListener('TUTUP_MODAL_KADALUARSA', () => {
      setGlobalOrder(null); setGlobalSellerOrder(null); matikanSuaraMigoGlobal();
    });

    return () => { subs1.remove(); subs2.remove(); };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync('#4A3525').catch(() => {});
      NavigationBar.setButtonStyleAsync('light').catch(() => {}); 
    }

    daftarkanNotifikasiDanToken();

    const penangkapPushForeground = Notifications.addNotificationReceivedListener(notification => {
      console.log("💥 RADAR INDUK: Push Notifikasi Mendarat di Foreground!");
      const dataPayload = notification.request.content.data;
      Vibration.vibrate([0, 400, 200, 400]);
      
      if (dataPayload?.tipe === "ORDERAN_BARU" || dataPayload?.tipe === "ORDERAN_SELLER") {
        putarSuaraMigoGlobal();
      }
    });

    const penangkapKlikNotifikasi = Notifications.addNotificationResponseReceivedListener(response => {
      const payloadData = response.notification.request.content.data;
      matikanSuaraMigoGlobal();
      setGlobalOrder(null); setGlobalSellerOrder(null);

      if (isNavReady) {
        setTimeout(() => {
          if (payloadData?.tipe === "ORDERAN_SELLER") {
            router.push('/seller/pesanan-masuk');
          } else if (payloadData?.tipe === "CHAT_MESSAGE") {
            router.push({ pathname: '/chat/[id]', params: { id: payloadData.orderId } });
          } else {
            const targetId = payloadData?.orderId || payloadData?.id;
            if (targetId) {
              if (payloadData?.table === 'migo_orders') router.push(`/orders/detail-migo?id=${targetId}`);
              else router.push(`/orders/detail?id=${targetId}`);
            } else router.push('/(tabs)/pesanan');
          }
        }, 800);
      }
    });

    return () => { 
      penangkapKlikNotifikasi.remove(); 
      penangkapPushForeground.remove(); 
    };
  }, [isNavReady]); 

  const tanganiTerimaOrderanGlobal = async () => {
    if (!globalOrder) return;
    matikanSuaraMigoGlobal();
    const targetOrder = globalOrder;
    setGlobalOrder(null); 

    try {
      const driverUid = await AsyncStorage.getItem('DRIVER_USER_ID');
      const targetTable = targetOrder.table;
      const isMigo = targetTable === 'migo_orders';
      const namaKolomKunci = isMigo ? 'driver_id' : 'kurir_id';
      
      const { data } = await supabase
        .from(targetTable)
        .update(isMigo ? { driver_id: driverUid, status_order: 'MENUJU_JEMPUT' } : { kurir_id: driverUid, status_order: 'DIPROSES' })
        .eq('id', targetOrder.orderId)
        .in('status_order', isMigo ? ['MENCARI_DRIVER'] : ['PENDING', 'MENCARI_KURIR'])
        .is(namaKolomKunci, null) 
        .select();

      if (data && data.length > 0) {
        router.push({ pathname: '/driver/tugas-aktif', params: { id: data[0].id, asal_tabel: targetTable } });
      } else Alert.alert("Terlambat 😣", "Orderan sudah diambil rekan driver lainnya atau dibatalkan pembeli.");
    } catch (err) {}
  };

  const tanganiLewatiOrderanGlobal = () => { matikanSuaraMigoGlobal(); setGlobalOrder(null); };
  const tanganiBukaDapurSeller = () => { matikanSuaraMigoGlobal(); setGlobalSellerOrder(null); router.push('/seller/pesanan-masuk'); };
  const tanganiTutupAlertSeller = () => { matikanSuaraMigoGlobal(); setGlobalSellerOrder(null); };

  useEffect(() => {
    const muatStatusSistem = async () => {
      try { await supabase.from('pengaturan_aplikasi').select('kunci_konfigurasi, nilai_konfigurasi'); } 
      catch (err) {} finally { setCheckingSystem(false); }
    };
    muatStatusSistem();

    const hantamMundurSafety = setTimeout(() => { setInitializing(false); setCheckingSystem(false); }, 3500);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user) {
        daftarkanNotifikasiDanToken(currentSession.user.id);
        (async () => {
          try {
            const { data: tData } = await supabase.from('toko').select('id_toko').eq('user_id_toko', currentSession.user.id).maybeSingle();
            if (tData) await AsyncStorage.setItem('SELLER_ID', tData.id_toko);
            await AsyncStorage.setItem('DRIVER_USER_ID', currentSession.user.id);
          } catch (bgErr) {}
        })();
      } else {
        (async () => { try { await AsyncStorage.removeItem('SELLER_ID'); await AsyncStorage.removeItem('DRIVER_USER_ID'); } catch (err) {} })();
      }
      setInitializing(false); clearTimeout(hantamMundurSafety);
    });

    return () => { subscription.unsubscribe(); clearTimeout(hantamMundurSafety); };
  }, []);

  useEffect(() => {
    if (initializing || checkingSystem || !isNavReady || !session?.user?.id) return;

    let globalRadarChannel: any = null;
    let globalNotifChannel: any = null;
    let globalChatChannel: any = null;

    const setupTripleRadarSystem = async () => {
      const sellerId = await AsyncStorage.getItem('SELLER_ID');
      const driverUid = session.user.id;
      
      globalNotifChannel = supabase.channel(`global-notif-${driverUid}-${Date.now()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id_notif=eq.${driverUid}` }, 
          async (payload) => {
            await Notifications.scheduleNotificationAsync({
              content: { title: payload.new.judul_notif || "PAMILO Update", body: payload.new.isi_notif || "Anda memiliki notifikasi baru.", sound: 'default', priority: Notifications.AndroidNotificationPriority.MAX, channelId: 'pamilo-urgent' }, trigger: null,
            });
            Vibration.vibrate([0, 250, 250, 250], false);
          }
        ).subscribe();

      globalChatChannel = supabase.channel(`global-chat-notif-${driverUid}-${Date.now()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload) => {
          if (payload.new.sender_id !== driverUid) {
            const orderId = payload.new.order_id;
            const { data: orderMigo } = await supabase.from('migo_orders').select('pembeli_id, driver_id').eq('id', orderId).maybeSingle();
            const { data: orderPasar } = await supabase.from('orders').select('pembeli_id, kurir_id, penjual_id').eq('id', orderId).maybeSingle();
            
            const isUserTerkait = 
              (orderMigo && (orderMigo.pembeli_id === driverUid || orderMigo.driver_id === driverUid)) ||
              (orderPasar && (orderPasar.pembeli_id === driverUid || orderPasar.kurir_id === driverUid || orderPasar.penjual_id === sellerId));

            if (isUserTerkait) {
              Notifications.scheduleNotificationAsync({
                content: { title: "💬 PESAN BARU MASUK!", body: payload.new.message, data: { orderId: orderId, tipe: "CHAT_MESSAGE" }, priority: Notifications.AndroidNotificationPriority.MAX, channelId: 'pamilo-urgent' }, trigger: null,
              });
              Vibration.vibrate([0, 150, 100, 150], false);
            }
          }
        }).subscribe();

      // 🔥 FIX RADAR UTAMA: DETEKSI JASA & DRIVER MENGGUNAKAN 1 LISTENER ORDERS
      globalRadarChannel = supabase.channel(`global-radar-system-${driverUid}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const orderNew = payload.new;
            const statusOrder = orderNew.status_order;
            const layananTipe = String(orderNew.layanan || '').toUpperCase().trim();
            const realIdPenjual = orderNew.penjual_id; 

            // 1. CEK JASA / SERVIS
          const isLayananJasa = (layananTipe === 'SERVIS' || layananTipe === 'JASA' || statusOrder === 'MENUNGGU_KONFIRMASI_MITRA');

          if (isLayananJasa) {
            if (sellerId && realIdPenjual === sellerId) {
              
              // 🔥 FIX LOOPING POPUP: Hanya munculkan ALARM jika status masih "Butuh Konfirmasi"
              if (statusOrder === 'PENDING' || statusOrder === 'MENUNGGU_KONFIRMASI_MITRA') {
                setGlobalSellerOrder(true); 
                putarSuaraMigoGlobal(); 
                Vibration.vibrate([0, 500, 200, 500], true);
                kirimKeSystemTray(
                  "ADA PERMINTAAN JASA BARU! 🛠️", 
                  "Segera konfirmasi di Toko Jasa Anda.", 
                  orderNew.id, 'orders', "ORDERAN_SELLER", "Jasa", orderNew.total_pembayaran
                );
              } else {
                // 🛑 JIKA SUDAH DITERIMA (DIPROSES) ATAU DITOLAK (DIBATALKAN): Matikan popup!
                matikanSuaraMigoGlobal();
                setGlobalSellerOrder(null);
              }
              
            }
            // 🔥 TEMBOK BETON: Stop di sini agar tidak bocor ke HP Driver
            return; 
          }
          
            // 🔥 LOGIKA UNTUK DRIVER (Hanya Barang Fisik / Mart / Food)
            if (['PENDING', 'MENCARI_KURIR'].includes(statusOrder)) {
              const localOnlineStatus = await AsyncStorage.getItem('DRIVER_ONLINE_STATUS');
              if (localOnlineStatus === 'true') {
                const orderPayload = { orderId: orderNew.id, table: 'orders', nama: orderNew.catatan?.replace('Daftar Belanja: ', '') || 'Antaran Belanja Fisik Warga', ongkir: orderNew.biaya_ongkir || 0 };
                setGlobalOrder(orderPayload); putarSuaraMigoGlobal(); Vibration.vibrate([0, 500, 200, 500], true);
                kirimKeSystemTray("ANTARAN KULINER/MART BARU MASUK!", `Segera ambil! Ongkir: Rp ${Number(orderPayload.ongkir).toLocaleString('id-ID')}`, orderNew.id, 'orders', "ORDERAN_BARU", orderPayload.nama, orderPayload.ongkir);
              }

              // Popup Toko juga harus bunyi kalau ada orderan makanan/mart
              if (sellerId && realIdPenjual === sellerId) {
                setGlobalSellerOrder(true); putarSuaraMigoGlobal(); Vibration.vibrate([0, 500, 200, 500], true);
              }
            }

            // 🔥 MATIKAN SUARA JIKA ORDER DIAMBIL/BATAL
            if (!['PENDING', 'MENCARI_KURIR', 'MENUNGGU_KONFIRMASI_MITRA'].includes(statusOrder)) {
              matikanSuaraMigoGlobal(); 
              setGlobalOrder((prev: any) => (prev && prev.orderId === orderNew.id ? null : prev));
              if (sellerId && realIdPenjual === sellerId) setGlobalSellerOrder(null);
            }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'migo_orders' }, async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const migoNew = payload.new;
            if (migoNew.status_order === 'MENCARI_DRIVER' && !migoNew.driver_id) {
              const isDelivery = migoNew.tipe_layanan === 'PAMILO_DELIVERY';
              const localOnlineStatus = await AsyncStorage.getItem('DRIVER_ONLINE_STATUS');
              if (localOnlineStatus === 'true') {
                const namaWarga = migoNew.nama_penumpang || migoNew.nama_pembeli || 'Warga PAMILO';
                const ongkir = migoNew.total_pembayaran || 0;
                setGlobalOrder({ orderId: migoNew.id, table: 'migo_orders', nama: namaWarga, ongkir: ongkir });
                putarSuaraMigoGlobal(); Vibration.vibrate([0, 500, 200, 500], true);
                if (isDelivery) kirimKeSystemTray("ADA ANTARAN KULINER/BARANG!", `Ongkir: Rp ${ongkir.toLocaleString('id-ID')}`, migoNew.id, 'migo_orders', "ORDERAN_BARU", namaWarga, ongkir);
                else kirimKeSystemTray("ADA ORDERAN MIGO RIDE MASUK!", `Tarif: Rp ${ongkir.toLocaleString('id-ID')}`, migoNew.id, 'migo_orders', "ORDERAN_BARU", namaWarga, ongkir);
              }
            }
            if (migoNew.status_order !== 'MENCARI_DRIVER') {
              matikanSuaraMigoGlobal(); 
              setGlobalOrder((prev: any) => (prev && prev.orderId === migoNew.id ? null : prev));
            }
          }
        });

      globalRadarChannel.subscribe();
    };

    setupTripleRadarSystem();

    return () => { 
      if (globalRadarChannel) supabase.removeChannel(globalRadarChannel); 
      if (globalNotifChannel) supabase.removeChannel(globalNotifChannel); 
      if (globalChatChannel) supabase.removeChannel(globalChatChannel); 
    };
  }, [session, initializing, checkingSystem]); 

  useEffect(() => {
    if (initializing || checkingSystem || !isNavReady) return;
    const rutePertama = segments[0];
    const inAuthGroup = rutePertama === 'login' || rutePertama === 'register' || rutePertama === '(auth)';
    if (!session) { if (!inAuthGroup) router.replace('/login'); } 
    else { if (inAuthGroup || segments.length === 0 || rutePertama === 'index' || rutePertama === '') router.replace('/(tabs)'); }
  }, [session, segments, initializing, checkingSystem, isNavReady]);

  useEffect(() => {
    if (!initializing && !checkingSystem) setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 300); 
  }, [initializing, checkingSystem]);

  return (
    <CartProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FDFCFB" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>

      <Modal transparent={true} animationType="slide" visible={!!globalOrder} onRequestClose={tanganiLewatiOrderanGlobal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.alertIconBg}><FontAwesome5 name="bell" size={22} color="#fff" /></View>
            <Text style={styles.modalTitleHeader}>🚨 RADAR PAMILO: ORDERAN MASUK!</Text>
            <View style={styles.alertData}>
              <Text style={styles.alertLabel}>👤 DETAIL ALUR / NOTA:</Text>
              <Text style={styles.alertVal} numberOfLines={2}>{globalOrder?.nama || 'Antaran Belanja Warga'}</Text>
              <View style={styles.alertPriceBox}>
                <Text style={styles.alertPriceLabel}>PENDAPATAN BERSIH DRIVER:</Text>
                <Text style={styles.alertPriceVal}>Rp {Number(globalOrder?.ongkir || 0).toLocaleString('id-ID')}</Text>
              </View>
            </View>
            <View style={styles.buttonActionRow}>
              <TouchableOpacity style={styles.btnActionLewati} onPress={tanganiLewatiOrderanGlobal}><Text style={styles.btnTextLewatiLabel}>LEWATI</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnActionTerima} onPress={tanganiTerimaOrderanGlobal}><Text style={styles.btnTextTerimaLabel}>TERIMA</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent={true} animationType="slide" visible={!!globalSellerOrder} onRequestClose={tanganiTutupAlertSeller}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderColor: '#2E7D32' }]}>
            <View style={[styles.alertIconBg, { backgroundColor: '#2E7D32' }]}><MaterialIcons name="storefront" size={26} color="#fff" /></View>
            <Text style={styles.modalTitleHeader}>📦 DAPUR MITRA: PESANAN MASUK!</Text>
            <View style={[styles.alertData, { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' }]}>
              <Text style={[styles.alertLabel, { textAlign: 'center', color: '#1B5E20', fontSize: 12, lineHeight: 18, fontWeight: '700' }]}>Segera buka dashboard untuk konfirmasi pesanan warga!</Text>
            </View>
            <View style={styles.buttonActionRow}>
              <TouchableOpacity style={styles.btnActionLewati} onPress={tanganiTutupAlertSeller}><Text style={styles.btnTextLewatiLabel}>TUTUP</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btnActionTerima, { backgroundColor: '#2E7D32' }]} onPress={tanganiBukaDapurSeller}><Text style={styles.btnTextTerimaLabel}>BUKA PESANAN</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </CartProvider>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFFFFF', width: '100%', borderRadius: 24, padding: 22, borderWidth: 2, borderColor: '#D35400', alignItems: 'center', elevation: 10 },
  alertIconBg: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#D35400', justifyContent: 'center', alignItems: 'center', marginBottom: 10, marginTop: -5 },
  modalTitleHeader: { fontSize: 16, fontWeight: '900', color: '#111', textAlign: 'center', marginBottom: 15 },
  alertData: { width: '100%', backgroundColor: '#FFF8F4', borderRadius: 16, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: '#FFCCBC' },
  alertLabel: { fontSize: 9, fontWeight: 'bold', color: '#A1887F', marginBottom: 4 },
  alertVal: { fontSize: 13, fontWeight: '800', color: '#4A3525', marginBottom: 10, lineHeight: 18 },
  alertPriceBox: { marginTop: 10, alignItems: 'center', borderTopWidth: 1, borderColor: '#FFCCBC', paddingTop: 10 },
  alertPriceLabel: { fontSize: 9, fontWeight: 'bold', color: '#A1887F' },
  alertPriceVal: { fontSize: 22, fontWeight: '900', color: '#2E7D32' },
  buttonActionRow: { flexDirection: 'row', width: '100%', gap: 10 },
  btnActionLewati: { flex: 1, backgroundColor: '#F5F5F5', height: 48, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  btnTextLewatiLabel: { color: '#616161', fontWeight: 'bold', fontSize: 14 },
  btnActionTerima: { flex: 2, backgroundColor: '#D35400', height: 48, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  btnTextTerimaLabel: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 }
});