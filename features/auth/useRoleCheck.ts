// features/auth/useRoleCheck.ts
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/utils/supabaseClient';

export const useRoleCheck = () => {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const executeRouteGuard = async () => {
      try {
        setChecking(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.replace('/login' as any);
          return;
        }

        // 1. Cek Toko Pedagang (Seller)
        const { data: tokoData } = await supabase
          .from('toko')
          .select('id_toko')
          .eq('user_id_toko', user.id)
          .maybeSingle();

        if (tokoData) {
          router.replace('/seller' as any); // Menuju app/seller/index.tsx
          return;
        }

        // 2. Cek Kolom Role Driver di tabel users
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (userData && userData.role === 'DRIVER') {
          router.replace('/driver' as any); // Menuju app/driver/index.tsx
          return;
        }

        // 3. Default: Warga Biasa
        router.replace('/(tabs)' as any); // Menuju app/(tabs)/index.tsx

      } catch (err) {
        console.error('[PAMILO ROLE CHECK GUARD ERROR]', err);
        router.replace('/(tabs)' as any);
      } finally {
        setChecking(false);
      }
    };

    executeRouteGuard();
  }, []);

  return { checking };
};