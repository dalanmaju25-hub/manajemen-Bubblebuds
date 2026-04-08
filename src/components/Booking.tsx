import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, User, Plus, ChevronLeft, ChevronRight, Search, Filter, CheckCircle2, AlertCircle, X, Settings, Edit2, Trash2 } from 'lucide-react';
import { collection, onSnapshot, addDoc, query, orderBy, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: any[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface BookingData {
  id: string;
  memberName: string;
  service: string;
  date: string;
  status: string;
  therapistName?: string;
  room?: string;
  createdAt: string;
}

export default function Booking() {
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Operational Hours
  const [opHours, setOpHours] = useState({
    open: '09:00',
    close: '20:00',
    breakStart: '12:00',
    breakEnd: '13:00'
  });
  
  // Data lists
  const [membersList, setMembersList] = useState<{id: string, name: string}[]>([]);
  const [staffList, setStaffList] = useState<{id: string, name: string, role: string}[]>([]);
  const [servicesList, setServicesList] = useState<{id: string, name: string, category: string}[]>([]);

  // Form state
  const [memberId, setMemberId] = useState('');
  const [service, setService] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [therapistId, setTherapistId] = useState('');
  const [room, setRoom] = useState('');

  const dates = [
    { day: 'Sen', date: '20', active: false },
    { day: 'Sel', date: '21', active: false },
    { day: 'Rab', date: '22', active: true },
    { day: 'Kam', date: '23', active: false },
    { day: 'Jum', date: '24', active: false },
    { day: 'Sab', date: '25', active: false },
    { day: 'Min', date: '26', active: false },
  ];

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribeUser = onSnapshot(doc(db, 'users', auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserRole(docSnap.data().role);
      }
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'operationalHours'), (docSnap) => {
      if (docSnap.exists()) {
        setOpHours(docSnap.data() as any);
      }
    });

    const qBookings = query(collection(db, 'bookings'), orderBy('date', 'asc'));
    const unsubscribeBookings = onSnapshot(qBookings, (snapshot) => {
      const bookingsData: BookingData[] = [];
      snapshot.forEach((doc) => {
        bookingsData.push({ id: doc.id, ...doc.data() } as BookingData);
      });
      setBookings(bookingsData);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bookings');
      setIsLoading(false);
    });

    const qMembers = query(collection(db, 'members'));
    const unsubscribeMembers = onSnapshot(qMembers, (snapshot) => {
      const m: {id: string, name: string}[] = [];
      snapshot.forEach(doc => m.push({ id: doc.id, name: doc.data().name }));
      setMembersList(m);
    }, (error) => console.error(error));

    const qStaff = query(collection(db, 'users'));
    const unsubscribeStaff = onSnapshot(qStaff, (snapshot) => {
      const s: {id: string, name: string, role: string}[] = [];
      snapshot.forEach(doc => s.push({ id: doc.id, name: doc.data().name, role: doc.data().role }));
      setStaffList(s);
    }, (error) => console.error(error));

    const qServices = query(collection(db, 'services'));
    const unsubscribeServices = onSnapshot(qServices, (snapshot) => {
      const s: {id: string, name: string, category: string}[] = [];
      snapshot.forEach(doc => s.push({ id: doc.id, name: doc.data().name, category: doc.data().category || 'Lainnya' }));
      setServicesList(s);
    }, (error) => console.error(error));

    return () => {
      unsubscribeUser();
      unsubscribeSettings();
      unsubscribeBookings();
      unsubscribeMembers();
      unsubscribeStaff();
      unsubscribeServices();
    };
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'settings', 'operationalHours'), opHours);
      setIsSettingsModalOpen(false);
      alert('Pengaturan jam operasional berhasil disimpan.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/operationalHours');
    }
  };

  const handleAddBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId || !service || !bookingDate || !bookingTime) return;

    // Check operational hours
    if (bookingTime < opHours.open || bookingTime > opHours.close) {
      alert(`Jam booking harus di antara jam buka (${opHours.open}) dan tutup (${opHours.close}).`);
      return;
    }
    if (bookingTime >= opHours.breakStart && bookingTime < opHours.breakEnd) {
      alert(`Jam booking tidak boleh pada jam istirahat (${opHours.breakStart} - ${opHours.breakEnd}).`);
      return;
    }

    // Check therapist availability (1 patient per hour)
    if (therapistId) {
      const bookingHour = bookingTime.split(':')[0];
      const isTherapistBooked = bookings.some(b => {
        if (b.status === 'Dibatalkan') return false;
        if (b.therapistId !== therapistId) return false;
        
        const bDate = new Date(b.date);
        const bDateStr = `${bDate.getFullYear()}-${String(bDate.getMonth() + 1).padStart(2, '0')}-${String(bDate.getDate()).padStart(2, '0')}`;
        const bHour = bDate.getHours().toString().padStart(2, '0');
        
        return bDateStr === bookingDate && bHour === bookingHour;
      });

      if (isTherapistBooked) {
        alert('Terapis ini sudah memiliki jadwal pada jam tersebut. Silakan pilih jam atau terapis lain.');
        return;
      }
    }

    const selectedMember = membersList.find(m => m.id === memberId);
    const selectedTherapist = staffList.find(s => s.id === therapistId);

    const dateTime = new Date(`${bookingDate}T${bookingTime}`).toISOString();

    try {
      if (editingId) {
        await updateDoc(doc(db, 'bookings', editingId), {
          memberId: memberId,
          memberName: selectedMember ? selectedMember.name : 'Unknown',
          service,
          date: dateTime,
          therapistId: therapistId || '',
          therapistName: selectedTherapist ? selectedTherapist.name : 'Belum ditentukan',
          room: room || 'Belum ditentukan'
        });
      } else {
        await addDoc(collection(db, 'bookings'), {
          memberId: memberId,
          memberName: selectedMember ? selectedMember.name : 'Unknown',
          service,
          date: dateTime,
          status: 'Menunggu Konfirmasi',
          therapistId: therapistId || '',
          therapistName: selectedTherapist ? selectedTherapist.name : 'Belum ditentukan',
          room: room || 'Belum ditentukan',
          createdAt: new Date().toISOString()
        });
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'bookings');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'bookings', id));
      setDeleteConfirmId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bookings/${id}`);
    }
  };

  const openEditModal = (booking: BookingData) => {
    setEditingId(booking.id);
    
    // Find memberId by name if not directly available (for older data)
    const member = membersList.find(m => m.name === booking.memberName);
    setMemberId(member ? member.id : '');
    
    setService(booking.service);
    
    const bDate = new Date(booking.date);
    setBookingDate(`${bDate.getFullYear()}-${String(bDate.getMonth() + 1).padStart(2, '0')}-${String(bDate.getDate()).padStart(2, '0')}`);
    setBookingTime(bDate.getHours().toString().padStart(2, '0') + ':' + bDate.getMinutes().toString().padStart(2, '0'));
    
    // Find therapistId by name
    const therapist = staffList.find(s => s.name === booking.therapistName);
    setTherapistId(therapist ? therapist.id : '');
    
    setRoom(booking.room || '');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setMemberId('');
    setService('');
    setBookingDate('');
    setBookingTime('');
    setTherapistId('');
    setRoom('');
  };

  const handleUpdateStatus = async (id: string, newStatus: string, createdAt: string) => {
    try {
      await updateDoc(doc(db, 'bookings', id), {
        status: newStatus,
        createdAt // Required by security rules to be unchanged
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${id}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Selesai': return { bg: 'bg-[#8df48e]/30', text: 'text-[#006b1f]', border: 'border-[#006b1f]', dot: 'bg-[#006b1f]' };
      case 'Berlangsung': return { bg: 'bg-primary-container', text: 'text-primary', border: 'border-primary', dot: 'bg-primary' };
      case 'Menunggu Konfirmasi': return { bg: 'bg-[#e8e883]/30', text: 'text-[#545500]', border: 'border-[#e8e883]', dot: 'bg-[#e8e883]' };
      case 'Terkonfirmasi': return { bg: 'bg-[#d3ebff]', text: 'text-[#005c99]', border: 'border-[#005c99]', dot: 'bg-[#005c99]' };
      case 'Dibatalkan': return { bg: 'bg-[#fce8e6]', text: 'text-[#c5221f]', border: 'border-[#c5221f]', dot: 'bg-[#c5221f]' };
      default: return { bg: 'bg-surface-container', text: 'text-on-surface', border: 'border-outline', dot: 'bg-outline' };
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="pt-28 pb-32 px-6 md:px-12 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-headline font-extrabold text-primary tracking-tight">Jadwal & Reservasi</h1>
          <p className="text-on-surface-variant font-medium mt-2">Kelola jadwal sesi spa dan booking pelanggan.</p>
        </div>
        <div className="flex gap-3">
          {['Super Admin', 'Manajer'].includes(userRole) && (
            <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-3 rounded-2xl bg-surface-container-low text-on-surface-variant hover:bg-surface-container-highest transition-colors"
              title="Pengaturan Jam Operasional"
            >
              <Settings size={20} />
            </button>
          )}
          <button className="p-3 rounded-2xl bg-surface-container-low text-on-surface-variant hover:bg-surface-container-highest transition-colors">
            <Search size={20} />
          </button>
          <button className="p-3 rounded-2xl bg-surface-container-low text-on-surface-variant hover:bg-surface-container-highest transition-colors">
            <Filter size={20} />
          </button>
          <button 
            onClick={() => {
              setEditingId(null);
              setIsModalOpen(true);
            }}
            className="px-5 py-3 rounded-2xl bg-primary text-white font-bold flex items-center gap-2 shadow-[0_10px_20px_rgba(5,99,128,0.2)] hover:shadow-[0_15px_25px_rgba(5,99,128,0.3)] active:scale-95 transition-all"
          >
            <Plus size={20} />
            Booking Baru
          </button>
        </div>
      </div>

      {/* Date Selector */}
      <div className="bg-surface-container-lowest rounded-3xl p-4 shadow-sm border border-white/60 mb-8 flex items-center justify-between">
        <button className="p-2 text-on-surface-variant hover:text-primary transition-colors">
          <ChevronLeft size={24} />
        </button>
        
        <div className="flex gap-2 md:gap-4 overflow-x-auto no-scrollbar px-2">
          {dates.map((d, i) => (
            <div 
              key={i} 
              className={`flex flex-col items-center justify-center min-w-[60px] md:min-w-[72px] py-3 rounded-2xl cursor-pointer transition-all duration-300 ${
                d.active 
                  ? 'bg-gradient-to-br from-primary to-primary-container text-white shadow-md scale-105' 
                  : 'hover:bg-surface-container-highest text-on-surface-variant'
              }`}
            >
              <span className="text-xs font-label uppercase tracking-widest font-bold opacity-80 mb-1">{d.day}</span>
              <span className="text-xl font-headline font-extrabold">{d.date}</span>
            </div>
          ))}
        </div>

        <button className="p-2 text-on-surface-variant hover:text-primary transition-colors">
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Timeline / Schedule */}
      <div className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 shadow-[0_20px_40px_rgba(0,50,74,0.04)] border border-white/60">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-headline font-bold flex items-center gap-2">
            <CalendarIcon className="text-primary" size={24} />
            Jadwal Hari Ini
          </h3>
          <span className="bg-primary-container/30 text-primary px-4 py-1.5 rounded-full text-sm font-bold">
            {bookings.length} Sesi
          </span>
        </div>

        <div className="relative border-l-2 border-surface-container-highest ml-4 md:ml-8 space-y-8 pb-4">
          
          {isLoading ? (
            <div className="pl-8 text-on-surface-variant">Memuat jadwal...</div>
          ) : bookings.length === 0 ? (
            <div className="pl-8 text-on-surface-variant">Belum ada jadwal untuk hari ini.</div>
          ) : (
            bookings.map((booking) => {
              const colors = getStatusColor(booking.status);
              return (
                <div key={booking.id} className="relative pl-8 md:pl-12">
                  <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full ${colors.dot} ring-4 ring-surface-container-lowest flex items-center justify-center`}>
                    {booking.status === 'Selesai' && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 mb-2">
                    <span className={`font-headline font-bold w-16 ${booking.status === 'Berlangsung' ? 'text-primary' : 'text-on-surface/60'}`}>
                      {formatTime(booking.date)}
                    </span>
                    <div className={`flex-1 bg-surface-container-low p-5 rounded-2xl border-l-4 ${colors.border} ${booking.status === 'Berlangsung' ? 'bg-gradient-to-r from-primary-container/20 to-transparent shadow-sm' : 'opacity-80'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className={`font-bold text-lg ${booking.status === 'Berlangsung' ? 'text-primary' : ''}`}>{booking.memberName}</h4>
                        <div className="flex gap-2">
                          {booking.status === 'Menunggu Konfirmasi' && (
                            <button 
                              onClick={() => handleUpdateStatus(booking.id, 'Terkonfirmasi', booking.createdAt)}
                              className="text-xs font-bold text-white bg-primary px-2 py-1 rounded-md hover:bg-primary/80"
                            >
                              Konfirmasi
                            </button>
                          )}
                          {booking.status === 'Terkonfirmasi' && (
                            <button 
                              onClick={() => handleUpdateStatus(booking.id, 'Berlangsung', booking.createdAt)}
                              className="text-xs font-bold text-white bg-primary px-2 py-1 rounded-md hover:bg-primary/80"
                            >
                              Mulai
                            </button>
                          )}
                          {booking.status === 'Berlangsung' && (
                            <button 
                              onClick={() => handleUpdateStatus(booking.id, 'Selesai', booking.createdAt)}
                              className="text-xs font-bold text-white bg-[#006b1f] px-2 py-1 rounded-md hover:bg-[#006b1f]/80"
                            >
                              Selesaikan
                            </button>
                          )}
                          <span className={`text-xs font-bold ${colors.text} ${colors.bg} px-2 py-1 rounded-md flex items-center gap-1`}>
                            {booking.status === 'Menunggu Konfirmasi' && <AlertCircle size={12} />}
                            {booking.status}
                          </span>
                          <button onClick={() => openEditModal(booking)} className="p-1 text-on-surface-variant hover:text-primary transition-colors ml-2">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => setDeleteConfirmId(booking.id)} className="p-1 text-on-surface-variant hover:text-error transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-on-surface-variant mb-3">{booking.service}</p>
                      <div className="flex items-center gap-4 text-xs font-semibold text-on-surface/60">
                        <span className="flex items-center gap-1"><User size={14} /> Terapis: {booking.therapistName}</span>
                        <span className="flex items-center gap-1"><Clock size={14} /> {booking.room}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Empty Slot Placeholder */}
          <div className="relative pl-8 md:pl-12 pt-4">
            <div className="absolute -left-[9px] top-6 w-4 h-4 rounded-full bg-surface-container-highest ring-4 ring-surface-container-lowest"></div>
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 mb-2">
              <span className="font-headline font-bold text-on-surface/40 w-16"></span>
              <button 
                onClick={() => {
                  setEditingId(null);
                  setIsModalOpen(true);
                }}
                className="flex-1 border-2 border-dashed border-outline-variant/50 p-4 rounded-2xl text-on-surface-variant/60 hover:text-primary hover:border-primary/50 hover:bg-primary-container/10 transition-all flex items-center justify-center gap-2 font-bold text-sm"
              >
                <Plus size={18} /> Tambah Booking Baru
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-sm shadow-2xl border border-white/20 overflow-hidden flex flex-col">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-error-container/30 text-error flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h2 className="text-xl font-headline font-bold text-on-surface mb-2">Hapus Booking?</h2>
              <p className="text-on-surface-variant text-sm">
                Data booking ini akan dihapus secara permanen dan tidak dapat dikembalikan.
              </p>
            </div>
            <div className="p-4 border-t border-surface-container-highest bg-surface-container-low/50 flex gap-3">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-highest transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-3 rounded-xl bg-error text-white font-bold shadow-md hover:shadow-lg active:scale-95 transition-all"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Booking Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-[2rem] w-full max-w-lg shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-surface-container-highest flex justify-between items-center bg-surface-container-low/50">
              <h2 className="text-2xl font-headline font-bold text-primary">{editingId ? 'Edit Booking' : 'Booking Baru'}</h2>
              <button 
                onClick={closeModal}
                className="p-2 rounded-full hover:bg-surface-container-highest text-on-surface-variant transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="booking-form" onSubmit={handleAddBooking} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">Nama Pelanggan (Member)</label>
                  <select 
                    required
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                  >
                    <option value="">Pilih Member...</option>
                    {membersList.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  {membersList.length === 0 && <p className="text-xs text-[#c5221f] mt-1">Belum ada data member. Silakan tambah di menu Member.</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">Layanan</label>
                  <select 
                    required
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                  >
                    <option value="">Pilih Layanan...</option>
                    {Array.from(new Set(servicesList.map(s => s.category))).map(category => (
                      <optgroup key={category} label={category}>
                        {servicesList.filter(s => s.category === category).map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {servicesList.length === 0 && <p className="text-xs text-[#c5221f] mt-1">Belum ada data layanan. Silakan tambah di menu Layanan.</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Tanggal</label>
                    <input 
                      type="date" 
                      required
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Waktu</label>
                    <input 
                      type="time" 
                      required
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Terapis (Opsional)</label>
                    <select 
                      value={therapistId}
                      onChange={(e) => setTherapistId(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    >
                      <option value="">Pilih Terapis...</option>
                      {staffList.filter(s => s.role === 'Terapis').map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Ruangan (Opsional)</label>
                    <input 
                      type="text" 
                      value={room}
                      onChange={(e) => setRoom(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                      placeholder="Contoh: Ruang VIP 1"
                    />
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-surface-container-highest bg-surface-container-lowest flex justify-end gap-3">
              <button 
                type="button"
                onClick={closeModal}
                className="px-6 py-3 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-highest transition-colors"
              >
                Batal
              </button>
              <button 
                type="submit"
                form="booking-form"
                className="px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-md hover:shadow-lg active:scale-95 transition-all"
              >
                {editingId ? 'Simpan Perubahan' : 'Simpan Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-[2rem] w-full max-w-md shadow-2xl border border-white/20 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-surface-container-highest flex justify-between items-center bg-surface-container-low/50">
              <h2 className="text-2xl font-headline font-bold text-primary">Jam Operasional</h2>
              <button 
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-2 rounded-full hover:bg-surface-container-highest text-on-surface-variant transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6">
              <form id="settings-form" onSubmit={handleSaveSettings} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Jam Buka</label>
                    <input 
                      type="time" 
                      required
                      value={opHours.open}
                      onChange={(e) => setOpHours({...opHours, open: e.target.value})}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Jam Tutup</label>
                    <input 
                      type="time" 
                      required
                      value={opHours.close}
                      onChange={(e) => setOpHours({...opHours, close: e.target.value})}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Mulai Istirahat</label>
                    <input 
                      type="time" 
                      required
                      value={opHours.breakStart}
                      onChange={(e) => setOpHours({...opHours, breakStart: e.target.value})}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Selesai Istirahat</label>
                    <input 
                      type="time" 
                      required
                      value={opHours.breakEnd}
                      onChange={(e) => setOpHours({...opHours, breakEnd: e.target.value})}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    />
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-surface-container-highest bg-surface-container-lowest flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="px-6 py-3 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-highest transition-colors"
              >
                Batal
              </button>
              <button 
                type="submit"
                form="settings-form"
                className="px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-md hover:shadow-lg active:scale-95 transition-all"
              >
                Simpan Pengaturan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
