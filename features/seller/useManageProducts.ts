// features/seller/useManageProducts.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/utils/supabaseClient';

export interface MerchantProduct {
  id_produk: string;
  id_toko_produk: string;
  nama_produk: string;
  harga_produk: number;
  deskripsi_produk: string | null;
  kategori_produk: string | null;
  stok_ready_produk: number;
  foto_produk: string | null;
}

export const useManageProducts = () => {
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [myProducts, setMyProducts] = useState<MerchantProduct[]>([]);
  
  const currentSellerId = useRef<string | null>(null);

  // LOGIKA 1: PENARIK SELURUH ISI KATALOG KIOS
  const fetchMyKiosKatalog = useCallback(async (sellerId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('produk')
        .select('id_produk, id_toko_produk, nama_produk, harga_produk, deskripsi_produk, kategori_produk, stok_ready_produk, foto_produk')
        .eq('id_toko_produk', sellerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setMyProducts(data as MerchantProduct[]);
    } catch (err: any) {
      console.error('[PAMILO SELLER CRUD FETCH ERROR]', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initKiosKatalog = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        currentSellerId.current = user.id;
        await fetchMyKiosKatalog(user.id);
      }
    };
    initKiosKatalog();
  }, [fetchMyKiosKatalog]);

  // LOGIKA 2: OPERASI TAMBAH & EDIT KOMODITAS (UPSERT TACTIC)
  const handleUpsertProduct = async (
    idProdukTarget: string | null,
    payload: { nama: string; harga: number; stok: number; deskripsi: string; kategori: string }
  ) => {
    if (!currentSellerId.current || mutating) return false;

    try {
      setMutating(true);

      const dbPayload: any = {
        id_toko_produk: currentSellerId.current,
        nama_produk: payload.nama,
        harga_produk: payload.harga,
        stok_ready_produk: payload.stok,
        deskripsi_produk: payload.deskripsi,
        kategori_produk: payload.kategori
      };

      if (idProdukTarget) {
        dbPayload.id_produk = idProdukTarget;
      }

      const { error } = await supabase
        .from('produk')
        .upsert(dbPayload, { onConflict: 'id_produk' });

      if (error) throw error;

      Alert.alert('Sukses 🎉', idProdukTarget ? 'Komoditas pasar berhasil diperbarui!' : 'Komoditas baru berhasil diluncurkan ke kios!');
      await fetchMyKiosKatalog(currentSellerId.current);
      return true;
    } catch (err: any) {
      Alert.alert('Gagal Eksekusi', err.message);
      return false;
    } finally {
      setMutating(false);
    }
  };

  // LOGIKA 3: OPERASI HAPUS PRODUK KIOS
  const handleDeleteProduct = async (idProduk: string) => {
    if (!currentSellerId.current) return;

    try {
      const { error } = await supabase
        .from('produk')
        .delete()
        .eq('id_produk', idProduk);

      if (error) throw error;

      setMyProducts((prev) => prev.filter((p) => p.id_produk !== idProduk));
      Alert.alert('Terhapus 🗑️', 'Barang resmi ditarik dari etalase pasar.');
    } catch (err: any) {
      Alert.alert('Gagal Menghapus', err.message);
    }
  };

  return {
    loading,
    mutating,
    myProducts,
    handleUpsertProduct,
    handleDeleteProduct,
    // 🚀 KUNCI PERBAIKAN: Mengganti currentUserId menjadi currentSellerId agar selaras dengan deklarasi Ref atas
    refreshKatalog: () => currentSellerId.current && fetchMyKiosKatalog(currentSellerId.current)
  };
};