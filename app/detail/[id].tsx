// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator, 
  StatusBar,
  Alert,
  Dimensions, 
  FlatList,
  Share
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// BACKEND: KONEKTOR UTAMA SUPABASE TUAN
import { supabase } from '../../supabaseConfig';

const { width } = Dimensions.get('window');

interface ProductDetail {
  id_produk: string; 
  id_toko_produk: string;
  nama_produk: string;
  harga_produk: number; 
  deskripsi_produk: string;
  kategori_produk: string;
  foto_produk?: string;
  stok_ready_produk: number;
  terjual_produk: number;
  pilihan_varian?: string; 
}

interface TokoDetail {
  id_toko: string;
  nama_toko: string;
  alamat_toko: string;
  foto_toko?: string;
}

export default function DetailProdukScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [jumlahBeli, setJumlahBeli] = useState(1);
  const [loadingCart, setLoadingCart] = useState(false);
  const [loadingBeliLangsung, setLoadingBeliLangsung] = useState(false);
  
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  
  const [isFavorit, setIsFavorit] = useState(false);
  const [idFavoritLokal, setIdFavoritLokal] = useState<string | null>(null);

  const [toko, setToko] = useState<TokoDetail | null>(null);
  const [otherProducts, setOtherProducts] = useState<ProductDetail[]>([]);

  const fetchDetailProdukDanFavorit = async () => {
    try {
      setLoading(true);
      if (!id) return;

      const { data, error } = await supabase.from('produk').select('*').eq('id_produk', id).maybeSingle();
      if (error) throw error;
      
      if (data) {
        setProduct(data as ProductDetail);

        const { data: dataToko } = await supabase.from('toko').select('id_toko, nama_toko, alamat_toko, foto_toko').eq('id_toko', data.id_toko_produk).maybeSingle();
        if (dataToko) setToko(dataToko as TokoDetail);

        const { data: dataLain } = await supabase.from('produk').select('*').eq('id_toko_produk', data.id_toko_produk).neq('id_produk', id).gt('stok_ready_produk', 0).limit(4);
        if (dataLain) setOtherProducts(dataLain as ProductDetail[]);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: favData } = await supabase.from('user_favorites').select('id').or(`id_produk_favorit.eq.${id},produk_id.eq.${id}`).eq('user_id', session.user.id).maybeSingle();
        if (favData) {
          setIsFavorit(true);
          setIdFavoritLokal(String(favData.id));
        }
      }
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDetailProdukDanFavorit();
      setJumlahBeli(1); 
      setSelectedVariant(null);
    }
  }, [id]);

  const handleToggleFavorit = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return Alert.alert("Akses Ditolak", "Silakan login terlebih dahulu.");

      if (isFavorit && idFavoritLokal) {
        await supabase.from('user_favorites').delete().eq('id', parseInt(idFavoritLokal));
        setIsFavorit(false);
        setIdFavoritLokal(null);
      } else {
        const { data: newFav } = await supabase.from('user_favorites').insert([{ user_id: session.user.id, produk_id: id }]).select();
        setIsFavorit(true);
        if (newFav?.[0]) setIdFavoritLokal(String(newFav[0].id));
      }
    } catch (err) {
      console.log(err);
    }
  };

  // 🟢 FUNGSI SHARE DENGAN UNIVERSAL LINK
  const handleShareKonten = async (jenis: 'PRODUK' | 'TOKO') => {
    try {
      const baseUrl = 'https://pamilo.store'; 
      let pesanTeks = '';

      if (jenis === 'PRODUK') {
        const linkProduk = `${baseUrl}/detail/${id}`;
        pesanTeks = `🔥 Beli *${product?.nama_produk}* seharga Rp ${(product?.harga_produk || 0).toLocaleString('id-ID')} di aplikasi PAMILO!\n\nYuk order sekarang, klik link ini:\n${linkProduk}`;
      } else {
        const linkToko = `${baseUrl}/seller/${toko?.id_toko}`;
        pesanTeks = `🏪 Kunjungi toko *${toko?.nama_toko}* di aplikasi PAMILO untuk melihat layanan & produk terbaik mereka!\n\nCek tokonya di sini:\n${linkToko}`;
      }

      await Share.share({
        message: pesanTeks,
      });
    } catch (error) {
      console.log("Gagal berbagi konten:", error);
    }
  };

  const tambahJumlah = () => { if (product && jumlahBeli < product.stok_ready_produk) setJumlahBeli(prev => prev + 1); };
  const kurangJumlah = () => { if (jumlahBeli > 1) setJumlahBeli(prev => prev - 1); };

  // Validasi kategori penentu pilar Jasa/Servis
  const cekKategoriJasa = product?.kategori_produk ? (String(product.kategori_produk).toUpperCase().includes('SERVIS') || String(product.kategori_produk).toUpperCase().includes('JASA')) : false;

  const handleMasukkanKeranjang = async () => {
    if (!product) return;
    
    if (product.pilihan_varian && !selectedVariant) {
      return Alert.alert("Pilih Varian", "Harap pilih varian produk terlebih dahulu sebelum memasukkan ke keranjang.");
    }

    try {
      setLoadingCart(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return Alert.alert("Akses Ditolak", "Silakan login.");

      // 🟢 LOGIKA ANTI-BUG: Kunci Jasa jadi 1
      const kuantitasFinal = cekKategoriJasa ? 1 : jumlahBeli;

      let queryCek = supabase
        .from('keranjang')
        .select('id, kuantitas')
        .eq('pembeli_id', session.user.id)
        .eq('produk_id', product.id_produk);
      
      if (selectedVariant) {
        queryCek = queryCek.eq('varian_terpilih', selectedVariant);
      } else {
        queryCek = queryCek.is('varian_terpilih', null);
      }

      const { data: itemEksis } = await queryCek.maybeSingle();

      if (itemEksis) {
        if (cekKategoriJasa) {
          return Alert.alert("Sudah Ada 🔒", "Layanan jasa ini sudah tersimpan di dalam keranjang belanja Anda.");
        }
        await supabase.from('keranjang').update({ kuantitas: itemEksis.kuantitas + kuantitasFinal }).eq('id', itemEksis.id);
      } else {
        await supabase.from('keranjang').insert([{ 
          pembeli_id: session.user.id, 
          produk_id: product.id_produk, 
          kuantitas: kuantitasFinal,
          varian_terpilih: selectedVariant || null 
        }]);
      }
      Alert.alert("Sukses! 🛒", `Barang berhasil masuk keranjang${selectedVariant ? ` (Varian: ${selectedVariant})` : ''}.`);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingCart(false);
    }
  };

  const handleBeliSekarang = async () => {
    if (!product) return;

    if (product.pilihan_varian && !selectedVariant) {
      return Alert.alert("Pilih Varian", "Harap pilih varian produk terlebih dahulu sebelum checkout.");
    }

    try {
      setLoadingBeliLangsung(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return Alert.alert("Akses Ditolak", "Silakan login terlebih dahulu untuk checkout.");

      const kuantitasFinal = cekKategoriJasa ? 1 : jumlahBeli;
      let targetCartId;
      
      let queryCek = supabase
        .from('keranjang')
        .select('id, kuantitas')
        .eq('pembeli_id', session.user.id)
        .eq('produk_id', product.id_produk);

      if (selectedVariant) {
        queryCek = queryCek.eq('varian_terpilih', selectedVariant);
      } else {
        queryCek = queryCek.is('varian_terpilih', null);
      }

      const { data: itemEksis } = await queryCek.maybeSingle();

      if (itemEksis) {
        const hitungKuantitasBaru = cekKategoriJasa ? 1 : (itemEksis.kuantitas + kuantitasFinal);
        const { data: updatedItem } = await supabase
          .from('keranjang')
          .update({ kuantitas: hitungKuantitasBaru })
          .eq('id', itemEksis.id)
          .select('id')
          .single();
        targetCartId = updatedItem?.id;
      } else {
        const { data: newItem } = await supabase
          .from('keranjang')
          .insert([{ 
            pembeli_id: session.user.id, 
            produk_id: product.id_produk, 
            kuantitas: kuantitasFinal,
            varian_terpilih: selectedVariant || null 
          }])
          .select('id')
          .single();
        targetCartId = newItem?.id;
      }
      
      if (targetCartId) {
        const totalHargaDasar = kuantitasFinal * (product.harga_produk || 0);

        router.push({
          pathname: '/(warga)/checkout',
          params: { 
            selected_cart_ids: JSON.stringify([targetCartId]), 
            total_harga: totalHargaDasar
          }
        });
      } else {
        throw new Error("Gagal mengunci sasis barang.");
      }
    } catch (error) {
      Alert.alert("Gagal Memproses", "Koneksi ke server pembayaran terputus.");
      console.log("Error Beli Langsung:", error);
    } finally {
      setLoadingBeliLangsung(false);
    }
  };

  if (loading) return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#4A3525" /></View>;
  if (!product) return <View style={styles.centerContainer}><Text>Produk tidak ditemukan.</Text></View>;

  const code = (product.kategori_produk || '').toUpperCase().trim();
  const pilarLabel = code === 'FOOD' ? 'Pamilo Food' : (code === 'SERVIS' || code === 'JASA') ? 'Pamilo Servis' : 'Pamilo Mart';
  const varianArray = product.pilihan_varian ? product.pilihan_varian.split(',').map(v => v.trim()).filter(v => v !== '') : [];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, headerTitle: `Detail ${pilarLabel}`, headerTintColor: '#fff', headerStyle: { backgroundColor: '#4A3525' } }} />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      <View style={styles.mainContentWrapper}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
          
          <View style={styles.imageContainer}>
            <Image source={{ uri: product.foto_produk || 'https://via.placeholder.com/600' }} style={styles.productImage} resizeMode="cover" />
            
            <View style={styles.actionButtonsHeaderContainer}>
              <TouchableOpacity style={styles.floatingShareBtn} onPress={() => handleShareKonten('PRODUK')}>
                <Ionicons name="share-social" size={18} color="#4A3525" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.floatingHeartBtn} onPress={handleToggleFavorit}>
                <Ionicons name={isFavorit ? "heart" : "heart-outline"} size={22} color={isFavorit ? "#C0392B" : "#4A3525"} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.productPrice}>Rp {(product.harga_produk || 0).toLocaleString('id-ID')}</Text>
            <Text style={styles.productName}>{product.nama_produk}</Text>
            
            <View style={styles.statsRow}>
              <View style={styles.statBadge}>
                <Text style={styles.statBadgeText}>
                  {cekKategoriJasa ? "Slot Tersedia" : `Stok: ${product.stok_ready_produk || 0}`}
                </Text>
              </View>
              <Text style={styles.divider}>•</Text>
              <Text style={styles.soldText}>Terjual {product.terjual_produk || 0}</Text>
              <Text style={styles.divider}>•</Text>
              <View style={styles.ratingRow}><Ionicons name="star" size={14} color="#FFD700" /><Text style={styles.ratingText}>5.0</Text></View>
            </View>
          </View>

          {varianArray.length > 0 && (
            <View style={styles.variantSection}>
              <Text style={styles.sectionTitle}>Pilih Varian <Text style={{color: '#C62828'}}>*</Text></Text>
              <View style={styles.variantList}>
                {varianArray.map((varian, index) => {
                  const isActive = selectedVariant === varian;
                  return (
                    <TouchableOpacity 
                      key={index} 
                      style={[styles.variantBtn, isActive && styles.variantBtnActive]}
                      onPress={() => setSelectedVariant(varian)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.variantBtnText, isActive && styles.variantBtnTextActive]}>{varian}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          )}

          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>Deskripsi {cekKategoriJasa ? 'Layanan' : 'Produk'}</Text>
            <Text style={styles.descriptionText}>{product.deskripsi_produk || 'Tidak ada deskripsi.'}</Text>
          </View>

          {toko && (
            <View style={styles.tokoSection}>
              <View style={styles.tokoCardBox}>
                <View style={styles.tokoLogoCircle}>
                  {toko.foto_toko ? <Image source={{ uri: toko.foto_toko }} style={styles.tokoImg} /> : <Text style={styles.tokoInitialTxt}>M</Text>}
                </View>
                <View style={styles.tokoInfoMeta}>
                  <Text style={styles.tokoNameTxt}>{toko.nama_toko}</Text>
                  <Text style={styles.tokoLocTxt} numberOfLines={1}>📍 {toko.alamat_toko}</Text>
                </View>
                
                <View style={styles.actionStoreButtonRow}>
                  <TouchableOpacity 
                    style={styles.btnShareStore} 
                    onPress={() => handleShareKonten('TOKO')}
                  >
                    <Ionicons name="share-social" size={14} color="#4A3525" />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.btnVisitStore} 
                    onPress={() => router.push(`/seller/${toko.id_toko}`)}
                  >
                    <Text style={styles.btnVisitStoreTxt}>Lihat Toko</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

        </ScrollView>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 15 }]}>
        
        {cekKategoriJasa ? (
          <View style={styles.jasaKuantitasStatisBadge}>
            <Text style={styles.jasaKuantitasStatisText}>1x Booking</Text>
          </View>
        ) : (
          <View style={styles.counterContainer}>
            <TouchableOpacity style={styles.counterBtn} onPress={kurangJumlah}><Ionicons name="remove" size={16} color="#4A3525" /></TouchableOpacity>
            <Text style={styles.counterValue}>{jumlahBeli}</Text>
            <TouchableOpacity style={styles.counterBtn} onPress={tambahJumlah}><Ionicons name="add" size={16} color="#4A3525" /></TouchableOpacity>
          </View>
        )}

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity 
            style={[styles.btnCartOutline, (!cekKategoriJasa && product.stok_ready_produk === 0) && { borderColor: '#E0E0E0' }]} 
            onPress={handleMasukkanKeranjang} 
            disabled={(!cekKategoriJasa && product.stok_ready_produk === 0) || loadingCart}
          >
            {loadingCart ? <ActivityIndicator size="small" color="#D35400" /> : <Ionicons name="cart-outline" size={20} color={(!cekKategoriJasa && product.stok_ready_produk === 0) ? "#9E9E9E" : "#D35400"} />}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.btnBuyNow, { backgroundColor: cekKategoriJasa ? '#6A1B9A' : '#D35400' }, (!cekKategoriJasa && product.stok_ready_produk === 0) && { backgroundColor: '#BCAAA4' }]} 
            onPress={handleBeliSekarang} 
            disabled={(!cekKategoriJasa && product.stok_ready_produk === 0) || loadingBeliLangsung}
          >
            {loadingBeliLangsung ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.btnBuyNowText}>
                {(!cekKategoriJasa && product.stok_ready_produk === 0) ? 'Habis' : cekKategoriJasa ? 'Pesan Jasa' : 'Beli Langsung'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FDFCFB' 
  },
  mainContentWrapper: { 
    flex: 1 
  }, 
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  imageContainer: { 
    width: '100%', 
    height: 360, 
    backgroundColor: '#FFF3E0', 
    position: 'relative' 
  },
  productImage: { 
    width: '100%', 
    height: '100%' 
  },
  actionButtonsHeaderContainer: { 
    position: 'absolute', 
    top: 20, 
    right: 20, 
    flexDirection: 'row', 
    gap: 8 
  },
  floatingShareBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: 'rgba(255,255,255,0.9)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 4 
  },
  floatingHeartBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: 'rgba(255,255,255,0.9)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 4 
  },
  infoSection: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#EFEBE9' 
  },
  productPrice: { 
    fontSize: 24, 
    fontWeight: '900', 
    color: '#D35400' 
  },
  productName: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#4A3525', 
    marginTop: 6 
  },
  statsRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 12 
  },
  statBadge: { 
    backgroundColor: '#EFEBE9', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6 
  },
  statBadgeText: { 
    fontSize: 11, 
    fontWeight: 'bold', 
    color: '#8D6E63' 
  },
  divider: { 
    fontSize: 12, 
    color: '#BCAAA4', 
    marginHorizontal: 10 
  },
  soldText: { 
    fontSize: 12, 
    color: '#7D665E' 
  },
  ratingRow: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  ratingText: { 
    fontSize: 12, 
    fontWeight: 'bold', 
    color: '#4A3525', 
    marginLeft: 3 
  },
  variantSection: { 
    backgroundColor: '#fff', 
    padding: 20, 
    marginTop: 10, 
    borderWidth: 1, 
    borderColor: '#EFEBE9' 
  },
  variantList: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10, 
    marginTop: 12 
  },
  variantBtn: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#D7CCC8', 
    backgroundColor: '#FAF8F5' 
  },
  variantBtnActive: { 
    borderColor: '#D35400', 
    backgroundColor: '#FFF3E0' 
  },
  variantBtnText: { 
    fontSize: 12, 
    fontWeight: 'bold', 
    color: '#8D6E63' 
  },
  variantBtnTextActive: { 
    color: '#D35400' 
  },
  descriptionSection: { 
    backgroundColor: '#fff', 
    padding: 20, 
    marginTop: 10, 
    borderWidth: 1, 
    borderColor: '#EFEBE9' 
  },
  sectionTitle: { 
    fontSize: 13, 
    fontWeight: 'bold', 
    color: '#4A3525' 
  },
  descriptionText: { 
    fontSize: 13, 
    color: '#5D4037', 
    lineHeight: 22, 
    marginTop: 8 
  },
  tokoSection: { 
    backgroundColor: '#fff', 
    padding: 20, 
    marginTop: 10, 
    borderWidth: 1, 
    borderColor: '#EFEBE9' 
  },
  tokoCardBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FAF8F5', 
    padding: 12, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#EFEBE9' 
  },
  tokoLogoCircle: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: '#FFF3E0', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#D7CCC8', 
    overflow: 'hidden' 
  },
  tokoImg: { 
    width: '100%', 
    height: '100%' 
  },
  tokoInitialTxt: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#4A3525' 
  },
  tokoInfoMeta: { 
    marginLeft: 12, 
    flex: 1, 
    paddingRight: 6 
  },
  tokoNameTxt: { 
    fontSize: 13, 
    fontWeight: 'bold', 
    color: '#4A3525' 
  },
  tokoLocTxt: { 
    fontSize: 10, 
    color: '#757575', 
    marginTop: 3 
  },
  actionStoreButtonRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  btnShareStore: { 
    backgroundColor: '#EFEBE9', 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#D7CCC8' 
  },
  btnVisitStore: { 
    backgroundColor: '#4A3525', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 14, 
    justifyContent: 'center' 
  },
  btnVisitStoreTxt: { 
    color: '#fff', 
    fontSize: 10, 
    fontWeight: 'bold' 
  },
  bottomBar: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: '#fff', 
    flexDirection: 'row', 
    paddingHorizontal: 16, 
    paddingTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#EFEBE9', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  counterContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FDFCFB', 
    borderWidth: 1, 
    borderColor: '#EFEBE9', 
    borderRadius: 20, 
    height: 40, 
    paddingHorizontal: 4 
  },
  counterBtn: { 
    width: 32, 
    height: 32, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  counterValue: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#4A3525', 
    paddingHorizontal: 10 
  },
  jasaKuantitasStatisBadge: { 
    backgroundColor: '#E8F5E9', 
    paddingHorizontal: 12, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#A5D6A7' 
  },
  jasaKuantitasStatisText: { 
    fontSize: 12, 
    fontWeight: 'bold', 
    color: '#2E7D32' 
  },
  actionButtonsRow: { 
    flexDirection: 'row', 
    flex: 1, 
    marginLeft: 12, 
    gap: 8 
  },
  btnCartOutline: { 
    width: 46, 
    height: 40, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#D35400', 
    backgroundColor: '#FFF', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  btnBuyNow: { 
    flex: 1, 
    backgroundColor: '#D35400', 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 1 
  },
  btnBuyNowText: { 
    color: '#fff', 
    fontSize: 13, 
    fontWeight: 'bold' 
  }
});