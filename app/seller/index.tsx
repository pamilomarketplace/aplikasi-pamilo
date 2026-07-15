// app/seller/index.tsx
import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, StatusBar, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router'; 
import { useSeller, ProductItem } from '@/features/seller/useSeller';

export default function SellerDashboardScreen() {
  const router = useRouter(); 
  const {
    products, rawProductsCount, isLoading, isProcessing, isUploadingImage,
    nama, setNama,
    harga, setHarga,
    tipe, setTipe,
    deskripsi, setDeskripsi,
    fotoUrl, setVarian, varian,
    searchQuery, setSearchQuery,
    editingProductId, handleEditPress, handleCancelEdit, handlePickAndUploadImage,
    refresh, handleAddProduct, handleDeleteProduct
  } = useSeller();

  const formatRupiah = (angka: number) => `Rp ${Number(angka).toLocaleString('id-ID')}`;

  const renderFormHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.screenTitle}>Manajemen Lapak Toko</Text>
      
      {/* 🚀 BARISAN TOMBOL MENU UTAMA SELLER */}
      <View style={styles.topMenuRow}>
        <TouchableOpacity style={styles.radarBtnCard} onPress={() => router.push('/seller/orders' as any)}>
          <View style={styles.radarIconBox}>
            <Ionicons name="restaurant-outline" size={24} color="#FFF" />
          </View>
          <View style={styles.radarTextCol}>
            <Text style={styles.radarTitle}>Dapur / Radar Toko</Text>
            <Text style={styles.radarSub}>Pantau & kelola pesanan.</Text>
          </View>
          <Ionicons name="chevron-forward-circle" size={22} color="#2ECC71" />
        </TouchableOpacity>

        {/* 🚀 TOMBOL JALAN MASUK KE KELOLA PROMO TOKO */}
        <TouchableOpacity style={styles.promoBtnCard} onPress={() => router.push('/seller/kelola-promo' as any)}>
          <View style={styles.promoIconBox}>
            <Ionicons name="pricetags-outline" size={24} color="#FFF" />
          </View>
          <View style={styles.radarTextCol}>
            <Text style={styles.radarTitle}>Kelola Promo & Diskon</Text>
            <Text style={styles.radarSub}>Kupon & Diskon Harga.</Text>
          </View>
          <Ionicons name="chevron-forward-circle" size={22} color="#E28743" />
        </TouchableOpacity>
      </View>

      {/* SEKTOR FORM INPUT PRODUK PREMIUM HIBRIDA */}
      <View style={[styles.formCard, editingProductId ? styles.formCardEditMode : null]}>
        <Text style={styles.sectionFormTitle}>
          {editingProductId ? '📝 Perbarui Menu / Produk Anda' : '➕ Pasang Menu / Produk Baru'}
        </Text>
        
        {/* 🌟 WIDGET SELECTOR GAMBAR DARI GALERI NATIF */}
        <View style={styles.imagePickerSectionRow}>
          <TouchableOpacity 
            style={styles.imageSelectorSquareContainer}
            activeOpacity={0.8}
            onPress={handlePickAndUploadImage}
            disabled={isUploadingImage}
          >
            {isUploadingImage ? (
              <ActivityIndicator color="#E28743" />
            ) : fotoUrl ? (
              <Image source={{ uri: fotoUrl }} style={styles.previewPickedImage} />
            ) : (
              <View style={styles.placeholderPickerCol}>
                <Ionicons name="camera-outline" size={26} color="#C0A995" />
                <Text style={styles.textLabelPickerMini}>Pilih Foto</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.pickerExplainColumn}>
            <Text style={styles.titleExplainPicker}>Foto Menu Dagangan</Text>
            <Text style={styles.subExplainPicker}>Direkomendasikan rasio 1:1 format persegi kotak untuk tampilan terbaik di beranda warga.</Text>
            {fotoUrl ? (
              <Text style={styles.statusUploadSuccessBadge}>✓ Foto Siap Ditayangkan</Text>
            ) : null}
          </View>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Nama Menu (Contoh: Seblak Ndower Galuh)"
          placeholderTextColor="#A1887F"
          value={nama}
          onChangeText={setNama}
        />

        <TextInput
          style={styles.input}
          placeholder="Harga Jual (Contoh: 15000)"
          placeholderTextColor="#A1887F"
          keyboardType="numeric"
          value={harga}
          onChangeText={setHarga}
        />

        {/* 🌟 KOLOM INPUT BARU PILIHAN VARIAN */}
        <TextInput
          style={styles.input}
          placeholder="Pilihan Varian (Contoh: Level 1-5, Original, Keju)"
          placeholderTextColor="#A1887F"
          value={varian}
          onChangeText={setVarian}
        />

        {/* TIPE PILIHAN SELECTOR */}
        <View style={styles.selectorRow}>
          {(['FOOD', 'MART', 'SERVICE'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.selectorBtn, tipe === t && styles.selectorActive]}
              onPress={() => setTipe(t)}
            >
              <Text style={[styles.selectorText, tipe === t && styles.selectorTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Deskripsi racikan menu atau detail kondisi barang..."
          placeholderTextColor="#A1887F"
          multiline
          value={deskripsi}
          onChangeText={setDeskripsi}
        />

        {/* REGU TOMBOL AKSI FORM */}
        <View style={styles.actionFormGroupRow}>
          {editingProductId && (
            <TouchableOpacity style={styles.cancelEditBtn} onPress={handleCancelEdit}>
              <Text style={styles.cancelEditBtnText}>Batal</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.submitBtn, editingProductId ? { backgroundColor: '#2ECC71' } : null]} 
            onPress={handleAddProduct}
            disabled={isProcessing || isUploadingImage}
          >
            {isProcessing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitBtnText}>
                {editingProductId ? 'Simpan Perubahan ✨' : 'Tayangkan di Aplikasi 🚀'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 🌟 BARIS WIDGET KOTAK PENCARIAN PRODUK LOKAL REALTIME */}
      {rawProductsCount > 0 && (
        <View style={styles.searchBarWrapperCard}>
          <Ionicons name="search-outline" size={18} color="#A1887F" style={styles.iconLensSearch} />
          <TextInput
            style={styles.inputSearchField}
            placeholder="Cari menu tayang Anda (Nama, deskripsi, atau varian)..."
            placeholderTextColor="#A1887F"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      )}

      <Text style={styles.listSectionTitle}>📦 Menu Toko yang Sedang Tayang</Text>
    </View>
  );

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF3F0" />
      
      <FlatList
        data={products}
        keyExtractor={(item: ProductItem) => item.id}
        refreshing={isLoading}
        onRefresh={refresh}
        ListHeaderComponent={renderFormHeader}
        contentContainerStyle={styles.listPadding}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={styles.emptyText}>
              {searchQuery.trim() ? 'Pencarian nihil. Tidak ada nama menu atau varian yang cocok.' : 'Lapak Anda masih kosong. Silakan tambah menu pertama Anda di atas!'}
            </Text>
          ) : null
        }
        renderItem={({ item }: { item: ProductItem }) => (
          <View style={styles.productRowItem}>
            
            {/* FOTO PRODUK RIIL ASAL BUCKET CLOUD STORAGE */}
            {item.foto ? (
              <Image source={{ uri: item.foto }} style={styles.productImageMini} />
            ) : (
              <View style={styles.productImagePlaceholderMini}>
                <Ionicons name={item.tipe === 'FOOD' ? 'fast-food' : item.tipe === 'MART' ? 'basket' : 'build'} size={22} color="#C0A995" />
              </View>
            )}

            {/* INFORMASI UTAMA & DESKRIPSI TENGAH */}
            <View style={styles.itemInfo}>
              <View style={styles.badgeRow}>
                <Text style={styles.itemBadge}>{item.tipe}</Text>
                {editingProductId === item.id && <Text style={styles.liveEditIndicator}>Sedang Di-edit</Text>}
              </View>
              <Text style={styles.itemNameText}>{item.nama}</Text>
              
              <Text style={styles.itemDescText} numberOfLines={2}>
                {item.deskripsi || 'Belum ada deskripsi singkat menu.'}
              </Text>

              {item.varian ? (
                <View style={styles.variantCapsuleRow}>
                  <Text style={styles.textVariantCapsule}>🎨 Varian: {item.varian}</Text>
                </View>
              ) : null}
              
              {/* 🚀 INDIKASI HARGA NORMAL (Jika tidak ada fitur coret harga, biarkan seperti ini dulu) */}
              <Text style={styles.itemPriceText}>{formatRupiah(item.harga)}</Text>
            </View>

            {/* GEAR TOMBOL MANAGEMENT SISI KANAN */}
            <View style={styles.rightActionColumnGroup}>
              <TouchableOpacity 
                style={styles.editBtnMini}
                onPress={() => handleEditPress(item)}
                disabled={isProcessing}
              >
                <Ionicons name="pencil" size={12} color="#FFF" />
                <Text style={styles.editBtnMiniText}>Edit</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.deleteBtn}
                onPress={() => handleDeleteProduct(item.id)}
                disabled={isProcessing}
              >
                <Ionicons name="trash-outline" size={12} color="#E74C3C" />
                <Text style={styles.deleteBtnText}>Hapus</Text>
              </TouchableOpacity>
            </View>

          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' }, 
  listPadding: { paddingHorizontal: 15, paddingTop: 15, paddingBottom: 30 },
  headerContainer: { marginBottom: 10 },
  screenTitle: { fontSize: 20, fontWeight: 'bold', color: '#4A3420', marginBottom: 15 },
  
  topMenuRow: { flexDirection: 'column', gap: 10, marginBottom: 16 },
  radarBtnCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#2ECC71', elevation: 2 },
  radarIconBox: { backgroundColor: '#2ECC71', width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  promoBtnCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#F39C12', elevation: 2 },
  promoIconBox: { backgroundColor: '#F39C12', width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  
  radarTextCol: { flex: 1 },
  radarTitle: { fontSize: 14, fontWeight: 'bold', color: '#2C3E50' },
  radarSub: { fontSize: 10, color: '#7F8C8D', marginTop: 2 },

  formCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 14, borderWidth: 1, borderColor: '#E0D0C0', elevation: 1 },
  formCardEditMode: { borderColor: '#F5B041', borderWidth: 1.5 },
  sectionFormTitle: { fontSize: 13, fontWeight: 'bold', color: '#4A3420', marginBottom: 15 },
  
  imagePickerSectionRow: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: '#FAF6F0', padding: 10, borderRadius: 10, borderWidth: 0.5, borderColor: '#EBE7DF', marginBottom: 14 },
  imageSelectorSquareContainer: { width: 70, height: 70, borderRadius: 8, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#C0A995', borderStyle: 'dashed', overflow: 'hidden' },
  previewPickedImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholderPickerCol: { alignItems: 'center', gap: 2 },
  textLabelPickerMini: { fontSize: 9, fontWeight: 'bold', color: '#7A6450' },
  pickerExplainColumn: { flex: 1, gap: 2 },
  titleExplainPicker: { fontSize: 12, fontWeight: 'bold', color: '#4A3420' },
  subExplainPicker: { fontSize: 9, color: '#A1887F', lineHeight: 12 },
  statusUploadSuccessBadge: { fontSize: 9, color: '#2ECC71', fontWeight: 'bold', marginTop: 2 },

  input: { backgroundColor: '#FAF6F0', borderWidth: 1, borderColor: '#E0D0C0', borderRadius: 8, padding: 10, fontSize: 13, color: '#4A3420', marginBottom: 12 },
  textArea: { minHeight: 55, textAlignVertical: 'top' },
  selectorRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  selectorBtn: { flex: 1, paddingVertical: 8, backgroundColor: '#FAF6F0', borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#E0D0C0' },
  selectorActive: { backgroundColor: '#4A3420', borderColor: '#4A3420' },
  selectorText: { fontSize: 11, fontWeight: 'bold', color: '#7A6450' },
  selectorTextActive: { color: '#FFF' },
  
  actionFormGroupRow: { flexDirection: 'row', gap: 10, marginTop: 3 },
  cancelEditBtn: { flex: 0.4, backgroundColor: '#7A6450', height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  cancelEditBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  submitBtn: { flex: 1, backgroundColor: '#E28743', height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center', elevation: 1 },
  submitBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  
  searchBarWrapperCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#EBE7DF', paddingHorizontal: 12, height: 42, marginTop: 20, elevation: 1 },
  iconLensSearch: { marginRight: 8 },
  inputSearchField: { flex: 1, fontSize: 12, color: '#4A3420', fontWeight: '500' },

  listSectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#A1887F', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 22, marginBottom: 8 },
  
  productRowItem: { backgroundColor: '#FFF', padding: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#E0D0C0', elevation: 1, gap: 12 },
  productImageMini: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#FAF6F0', resizeMode: 'cover' },
  productImagePlaceholderMini: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#FAF6F0', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EADBC8' },
  
  itemInfo: { flex: 1, justifyContent: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  itemBadge: { fontSize: 8, color: '#E28743', fontWeight: 'bold', textTransform: 'uppercase' },
  liveEditIndicator: { fontSize: 8, color: '#F57C00', backgroundColor: '#FFF3E0', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, fontWeight: 'bold' },
  itemNameText: { fontSize: 13, fontWeight: 'bold', color: '#4A3420' },
  itemDescText: { fontSize: 10, color: '#8D7B68', marginTop: 2, lineHeight: 14 },
  
  variantCapsuleRow: { backgroundColor: '#FAF6F0', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4, borderWidth: 0.5, borderColor: '#EADBC8' },
  textVariantCapsule: { fontSize: 9, fontWeight: 'bold', color: '#7A6450' },

  itemPriceText: { fontSize: 13, fontWeight: '800', color: '#2ECC71', marginTop: 4, letterSpacing: -0.3 },
  
  rightActionColumnGroup: { gap: 8, alignItems: 'center', justifyContent: 'center' },
  editBtnMini: { backgroundColor: '#E28743', flexDirection: 'row', alignItems: 'center', gap: 3, width: 62, height: 26, borderRadius: 6, justifyContent: 'center' },
  editBtnMiniText: { color: '#FFF', fontWeight: 'bold', fontSize: 10 },
  deleteBtn: { backgroundColor: '#FADBD8', flexDirection: 'row', alignItems: 'center', gap: 3, width: 62, height: 26, borderRadius: 6, justifyContent: 'center' },
  deleteBtnText: { color: '#E74C3C', fontWeight: 'bold', fontSize: 10 },
  
  emptyText: { textAlign: 'center', color: '#7A6450', marginTop: 30, fontStyle: 'italic', fontSize: 12 }
});