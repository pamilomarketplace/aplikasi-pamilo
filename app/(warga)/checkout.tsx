// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, StatusBar, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, TextInput, Vibration, DeviceEventEmitter
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';

import { supabase } from '@/supabaseConfig';

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  
  const [loadingPay, setLoadingPay] = useState(false);
  const [loadingInitialData, setLoadingInitialData] = useState(true);

  const params = useLocalSearchParams();
  const total_harga = params.total_harga;
  const subtotal = total_harga ? parseInt(total_harga as string) : 0;
  
  const [pilarLayananTarget, setPilarLayananTarget] = useState(params.pilar_layanan as string || 'MART');
  const [isJasa, setIsJasa] = useState(params.pilar_layanan === 'SERVIS');

  const selectedCartIds = params.selected_cart_ids ? JSON.parse(params.selected_cart_ids as string) : [];
  const [validatedItems, setValidatedItems] = useState<any[]>([]);

  const [jarakAktualKm, setJarakAktualKm] = useState(0);
  const [tarifPerKm, setTarifPerKm] = useState(2500);
  const [ongkosKirimDinamis, setOngkosKirimDinamis] = useState(0);
  const [persenAdminRahasia, setPersenAdminRahasia] = useState(0.10);
  const [idPenjualMitra, setIdPenjualMitra] = useState<string | null>(null);

  const [detailTokoGlobal, setDetailTokoGlobal] = useState<{nama: string, alamat: string} | null>(null);

  // 🔥 SUNTIKAN TURBO FINTECH: Nilai default pengaman sebelum sedot data dari konsol admin
  const [biayaAdminBelanja, setBiayaAdminBelanja] = useState(1000); 
  const [metodeBayar, setMetodeBayar] = useState<'COD' | 'SALDO'>('COD');
  const [namaPembeli, setNamaPembeli] = useState("Memuat nama...");
  const [saldoWarga, setSaldoWarga] = useState(0);

  const [alamatKirim, setAlamatKirim] = useState("");
  const [rekomendasiAlamat, setRekomendasiAlamat] = useState<any[]>([]);
  const [loadingPencarian, setLoadingPencarian] = useState(false);
  
  const [koordinatPin, setKoordinatPin] = useState({ latitude: -7.3274, longitude: 108.3543 });
  const [koordinatToko, setKoordinatToko] = useState({ latitude: -7.3262, longitude: 108.3541 });
  const [ruteJalan, setRuteJalan] = useState<{latitude: number, longitude: number}[]>([]);

  const [kodeVoucherInput, setKodeVoucherInput] = useState('');
  const [loadingVoucher, setLoadingVoucher] = useState(false);
  const [diskonPotonganHarga, setDiskonPotonganHarga] = useState(0);
  const [infoPromoTerpasang, setInfoPromoTerpasang] = useState<string | null>(null);
  const [idPromoDatabase, setIdPromoDatabase] = useState<string | null>(null);

  const fetchSaldoTerkini = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      
      const { data: dataSaldo } = await supabase
        .from('users')
        .select('saldo')
        .eq('user_id', session.user.id)
        .maybeSingle();
        
      if (dataSaldo) setSaldoWarga(Number(dataSaldo.saldo) || 0);
    } catch (e) { console.log(e); }
  };

  useFocusEffect(useCallback(() => { fetchSaldoTerkini(); }, []));

  const periksaPromoMinimalBelanjaOtomatis = async (idSeller: string, subtotalBelanja: number) => {
    try {
      const { data: promoData, error } = await supabase
        .from('promosi_toko')
        .select('*')
        .eq('id_toko_promo', idSeller)
        .eq('jenis_promo', 'MIN_BELANJA')
        .lte('minimal_belanja', subtotalBelanja) 
        .gt('kuota_promo', 0)
        .order('nilai_potongan', { ascending: false }) 
        .limit(1)
        .maybeSingle();

      if (!error && promoData) {
        let hitungPotongan = 0;
        if (promoData.tipe_potongan === 'NOMINAL') {
          hitungPotongan = parseInt(promoData.nilai_potongan);
        } else {
          hitungPotongan = Math.round(subtotalBelanja * (parseInt(promoData.nilai_potongan) / 100));
        }

        setDiskonPotonganHarga(hitungPotongan);
        setIdPromoDatabase(promoData.id);
        setInfoPromoTerpasang(`🎉 Promo Otomatis: Potongan tagihan Rp ${hitungPotongan.toLocaleString('id-ID')} karena transaksi di atas Rp ${parseInt(promoData.minimal_belanja).toLocaleString('id-ID')}`);
        Vibration.vibrate(50);
      }
    } catch (err) { console.log("Sasis pengecekan auto-promo macet:", err); }
  };

  const handleTerapkanKuponVoucherManual = async () => {
    if (!kodeVoucherInput.trim()) return Alert.alert("Input Kosong", "Ketik kode kupon voucher terlebih dahulu, Tuan.");
    if (!idPenjualMitra) return;

    try {
      let uratKupon = kodeVoucherInput.trim().toUpperCase();
      let hitungPotongan = 0;
      setLoadingVoucher(true);

      const { data: voucherData, error } = await supabase
        .from('promosi_toko')
        .select('*')
        .eq('id_toko_promo', idPenjualMitra)
        .eq('jenis_promo', 'VOUCHER_KODE')
        .eq('kode_promo', uratKupon)
        .gt('kuota_promo', 0)
        .maybeSingle();

      if (error || !voucherData) {
        setLoadingVoucher(false);
        return Alert.alert("Kupon Tidak Sah ❌", "Kode kupon salah atau kuota promonya sudah habis.");
      }

      if (subtotal < parseInt(voucherData.minimal_belanja)) {
        setLoadingVoucher(false);
        return Alert.alert("Syarat Kurang 🔒", `Minimal belanja/jasa untuk menggunakan kupon ini adalah Rp ${parseInt(voucherData.minimal_belanja).toLocaleString('id-ID')}.`);
      }

      if (voucherData.tipe_potongan === 'NOMINAL') {
        hitungPotongan = parseInt(voucherData.nilai_potongan);
      } else {
        hitungPotongan = Math.round(subtotal * (parseInt(voucherData.nilai_potongan) / 100));
      }

      setDiskonPotonganHarga(hitungPotongan);
      setIdPromoDatabase(voucherData.id);
      setInfoPromoTerpasang(`🎫 Kupon Terpasang: Sukses memotong tagihan sebesar Rp ${hitungPotongan.toLocaleString('id-ID')}!`);
      Alert.alert("Kupon Berhasil! 🎉", `Voucher "${uratKupon}" berhasil dipasang.`);
      Vibration.vibrate([0, 100]);

    } catch (err) { Alert.alert("Eror", "Gangguan pipa data voucher."); } 
    finally { setLoadingVoucher(false); }
  };

  const dapatkanRuteOSRM = async (latToko: number, lngToko: number, latUser: number, lngUser: number, hargaPerKm: number, minOngkirApp: number = 5000) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${lngToko},${latToko};${lngUser},${latUser}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const jarakKm = route.distance / 1000;
        const jarakDibulatkan = Math.round(jarakKm * 10) / 10;
        setJarakAktualKm(jarakDibulatkan);

        const hitungOngkirFinal = Math.round(jarakDibulatkan * hargaPerKm);
        setOngkosKirimDinamis(hitungOngkirFinal < minOngkirApp ? minOngkirApp : hitungOngkirFinal);

        setRuteJalan(route.geometry.coordinates.map((coord: number[]) => ({
          latitude: coord[1],
          longitude: coord[0]
        })));

        mapRef.current?.fitToCoordinates([{latitude: latToko, longitude: lngToko}, {latitude: latUser, longitude: lngUser}], { 
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true 
        });
        return true;
      }
      return false;
    } catch (error) { return false; }
  };

  const kalibrasiUlangOngkirDinamis = async (latUser: number, lngUser: number, idSeller: string | null) => {
    try {
      if (!idSeller) return;
      const { data: dataToko } = await supabase.from('toko').select('nama_toko, alamat_toko, latitude_toko, longitude_toko').eq('id_toko', idSeller).maybeSingle();
      const { data: appConfig } = await supabase.from('pengaturan_aplikasi').select('kunci_konfigurasi, nilai_konfigurasi');

      let hargaPerKm = 2500;
      let minOngkirApp = 5000; 

      if (appConfig) {
        const cMap = new Map(appConfig.map(c => [c.kunci_konfigurasi?.toUpperCase().trim(), c.nilai_konfigurasi]));
        hargaPerKm = cMap.has('ONGKIR_PER_KM') ? parseFloat(cMap.get('ONGKIR_PER_KM')) : 2500;
        setTarifPerKm(hargaPerKm);
        
        // 🔥 POINT 7 RADAR FIX: Menyedot nilai Biaya Layanan Aplikasi terupdate hasil setingan Admin Tuan
        if (cMap.has('BIAYA_LAYANAN_TRANSAKSI')) {
          setBiayaAdminBelanja(parseInt(cMap.get('BIAYA_LAYANAN_TRANSAKSI')));
        }
        
        if (cMap.has('POTONGAN_DRIVER_PERSEN')) setPersenAdminRahasia(parseFloat(cMap.get('POTONGAN_DRIVER_PERSEN')) / 100);
        
        if (cMap.has('MINIMUM_PAYMENT_ORDER')) {
          minOngkirApp = parseInt(cMap.get('MINIMUM_PAYMENT_ORDER'));
        }
      }

      if (dataToko?.latitude_toko && dataToko?.longitude_toko) {
        setDetailTokoGlobal({ nama: dataToko.nama_toko, alamat: dataToko.alamat_toko });
        const latToko = parseFloat(dataToko.latitude_toko);
        const lngToko = parseFloat(dataToko.longitude_toko);
        setKoordinatToko({ latitude: latToko, longitude: lngToko });
        await dapatkanRuteOSRM(latToko, lngToko, latUser, lngUser, hargaPerKm, minOngkirApp);
      }
    } catch (err) { console.log(err); }
  };

  useEffect(() => {
    const subsAlamatBuku = DeviceEventEmitter.addListener('ALAMAT_CHECKOUT_SAH', async (alamatBuku) => {
      setAlamatKirim(alamatBuku.alamat_lengkap);
      setKoordinatPin({ latitude: alamatBuku.latitude_alamat, longitude: alamatBuku.longitude_alamat });
      if (idPenjualMitra) {
        await kalibrasiUlangOngkirDinamis(alamatBuku.latitude_alamat, alamatBuku.longitude_alamat, idPenjualMitra);
      }
    });
    return () => subsAlamatBuku.remove();
  }, [idPenjualMitra]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoadingInitialData(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return router.back();
        const uid = session.user.id;

        const { data: userData } = await supabase.from('users').select('user_name').eq('user_id', uid).single();
        fetchSaldoTerkini();
        
        const numericCartIds = selectedCartIds.map(x => parseInt(x)).filter(x => !isNaN(x));

        let queryKeranjang = supabase
          .from('keranjang')
          .select('id, produk_id, kuantitas, varian_terpilih') 
          .eq('pembeli_id', uid);

        if (numericCartIds.length > 0) queryKeranjang = queryKeranjang.in('id', numericCartIds);

        const { data: cartData, error: cartError } = await queryKeranjang;
        if (cartError) throw cartError;

        if (cartData && cartData.length > 0) {
          const { data: dataProduk, error: errorProduk } = await supabase
            .from('produk')
            .select('id_produk, nama_produk, harga_produk, foto_produk, stok_ready_produk, id_toko_produk, kategori_produk');
          
          if (errorProduk) throw errorProduk;

          const produkMap = new Map(dataProduk?.map(p => [p.id_produk, p]) || []);

          const itemsKeranjang = cartData.map((item: any) => {
            const detailProduk = dataProduk?.find(p => String(p.id_produk) === String(item.produk_id) || p.id_produk.substring(0,8) === String(item.produk_id));
            const liveProduk = detailProduk || produkMap.get(item.produk_id);
            
            return {
              id: item.id, 
              produk_id: item.produk_id, 
              kuantitas: item.kuantitas,
              varian_terpilih: item.varian_terpilih || null,
              produk: liveProduk ? {
                id_toko_produk: liveProduk.id_toko_produk,
                kategori_produk: liveProduk.kategori_produk,
                harga_produk: liveProduk.harga_produk,
                nama_produk: liveProduk.nama_produk,
                stok_ready_produk: liveProduk.stok_ready_produk
              } : null
            };
          }).filter(item => item.produk !== null);

          if (itemsKeranjang.length === 0) {
            Alert.alert("Data Hilang", "Produk di dalam ceklis belanjaan Anda tidak ditemukan.");
            return router.back();
          }

          setValidatedItems(itemsKeranjang);

          setValidatedItems(itemsKeranjang);

          // 🔥 RADAR AUTO-DETEKSI JASA (MENCEGAH BOCOR PARAMETER)
          const checkJasaOtomatis = itemsKeranjang.some((item: any) => 
            String(item.produk?.kategori_produk || '').toUpperCase().includes('SERVIS') || 
            String(item.produk?.kategori_produk || '').toUpperCase().includes('JASA')
          );
          if (checkJasaOtomatis) {
            setIsJasa(true);
            setPilarLayananTarget('SERVIS');
          }

          const sellerId = itemsKeranjang[0].produk?.id_toko_produk || null;
          setIdPenjualMitra(sellerId);

          let currentLat = -7.3274;
          let currentLng = 108.3543;

          const { data: alamatUtama } = await supabase.from('user_addresses').select('alamat_lengkap, latitude, longitude').eq('user_id', uid).eq('is_utama', true).maybeSingle();

          if (alamatUtama) {
            setAlamatKirim(alamatUtama.alamat_lengkap);
            currentLat = parseFloat(alamatUtama.latitude);
            currentLng = parseFloat(alamatUtama.longitude);
            setKoordinatPin({ latitude: currentLat, longitude: currentLng });
            if (sellerId) await kalibrasiUlangOngkirDinamis(currentLat, currentLng, sellerId);
          } else {
            setAlamatKirim('');
          }

          if (userData) setNamaPembeli(userData.user_name || 'Warga PAMILO');
          if (sellerId) await periksaPromoMinimalBelanjaOtomatis(sellerId, subtotal);
        } else {
          Alert.alert("Data Hilang", "Antrean ceklis pemesanan kosong di database.");
          router.back();
        }
      } catch (e) { console.error(e); } 
      finally { setLoadingInitialData(false); }
    };
    fetchInitialData();
  }, []);

  const gunakanLokasiSaatIni = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return Alert.alert("Izin Ditolak", "Butuh izin GPS.");
    let loc = await Location.getCurrentPositionAsync({});
    setKoordinatPin({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    terjemahkanPinKeAlamat(loc.coords.latitude, loc.coords.longitude);
    await kalibrasiUlangOngkirDinamis(loc.coords.latitude, loc.coords.longitude, idPenjualMitra);
  };

  const handleEksekusiCariAlamatManual = async () => {
    const teksBersih = alamatKirim.trim();
    if (!teksBersih) return Alert.alert("Input Kosong 🚨", "Ketik alamat terlebih dahulu.");
    try {
      let urlSearch = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(teksBersih)}, Ciamis&format=json&limit=3`;
      setLoadingPencarian(true);
      const res = await fetch(urlSearch, { headers: { 'User-Agent': 'PAMILO-App/1.0' } });
      const data = await res.json();
      if (data && data.length > 0) { setRekomendasiAlamat(data); Vibration.vibrate(50); } 
      else { setRekomendasiAlamat([]); Alert.alert("Tidak Ditemukan", "Sistem tidak mengenali lokasi tersebut."); }
    } catch (e) { Alert.alert("Eror Peta", "Gagal menghubungi satelit pencarian digital."); } 
    finally { setLoadingPencarian(false); } 
  };

  const pilihRekomendasi = async (item: any) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    setAlamatKirim(item.display_name);
    setRekomendasiAlamat([]);
    setKoordinatPin({ latitude: lat, longitude: lon });
    await kalibrasiUlangOngkirDinamis(lat, lon, idPenjualMitra);
  };

  const tanganiPinSelesaiDigeser = async (e: any) => {
    const koordinatBaru = e.nativeEvent.coordinate;
    setKoordinatPin(koordinatBaru);
    try {
      let geoRiset = await Location.reverseGeocodeAsync(koordinatBaru);
      if (geoRiset.length > 0) {
        const hasil = geoRiset[0];
        const namaJalan = hasil.street || hasil.name || '';
        const namaDesa = hasil.subregion || '';
        const namaKecamatan = hasil.district || '';
        const alamatFinal = `${namaJalan}, ${namaDesa}, ${namaKecamatan}`.replace(/^,\s*,?/, '').trim();
        setAlamatKirim(alamatFinal); 
      } else {
        terjemahkanPinKeAlamat(koordinatBaru.latitude, koordinatBaru.longitude);
      }
      await kalibrasiUlangOngkirDinamis(koordinatBaru.latitude, koordinatBaru.longitude, idPenjualMitra);
    } catch (error) { console.log("Gagal geser map:", error); }
  };

  const terjemahkanPinKeAlamat = async (lat: number, lon: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, { headers: { 'User-Agent': 'PAMILO-App/1.0' } });
      const data = await res.json();
      if (data.display_name) setAlamatKirim(data.display_name);
    } catch (e) { console.log(e); }
  };

  // 🔥 POINT 7 FINTECH RE-CALCULATION: 
  // Jika bertipe SERVIS, Biaya Layanan Aplikasi disembunyikan dari tagihan Warga karena dipotong langsung dari saldo penyedia jasa.
  // Jika FOOD / MART / OJEK MIGO, Biaya Layanan Aplikasi mutlak dibebankan kepada pembeli (baik COD / Saldo) demi profit murni perusahaan!
  const totalSubtotalSetelahDiskon = subtotal - diskonPotonganHarga;
  const biayaLayananAplikasiDinamis = isJasa ? 0 : biayaAdminBelanja;
  const totalTagihanBersihWarga = (totalSubtotalSetelahDiskon < 0 ? 0 : totalSubtotalSetelahDiskon) + ongkosKirimDinamis + biayaLayananAplikasiDinamis;
  const apakahSaldoKurang = metodeBayar === 'SALDO' && saldoWarga < totalTagihanBersihWarga;

  const handleProsesPembayaran = async () => {
    if (loadingPay) return; 
    if (!alamatKirim.trim() || alamatKirim === 'Titik Koordinat Peta Belum Tersimpan') return Alert.alert("Alamat Kosong", "Tentukan lokasi pengantaran dengan mengetuk ikon GPS atau mengetik alamat.");
    if (metodeBayar === 'SALDO' && apakahSaldoKurang) return Alert.alert("Saldo Tidak Cukup ❌", "Silakan top-up atau gunakan COD.");
    
    try {
      let statusAwalOrders = 'PENDING';
      if (isJasa) statusAwalOrders = 'MENUNGGU_KONFIRMASI_MITRA'; // Mengunci pemicu khusus sasis Jasa

      setLoadingPay(true);
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session!.user.id;
      
      const { data: cekUlangToko } = await supabase.from('toko').select('status_toko').eq('id_toko', idPenjualMitra).maybeSingle();
      if (cekUlangToko?.status_toko !== 'BUKA') {
        setLoadingPay(false);
        return Alert.alert("Transaksi Batal 🚨", "Maaf, Mitra baru saja menutup lapaknya.");
      }

      let barangGagalStok = "";
      if (!isJasa) {
        validatedItems.forEach(item => {
          if (item.kuantitas > (item.produk?.stok_ready_produk || 0)) barangGagalStok = item.produk?.nama_produk || "Produk";
        });
        if (barangGagalStok !== "") {
          setLoadingPay(false);
          return Alert.alert("Stok Habis 🚨", `Maaf, stok item "${barangGagalStok}" mendadak habis.`);
        }
      }

      // Kunci pemotongan persentase admin kurir
      const potonganKomisiAplikasi = Math.round(ongkosKirimDinamis * persenAdminRahasia);
      
      const rincianBarangPesanan = validatedItems.map(item => 
        `${item.kuantitas}x ${item.produk?.nama_produk}${item.varian_terpilih ? ` (${item.varian_terpilih})` : ''}`
      ).join(', ');

      const { data: orderBaru, error: orderError } = await supabase
        .from('orders')
        .insert([{
          pembeli_id: uid, penjual_id: idPenjualMitra, kurir_id: null,
          layanan: pilarLayananTarget, catatan: `Rincian: ${rincianBarangPesanan}`, 
          nama_pengirim: detailTokoGlobal?.nama || 'Mitra PAMILO', detail_lokasi_jemput: detailTokoGlobal?.alamat || 'Alamat Mitra', 
          latitude_jemput: koordinatToko.latitude, longitude_jemput: koordinatToko.longitude, 
          total_harga_barang: subtotal, total_pembayaran: Math.round(totalTagihanBersihWarga), 
          biaya_admin: Math.round(potonganKomisiAplikasi), 
          biaya_penanganan: Math.round(biayaAdminBelanja), // Nilai murni Biaya Layanan Aplikasi tetap tersimpan rapi untuk audit brankas cloud
          biaya_ongkir: Math.round(ongkosKirimDinamis), potongan_diskon: diskonPotonganHarga, 
          status_order: statusAwalOrders, metode_pembayaran: metodeBayar, 
          jarak_km: jarakAktualKm, alamat_pengiriman: alamatKirim, 
          latitude_tujuan: koordinatPin.latitude, longitude_tujuan: koordinatPin.longitude
        }])
        .select('id').single();

      if (orderError) throw orderError;
      if (!orderBaru?.id) throw new Error("Gagal mengambil ID dari satelit Database.");
      
      if (validatedItems.length > 0) {
        const payloadOrderItems = validatedItems.map((item: any) => ({
          order_id: orderBaru.id, 
          id_produk_order: item.produk_id, 
          kuantitas: item.kuantitas,
          harga_satuan: item.produk?.harga_produk || 0, 
          penjual_id: idPenjualMitra,
          status_item: statusAwalOrders,
          varian_terpilih: item.varian_terpilih || null
        }));
        await supabase.from('order_items').insert(payloadOrderItems);
      }

      if (idPromoDatabase) {
        const { data: currentPromo } = await supabase.from('promosi_toko').select('kuota_promo').eq('id', idPromoDatabase).maybeSingle();
        if (currentPromo) await supabase.from('promosi_toko').update({ kuota_promo: currentPromo.kuota_promo - 1 }).eq('id', idPromoDatabase);
      }

      const numericCartIds = selectedCartIds.map(x => parseInt(x)).filter(x => !isNaN(x));
      if (numericCartIds.length > 0) await supabase.from('keranjang').delete().in('id', numericCartIds);
      else await supabase.from('keranjang').delete().eq('pembeli_id', uid);
      
      if (metodeBayar === 'SALDO') {
        await supabase.from('users').update({ saldo: saldoWarga - totalTagihanBersihWarga }).eq('user_id', uid);
        await supabase.from('transaksi_saldo').insert([{
          user_id_transaksi: uid, tipe_mutasi: 'DEBET', nominal_mutasi: totalTagihanBersihWarga,
          jenis_transaksi: 'BELANJA', keterangan: `Pembayaran checkout layanan PAMILO ${pilarLayananTarget} (Order #${orderBaru.id})`
        }]);
      }

      router.replace(`/orders/detail?id=${orderBaru.id}`);

    } catch (e: any) { 
      Alert.alert("Gagal Memproses", "Terjadi gangguan koneksi, mohon periksa jaringan Anda."); 
      console.log(e); 
    } 
    finally { setLoadingPay(false); }
  };

  // 🔥 POINT 4 DYNAMIC HEADER PERBAIKAN MUTLAK SESUAI LABEL LAYANAN TARGET
  const headerTeks = isJasa ? 'Konfirmasi Panggilan Jasa' : 'Konfirmasi Pembayaran';
  const labelHeaderSpandukStr = isJasa ? 'PAMILO SERVIS 🛠️' : (pilarLayananTarget === 'FOOD' ? 'PAMILO FOOD 🥘' : 'PAMILO MART 📦');
  const lokasiTitleTeks = isJasa ? 'Lokasi Panggilan Anda' : 'Titik Lokasi Pengiriman Kurir MIGO';
  const btnCheckoutTeks = isJasa ? 'Konfirmasi Permintaan' : 'Buat Pesanan';
  const colorAksen = isJasa ? '#6A1B9A' : '#4A3525';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <Stack.Screen options={{ title: headerTeks, headerStyle: { backgroundColor: colorAksen }, headerTintColor: '#fff' }} />
      {loadingInitialData ? <ActivityIndicator size="large" color={colorAksen} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* 🔥 POINT 4 FIX DYNAMIC HEADER TEXT BANNER */}
          <View style={[styles.infoBanner, { backgroundColor: isJasa ? '#F3E5F5' : '#FFF8F4', borderColor: isJasa ? '#E1BEE7' : '#FFCCBC' }]}>
            <Ionicons name={isJasa ? 'construct' : (pilarLayananTarget === 'FOOD' ? 'fast-food' : 'cube')} size={18} color={isJasa ? '#8E24AA' : '#D35400'} />
            <Text style={[styles.infoBannerText, { color: isJasa ? '#6A1B9A' : '#4A3525' }]}>
              Anda sedang mengonfirmasi layanan <Text style={{fontWeight: '900'}}>{labelHeaderSpandukStr}</Text>.
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{lokasiTitleTeks}</Text>
              
              <TouchableOpacity onPress={() => router.push({ pathname: '/(warga)/addresses', params: { mode: 'select', event_name: 'ALAMAT_CHECKOUT_SAH' } })}>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: colorAksen }}>📖 BUKU ALAMAT</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <TextInput style={styles.addressInput} value={alamatKirim} onChangeText={setAlamatKirim} placeholder="Ketik atau klik ikon GPS di samping 👉" multiline />
              <TouchableOpacity onPress={handleEksekusiCariAlamatManual} style={[styles.searchAddressManualBtn, { backgroundColor: colorAksen }]} disabled={loadingPencarian}>
                {loadingPencarian ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="search" size={16} color="#fff" />}
              </TouchableOpacity>
              <TouchableOpacity onPress={gunakanLokasiSaatIni} style={styles.gpsBtn}><Ionicons name="locate" size={18} color="#D35400" /></TouchableOpacity>
            </View>

            {rekomendasiAlamat.length > 0 && (
              <View style={styles.suggestionBox}>
                {rekomendasiAlamat.map((item, i) => (
                  <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => pilihRekomendasi(item)}>
                    <Text numberOfLines={2} style={styles.suggestionItemText}>📍 {item.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.mapContainer}>
              <MapView ref={mapRef} style={styles.map} initialRegion={{ ...koordinatPin, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                onPress={async (e) => { 
                  const coord = e.nativeEvent.coordinate; setKoordinatPin(coord); terjemahkanPinKeAlamat(coord.latitude, coord.longitude);
                  await kalibrasiUlangOngkirDinamis(coord.latitude, coord.longitude, idPenjualMitra);
                }}
              >
                <Marker 
                  draggable 
                  coordinate={koordinatPin} 
                  onDragEnd={tanganiPinSelesaiDigeser} 
                  title="Lokasi Anda" 
                  description="Tahan lalu geser pin ini agar alamat akurat."
                  pinColor={isJasa ? '#8E24AA' : '#D35400'} 
                />
                <Marker coordinate={koordinatToko} title="Lokasi Mitra" pinColor="#4A3525" />
                {ruteJalan.length > 0 && <Polyline coordinates={ruteJalan} strokeWidth={4} strokeColor={isJasa ? '#8E24AA' : '#D35400'} />}
              </MapView>
            </View>
            <Text style={styles.radarHint}>Estimasi Jarak Aspal: <Text style={{fontWeight: 'bold', color: '#D35400'}}>{jarakAktualKm} KM</Text></Text>
            <Text style={{fontSize: 9, color: '#A1887F', textAlign: 'center', marginTop: 4}}>💡 Tahan lalu geser pin pada peta agar alamat akurat.</Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>🎫 Promo & Kupon Mitra Lapak</Text>
            <View style={styles.promoInputRow}>
              <TextInput 
                style={styles.promoTextInput} 
                value={kodeVoucherInput} 
                onChangeText={setKodeVoucherInput} 
                placeholder="Masukkan Kode Voucher..." 
                placeholderTextColor="#BCAAA4"
                autoCapitalize="characters"
              />
              <TouchableOpacity style={[styles.btnApplyVoucher, { backgroundColor: colorAksen }]} onPress={handleTerapkanKuponVoucherManual} disabled={loadingVoucher}>
                {loadingVoucher ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnApplyVoucherText}>Pakai</Text>}
              </TouchableOpacity>
            </View>

            {infoPromoTerpasang && (
              <View style={styles.promoActiveBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#00796B" />
                <Text style={styles.promoActiveText} numberOfLines={2}>{infoPromoTerpasang}</Text>
              </View>
            )}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Metode Pembayaran</Text>
            <TouchableOpacity style={[styles.radioOption, metodeBayar === 'COD' && styles.radioActive]} onPress={() => setMetodeBayar('COD')}>
              <Text style={styles.radioTitle}>💵 Bayar di Tempat (Tunai)</Text>
              <Text style={styles.methodMemo}>{isJasa ? 'Bayar tunai ke teknisi/ahli jasa setelah selesai.' : 'Bayar tunai ke kurir MIGO saat pesanan sampai.'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.radioOption, metodeBayar === 'SALDO' && styles.radioActive, apakahSaldoKurang && { borderColor: '#EF9A9A' }]} onPress={() => setMetodeBayar('SALDO')}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.radioTitle}>📱 Pamilo-Pay</Text>
                <Text style={[styles.saldoBadge, { color: apakahSaldoKurang ? '#C62828' : '#2E7D32' }]}>Rp {saldoWarga.toLocaleString('id-ID')}</Text>
              </View>
              <Text style={styles.methodMemo}>Saldo dipotong otomatis setelah pesanan dikonfirmasi.</Text>
              {apakahSaldoKurang && (
                <View style={styles.warningBox}>
                  <Text style={styles.saldoWarningHint}>❌ Saldo Pamilo-Pay Tidak Cukup</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Rincian Nota Kelayakan</Text>
            <View style={styles.billingRow}><Text style={styles.billingLabel}>{isJasa ? 'Harga Total Layanan Jasa' : 'Total Harga Barang/Makanan'}</Text><Text style={styles.billingValue}>Rp {subtotal.toLocaleString('id-ID')}</Text></View>
            
            {diskonPotonganHarga > 0 && (
              <View style={styles.billingRow}><Text style={[styles.billingLabel, {color: '#00796B', fontWeight: 'bold'}]}>Potongan Diskon Promo</Text><Text style={[styles.billingValue, {color: '#00796B'}]}>- Rp {diskonPotonganHarga.toLocaleString('id-ID')}</Text></View>
            )}

            <View style={styles.billingRow}><Text style={styles.billingLabel}>{isJasa ? 'Biaya Transport Teknisi' : 'Ongkos Kirim MIGO'}</Text><Text style={styles.billingValue}>Rp {ongkosKirimDinamis.toLocaleString('id-ID')}</Text></View>
            
            {/* 🔥 POINT 7 FIX DISPLAY: Biaya Layanan Aplikasi mutlak dibebankan kepada warga pembeli untuk FOOD & MART baik COD / Saldo! */}
            {!isJasa && (
              <View style={styles.billingRow}>
                <Text style={styles.billingLabel}>Biaya Layanan Aplikasi</Text>
                <Text style={styles.billingValue}>Rp {biayaAdminBelanja.toLocaleString('id-ID')}</Text>
              </View>
            )}

            <View style={styles.dividerLine} />
            <View style={styles.billingRow}>
              <Text style={styles.totalBillLabel}>Total Bersih Tagihan</Text>
              <Text style={styles.totalBillValue}>Rp {totalTagihanBersihWarga.toLocaleString('id-ID')}</Text>
            </View>
          </View>
        </ScrollView>
      )}

      <View style={[styles.bottomActionBar, { paddingBottom: insets.bottom || 15 }]}>
        <View><Text style={styles.summaryLabel}>Total Pembayaran</Text><Text style={styles.summaryPrice}>Rp {totalTagihanBersihWarga.toLocaleString('id-ID')}</Text></View>
        <TouchableOpacity 
          style={[
            styles.btnPayNow, 
            { backgroundColor: isJasa ? '#6A1B9A' : '#D35400' }, 
            (loadingPay || loadingInitialData || apakahSaldoKurang) && styles.btnPayDisabled
          ]} 
          onPress={handleProsesPembayaran} 
          disabled={loadingPay || loadingInitialData || apakahSaldoKurang}
        >
          <Text style={styles.btnPayNowText}>{loadingPay ? 'Memproses...' : apakahSaldoKurang ? 'Saldo Kurang' : btnCheckoutTeks}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFCFB' },
  scrollContent: { padding: 16, paddingBottom: 150 },
  infoBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16, gap: 10 },
  infoBannerText: { fontSize: 11, fontWeight: '500' },
  sectionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#EFEBE9' },
  sectionTitle: { fontWeight: 'bold', marginBottom: 12, color: '#4A3525', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addressInput: { flex: 1, borderWidth: 1, borderColor: '#EFEBE9', borderRadius: 10, padding: 10, minHeight: 46, maxHeight: 80, color: '#4A3525', fontSize: 13, backgroundColor: '#FAF8F5' },
  searchAddressManualBtn: { width: 42, height: 46, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  gpsBtn: { width: 42, height: 46, backgroundColor: '#FFF8F4', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFCCBC' },
  suggestionBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#EFEBE9', borderRadius: 10, marginTop: 6, maxHeight: 160, overflow: 'hidden' },
  suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  suggestionItemText: { fontSize: 11, color: '#4A3525', fontWeight: '500', lineHeight: 16 },
  mapContainer: { height: 180, marginTop: 15, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#EFEBE9' },
  map: { width: '100%', height: '100%' },
  radarHint: { fontSize: 11, color: '#8D6E63', textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
  radioOption: { padding: 14, borderWidth: 1, borderRadius: 12, marginBottom: 10, borderColor: '#EFEBE9' },
  radioActive: { borderColor: '#D35400', backgroundColor: '#FFFAF1' },
  radioTitle: { fontWeight: 'bold', color: '#4A3525', fontSize: 13 },
  methodMemo: { fontSize: 11, color: '#7D665E', marginTop: 5, fontStyle: 'italic', lineHeight: 16 },
  saldoBadge: { fontSize: 12, fontWeight: 'bold' },
  warningBox: { backgroundColor: '#FFEBEE', padding: 10, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: '#FFCDD2' },
  saldoWarningHint: { fontSize: 11, color: '#C62828', fontWeight: 'bold' },
  billingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  billingLabel: { color: '#7D665E', fontSize: 13 },
  billingValue: { fontWeight: '700', color: '#4A3525', fontSize: 13 },
  dividerLine: { height: 1, backgroundColor: '#EFEBE9', marginVertical: 10 },
  totalBillLabel: { fontWeight: 'bold', color: '#4A3525', fontSize: 14 },
  totalBillValue: { fontSize: 16, fontWeight: '900', color: '#D35400' },
  bottomActionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: '#EFEBE9', elevation: 5 },
  summaryLabel: { fontSize: 11, color: '#8D6E63', fontWeight: '500' },
  summaryPrice: { fontSize: 18, fontWeight: '900', color: '#D35400' },
  btnPayNow: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25 },
  btnPayDisabled: { backgroundColor: '#BCAAA4' },
  btnPayNowText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  promoInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  promoTextInput: { flex: 1, height: 40, borderWidth: 1, borderColor: '#EFEBE9', borderRadius: 10, paddingHorizontal: 12, color: '#4A3525', fontSize: 12, backgroundColor: '#FAF8F5' },
  btnApplyVoucher: { height: 40, paddingHorizontal: 16, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  btnApplyVoucherText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  promoActiveBadge: { flexDirection: 'row', gap: 6, backgroundColor: '#E0F2F1', borderWidth: 1, borderColor: '#B2DFDB', padding: 10, borderRadius: 8, marginTop: 10, alignItems: 'center' },
  promoActiveText: { fontSize: 11, color: '#004D40', fontWeight: '600', flex: 1, lineHeight: 15 }
});