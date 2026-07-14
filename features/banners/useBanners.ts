// features/banners/useBanners.ts
import { useState, useEffect } from 'react';
import { bannerService } from './bannerService';

export const useBanners = () => {
  const [banners, setBanners] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBanners = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await bannerService.getActiveBanners();
      setBanners(data);
      console.log(`[PAMILO RADAR HOOK] 🔑 State sukses diisi dengan ${data.length} spanduk siap saji.`);
    } catch (err: any) {
      console.error('❌ [PAMILO RADAR HOOK ERROR] Pipa useBanners bocor:', err.message);
      setError(err.message || 'Gagal sinkronisasi spanduk Galuh.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  return { banners, isLoading, error, refetch: fetchBanners };
};