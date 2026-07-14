// features/migo/useMigo.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { migoRepository } from './migoRepository';

export interface LocationState {
  address: string;
  latitude: number;
  longitude: number;
}

export const useMigo = (serviceType: 'motor' | 'mobil') => {
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  const [activeInput, setActiveInputState] = useState<'pickup' | 'destination'>('pickup');
  const activeInputRef = useRef<'pickup' | 'destination'>('pickup');
  const isUserInteractedRef = useRef<boolean>(false); 
  
  const [pickup, setPickup] = useState<LocationState | null>(null);
  const [destination, setDestination] = useState<LocationState | null>(null);
  
  const [pickupQuery, setPickupQuery] = useState<string>('');
  const [destinationQuery, setDestinationQuery] = useState<string>('');
  
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchingData, setSearchingData] = useState<boolean>(false);
  
  const [tarifPerKm, setTarifPerKm] = useState<number>(serviceType === 'mobil' ? 5000 : 2500); 
  const [biayaLayanan, setBiayaLayanan] = useState<number>(1000); 
  
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [tarifMurni, setTarifMurni] = useState<number>(0); 
  const [totalFare, setTotalFare] = useState<number>(0); 
  const [paymentMethod, setPaymentMethod] = useState<'TUNAI' | 'PAMILO_PAY'>('TUNAI');

  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [forceMapCenter, setForceMapCenter] = useState<{lat: number, lng: number, timestamp: number} | null>(null);

  const searchTimeoutRef = useRef<any>(null);
  const EMAIL_DEVELOPER = 'admin@pamilo.id'; 

  const setActiveInput = useCallback((input: 'pickup' | 'destination') => {
    isUserInteractedRef.current = true;
    activeInputRef.current = input;
    setActiveInputState(input);
  }, []);

  useEffect(() => {
    if (!pickup || !destination) {
      setDistanceKm(0); setTarifMurni(0); setTotalFare(0); setRouteCoordinates([]);
    }
  }, [pickup, destination]);

  useEffect(() => { setSuggestions([]); }, [activeInput]);

  useEffect(() => {
    const muatKonfigurasiAdmin = async () => {
      try {
        const { data, error } = await supabase.from('pengaturan_aplikasi').select('kunci_konfigurasi, nilai_konfigurasi');
        if (!error && data) {
          const konfigLayanan = data.find(item => item.kunci_konfigurasi === 'BIAYA_LAYANAN_TRANSAKSI');
          if (konfigLayanan) setBiayaLayanan(Number(konfigLayanan.nilai_konfigurasi));
          const kunciTarif = serviceType === 'mobil' ? 'ONGKIR_MOBIL_PER_KM' : 'ONGKIR_PER_KM';
          const konfigTarif = data.find(item => item.kunci_konfigurasi === kunciTarif);
          if (konfigTarif) setTarifPerKm(Number(konfigTarif.nilai_konfigurasi));
        }
      } catch (err) {}
    };
    muatKonfigurasiAdmin();
  }, [serviceType]);

  useEffect(() => {
    let isMounted = true;
    const safetyTimer = setTimeout(() => { if (isMounted && loading) setLoading(false); }, 1500);

    const fetchDefaultPickup = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) { if (isMounted) setLoading(false); return; }

        // BERSIH: Panggil lewat Repository
        const data = await migoRepository.getDefaultAddress(user.id);

        if (isMounted && data) {
          const defaultLoc = { address: data.alamat_lengkap, latitude: Number(data.latitude), longitude: Number(data.longitude) };
          setPickup(defaultLoc);
          setPickupQuery(data.alamat_lengkap);

          if (!isUserInteractedRef.current) {
            setActiveInput('destination');
            setForceMapCenter({ lat: Number(data.latitude), lng: Number(data.longitude), timestamp: Date.now() });
          }
        }
      } catch (err) {
      } finally {
        if (isMounted) { setLoading(false); clearTimeout(safetyTimer); }
      }
    };
    fetchDefaultPickup();
    return () => { isMounted = false; clearTimeout(safetyTimer); };
  }, [setActiveInput]);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    const targetInput = activeInputRef.current;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&email=${EMAIL_DEVELOPER}`, { headers: { 'User-Agent': 'PAMILO_Production' } });
      const data = await response.json();
      let cleanAddress = data.display_name || `${lat}, ${lng}`;

      if (data.address) {
        const addr = data.address;
        const namaTempatSpesifik = addr.school || addr.cafe || addr.restaurant || addr.amenity || addr.shop || addr.mall || addr.supermarket || addr.hospital || addr.clinic || addr.hotel || addr.office || addr.government || addr.place_of_worship || addr.mosque || addr.church || addr.tourism || addr.historic || addr.building;
        if (namaTempatSpesifik && !cleanAddress.startsWith(namaTempatSpesifik)) {
          cleanAddress = `${namaTempatSpesifik}, ${cleanAddress}`;
        }
      }

      if (targetInput === 'pickup') { setPickup({ address: cleanAddress, latitude: lat, longitude: lng }); setPickupQuery(cleanAddress); } 
      else { setDestination({ address: cleanAddress, latitude: lat, longitude: lng }); setDestinationQuery(cleanAddress); }
    } catch (err) {}
  }, []);

  const searchAddress = useCallback((text: string, overrideType?: 'pickup' | 'destination') => {
    isUserInteractedRef.current = true;
    const targetInput = overrideType || activeInputRef.current;
    
    if (targetInput === 'pickup') setPickupQuery(text);
    else setDestinationQuery(text);

    if (text.trim().length < 3) { setSuggestions([]); return; }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setSearchingData(true);
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=id&limit=5&email=${EMAIL_DEVELOPER}`, { headers: { 'User-Agent': 'PAMILO_Production', 'Accept': 'application/json' } });
        if (!response.ok) throw new Error('OSM Blocked');
        const data = await response.json();
        setSuggestions(data);
      } catch (err) {} finally { setSearchingData(false); }
    }, 600); 
  }, []);

  useEffect(() => { return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); }; }, []);

  const selectSuggestion = useCallback((item: any, overrideType?: 'pickup' | 'destination') => {
    const targetInput = overrideType || activeInputRef.current;
    const selectedLoc = { address: item.display_name, latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) };

    if (targetInput === 'pickup') { setPickup(selectedLoc); setPickupQuery(item.display_name); } 
    else { setDestination(selectedLoc); setDestinationQuery(item.display_name); }
    
    setSuggestions([]); 
    setForceMapCenter({ lat: selectedLoc.latitude, lng: selectedLoc.longitude, timestamp: Date.now() });
    return selectedLoc; 
  }, []);

  const clearInput = useCallback((type: 'pickup' | 'destination') => {
    if (type === 'pickup') { setPickup(null); setPickupQuery(''); } 
    else { setDestination(null); setDestinationQuery(''); }
    setSuggestions([]);
  }, []);

  useEffect(() => {
    if (!pickup || !destination) return;
    const calculateRoute = async () => {
      try {
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${pickup.longitude},${pickup.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`);
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const rawDistance = parseFloat((route.distance / 1000).toFixed(1));
          const coords = route.geometry.coordinates.map((point: number[]) => ({ latitude: point[1], longitude: point[0] }));
          
          setDistanceKm(rawDistance); setRouteCoordinates(coords); setTarifMurni(rawDistance * tarifPerKm); setTotalFare((rawDistance * tarifPerKm) + biayaLayanan); 
        }
      } catch (err) {}
    };
    calculateRoute();
  }, [pickup, destination, serviceType, tarifPerKm, biayaLayanan]);

  const createMigoOrder = async () => {
    if (!pickup || !destination || distanceKm === 0) return { success: false, message: 'Harap tentukan rute perjalanan terlebih dahulu.' };
    try {
      setSubmitting(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('Sesi pendaftaran Anda telah berakhir.');

      // BERSIH: Pembuatan pesanan dipindah ke Repository
      const orderId = await migoRepository.createOrder({
        pembeli_id: session.user.id,
        alamat_jemput: pickup.address, latitude_jemput: pickup.latitude, longitude_jemput: pickup.longitude,
        alamat_antar: destination.address, latitude_tujuan: destination.latitude, longitude_tujuan: destination.longitude,
        jarak_km: distanceKm, total_pembayaran: totalFare, metode_pembayaran: paymentMethod,
        tipe_layanan: serviceType === 'mobil' ? 'MIGO_CAR' : 'MIGO_RIDE', status_order: 'MENCARI_DRIVER', biaya_layanan: biayaLayanan 
      });

      return { success: true, orderId };
    } catch (err: any) { return { success: false, message: err.message }; } finally { setSubmitting(false); }
  };

  return {
    loading, submitting, activeInput, setActiveInput, pickup, destination, pickupQuery, destinationQuery, suggestions, searchingData,
    distanceKm, tarifMurni, biayaLayanan, totalFare, paymentMethod, setPaymentMethod, routeCoordinates, forceMapCenter,
    reverseGeocode, searchAddress, selectSuggestion, clearInput, createMigoOrder
  };
};