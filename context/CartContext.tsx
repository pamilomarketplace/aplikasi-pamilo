import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Definisi tipe data item di dalam keranjang PAMILO
export interface CartItem {
  id: number;
  nama_produk: string;
  harga: number;
  foto_produk: string;
  quantity: number;
}

// Tipe fleksibel untuk menerima data produk dari berbagai versi tampilan
export type ProductInput = {
  id: number;
  nama_produk?: string;
  name?: string;
  harga: number;
  foto_produk?: string;
  image?: string;
  quantity?: number;
} | number;

export interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: ProductInput, qty?: number) => void;
  updateCartQuantity: (id: number, qty: number) => void;
  removeFromCart: (id: number) => void;
  clearCart: () => void;
  getCartCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  // 📡 PIPA 1: Membaca memori harddisk HP saat aplikasi pertama kali menyala (Bypass Reset)
  useEffect(() => {
    const muatDataKeranjangLokal = async () => {
      try {
        const dataSemen = await AsyncStorage.getItem('@pamilo_cart_session');
        if (dataSemen !== null) {
          setCartItems(JSON.parse(dataSemen));
        }
      } catch (e) {
        console.error("Gagal membaca memori lokal keranjang:", e);
      } finally {
        setIsStorageLoaded(true);
      }
    };
    muatDataKeranjangLokal();
  }, []);

  // 📡 PIPA 2: Menyemen otomatis setiap kali ada perubahan data (Tambah/Kurang/Hapus)
  useEffect(() => {
    const semenKeranjangKeStorage = async () => {
      try {
        if (isStorageLoaded) {
          await AsyncStorage.setItem('@pamilo_cart_session', JSON.stringify(cartItems));
        }
      } catch (e) {
        console.error("Gagal mengunci data keranjang ke storage:", e);
      }
    };
    semenKeranjangKeStorage();
  }, [cartItems, isStorageLoaded]);

  // Fungsi Tambah ke Keranjang Adaptif (Bisa terima object utuh atau parameter terpisah via overload)
  const addToCart = (product: ProductInput, qty: number = 1) => {
    setCartItems((prevItems) => {
      // Deteksi apakah input berupa object detail langsung (Jalur Detail Baru) atau ID murni
      const targetId = typeof product === 'object' ? product.id : product;
      const existingItem = prevItems.find((item) => item.id === targetId);

      if (existingItem) {
        return prevItems.map((item) =>
          item.id === targetId
            ? { ...item, quantity: item.quantity + (typeof product === 'object' ? (product.quantity || qty) : qty) }
            : item
        );
      }

      // Jika produk baru pertama kali dimasukkan
      if (typeof product === 'object') {
        return [
          ...prevItems,
          {
            id: product.id,
            nama_produk: product.nama_produk || product.name || 'Produk Tanpa Nama',
            harga: product.harga || 0,
            foto_produk: product.foto_produk || product.image || '',
            quantity: product.quantity || qty,
          },
        ];
      }
      return prevItems; // Fallback aman
    });
  };

  const updateCartQuantity = (id: number, qty: number) => {
    if (qty <= 0) {
      removeFromCart(id);
      return;
    }
    setCartItems((prevItems) =>
      prevItems.map((item) => (item.id === id ? { ...item, quantity: qty } : item))
    );
  };

  const removeFromCart = (id: number) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getCartCount = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  return (
    <CartContext.Provider value={{ cartItems, addToCart, updateCartQuantity, removeFromCart, clearCart, getCartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}