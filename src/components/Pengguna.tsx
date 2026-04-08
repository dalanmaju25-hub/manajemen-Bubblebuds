import React, { useState, useEffect } from 'react';
import { Shield, Key, UserCheck, UserX, Plus, MoreVertical, Search, Edit, X, Mail } from 'lucide-react';
import { collection, onSnapshot, addDoc, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
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

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  phone?: string;
  address?: string;
  accessibleMenus?: string[];
  lastLogin?: string;
  avatar?: string;
  createdAt: string;
}

export default function Pengguna() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState('Kasir');
  const [status, setStatus] = useState('Aktif');
  const [accessibleMenus, setAccessibleMenus] = useState<string[]>(['dashboard', 'jadwal', 'member', 'laporan', 'absen']);

  const availableMenus = [
    { id: 'dashboard', label: 'POS / Dasbor' },
    { id: 'jadwal', label: 'Booking' },
    { id: 'member', label: 'Member' },
    { id: 'staff', label: 'Staf' },
    { id: 'absen', label: 'Absen' },
    { id: 'laporan', label: 'Laporan' },
    { id: 'inventaris', label: 'Inventaris' },
    { id: 'layanan', label: 'Layanan' },
    { id: 'pengguna', label: 'Pengguna' }
  ];

  // Auto-update accessible menus when role changes (only for new users)
  useEffect(() => {
    if (!editingUserId) {
      switch (role) {
        case 'Member':
          setAccessibleMenus(['jadwal']);
          break;
        case 'Staf':
          setAccessibleMenus(['jadwal', 'member', 'staff', 'absen']);
          break;
        case 'Kasir':
          setAccessibleMenus(['dashboard', 'jadwal', 'member', 'laporan', 'absen']);
          break;
        case 'Manajer':
          setAccessibleMenus(['dashboard', 'jadwal', 'staff', 'member', 'laporan', 'pengguna', 'inventaris', 'layanan']);
          break;
        case 'Super Admin':
          setAccessibleMenus(['dashboard', 'jadwal', 'staff', 'member', 'laporan', 'absen', 'pengguna', 'inventaris', 'layanan']);
          break;
        default:
          setAccessibleMenus(['jadwal']);
      }
    }
  }, [role, editingUserId]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: UserData[] = [];
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() } as UserData);
      });
      setUsers(usersData);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openEditModal = (user: UserData) => {
    setEditingUserId(user.id);
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone || '');
    setAddress(user.address || '');
    setRole(user.role);
    setStatus(user.status);
    setAccessibleMenus(user.accessibleMenus || []);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setRole('Kasir');
    setStatus('Aktif');
    setAccessibleMenus(['dashboard', 'jadwal', 'member', 'laporan', 'absen']);
    setEditingUserId(null);
  };

  const toggleMenuAccess = (menuId: string) => {
    setAccessibleMenus(prev => 
      prev.includes(menuId) 
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    try {
      if (editingUserId) {
        await updateDoc(doc(db, 'users', editingUserId), {
          name,
          email,
          phone,
          address,
          role,
          status,
          accessibleMenus,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        });
      } else {
        await addDoc(collection(db, 'users'), {
          name,
          email,
          phone,
          address,
          role,
          status,
          accessibleMenus,
          lastLogin: '-',
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingUserId ? OperationType.UPDATE : OperationType.CREATE, 'users');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pengguna ini?')) return;
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users');
    }
  };

  const handleResetPassword = async (email: string) => {
    if (!window.confirm(`Kirim link reset password ke ${email}?`)) return;
    try {
      await sendPasswordResetEmail(auth, email);
      alert(`Link reset password telah dikirim ke ${email}`);
    } catch (error: any) {
      console.error("Reset password error:", error);
      alert(`Gagal mengirim link reset password: ${error.message}`);
    }
  };

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'Super Admin': return 'bg-[#fce8e6] text-[#c5221f] border-[#f8bbd0]';
      case 'Manajer': return 'bg-[#fff4d6] text-[#b8860b] border-[#ffe082]';
      case 'Kasir': return 'bg-[#e8f0fe] text-[#1967d2] border-[#d2e3fc]';
      case 'Terapis': return 'bg-[#e6f4ea] text-[#006b1f] border-[#a8dab5]';
      default: return 'bg-surface-container-high text-on-surface';
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pt-28 pb-32 px-6 md:px-12 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-headline font-extrabold text-primary tracking-tight">Manajemen Pengguna</h1>
          <p className="text-on-surface-variant font-medium mt-2">Kelola akses sistem, peran, dan keamanan akun.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-3 rounded-2xl bg-primary text-white font-bold flex items-center justify-center gap-2 shadow-[0_10px_20px_rgba(5,99,128,0.2)] hover:shadow-[0_15px_25px_rgba(5,99,128,0.3)] active:scale-95 transition-all"
        >
          <Plus size={20} />
          Pengguna Baru
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={20} />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama, email, atau peran..." 
          className="w-full pl-12 pr-4 py-4 bg-surface-container-lowest rounded-2xl border border-white/60 shadow-sm focus:ring-2 focus:ring-primary/20 transition-all text-on-surface outline-none font-medium"
        />
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-on-surface-variant">Memuat data pengguna...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="col-span-full text-center py-12 text-on-surface-variant">Belum ada data pengguna.</div>
        ) : (
          filteredUsers.map((user) => (
            <div key={user.id} className="bg-surface-container-lowest rounded-3xl p-6 shadow-[0_10px_30px_rgba(0,50,74,0.03)] border border-white/60 group hover:shadow-[0_20px_40px_rgba(0,50,74,0.06)] transition-all duration-300">
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img 
                      src={user.avatar} 
                      alt={user.name} 
                      className={`w-14 h-14 rounded-full object-cover ring-2 ${user.status === 'Aktif' ? 'ring-primary/50' : 'ring-outline-variant grayscale'}`}
                      referrerPolicy="no-referrer"
                    />
                    <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-surface-container-lowest ${user.status === 'Aktif' ? 'bg-[#006b1f]' : 'bg-outline-variant'}`}></div>
                  </div>
                  <div>
                    <h3 className={`text-lg font-headline font-bold ${user.status === 'Aktif' ? 'text-on-surface' : 'text-on-surface-variant'}`}>{user.name}</h3>
                    <p className="text-xs font-label text-on-surface-variant mt-1">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleResetPassword(user.email)}
                    className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-container/20 rounded-full transition-colors"
                    title="Kirim Link Reset Password"
                  >
                    <Key size={18} />
                  </button>
                  <button 
                    onClick={() => openEditModal(user)}
                    className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-container/20 rounded-full transition-colors"
                    title="Edit Pengguna"
                  >
                    <Edit size={18} />
                  </button>
                  <button 
                    onClick={() => handleDeleteUser(user.id)}
                    className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-full transition-colors"
                    title="Hapus Pengguna"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 ${getRoleColor(user.role)}`}>
                  <Shield size={14} /> {user.role}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 ${user.status === 'Aktif' ? 'bg-[#e6f4ea] text-[#006b1f] border-[#a8dab5]' : 'bg-surface-container-highest text-on-surface-variant border-outline-variant'}`}>
                  {user.status === 'Aktif' ? <UserCheck size={14} /> : <UserX size={14} />} {user.status}
                </span>
              </div>

              {(user.phone || user.address) && (
                <div className="mb-4 text-sm text-on-surface-variant">
                  {user.phone && <div className="mb-1">📞 {user.phone}</div>}
                  {user.address && <div>📍 {user.address}</div>}
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-outline-variant/20">
                <div className="text-xs text-on-surface-variant font-medium">
                  Login terakhir: <br/><span className="text-on-surface font-bold">{user.lastLogin || '-'}</span>
                </div>
              </div>

            </div>
          ))
        )}
      </div>

      {/* Add/Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-[2rem] w-full max-w-md shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-surface-container-highest flex justify-between items-center bg-surface-container-low/50">
              <h2 className="text-2xl font-headline font-bold text-primary">{editingUserId ? 'Edit Pengguna' : 'Pengguna Baru'}</h2>
              <button 
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                className="p-2 rounded-full hover:bg-surface-container-highest text-on-surface-variant transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="user-form" onSubmit={handleAddUser} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">Nama Lengkap</label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    placeholder="Nama Pengguna"
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
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">Nomor HP</label>
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    placeholder="08123456789"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">Alamat</label>
                  <textarea 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium resize-none"
                    placeholder="Alamat lengkap"
                  />
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
                      <option value="Member">Member</option>
                      <option value="Staf">Staf</option>
                      <option value="Kasir">Kasir</option>
                      <option value="Manajer">Manajer</option>
                      <option value="Super Admin">Super Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Status</label>
                    <select 
                      required
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    >
                      <option value="Aktif">Aktif</option>
                      <option value="Nonaktif">Nonaktif</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-3">Hak Akses Menu</label>
                  <div className="grid grid-cols-2 gap-3">
                    {availableMenus.map(menu => (
                      <label key={menu.id} className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant/30 hover:bg-surface-container-low cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={accessibleMenus.includes(menu.id)}
                          onChange={() => toggleMenuAccess(menu.id)}
                          className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-medium text-on-surface">{menu.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-surface-container-highest bg-surface-container-lowest flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                className="px-6 py-3 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-highest transition-colors"
              >
                Batal
              </button>
              <button 
                type="submit"
                form="user-form"
                className="px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-md hover:shadow-lg active:scale-95 transition-all"
              >
                {editingUserId ? 'Simpan Perubahan' : 'Simpan Pengguna'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
