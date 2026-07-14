// app/features/home/useHome.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/utils/supabaseClient';

export interface MarketProductView {
  id_produk: string;
  id_toko_produk: string;
  nama_produk: string;
  harga_produk: number;
  foto_produk: string | null;
  stok_ready_produk: number;
  kategori_produk: string | null;
}

export const useHome = () => {
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [products, setProducts] = useState<MarketProductView[]>([]);
  
  const currentUserId = useRef<string | null>(null);

  const fetchHomeProducts = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('produk_valid_tampil')
        .select('id_produk, id_toko_produk, nama_produk, harga_produk, foto_produk, stok_ready_produk, kategori_produk')
        .limit(20);

      if (error) throw error;
      if (data) setProducts(data as MarketProductView[]);
    } catch (err: any) {
      console.error('[PAMILO HOME FETCH ERROR]', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initHome = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) currentUserId.current = user.id;
      await fetchHomeProducts();
    };
    initHome();
  }, [fetchHomeProducts]);

  const handleAddToCart = async (produkId: string) => {
    if (!currentUserId.current) {
      Alert.alert('Perhatian 🔐', 'Silakan masuk akun terlebih dahulu untuk mulai belanja.');
      return;
    }
    if (addingId) return;

    try {
      setAddingId(produkId);

      const { data: existingItem } = await supabase
        .from('keranjang')
        .select('kuantitas')
        .eq('pembeli_id', currentUserId.current)
        .eq('produk_id', produkId)
        .maybeSingle();

      const qtyBaru = existingItem ? Number(existingItem.kuantitas) + 1 : 1;

      const { error } = await supabase
        .from('keranjang')
        .upsert({
          pembeli_id: currentUserId.current,
          produk_id: produkId,
          kuantitas: qtyBaru,
          varian_terpilih: 'Standar'
        }, { onConflict: 'pembeli_id,produk_id,varian_terpilih' });

      if (error) throw error;
      Alert.alert('Sukses 🧺', 'Komoditas berhasil dimasukkan ke keranjang belanja Anda!');
    } catch (err: any) {
      Alert.alert('Gagal Menambah Keranjang', err.message);
    } finally {
      setAddingId(null);
    }
  };

  return {
    loading,
    addingId,
    products,
    handleAddToCart, // 🚀 PERBAIKAN: Sekarang resmi diekspor keluar hook
    refreshHome: fetchHomeProducts
  };
};