// features/setting/useSetting.ts
import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/utils/supabaseClient';

export interface UserProfile {
  nama: string;
  email: string;
  id: string;
}

export const useSetting = () => {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchUserProfile = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setProfile({
          id: session.user.id,
          email: session.user.email || '',
          nama: session.user.user_metadata?.nama || 'Warga Tatar Galuh'
        });
      }
    } catch (err: any) {
      console.error('[FETCH PROFILE ERROR]:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Keluar Akun',
      'Apakah Anda yakin ingin keluar dari aplikasi PAMILO?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.auth.signOut();
              if (error) throw error;
              
              // Tendang langsung ke gerbang masuk setelah sesi dihapus
              router.replace('/(auth)/login' as any);
            } catch (err: any) {
              Alert.alert('Gagal Keluar', err.message || 'Terjadi gangguan sistem.');
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  return { profile, isLoading, handleLogout, refresh: fetchUserProfile };
};