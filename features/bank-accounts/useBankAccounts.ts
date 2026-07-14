// app/features/bank-accounts/useBankAccounts.ts
import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/utils/supabaseClient';

export const useBankAccounts = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);

  const [namaBank, setNamaBank] = useState('');
  const [noRekening, setNoRekening] = useState('');
  const [namaPemilik, setNamaPemilik] = useState('');

  // Fungsi penarik data rekening dari tabel induk DDL user_bank_accounts
  const fetchBankAccount = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_bank_accounts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setNamaBank(data.nama_bank);
        setNoRekening(data.nomor_rekening);
        setNamaPemilik(data.nama_pemilik);
        setHasAccount(true);
      }
    } catch (err: any) {
      Alert.alert('Gagal Memuat Data', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBankAccount();
  }, [fetchBankAccount]);

  // Fungsi eksekusi penyimpanan data via jalur upsert ke database
  const handleSaveBank = async () => {
    if (!namaBank.trim() || !noRekening.trim() || !namaPemilik.trim()) {
      Alert.alert('Perhatian', 'Seluruh kolom rekening wajib diisi Tuan Master!');
      return { success: false };
    }

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sesi terputus, silakan login kembali.');

      const { error } = await supabase
        .from('user_bank_accounts')
        .upsert({
          user_id: user.id,
          nama_bank: namaBank.trim(),
          nomor_rekening: noRekening.trim(),
          nama_pemilik: namaPemilik.trim(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;
      
      Alert.alert('Sukses 💳', 'Informasi rekening bank komisi berhasil dikunci.');
      setHasAccount(true);
      return { success: true };
    } catch (err: any) {
      Alert.alert('Gagal Mengunci Rekening', err.message);
      return { success: false };
    } finally {
      setSubmitting(false);
    }
  };

  return {
    loading,
    submitting,
    hasAccount,
    namaBank,
    setNamaBank,
    noRekening,
    setNoRekening,
    namaPemilik,
    setNamaPemilik,
    handleSaveBank,
    refresh: fetchBankAccount
  };
};