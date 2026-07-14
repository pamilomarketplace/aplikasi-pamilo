// features/seller/useSellerDashboard.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/utils/supabaseClient';

export interface TokoData {
  id_toko: string;
  nama_toko: string;
  alamat_toko: string;
  whatsapp_toko: string;
  kategori_toko: string;
  status_toko: 'BUKA' | 'TUTUP';
  rating_toko: number;
  is_verified: boolean;
}

export const useSellerDashboard = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [isSeller, setIsSeller] = useState<boolean | null>(null);
  const [toko, setToko] = useState<TokoData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentSellerId = useRef<string | null>(null);

  const fetchSellerStoreData = useCallback(async (sellerId: string) => {
    try {
      setLoading(true);
      setError(null);

      // 1. Verifikasi Kelayakan Akses Boolean Hybrid is_seller
      const { data: userProfile, error: userErr } = await supabase
        .from('users')
        .select('role, is_seller')
        .eq('user_id', sellerId)
        .maybeSingle();

      if (userErr || !userProfile || (userProfile.is_seller !== true && userProfile.role !== 'SELLER')) {
        setIsSeller(false);
        return;
      }
      setIsSeller(true);

      // 2. 🚀 TARIK DATA DARI TABEL public.toko (Sesuai DDL Acuan Anda)
      const { data: storeProfile, error: storeErr } = await supabase
        .from('toko')
        .select('*')
        .eq('user_id_toko', sellerId)
        .maybeSingle();

      if (storeErr) throw storeErr;
      
      if (storeProfile) {
        setToko(storeProfile as TokoData);
      } else {
        setError('Profil Toko UMKM belum terdaftar di database.');
      }

    } catch (err: any) {
      setError(err.message || 'Gagal memuat sasis data toko.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const bootSeller = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        currentSellerId.current = user.id;
        await fetchSellerStoreData(user.id);
      } else {
        setLoading(false);
      }
    };
    bootSeller();
  }, [fetchSellerStoreData]);

  // 🚀 SAKELAR OPERASIONAL TOKO: Mengubah status_toko antara BUKA atau TUTUP
  const toggleStoreStatus = async () => {
    if (!currentSellerId.current || !toko) return;

    const nextStatus = toko.status_toko === 'BUKA' ? 'TUTUP' : 'BUKA';
    try {
      const { error: updateErr } = await supabase
        .from('toko')
        .update({ status_toko: nextStatus })
        .eq('user_id_toko', currentSellerId.current);

      if (updateErr) throw updateErr;

      await fetchSellerStoreData(currentSellerId.current);
    } catch (err: any) {
      Alert.alert('Gagal Mengubah Status Toko ❌', err.message);
    }
  };

  return {
    loading,
    isSeller,
    toko,
    error,
    toggleStoreStatus,
    refreshDashboard: () => currentSellerId.current && fetchSellerStoreData(currentSellerId.current)
  };
};