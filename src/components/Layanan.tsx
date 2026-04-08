import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, Plus, MoreVertical, Edit, X, Clock, Tag, Trash2, Image as ImageIcon, Upload } from 'lucide-react';
import { collection, onSnapshot, addDoc, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
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

interface ServiceItem {
  id: string;
  name: string;
  category: string;
  price: number;
  duration: number;
  description: string;
  image: string;
  createdAt: string;
}

export default function Layanan() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Semua');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('for Baby (0-24 Bulan)');
  const [price, setPrice] = useState<number | ''>('');
  const [duration, setDuration] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'services'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData: ServiceItem[] = [];
      snapshot.forEach((doc) => {
        itemsData.push({ id: doc.id, ...doc.data() } as ServiceItem);
      });
      setServices(itemsData);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'services');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setName('');
    setCategory('for Baby (0-24 Bulan)');
    setPrice('');
    setDuration('');
    setDescription('');
    setImage('');
    setIsModalOpen(true);
  };

  const openEditModal = (service: ServiceItem) => {
    setEditingId(service.id);
    setName(service.name);
    setCategory(service.category);
    setPrice(service.price);
    setDuration(service.duration);
    setDescription(service.description || '');
    setImage(service.image || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'services', id));
      setDeleteConfirmId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'services');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const base64Image = await resizeAndConvertImage(file, 800, 800, 0.7);
      setImage(base64Image);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Gagal mengunggah gambar. Silakan coba lagi.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || price === '' || duration === '') return;

    try {
      const serviceData = {
        name,
        category,
        price: Number(price),
        duration: Number(duration),
        description,
        image: image || `https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=200&auto=format&fit=crop`,
      };

      if (editingId) {
        await updateDoc(doc(db, 'services', editingId), serviceData);
      } else {
        await addDoc(collection(db, 'services'), {
          ...serviceData,
          createdAt: new Date().toISOString()
        });
      }
      
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'services');
    }
  };

  const getCategoryColor = (category: string) => {
    switch(category) {
      case 'for Baby (0-24 Bulan)': return 'bg-primary-container/40 text-primary';
      case 'for Kids (3-12 Tahun)': return 'bg-[#e8f0fe] text-[#1967d2]';
      case 'for Moms': return 'bg-[#f3e8fd] text-[#7b1fa2]';
      case 'Treatment Lain': return 'bg-[#fff4d6] text-[#b8860b]';
      default: return 'bg-surface-container-high text-on-surface';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  };

  const filteredServices = services.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'Semua' || item.category === activeFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="pt-28 pb-32 px-6 md:px-12 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-headline font-extrabold text-primary tracking-tight">Layanan</h1>
          <p className="text-on-surface-variant font-medium mt-2">Kelola daftar layanan, harga, dan durasi treatment.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="px-5 py-3 rounded-2xl bg-primary text-white font-bold flex items-center justify-center gap-2 shadow-[0_10px_20px_rgba(5,99,128,0.2)] hover:shadow-[0_15px_25px_rgba(5,99,128,0.3)] active:scale-95 transition-all"
        >
          <Plus size={20} />
          Tambah Layanan
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={20} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama layanan, kategori..." 
            className="w-full pl-12 pr-4 py-4 bg-surface-container-lowest rounded-2xl border border-white/60 shadow-sm focus:ring-2 focus:ring-primary/20 transition-all text-on-surface outline-none font-medium"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {['Semua', 'for Baby (0-24 Bulan)', 'for Kids (3-12 Tahun)', 'for Moms', 'Treatment Lain'].map((filter) => (
            <button 
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-6 py-4 rounded-2xl whitespace-nowrap font-bold transition-all ${
                activeFilter === filter 
                  ? 'bg-primary text-white shadow-md' 
                  : 'bg-surface-container-lowest border border-white/60 text-on-surface-variant hover:bg-primary-container/20 hover:text-primary'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-on-surface-variant">Memuat data layanan...</div>
        ) : filteredServices.length === 0 ? (
          <div className="col-span-full text-center py-12 text-on-surface-variant">Belum ada data layanan.</div>
        ) : (
          filteredServices.map((item) => (
            <div key={item.id} className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-[0_10px_30px_rgba(0,50,74,0.03)] border border-white/60 group hover:shadow-[0_20px_40px_rgba(0,50,74,0.06)] transition-all duration-300 flex flex-col">
              
              {/* Image */}
              <div className="h-40 relative overflow-hidden bg-surface-container-low">
                <img 
                  src={item.image} 
                  alt={item.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-4 right-4 flex gap-2">
                  <button 
                    onClick={() => openEditModal(item)}
                    className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={() => setDeleteConfirmId(item.id)}
                    className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-on-surface-variant hover:text-error transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 flex-1 flex flex-col">
                <div className="mb-4">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md mb-2 inline-block ${getCategoryColor(item.category)}`}>
                    {item.category}
                  </span>
                  <h3 className="text-lg font-headline font-bold text-on-surface leading-tight">{item.name}</h3>
                  {item.description && (
                    <p className="text-sm text-on-surface-variant mt-2 line-clamp-2">{item.description}</p>
                  )}
                </div>

                <div className="mt-auto pt-4 border-t border-outline-variant/20">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <Clock size={16} />
                      <span className="text-sm font-bold">{item.duration} Menit</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-primary text-lg">{formatCurrency(item.price)}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-[2rem] w-full max-w-md shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-surface-container-highest flex justify-between items-center bg-surface-container-low/50">
              <h2 className="text-2xl font-headline font-bold text-primary">
                {editingId ? 'Edit Layanan' : 'Tambah Layanan'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-full hover:bg-surface-container-highest text-on-surface-variant transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="service-form" onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">Nama Layanan</label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    placeholder="Contoh: Baby Spa Premium"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">Kategori</label>
                  <select 
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                  >
                    <option value="for Baby (0-24 Bulan)">for Baby (0-24 Bulan)</option>
                    <option value="for Kids (3-12 Tahun)">for Kids (3-12 Tahun)</option>
                    <option value="for Moms">for Moms</option>
                    <option value="Treatment Lain">Treatment Lain</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Durasi (Menit)</label>
                    <input 
                      type="number" 
                      required
                      min="1"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                      placeholder="60"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Harga (Rp)</label>
                    <input 
                      type="number" 
                      required
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                      placeholder="150000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">Deskripsi</label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium resize-none h-24"
                    placeholder="Penjelasan singkat tentang layanan..."
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">Gambar Layanan (Opsional)</label>
                  <div className="flex items-center gap-4">
                    {image && (
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-surface-container-low shrink-0 border border-outline-variant/30">
                        <img src={image} alt="Preview" className="w-full h-full object-cover" />
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
                        {isUploading ? 'Memproses...' : 'Upload Gambar'}
                      </button>
                    </div>
                  </div>
                  {image && (
                    <button 
                      type="button" 
                      onClick={() => setImage('')}
                      className="text-xs text-error mt-2 font-bold hover:underline"
                    >
                      Hapus Gambar
                    </button>
                  )}
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-surface-container-highest bg-surface-container-lowest flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-3 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-highest transition-colors"
              >
                Batal
              </button>
              <button 
                type="submit"
                form="service-form"
                className="px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-md hover:shadow-lg active:scale-95 transition-all"
              >
                {editingId ? 'Simpan Perubahan' : 'Simpan Layanan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-[2rem] w-full max-w-sm shadow-2xl border border-white/20 overflow-hidden flex flex-col">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-error-container rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-error" size={32} />
              </div>
              <h3 className="text-xl font-headline font-bold text-on-surface mb-2">Hapus Layanan?</h3>
              <p className="text-on-surface-variant text-sm">
                Apakah Anda yakin ingin menghapus layanan ini? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 rounded-xl font-bold text-on-surface-variant bg-surface-container-highest hover:bg-surface-container-highest/80 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-3 rounded-xl bg-error text-white font-bold shadow-md hover:shadow-lg active:scale-95 transition-all"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
