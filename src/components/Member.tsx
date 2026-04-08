import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Filter, Award, Star, History, MoreVertical, Baby, Phone, X, Mail, Edit2, Trash2, Gift, Upload } from 'lucide-react';
import { collection, onSnapshot, addDoc, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
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

interface MemberData {
  id: string;
  memberNumber?: string;
  name: string;
  dob?: string;
  phone?: string;
  email?: string;
  socialPlatform?: string;
  socialHandle?: string;
  tier: string;
  points: number;
  lastVisit?: string;
  avatar?: string;
  createdAt: string;
}

export default function Member() {
  const [members, setMembers] = useState<MemberData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userRole, setUserRole] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [memberNumber, setMemberNumber] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [socialPlatform, setSocialPlatform] = useState('Instagram');
  const [socialHandle, setSocialHandle] = useState('');
  const [tier, setTier] = useState('Bronze');
  const [points, setPoints] = useState(0);
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

    const q = query(collection(db, 'members'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const membersData: MemberData[] = [];
      snapshot.forEach((doc) => {
        membersData.push({ id: doc.id, ...doc.data() } as MemberData);
      });
      setMembers(membersData);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'members');
      setIsLoading(false);
    });

    return () => {
      unsubscribeUser();
      unsubscribe();
    };
  }, []);

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

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !memberNumber) {
      alert("Nama dan Nomor Member wajib diisi");
      return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, 'members', editingId), {
          memberNumber,
          name,
          dob: dob || '',
          phone: phone || '',
          email: email || '',
          socialPlatform,
          socialHandle: socialHandle || '',
          tier,
          points: Number(points),
          ...(avatar ? { avatar } : {})
        });
      } else {
        await addDoc(collection(db, 'members'), {
          memberNumber,
          name,
          dob: dob || '',
          phone: phone || '',
          email: email || '',
          socialPlatform,
          socialHandle: socialHandle || '',
          tier,
          points: Number(points),
          lastVisit: '-',
          avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
          createdAt: new Date().toISOString()
        });
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'members');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'members', id));
      setDeleteConfirmId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `members/${id}`);
    }
  };

  const openEditModal = (member: MemberData) => {
    setEditingId(member.id);
    setMemberNumber(member.memberNumber || '');
    setName(member.name);
    setDob(member.dob || '');
    setPhone(member.phone || '');
    setEmail(member.email || '');
    setSocialPlatform(member.socialPlatform || 'Instagram');
    setSocialHandle(member.socialHandle || '');
    setTier(member.tier);
    setPoints(member.points);
    setAvatar(member.avatar || '');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    // Reset form
    setMemberNumber('');
    setName('');
    setDob('');
    setPhone('');
    setEmail('');
    setSocialPlatform('Instagram');
    setSocialHandle('');
    setTier('Bronze');
    setPoints(0);
    setAvatar('');
  };

  const getTierColor = (tier: string) => {
    switch(tier) {
      case 'Gold': return 'bg-[#fff4d6] text-[#b8860b] border-[#ffe082]';
      case 'Silver': return 'bg-[#f0f4f8] text-[#607d8b] border-[#cfd8dc]';
      case 'Bronze': return 'bg-[#fbe9e7] text-[#d84315] border-[#ffccbc]';
      default: return 'bg-surface-container-high text-on-surface';
    }
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (m.memberNumber && m.memberNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
    m.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const today = new Date();
  const todayMonthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const birthdayMembers = members.filter(m => m.dob && m.dob.endsWith(todayMonthDay));

  const canManageMembers = ['Super Admin', 'Manajer', 'Staf', 'Kasir'].includes(userRole);

  return (
    <div className="pt-28 pb-32 px-6 md:px-12 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-headline font-extrabold text-primary tracking-tight">Manajemen Member</h1>
          <p className="text-on-surface-variant font-medium mt-2">Kelola data pelanggan, poin loyalitas, dan riwayat kunjungan.</p>
        </div>
        {canManageMembers && (
          <button 
            onClick={() => {
              setEditingId(null);
              setIsModalOpen(true);
            }}
            className="px-5 py-3 rounded-2xl bg-primary text-white font-bold flex items-center justify-center gap-2 shadow-[0_10px_20px_rgba(5,99,128,0.2)] hover:shadow-[0_15px_25px_rgba(5,99,128,0.3)] active:scale-95 transition-all"
          >
            <Plus size={20} />
            Member Baru
          </button>
        )}
      </div>

      {/* Birthday Banner */}
      {birthdayMembers.length > 0 && (
        <div className="mb-8 bg-gradient-to-r from-[#ffe082] to-[#ffccbc] rounded-3xl p-6 shadow-sm border border-white/60 flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-white/50 flex items-center justify-center text-[#d84315] shrink-0">
            <Gift size={24} />
          </div>
          <div>
            <h3 className="text-lg font-headline font-bold text-[#d84315]">Ulang Tahun Hari Ini!</h3>
            <p className="text-sm font-medium text-[#d84315]/80 mt-1">
              Jangan lupa ucapkan selamat ulang tahun kepada: 
              <span className="font-bold ml-1">
                {birthdayMembers.map(m => m.name).join(', ')}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={20} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama member, nomor member, atau ID..." 
            className="w-full pl-12 pr-4 py-4 bg-surface-container-lowest rounded-2xl border border-white/60 shadow-sm focus:ring-2 focus:ring-primary/20 transition-all text-on-surface outline-none font-medium"
          />
        </div>
        <button className="px-6 py-4 rounded-2xl bg-surface-container-lowest border border-white/60 shadow-sm text-on-surface-variant hover:text-primary hover:bg-primary-container/20 transition-colors flex items-center justify-center gap-2 font-bold">
          <Filter size={20} />
          Filter
        </button>
      </div>

      {/* Member List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-on-surface-variant">Memuat data member...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="col-span-full text-center py-12 text-on-surface-variant">Belum ada data member.</div>
        ) : (
          filteredMembers.map((member) => (
            <div key={member.id} className="bg-surface-container-lowest rounded-3xl p-6 shadow-[0_10px_30px_rgba(0,50,74,0.03)] border border-white/60 group hover:shadow-[0_20px_40px_rgba(0,50,74,0.06)] transition-all duration-300">
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <img 
                    src={member.avatar} 
                    alt={member.name} 
                    className="w-14 h-14 rounded-full object-cover ring-2 ring-surface-container-highest"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h3 className="text-lg font-headline font-bold text-on-surface">{member.name}</h3>
                    <p className="text-xs font-label text-on-surface-variant uppercase tracking-widest mt-1">ID: {member.memberNumber || member.id.substring(0, 8)}</p>
                  </div>
                </div>
                {canManageMembers && (
                  <div className="flex gap-2">
                    <button onClick={() => openEditModal(member)} className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-container/20 rounded-full transition-colors">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => setDeleteConfirmId(member.id)} className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-full transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-surface-container-low p-3 rounded-2xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-container/50 flex items-center justify-center text-primary">
                    <Baby size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Tanggal Lahir</p>
                    <p className="font-bold text-sm">{member.dob || '-'}</p>
                  </div>
                </div>
                <div className="bg-surface-container-low p-3 rounded-2xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-container/50 flex items-center justify-center text-primary">
                    <History size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Kunjungan Terakhir</p>
                    <p className="font-bold text-sm">{member.lastVisit || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="mb-4 space-y-1">
                {member.phone && <p className="text-xs text-on-surface-variant flex items-center gap-2"><Phone size={12} /> {member.phone}</p>}
                {member.email && <p className="text-xs text-on-surface-variant flex items-center gap-2"><Mail size={12} /> {member.email}</p>}
                {member.socialHandle && <p className="text-xs text-on-surface-variant flex items-center gap-2"><span className="font-bold">{member.socialPlatform}:</span> {member.socialHandle}</p>}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 ${getTierColor(member.tier)}`}>
                    <Award size={14} /> {member.tier}
                  </span>
                  <span className="flex items-center gap-1 text-sm font-bold text-[#fbbc05] bg-[#fbbc05]/10 px-3 py-1 rounded-full">
                    <Star size={14} className="fill-[#fbbc05]" /> {member.points} Pts
                  </span>
                </div>
              </div>

            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-sm shadow-2xl border border-white/20 overflow-hidden flex flex-col">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-error-container/30 text-error flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h2 className="text-xl font-headline font-bold text-on-surface mb-2">Hapus Member?</h2>
              <p className="text-on-surface-variant text-sm">
                Data member ini akan dihapus secara permanen dan tidak dapat dikembalikan.
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

      {/* Add Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-[2rem] w-full max-w-md shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-surface-container-highest flex justify-between items-center bg-surface-container-low/50">
              <h2 className="text-2xl font-headline font-bold text-primary">{editingId ? 'Edit Member' : 'Member Baru'}</h2>
              <button 
                onClick={closeModal}
                className="p-2 rounded-full hover:bg-surface-container-highest text-on-surface-variant transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="member-form" onSubmit={handleAddMember} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Nomor Member</label>
                    <input 
                      type="text" 
                      required
                      value={memberNumber}
                      onChange={(e) => setMemberNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                      placeholder="Contoh: MBR-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Nama Lengkap</label>
                    <input 
                      type="text" 
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                      placeholder="Nama Pasien"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Nomor HP</label>
                    <input 
                      type="tel" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                      placeholder="0812..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Email</label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                      placeholder="email@contoh.com"
                    />
                  </div>
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
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Tanggal Lahir</label>
                    <input 
                      type="date" 
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Platform Sosmed</label>
                    <select 
                      value={socialPlatform}
                      onChange={(e) => setSocialPlatform(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    >
                      <option value="Instagram">Instagram</option>
                      <option value="TikTok">TikTok</option>
                      <option value="Facebook">Facebook</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Username Sosmed</label>
                    <input 
                      type="text" 
                      value={socialHandle}
                      onChange={(e) => setSocialHandle(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                      placeholder="@username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Tier</label>
                    <select 
                      required
                      value={tier}
                      onChange={(e) => setTier(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    >
                      <option value="Bronze">Bronze</option>
                      <option value="Silver">Silver</option>
                      <option value="Gold">Gold</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Poin Awal</label>
                    <input 
                      type="number" 
                      required
                      min="0"
                      value={points}
                      onChange={(e) => setPoints(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
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
                form="member-form"
                className="px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-md hover:shadow-lg active:scale-95 transition-all"
              >
                {editingId ? 'Simpan Perubahan' : 'Simpan Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
