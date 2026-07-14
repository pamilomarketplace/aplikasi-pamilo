// features/orders/useCheckout.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';

export interface CheckoutItem {
  id: string; 
  produk_id: string;
  nama_produk: string;
  harga: number;
  kuantitas: number;
  foto_produk: string | null;
  id_toko?: string;
}

export const useCheckout = (mode: string | null, produkIdLangsung: string | null, qtyLangsung: number = 1) => {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>([]);
  const [subtotalHarga, setSubtotalHarga] = useState<number>(0);
  
  // KOORDINAT TOKO ASLI (Titik Awal Hitungan Kurir)
  const [tokoLat, setTokoLat] = useState<number>(-7.3274); 
  const [tokoLng, setTokoLng] = useState<number>(108.3532);

  const [alamatInput, setAlamatInput] = useState<string>('');
  const [patokanInput, setPatokanInput] = useState<string>('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  
  const [isMapVisible, setIsMapVisible] = useState<boolean>(false);
  const [tempLat, setTempLat] = useState<number>(-7.3274); 
  const [tempLng, setTempLng] = useState<number>(108.3532);
  const [isTranslatingGps, setIsTranslatingGps] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const [metodePembayaran, setMetodePembayaran] = useState<'TUNAI' | 'SALDO'>('TUNAI');
  const [userSaldo, setUserSaldo] = useState<number>(0);

  const [biayaLayanan, setBiayaLayanan] = useState<number>(0);
  const [tarifOngkirPerKm, setTarifOngkirPerKm] = useState<number>(2500); 
  const [jarakKm, setJarakKm] = useState<number>(0); 
  
  const ongkosKirim = jarakKm * tarifOngkirPerKm;
  const totalPembayaran = subtotalHarga + ongkosKirim + biayaLayanan;

  // 🚀 FUNGSI PENCARI KOORDINAT TOKO
  const fetchKoordinatToko = async (idToko: string) => {
    try {
      console.log(`[Checkout 📡] Menganalisis Titik Jemput untuk Toko ID: ${idToko}`);
      
      const { data, error } = await supabase
        .from('toko')
        .select('latitude_toko, longitude_toko')
        .eq('id_toko', idToko)
        .single();
      
      if (error) {
        console.error('[Checkout ❌] Gagal menarik koordinat toko dari database:', error.message);
        return;
      }

      if (data?.latitude_toko && data?.longitude_toko) {
        console.log(`[Checkout ✅] Koordinat Toko Terkunci di: ${data.latitude_toko}, ${data.longitude_toko}`);
        setTokoLat(Number(data.latitude_toko));
        setTokoLng(Number(data.longitude_toko));
      } else {
        console.warn('[Checkout ⚠️] Pemilik toko ini belum mengatur kordinat GPS di dasbor mereka!');
      }
    } catch (err) {
      console.error('[Checkout ❌] Terjadi kesalahan fatal pada mesin GPS toko:', err);
    }
  };

  const prepareCheckoutData = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.from('users').select('saldo').eq('user_id', userId).single();
      if (userData) setUserSaldo(userData.saldo || 0);

      const { data: settingsData } = await supabase
        .from('pengaturan_aplikasi')
        .select('kunci_konfigurasi, nilai_konfigurasi')
        .in('kunci_konfigurasi', ['BIAYA_LAYANAN_TRANSAKSI', 'ONGKIR_PER_KM']);

      if (settingsData) {
        const adminFee = settingsData.find(s => s.kunci_konfigurasi === 'BIAYA_LAYANAN_TRANSAKSI');
        if (adminFee && adminFee.nilai_konfigurasi) setBiayaLayanan(Number(adminFee.nilai_konfigurasi));

        const ongkirFee = settingsData.find(s => s.kunci_konfigurasi === 'ONGKIR_PER_KM');
        if (ongkirFee && ongkirFee.nilai_konfigurasi) setTarifOngkirPerKm(Number(ongkirFee.nilai_konfigurasi));
      }

      if (mode === 'beli_langsung' && produkIdLangsung) {
        const { data, error } = await supabase.from('produk').select('*').eq('id_produk', produkIdLangsung).single();
        if (error) throw error;
        
        // Menggunakan id_toko_produk sesuai DDL
        const targetIdToko = data.id_toko_produk; 

        setCheckoutItems([{
          id: data.id_produk, produk_id: data.id_produk, nama_produk: data.nama_produk,
          harga: data.harga_produk, kuantitas: Number(qtyLangsung), foto_produk: data.foto_produk,
          id_toko: targetIdToko 
        }]);
        setSubtotalHarga(data.harga_produk * Number(qtyLangsung));

        if (targetIdToko) {
          await fetchKoordinatToko(targetIdToko);
        }

      } else {
        const { data, error } = await supabase.from('keranjang').select('*, produk(*)').eq('pembeli_id', userId);
        if (error) throw error;
        
        const items: CheckoutItem[] = data.map((k: any) => {
          const prod = Array.isArray(k.produk) ? k.produk[0] : k.produk;
          const targetIdToko = prod.id_toko_produk; 
          return {
            id: k.id.toString(), produk_id: k.produk_id, nama_produk: prod.nama_produk,
            harga: prod.harga_produk, kuantitas: k.kuantitas, foto_produk: prod.foto_produk,
            id_toko: targetIdToko 
          };
        });
        
        setCheckoutItems(items);
        setSubtotalHarga(items.reduce((acc, curr) => acc + (curr.harga * curr.kuantitas), 0));

        if (items.length > 0 && items[0].id_toko) {
          await fetchKoordinatToko(items[0].id_toko);
        }
      }
    } catch (error) {
      console.error('[Checkout ❌] Gagal mempersiapkan data checkout:', error);
    } finally {
      setLoading(false);
    }
  }, [mode, produkIdLangsung, qtyLangsung]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUserId(data.user.id);
        prepareCheckoutData(data.user.id);
      } else {
        setLoading(false);
      }
    });
  }, [prepareCheckoutData]);

  const bukaPeta = async () => {
    setIsMapVisible(true); 
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setTempLat(location.coords.latitude);
      setTempLng(location.coords.longitude);
    } catch (error) {
      console.log('Gagal mencari GPS awal');
    }
  };

  const cariAlamatPeta = async (text: string) => {
    if (text.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&countrycodes=id`,
        { headers: { 'User-Agent': 'PamiloApp/1.0', 'Accept-Language': 'id-ID' } }
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.log('Search API error', error);
    } finally {
      setIsSearching(false);
    }
  };

  const pilihHasilPencarian = (lat: string, lon: string) => {
    setTempLat(Number(lat));
    setTempLng(Number(lon));
    setSearchQuery(''); 
    setSearchResults([]); 
  };

  const konfirmasiLokasiPeta = async () => {
    setIsTranslatingGps(true);
    try {
      const [geocode] = await Location.reverseGeocodeAsync({ latitude: tempLat, longitude: tempLng });
      let teksAlamat = '';
      if (geocode) {
        const bagianAlamat = [geocode.street, geocode.district, geocode.subregion, geocode.city];
        teksAlamat = bagianAlamat.filter(Boolean).join(', ');
      }

      console.log(`[Hitung Rute 🛣️] Dari TOKO: ${tokoLat}, ${tokoLng} | Menuju PEMBELI: ${tempLat}, ${tempLng}`);
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${tokoLng},${tokoLat};${tempLng},${tempLat}?overview=false`;
      
      const routeResponse = await fetch(osrmUrl, { headers: { 'User-Agent': 'PamiloApp/1.0' } });
      const routeData = await routeResponse.json();

      let jarakFinalized = 1; 

      if (routeData.code === 'Ok' && routeData.routes && routeData.routes.length > 0) {
        const jarakMeter = routeData.routes[0].distance; 
        const jarakHasilKm = jarakMeter / 1000; 
        jarakFinalized = jarakHasilKm < 1 ? 1 : Number(jarakHasilKm.toFixed(1));
        console.log(`[Hitung Rute ✅] OSRM Sukses. Jarak aktual: ${jarakFinalized} KM`);
      } else {
        console.log('[Hitung Rute ⚠️] OSRM gagal menghitung rute, batas minimal 1 Km diterapkan.');
      }

      setJarakKm(jarakFinalized);
      setLatitude(tempLat);
      setLongitude(tempLng);
      setAlamatInput(teksAlamat || 'Lokasi Peta Terpilih');
      setIsMapVisible(false); 
    } catch (error) {
      console.error('Gagal kalkulasi rute:', error);
      Alert.alert('Terjadi Kesalahan', 'Gagal memproses hitungan rute jalan.');
    } finally {
      setIsTranslatingGps(false);
    }
  };

  const executeOrderCheckout = async () => {
    if (!currentUserId || checkoutItems.length === 0) return;
    if (!latitude || !longitude || !alamatInput.trim()) {
      Alert.alert('Alamat Kosong', 'Mohon ketuk kolom "Lokasi Tujuan Pengantaran" untuk menentukan titik rumah Anda di Peta.');
      return;
    }
    
    // Validasi pencegahan di awal (Uang kurang tidak boleh pesan)
    if (metodePembayaran === 'SALDO' && userSaldo < totalPembayaran) {
      Alert.alert('Saldo Tidak Cukup', 'Saldo Dompet PAMILO Anda tidak mencukupi untuk melakukan transaksi ini.');
      return;
    }

    setSubmitting(true);
    try {
      const idTokoTransaksi = checkoutItems[0].id_toko || null;
      const metodePembayaranDB = metodePembayaran === 'SALDO' ? 'SALDO_PAMILO' : 'TUNAI';

      const { data: orderData, error: orderError } = await supabase
        .from('pesanan')
        .insert({
          pembeli_id: currentUserId, 
          id_toko: idTokoTransaksi, 
          subtotal_produk: subtotalHarga, 
          ongkos_kirim: ongkosKirim,
          total_pembayaran: totalPembayaran, 
          status_pesanan: 'DIPROSES',
          metode_pembayaran: metodePembayaranDB,
          alamat_pengiriman: `${alamatInput.trim()} (Patokan: ${patokanInput.trim() || '-'})`,
          
          // 🚀 FIX: Menyimpan Koordinat Tujuan ke Database
          latitude_pengiriman: latitude,
          longitude_pengiriman: longitude
        })
        .select('id').single();

      if (orderError) throw orderError;

      const orderItems = checkoutItems.map(item => ({
        pesanan_id: orderData.id, 
        produk_id: item.produk_id, 
        kuantitas: item.kuantitas, 
        harga_satuan: item.harga
      }));
      await supabase.from('item_pesanan').insert(orderItems);

      // 🔐 SISTEM ESCROW: Tahan/Potong Saldo Pembeli di Awal
      if (metodePembayaran === 'SALDO') {
        await supabase.from('users').update({ saldo: userSaldo - totalPembayaran }).eq('user_id', currentUserId);
      }

      if (mode !== 'beli_langsung') {
        await supabase.from('keranjang').delete().eq('pembeli_id', currentUserId);
      }

      // Navigasi langsung ke nota tanpa Alert tambahan
      router.replace(`/orders/${orderData.id}` as any);

    } catch (error: any) {
      console.error('[Checkout ❌] Gagal Insert Database:', error);
      Alert.alert('Gagal Membayar', error.message || 'Terjadi kesalahan saat memproses pesanan.');
    } finally {
      setSubmitting(false);
    }
  };

  return { 
    loading, submitting, userSaldo, checkoutItems, subtotalHarga, 
    jarakKm, ongkosKirim, biayaLayanan, totalPembayaran, 
    alamatInput, setAlamatInput, patokanInput, setPatokanInput, 
    metodePembayaran, setMetodePembayaran,
    isMapVisible, setIsMapVisible, bukaPeta, tempLat, tempLng, setTempLat, setTempLng,
    konfirmasiLokasiPeta, isTranslatingGps, latitude,
    searchQuery, setSearchQuery, searchResults, setSearchResults, isSearching, cariAlamatPeta, pilihHasilPencarian, 
    executeOrderCheckout 
  };
};