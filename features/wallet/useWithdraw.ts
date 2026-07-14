// features/wallet/useWithdraw.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabaseClient';

interface BankAccountData {
  nama_bank: string;
  nomor_rekening: string;
  nama_pemilik: string;
}

export const useWithdraw = () => {
  const [saldo, setSaldo] = useState<number>(0);
  const [bankAccount, setBankAccount] = useState<BankAccountData | null>(null);
  
  // 🚀 FAKTA SOLUSI: State baru untuk mendeteksi penarikan yang masih nyangkut
  const [hasPendingWithdrawal, setHasPendingWithdrawal] = useState<boolean>(false);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWalletAndBankData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user?.id) throw new Error('Sesi tidak valid.');

      // Pipa A: Ambil Saldo Riil Langsung dari tabel users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('saldo')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (userError) throw userError;
      if (userData) {
        setSaldo(userData.saldo || 0);
      }

      // Pipa B: Ambil Rekening Terdaftar (Jika ada)
      const { data: bankData, error: bankError } = await supabase
        .from('user_bank_accounts')
        .select('nama_bank, nomor_rekening, nama_pemilik')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (bankError) throw bankError;
      setBankAccount(bankData as BankAccountData | null);

      // PIPA C (BARU): Cek apakah ada transaksi WITHDRAW yang masih PENDING
      const { data: pendingTx, error: pendingError } = await supabase
        .from('transaksi_saldo')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('tipe_transaksi', 'WITHDRAW')
        .eq('status_transaksi', 'PENDING')
        .limit(1)
        .maybeSingle();
      
      if (pendingError) throw pendingError;
      
      // Jika data ditemukan, kunci formulir penarikan
      setHasPendingWithdrawal(!!pendingTx);

    } catch (err: any) {
      console.error('[SUPABASE FETCH WITHDRAW DATA ERROR]:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletAndBankData();
  }, []);

  const executeWithdraw = async (nominal: number, manualDetails?: BankAccountData) => {
    setSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('Sesi kedaluwarsa.');

      // Pelindung Lapis Kedua (Backend) jika UI berhasil ditembus
      if (hasPendingWithdrawal) {
        throw new Error('Penarikan ditolak. Anda masih memiliki transaksi yang sedang diproses admin.');
      }

      if (nominal > saldo) {
        throw new Error('Saldo PAMILO-Pay Anda tidak mencukupi untuk melakukan penarikan ini.');
      }

      const finalBankName = bankAccount ? bankAccount.nama_bank : manualDetails?.nama_bank;
      const finalAccNumber = bankAccount ? bankAccount.nomor_rekening : manualDetails?.nomor_rekening;
      const finalAccOwner = bankAccount ? bankAccount.nama_pemilik : manualDetails?.nama_pemilik;

      if (!finalBankName || !finalAccNumber || !finalAccOwner) {
        throw new Error('Informasi rekening bank tujuan tidak lengkap.');
      }

      const { error: insertError } = await supabase
        .from('transaksi_saldo')
        .insert({
          user_id: session.user.id,
          tipe_transaksi: 'WITHDRAW',
          jumlah: nominal,
          status_transaksi: 'PENDING',
          nama_bank: finalBankName,
          nomor_rekening: finalAccNumber,
          nama_pemilik_rekening: finalAccOwner,
          arah_mutasi: 'DEBIT' 
        });

      if (insertError) throw insertError;

      return { success: true };
    } catch (err: any) {
      console.error('[SUPABASE WITHDRAW INSERT ERROR]:', err.message);
      setError(err.message || 'Gagal memproses permintaan penarikan.');
      return { success: false };
    } finally {
      setSubmitting(false);
    }
  };

  return { saldo, bankAccount, hasPendingWithdrawal, loading, submitting, error, executeWithdraw };
};