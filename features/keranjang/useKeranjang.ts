// features/keranjang/useKeranjang.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { Produk } from '@/features/produk/produkRepository';
import { Alert } from 'react-native';

export interface ItemKeranjang {
  id: number;
  pembeli_id: string;
  produk_id: string;
  kuantitas: number;
  varian_terpilih: string | null;
  created_at: string;
  produk?: Produk; 
}

export const useKeranjang = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [isAdding, setIsAdding] = useState<boolean>(false); // State khusus loading saat nambah ke keranjang
  const [cartItems, setCartItems] = useState<ItemKeranjang[]>([]);
  const [totalBelanja, setTotalBelanja] = useState<number>(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchCart = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('keranjang')
        .select(`*, produk (*)`)
        .eq('pembeli_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const items = data as unknown as ItemKeranjang[];
      setCartItems(items);

      const total = items.reduce((acc, item) => {
        const produkDetail = Array.isArray(item.produk) ? item.produk[0] : item.produk;
        const harga = produkDetail?.harga_produk || 0;
        return acc + (harga * item.kuantitas);
      }, 0);
      setTotalBelanja(total);

    } catch (error) {
      console.error('[Keranjang Error]', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUserId(data.user.id);
        fetchCart(data.user.id);
      } else {
        setLoading(false);
      }
    });
  }, [fetchCart]);

  // 🚀 FUNGSI BARU: Menambahkan barang ke keranjang
  const tambahKeKeranjang = async (produkId: string, kuantitasBaru: number = 1, varian: string | null = null) => {
    if (!currentUserId) {
      Alert.alert('Perhatian', 'Gagal memverifikasi identitas pengguna.');
      return;
    }

    setIsAdding(true);
    try {
      // Cek apakah produk dengan varian yang sama sudah ada di keranjang
      const existingItem = cartItems.find(
        item => item.produk_id === produkId && item.varian_terpilih === varian
      );

      if (existingItem) {
        // Jika sudah ada, tinggal update kuantitasnya saja
        const newQty = existingItem.kuantitas + kuantitasBaru;
        const { error } = await supabase.from('keranjang').update({ kuantitas: newQty }).eq('id', existingItem.id);
        if (error) throw error;
      } else {
        // Jika belum ada, insert baris baru sesuai DDL
        const { error } = await supabase.from('keranjang').insert({
          pembeli_id: currentUserId,
          produk_id: produkId,
          kuantitas: kuantitasBaru,
          varian_terpilih: varian
        });
        if (error) throw error;
      }
      
      Alert.alert('Berhasil', 'Produk telah ditambahkan ke keranjang belanja Anda. 🛒');
      fetchCart(currentUserId); // Segarkan data keranjang
    } catch (error: any) {
      Alert.alert('Gagal', 'Tidak dapat menambahkan ke keranjang: ' + error.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateQuantity = async (itemId: number, currentQty: number, mode: 'TAMBAH' | 'KURANG') => {
    if (!currentUserId) return;
    const newQty = mode === 'TAMBAH' ? currentQty + 1 : currentQty - 1;

    if (newQty <= 0) {
      await handleRemoveItem(itemId);
      return;
    }

    try {
      setCartItems(prev => prev.map(item => item.id === itemId ? { ...item, kuantitas: newQty } : item));
      setTotalBelanja(prev => {
        const itemToUpdate = cartItems.find(i => i.id === itemId);
        const produkDetail = Array.isArray(itemToUpdate?.produk) ? itemToUpdate?.produk[0] : itemToUpdate?.produk;
        const harga = produkDetail?.harga_produk || 0;
        return mode === 'TAMBAH' ? prev + harga : prev - harga;
      });

      await supabase.from('keranjang').update({ kuantitas: newQty }).eq('id', itemId);
    } catch (err) {
      fetchCart(currentUserId); 
    }
  };

  const handleRemoveItem = async (itemId: number) => {
    if (!currentUserId) return;
    try {
      setCartItems(prev => prev.filter(item => item.id !== itemId));
      await supabase.from('keranjang').delete().eq('id', itemId);
      fetchCart(currentUserId); 
    } catch (err) {
      console.error(err);
    }
  };

  const refreshCart = () => {
    if (currentUserId) fetchCart(currentUserId);
  };

  return { loading, isAdding, cartItems, totalBelanja, tambahKeKeranjang, handleUpdateQuantity, handleRemoveItem, refreshCart };
};