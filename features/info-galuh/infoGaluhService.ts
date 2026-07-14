// features/info-galuh/infoGaluhService.ts
import { supabase } from '@/utils/supabaseClient';

export const infoGaluhService = {
  /**
   * Mengambil semua sasis data utama Info Galuh secara paralel
   */
  async getInfoGaluhDashboardData() {
    const [resBeritaWeb, resBeritaGaluh, resLoker, resWisata] = await Promise.all([
      supabase.from('berita_website').select('*').eq('status', 'published').order('created_at', { ascending: false }).limit(5),
      supabase.from('berita_galuh').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('loker_galuh').select('*').eq('is_valid', true).order('created_at', { ascending: false }),
      supabase.from('wisata_galuh').select('*').order('nama_destinasi', { ascending: true })
    ]);

    // Handle error jika ada salah satu yang gagal
    if (resBeritaWeb.error) throw new Error(resBeritaWeb.error.message);
    if (resBeritaGaluh.error) throw new Error(resBeritaGaluh.error.message);
    if (resLoker.error) throw new Error(resLoker.error.message);
    if (resWisata.error) throw new Error(resWisata.error.message);

    return {
      bannerHighlights: (resBeritaWeb.data || []).map((b: any) => ({
        id_berita: b.id,
        judul_berita: b.judul,
        isi_berita: b.konten,
        gambar_berita: b.gambar_thumbnail
      })),
      beritaList: (resBeritaGaluh.data || []).map((b: any) => ({
        id_berita: b.id,
        judul_berita: b.judul,
        isi_berita: b.deskripsi_pendek,
        tanggal_tayang: b.tanggal_tayang,
        tipe_ikon: b.tipe_ikon,
        warna_tema: b.warna_tema,
        created_at: b.created_at
      })),
      lokerList: (resLoker.data || []).map((l: any) => ({
        id: l.id,
        judul_loker: l.posisi,
        perusahaan: l.nama_toko_perusahaan,
        deskripsi_loker: l.persyaratan,
        no_whatsapp: l.kontak_whatsapp
      })),
      wisataList: (resWisata.data || []).map((w: any) => ({
        id: w.id,
        nama_destinasi: w.nama_destinasi,
        kategori: w.zona_wilayah,
        deskripsi: w.deskripsi,
        gambar_url: w.link_foto_url,
        lat: w.latitude_lokasi,
        lng: w.longitude_lokasi
      }))
    };
  },

  /**
   * Mengambil kontak darurat berdasarkan nama kecamatan
   */
  async getEmergencyContacts(kecamatan: string) {
    const { data, error } = await supabase
      .from('darurat_galuh')
      .select('*')
      .eq('kecamatan', kecamatan.trim());

    if (error) throw new Error(error.message);
    return data || [];
  }
};