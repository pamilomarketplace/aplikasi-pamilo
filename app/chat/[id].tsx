// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform,
  StatusBar
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// LIVE RADAR MAPS COMPONENTS
import MapView, { Marker } from 'react-native-maps';

// BACKEND: KONEKTOR UTAMA SUPABASE CLOUD
import { supabase } from '@/supabaseConfig';

interface Pesan {
  id: number;
  order_id: string;
  sender_id: string;
  receiver_id: string;
  text_message: string;
  created_at: string;
}

const TEMPLATE_CHAT_KILAT = [
  "Halo, pesanan sudah sesuai titik ya?",
  "Mohon ditunggu ya, sedang diproses.",
  "Saya sudah sampai di lokasi pengantaran.",
  "Siap, terima kasih!"
];

export default function RuangChatRealtimeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // 🟢 AMBIL PARAMETER 
  const { id, receiver_id: initialReceiverId, draftPesan } = useLocalSearchParams<{ id: string, receiver_id: string, draftPesan?: string }>(); 
  
  const scrollViewRef = useRef<ScrollView>(null);
  const mapRef = useRef<MapView>(null);
  
  const [messages, setMessages] = useState<Pesan[]>([]);
  const [inputTeks, setInputTeks] = useState('');
  const [loading, setLoading] = useState(true);
  const [myUid, setMyUid] = useState<string | null>(null);

  const [activeReceiverId, setActiveReceiverId] = useState<string | null>(initialReceiverId || null);
  const [statusOrderan, setStatusOrderan] = useState('Memuat status...');
  const [isOrderChat, setIsOrderChat] = useState(true); 
  
  const [koordinatPembeli, setKoordinatPembeli] = useState({ latitude: -7.3274, longitude: 108.3543 });
  const [koordinatDriverMigo, setKoordinatDriverMigo] = useState<any | null>(null);

  // --- 🟢 TAHAP 1: AMBIL RIWAYAT DATA & SETUP RADAR MAPS
  useEffect(() => {
    let namaTabelAktif = 'orders'; 
    let channelChatStream: any;
    let channelOrderStatus: any;
    let channelDriverRadar: any;

    const muatAwalSasisHalamanDinamis = async () => {
      let orderData = null; 
      
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return router.back();
        
        const currentUid = session.user.id;
        setMyUid(currentUid);

        if (draftPesan) setInputTeks(draftPesan);

        const { data: resOrders } = await supabase
          .from('orders')
          .select('status_order, latitude_tujuan, longitude_tujuan, latitude, longitude, driver_id, kurir_id, user_id, pembeli_id, user_id_pembeli')
          .eq('id', id)
          .maybeSingle();

        orderData = resOrders;

        if (!orderData) {
          const { data: migoData } = await supabase
            .from('migo_orders')
            .select('status_order, latitude_jemput, longitude_jemput, latitude_tujuan, longitude_tujuan, driver_id, pembeli_id')
            .eq('id', id)
            .maybeSingle();

          if (migoData) {
            orderData = migoData;
            namaTabelAktif = 'migo_orders'; 
          }
        }

        if (orderData) {
          setIsOrderChat(true);
          setStatusOrderan(orderData.status_order || 'Pending');
          
          if (namaTabelAktif === 'migo_orders') {
            const targetPenerima = currentUid === orderData.pembeli_id ? orderData.driver_id : orderData.pembeli_id;
            if (targetPenerima) setActiveReceiverId(targetPenerima);
          } else {
            const idPembeliSah = orderData.pembeli_id || orderData.user_id_pembeli || orderData.user_id;
            const targetPenerima = currentUid === idPembeliSah ? (orderData.driver_id || orderData.kurir_id) : idPembeliSah;
            if (targetPenerima) setActiveReceiverId(targetPenerima);
          }

          let latRumah, lngRumah;
          if (namaTabelAktif === 'migo_orders') {
            latRumah = parseFloat(orderData.latitude_jemput || orderData.latitude_tujuan || -7.3262);
            lngRumah = parseFloat(orderData.longitude_jemput || orderData.longitude_tujuan || 108.3532);
          } else {
            latRumah = parseFloat(orderData.latitude_tujuan || orderData.latitude || -7.3274);
            lngRumah = parseFloat(orderData.longitude_tujuan || orderData.longitude || 108.3543);
          }
          setKoordinatPembeli({ latitude: latRumah, longitude: lngRumah });

          const targetDriverId = orderData.driver_id || orderData.kurir_id;
          if (targetDriverId) {
            const { data: locData } = await supabase
              .from('driver_locations')
              .select('lat_sekarang, lng_sekarang')
              .eq('driver_id', targetDriverId)
              .maybeSingle();

            if (locData?.lat_sekarang) {
              setKoordinatDriverMigo({
                latitude: parseFloat(locData.lat_sekarang),
                longitude: parseFloat(locData.lng_sekarang)
              });
            }
          }
        } else {
          setIsOrderChat(false);
          setActiveReceiverId(id); 
          setStatusOrderan('VERIFIKASI SALDO');
        }

        const { data: chatData, error: chatErr } = await supabase
          .from('messages')
          .select('*')
          .eq('order_id', id)
          .order('created_at', { ascending: true });

        if (!chatErr && chatData) setMessages(chatData as Pesan[]);
      } catch (e) {
        console.log("Sirkuit riwayat split-screen terhambat:", e);
      } finally {
        setLoading(false);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
          if (orderData && mapRef.current) {
            mapRef.current.animateToRegion({ 
              latitude: koordinatPembeli.latitude, 
              longitude: koordinatPembeli.longitude, 
              latitudeDelta: 0.015, 
              longitudeDelta: 0.015 
            }, 800);
          }
        }, 300);
      }
    };

    muatAwalSasisHalamanDinamis();

    // 🎯 FIX UTAMA CRASH: Murni deklarasi sekali jalan
    // Susun .on DULU, baru .subscribe di akhir.
    channelChatStream = supabase.channel(`room-chat-${id}`);
    channelChatStream
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `order_id=eq.${id}` }, (payload) => {
        const pesanBaru = payload.new as Pesan;
        setMessages(prev => {
          if (prev.some(m => m.id === pesanBaru.id)) return prev;
          return [...prev, pesanBaru];
        });
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);
      })
      .subscribe();

    if (isOrderChat) {
      channelOrderStatus = supabase.channel(`room-status-${id}`);
      channelOrderStatus
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: namaTabelAktif, filter: `id=eq.${id}` }, (payload) => {
          if (payload.new?.status_order) setStatusOrderan(payload.new.status_order);
        })
        .subscribe();

      channelDriverRadar = supabase.channel(`room-radar-${id}`);
      channelDriverRadar
        .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, (payload) => {
          if (payload.new?.driver_id && payload.new?.lat_sekarang) {
            setKoordinatDriverMigo({
              latitude: parseFloat(payload.new.lat_sekarang),
              longitude: parseFloat(payload.new.lng_sekarang)
            });
          }
        })
        .subscribe();
    }

    return () => {
      // 🎯 CLEANUP KETAT: Memastikan channel dilepas saat halaman ini ditutup
      if (channelChatStream) supabase.removeChannel(channelChatStream);
      if (channelOrderStatus) supabase.removeChannel(channelOrderStatus);
      if (channelDriverRadar) supabase.removeChannel(channelDriverRadar);
    };
  }, [id]); 

  // --- 🚀 TAHAP 3: EKSEKUSI PENEMBAKAN PESAN KELUAR ---
  const handleKirimPesanPamilo = async (teksKirim: string) => {
    const kalimatBersih = teksKirim.trim();
    if (!kalimatBersih || !myUid || !activeReceiverId) return;

    setInputTeks(''); 

    try {
      const { error } = await supabase
        .from('messages')
        .insert([
          {
            order_id: id,
            sender_id: myUid,
            receiver_id: activeReceiverId, 
            text_message: kalimatBersih
          }
        ]);

      if (error) throw error;
    } catch (err) {
      console.log("Gagal menyiarkan pesan ke cloud:", err);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} style={styles.container}>
      <Stack.Screen options={{ title: isOrderChat ? `Sasis Pelacakan #${id.substring(0, 5).toUpperCase()}` : 'Hub Chat Admin PAMILO', headerStyle: { backgroundColor: '#4A3525' }, headerTintColor: '#fff', headerTitleStyle: { fontSize: 13, fontWeight: 'bold' } }} />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#4A3525" />
          <Text style={styles.loadingText}>Membuka sasis radar serbaguna...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          
          {/* 🗺️ SCREEN PANEL 1: RADAR MAPS */}
          {isOrderChat && (
            <View style={styles.mapsRadarPanel}>
              <MapView 
                ref={mapRef}
                style={styles.mapStyle}
                initialRegion={{ ...koordinatPembeli, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
                showsUserLocation={false}
              >
                <Marker coordinate={koordinatPembeli} title="Lokasi Tujuan" pinColor="#D35400" />
                {koordinatDriverMigo && (
                  <Marker coordinate={koordinatDriverMigo} title="Kurir MIGO">
                    <View style={styles.driverMarkerIcon}><FontAwesome5 name="motorcycle" size={9} color="#fff" /></View>
                  </Marker>
                )}
              </MapView>
              
              <View style={styles.statusOverlayBadge}>
                <FontAwesome5 name="satellite-dish" size={10} color="#D35400" style={{marginRight: 6}} />
                <Text style={styles.statusOverlayText}>
                  STATUS: <Text style={{fontWeight: '900'}}>{statusOrderan === 'MENCARI_DRIVER' || statusOrderan === 'MENCARI_KURIR' ? 'MENCARI DRIVER MIGO...' : statusOrderan.replace('_', ' ').toUpperCase()}</Text>
                </Text>
              </View>
            </View>
          )}

          {/* 💬 SCREEN PANEL 2: KAMAR CHAT REALTIME */}
          <View style={[styles.chatSectionPanel, !isOrderChat && { flex: 1 }]}>
            <ScrollView 
              ref={scrollViewRef}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.map((msg) => {
                const apakahSayaPengirim = msg.sender_id === myUid;
                return (
                  <View key={msg.id} style={[styles.bubbleWrapper, apakahSayaPengirim ? styles.wrapperKanan : styles.wrapperKiri]}>
                    <View style={[styles.bubbleBox, apakahSayaPengirim ? styles.boxKanan : styles.boxKiri]}>
                      <Text style={[styles.textMessage, apakahSayaPengirim ? styles.textPutih : styles.textCokelat]}>
                        {msg.text_message}
                      </Text>
                      <Text style={[styles.textJam, apakahSayaPengirim ? styles.jamPutih : styles.jamCokelat]}>
                        {new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Template Chat Kilat */}
            {isOrderChat && (
              <View style={styles.quickChatContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
                  {TEMPLATE_CHAT_KILAT.map((template, index) => (
                    <TouchableOpacity key={index} style={styles.btnTemplate} onPress={() => handleKirimPesanPamilo(template)} disabled={!activeReceiverId}>
                      <Text style={[styles.txtTemplate, !activeReceiverId && {color: '#BCAAA4'}]}>{template}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={[styles.inputActionBar, { paddingBottom: insets.bottom || 12 }]}>
              <TextInput
                style={styles.textInputUtama}
                placeholder={activeReceiverId ? "Ketik pesan konfirmasi di sini..." : "Menunggu jaringan terhubung..."}
                placeholderTextColor="#A1887F"
                value={inputTeks}
                onChangeText={setInputTeks}
                multiline
                editable={!!activeReceiverId}
              />
              <TouchableOpacity 
                style={[styles.btnSend, (!inputTeks.trim() || !activeReceiverId) && {backgroundColor: '#BCAAA4', elevation: 0}]} 
                onPress={() => handleKirimPesanPamilo(inputTeks)}
                disabled={!inputTeks.trim() || !activeReceiverId}
              >
                <Ionicons name="send" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFCFB' },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDFCFB' },
  loadingText: { marginTop: 10, fontSize: 12, color: '#8D6E63', fontWeight: '500' },
  mapsRadarPanel: { flex: 0.45, width: '100%', position: 'relative', borderBottomWidth: 1, borderColor: '#EFEBE9' },
  mapStyle: { ...StyleSheet.absoluteFillObject },
  driverMarkerIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#2E7D32', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff', elevation: 3 },
  statusOverlayBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(255,255,255,0.92)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#FFCCBC', elevation: 2 },
  statusOverlayText: { fontSize: 9, fontWeight: 'bold', color: '#4A3525', letterSpacing: 0.5 },
  chatSectionPanel: { flex: 0.55, backgroundColor: '#FDFCFB' },
  scrollContent: { padding: 16, paddingBottom: 10 },
  bubbleWrapper: { flexDirection: 'row', width: '100%', marginBottom: 12 },
  wrapperKanan: { justifyContent: 'flex-end' },
  wrapperKiri: { justifyContent: 'flex-start' },
  bubbleBox: { maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  boxKanan: { backgroundColor: '#4A3525', borderBottomRightRadius: 4 },
  boxKiri: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EFEBE9', borderBottomLeftRadius: 4 },
  textMessage: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  textPutih: { color: '#FFF' },
  textCokelat: { color: '#4A3525' },
  textJam: { fontSize: 8, marginTop: 4, textAlign: 'right', fontWeight: 'bold' },
  jamPutih: { color: 'rgba(255,255,255,0.6)' },
  jamCokelat: { color: '#BCAAA4' },
  quickChatContainer: { backgroundColor: '#FDFCFB', paddingVertical: 8, borderTopWidth: 1, borderColor: '#F5F5F5' },
  btnTemplate: { backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#EFEBE9' },
  txtTemplate: { fontSize: 11, color: '#8D6E63', fontWeight: '600' },
  inputActionBar: { flexDirection: 'row', backgroundColor: '#FFF', padding: 10, alignItems: 'center', borderTopWidth: 1, borderColor: '#EFEBE9', gap: 10 },
  textInputUtama: { flex: 1, backgroundColor: '#FDFCFB', borderWidth: 1, borderColor: '#EFEBE9', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, maxHeight: 60, color: '#4A3525', fontSize: 13 },
  btnSend: { backgroundColor: '#4A3525', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', elevation: 2 }
});