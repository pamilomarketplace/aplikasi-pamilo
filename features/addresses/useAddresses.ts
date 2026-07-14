// features/addresses/useAddresses.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabaseClient';

export interface AddressData {
  id: string;
  label: string;
  nama_penerima: string;
  nomor_telepon: string;
  detail_lengkap: string;
  is_utama: boolean;
  latitude: number;
  longitude: number;
}

export const useAddresses = () => {
  const [addresses, setAddresses] = useState<AddressData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sesi masuk tidak ditemukan.');

      // Menarik data murni sesuai cetak biru DDL user_addresses Tuan Master
      const { data, error: fetchErr } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_utama', { ascending: false });

      if (fetchErr) throw fetchErr;

      // 🔍 PROSES UNPACKING: Membongkar data nama & nomor dari kolom alamat_lengkap
      const parsedAddresses: AddressData[] = (data || []).map((item: any) => {
        let nama = 'Warga PAMILO';
        let telp = '-';
        let detail = item.alamat_lengkap;

        if (item.alamat_lengkap && item.alamat_lengkap.startsWith('[')) {
          const endBracket = item.alamat_lengkap.indexOf(']');
          if (endBracket > -1) {
            const meta = item.alamat_lengkap.substring(1, endBracket);
            const parts = meta.split('|');
            nama = parts[0] || nama;
            telp = parts[1] || telp;
            detail = item.alamat_lengkap.substring(endBracket + 1).trim();
          }
        }

        return {
          id: item.id,
          label: item.label_alamat,
          nama_penerima: nama,
          nomor_telepon: telp,
          detail_lengkap: detail,
          is_utama: item.is_utama,
          latitude: item.latitude,
          longitude: item.longitude
        };
      });

      setAddresses(parsedAddresses);
    } catch (err: any) {
      setError(err.message || 'Gagal menyelaraskan alamat.');
    } finally {
      setLoading(false);
    }
  }, []);

  const setAddressAsUtama = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sesi tidak valid.');

      // 1. Matikan semua status utama milik warga ini
      await supabase
        .from('user_addresses')
        .update({ is_utama: false })
        .eq('user_id', user.id);

      // 2. Kunci alamat terpilih menjadi utama
      const { error: updateErr } = await supabase
        .from('user_addresses')
        .update({ is_utama: true })
        .eq('id', id);

      if (updateErr) throw updateErr;

      await refresh();
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { addresses, loading, error, refresh, setAddressAsUtama };
};