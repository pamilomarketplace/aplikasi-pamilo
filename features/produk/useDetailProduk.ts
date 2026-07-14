// features/produk/useDetailProduk.ts
import { useState, useEffect, useCallback } from 'react';
import { produkRepository, Produk } from './produkRepository';

export const useDetailProduk = (idProduk: string | undefined) => {
  const [detail, setDetail] = useState<Produk | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(true);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const muatDetail = useCallback(async () => {
    if (!idProduk) {
      setLoadingDetail(false);
      return;
    }

    try {
      setLoadingDetail(true);
      const data = await produkRepository.getDetailProdukSpesifik(idProduk);
      if (!data) throw new Error('Produk tidak ditemukan');
      setDetail(data);
    } catch (err: any) {
      setErrorDetail(err.message);
    } finally {
      setLoadingDetail(false);
    }
  }, [idProduk]);

  useEffect(() => {
    muatDetail();
  }, [muatDetail]);

  return { detail, loadingDetail, errorDetail, refreshDetail: muatDetail };
};