// features/orders/useOrders.ts
import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { orderService } from './orderService';

/**
 * Custom Hook untuk mengelola daftar pesanan (Satu list untuk multi-role)
 */
export const useOrders = (userId: string, role: 'WARGA' | 'DRIVER' | 'SELLER') => {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const data = await orderService.getOrdersByRole(userId, role);
      setOrders(data);
    } catch (error: any) {
      Alert.alert('Gagal Memuat Pesanan', error.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  };

  const changeStatus = async (
    orderId: string, 
    newStatus: 'PENDING' | 'ACCEPTED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED'
  ) => {
    try {
      await orderService.updateOrderStatus(orderId, newStatus);
      // Sinkronisasi ulang data lokal agar tampilan UI langsung ter-update
      await fetchOrders();
      Alert.alert('Sukses', `Status pesanan berhasil diperbarui menjadi: ${newStatus}`);
    } catch (error: any) {
      Alert.alert('Gagal Memperbarui Status', error.message);
    }
  };

  useEffect(() => {
    if (userId && role) {
      fetchOrders();
    }
  }, [userId, role]);

  return { orders, isLoading, refresh: fetchOrders, changeStatus };
};

/**
 * Custom Hook untuk mengelola halaman rincian detail pesanan tunggal ([id].tsx)
 */
export const useOrderDetail = (orderId: string) => {
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDetail = async () => {
    setIsLoading(true);
    try {
      const data = await orderService.getOrderById(orderId);
      setOrder(data);
    } catch (error: any) {
      Alert.alert('Gagal Memuat Detail', error.message || 'Pesanan tidak ditemukan.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchDetail();
    }
  }, [orderId]);

  return { order, isLoading, refresh: fetchDetail };
};