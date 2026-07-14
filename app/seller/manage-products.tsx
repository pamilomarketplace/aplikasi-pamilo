// app/seller/manage-products.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Mengonsumsi pipa mesin logika seller CRUD terisolasi murni
import { useManageProducts, MerchantProduct } from '@/features/seller/useManageProducts';

export default function ManageProductsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { loading, mutating, myProducts, handleUpsertProduct, handleDeleteProduct } = useManageProducts();

  // STATE INTERNAL PENAMPUNG FORM MODAL MODUL INPUT KIOS
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [formNama, setFormNama] = useState('');
  const [formHarga, setFormHarga] = useState('');
  const [formStok, setFormStok] = useState('');
  const [formDeskripsi, setFormDeskripsi] = useState('');
  const [formKategori, setFormKategori] = useState('');

  const triggerOpenAddModal = () => {
    setSelectedProductId(null);
    setFormNama('');
    setFormHarga('');
    setFormStok('');
    setFormDeskripsi('');
    setFormKategori('');
    setModalVisible(true);
  };

  const triggerOpenEditModal = (item: MerchantProduct) => {
    setSelectedProductId(item.id_produk);
    setFormNama(item.nama_produk);
    setFormHarga(item.harga_produk.toString());
    setFormStok(item.stok_ready_produk.toString());
    setFormDeskripsi(item.deskripsi_produk || '');
    setFormKategori(item.kategori_produk || '');
    setModalVisible(true);
  };

  const handleSaveFormAction = async () => {
    if (!formNama.trim() || !formHarga.trim() || !formStok.trim()) {
      alert('Perhatian: Nama, Harga, dan Stok wajib diisi!');
      return;
    }

    const sukses = await handleUpsertProduct(selectedProductId, {
      nama: formNama,
      harga: parseInt(formHarga) || 0,
      stok: parseInt(formStok) || 0,
      deskripsi: formDeskripsi,
      kategori: formKategori
    });

    if (sukses) setModalVisible(false);
  };

  const renderProductItemKios = ({ item }: { item: MerchantProduct }) => (
    <View style={styles.productRowCard}>
      <View style={styles.avatarProductDummy}>
        <Ionicons name="leaf" size={20} color="#7A6450" />
      </View>
      <View style={styles.infoProductCol}>
        <Text style={styles.prodNameText} numberOfLines={1}>{item.nama_produk}</Text>
        <Text style={styles.prodPriceText}>Rp {item.harga_produk.toLocaleString('id-ID')}</Text>
        <Text style={styles.prodStokText}>Sisa Stok Kios: {item.stok_ready_produk} item</Text>
      </View>
      
      <View style={styles.actionsButtonGroup}>
        <TouchableOpacity style={styles.btnIconEdit} onPress={() => triggerOpenEditModal(item)}>
          <Ionicons name="create-outline" size={16} color="#4A3420" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnIconDelete} onPress={() => handleDeleteProduct(item.id_produk)}>
          <Ionicons name="trash-outline" size={16} color="#C62828" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.mainContainer, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#2E1C0C" />

      {/* HEADER NAVIGASI ETALASE KIOS */}
      <View style={styles.sellerNavBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.navBarTitle}>Manajemen Etalase Kios 🏷️</Text>
        <TouchableOpacity style={styles.btnAddProductIcon} onPress={triggerOpenAddModal}>
          <Ionicons name="add-circle" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerLoad}>
          <ActivityIndicator size="large" color="#7A6450" />
          <Text style={styles.loadText}>Memilah tumpukan katalog produk kios...</Text>
        </View>
      ) : (
        <FlatList
          data={myProducts}
          keyExtractor={(item) => item.id_produk}
          renderItem={renderProductItemKios}
          contentContainerStyle={styles.listPaddingStyle}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyKatalogContainer}>
              <Ionicons name="file-tray-stacked-outline" size={54} color="#C0A995" />
              <Text style={styles.emptyTitle}>Etalase Kios Kosong</Text>
              <Text style={styles.emptySub}>Pedagang belum menggelar komoditas dagangan. Klik tombol tambah di sudut kanan atas untuk menyuntikkan barang pertama Anda!</Text>
            </View>
          }
        />
      )}

      {/* MODAL JALUR FORM INPUT & EDIT DUA FUNGSI */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdropModal}>
          <View style={styles.modalSheetContainer}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitleHeading}>{selectedProductId ? 'Edit Komoditas Kios' : 'Tambah Komoditas Baru'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={22} color="#7A6450" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formScrollBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabelInput}>Nama Komoditas Pasar *</Text>
              <TextInput style={styles.formFieldField} placeholder="Contoh: Cabai Keriting Segar" value={formNama} onChangeText={setFormNama} placeholderTextColor="#A1887F" />

              <Text style={styles.fieldLabelInput}>Harga Produk (Rp) *</Text>
              <TextInput style={styles.formFieldField} placeholder="Contoh: 45000" keyboardType="numeric" value={formHarga} onChangeText={setFormHarga} placeholderTextColor="#A1887F" />

              <Text style={styles.fieldLabelInput}>Stok Siap Jual Kios *</Text>
              <TextInput style={styles.formFieldField} placeholder="Contoh: 50" keyboardType="numeric" value={formStok} onChangeText={setFormStok} placeholderTextColor="#A1887F" />

              <Text style={styles.fieldLabelInput}>Kategori Kelompok</Text>
              <TextInput style={styles.formFieldField} placeholder="Contoh: SAYURAN / DAGING" value={formKategori} onChangeText={setFormKategori} placeholderTextColor="#A1887F" />

              <Text style={styles.fieldLabelInput}>Deskripsi Kualitas Barang</Text>
              <TextInput style={[styles.formFieldField, styles.formFieldTextArea]} placeholder="Tulis rincian kondisi kesegaran komoditas..." value={formDeskripsi} onChangeText={setFormDeskripsi} multiline numberOfLines={3} placeholderTextColor="#A1887F" />

              <TouchableOpacity style={[styles.btnSaveActionExecute, mutating && styles.btnDisabled]} onPress={handleSaveFormAction} disabled={mutating}>
                {mutating ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.textBtnSaveLabel}>Kunci & Gelar di Etalase</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF6F0' },
  sellerNavBar: { backgroundColor: '#2E1C0C', height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, elevation: 4 },
  backBtn: { width: 35, height: 40, justifyContent: 'center' },
  btnAddProductIcon: { width: 35, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  navBarTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  centerLoad: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadText: { fontSize: 12, color: '#7A6450', fontWeight: 'bold' },
  listPaddingStyle: { padding: 14 },

  // 🚀 KUNCI PERBAIKAN: Mengganti borderHeight menjadi borderWidth agar mematuhi aturan ketat tipe data NamedStyles React Native
  productRowCard: { flexDirection: 'row', backgroundColor: '#FFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E0D0C0', marginBottom: 10, alignItems: 'center', elevation: 1 },
  avatarProductDummy: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#FAF6F0', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: '#E0D0C0' },
  infoProductCol: { flex: 1, marginLeft: 12, gap: 2 },
  prodNameText: { fontSize: 13, fontWeight: 'bold', color: '#4A3420' },
  prodPriceText: { fontSize: 12, color: '#E28743', fontWeight: '600' },
  prodStokText: { fontSize: 10, color: '#A1887F', fontWeight: '500' },
  actionsButtonGroup: { flexDirection: 'row', gap: 8 },
  btnIconEdit: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FAF6F0', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: '#E0D0C0' },
  btnIconDelete: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFEBEE', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: '#FFCDD2' },

  backdropModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheetContainer: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '85%' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitleHeading: { fontSize: 14, fontWeight: 'bold', color: '#2E1C0C' },
  formScrollBody: { paddingBottom: 20 },
  fieldLabelInput: { fontSize: 11, fontWeight: 'bold', color: '#7A6450', marginBottom: 6, marginTop: 10 },
  formFieldField: { backgroundColor: '#FAF6F0', borderWidth: 1, borderColor: '#E0D0C0', borderRadius: 10, paddingHorizontal: 12, height: 40, fontSize: 13, color: '#4A3420' },
  formFieldTextArea: { height: 70, textAlignVertical: 'top', paddingTop: 8 },
  btnSaveActionExecute: { backgroundColor: '#E28743', height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginTop: 22, elevation: 1 },
  textBtnSaveLabel: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  btnDisabled: { backgroundColor: '#C0A995' },

  emptyKatalogContainer: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 45, marginTop: 170 },
  emptyTitle: { fontSize: 15, fontWeight: 'bold', color: '#7A6450', marginTop: 12 },
  emptySub: { fontSize: 11, color: '#A1887F', textAlign: 'center', marginTop: 4, lineHeight: 16 }
});