// features/favorit/useFavorit.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { Produk } from '@/features/produk/produkRepository';

export interface ItemFavorit {
  id: string; // Mapped dari id_favorit
  id_produk: string; // Mapped dari produk_id_favorit
  created_at: string;
  produk?: Produk;
}

export const useFavorit = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [favoritItems, setFavoritItems] = useState<ItemFavorit[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchFavorit = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('favorit')
        .select(`*, produk (*)`)
        .eq('user_id_favorit', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const list: ItemFavorit[] = data.map((f: any) => ({
        id: f.id_favorit,
        id_produk: f.produk_id_favorit,
        created_at: f.created_at,
        produk: Array.isArray(f.produk) ? f.produk[0] : f.produk
      }));
      
      setFavoritItems(list);
    } catch (error) {
      console.error('[Favorit Error]', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUserId(data.user.id);
        fetchFavorit(data.user.id);
      } else {
        setLoading(false);
      }
    });
  }, [fetchFavorit]);

  const hapusFavorit = async (idFavorit: string) => {
    if (!currentUserId) return;
    try {
      setFavoritItems(prev => prev.filter(item => item.id !== idFavorit));
      await supabase.from('favorit').delete().eq('id_favorit', idFavorit);
    } catch (err) {
      fetchFavorit(currentUserId);
    }
  };

  return { loading, favoritItems, hapusFavorit, refreshFavorit: () => currentUserId && fetchFavorit(currentUserId) };
};