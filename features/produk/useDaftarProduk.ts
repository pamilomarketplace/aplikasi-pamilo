// features/produk/useDaftarProduk.ts
import { useState, useEffect, useCallback } from 'react';
import { produkRepository, Produk } from './produkRepository';

export const useDaftarProduk = (kategoriAwal?: string | null) => {
  const [produk, setProduk] = useState<Produk[]>([]);
  const [loadingProduk, setLoadingProduk] = useState<boolean>(true);
  const [errorProduk, setErrorProduk] = useState<string | null>(null);
  
  // State untuk Fitur Pencarian & Kategori Aktif
  const [kataKunciCari, setKataKunciCari] = useState<string>('');
  const [kategoriAktif, setKategoriAktif] = useState<string | null>(kategoriAwal || 'Semua');

  const muatDataProduk = useCallback(async () => {
    try {
      setLoadingProduk(true);
      setErrorProduk(null);

      // Tarik data dari repository dengan membawa parameter kategori dan kata kunci pencarian
      const data = await produkRepository.getDaftarProduk(kategoriAktif, kataKunciCari);
      setProduk(data);

    } catch (err: any) {
      console.error('[GAGAL MEMUAT PRODUK]:', err.message);
      setErrorProduk('Gagal memuat katalog produk. Periksa koneksi Anda.');
    } finally {
      setLoadingProduk(false);
    }
  }, [kategoriAktif, kataKunciCari]);

  // Efek ini akan otomatis berjalan ulang setiap kali Kategori atau Kata Kunci berubah
  useEffect(() => {
    // Kita gunakan setTimeout kecil (debounce) agar tidak memborbardir database 
    // saat user mengetik pencarian dengan sangat cepat
    const delayPencarian = setTimeout(() => {
      muatDataProduk();
    }, 500);

    return () => clearTimeout(delayPencarian);
  }, [muatDataProduk]);

  return { 
    produk, 
    loadingProduk, 
    errorProduk, 
    kataKunciCari, 
    setKataKunciCari, 
    kategoriAktif, 
    setKategoriAktif,
    refreshProduk: muatDataProduk 
  };
};