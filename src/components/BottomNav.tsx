import { Calendar, Store, Users, BadgeCheck, LineChart, MapPin } from 'lucide-react';

interface BottomNavProps {
  currentScreen: string;
  setCurrentScreen: (screen: string) => void;
  accessibleMenus?: string[];
}

export default function BottomNav({ currentScreen, setCurrentScreen, accessibleMenus = [] }: BottomNavProps) {
  const allNavItems = [
    { id: 'jadwal', icon: Calendar, label: 'Booking' },
    { id: 'dashboard', icon: Store, label: 'POS' },
    { id: 'member', icon: Users, label: 'Member' },
    { id: 'staff', icon: BadgeCheck, label: 'Staf' },
    { id: 'laporan', icon: LineChart, label: 'Laporan' },
  ];

  // Filter nav items based on accessible menus
  const navItems = allNavItems.filter(item => accessibleMenus.includes(item.id));

  // If no items are accessible, don't render the nav
  if (navItems.length === 0 && !accessibleMenus.includes('absen')) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 w-full flex justify-around items-end px-4 pb-6 h-24 bg-[#f0f7ff]/80 backdrop-blur-[24px] rounded-t-[3rem] z-50 shadow-[0_-20px_40px_rgba(0,50,74,0.06)] border-t border-white/40">
      
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentScreen === item.id;
        
        return (
          <div 
            key={item.id}
            onClick={() => setCurrentScreen(item.id)}
            className={`flex flex-col items-center justify-center transition-all duration-300 cursor-pointer px-2 ${
              isActive 
                ? 'bg-gradient-to-br from-primary to-primary-container text-white rounded-full p-3 shadow-lg -translate-y-2 active:scale-95' 
                : 'text-on-surface/50 hover:text-primary active:scale-95'
            }`}
          >
            <Icon size={isActive ? 24 : 24} />
            <span className="font-label text-[10px] font-bold uppercase tracking-widest mt-1">
              {item.label}
            </span>
          </div>
        );
      })}

      {/* Special Absen Button */}
      {accessibleMenus.includes('absen') && (
        <div 
          onClick={() => setCurrentScreen('absen')}
          className={`flex flex-col items-center justify-center transition-all duration-300 cursor-pointer px-2 ${
            currentScreen === 'absen'
              ? 'bg-gradient-to-br from-primary to-primary-container text-white rounded-full p-3 shadow-lg -translate-y-2 active:scale-95' 
              : 'text-on-surface/50 hover:text-primary active:scale-95'
          }`}
        >
          <MapPin size={24} />
          <span className="font-label text-[10px] font-bold uppercase tracking-widest mt-1">
            Absen
          </span>
        </div>
      )}

    </nav>
  );
}
