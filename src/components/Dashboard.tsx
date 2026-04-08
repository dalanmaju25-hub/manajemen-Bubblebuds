import { useState, useEffect } from 'react';
import { 
  Bell, TrendingUp, Search, Droplet, Flower2, Baby, 
  SprayCan, Shirt, Plus, Clock, CheckCircle2, CalendarClock, 
  ShoppingBasket, Banknote, QrCode, CreditCard, Printer, LogOut, Package
} from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

interface DashboardProps {
  setCurrentScreen?: (screen: string) => void;
  accessibleMenus?: string[];
}

interface BookingData {
  id: string;
  memberName: string;
  service: string;
  date: string;
  status: string;
  therapistName?: string;
  room?: string;
}

interface PosItem {
  id: string;
  name: string;
  price: number;
  type: 'service' | 'product';
  category?: string;
  duration?: number;
}

interface CartItem extends PosItem {
  cartId: string;
  quantity: number;
}

export default function Dashboard({ setCurrentScreen, accessibleMenus = [] }: DashboardProps) {
  const [upcomingBookings, setUpcomingBookings] = useState<BookingData[]>([]);
  const [activeBookingsCount, setActiveBookingsCount] = useState(0);
  const [posItems, setPosItems] = useState<PosItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [servicesCount, setServicesCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Tunai');

  useEffect(() => {
    if (!auth.currentUser) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    // Fetch today's bookings
    const q = query(
      collection(db, 'bookings'),
      where('date', '>=', todayStr),
      orderBy('date', 'asc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookings: BookingData[] = [];
      let activeCount = 0;
      snapshot.forEach((doc) => {
        const data = doc.data() as BookingData;
        bookings.push({ id: doc.id, ...data });
        if (data.status === 'Berlangsung' || data.status === 'Terkonfirmasi' || data.status === 'Menunggu Konfirmasi') {
          activeCount++;
        }
      });
      setUpcomingBookings(bookings);
      setActiveBookingsCount(activeCount);
    }, (error) => {
      console.error("Error fetching bookings:", error);
    });

    // Fetch Services
    const qServices = query(collection(db, 'services'));
    const unsubscribeServices = onSnapshot(qServices, (snapshot) => {
      const servicesData: PosItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        servicesData.push({
          id: doc.id,
          name: data.name,
          price: data.price,
          type: 'service',
          category: data.category,
          duration: data.duration
        });
      });
      setServicesCount(servicesData.length);
      setPosItems(prev => {
        const products = prev.filter(item => item.type === 'product');
        return [...servicesData, ...products];
      });
    });

    // Fetch Products (Inventory)
    const qProducts = query(collection(db, 'inventory'), where('category', '==', 'Produk Retail'));
    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
      const productsData: PosItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        productsData.push({
          id: doc.id,
          name: data.name,
          price: data.price,
          type: 'product',
          category: data.category
        });
      });
      setProductsCount(productsData.length);
      setPosItems(prev => {
        const services = prev.filter(item => item.type === 'service');
        return [...services, ...productsData];
      });
    });

    // Fetch Today's Transactions
    const qTransactions = query(
      collection(db, 'transactions'),
      where('createdAt', '>=', new Date(todayStr))
    );
    const unsubscribeTransactions = onSnapshot(qTransactions, (snapshot) => {
      let revenue = 0;
      snapshot.forEach((doc) => {
        revenue += doc.data().total || 0;
      });
      setTodayRevenue(revenue);
    });

    return () => {
      unsubscribe();
      unsubscribeServices();
      unsubscribeProducts();
      unsubscribeTransactions();
    };
  }, []);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const addToCart = (item: PosItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, cartId: Date.now().toString(), quantity: 1 }];
    });
  };

  const removeFromCart = (cartId: string) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'transactions'), {
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          type: item.type
        })),
        subtotal,
        tax,
        total,
        paymentMethod,
        createdAt: serverTimestamp(),
        cashierId: auth.currentUser?.uid,
        cashierName: auth.currentUser?.displayName || 'Kasir'
      });
      setCart([]);
      alert('Transaksi berhasil disimpan!');
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Gagal menyimpan transaksi');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredPosItems = posItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Berlangsung': return 'bg-[#8df48e] text-[#005c19] border-[#006b1f]';
      case 'Terkonfirmasi': return 'bg-[#d3ebff] text-[#005c99] border-[#005c99]';
      case 'Menunggu Konfirmasi': return 'bg-[#e8e883] text-[#545500] border-[#e8e883]';
      default: return 'bg-surface-container-highest text-on-surface-variant border-outline-variant';
    }
  };

  return (
    <div className="pt-28 pb-32 px-6 md:px-12 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* Asymmetric Dashboard Stats */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
        <div className="md:col-span-7 bg-surface-container-lowest rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden group shadow-[0_20px_40px_rgba(0,50,74,0.04)]">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary-container/20 rounded-full blur-3xl group-hover:bg-primary-container/40 transition-all duration-500"></div>
          <div>
            <span className="text-xs font-label uppercase tracking-widest text-primary/60">Performa Hari Ini</span>
            <h2 className="text-4xl font-headline font-extrabold text-on-surface mt-2">{formatCurrency(todayRevenue)}</h2>
            <p className="text-on-surface-variant font-medium flex items-center gap-1 mt-1 text-sm">
              <TrendingUp size={16} />
              Pendapatan hari ini
            </p>
          </div>
          <div className="mt-8 flex gap-4">
            <div className="bg-surface-container-low px-5 py-3 rounded-2xl">
              <span className="block text-xs font-label text-on-surface/50">Layanan</span>
              <span className="font-bold text-lg">{servicesCount}</span>
            </div>
            <div className="bg-surface-container-low px-5 py-3 rounded-2xl">
              <span className="block text-xs font-label text-on-surface/50">Produk</span>
              <span className="font-bold text-lg">{productsCount}</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-5 bg-gradient-to-br from-primary to-primary-container rounded-3xl p-8 text-white flex flex-col justify-between shadow-[0_20px_40px_rgba(5,99,128,0.15)]">
          <div>
            <span className="text-xs font-label uppercase tracking-widest opacity-80">Booking Aktif</span>
            <div className="flex items-end gap-2 mt-2">
              <h2 className="text-5xl font-headline font-bold">{activeBookingsCount}</h2>
              <span className="mb-1 opacity-80 font-medium">/ 25 slot</span>
            </div>
          </div>
          <div className="flex -space-x-3 mt-6">
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDRB91u7OWpQj4FeMJ5r93nC1il8QAoQ5NnO2v8ylhUmeq5CKLypDzX-fc5gVQcTPqCOfxpUB41znkXsCIK4ByAb7imjP-v0Mt_f5T0mS_WFjG1J5jxFiVA4LMQ9SL1eztYvXCnMiZOKJ2hM1jethPwtRJCMuCGHYNv2aPdTv2PTvTV79Cy40jRtoYAa-cqeMNXDXl9dsfYmWMtLW8guuVSD_kzeMdeUEhEly8Goxm4Yb3fTGgEEhd0eLCqD_lKFTsNgV22T_0Mp1Y" alt="Staf 1" className="h-10 w-10 rounded-full border-2 border-primary object-cover" referrerPolicy="no-referrer" />
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDvsGyqxTRg6_8XYQEp5DdVZs8usBd7VDCZAPiCFxzW77gb4ru8PMzEn3nK4kRU86wyGa5lbSzqyNiH6wGEFqMc1umv6jmQayFya9H18MNFFKQNtVMKSoZkuNE10y64z7SqOLduSdcH9MnbILdULwErK4SivZFOEUMc8xpT1bxA_Z3ObMRb-GyBc1Bdf-DIKTalHei7t_zFp-ygSk1tk1dYL2qVe9kDq8Fb1YmYpkZNEYPckYvg-sVWz3Z8YHgughUwp9QMzfuIp1Y" alt="Staf 2" className="h-10 w-10 rounded-full border-2 border-primary object-cover" referrerPolicy="no-referrer" />
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuD1ysp0TpOJflXGcnNzTgQBfgwk0hkSfs1BsIy2f23tRfH-Pl8PQl2ooR3nxvkJn58GpTUI88YQFZLVPRO7vT8oUJM4ZJiaMenFw3G70XLUlOaTFzi4fe0p5hsrKoW2Vyr_zpR1zYnHPXLnpBtoq9n8TG7_mEL6uJskQLBGnVVjzg5B3FiHGQfOzelKTMOoWx93IH0H1Pl8qDhjtQvJgaftANkk0XXnimBoCRfeKn7GZ41IvVZSLYtrwgkLzyGrugao2lRr8lOoy2c" alt="Staf 3" className="h-10 w-10 rounded-full border-2 border-primary object-cover" referrerPolicy="no-referrer" />
            <div className="h-10 w-10 rounded-full border-2 border-primary bg-primary-container text-primary flex items-center justify-center text-xs font-bold z-10">+5</div>
          </div>
        </div>
      </section>

      {/* POS Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Service Selection (POS LEFT) */}
        <section className="lg:col-span-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <h3 className="text-2xl font-headline font-bold">Layanan Cepat</h3>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={20} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari layanan atau produk..." 
                className="w-full pl-12 pr-4 py-3 bg-surface-container-low rounded-2xl border-none focus:ring-2 focus:ring-primary/20 transition-all text-on-surface outline-none"
              />
            </div>
          </div>

          {/* Bento Grid for Services */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filteredPosItems.length === 0 ? (
              <div className="col-span-full text-center py-8 text-on-surface-variant">Tidak ada item ditemukan.</div>
            ) : (
              filteredPosItems.map(item => (
                <button 
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="group relative bg-surface-container-lowest p-6 rounded-3xl text-left hover:bg-primary-container transition-all duration-300 active:scale-95 shadow-sm"
                >
                  {item.type === 'service' ? (
                    <Droplet className="text-primary mb-3 group-hover:text-[#004a61] transition-colors" size={32} />
                  ) : (
                    <Package className="text-primary mb-3 group-hover:text-[#004a61] transition-colors" size={32} />
                  )}
                  <h4 className="font-headline font-bold text-on-surface block">{item.name}</h4>
                  <span className="text-sm font-label text-on-surface/60 group-hover:text-[#004a61]/70">{formatCurrency(item.price)}</span>
                </button>
              ))
            )}
          </div>

          {/* Active Bookings Timeline */}
          <div className="mt-12">
            <h3 className="text-xl font-headline font-bold mb-6">Sesi Mendatang</h3>
            <div className="space-y-4">
              {upcomingBookings.length === 0 ? (
                <div className="p-5 text-on-surface-variant text-center bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant">
                  Tidak ada sesi mendatang hari ini.
                </div>
              ) : (
                upcomingBookings.map((booking) => {
                  const statusClass = getStatusColor(booking.status);
                  return (
                    <div key={booking.id} className={`flex items-center gap-6 p-5 bg-surface-container-lowest rounded-2xl border-l-4 shadow-sm ${statusClass.split(' ')[2]}`}>
                      <span className="font-headline font-bold text-on-surface/40 min-w-[60px]">{formatTime(booking.date)}</span>
                      <div className="flex-1">
                        <h5 className="font-bold text-lg">{booking.memberName}</h5>
                        <p className="text-xs text-on-surface/60 uppercase tracking-widest font-semibold mt-1">{booking.service}</p>
                      </div>
                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${statusClass.split(' ')[0]} ${statusClass.split(' ')[1]}`}>
                        {booking.status}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Cart/Checkout (POS RIGHT) */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-3xl p-8 sticky top-28 shadow-[0_20px_40px_rgba(0,50,74,0.04)] flex flex-col h-[calc(100vh-140px)] border border-white/60">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-headline font-bold">Ringkasan Pesanan</h3>
              <ShoppingBasket className="text-outline" size={24} />
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-5 mb-4 pr-2">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant text-sm">Belum ada item di pesanan.</div>
              ) : (
                cart.map(item => (
                  <div key={item.cartId} className="flex justify-between items-start">
                    <div>
                      <h5 className="font-bold text-sm">{item.name} {item.quantity > 1 && `(x${item.quantity})`}</h5>
                      <p className="text-xs text-on-surface/60 mt-1">
                        {item.type === 'service' ? `${item.duration} mnt` : 'Produk Retail'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block font-bold text-primary">{formatCurrency(item.price * item.quantity)}</span>
                      <button 
                        onClick={() => removeFromCart(item.cartId)}
                        className="text-[#b31b25] text-[10px] uppercase font-bold tracking-tighter mt-1 hover:underline"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-5 pt-5 border-t border-outline-variant/20">
              {/* Payment Methods */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface/50 mb-3 block">Metode Pembayaran</span>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setPaymentMethod('Tunai')}
                    className={`py-2.5 px-3 text-xs font-bold rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${paymentMethod === 'Tunai' ? 'border-primary bg-primary-container/20 text-primary' : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50'}`}
                  >
                    <Banknote size={16} /> Tunai
                  </button>
                  <button 
                    onClick={() => setPaymentMethod('QRIS')}
                    className={`py-2.5 px-3 text-xs font-bold rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${paymentMethod === 'QRIS' ? 'border-primary bg-primary-container/20 text-primary' : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50'}`}
                  >
                    <QrCode size={16} /> QRIS
                  </button>
                  <button 
                    onClick={() => setPaymentMethod('Transfer')}
                    className={`py-2.5 px-3 text-xs font-bold rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${paymentMethod === 'Transfer' ? 'border-primary bg-primary-container/20 text-primary' : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50'}`}
                  >
                    <Banknote size={16} /> Transfer
                  </button>
                  <button 
                    onClick={() => setPaymentMethod('Kartu')}
                    className={`py-2.5 px-3 text-xs font-bold rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${paymentMethod === 'Kartu' ? 'border-primary bg-primary-container/20 text-primary' : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50'}`}
                  >
                    <CreditCard size={16} /> Kartu
                  </button>
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-3 bg-surface-container-low p-4 rounded-2xl">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface/60 font-medium">Subtotal</span>
                  <span className="font-bold">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface/60 font-medium">Pajak (5%)</span>
                  <span className="font-bold">{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between items-end pt-3 border-t border-dashed border-outline-variant/40">
                  <span className="text-lg font-headline font-extrabold text-primary">Total Akhir</span>
                  <span className="text-2xl font-headline font-extrabold text-primary">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Print Action */}
              <div className="mt-2">
                <button 
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || isProcessing}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-bold flex flex-col items-center justify-center gap-1 shadow-[0_10px_20px_rgba(5,99,128,0.2)] hover:shadow-[0_15px_25px_rgba(5,99,128,0.3)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-2">
                    <Printer size={20} />
                    {isProcessing ? 'Memproses...' : 'Konfirmasi & Cetak Struk'}
                  </div>
                  <span className="text-[10px] opacity-80 font-normal uppercase tracking-widest">Optimasi Thermal 57mm</span>
                </button>
              </div>

              {/* Minimalist Receipt Preview */}
              <div className="mt-4 flex flex-col items-center">
                <p className="text-[10px] text-on-surface/40 uppercase font-bold tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-8 h-px bg-outline-variant/30"></span>
                  Pratinjau Struk
                  <span className="w-8 h-px bg-outline-variant/30"></span>
                </p>
                <div className="w-[160px] bg-white p-4 shadow-inner rounded-sm border border-outline-variant/20 text-center relative overflow-hidden font-mono text-on-surface grayscale contrast-125">
                  <div className="absolute top-0 right-0 bg-primary text-[8px] text-white px-2 py-0.5 rounded-bl-md font-sans uppercase font-bold">Auto</div>
                  <img 
                    src="/logo.png" 
                    alt="Logo Receipt" 
                    className="w-10 h-10 mx-auto mb-2 opacity-80"
                    referrerPolicy="no-referrer"
                  />
                  <p className="text-[10px] font-bold uppercase mb-1">Bubble Buds</p>
                  <p className="text-[8px] mb-2 opacity-70">{new Date().toLocaleDateString('id-ID')} • #BB-{Math.floor(Math.random() * 10000)}</p>
                  <div className="w-full border-t border-dashed border-on-surface/30 my-2"></div>
                  <div className="text-[8px] text-left space-y-1.5">
                    {cart.map(item => (
                      <div key={item.cartId} className="flex justify-between">
                        <span className="truncate pr-2">{item.name} {item.quantity > 1 && `x${item.quantity}`}</span>
                        <span>{new Intl.NumberFormat('id-ID').format(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="w-full border-t border-dashed border-on-surface/30 my-2"></div>
                  <div className="flex justify-between text-[10px] font-bold">
                    <span>TOTAL</span>
                    <span>{new Intl.NumberFormat('id-ID').format(total)}</span>
                  </div>
                  <p className="text-[8px] mt-4 italic opacity-70">Terima Kasih!</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
