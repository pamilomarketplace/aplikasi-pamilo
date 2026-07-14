// features/driver/useDriver.ts
import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { driverService } from './driverService';
import { orderService } from '@/features/orders/orderService';

export const useDriver = (driverId: string) => {
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadDriverDashboard = async () => {
    if (!driverId) return;
    setIsLoading(true);
    try {
      const [pool, active] = await Promise.all([
        driverService.getAvailableOrders(),
        driverService.getActiveDriverOrder(driverId)
      ]);
      setAvailableOrders(pool);
      setActiveOrder(active);
    } catch (error: any) {
      console.error('Gagal memuat sirkuit driver:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const takeOrder = async (orderId: string) => {
    if (activeOrder) {
      Alert.alert('Eitss.. Gagal', 'Selesaikan dulu orderan aktif yang sedang Anda bawa saat ini Tuan!');
      return;
    }

    setIsProcessing(true);
    try {
      await driverService.claimOrder(orderId, driverId);
      Alert.alert('Sukses 🎉', 'Orderan berhasil Anda ambil. Segera meluncur ke lokasi toko merchant!');
      await loadDriverDashboard(); // Sinkronkan ulang isi dashboard
    } catch (error: any) {
      Alert.alert('Gagal Mengambil Order', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const updateProgress = async (orderId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACCEPTED' ? 'PICKED_UP' : 'DELIVERED';
    
    setIsProcessing(true);
    try {
      await orderService.updateOrderStatus(orderId, nextStatus);
      Alert.alert('Sukses', `Status orderan diperbarui menjadi: ${nextStatus}`);
      await loadDriverDashboard();
    } catch (error: any) {
      Alert.alert('Gagal Memperbarui Alur', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    loadDriverDashboard();
  }, [driverId]);

  return {
    availableOrders,
    activeOrder,
    isLoading,
    isProcessing,
    refresh: loadDriverDashboard,
    takeOrder,
    updateProgress
  };
};