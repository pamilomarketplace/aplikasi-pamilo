// features/info-galuh/useInfoGaluh.ts
import { useState, useCallback, useRef } from 'react';
import { Linking, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { infoGaluhService } from './infoGaluhService';

export const useInfoGaluh = () => {
  const [loading, setLoading] = useState(true);
  const [loadingDarurat, setLoadingDarurat] = useState(false);
  const [activeSubMenu, setActiveSubMenu] = useState('ALL');

  const [beritaList, setBeritaList] = useState<any[]>([]);
  const [lokerList, setLokerList] = useState<any[]>([]);
  const [wisataList, setWisataList] = useState<any[]>([]);
  const [kontakDaruratList, setKontakDaruratList] = useState<any[]>([]);
  const [bannerHighlightList, setBannerHighlightList] = useState<any[]>([]);

  const [selectedZona, setSelectedZona] = useState<any>(null);
  const [selectedKecamatan, setSelectedKecamatan] = useState<string | null>(null);
  const [modalDaruratVisible, setModalDaruratVisible] = useState(false);

  const isFirstMount = useRef(true);

  const fetchLiveData = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) setLoading(true);
      const data = await infoGaluhService.getInfoGaluhDashboardData();
      
      setBannerHighlightList(data.bannerHighlights);
      setBeritaList(data.beritaList);
      setLokerList(data.lokerList);
      setWisataList(data.wisataList);
    } catch (e: any) {
      console.error("Gagal menarik sasis data info galuh:", e);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isFirstMount.current) {
        fetchLiveData(true);
        isFirstMount.current = false;
      } else {
        fetchLiveData(false);
      }
    }, [])
  );

  const handlePilihKecamatanDarurat = async (namaKecamatan: string) => {
    setSelectedKecamatan(namaKecamatan);
    setKontakDaruratList([]);
    setLoadingDarurat(true);
    try {
      const contacts = await infoGaluhService.getEmergencyContacts(namaKecamatan);
      setKontakDaruratList(contacts);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingDarurat(false);
    }
  };

  const handleHubungiNomor = (nomor: string, tipe: string = 'tel') => {
    if (!nomor) return;
    if (tipe === 'wa') {
      const cleanFlexWa = nomor.replace(/[^0-9]/g, '');
      const formatWa = cleanFlexWa.startsWith('0') ? '62' + cleanFlexWa.slice(1) : cleanFlexWa;
      Linking.openURL(`https://wa.me/${formatWa}?text=Sampurasun%20Admin,%20saya%20tertarik%20dengan%20lowongan%20kerja%20yang%20ada%20di%20Aplikasi%20PAMILO`);
    } else {
      Linking.openURL(`tel:${nomor}`);
    }
  };

  const closeModalDarurat = () => {
    setModalDaruratVisible(false);
    setSelectedZona(null);
    setSelectedKecamatan(null);
    setKontakDaruratList([]);
  };

  return {
    loading,
    loadingDarurat,
    activeSubMenu,
    setActiveSubMenu,
    beritaList,
    lokerList,
    wisataList,
    kontakDaruratList,
    bannerHighlightList,
    selectedZona,
    setSelectedZona,
    selectedKecamatan,
    setSelectedKecamatan,
    modalDaruratVisible,
    setModalDaruratVisible,
    handlePilihKecamatanDarurat,
    handleHubungiNomor,
    closeModalDarurat,
    refreshData: () => fetchLiveData(false)
  };
};