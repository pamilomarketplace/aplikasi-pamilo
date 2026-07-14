// features/driver/useDriverMigo.ts
import { useGlobalDriver } from '@/context/DriverContext';

// 🚀 REFAKTOR TOTAL: Mengalihkan seluruh sasis konsumsi lokal ke pipa Global Context
export const useDriverMigo = () => {
  const globalDriverData = useGlobalDriver();
  
  return {
    isDriver: globalDriverData.isDriver,
    isOnline: globalDriverData.isOnline,
    todayTrips: globalDriverData.todayTrips,
    todayEarnings: globalDriverData.todayEarnings,
    availableOrders: globalDriverData.availableOrders,
    currentActiveOrder: globalDriverData.currentActiveOrder,
    loading: globalDriverData.loading,
    error: globalDriverData.error,
    toggleOnlineStatus: globalDriverData.toggleOnlineStatus,
    acceptOrder: globalDriverData.acceptOrder,
    updateOrderProgress: globalDriverData.updateOrderProgress,
    hitungPendapatanBersihMigo: globalDriverData.hitungPendapatanBersihMigo,
    refreshPool: globalDriverData.refreshPool
  };
};