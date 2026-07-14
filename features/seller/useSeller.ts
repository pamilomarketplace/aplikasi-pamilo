// features/seller/useSeller.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/utils/supabaseClient';

export interface ProductItem {
  id: string;
  nama: string;
  harga: number;
  tipe: 'FOOD' | 'MART' | 'SERVICE';
  deskripsi: string;
  foto: string | null;
  varian: string | null;
}

export const useSeller = () => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);

  // State Form Input Pengisian Lapak
  const [nama, setNama] = useState<string>('');
  const [harga, setHarga] = useState<string>('');
  const [tipe, setTipe] = useState<'FOOD' | 'MART' | 'SERVICE'>('FOOD');
  const [deskripsi, setDeskripsi] = useState<string>('');
  const [fotoUrl, setFotoUrl] = useState<string>(''); 
  const [varian, setVarian] = useState<string>(''); // 🌟 Kolom baru pilihan_varian

  // State Pencarian Produk Lokal (Anti-Delay Net)
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [realTokoId, setRealTokoId] = useState<string | null>(null);

  // Inisialisasi Toko Pedagang
  const initializeSellerStore = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setIsLoading(false);
        return;
      }

      const { data: store, error: storeErr } = await supabase
        .from('toko')
        .select('id_toko')
        .eq('user_id_toko', session.user.id)
        .maybeSingle();

      if (storeErr) throw storeErr;

      if (store) {
        setRealTokoId(store.id_toko);
        await fetchProducts(store.id_toko);
      } else {
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('[INITIALIZE STORE ERROR]:', err.message);
      setIsLoading(false);
    }
  }, []);

  // Tarik Data Lapak Beserta Varian & Foto
  const fetchProducts = async (tokoId: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('produk') 
        .select('id_produk, nama_produk, harga_produk, kategori_produk, deskripsi_produk, foto_produk, pilihan_varian')
        .eq('id_toko_produk', tokoId) 
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const mappedProducts: ProductItem[] = data.map((item) => ({
          id: item.id_produk,
          nama: item.nama_produk,
          harga: Number(item.harga_produk),
          tipe: (item.kategori_produk || 'FOOD') as 'FOOD' | 'MART' | 'SERVICE',
          deskripsi: item.deskripsi_produk || '',
          foto: item.foto_produk || null,
          varian: item.pilihan_varian || null
        }));
        setProducts(mappedProducts);
      }
    } catch (err: any) {
      console.error('[FETCH SELLER PRODUCTS ERROR]:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initializeSellerStore();
  }, [initializeSellerStore]);

  // 🌟 ENGINE OPERASI FITUR BUCKET STORAGE UNTUK FOTO PRODUK
  const handlePickAndUploadImage = async () => {
    if (!realTokoId) {
      Alert.alert('Akses Ditolak ❌', 'ID Lapak Toko belum tersinkronisasi.');
      return;
    }

    try {
      // 1. Minta Izin Akses Galeri HP Warga
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Izin Ditolak ⚠️', 'Aplikasi memerlukan akses galeri untuk mengunggah foto produk.');
        return;
      }

      // 2. Buka Galeri Tampilan Asli
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1], // Kotak sempurna premium untuk e-commerce
        quality: 0.6,   // Kompresi optimal biar hemat kuota database
      });

      if (pickerResult.canceled || !pickerResult.assets?.[0]?.uri) return;

      setIsUploadingImage(true);
      const sourceUri = pickerResult.assets[0].uri;

      // 3. Konversi File Path URI lokal menjadi Blob binary data untuk Supabase
      const response = await fetch(sourceUri);
      const fileBlob = await response.blob();

      // 4. Susun nama file unik di dalam folder ID Toko masing-masing
      const ekstensiFile = sourceUri.split('.').pop() || 'jpg';
      const namaFileUnik = `${realTokoId}/${Date.now()}.${ekstensiFile}`;

      // 5. Dorong file masuk ke dalam BUCKET 'produk' Supabase
      const { error: uploadErr } = await supabase.storage
        .from('produk')
        .upload(namaFileUnik, fileBlob, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadErr) throw uploadErr;

      // 6. Tarik Link Publik Gambar Awannya
      const { data: urlData } = supabase.storage
        .from('produk')
        .getPublicUrl(namaFileUnik);

      setFotoUrl(urlData.publicUrl);
      Alert.alert('Berhasil 📸', 'Foto menu berhasil diunggah ke cloud bucket PAMILO!');

    } catch (err: any) {
      Alert.alert('Gagal Mengunggah Gambar ❌', err.message);
    } finally {
      setIsUploadingImage(false);
    }
  };

  // 🌟 MESIN PENCARIAN PRODUK LOKAL (MEMOIZED UNTUK KECEPATAN MAKSIMAL)
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase().trim();
    return products.filter((item) => 
      item.nama.toLowerCase().includes(query) || 
      item.deskripsi.toLowerCase().includes(query) ||
      (item.varian && item.varian.toLowerCase().includes(query))
    );
  }, [products, searchQuery]);

  const handleEditPress = (item: ProductItem) => {
    setEditingProductId(item.id);
    setNama(item.nama);
    setHarga(item.harga.toString());
    setTipe(item.tipe);
    setDeskripsi(item.deskripsi);
    setFotoUrl(item.foto || '');
    setVarian(item.varian || '');
  };

  const handleCancelEdit = () => {
    setEditingProductId(null);
    setNama('');
    setHarga('');
    setTipe('FOOD');
    setDeskripsi('');
    setFotoUrl('');
    setVarian('');
  };

  const handleAddProduct = async () => {
    if (!nama.trim() || !harga.trim()) {
      Alert.alert('Data Belum Lengkap ⚠️', 'Nama menu dan harga jual wajib diisi Tuan Master.');
      return;
    }

    const targetTokoId = realTokoId;
    if (!targetTokoId) return;

    try {
      setIsProcessing(true);

      const payloadData = {
        nama_produk: nama.trim(),
        harga_produk: parseInt(harga, 10),
        kategori_produk: tipe,
        deskripsi_produk: deskripsi.trim(),
        foto_produk: fotoUrl.trim() || null,
        pilihan_varian: varian.trim() || null // Menyuntikkan string varian
      };

      if (editingProductId) {
        const { error } = await supabase
          .from('produk')
          .update(payloadData)
          .eq('id_produk', editingProductId);

        if (error) throw error;
        Alert.alert('Sukses Diperbarui! ✨', `Data menu "${nama}" berhasil diubah.`);
      } else {
        const { error } = await supabase
          .from('produk')
          .insert({
            id_toko_produk: targetTokoId,
            ...payloadData
          });

        if (error) throw error;
        Alert.alert('Sukses Ditayangkan! 🎉', `Menu "${nama}" sekarang sudah bisa dibeli.`);
      }

      handleCancelEdit();
      await fetchProducts(targetTokoId);
    } catch (err: any) {
      Alert.alert('Gagal Memproses Menu ❌', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    Alert.alert(
      'Hapus Menu Lapak? 🗑️',
      'Apakah Anda yakin ingin menurunkan menu ini dari aplikasi?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsProcessing(true);
              const { error } = await supabase
                .from('produk')
                .delete()
                .eq('id_produk', productId);

              if (error) throw error;

              Alert.alert('Berhasil 🧼', 'Menu terpilih telah dihapus.');
              if (realTokoId) await fetchProducts(realTokoId);
              if (editingProductId === productId) handleCancelEdit();
            } catch (err: any) {
              Alert.alert('Gagal Menghapus Menu', err.message);
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  return {
    products: filteredProducts, // 🚀 Menyuntikkan array hasil filter pencarian ke visual
    rawProductsCount: products.length,
    isLoading,
    isProcessing,
    isUploadingImage,
    nama, setNama,
    harga, setHarga,
    tipe, setTipe,
    deskripsi, setDeskripsi,
    fotoUrl, setFotoUrl,
    varian, setVarian,
    searchQuery, setSearchQuery,
    editingProductId,
    handleEditPress,
    handleCancelEdit,
    handlePickAndUploadImage,
    refresh: () => realTokoId && fetchProducts(realTokoId),
    handleAddProduct,
    handleDeleteProduct,
  };
};