// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  StatusBar, 
  Alert,
  ActivityIndicator
} from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/supabaseConfig';

interface CartItem {
  id: string; 
  produk_id: string;
  kuantitas: number;
  varian_terpilih?: string | null; // 🟢 TAMBAHAN SASIS VARIAN
  pilar_kategori: 'FOOD' | 'MART' | 'SERVIS'; 
  produk: { 
    nama_produk: string;
    harga_produk: number;
    foto_produk: string;
    stok_ready_produk: number;
    id_toko_produk: string;
    kategori_produk: string; 
    toko: { 
      nama_toko: string;
      status_toko: string;
    } | null;
  } | null;
}

interface GroupedCart {
  id_toko_produk: string;
  nama_toko: string;
  status_toko: string;
  items: CartItem[];
  pilar_utama: 'FOOD' | 'MART' | 'SERVIS'; 
}

export default function KeranjangBelanjaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const [selectedItems, setSelectedItems] = useState<string[]>([]); 
  const [activeTokoId, setActiveTokoId] = useState<string | null>(null); 

  const fetchKeranjangRiil = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        Alert.alert("Akses Ditolak", "Silakan login terlebih dahulu.");
        setLoading(false);
        return;
      }

      const uid = session.user.id;

      // 🟢 MENGAMBIL KOLOM varian_terpilih DARI SUPABASE
      const { data: cartData, error: cartError } = await supabase
        .from('keranjang')
        .select('id, pembeli_id, produk_id, kuantitas, varian_terpilih')
        .eq('pembeli_id', uid);

      if (cartError) throw cartError;

      if (!cartData || cartData.length === 0) {
        setCartItems([]);
        setSelectedItems([]);
        setActiveTokoId(null);
        return;
      }

      const { data: dataProduk, error: errorProduk } = await supabase
        .from('produk')
        .select('id_produk, nama_produk, harga_produk, foto_produk, stok_ready_produk, id_toko_produk, kategori_produk');

      if (errorProduk) throw errorProduk;

      const { data: dataToko } = await supabase
        .from('toko')
        .select('id_toko, nama_toko, status_toko');

      const produkMap = new Map(dataProduk?.map(p => [p.id_produk, p]) || []);
      const tokoMap = new Map(dataToko?.map(t => [t.id_toko, { nama: t.nama_toko, status: t.status_toko }]) || []);

      const formattedCart: CartItem[] = cartData.map((item: any) => {
        const detailProduk = dataProduk?.find(p => String(p.id_produk) === String(item.produk_id) || p.id_produk.substring(0,8) === String(item.produk_id));
        const liveProduk = detailProduk || produkMap.get(item.produk_id);
        const vendorId = liveProduk?.id_toko_produk || '';
        
        const infoToko = tokoMap.get(vendorId) || { nama: 'Mitra Toko PAMILO', status: 'TUTUP' };
        
        let pilar = 'MART';
        if (liveProduk?.kategori_produk) {
            const katUpper = String(liveProduk.kategori_produk).toUpperCase();
            if (katUpper.includes('SERVIS') || katUpper.includes('JASA')) pilar = 'SERVIS';
            else if (katUpper.includes('FOOD') || katUpper.includes('MAKANAN')) pilar = 'FOOD';
        }

        return {
          id: String(item.id),
          produk_id: String(item.produk_id),
          kuantitas: Number(item.kuantitas || 1),
          varian_terpilih: item.varian_terpilih || null, // 🟢 MENGISI DATA VARIAN KE KODE
          pilar_kategori: pilar,
          produk: liveProduk ? {
            nama_produk: liveProduk.nama_produk,
            harga_produk: Number(liveProduk.harga_produk || 0),
            foto_produk: liveProduk.foto_produk,
            stok_ready_produk: Number(liveProduk.stok_ready_produk || 0),
            id_toko_produk: vendorId,
            kategori_produk: String(liveProduk.kategori_produk || ''),
            toko: { 
              nama_toko: infoToko.nama,
              status_toko: String(infoToko.status).toUpperCase()
            }
          } : null
        };
      }).filter(item => item.produk !== null);

      setCartItems(formattedCart);
      setSelectedItems(prev => prev.filter(id => formattedCart.some(item => item.id === id)));

    } catch (error: any) {
      console.error("Gagal sinkronisasi keranjang:", error);
      Alert.alert("Sirkuit Putus", `Gagal memuat isi keranjang: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchKeranjangRiil();
    }, [])
  );

  const kelompokkanBerdasarkanToko = (): GroupedCart[] => {
    const kelompok: { [key: string]: { nama_toko: string; status_toko: string; items: CartItem[]; pilar: 'FOOD' | 'MART' | 'SERVIS' } } = {};
    
    cartItems.forEach((item: CartItem) => {
      if (!item.produk) return;
      const vendorId = item.produk.id_toko_produk;
      const namaTokoAsli = item.produk.toko?.nama_toko || `Mitra Toko`;
      const statusTokoAsli = item.produk.toko?.status_toko || `TUTUP`;

      if (!kelompok[vendorId]) {
        kelompok[vendorId] = {
          nama_toko: namaTokoAsli,
          status_toko: statusTokoAsli,
          items: [],
          pilar: item.pilar_kategori 
        };
      }
      kelompok[vendorId].items.push(item);
    });

    return Object.keys(kelompok).map(key => ({
      id_toko_produk: key,
      nama_toko: kelompok[key].nama_toko,
      status_toko: kelompok[key].status_toko,
      items: kelompok[key].items,
      pilar_utama: kelompok[key].pilar
    }));
  };

  const handleToggleCeklisItem = (item: CartItem) => {
    const isSudahDiceklis = selectedItems.includes(item.id);
    const idTokoItemIni = item.produk?.id_toko_produk;

    if (isSudahDiceklis) {
      const sisaAntreanCeklis = selectedItems.filter(id => id !== item.id);
      setSelectedItems(sisaAntreanCeklis);
      if (sisaAntreanCeklis.length === 0) {
        setActiveTokoId(null);
      }
    } else {
      if (activeTokoId && activeTokoId !== idTokoItemIni) {
        Alert.alert(
          "Checkout Terpisah! 🛒",
          "Kamu hanya bisa melakukan checkout dari satu toko yang sama per transaksi. Selesaikan pesanan toko ini terlebih dahulu atau ganti ceklis tokomu."
        );
        return;
      }
      setActiveTokoId(idTokoItemIni);
      setSelectedItems(prev => [...prev, item.id]);
    }
  };

  const ubahKuantitasCloud = async (idItem: string, kuantitasSekarang: number, stokMaksimal: number, aksi: 'tambah' | 'kurang', isJasa: boolean) => {
    // 🟢 SECURE GATE (POIN 3b): Gagalkan penambahan kuantitas di database jika ini kategori Jasa
    if (isJasa) {
      Alert.alert("Kuantitas Jasa 🔒", "Layanan pilar jasa hanya diperbolehkan satu kali pengerjaan per transaksi.");
      return;
    }

    let kuantitasBaru = kuantitasSekarang;
    
    if (aksi === 'tambah') {
      if (!isJasa && kuantitasSekarang >= stokMaksimal) {
        Alert.alert("Batas Stok", "Maaf, pembelian sudah menyentuh batas stok maksimal lapak.");
        return;
      }
      kuantitasBaru++;
    } else {
      if (kuantitasSekarang <= 1) return;
      kuantitasBaru--;
    }

    try {
      setLoadingAction(idItem);
      const { error } = await supabase
        .from('keranjang')
        .update({ kuantitas: kuantitasBaru })
        .eq('id', parseInt(idItem));

      if (error) throw error;
      setCartItems(prev => prev.map(item => item.id === idItem ? { ...item, kuantitas: kuantitasBaru } : item));
    } catch (error: any) {
      Alert.alert("Gagal", `Sirkuit gagal mengupdate kuantitas: ${error.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const hapusItemCloud = async (idItem: string, namaBarang: string) => {
    Alert.alert(
      "Hapus Barang",
      `Apakah Kamu yakin ingin mengeluarkan "${namaBarang}" dari keranjang?`,
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Hapus", 
          style: "destructive", 
          onPress: async () => {
            try {
              setLoadingAction(idItem);
              const { error } = await supabase.from('keranjang').delete().eq('id', parseInt(idItem));
              if (error) throw error;
              
              setCartItems(prev => prev.filter(item => item.id !== idItem));
              setSelectedItems(prev => {
                const updated = prev.filter(id => id !== idItem);
                if (updated.length === 0) setActiveTokoId(null);
                return updated;
              });
            } catch (error: any) {
              Alert.alert("Gagal", error.message);
            } finally {
              setLoadingAction(null);
            }
          } 
        }
      ]
    );
  };

  const hitungTotalBelanjaDicentang = () => {
    return cartItems
      .filter(item => selectedItems.includes(item.id))
      .reduce((total, item) => {
        if (!item.produk) return total;
        return total + (item.produk.harga_produk * item.kuantitas);
      }, 0);
  };

  const dapatkanStatusValidasiCheckout = () => {
    if (cartItems.length === 0) return { bisaClick: false, pesan: "Keranjang Kosong", pilar: 'MART' };
    if (selectedItems.length === 0) return { bisaClick: false, pesan: "Pilih Item (Ceklis)", pilar: 'MART' };

    const dataTokoGroup = kelompokkanBerdasarkanToko();
    const tokoAktif = dataTokoGroup.find(t => t.id_toko_produk === activeTokoId);

    if (!tokoAktif) return { bisaClick: false, pesan: "Pilih Produk Valid", pilar: 'MART' };
    if (tokoAktif.status_toko !== 'BUKA') {
      return { bisaClick: false, pesan: "Toko Mitra sedang TUTUP", pilar: tokoAktif.pilar_utama };
    }

    let adaStokKosong = false;
    const itemDicentangDiTokoIni = tokoAktif.items.filter(item => selectedItems.includes(item.id));
    
    itemDicentangDiTokoIni.forEach(item => {
      if (item.pilar_kategori !== 'SERVIS' && item.kuantitas > (item.produk?.stok_ready_produk || 0)) {
        adaStokKosong = true;
      }
    });

    if (adaStokKosong) {
      return { bisaClick: false, pesan: "Stok Produk tidak mencukupi", pilar: tokoAktif.pilar_utama };
    }

    return { bisaClick: true, pesan: `Lanjut Checkout (${selectedItems.length})`, pilar: tokoAktif.pilar_utama };
  };

  const handleLanjutCheckout = () => {
    const validasi = dapatkanStatusValidasiCheckout();
    if (!validasi.bisaClick) {
      Alert.alert("Checkout Ditolak 🚨", validasi.pesan);
      return;
    }
    
    router.push({
      pathname: '/checkout',
      params: { 
        selected_cart_ids: JSON.stringify(selectedItems),
        total_harga: hitungTotalBelanjaDicentang().toString(),
        pilar_layanan: validasi.pilar
      }
    });
  };

  const dataTokoTerkelompok = kelompokkanBerdasarkanToko();
  const statusValidasi = dapatkanStatusValidasiCheckout();

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: 'Keranjang Anda',
          headerTintColor: '#fff',
          headerStyle: { backgroundColor: '#4A3525' },
          headerTitleStyle: { fontWeight: 'bold', fontSize: 14 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 5, marginRight: 15 }}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          ),
        }} 
      />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      {cartItems.length > 0 ? (
        <View style={styles.mainWrapper}>
          <FlatList
            data={dataTokoTerkelompok}
            keyExtractor={(toko) => toko.id_toko_produk}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: toko }) => {
              const idTokoKelompokIni = toko.id_toko_produk;
              const isSectionDisabled = activeTokoId !== null && activeTokoId !== idTokoKelompokIni;
              return (
                <View style={[
                  styles.vendorSectionCard, 
                  toko.status_toko !== 'BUKA' && { borderColor: '#E6B0AA', backgroundColor: '#FADBD8' },
                  isSectionDisabled && { opacity: 0.45 }
                ]}>
                  
                  <View style={styles.vendorHeader}>
                    <FontAwesome5 name="store" size={11} color={toko.status_toko === 'BUKA' ? "#D35400" : "#C0392B"} />
                    <Text style={styles.vendorNameText} numberOfLines={1}>{toko.nama_toko}</Text>
                    
                    <View style={[
                      styles.multiVendorBadge, 
                      { backgroundColor: toko.status_toko === 'BUKA' ? '#FFF3E0' : '#F2D7D5' }
                    ]}>
                      <Text style={[
                        styles.multiVendorBadgeText, 
                        { color: toko.status_toko === 'BUKA' ? '#D35400' : '#C0392B' }
                      ]}>
                        {toko.status_toko === 'BUKA' ? 'Lapak Buka' : 'Lapak Tutup 🚨'}
                      </Text>
                    </View>
                  </View>

                  {toko.items.map((item) => {
                    const produk = item.produk;
                    if (!produk) return null;
                    const isJasa = item.pilar_kategori === 'SERVIS';
                    const isFood = item.pilar_kategori === 'FOOD';
                    const stokHabis = !isJasa && (item.kuantitas > produk.stok_ready_produk);
                    const isChecked = selectedItems.includes(item.id);

                    return (
                      <View key={item.id} style={[styles.productCard, stokHabis && { opacity: 0.6 }]}>
                        
                        <TouchableOpacity 
                          style={styles.checkboxTouchZone} 
                          onPress={() => handleToggleCeklisItem(item)}
                          activeOpacity={0.7}
                        >
                          <Ionicons 
                            name={isChecked ? "checkbox" : "square-outline"} 
                            size={21} 
                            color={isChecked ? "#4A3525" : "#BCAAA4"} 
                          />
                        </TouchableOpacity>

                        <Image 
                          source={{ uri: produk.foto_produk || 'https://via.placeholder.com/150' }} 
                          style={styles.productImage} 
                        />
                        
                        <View style={styles.productDetails}>
                          <Text style={styles.productName} numberOfLines={1}>{produk.nama_produk}</Text>
                          
                          {/* TAMPILAN LABEL VARIAN DI KERANJANG */}
                          {item.varian_terpilih && (
                            <Text style={styles.productVariantText}>Varian: {item.varian_terpilih}</Text>
                          )}

                          <Text style={styles.productPrice}>Rp {produk.harga_produk.toLocaleString('id-ID')}</Text>
                          
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: isJasa ? '#6A1B9A' : (isFood ? '#E65100' : '#0277BD'), marginTop: 2 }}>
                            {isJasa ? 'PAMILO SERVIS' : (isFood ? 'PAMILO FOOD' : 'PAMILO MART')}
                          </Text>

                          {stokHabis && (
                            <Text style={{ fontSize: 10, color: '#C0392B', fontWeight: 'bold', marginTop: 2 }}>
                              ⚠️ Sisa stok lapak: {produk.stok_ready_produk}
                            </Text>
                          )}

                          <View style={styles.controlRow}>
                            {/* 🟢 HIDE CONTROLLER ACTION KHUSUS JASA (POIN 3b) */}
                            {isJasa ? (
                              <View style={styles.jasaLabelBoxKeranjang}>
                                <Text style={styles.jasaLabelTxtKeranjang}>1 Rute Panggilan</Text>
                              </View>
                            ) : (
                              <View style={styles.counterBox}>
                                <TouchableOpacity 
                                  style={styles.counterBtn} 
                                  onPress={() => ubahKuantitasCloud(item.id, item.kuantitas, produk.stok_ready_produk, 'kurang', isJasa)}
                                  disabled={loadingAction === item.id}
                                >
                                  <Ionicons name="remove" size={13} color="#4A3525" />
                                </TouchableOpacity>
                                
                                {loadingAction === item.id ? (
                                  <ActivityIndicator size="small" color="#4A3525" style={{ paddingHorizontal: 4 }} />
                                ) : (
                                  <Text style={styles.counterText}>{item.kuantitas}</Text>
                                )}
                                
                                <TouchableOpacity 
                                  style={styles.counterBtn} 
                                  onPress={() => ubahKuantitasCloud(item.id, item.kuantitas, produk.stok_ready_produk, 'tambah', isJasa)}
                                  disabled={loadingAction === item.id}
                                >
                                  <Ionicons name="add" size={13} color="#4A3525" />
                                </TouchableOpacity>
                              </View>
                            )}

                            <TouchableOpacity 
                              style={styles.btnTrash} 
                              onPress={() => hapusItemCloud(item.id, produk.nama_produk)}
                              disabled={loadingAction === item.id}
                            >
                              <Ionicons name="trash-outline" size={14} color="#E74C3C" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            }}
          />

          <View style={[styles.bottomBillingBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 14 }]}>
            <View style={styles.totalTextContainer}>
              <Text style={styles.totalLabel}>Total Terpilih ({selectedItems.length}):</Text>
              <Text style={styles.totalValue}>Rp {hitungTotalBelanjaDicentang().toLocaleString('id-ID')}</Text>
            </View>
            
            <TouchableOpacity 
              style={[
                styles.btnCheckout, 
                !statusValidasi.bisaClick && { backgroundColor: '#BCAAA4' }
              ]} 
              onPress={handleLanjutCheckout}
              disabled={!statusValidasi.bisaClick}
            >
              <Text style={styles.btnCheckoutText}>{statusValidasi.pesan}</Text>
              {statusValidasi.bisaClick && <Ionicons name="chevron-forward" size={14} color="#fff" style={{ marginLeft: 3 }} />}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <FontAwesome5 name="shopping-basket" size={54} color="#E0D8C8" />
          <Text style={styles.emptyTitle}>Keranjang Belanja Kosong</Text>
          <Text style={styles.emptySubtitle}>Ayo, isi keranjangmu dengan berbelanja atau memesan jasa dari mitra PAMILO!</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FDFCFB' 
  },
  mainWrapper: { 
    flex: 1 
  },
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#FDFCFB' 
  },
  loadingText: { 
    marginTop: 10, 
    color: '#8D6E63', 
    fontSize: 12, 
    fontWeight: '500' 
  },
  listContent: { 
    padding: 16, 
    paddingBottom: 120 
  },
  vendorSectionCard: { 
    backgroundColor: '#fff', 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: '#EFEBE9', 
    padding: 14, 
    marginBottom: 14, 
    elevation: 0.5 
  },
  vendorHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderBottomWidth: 1, 
    borderBottomColor: '#F5F5F5', 
    paddingBottom: 10, 
    marginBottom: 12 
  },
  vendorNameText: { 
    fontSize: 13, 
    fontWeight: 'bold', 
    color: '#4A3525', 
    marginLeft: 8, 
    flex: 1 
  },
  multiVendorBadge: { 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 4, 
    marginLeft: 8 
  },
  multiVendorBadgeText: { 
    fontSize: 8, 
    fontWeight: 'bold' 
  },
  productCard: { 
    flexDirection: 'row', 
    marginBottom: 14, 
    alignItems: 'center', 
    width: '100%' 
  },
  checkboxTouchZone: { 
    paddingVertical: 12, 
    paddingRight: 10, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  productImage: { 
    width: 64, 
    height: 64, 
    borderRadius: 10, 
    backgroundColor: '#F5F5F5' 
  },
  productDetails: { 
    flex: 1, 
    marginLeft: 12, 
    justifyContent: 'center' 
  },
  productName: { 
    fontSize: 13, 
    fontWeight: 'bold', 
    color: '#4A3525' 
  },
  productVariantText: { 
    fontSize: 10, 
    color: '#8D6E63', 
    marginTop: 1, 
    fontStyle: 'italic', 
    fontWeight: '500' 
  },
  productPrice: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#D35400', 
    marginTop: 2 
  },
  controlRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 8 
  },
  counterBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FDFCFB', 
    borderWidth: 1, 
    borderColor: '#EFEBE9', 
    borderRadius: 14, 
    height: 28, 
    paddingHorizontal: 2 
  },
  counterBtn: { 
    width: 26, 
    height: 26, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  counterText: { 
    fontSize: 12, 
    fontWeight: 'bold', 
    color: '#4A3525', 
    paddingHorizontal: 8 
  },
  jasaLabelBoxKeranjang: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A5D6A7'
  },
  jasaLabelTxtKeranjang: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2E7D32'
  },
  btnTrash: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    backgroundColor: '#FADBD8', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  bottomBillingBar: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: '#fff', 
    flexDirection: 'row', 
    paddingHorizontal: 20, 
    paddingTop: 14, 
    borderTopWidth: 1, 
    borderTopColor: '#EFEBE9', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    elevation: 10 
  },
  totalTextContainer: { 
    flexDirection: 'column' 
  },
  totalLabel: { 
    fontSize: 11, 
    color: '#A1887F', 
    fontWeight: '500' 
  },
  totalValue: { 
    fontSize: 16, 
    fontWeight: '900', 
    color: '#D35400', 
    marginTop: 2 
  },
  btnCheckout: { 
    backgroundColor: '#4A3525', 
    flexDirection: 'row', 
    height: 42, 
    paddingHorizontal: 16, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 1, 
    minWidth: '45%' 
  },
  btnCheckoutText: { 
    color: '#fff', 
    fontSize: 11, 
    fontWeight: 'bold', 
    textAlign: 'center' 
  },
  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 40 
  },
  emptyTitle: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    color: '#4A3525', 
    marginTop: 16 
  },
  emptySubtitle: { 
    fontSize: 12, 
    color: '#8D6E63', 
    textAlign: 'center', 
    marginTop: 6, 
    lineHeight: 18 
  }
});