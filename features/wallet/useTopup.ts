// features/wallet/useTopup.ts
import { useState } from 'react';
import { supabase } from '@/utils/supabaseClient';

interface TopUpDetails {
  nama_bank: string;
  nomor_rekening: string;
  nama_pemilik_rekening: string;
  bukti_struk: string; 
}

export const useTopUp = () => {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const executeTopUp = async (nominal: number, details: TopUpDetails) => {
    setSubmitting(true);
    setError(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user?.id) throw new Error('Sesi user tidak ditemukan. Silakan login kembali.');

      // PIPA A: KONVERSI & UPLOAD BUKTI STRUK KE SUPABASE STORAGE
      const response = await fetch(details.bukti_struk);
      const blob = await response.blob(); 
      
      const fileExt = details.bukti_struk.split('.').pop() || 'jpg';
      const fileName = `${session.user.id}/${Date.now()}.${fileExt}`; 

      const { error: uploadError } = await supabase.storage
        .from('topup_proofs')
        .upload(fileName, blob, { contentType: `image/${fileExt}` });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('topup_proofs')
        .getPublicUrl(fileName);

      // PIPA B: INSERT MURNI KE TABEL public.transaksi_saldo SESUAI DDL
      const { error: insertError } = await supabase
        .from('transaksi_saldo')
        .insert({
          user_id: session.user.id,
          tipe_transaksi: 'TOPUP',
          jumlah: nominal,
          status_transaksi: 'PENDING',
          bukti_transfer_url: publicUrl,
          nama_bank: details.nama_bank,
          nomor_rekening: details.nomor_rekening,
          nama_pemilik_rekening: details.nama_pemilik_rekening,
          arah_mutasi: 'KREDIT' // 🚀 KOREKSI: TopUp adalah Uang Masuk (+)
        });

      if (insertError) throw insertError;

      return { success: true };
    } catch (err: any) {
      console.error('[SUPABASE TOPUP INSERT ERROR]:', err.message);
      setError(err.message || 'Gagal mengirim konfirmasi transaksi.');
      return { success: false };
    } finally {
      setSubmitting(false);
    }
  };

  return { submitting, error, executeTopUp };
};