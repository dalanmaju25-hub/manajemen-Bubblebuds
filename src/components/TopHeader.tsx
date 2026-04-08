import { Bell, LogOut } from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface TopHeaderProps {
  currentScreen: string;
  setCurrentScreen: (screen: string) => void;
  accessibleMenus: string[];
}

export default function TopHeader({ currentScreen, setCurrentScreen, accessibleMenus }: TopHeaderProps) {
  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-[#f0f7ff]/70 backdrop-blur-[24px] flex justify-between items-center px-8 h-20 shadow-sm">
      <div className="flex items-center gap-4">
        <img 
          src="/logo.png" 
          alt="Bubble Buds logo" 
          className="h-12 w-12 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
        <h1 className="text-2xl font-extrabold text-primary tracking-tighter font-headline hidden sm:block">Bubble Buds</h1>
      </div>
      <div className="flex items-center gap-6">
        <div className="hidden md:flex gap-8">
          {accessibleMenus.includes('dashboard') && (
            <span 
              onClick={() => setCurrentScreen('dashboard')}
              className={`font-headline font-bold px-4 py-1 rounded-full transition-colors cursor-pointer ${currentScreen === 'dashboard' ? 'text-primary bg-primary-container/30' : 'text-on-surface/60 hover:bg-surface-container-highest'}`}
            >
              Dasbor
            </span>
          )}
          {accessibleMenus.includes('laporan') && (
            <span 
              onClick={() => setCurrentScreen('laporan')}
              className={`font-headline font-bold px-4 py-1 rounded-full transition-colors cursor-pointer ${currentScreen === 'laporan' ? 'text-primary bg-primary-container/30' : 'text-on-surface/60 hover:bg-surface-container-highest'}`}
            >
              Laporan
            </span>
          )}
          {accessibleMenus.includes('inventaris') && (
            <span 
              onClick={() => setCurrentScreen('inventaris')}
              className={`font-headline font-bold px-4 py-1 rounded-full transition-colors cursor-pointer ${currentScreen === 'inventaris' ? 'text-primary bg-primary-container/30' : 'text-on-surface/60 hover:bg-surface-container-highest'}`}
            >
              Inventaris
            </span>
          )}
          {accessibleMenus.includes('layanan') && (
            <span 
              onClick={() => setCurrentScreen('layanan')}
              className={`font-headline font-bold px-4 py-1 rounded-full transition-colors cursor-pointer ${currentScreen === 'layanan' ? 'text-primary bg-primary-container/30' : 'text-on-surface/60 hover:bg-surface-container-highest'}`}
            >
              Layanan
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 rounded-full hover:bg-surface-container-highest active:scale-95 transition-all text-primary">
            <Bell size={24} />
          </button>
          {accessibleMenus.includes('pengguna') && (
            <div 
              onClick={() => setCurrentScreen('pengguna')}
              className={`h-10 w-10 rounded-full bg-primary-container overflow-hidden ring-2 cursor-pointer transition-all ${currentScreen === 'pengguna' ? 'ring-primary' : 'ring-primary/20 hover:ring-primary'}`}
              title="Pengaturan Pengguna"
            >
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBRopDT9ArWOUU9pHH6VOftlC9wPloxjdvVVaLsd3thlMUGy3pe2RhqwtvA6K8wU8CRhPUW6VXD5N_MEuHiupzUOh1khF4TLrrERGu0QaVeB-WIGqZVm9YePq-0hbGn_Y-7aKe2beUZvxPxWTLIG6ZWBATU4T39dTUAIPQq2b36DDP_IotFrnW7oYTW4g-42zQoSPQMP36e3Au8lbdSZzW0z0ghCUH8teQvQrm1bk8TuAHL_gid8ZoELkHOxDPFo2Kwj-mN1nmbweQ" 
                alt="Profil Pemilik"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <button 
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-error-container text-error active:scale-95 transition-all"
            title="Keluar"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
