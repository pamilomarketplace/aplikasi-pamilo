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

export interface SavedAddress {
  id: string;
  label_alamat: string;
  alamat_lengkap: string;
  latitude: number;
  longitude: number;
}

export const useCheckout = (mode: string | null, produkIdLangsung: string | null, qtyLangsung: number = 1) => {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>([]);
  const [subtotalHarga, setSubtotalHarga] = useState<number>(0);
  
  const [tokoLat, setTokoLat] = useState<number>(-7.3274); 
  const [tokoLng, setTokoLng] = useState<number>(108.3532);

  // 🚀 STATE BUKU ALAMAT TERSIMPAN
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);

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

  const fetchKoordinatToko = async (idToko: string) => {
    try {
      const { data, error } = await supabase
        .from('toko')
        .select('latitude_toko, longitude_toko')
        .eq('id_toko', idToko)
        .single();
      
      if (!error && data?.latitude_toko && data?.longitude_toko) {
        setTokoLat(Number(data.latitude_toko));
        setTokoLng(Number(data.longitude_toko));
      }
    } catch (err) {}
  };

  const prepareCheckoutData = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      
      // 🚀 TARIK BUKU ALAMAT TERSIMPAN MILIK USER INI
      const { data: addrData } = await supabase.from('user_addresses').select('*').eq('user_id', userId);
      if (addrData) setSavedAddresses(addrData);

      const { data: userData } = await supabase.from('users').select('saldo').eq('user_id', userId).single();
      if (userData) setUserSaldo(userData.saldo || 0);

      const { data: settingsData } = await supabase.from('pengaturan_aplikasi').select('kunci_konfigurasi, nilai_konfigurasi').in('kunci_konfigurasi', ['BIAYA_LAYANAN_TRANSAKSI', 'ONGKIR_PER_KM']);

      if (settingsData) {
        const adminFee = settingsData.find(s => s.kunci_konfigurasi === 'BIAYA_LAYANAN_TRANSAKSI');
        if (adminFee && adminFee.nilai_konfigurasi) setBiayaLayanan(Number(adminFee.nilai_konfigurasi));

        const ongkirFee = settingsData.find(s => s.kunci_konfigurasi === 'ONGKIR_PER_KM');
        if (ongkirFee && ongkirFee.nilai_konfigurasi) setTarifOngkirPerKm(Number(ongkirFee.nilai_konfigurasi));
      }

      if (mode === 'beli_langsung' && produkIdLangsung) {
        const { data, error } = await supabase.from('produk').select('*').eq('id_produk', produkIdLangsung).single();
        if (error) throw error;
        const targetIdToko = data.id_toko_produk; 
        setCheckoutItems([{ id: data.id_produk, produk_id: data.id_produk, nama_produk: data.nama_produk, harga: data.harga_produk, kuantitas: Number(qtyLangsung), foto_produk: data.foto_produk, id_toko: targetIdToko }]);
        setSubtotalHarga(data.harga_produk * Number(qtyLangsung));
        if (targetIdToko) await fetchKoordinatToko(targetIdToko);

      } else {
        const { data, error } = await supabase.from('keranjang').select('*, produk(*)').eq('pembeli_id', userId);
        if (error) throw error;
        const items: CheckoutItem[] = data.map((k: any) => {
          const prod = Array.isArray(k.produk) ? k.produk[0] : k.produk;
          return { id: k.id.toString(), produk_id: k.produk_id, nama_produk: prod.nama_produk, harga: prod.harga_produk, kuantitas: k.kuantitas, foto_produk: prod.foto_produk, id_toko: prod.id_toko_produk };
        });
        setCheckoutItems(items);
        setSubtotalHarga(items.reduce((acc, curr) => acc + (curr.harga * curr.kuantitas), 0));
        if (items.length > 0 && items[0].id_toko) await fetchKoordinatToko(items[0].id_toko);
      }
    } catch (error) {
      console.error('[Checkout ❌]', error);
    } finally {
      setLoading(false);
    }
  }, [mode, produkIdLangsung, qtyLangsung]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUserId(data.user.id);
        prepareCheckoutData(data.user.id);
      } else { setLoading(false); }
    });
  }, [prepareCheckoutData]);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCheckoutItems(prev => {
      const newItems = [...prev];
      const itemIndex = newItems.findIndex(i => i.id === id);
      if (itemIndex > -1) {
        const currentQty = newItems[itemIndex].kuantitas;
        const newQty = Math.max(1, currentQty + delta);
        if (newQty !== currentQty) {
          newItems[itemIndex] = { ...newItems[itemIndex], kuantitas: newQty };
          setSubtotalHarga(newItems.reduce((acc, curr) => acc + (curr.harga * curr.kuantitas), 0));
          if (mode !== 'beli_langsung') supabase.from('keranjang').update({ kuantitas: newQty }).eq('id', id).then();
        }
      }
      return newItems;
    });
  }, [mode]);

  // 🚀 FUNGSI KALKULASI JARAK GLOBAL OSRM 
  const hitungJarakOSRM = async (latTujuan: number, lngTujuan: number) => {
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${tokoLng},${tokoLat};${lngTujuan},${latTujuan}?overview=false`;
      const routeResponse = await fetch(osrmUrl, { headers: { 'User-Agent': 'PamiloApp/1.0' } });
      const routeData = await routeResponse.json();
      let jarakFinalized = 1; 
      if (routeData.code === 'Ok' && routeData.routes && routeData.routes.length > 0) {
        const jarakHasilKm = routeData.routes[0].distance / 1000; 
        jarakFinalized = Math.max(1, Number(jarakHasilKm.toFixed(1)));
      }
      setJarakKm(jarakFinalized);
    } catch (e) { setJarakKm(1); }
  };

  // 🚀 FUNGSI PILIH ALAMAT DARI BUKU TERSIMPAN
  const pilihAlamatTersimpan = async (alamat: SavedAddress) => {
    setIsTranslatingGps(true);
    setLatitude(alamat.latitude);
    setLongitude(alamat.longitude);
    setAlamatInput(alamat.alamat_lengkap);
    setPatokanInput(''); // Kosongkan karena sudah ada di alamat lengkap
    
    // Auto hitung ongkir tanpa buka peta
    await hitungJarakOSRM(alamat.latitude, alamat.longitude);
    setIsTranslatingGps(false);
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
      await hitungJarakOSRM(tempLat, tempLng);
      setLatitude(tempLat);
      setLongitude(tempLng);
      setAlamatInput(teksAlamat || 'Lokasi Peta Terpilih');
      setIsMapVisible(false); 
    } catch (error) { Alert.alert('Terjadi Kesalahan', 'Gagal memproses rute.'); } 
    finally { setIsTranslatingGps(false); }
  };

  const executeOrderCheckout = async (dataPromoTerpakai: any = null, finalTotalBayar: number = totalPembayaran) => {
    if (!currentUserId || checkoutItems.length === 0) return;
    if (!latitude || !longitude || !alamatInput.trim()) return Alert.alert('Alamat Kosong', 'Mohon tentukan titik tujuan Pengantaran Anda.');
    if (metodePembayaran === 'SALDO' && userSaldo < finalTotalBayar) return Alert.alert('Saldo Kurang', 'Saldo PamiloPay tidak cukup.');

    setSubmitting(true);
    try {
      const idTokoTransaksi = checkoutItems[0].id_toko || null;
      const metodePembayaranDB = metodePembayaran === 'SALDO' ? 'SALDO_PAMILO' : 'TUNAI';

      const { data: orderData, error: orderError } = await supabase.from('pesanan').insert({
          pembeli_id: currentUserId, id_toko: idTokoTransaksi, subtotal_produk: subtotalHarga, ongkos_kirim: ongkosKirim,
          potongan_promo: dataPromoTerpakai ? dataPromoTerpakai.nominal : 0, total_pembayaran: finalTotalBayar, status_pesanan: 'DIPROSES',
          metode_pembayaran: metodePembayaranDB, alamat_pengiriman: `${alamatInput.trim()} (Patokan: ${patokanInput.trim() || '-'})`,
          latitude_pengiriman: latitude, longitude_pengiriman: longitude
        }).select('id').single();

      if (orderError) throw orderError;

      const orderItems = checkoutItems.map(item => ({ pesanan_id: orderData.id, produk_id: item.produk_id, kuantitas: item.kuantitas, harga_satuan: item.harga }));
      await supabase.from('item_pesanan').insert(orderItems);

      if (dataPromoTerpakai) {
          await supabase.from('riwayat_pemakaian_promo').insert([{ user_id_pembeli: currentUserId, kode_dipakai: dataPromoTerpakai.kode, sumber_promo: dataPromoTerpakai.sumber, id_transaksi: orderData.id, layanan_transaksi: 'PAMILO_FOOD', nominal_diskon_didapat: dataPromoTerpakai.nominal }]);
          if (dataPromoTerpakai.sumber === 'PAMILO') {
              await supabase.from('promosi_pamilo').update({ kuota_terpakai: (dataPromoTerpakai.dataAsli.kuota_terpakai || 0) + 1 }).eq('id_promo', dataPromoTerpakai.dataAsli.id_promo);
          }
      }

      if (metodePembayaran === 'SALDO') await supabase.from('users').update({ saldo: userSaldo - finalTotalBayar }).eq('user_id', currentUserId);
      if (mode !== 'beli_langsung') await supabase.from('keranjang').delete().eq('pembeli_id', currentUserId);

      router.replace(`/orders/${orderData.id}` as any);
    } catch (error: any) { Alert.alert('Gagal', error.message); } 
    finally { setSubmitting(false); }
  };

  const bukaPeta = async () => { setIsMapVisible(true); try { let { status } = await Location.requestForegroundPermissionsAsync(); if (status !== 'granted') return; let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); setTempLat(loc.coords.latitude); setTempLng(loc.coords.longitude); } catch (e) {} };
  const cariAlamatPeta = async (text: string) => { if(text.trim().length<3){setSearchResults([]);return;} setIsSearching(true); try{ const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&countrycodes=id`, {headers:{'User-Agent':'PamiloApp/1.0'}}); const data = await res.json(); setSearchResults(data); }catch(e){}finally{setIsSearching(false);}};
  const pilihHasilPencarian = (lat: string, lon: string) => { setTempLat(Number(lat)); setTempLng(Number(lon)); setSearchQuery(''); setSearchResults([]); };

  return { 
    loading, submitting, userSaldo, checkoutItems, subtotalHarga, 
    jarakKm, ongkosKirim, biayaLayanan, totalPembayaran, 
    alamatInput, setAlamatInput, patokanInput, setPatokanInput, 
    metodePembayaran, setMetodePembayaran,
    isMapVisible, setIsMapVisible, bukaPeta, tempLat, tempLng, setTempLat, setTempLng,
    konfirmasiLokasiPeta, isTranslatingGps, latitude,
    searchQuery, setSearchQuery, searchResults, setSearchResults, isSearching, cariAlamatPeta, pilihHasilPencarian, 
    executeOrderCheckout, updateQuantity,
    savedAddresses, pilihAlamatTersimpan // 🚀 EKSPOR BUKU ALAMAT
  };
};