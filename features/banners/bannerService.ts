// features/banners/bannerService.ts
import { supabase } from '@/utils/supabaseClient';

export const bannerService = {
  async getActiveBanners() {
    console.log('[PAMILO RADAR DB] 🛰️ Mulai mengetuk pintu tabel berita...');

    const { data, error } = await supabase
      .from('berita')
      .select('id_berita, judul_berita, isi_berita, gambar_berita, id_produk_berita, expired_at')
      .eq('is_iklan', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [PAMILO RADAR DB ERROR] Supabase menolak query:', error.message);
      throw new Error(error.message);
    }

    console.log(`[PAMILO RADAR DB SUCCESS] 🎉 Berhasil menarik ${data?.length || 0} baris data iklan mentah.`);

    const sekarang = new Date();
    
    // Proses penyaringan waktu dengan log pelacak eksplisit
    const bannerValid = (data || []).filter(item => {
      if (!item.expired_at) return true; // Aktif selamanya jika null
      
      const expDate = new Date(item.expired_at);
      const isValid = expDate > sekarang;
      
      if (!isValid) {
        console.log(`⚠️ [PAMILO RADAR EXPIRED] Iklan "${item.judul_berita}" DIBAWANGKAN (DIBUANG) karena sudah kedaluwarsa! (Exp: ${item.expired_at}, Jam Sistem: ${sekarang.toISOString()})`);
      }
      return isValid;
    });

    return bannerValid.map(item => {
      const dataMentah = item.gambar_berita ? item.gambar_berita.trim() : '';
      let urlFinal = null;

      if (dataMentah !== '') {
        if (dataMentah.startsWith('http')) {
          urlFinal = dataMentah;
        } else if (dataMentah.startsWith('berita/')) {
          urlFinal = `https://fzqdeztlpslhxwdicvnq.supabase.co/storage/v1/object/public/pamilo-assets/${dataMentah}`;
        } else {
          urlFinal = `https://fzqdeztlpslhxwdicvnq.supabase.co/storage/v1/object/public/pamilo-assets/berita/${dataMentah}`;
        }
      }

      return {
        id_berita: item.id_berita,
        judul_berita: item.judul_berita,
        isi_berita: item.isi_berita,
        id_produk_berita: item.id_produk_berita,
        gambar_berita: urlFinal
      };
    });
  }
};