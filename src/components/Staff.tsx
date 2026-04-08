import React, { useState, useEffect, useRef } from 'react';
import { Star, Phone, Mail, MoreVertical, Plus, Shield, CheckCircle2, Clock, Calendar, X, Edit2, Trash2, User, Upload } from 'lucide-react';
import { collection, onSnapshot, addDoc, query, orderBy, doc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { resizeAndConvertImage } from '../utils/imageUpload';

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

interface StaffData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  avatar?: string;
  specialty?: string;
  rating?: number;
  reviews?: number;
  createdAt: string;
}

export default function Staff() {
  const [staffMembers, setStaffMembers] = useState<StaffData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activeStaffCount, setActiveStaffCount] = useState(0);

  // Schedule Modal State
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedStaffForSchedule, setSelectedStaffForSchedule] = useState<StaffData | null>(null);
  const [staffBookings, setStaffBookings] = useState<any[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('Terapis');
  const [specialty, setSpecialty] = useState('');
  const [avatar, setAvatar] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribeUser = onSnapshot(doc(db, 'users', auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserRole(docSnap.data().role);
      }
    });

    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const staffData: StaffData[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.role === 'Terapis' || data.role === 'Kasir' || data.role === 'Manajer' || data.role === 'Staf') {
          staffData.push({ id: doc.id, ...data } as StaffData);
        }
      });
      setStaffMembers(staffData);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setIsLoading(false);
    });

    // Fetch today's attendance
    const todayDate = new Date().toISOString().split('T')[0];
    const qAttendance = query(collection(db, 'attendance'), where('date', '==', todayDate));
    const unsubscribeAttendance = onSnapshot(qAttendance, (snapshot) => {
      const presentUserIds = new Set();
      snapshot.forEach(doc => {
        if (doc.data().clockIn) {
          presentUserIds.add(doc.data().userId);
        }
      });
      setActiveStaffCount(presentUserIds.size);
    });

    return () => {
      unsubscribeUser();
      unsubscribe();
      unsubscribeAttendance();
    };
  }, []);

  useEffect(() => {
    if (!selectedStaffForSchedule) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const qBookings = query(
      collection(db, 'bookings'),
      where('therapistId', '==', selectedStaffForSchedule.id),
      where('date', '>=', todayStr)
    );

    const unsubscribe = onSnapshot(qBookings, (snapshot) => {
      const b: any[] = [];
      snapshot.forEach(doc => {
        b.push({ id: doc.id, ...doc.data() });
      });
      // Sort by date manually since we have inequality filter on date
      b.sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime());
      setStaffBookings(b);
    });

    return () => unsubscribe();
  }, [selectedStaffForSchedule]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const base64Image = await resizeAndConvertImage(file, 500, 500, 0.7);
      setAvatar(base64Image);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Gagal mengunggah gambar. Silakan coba lagi.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    try {
      if (editingId) {
        await updateDoc(doc(db, 'users', editingId), {
          name,
          email,
          phone,
          role,
          specialty: specialty || 'Umum',
          ...(avatar ? { avatar } : {})
        });
      } else {
        await addDoc(collection(db, 'users'), {
          name,
          email,
          phone,
          role,
          status: 'Aktif',
          specialty: specialty || 'Umum',
          rating: 5.0,
          reviews: 0,
          lastLogin: '-',
          avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
          createdAt: new Date().toISOString()
        });
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'users');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', id));
      setDeleteConfirmId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
    }
  };

  const openEditModal = (staff: StaffData) => {
    setEditingId(staff.id);
    setName(staff.name);
    setEmail(staff.email);
    setPhone(staff.phone || '');
    setRole(staff.role);
    setSpecialty(staff.specialty || '');
    setAvatar(staff.avatar || '');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    // Reset form
    setName('');
    setEmail('');
    setPhone('');
    setRole('Terapis');
    setSpecialty('');
    setAvatar('');
  };

  const openScheduleModal = (staff: StaffData) => {
    setSelectedStaffForSchedule(staff);
    setScheduleModalOpen(true);
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const canManageStaff = ['Super Admin', 'Manajer'].includes(userRole);

  return (
    <div className="pt-28 pb-32 px-6 md:px-12 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-headline font-extrabold text-primary tracking-tight">Manajemen Tim</h1>
          <p className="text-on-surface-variant font-medium mt-2">Kelola staf, jadwal kerja, dan performa terapis.</p>
        </div>
        {canManageStaff && (
          <button 
            onClick={() => {
              setEditingId(null);
              setIsModalOpen(true);
            }}
            className="px-5 py-3 rounded-2xl bg-primary text-white font-bold flex items-center justify-center gap-2 shadow-[0_10px_20px_rgba(5,99,128,0.2)] hover:shadow-[0_15px_25px_rgba(5,99,128,0.3)] active:scale-95 transition-all"
          >
            <Plus size={20} />
            Tambah Staf
          </button>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-white/60 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary-container/50 flex items-center justify-center text-primary">
            <Shield size={24} />
          </div>
          <div>
            <p className="text-sm font-label text-on-surface-variant uppercase tracking-widest font-bold">Total Staf</p>
            <h3 className="text-2xl font-headline font-extrabold text-on-surface">{staffMembers.length} Orang</h3>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-white/60 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#e6f4ea] flex items-center justify-center text-[#006b1f]">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm font-label text-on-surface-variant uppercase tracking-widest font-bold">Hadir Hari Ini</p>
            <h3 className="text-2xl font-headline font-extrabold text-on-surface">{activeStaffCount} Orang</h3>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-white/60 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm font-label text-on-surface-variant uppercase tracking-widest font-bold">Cuti / Libur</p>
            <h3 className="text-2xl font-headline font-extrabold text-on-surface">{staffMembers.length - activeStaffCount} Orang</h3>
          </div>
        </div>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-on-surface-variant">Memuat data staf...</div>
        ) : (
          staffMembers.map((staff) => (
            <div key={staff.id} className="bg-surface-container-lowest rounded-3xl p-6 shadow-[0_10px_30px_rgba(0,50,74,0.03)] border border-white/60 group hover:shadow-[0_20px_40px_rgba(0,50,74,0.06)] transition-all duration-300">
              
              <div className="flex justify-between items-start mb-4">
                <div className="relative">
                  <img 
                    src={staff.avatar} 
                    alt={staff.name} 
                    className="w-16 h-16 rounded-full object-cover ring-4 ring-surface-container-low"
                    referrerPolicy="no-referrer"
                  />
                  <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-surface-container-lowest ${staff.status === 'Aktif' ? 'bg-[#006b1f]' : 'bg-outline-variant'}`}></div>
                </div>
                {canManageStaff ? (
                  <div className="flex gap-2">
                    <button onClick={() => openEditModal(staff)} className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-container/20 rounded-full transition-colors">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => setDeleteConfirmId(staff.id)} className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-full transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ) : (
                  <button className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-container/20 rounded-full transition-colors">
                    <MoreVertical size={20} />
                  </button>
                )}
              </div>

              <div className="mb-4">
                <h3 className="text-xl font-headline font-bold text-on-surface">{staff.name}</h3>
                <p className="text-sm font-medium text-primary">{staff.role}</p>
              </div>

              <div className="flex items-center gap-2 mb-5 bg-surface-container-low w-fit px-3 py-1.5 rounded-lg">
                <Star size={14} className="text-[#fbbc05] fill-[#fbbc05]" />
                <span className="text-sm font-bold">{staff.rating || '5.0'}</span>
                <span className="text-xs text-on-surface-variant">({staff.reviews || 0} ulasan)</span>
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                  <Shield size={16} className="opacity-60" />
                  <span className="font-medium">Spesialis: {staff.specialty || 'Umum'}</span>
                </div>
                {staff.phone && (
                  <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                    <Phone size={16} className="opacity-60" />
                    <span className="font-medium">{staff.phone}</span>
                  </div>
                )}
                {staff.email && (
                  <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                    <Mail size={16} className="opacity-60" />
                    <span className="font-medium">{staff.email}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-outline-variant/20">
                <button 
                  onClick={() => openScheduleModal(staff)}
                  className="w-full py-2.5 rounded-xl bg-primary-container/30 text-primary font-bold text-sm hover:bg-primary-container/50 transition-colors flex items-center justify-center gap-2"
                >
                  <Calendar size={16} /> Jadwal
                </button>
              </div>

            </div>
          ))
        )}

        {/* Add New Staff Card */}
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-surface-container-low/50 rounded-3xl p-6 border-2 border-dashed border-outline-variant/50 hover:border-primary/50 hover:bg-primary-container/10 transition-all duration-300 flex flex-col items-center justify-center min-h-[280px] group"
        >
          <div className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant group-hover:bg-primary group-hover:text-white transition-colors mb-4">
            <Plus size={32} />
          </div>
          <h3 className="text-lg font-headline font-bold text-on-surface-variant group-hover:text-primary transition-colors">Tambah Anggota Tim</h3>
          <p className="text-sm text-center text-on-surface-variant/70 mt-2 max-w-[200px]">Daftarkan terapis atau staf baru ke dalam sistem.</p>
        </button>

      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-sm shadow-2xl border border-white/20 overflow-hidden flex flex-col">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-error-container/30 text-error flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h2 className="text-xl font-headline font-bold text-on-surface mb-2">Hapus Staf?</h2>
              <p className="text-on-surface-variant text-sm">
                Data staf ini akan dihapus secara permanen dan tidak dapat dikembalikan.
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

      {/* Schedule Modal */}
      {scheduleModalOpen && selectedStaffForSchedule && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-[2rem] w-full max-w-lg shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-surface-container-highest flex justify-between items-center bg-surface-container-low/50">
              <div>
                <h2 className="text-2xl font-headline font-bold text-primary">Jadwal Terapis</h2>
                <p className="text-sm text-on-surface-variant mt-1">{selectedStaffForSchedule.name}</p>
              </div>
              <button 
                onClick={() => setScheduleModalOpen(false)}
                className="p-2 rounded-full hover:bg-surface-container-highest text-on-surface-variant transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {staffBookings.length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant">
                  <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Tidak ada jadwal mendatang untuk terapis ini.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {staffBookings.map(booking => (
                    <div key={booking.id} className="p-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low/30">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-on-surface">{booking.memberName}</h4>
                        <span className="text-xs font-bold px-2 py-1 rounded-md bg-primary-container text-primary">
                          {formatTime(booking.date)}
                        </span>
                      </div>
                      <p className="text-sm text-on-surface-variant mb-2">{booking.service}</p>
                      <div className="flex items-center gap-4 text-xs text-on-surface/60">
                        <span className="flex items-center gap-1"><Calendar size={14} /> {formatDate(booking.date)}</span>
                        <span className="flex items-center gap-1"><Clock size={14} /> {booking.room}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-[2rem] w-full max-w-md shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-surface-container-highest flex justify-between items-center bg-surface-container-low/50">
              <h2 className="text-2xl font-headline font-bold text-primary">{editingId ? 'Edit Staf' : 'Tambah Staf Baru'}</h2>
              <button 
                onClick={closeModal}
                className="p-2 rounded-full hover:bg-surface-container-highest text-on-surface-variant transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="staff-form" onSubmit={handleAddStaff} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">Nama Lengkap</label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    placeholder="Nama Staf"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">Email</label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    placeholder="email@bubblebuds.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">Nomor Telepon</label>
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    placeholder="08123456789"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">Foto Profil (Opsional)</label>
                  <div className="flex items-center gap-4">
                    {avatar && (
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-surface-container-low shrink-0 border border-outline-variant/30">
                        <img src={avatar} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input 
                        type="file" 
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium flex items-center justify-center gap-2 text-on-surface-variant hover:bg-surface-container-highest hover:text-primary"
                      >
                        <Upload size={18} />
                        {isUploading ? 'Memproses...' : 'Upload Foto'}
                      </button>
                    </div>
                  </div>
                  {avatar && (
                    <button 
                      type="button" 
                      onClick={() => setAvatar('')}
                      className="text-xs text-error mt-2 font-bold hover:underline"
                    >
                      Hapus Foto
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Peran</label>
                    <select 
                      required
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    >
                      <option value="Terapis">Terapis</option>
                      <option value="Kasir">Kasir</option>
                      <option value="Manajer">Manajer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Spesialisasi</label>
                    <input 
                      type="text" 
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                      placeholder="Contoh: Pijat Bayi"
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
                form="staff-form"
                className="px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-md hover:shadow-lg active:scale-95 transition-all"
              >
                {editingId ? 'Simpan Perubahan' : 'Simpan Staf'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
