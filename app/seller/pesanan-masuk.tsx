// @ts-nocheck
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  StyleSheet, Text, View, FlatList, TouchableOpacity, 
  StatusBar, ActivityIndicator, RefreshControl, Vibration, Platform, Dimensions, Modal
} from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '../../supabaseConfig';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';

if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const { width } = Dimensions.get('window');

interface OrderMitra {
  id_item: number;
  id_order_induk: string;
  id_nota: string;
  id_produk_order: string;
  nama_pembeli: string;
  no_hp_pembeli: string;
  alamat_kirim: string;
  nama_produk: string;
  kategori_produk: string; 
  kuantitas: number;
  total_harga_item: number;
  total_pembayaran_induk: number; 
  jarak_km_induk: number; 
  status_item: string;
  pembeli_id: string; 
  penjual_id: string; 
  kurir_id: string;   
  metode_pembayaran_induk: string; 
  biaya_ongkir_induk: number;
  biaya_penanganan_induk: number;
  potongan_diskon_induk: number;
  status_order_induk: string;
  created_at: string;
  pilar_kategori: 'FOOD' | 'MART' | 'SERVIS'; 
}

export default function PesananMasukSellerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<OrderMitra[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAction, setLoadingAction] = useState<number | null>(null);

  // 🟢 STATE CUSTOM MODAL ALERT
  const [infoModal, setInfoModal] = useState({ visible: false, title: '', message: '', type: 'warning', action: null as any }); 
  const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', message: '', onConfirm: null as any });

  const soundRef = useRef<Audio.Sound | null>(null);
  const idMerchantRef = useRef<string | null>(null);

  const showCustomAlert = (title: string, message: string, type: 'warning' | 'error' | 'success' = 'warning', action = null) => {
    setInfoModal({ visible: true, title, message, type, action });
  };

  const showConfirmAlert = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({ visible: true, title, message, onConfirm });
  };

  const pemicuAlarmDapurOrderanMigo = async (statusAwalItem: string, isJasaForce: boolean = false) => {
    try {
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);
      const statusBersih = String(statusAwalItem).toUpperCase().trim();
      const isLayananJasa = isJasaForce || statusBersih === 'MENUNGGU_KONFIRMASI_MITRA';

      if (Notifications && typeof Notifications.scheduleNotificationAsync === 'function') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: isLayananJasa ? "🚨 PANGGILAN JASA BARU MASUK!" : "📦 PESANAN BARU MASUK DI DAPUR!",
            body: isLayananJasa 
              ? "Permintaan layanan jasa panggilan membutuhkan konfirmasi Anda sekarang." 
              : "Segera siapkan pesanan pembeli sebelum kurir MIGO datang.",
            sound: 'migo.mp3', 
          },
          trigger: null, 
        });
      }

      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => null); 
      }

      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/migo.mp3'),
        { shouldPlay: true, volume: 1.0, isLooping: false }
      );
      soundRef.current = sound;
    } catch (soundError) {
      console.log("Pipa pemutaran audio terhambat:", soundError.message);
    }
  };

  const fetchPesananMasukRiil = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: merchantRow } = await supabase.from('toko').select('id_toko').eq('user_id_toko', session.user.id).maybeSingle();
      if (!merchantRow) { setOrders([]); return; }
      idMerchantRef.current = merchantRow.id_toko;

      // 🔥 UPDATE: Menyedot biaya_ongkir, biaya_penanganan, potongan_diskon dari database
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          id, kuantitas, harga_satuan, status_item, penjual_id, order_id, id_produk_order,
          produk!fk_order_items_produk ( nama_produk, kategori_label_produk, kategori_produk ),
          orders ( 
            id, pembeli_id, kurir_id, status_order, alamat_pengiriman, created_at, 
            total_pembayaran, jarak_km, metode_pembayaran, layanan,
            biaya_ongkir, biaya_penanganan, potongan_diskon,
            users!pembeli_id ( user_name, user_phone ) 
          )
        `) 
        .eq('penjual_id', merchantRow.id_toko) 
        .order('id', { ascending: false });

      if (error) throw error;

      if (data) {
        const formatOrders: OrderMitra[] = data.map((item: any) => {
          const kategoriDariDb = String(item.produk?.kategori_label_produk || item.produk?.kategori_produk || 'UMUM').toUpperCase();
          const layananInduk = String(item.orders?.layanan || '').toUpperCase();
          
          let pilar = 'MART';
          if (layananInduk === 'SERVIS' || layananInduk === 'JASA' || kategoriDariDb.includes('SERVIS') || kategoriDariDb.includes('JASA')) pilar = 'SERVIS';
          else if (kategoriDariDb.includes('FOOD') || kategoriDariDb.includes('MAKANAN')) pilar = 'FOOD';

          return {
            id_item: item.id,
            id_order_induk: item.orders?.id || '',
            id_nota: item.orders?.id ? item.orders.id.substring(0, 8).toUpperCase() : 'N/A',
            id_produk_order: item.id_produk_order,
            nama_pembeli: item.orders?.users?.user_name || 'Warga PAMILO',
            no_hp_pembeli: item.orders?.users?.user_phone || '-',
            alamat_kirim: item.orders?.alamat_pengiriman || 'Ambil di Tempat',
            nama_produk: item.produk?.nama_produk || 'Layanan',
            kategori_produk: kategoriDariDb, 
            kuantitas: Number(item.kuantitas || 1),
            total_harga_item: Number(item.harga_satuan || 0) * Number(item.kuantitas || 0),
            total_pembayaran_induk: item.orders?.total_pembayaran || 0, 
            metode_pembayaran_induk: item.orders?.metode_pembayaran || 'TUNAI',
            biaya_ongkir_induk: item.orders?.biaya_ongkir || 0,
            biaya_penanganan_induk: item.orders?.biaya_penanganan || 0,
            potongan_diskon_induk: item.orders?.potongan_diskon || 0,
            jarak_km_induk: item.orders?.jarak_km || 0, 
            status_item: item.status_item || 'PENDING',
            pembeli_id: item.orders?.pembeli_id || '', 
            penjual_id: item.penjual_id || '',
            kurir_id: item.orders?.kurir_id || '', 
            status_order_induk: item.orders?.status_order || 'PENDING',
            created_at: item.orders?.created_at ? new Date(item.orders.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB' : '--:-- WIB',
            pilar_kategori: pilar as any
          };
        }).filter((order) => {
          const itemStatus = String(order.status_item).toUpperCase().trim();
          const indukStatus = String(order.status_order_induk).toUpperCase().trim();
          
          if (indukStatus === 'DIBATALKAN' || itemStatus === 'DIBATALKAN') return false;

          const statusLegal = ['PENDING', 'MENUNGGU_KONFIRMASI_MITRA', 'DIPROSES', 'SIAP_DIJEMPUT', 'MENCARI_KURIR', 'DIKIRIM'];
          return statusLegal.includes(itemStatus) && statusLegal.includes(indukStatus);
        });

        setOrders(formatOrders);
      }
    } catch (error: any) {
      console.log("Gagal parsing sasis dapur:", error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchPesananMasukRiil(); }, []));

  useEffect(() => {
    const konfigurasiSasisDanRadarDapur = async () => {
      try {
        await fetchPesananMasukRiil();

        if (Platform.OS === 'android' && Notifications && typeof Notifications.setNotificationChannelAsync === 'function') {
          await Notifications.setNotificationChannelAsync('default', { name: 'Orderan Masuk PAMILO', importance: 5, vibrationPattern: [0, 250, 250, 250], sound: 'migo.mp3', bypassDnd: true, lockscreenVisibility: 1 });
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data: merchantRow } = await supabase.from('toko').select('id_toko').eq('user_id_toko', session.user.id).maybeSingle();
        if (!merchantRow) return;

        const channelPesananDapur = supabase
          .channel(`kamar-dapur-stream-${merchantRow.id_toko}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, async (payload) => {
            if (payload.eventType === 'INSERT' && payload.new?.penjual_id === merchantRow.id_toko) {
              const sItemBaru = String(payload.new?.status_item).toUpperCase();
              const trigJasa = sItemBaru === 'MENUNGGU_KONFIRMASI_MITRA';
              await pemicuAlarmDapurOrderanMigo(sItemBaru, trigJasa);
            }
            fetchPesananMasukRiil();
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
            if (payload.new.status_order === 'DIBATALKAN') {
               Vibration.vibrate([0, 300, 100, 300]);
               fetchPesananMasukRiil(); 
            } else {
               fetchPesananMasukRiil();
            }
          });

        await channelPesananDapur.subscribe();

      } catch (e) { } finally { setLoading(false); }
    };

    konfigurasiSasisDanRadarDapur();
    return () => { if (soundRef.current) soundRef.current.unloadAsync().catch(() => null); };
  }, []);

  const handleTerimaPesananFisikBarang = async (order: OrderMitra) => {
    try {
      setLoadingAction(order.id_item);

      const { data: liveProduct, error: prodErr } = await supabase.from('produk').select('stok_ready_produk, nama_produk').eq('id_produk', order.id_produk_order).maybeSingle();
      if (prodErr || !liveProduct) throw new Error("Gagal memverifikasi komoditas barang.");

      const sisaStokAktual = Number(liveProduct.stok_ready_produk || 0);

      if (sisaStokAktual < order.kuantitas) {
        setLoadingAction(null);
        return showCustomAlert("Gagal Menerima Pesanan! 🔒", `Stok produk "${liveProduct.nama_produk}" tersisa ${sisaStokAktual} item. Kuantitas pesanan melampaui stok Anda.`, "error");
      }

      const { error: updateProdError } = await supabase.from('produk').update({ stok_ready_produk: sisaStokAktual - order.kuantitas }).eq('id_produk', order.id_produk_order);
      if (updateProdError) throw updateProdError;

      const { error: itemError } = await supabase.from('order_items').update({ status_item: 'DIPROSES' }).eq('id', order.id_item);
      if (itemError) throw itemError;

      await fetchPesananMasukRiil();
      showCustomAlert("Sukses Masuk Dapur! 🎉", `Stok berhasil dipotong. Segera siapkan pesanan untuk warga.`, "success");
    } catch (e: any) { showCustomAlert("Sirkuit Macet", e.message, "error"); } finally { setLoadingAction(null); }
  };

  const handleTolakPesanan = (order: OrderMitra) => {
    showConfirmAlert(
      "Tolak Pesanan Warga? ❌", 
      `Apakah Anda yakin ingin menolak pesanan ini? Jika pembayarannya Non-Tunai, uang pembeli akan dikembalikan otomatis ke dompet mereka.`, 
      async () => {
        try {
          setLoadingAction(order.id_item);

          await supabase.from('order_items').update({ status_item: 'DIBATALKAN' }).eq('id', order.id_item); 
          await supabase.from('orders').update({ status_order: 'DIBATALKAN' }).eq('id', order.id_order_induk);

          if (order.status_item === 'DIPROSES') {
            const { data: produkSkrg } = await supabase.from('produk').select('stok_ready_produk').eq('id_produk', order.id_produk_order).single();
            if (produkSkrg) {
              await supabase.from('produk').update({ stok_ready_produk: Number(produkSkrg.stok_ready_produk) + order.kuantitas }).eq('id_produk', order.id_produk_order);
            }
          }

          const metodeClean = String(order.metode_pembayaran_induk).toUpperCase().trim();
          if (metodeClean === 'SALDO' || metodeClean === 'PAMILO_PAY' || metodeClean === 'NONTUNAI') {
            const { data: userSaldo } = await supabase.from('users').select('saldo').eq('user_id', order.pembeli_id).maybeSingle();
            const saldoSisa = userSaldo ? userSaldo.saldo : 0;
            
            await supabase.from('users').update({ saldo: Number(saldoSisa) + Number(order.total_pembayaran_induk) }).eq('user_id', order.pembeli_id);
            
            await supabase.from('transaksi_saldo').insert([{
              user_id: order.pembeli_id,
              tipe_transaksi: 'REFUND',
              jumlah: order.total_pembayaran_induk,
              status_transaksi: 'BERHASIL',
              catatan_admin: `Refund otomatis pesanan ditolak Toko #${order.id_nota}`
            }]);
          }

          await fetchPesananMasukRiil();
          showCustomAlert("Berhasil Ditolak", "Pesanan telah dibatalkan dan warga telah diberitahu.", "success");
        } catch (e: any) { showCustomAlert("Gagal Ditolak", e.message, "error"); } finally { setLoadingAction(null); }
      }
    );
  };

  const handlePesananSiap = (idItem: number, orderData: OrderMitra) => {
    showConfirmAlert(
      "Panggil Kurir MIGO? 📦", 
      `Apakah pesanan sudah dibungkus rapi? Kami akan memberitahu Kurir untuk segera datang mengambil orderan ini ke lapak Anda.`, 
      async () => {
        try {
          setLoadingAction(idItem);
          
          await supabase.from('order_items').update({ status_item: 'SIAP_DIJEMPUT' }).eq('id', idItem); 

          if (orderData.kurir_id) {
            await supabase.from('messages').insert([{ 
              order_id: orderData.id_order_induk,
              sender_id: orderData.penjual_id,
              receiver_id: orderData.kurir_id,
              text_message: "📦 PESANAN SUDAH SIAP! Silakan langsung ambil pesanan di lapak. Terima kasih!"
            }]);
          }

          await fetchPesananMasukRiil();
          showCustomAlert("Kurir Dipanggil!", "Notifikasi otomatis telah dikirim langsung ke radar Kurir yang bertugas.", "success");
        } catch (e: any) { showCustomAlert("Gagal Memanggil Kurir", e.message, "error"); } 
        finally { setLoadingAction(null); }
      }
    );
  };

  const updateStatusItemJasaAtauUmum = async (idItem: number, statusBaru: string, pesan: string) => {
    try {
      setLoadingAction(idItem);
      const { error } = await supabase.from('order_items').update({ status_item: statusBaru }).eq('id', idItem); 
      if (error) throw error;
      
      if (statusBaru === 'DIPROSES') {
         await supabase.from('orders').update({ status_order: 'DIPROSES' }).eq('id', orders.find(o => o.id_item === idItem)?.id_order_induk);
      } else if (statusBaru === 'DIKIRIM') {
         await supabase.from('orders').update({ status_order: 'DIKIRIM' }).eq('id', orders.find(o => o.id_item === idItem)?.id_order_induk);
      }

      await fetchPesananMasukRiil();
      showCustomAlert("Status Diperbarui", pesan, "success");
    } catch (e: any) { showCustomAlert("Gagal", e.message, "error"); } finally { setLoadingAction(null); }
  };

  const handleSelesaikanJasa = (order: OrderMitra) => {
    showConfirmAlert(
      "Pekerjaan Selesai? ✅",
      "Apakah Anda yakin telah menuntaskan tugas servis ini di lokasi pembeli? Saldo Anda akan otomatis bertambah (jika pembayaran Non-Tunai) setelah ini.",
      async () => {
        try {
          setLoadingAction(order.id_item);

          const tarif = Number(order.total_pembayaran_induk || 0);
          const metodeClean = String(order.metode_pembayaran_induk || 'TUNAI').toUpperCase().trim();
          const komisiAplikasi = (tarif * 10) / 100;

          if (metodeClean === 'SALDO' || metodeClean === 'PAMILO_PAY' || metodeClean === 'NONTUNAI') {
            const { data: dataPembeli, error: errPembeli } = await supabase.from('users').select('saldo').eq('user_id', order.pembeli_id).single();
            if (errPembeli) throw new Error("Gagal mengecek saldo pembeli.");
            
            const saldoPembeliSisa = Number(dataPembeli?.saldo || 0) - tarif;
            if (saldoPembeliSisa < 0) throw new Error("Saldo pembeli tidak mencukupi untuk menyelesaikan transaksi ini.");
            
            await supabase.from('users').update({ saldo: saldoPembeliSisa }).eq('user_id', order.pembeli_id);

            const { data: dataPenjual } = await supabase.from('users').select('saldo').eq('user_id', order.penjual_id).single();
            await supabase.from('users').update({ saldo: Number(dataPenjual?.saldo || 0) + (tarif - komisiAplikasi) }).eq('user_id', order.penjual_id);

          } else {
            const { data: dataPenjual } = await supabase.from('users').select('saldo').eq('user_id', order.penjual_id).single();
            await supabase.from('users').update({ saldo: Number(dataPenjual?.saldo || 0) - komisiAplikasi }).eq('user_id', order.penjual_id);
          }

          await supabase.from('order_items').update({ status_item: 'SELESAI' }).eq('id', order.id_item); 
          await supabase.from('orders').update({ status_order: 'SELESAI' }).eq('id', order.id_order_induk);
          
          await fetchPesananMasukRiil();
          showCustomAlert("Pekerjaan Tuntas! 🎉", "Dana jasa beserta potongan komisi telah disesuaikan dengan dompet Anda.", "success");
        } catch (e: any) { 
          showCustomAlert("Eror Transaksi", e.message, "error"); 
        } finally { 
          setLoadingAction(null); 
        }
      }
    );
  };

  const renderStatusBadge = (status: string, pilar: string) => {
    let bgColor = '#FFF3E0'; let textColor = '#D35400'; let label = status;
    const isJasa = pilar === 'SERVIS';

    if (status === 'PENDING' || status === 'MENUNGGU_KONFIRMASI_MITRA') { bgColor = '#F3E5F5'; textColor = '#6A1B9A'; label = 'PERLU KONFIRMASI'; }
    else if (status === 'DIPROSES') { bgColor = '#E3F2FD'; textColor = '#1565C0'; label = isJasa ? 'SEGERA BERANGKAT' : 'SEDANG DIMASAK/DIKEMAS'; }
    else if (status === 'SIAP_DIJEMPUT') { bgColor = '#E8F5E9'; textColor = '#2E7D32'; label = 'SIAP DIJEMPUT KURIR'; }
    else if (status === 'DIKIRIM') { bgColor = '#FFF8E1'; textColor = '#F57F17'; label = isJasa ? 'TEKNISI MENUJU LOKASI' : 'OTW LOKASI WARGA'; }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
        <Text style={[styles.statusText, { color: textColor }]}>{label}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, headerTitle: 'Dapur Pesanan Masuk', headerTintColor: '#fff', headerStyle: { backgroundColor: '#4A3525' }, headerTitleStyle: { fontWeight: 'bold', fontSize: 13 } }} />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      {loading && !refreshing ? (
        <View style={styles.centerLoading}><ActivityIndicator size="large" color="#4A3525" /></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id_item.toString()}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchPesananMasukRiil} colors={["#4A3525"]} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyComponentWrapper}>
              <MaterialCommunityIcons name="clipboard-text-off-outline" size={44} color="#D7CCC8" />
              <Text style={styles.emptyTextInfo}>Belum ada pesanan aktif mendarat di dapur Anda hari ini, Tuan.</Text>
            </View>
          )}
          renderItem={({ item: order }) => {
            const isJasa = order.pilar_kategori === 'SERVIS';
            const isFood = order.pilar_kategori === 'FOOD';
            const isSaldo = String(order.metode_pembayaran_induk).toUpperCase().includes('SALDO');

            return (
              <View style={styles.orderCard}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.notaIdText}>NOTA: #{order.id_nota}</Text>
                    <Text style={styles.timeText}>{order.created_at}</Text>
                  </View>
                  {renderStatusBadge(order.status_item, order.pilar_kategori)}
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.buyerInfoRow}>
                    <View style={styles.buyerTextCol}>
                      <Text style={styles.bodyBoldText}>{order.nama_pembeli} ({order.no_hp_pembeli})</Text>
                      <Text style={styles.bodyNormalText}>{order.alamat_kirim}</Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.productRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName}>{order.nama_produk}</Text>
                      <Text style={styles.productQty}>{isJasa ? 'Sesi/Jam' : 'Kuantitas Pesanan'}: {order.kuantitas}x</Text>
                      
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: isJasa ? '#6A1B9A' : (isFood ? '#E65100' : '#0277BD'), marginTop: 6, letterSpacing: 0.3 }}>
                        🏷️ KATEGORI: {isJasa ? 'PAMILO SERVIS' : (isFood ? 'PAMILO FOOD' : 'PAMILO MART')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.totalValueTitle}>{isJasa ? 'Harga Layanan' : 'Harga Barang'}</Text>
                      <Text style={styles.totalValue}>Rp {order.total_harga_item.toLocaleString('id-ID')}</Text>
                    </View>
                  </View>

                  {/* 🔥 INFO BILLING LENGKAP: METODE, ONGKIR, BIAYA ADMIN, TOTAL */}
                  <View style={styles.billingContainer}>
                    <View style={styles.billingRow}>
                      <Text style={styles.billingLabel}>Metode Pembayaran</Text>
                      <Text style={[styles.billingValue, { color: isSaldo ? '#2E7D32' : '#D35400' }]}>
                        {isSaldo ? '💳 SALDO (Pamilo-Pay)' : '💵 TUNAI / COD'}
                      </Text>
                    </View>
                    
                    <View style={styles.billingRow}>
                      <Text style={styles.billingLabel}>{isJasa ? 'Transport Teknisi' : 'Ongkos Kirim'}</Text>
                      <Text style={styles.billingValue}>Rp {order.biaya_ongkir_induk.toLocaleString('id-ID')}</Text>
                    </View>

                    {order.biaya_penanganan_induk > 0 && (
                      <View style={styles.billingRow}>
                        <Text style={styles.billingLabel}>Biaya Layanan Aplikasi</Text>
                        <Text style={styles.billingValue}>Rp {order.biaya_penanganan_induk.toLocaleString('id-ID')}</Text>
                      </View>
                    )}

                    {order.potongan_diskon_induk > 0 && (
                      <View style={styles.billingRow}>
                        <Text style={[styles.billingLabel, { color: '#00796B' }]}>Potongan Promo</Text>
                        <Text style={[styles.billingValue, { color: '#00796B' }]}>- Rp {order.potongan_diskon_induk.toLocaleString('id-ID')}</Text>
                      </View>
                    )}

                    <View style={styles.totalBillDivider} />
                    <View style={styles.billingRow}>
                      <Text style={styles.totalBillLabel}>TOTAL TAGIHAN WARGA</Text>
                      <Text style={styles.totalBillValue}>Rp {order.total_pembayaran_induk.toLocaleString('id-ID')}</Text>
                    </View>
                  </View>
                  {/* ============================================================== */}

                </View>
                
                <View style={styles.cardFooter}>
                  {loadingAction === order.id_item ? <ActivityIndicator color="#D35400" /> : (
                    <View style={styles.actionButtonRow}>
                      
                      {order.status_item !== 'SELESAI' && order.pembeli_id !== '' && (
                        <TouchableOpacity 
                          style={styles.btnChatSeller}
                          onPress={() => router.push({ pathname: `/chat/${order.id_order_induk}`, params: { receiver_id: order.pembeli_id }})}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="chatbubbles-outline" size={15} color="#4A3525" />
                        </TouchableOpacity>
                      )}

                      {!isJasa && order.status_item === 'PENDING' && (
                        <TouchableOpacity style={[styles.btnActionPrimary, { backgroundColor: '#2E7D32' }]} onPress={() => handleTerimaPesananFisikBarang(order)}>
                          <Text style={styles.btnText}>{isFood ? 'Terima & Masak 🥘' : 'Terima & Kemas 📦'}</Text>
                        </TouchableOpacity>
                      )}
                      
                      {!isJasa && order.status_item === 'DIPROSES' && (
                        <TouchableOpacity style={[styles.btnActionPrimary, { backgroundColor: '#D35400' }]} onPress={() => handlePesananSiap(order.id_item, order)}>
                          <Text style={styles.btnText}>Siap! Panggil Kurir 🛵</Text>
                        </TouchableOpacity>
                      )}

                      {isJasa && (order.status_item === 'PENDING' || order.status_item === 'MENUNGGU_KONFIRMASI_MITRA') && (
                        <TouchableOpacity style={[styles.btnActionPrimary, { backgroundColor: '#6A1B9A' }]} onPress={() => updateStatusItemJasaAtauUmum(order.id_item, 'DIPROSES', 'Tugas Servis berhasil Anda konfirmasi. Silakan persiapkan alat Anda!')}>
                          <Text style={styles.btnText}>Terima Pekerjaan 🛠️</Text>
                        </TouchableOpacity>
                      )}

                      {isJasa && order.status_item === 'DIPROSES' && (
                        <TouchableOpacity style={[styles.btnActionPrimary, { backgroundColor: '#1565C0' }]} onPress={() => updateStatusItemJasaAtauUmum(order.id_item, 'DIKIRIM', 'Status berubah! Silakan berangkat ke lokasi pelanggan.')}>
                          <Text style={styles.btnText}>OTW ke Lokasi Warga 🛵</Text>
                        </TouchableOpacity>
                      )}

                      {isJasa && order.status_item === 'DIKIRIM' && (
                        <TouchableOpacity style={[styles.btnActionPrimary, { backgroundColor: '#2E7D32' }]} onPress={() => handleSelesaikanJasa(order)}>
                          <Text style={styles.btnText}>Selesaikan Tugas ✅</Text>
                        </TouchableOpacity>
                      )}

                      {(order.status_item === 'PENDING' || order.status_item === 'MENUNGGU_KONFIRMASI_MITRA' || order.status_item === 'DIPROSES') && (
                        <TouchableOpacity style={[styles.btnActionPrimary, { backgroundColor: '#C62828', flex: 0.4 }]} onPress={() => handleTolakPesanan(order)}>
                          <Text style={styles.btnText}>Tolak ❌</Text>
                        </TouchableOpacity>
                      )}

                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* 🟢 CUSTOM MODAL ALERT INFO */}
      <Modal visible={infoModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.infoModalCard}>
            <View style={[styles.infoIconCircle, { backgroundColor: infoModal.type === 'error' ? '#C62828' : (infoModal.type === 'success' ? '#2E7D32' : '#D35400') }]}>
              <Ionicons name={infoModal.type === 'error' ? 'close-outline' : (infoModal.type === 'success' ? 'checkmark-outline' : 'warning-outline')} size={36} color="#fff" />
            </View>
            <Text style={styles.infoModalTitle}>{infoModal.title}</Text>
            <Text style={styles.infoModalMessage}>{infoModal.message}</Text>
            <TouchableOpacity 
              style={[styles.btnInfoClose, { backgroundColor: infoModal.type === 'error' ? '#C62828' : (infoModal.type === 'success' ? '#2E7D32' : '#D35400') }]} 
              onPress={() => {
                setInfoModal({ ...infoModal, visible: false });
                if (infoModal.action) infoModal.action();
              }}
            >
              <Text style={styles.btnInfoCloseText}>MENGERTI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 🟢 CUSTOM MODAL CONFIRMATION (YA/TIDAK) */}
      <Modal visible={confirmModal.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalCard}>
            <View style={styles.confirmIconCircle}>
              <FontAwesome5 name="question" size={28} color="#4A3525" />
            </View>
            <Text style={styles.infoModalTitle}>{confirmModal.title}</Text>
            <Text style={styles.infoModalMessage}>{confirmModal.message}</Text>
            <View style={styles.buttonActionRow}>
              <TouchableOpacity style={styles.btnActionLewati} onPress={() => setConfirmModal({ ...confirmModal, visible: false })}>
                <Text style={styles.btnTextLewatiLabel}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnActionTerimaConfirm} onPress={() => {
                 setConfirmModal({ ...confirmModal, visible: false });
                 if (confirmModal.onConfirm) confirmModal.onConfirm();
              }}>
                <Text style={styles.btnTextTerimaLabelConfirm}>Ya, Lanjutkan!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  listContent: { padding: 16 },
  orderCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#EFEBE9', marginBottom: 16, elevation: 0.5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#FAF8F5', borderBottomWidth: 1, borderBottomColor: '#EFEBE9', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  notaIdText: { fontSize: 12, fontWeight: '900', color: '#4A3525' },
  timeText: { fontSize: 10, color: '#BCAAA4', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },
  cardBody: { padding: 16 },
  buyerInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  buyerTextCol: { flex: 1 },
  bodyBoldText: { fontSize: 13, fontWeight: 'bold', color: '#1A0F05' },
  bodyNormalText: { fontSize: 12, color: '#8D6E63', marginTop: 2, lineHeight: 16 },
  divider: { height: 1, backgroundColor: '#FAF8F5', marginVertical: 12 },
  productRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  productName: { fontSize: 14, fontWeight: 'bold', color: '#4A3525', marginBottom: 4 },
  productQty: { fontSize: 11, color: '#8D6E63', fontWeight: '500' },
  totalValueTitle: { fontSize: 9, color: '#BCAAA4', marginBottom: 2, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.3 },
  totalValue: { fontSize: 14, fontWeight: '900', color: '#4A3525' },
  
  billingContainer: { backgroundColor: '#FFF8F4', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FFCCBC' },
  billingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' },
  billingLabel: { fontSize: 11, color: '#7D665E', fontWeight: '500' },
  billingValue: { fontSize: 11, fontWeight: 'bold', color: '#4A3525' },
  totalBillDivider: { height: 1, backgroundColor: '#FFCCBC', marginVertical: 6 },
  totalBillLabel: { fontSize: 11, fontWeight: '900', color: '#4A3525' },
  totalBillValue: { fontSize: 15, fontWeight: '900', color: '#D35400' },

  cardFooter: { padding: 14, paddingTop: 0 },
  actionButtonRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' },
  btnActionPrimary: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', height: 44, elevation: 1 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 11, letterSpacing: 0.3 },
  btnChatSeller: { flexDirection: 'row', borderWidth: 1, borderColor: '#E0D4CE', backgroundColor: '#fff', paddingHorizontal: 12, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', gap: 6 },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF8F5' },
  emptyComponentWrapper: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  emptyTextInfo: { marginTop: 12, fontSize: 12, color: '#A1887F', textAlign: 'center', lineHeight: 18, fontStyle: 'italic' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  infoModalCard: { width: width - 60, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center', elevation: 10 },
  infoIconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16, marginTop: -10, borderWidth: 4, borderColor: '#FFF', elevation: 2 },
  infoModalTitle: { fontSize: 16, fontWeight: '900', color: '#111', textAlign: 'center', marginBottom: 8 },
  infoModalMessage: { fontSize: 12, color: '#5D4037', textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  btnInfoClose: { width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center', elevation: 2 },
  btnInfoCloseText: { color: '#FFF', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },

  confirmModalCard: { width: width - 40, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center', elevation: 10 },
  confirmIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', marginBottom: 16, marginTop: -10 },
  buttonActionRow: { flexDirection: 'row', width: '100%', gap: 10 },
  btnActionLewati: { flex: 1, backgroundColor: '#F5F5F5', height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnTextLewatiLabel: { color: '#616161', fontWeight: 'bold', fontSize: 13 },
  btnActionTerimaConfirm: { flex: 1.5, backgroundColor: '#D35400', height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  btnTextTerimaLabelConfirm: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 }
});