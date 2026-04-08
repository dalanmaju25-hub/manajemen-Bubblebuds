/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { Lock } from 'lucide-react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Booking from './components/Booking';
import Staff from './components/Staff';
import Member from './components/Member';
import Laporan from './components/Laporan';
import Absen from './components/Absen';
import Pengguna from './components/Pengguna';
import Inventaris from './components/Inventaris';
import Layanan from './components/Layanan';
import BottomNav from './components/BottomNav';
import TopHeader from './components/TopHeader';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [accessibleMenus, setAccessibleMenus] = useState<string[]>([]);

  useEffect(() => {
    let userUnsubscribe: () => void;

    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Fetch user profile to get accessible menus
        userUnsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            let menus = userData.accessibleMenus || ['jadwal']; // Default to jadwal if not set
            
            // Auto-inject new menus for legacy users
            if ((userData.role === 'Super Admin' || userData.role === 'Manajer') && !menus.includes('layanan')) {
              menus = [...menus, 'layanan'];
            }

            setAccessibleMenus(menus);
            
            // If current screen is login or not accessible, redirect to first accessible menu
            setCurrentScreen((prev) => {
              if (prev === 'login' || !menus.includes(prev)) {
                // Prefer dashboard if available, otherwise first menu
                return menus.includes('dashboard') ? 'dashboard' : menus[0];
              }
              return prev;
            });
          } else {
            // Fallback if user doc doesn't exist
            setAccessibleMenus(['jadwal']);
            setCurrentScreen('jadwal');
          }
          setIsAuthReady(true);
        }, (error) => {
          console.error("Error fetching user profile:", error);
          // Fallback on error so app doesn't stuck on loading
          setAccessibleMenus(['jadwal']);
          setCurrentScreen('jadwal');
          setIsAuthReady(true);
        });
      } else {
        setCurrentScreen('login');
        setAccessibleMenus([]);
        setIsAuthReady(true);
        if (userUnsubscribe) userUnsubscribe();
      }
    });

    return () => {
      authUnsubscribe();
      if (userUnsubscribe) userUnsubscribe();
    };
  }, []);

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-surface text-primary">Memuat...</div>;
  }

  if (currentScreen === 'login') {
    return <Login onLogin={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface relative">
      
      {/* Global Top Header */}
      <TopHeader currentScreen={currentScreen} setCurrentScreen={setCurrentScreen} accessibleMenus={accessibleMenus} />

      {/* Screens Routing */}
      {currentScreen === 'dashboard' && accessibleMenus.includes('dashboard') && <Dashboard setCurrentScreen={setCurrentScreen} accessibleMenus={accessibleMenus} />}
      {currentScreen === 'jadwal' && accessibleMenus.includes('jadwal') && <Booking />}
      {currentScreen === 'staff' && accessibleMenus.includes('staff') && <Staff />}
      {currentScreen === 'member' && accessibleMenus.includes('member') && <Member />}
      {currentScreen === 'laporan' && accessibleMenus.includes('laporan') && <Laporan />}
      {currentScreen === 'absen' && accessibleMenus.includes('absen') && <Absen />}
      {currentScreen === 'pengguna' && accessibleMenus.includes('pengguna') && <Pengguna />}
      {currentScreen === 'inventaris' && accessibleMenus.includes('inventaris') && <Inventaris />}
      {currentScreen === 'layanan' && accessibleMenus.includes('layanan') && <Layanan />}
      
      {/* Fallback for unauthorized access */}
      {currentScreen !== 'login' && !accessibleMenus.includes(currentScreen) && (
        <div className="pt-32 px-8 text-center animate-in fade-in">
          <div className="w-24 h-24 bg-error-container rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="text-error" size={48} />
          </div>
          <h2 className="text-3xl font-headline font-bold text-error mb-4">Akses Ditolak</h2>
          <p className="text-on-surface-variant font-medium">
            Anda tidak memiliki izin untuk mengakses halaman ini.
          </p>
        </div>
      )}

      {/* Global Bottom Navigation */}
      <BottomNav currentScreen={currentScreen} setCurrentScreen={setCurrentScreen} accessibleMenus={accessibleMenus} />
    </div>
  );
}
