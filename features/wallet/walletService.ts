// features/wallet/walletService.ts
import { supabase } from '@/utils/supabaseClient';

export const walletService = {
  /**
   * Mengambil saldo dompet pengguna saat ini dari tabel 'users'
   */
  async getBalance(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('saldo')
      .eq('user_id', userId)
      .single();

    if (error) throw new Error(error.message);
    return data?.saldo ?? 0;
  },

  /**
   * Mengambil riwayat mutasi dari tabel 'transaksi_saldo'
   */
  async getTransactionHistory(userId: string) {
    const { data, error } = await supabase
      .from('transaksi_saldo')
      .select('id, tipe_transaksi, jumlah, keterangan, created_at, arah_mutasi, status_transaksi')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Fungsi untuk menambahkan saldo (Top Up)
   */
  async topUpSaldo(userId: string, amount: number) {
    // 1. Ambil saldo terakhir terlebih dahulu
    const currentSaldo = Number(await this.getBalance(userId));
    const newSaldo = currentSaldo + amount;

    // 2. Update saldo utama di tabel users
    const { error: updateError } = await supabase
      .from('users')
      .update({ saldo: newSaldo })
      .eq('user_id', userId);

    if (updateError) throw new Error(updateError.message);

    // 3. Catat riwayatnya ke tabel mutasi transaksi_saldo (Sesuai DDL Check Constraints Anda)
    const { error: logError } = await supabase
      .from('transaksi_saldo')
      .insert([
        { 
          user_id: userId, 
          tipe_transaksi: 'TOPUP', 
          jumlah: amount, 
          status_transaksi: 'BERHASIL', // Disesuaikan dengan Constraint DDL
          arah_mutasi: 'KREDIT',        // Uang Masuk
          saldo_sebelum: currentSaldo,
          saldo_sesudah: newSaldo,
          metadata: { keterangan: 'Top Up Saldo PAMILO-Pay Sukses' }
        }
      ]);

    if (logError) {
       console.error('[TopUp Log Error]', logError);
       throw new Error('Saldo bertambah, tapi gagal mencatat riwayat.');
    }

    return newSaldo;
  }
};