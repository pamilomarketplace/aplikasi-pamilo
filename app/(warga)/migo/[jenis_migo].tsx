// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  StatusBar, 
  ActivityIndicator, 
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  DeviceEventEmitter
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';

import { supabase } from '@/supabaseConfig';

const { width } = Dimensions.get('window');

interface AlamatSaran {
  id: string;
  namaTempat: string;
  deskripsiSub: string;
  latitude: number;
  longitude: number;
}

export default function PemesananMigoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { jenis_migo } = params;
  const mapRef = useRef<MapView>(null);

  const hasLoadedGpsAwalRef = useRef(false);

  const isMotor = jenis_migo === 'pesan-motor' || jenis_migo === 'motor';
  const labelArmada = isMotor ? 'MIGO Motor' : 'MIGO Mobil';
  const iconArmada = isMotor ? 'motorcycle' : 'car';

  const [currentUserId, setCurrentUserId] = useState<string>(''); 
  const [penjemputan, setPenjemputan] = useState('');
  const [tujuan, setTujuan] = useState('');
  const [jarakEstimasi, setJarakEstimasi] = useState<number | null>(null);
  const [waktuEstimasi, setWaktuEstimasi] = useState<string | null>(null);
  const [loadingPesan, setLoadingPesan] = useState(false);
  const [loadingGPS, setLoadingGPS] = useState(false);
  const [loadingRute, setLoadingRute] = useState(false);
  const [loadingPencarian, setLoadingPencarian] = useState(false);

  const [metodePembayaran, setMetodePembayaran] = useState<'TUNAI' | 'SALDO'>('TUNAI');

  const [tarifPerKmCloud, setTarifPerKmCloud] = useState<number | null>(null);
  const [loadingTarif, setLoadingTarif] = useState(true);

  const [koordinatJemput, setKoordinatJemput] = useState({ latitude: -7.3262, longitude: 108.3532 });
  const [koordinatAntar, setKoordinatAntar] = useState({ latitude: -7.3295, longitude: 108.3560 });
  const [koordinatRutePolyline, setKoordinatRutePolyline] = useState<any[]>([]); 

  const [gpsReady, setGpsReady] = useState(false);

  const [petaRegion] = useState({
    latitude: -7.3262,
    longitude: 108.3532,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  });

  const [saranList, setSaranList] = useState<AlamatSaran[]>([]);
  const [targetInputFocus, setTargetInputFocus] = useState<'JEMPUT' | 'ANTAR' | null>(null);
  
  // 🟢 KUNCI JALUR BUKU ALAMAT BIAR TIDAK TABRAKAN
  const targetBukuAlamat = useRef<'JEMPUT' | 'ANTAR' | null>(null);

  useEffect(() => {
    const ambilSesiAktifWarga = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        setCurrentUserId(session.user.id);
      }
    };
    
    ambilSesiAktifWarga();
    fetchTarifResmiAdmin();
  }, [jenis_migo]);

  useEffect(() => {
    if (hasLoadedGpsAwalRef.current) return;

    if (params.dari_wisata_galuh === 'true' && params.wisata_nama) {
      hasLoadedGpsAwalRef.current = true;
      const wisataLat = parseFloat(params.wisata_lat);
      const wisataLng = parseFloat(params.wisata_lng);

      setTujuan(params.wisata_nama);
      setKoordinatAntar({ latitude: wisataLat, longitude: wisataLng });
      pemicuRuteOtomatisWisata(wisataLat, wisataLng);
    } else {
      hasLoadedGpsAwalRef.current = true;
      ambilLokasiGpsWargaAwal();
    }
  }, [params]);

  // 🟢 TUNING FIXED JALUR BUKU ALAMAT OJOL MIGO
  useEffect(() => {
    const subsAlamatBuku = DeviceEventEmitter.addListener('ALAMAT_MIGO_SAH', async (alamatBuku) => {
      const targetMode = targetBukuAlamat.current;
      if (!targetMode) return;

      const targetCoords = { latitude: alamatBuku.latitude_alamat, longitude: alamatBuku.longitude_alamat };
      const namaJalanBaru = alamatBuku.alamat_lengkap;

      if (jarakEstimasi) { setJarakEstimasi(null); setKoordinatRutePolyline([]); }

      if (targetMode === 'JEMPUT') {
        setKoordinatJemput(targetCoords);
        setPenjemputan(namaJalanBaru);
      } else {
        setKoordinatAntar(targetCoords);
        setTujuan(namaJalanBaru);
      }

      mapRef.current?.animateToRegion({
        ...targetCoords,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      }, 600);
      
      targetBukuAlamat.current = null; 
    });

    return () => subsAlamatBuku.remove();
  }, [jarakEstimasi]);

  const pemicuRuteOtomatisWisata = async (targetLat: number, targetLng: number) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let lokasiRiil = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = lokasiRiil.coords;

        setKoordinatJemput({ latitude, longitude });
        setGpsReady(true);
        await terjemahkanKoordinatKeNamaJalan(latitude, longitude, 'JEMPUT');
        
        mapRef.current?.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015
        }, 500);

        fetchRuteJalanRayaAsli(latitude, longitude, targetLat, targetLng);
      }
    } catch (e) {
      console.log("Gagal memicu auto-route wisata:", e);
    }
  };

  const ambilLokasiGpsWargaAwal = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let lokasiRiil = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = lokasiRiil.coords;
        
        setKoordinatJemput({ latitude, longitude });
        setGpsReady(true); 
        await terjemahkanKoordinatKeNamaJalan(latitude, longitude, 'JEMPUT');

        setTimeout(() => {
          mapRef.current?.animateToRegion({
            latitude,
            longitude,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012
          }, 600);
        }, 300);
      }
    } catch (e) {}
  };

  const fetchTarifResmiAdmin = async () => {
    try {
      setLoadingTarif(true);
      
      const { data, error } = await supabase
        .from('pengaturan_aplikasi')
        .select('kunci_konfigurasi, nilai_konfigurasi')
        .in('kunci_konfigurasi', ['ONGKIR_PER_KM', 'ONGKIR_MOBIL_PER_KM']);

      if (error) throw error;

      if (data && data.length > 0) {
        const configMap = new Map(
          data.map(item => [item.kunci_konfigurasi?.toUpperCase().trim(), item.nilai_konfigurasi])
        );
        
        const kunciTarget = isMotor ? 'ONGKIR_PER_KM' : 'ONGKIR_MOBIL_PER_KM';
        const tarifDitemukan = configMap.get(kunciTarget);

        if (tarifDitemukan) {
          setTarifPerKmCloud(parseFloat(tarifDitemukan));
          return; 
        }
      }
      
      throw new Error("Kunci konfigurasi tidak ditemukan");

    } catch (err) {
      setTarifPerKmCloud(isMotor ? 2500 : 5000);
    } finally {
      setLoadingTarif(false);
    }
  };

  const fetchRuteJalanRayaAsli = async (lat1: number, lon1: number, lat2: number, lon2: number) => {
    try {
      setLoadingRute(true);
      const urlRouter = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
      const response = await fetch(urlRouter);
      const json = await response.json();

      if (json.routes && json.routes.length > 0) {
        const ruteUtama = json.routes[0];
        setJarakEstimasi(Math.round((ruteUtama.distance / 1000) * 10) / 10);
        setWaktuEstimasi(`${Math.round(ruteUtama.duration / 60)} Menit`);

        const formatGarisPeta = ruteUtama.geometry.coordinates.map((coord: any) => ({
          latitude: coord[1],
          longitude: coord[0]
        }));
        setKoordinatRutePolyline(formatGarisPeta);

        setTimeout(() => {
          mapRef.current?.fitToCoordinates([
            { latitude: lat1, longitude: lon1 },
            { latitude: lat2, longitude: lon2 }
          ], {
            edgePadding: { top: 70, right: 70, bottom: 310, left: 70 },
            animated: true
          });
        }, 150);
      }
    } catch (e) {
      setJarakEstimasi(1.2);
    } finally {
      setLoadingRute(false);
    }
  };

  const terjemahkanKoordinatKeNamaJalan = async (lat: number, lng: number, tipe: 'JEMPUT' | 'ANTAR') => {
    try {
      const hasilKonversi = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (hasilKonversi && hasilKonversi.length > 0) {
        const h = hasilKonversi[0];
        const alamatLengkap = `${h.name ? h.name + ', ' : ''}${h.street || ''} Kel. ${h.district || ''}, Kec. ${h.subregion || ''}`.trim();
        if (tipe === 'JEMPUT') setPenjemputan(alamatLengkap);
        if (tipe === 'ANTAR') setTujuan(alamatLengkap);
      }
    } catch (e) {}
  };

  const handleTextTypingOnly = (teks: string, tipe: 'JEMPUT' | 'ANTAR') => {
    if (tipe === 'JEMPUT') setPenjemputan(teks);
    if (tipe === 'ANTAR') setTujuan(teks);
    if (jarakEstimasi) { setJarakEstimasi(null); setKoordinatRutePolyline([]); }
    setSaranList([]);
  };

  const eksekusiCariAlamatSatelit = async (tipe: 'JEMPUT' | 'ANTAR') => {
    const kataKunci = tipe === 'JEMPUT' ? penjemputan : tujuan;
    if (kataKunci.trim().length < 3) {
      return Alert.alert("Pencarian Gagal", "Masukkan minimal 3 karakter alamat/nama tempat.");
    }

    Keyboard.dismiss();
    setTargetInputFocus(tipe);
    setLoadingPencarian(true);

    try {
      const urlNominatim = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(kataKunci)}&format=json&limit=4&namedetails=1&addressdetails=1&countrycodes=id`;
      const response = await fetch(urlNominatim, { headers: { 'User-Agent': 'PAMILO-MIGO-App/1.0' } });
      const data = await response.json();

      if (data && data.length > 0) {
        const formattedResults: AlamatSaran[] = data.map((item: any, idx: number) => {
          const namaKomersial = 
            item.namedetails?.name || 
            item.address?.amenity || 
            item.address?.shop || 
            item.address?.restaurant || 
            item.address?.cafe ||
            item.address?.bank || 
            item.address?.office || 
            item.address?.building ||
            item.display_name.split(',')[0];

          const namaKotaAsli = item.address?.city || item.address?.regency || item.address?.county || item.address?.state || '';
          const detailJalanJejak = `${item.address?.road || ''} ${item.address?.suburb ? 'Kel. ' + item.address?.suburb : ''} ${item.address?.district ? 'Kec. ' + item.address?.district : ''} ${namaKotaAsli}`.trim();

          return {
            id: `pamilo-loc-${idx}-${Date.now()}`,
            namaTempat: namaKomersial,
            deskripsiSub: detailJalanJejak || 'Wilayah Jawa Barat',
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon)
          };
        });

        const hasilUtama = formattedResults[0];

        if (tipe === 'JEMPUT') {
          const teksAlamatLengkap = (hasilUtama.namaTempat + " " + hasilUtama.deskripsiSub).toLowerCase();
          const isJemputDiCiamis = teksAlamatLengkap.includes('ciamis') || 
                                   teksAlamatLengkap.includes('cijeungjing') || 
                                   teksAlamatLengkap.includes('baregbeg') ||
                                   (hasilUtama.longitude > 108.15 && hasilUtama.longitude < 108.6);

          if (!isJemputDiCiamis) {
            setLoadingPencarian(false);
            return Alert.alert(
              "Di Luar Jangkauan Basis MIGO 🚨",
              "Maaf, titik PENJEMPUTAN awal armada PAMILO harus bermula dari wilayah Kabupaten Ciamis."
            );
          }
        }

        const kordinatTerpilih = { latitude: hasilUtama.latitude, longitude: hasilUtama.longitude };

        if (tipe === 'JEMPUT') {
          setKoordinatJemput(kordinatTerpilih);
          setPenjemputan(`${hasilUtama.namaTempat}, ${hasilUtama.deskripsiSub}`);
        } else {
          setKoordinatAntar(kordinatTerpilih);
          setTujuan(`${hasilUtama.namaTempat}, ${hasilUtama.deskripsiSub}`);
        }

        mapRef.current?.animateToRegion({
          ...kordinatTerpilih,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }, 600);

        const sisaRekomendasiToko = formattedResults.slice(1, 4);
        setSaranList(sisaRekomendasiToko);

      } else {
        setSaranList([]);
        Alert.alert("Tidak Ditemukan", `Lokasi "${kataKunci}" tidak terdeteksi di radar peta.`);
      }
    } catch (err) {
      setSaranList([]);
    } finally {
      setLoadingPencarian(false);
    }
  };

  const handlePilihSaranAlamat = (item: AlamatSaran) => {
    setSaranList([]);
    if (jarakEstimasi) { setJarakEstimasi(null); setKoordinatRutePolyline([]); }

    const targetCoords = { latitude: item.latitude, longitude: item.longitude };
    const gabunganNamaAlamat = `${item.namaTempat}, ${item.deskripsiSub}`;

    if (targetInputFocus === 'JEMPUT') {
      setKoordinatJemput(targetCoords);
      setPenjemputan(gabunganNamaAlamat);
    } else {
      setKoordinatAntar(targetCoords);
      setTujuan(gabunganNamaAlamat);
    }

    mapRef.current?.animateToRegion({
      ...targetCoords,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    }, 600);
    
    setTargetInputFocus(null);
  };

  const handleKetukTempatDiPeta = async (e: any) => {
    const koordinatKetuk = e.nativeEvent.coordinate;
    const namaTempatPoi = e.nativeEvent.name || "Lokasi Pilihan Peta";

    if (jarakEstimasi) { setJarakEstimasi(null); setKoordinatRutePolyline([]); }
    setSaranList([]);

    if (tujuan === '' && penjemputan !== '') {
      setKoordinatAntar(koordinatKetuk);
      setTujuan(namaTempatPoi);
      await terjemahkanKoordinatKeNamaJalan(koordinatKetuk.latitude, koordinatKetuk.longitude, 'ANTAR');
    } else {
      setKoordinatJemput(koordinatKetuk);
      setPenjemputan(namaTempatPoi);
      await terjemahkanKoordinatKeNamaJalan(koordinatKetuk.latitude, koordinatKetuk.longitude, 'JEMPUT');
    }
  };

  const ambilLokasiGpsWargaManual = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      setLoadingGPS(true);
      setSaranList([]);
      let lokasiRiil = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = lokasiRiil.coords;

      setKoordinatJemput({ latitude, longitude });
      setGpsReady(true);
      
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.010,
        longitudeDelta: 0.010,
      }, 500);

      await terjemahkanKoordinatKeNamaJalan(latitude, longitude, 'JEMPUT');
      if (jarakEstimasi) { setJarakEstimasi(null); setKoordinatRutePolyline([]); }
    } catch (error) {
      console.log(error);
    } finally {
      setLoadingGPS(false);
    }
  };

  const handleSelesaiGeserPinJemput = async (coords: { latitude: number, longitude: number }) => {
    setKoordinatJemput(coords);
    setSaranList([]);
    if (jarakEstimasi) { setJarakEstimasi(null); setKoordinatRutePolyline([]); }
    await terjemahkanKoordinatKeNamaJalan(coords.latitude, coords.longitude, 'JEMPUT');
  };

  const handleSelesaiGeserPinAntar = async (coords: { latitude: number, longitude: number }) => {
    setKoordinatAntar(coords);
    setSaranList([]);
    if (jarakEstimasi) { setJarakEstimasi(null); setKoordinatRutePolyline([]); }
    await terjemahkanKoordinatKeNamaJalan(coords.latitude, coords.longitude, 'ANTAR');
  };

  const handleHitungRuteTarif = () => {
    if (!penjemputan.trim() || !tujuan.trim()) {
      Alert.alert("Data Belum Lengkap", "Mohon tentukan lokasi penjemputan dan target tujuan dahulu.");
      return;
    }
    setSaranList([]);
    fetchRuteJalanRayaAsli(koordinatJemput.latitude, koordinatJemput.longitude, koordinatAntar.latitude, koordinatAntar.longitude);
  };

  const handleKirimOrderanMigo = async () => {
    if (loadingPesan) return; 
    if (!jarakEstimasi || !currentUserId) {
      return Alert.alert("Sesi Bermasalah", "Sasis otentikasi kosong, harap masuk akun ulang.");
    }

    if (metodePembayaran === 'SALDO') {
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('saldo')
          .eq('user_id', currentUserId)
          .maybeSingle();

        const saldoWarga = userData?.saldo ? Number(userData.saldo) : 0;
        if (saldoWarga < totalTarifAmunisi) {
          return Alert.alert(
            "Saldo Tidak Cukup 💳❌",
            `Sisa PAMILO-Pay Anda (Rp ${saldoWarga.toLocaleString('id-ID')}) kurang untuk membayar trip ini (Rp ${totalTarifAmunisi.toLocaleString('id-ID')}). Silakan top-up atau gunakan metode Tunai.`
          );
        }
      } catch (e) {
        return Alert.alert("Eror Jaringan", "Gagal memverifikasi kecukupan saldo dompet digital.");
      }
    }

    try {
      setLoadingPesan(true);
      const { data: orderBaru, error } = await supabase
        .from('migo_orders') 
        .insert([
          {
            pembeli_id: currentUserId,                 
            status_order: 'MENCARI_DRIVER', 
            metode_pembayaran: metodePembayaran, 
            jarak_km: jarakEstimasi,                    
            total_pembayaran: totalTarifAmunisi,        
            alamat_jemput: penjemputan,           
            alamat_antar: tujuan,                 
            latitude_jemput: koordinatJemput.latitude,
            longitude_jemput: koordinatJemput.longitude,
            latitude_tujuan: koordinatAntar.latitude,
            longitude_tujuan: koordinatAntar.longitude,
            tipe_layanan: isMotor ? 'MIGO_RIDE' : 'MIGO_CAR' 
          }
        ])
        .select('id') 
        .single();

      if (error) throw error;

      router.replace({
        pathname: '/orders/detail',
        params: { id: orderBaru.id }
      });

    } catch (err: any) {
      Alert.alert("Gagal Memesan", `Pipa koordinat mampet: ${err.message}`);
    } finally {
      setLoadingPesan(false);
    }
  };

  const tarifBerjalan = tarifPerKmCloud || (isMotor ? 2500 : 5000);
  const totalTarifAmunisi = jarakEstimasi ? Math.round(jarakEstimasi * tarifBerjalan) : 0;
  
  return (
    <KeyboardAvoidingView 
      style={styles.mainContainer} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: `Pesan ${labelArmada}`,
          headerTintColor: '#fff',
          headerStyle: { backgroundColor: '#4A3525' },
          headerTitleStyle: { fontWeight: 'bold', fontSize: 13 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 5, marginRight: 15 }}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          ),
        }} 
      />
      <StatusBar barStyle="light-content" backgroundColor="#4A3525" />

      {/* PANEL INPUT ALAMAT */}
      <View style={styles.topInputsPanel}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
          <Text style={styles.inputLabel}>Alamat Penjemputan</Text>
          <TouchableOpacity onPress={() => { targetBukuAlamat.current = 'JEMPUT'; router.push({ pathname: '/(warga)/addresses', params: { mode: 'select', event_name: 'ALAMAT_MIGO_SAH' } }); }}>
             <Text style={styles.btnBukuAlamatTxt}>📖 Pilih Alamat</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.inputBarRow}>
          <View style={styles.inputFieldContainer}>
            <View style={[styles.markerDot, { backgroundColor: '#4A3525' }]} />
            <TextInput 
              style={styles.routeInput}
              value={penjemputan}
              onChangeText={(txt) => handleTextTypingOnly(txt, 'JEMPUT')}
              placeholder="Ketik lokasi jemput (Contoh: Bank BRI Ciamis)..."
              placeholderTextColor="#BCAAA4"
            />
          </View>
          
          <TouchableOpacity style={styles.btnCariSasis} onPress={() => eksekusiCariAlamatSatelit('JEMPUT')}>
            {loadingPencarian && targetInputFocus === 'JEMPUT' ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <Ionicons name="search" size={14} color="#fff" />
                <Text style={styles.btnCariText}>Cari</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12}}>
          <Text style={styles.inputLabel}>Alamat Tujuan</Text>
          <TouchableOpacity onPress={() => { targetBukuAlamat.current = 'ANTAR'; router.push({ pathname: '/(warga)/addresses', params: { mode: 'select', event_name: 'ALAMAT_MIGO_SAH' } }); }}>
             <Text style={styles.btnBukuAlamatTxt}>📖 Pilih Alamat</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.inputBarRow}>
          <View style={styles.inputFieldContainer}>
            <View style={[styles.markerDot, { backgroundColor: '#8D6E63' }]} />
            <TextInput 
              style={styles.routeInput}
              value={tujuan}
              onChangeText={(txt) => handleTextTypingOnly(txt, 'ANTAR')}
              placeholder="Ketik lokasi tujuan pengantaran..."
              placeholderTextColor="#BCAAA4"
            />
          </View>
          
          <TouchableOpacity style={styles.btnCariSasis} onPress={() => eksekusiCariAlamatSatelit('ANTAR')}>
            {loadingPencarian && targetInputFocus === 'ANTAR' ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <Ionicons name="search" size={14} color="#fff" />
                <Text style={styles.btnCariText}>Cari</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* BOX LIST SARAN ALAMAT */}
      {saranList.length > 0 && (
        <View style={styles.dropdownSaranContainerTop}>
          <Text style={styles.dropdownHintLabel}>📍 TEMPAT SEKITAR LAINNYA YANG COCOK:</Text>
          {saranList.map((item) => (
            <TouchableOpacity key={item.id} style={styles.saranRowBtn} onPress={() => handlePilihSaranAlamat(item)}>
              <View style={styles.clockIconBg}>
                <Ionicons name="location-sharp" size={14} color="#D35400" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.saranMainText} numberOfLines={1}>{item.namaTempat}</Text>
                <Text style={styles.saranSubText} numberOfLines={1}>{item.deskripsiSub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* AREA LIVE PETA MAPS MAPVIEW */}
      <View style={styles.mapAreaWrapper}>
        <MapView 
          ref={mapRef}
          style={styles.liveMapStyle} 
          initialRegion={petaRegion} 
          showsUserLocation={false} 
          showsCompass={true}
          showsMyLocationButton={false}
          onPoiClick={handleKetukTempatDiPeta}
          onPress={() => { Keyboard.dismiss(); setSaranList([]); }}
        >
          {koordinatRutePolyline.length > 0 && <Polyline coordinates={koordinatRutePolyline} strokeColor="#2980B9" strokeWidth={4} />}
          
          <Marker 
            key={gpsReady ? `track-jemput-${koordinatJemput.latitude}` : "jemput-init"}
            draggable 
            coordinate={koordinatJemput} 
            onDragEnd={(e) => handleSelesaiGeserPinJemput(e.nativeEvent.coordinate)} 
            title="Lokasi Penjemputan MIGO" 
          >
            <View style={styles.markerContainerFix}>
              <View style={styles.customMarkerBigJemput}><FontAwesome5 name={iconArmada} size={14} color="#fff" /></View>
              <View style={[styles.markerPinTail, { backgroundColor: '#4A3525' }]} />
            </View>
          </Marker>

          <Marker 
            key={`track-antar-${koordinatAntar.latitude}`}
            draggable 
            coordinate={koordinatAntar} 
            onDragEnd={(e) => handleSelesaiGeserPinAntar(e.nativeEvent.coordinate)} 
            title="Lokasi Target Tujuan" 
          >
            <View style={styles.markerContainerFix}>
              <View style={styles.customMarkerBigAntar}><FontAwesome5 name="flag-checkered" size={13} color="#fff" /></View>
              <View style={[styles.markerPinTail, { backgroundColor: '#8D6E63' }]} />
            </View>
          </Marker>
        </MapView>

        <TouchableOpacity 
          style={styles.floatingGpsBtn}
          onPress={ambilLokasiGpsWargaManual}
          disabled={loadingGPS}
        >
          {loadingGPS ? <ActivityIndicator size="small" color="#4A3525" /> : <Ionicons name="locate" size={20} color="#4A3525" />}
        </TouchableOpacity>
      </View>

      {/* PANEL UTAMA CHECKOUT BOOKING */}
      <View style={[styles.bookingPanel, { paddingBottom: insets.bottom || 20 }]}>
        {loadingTarif || loadingRute ? (
          <View style={{ paddingVertical: 14, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#4A3525" />
            <Text style={{ fontSize: 11, color: '#8D6E63', marginTop: 6, fontWeight: '700' }}>Menyelaraskan rute aspal jalan raya Ciamis...</Text>
          </View>
        ) : jarakEstimasi ? (
          <View style={styles.invoiceSection}>
            <View style={styles.invoiceRow}>
              <View style={styles.armadaInfoRow}>
                <FontAwesome5 name={iconArmada} size={13} color="#4A3525" />
                <Text style={styles.armadaLabelText}>{labelArmada} Express</Text>
              </View>
              <Text style={styles.priceValueText}>Rp {totalTarifAmunisi.toLocaleString('id-ID')}</Text>
            </View>
            <Text style={styles.invoiceSubDetail}>Jarak Nyata: {jarakEstimasi} Km ({waktuEstimasi})</Text>
            
            <Text style={styles.paymentMethodHeading}>PILIH METODE PEMBAYARAN:</Text>
            <View style={styles.paymentMethodGroupRow}>
              <TouchableOpacity 
                style={[styles.paymentMethodChip, metodePembayaran === 'TUNAI' && styles.paymentMethodChipActive]} 
                onPress={() => setMetodePembayaran('TUNAI')}
                activeOpacity={0.8}
              >
                <FontAwesome5 name="money-bill-wave" size={12} color={metodePembayaran === 'TUNAI' ? '#fff' : '#8D6E63'} />
                <Text style={[styles.paymentMethodChipText, metodePembayaran === 'TUNAI' && styles.paymentMethodChipTextActive]}>
                  Bayar Tunai (Cash)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.paymentMethodChip, metodePembayaran === 'SALDO' && styles.paymentMethodChipActive]} 
                onPress={() => setMetodePembayaran('SALDO')}
                activeOpacity={0.8}
              >
                <FontAwesome5 name="wallet" size={11} color={metodePembayaran === 'SALDO' ? '#fff' : '#4A3525'} />
                <Text style={[styles.paymentMethodChipText, metodePembayaran === 'SALDO' && styles.paymentMethodChipTextActive]}>
                  PAMILO-Pay (Saldo)
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.btnOrderConfirm, loadingPesan && { opacity: 0.6 }]} 
              onPress={handleKirimOrderanMigo} 
              disabled={loadingPesan}
            >
              {loadingPesan ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnOrderConfirmText}>Konfirmasi Pesan SEKARANG</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.btnCalculate} onPress={handleHitungRuteTarif}>
            <Ionicons name="navigate" size={15} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.btnCalculateText}>Hitung Jarak Rute Jalan Raya</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAF8F5' },
  topInputsPanel: { backgroundColor: '#fff', padding: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 3, zIndex: 15 },
  inputLabel: { fontSize: 11, fontWeight: '800', color: '#4A3525', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  btnBukuAlamatTxt: { fontSize: 10, fontWeight: 'bold', color: '#D35400', marginBottom: 4 },
  inputBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  inputFieldContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDFCFB', borderWidth: 1, borderColor: '#EFEBE9', borderRadius: 12, paddingHorizontal: 12, height: 46 },
  mapAreaWrapper: { flex: 1, position: 'relative' },
  liveMapStyle: { ...StyleSheet.absoluteFillObject },
  markerContainerFix: { width: 44, height: 52, alignItems: 'center', justifyContent: 'flex-start', backgroundColor: 'transparent' },
  customMarkerBigJemput: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4A3525', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff', elevation: 6 },
  customMarkerBigAntar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#8D6E63', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff', elevation: 6 },
  markerPinTail: { width: 4, height: 8, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, marginTop: -1 },
  dropdownSaranContainerTop: { position: 'absolute', left: 16, right: 16, top: 185, backgroundColor: '#FFF8F4', borderRadius: 16, borderWidth: 1, borderColor: '#FFCCBC', elevation: 12, zIndex: 999, padding: 10 },
  dropdownHintLabel: { fontSize: 9, fontWeight: 'bold', color: '#D35400', letterSpacing: 0.5, marginBottom: 4, paddingLeft: 4 },
  saranRowBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#FFE0B2' },
  clockIconBg: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center' },
  saranMainText: { fontSize: 12, fontWeight: 'bold', color: '#4A3525' },
  saranSubText: { fontSize: 10, color: '#8D6E63', marginTop: 1 },
  bookingPanel: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, elevation: 15, borderWidth: 1, borderColor: '#EFEBE9', zIndex: 10 },
  markerDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  routeInput: { flex: 1, color: '#4A3525', fontSize: 12, paddingVertical: 0, fontWeight: '600' },
  btnCariSasis: { flexDirection: 'row', backgroundColor: '#D35400', height: 46, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 4, elevation: 1 },
  btnCariText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  btnCalculate: { backgroundColor: '#4A3525', flexDirection: 'row', height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginTop: 5 },
  btnCalculateText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  invoiceSection: { paddingTop: 2 },
  invoiceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  armadaInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  armadaLabelText: { fontSize: 12, fontWeight: 'bold', color: '#4A3525' },
  priceValueText: { fontSize: 17, fontWeight: '900', color: '#D35400' },
  invoiceSubDetail: { fontSize: 10, color: '#8D6E63', marginTop: 2 },
  paymentMethodHeading: { fontSize: 9, fontWeight: '900', color: '#A1887F', letterSpacing: 0.8, marginTop: 14, marginBottom: 8 },
  paymentMethodGroupRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  paymentMethodChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FAF8F5', borderWidth: 1, borderColor: '#E0D4CE', height: 38, borderRadius: 10 },
  paymentMethodChipActive: { backgroundColor: '#4A3525', borderColor: '#4A3525', elevation: 1 },
  paymentMethodChipText: { fontSize: 11, color: '#8D6E63', fontWeight: '700' },
  paymentMethodChipTextActive: { color: '#fff', fontWeight: '900' },
  btnOrderConfirm: { backgroundColor: '#D35400', height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  btnOrderConfirmText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  floatingGpsBtn: { position: 'absolute', right: 16, bottom: 20, backgroundColor: '#fff', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, zIndex: 99 }
});