import { useState, useEffect } from 'react';
import { TrendingUp, Download, Calendar, DollarSign, Activity, Users, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function Laporan() {
  const [totalBookings, setTotalBookings] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [averageTransaction, setAverageTransaction] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const qBookings = query(collection(db, 'bookings'));
    const unsubscribeBookings = onSnapshot(qBookings, (snapshot) => {
      setTotalBookings(snapshot.size);
    });

    const qMembers = query(collection(db, 'members'));
    const unsubscribeMembers = onSnapshot(qMembers, (snapshot) => {
      setTotalMembers(snapshot.size);
    });

    const qTransactions = query(collection(db, 'transactions'));
    const unsubscribeTransactions = onSnapshot(qTransactions, (snapshot) => {
      let revenue = 0;
      snapshot.forEach((doc) => {
        revenue += doc.data().total || 0;
      });
      setTotalRevenue(revenue);
      setAverageTransaction(snapshot.size > 0 ? revenue / snapshot.size : 0);
      setIsLoading(false);
    });

    return () => {
      unsubscribeBookings();
      unsubscribeMembers();
      unsubscribeTransactions();
    };
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="pt-28 pb-32 px-6 md:px-12 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-headline font-extrabold text-primary tracking-tight">Laporan & Analitik</h1>
          <p className="text-on-surface-variant font-medium mt-2">Pantau performa bisnis, pendapatan, dan tren layanan.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-5 py-3 rounded-2xl bg-surface-container-lowest border border-white/60 shadow-sm text-on-surface-variant hover:text-primary hover:bg-primary-container/20 transition-colors flex items-center gap-2 font-bold">
            <Calendar size={20} />
            Bulan Ini
          </button>
          <button className="px-5 py-3 rounded-2xl bg-primary text-white font-bold flex items-center gap-2 shadow-[0_10px_20px_rgba(5,99,128,0.2)] hover:shadow-[0_15px_25px_rgba(5,99,128,0.3)] active:scale-95 transition-all">
            <Download size={20} />
            Unduh PDF
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-white/60">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-full bg-primary-container/50 flex items-center justify-center text-primary">
              <DollarSign size={24} />
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-on-surface-variant bg-surface-container-highest px-2 py-1 rounded-md">
              0%
            </span>
          </div>
          <p className="text-sm font-label text-on-surface-variant uppercase tracking-widest font-bold mb-1">Total Pendapatan</p>
          <h3 className="text-2xl font-headline font-extrabold text-on-surface">{isLoading ? '...' : formatCurrency(totalRevenue)}</h3>
        </div>

        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-white/60">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-full bg-[#e6f4ea] flex items-center justify-center text-[#006b1f]">
              <Activity size={24} />
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-on-surface-variant bg-surface-container-highest px-2 py-1 rounded-md">
              0%
            </span>
          </div>
          <p className="text-sm font-label text-on-surface-variant uppercase tracking-widest font-bold mb-1">Total Sesi Layanan</p>
          <h3 className="text-2xl font-headline font-extrabold text-on-surface">{isLoading ? '...' : `${totalBookings} Sesi`}</h3>
        </div>

        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-white/60">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-full bg-[#fce8e6] flex items-center justify-center text-[#c5221f]">
              <TrendingUp size={24} />
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-on-surface-variant bg-surface-container-highest px-2 py-1 rounded-md">
              0%
            </span>
          </div>
          <p className="text-sm font-label text-on-surface-variant uppercase tracking-widest font-bold mb-1">Rata-rata Transaksi</p>
          <h3 className="text-2xl font-headline font-extrabold text-on-surface">{isLoading ? '...' : formatCurrency(averageTransaction)}</h3>
        </div>

        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-white/60">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-full bg-[#fff4d6] flex items-center justify-center text-[#b8860b]">
              <Users size={24} />
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-on-surface-variant bg-surface-container-highest px-2 py-1 rounded-md">
              0%
            </span>
          </div>
          <p className="text-sm font-label text-on-surface-variant uppercase tracking-widest font-bold mb-1">Total Member</p>
          <h3 className="text-2xl font-headline font-extrabold text-on-surface">{isLoading ? '...' : `${totalMembers} Orang`}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Area (Simulated) */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-3xl p-6 md:p-8 shadow-[0_20px_40px_rgba(0,50,74,0.04)] border border-white/60">
          <h3 className="text-xl font-headline font-bold mb-6">Grafik Pendapatan</h3>
          
          <div className="h-64 flex items-end justify-between gap-2 pt-4 border-b border-outline-variant/30 pb-2">
            {/* Simulated Bar Chart - Will be replaced with real chart later */}
            {[0, 0, 0, 0, 0, 0, 0].map((height, i) => (
              <div key={i} className="w-full flex flex-col items-center gap-2 group">
                <div className="w-full max-w-[40px] bg-primary-container/40 rounded-t-lg relative group-hover:bg-primary transition-colors" style={{ height: `${height}%` }}>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-on-surface text-surface px-2 py-1 rounded text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Rp{height}
                  </div>
                </div>
                <span className="text-xs font-label text-on-surface-variant">H{i+1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Services */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 shadow-[0_20px_40px_rgba(0,50,74,0.04)] border border-white/60">
          <h3 className="text-xl font-headline font-bold mb-6">Layanan Terpopuler</h3>
          <div className="space-y-6">
            <div className="text-center text-on-surface-variant text-sm py-8">
              Belum ada data transaksi yang cukup.
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
