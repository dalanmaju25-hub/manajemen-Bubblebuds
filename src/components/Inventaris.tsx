import React, { useState, useEffect, useRef } from 'react';
import { Package, Search, Filter, Plus, AlertTriangle, Box, RefreshCw, MoreVertical, Edit, X, Trash2, Upload } from 'lucide-react';
import { collection, onSnapshot, addDoc, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
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

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  price: number;
  image: string;
  createdAt: string;
}

export default function Inventaris() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Semua');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Bahan');
  const [stock, setStock] = useState<number | ''>('');
  const [minStock, setMinStock] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');
  const [image, setImage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'inventory'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData: InventoryItem[] = [];
      snapshot.forEach((doc) => {
        itemsData.push({ id: doc.id, ...doc.data() } as InventoryItem);
      });
      setInventory(itemsData);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

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

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || stock === '' || minStock === '' || price === '') return;

    try {
      if (editingId) {
        await updateDoc(doc(db, 'inventory', editingId), {
          name,
          category,
          stock: Number(stock),
          minStock: Number(minStock),
          price: Number(price),
          image: image || `https://images.unsplash.com/photo-1584305574647-0cc949a2bb9f?q=80&w=200&auto=format&fit=crop`,
        });
      } else {
        await addDoc(collection(db, 'inventory'), {
          name,
          category,
          stock: Number(stock),
          minStock: Number(minStock),
          price: Number(price),
          image: image || `https://images.unsplash.com/photo-1584305574647-0cc949a2bb9f?q=80&w=200&auto=format&fit=crop`,
          createdAt: new Date().toISOString()
        });
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'inventory');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'inventory', id));
      setDeleteConfirmId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `inventory/${id}`);
    }
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingId(item.id);
    setName(item.name);
    setCategory(item.category);
    setStock(item.stock);
    setMinStock(item.minStock);
    setPrice(item.price);
    setImage(item.image || '');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setName('');
    setCategory('Bahan');
    setStock('');
    setMinStock('');
    setPrice('');
    setImage('');
  };

  const getItemStatus = (stock: number, minStock: number) => {
    if (stock <= 0) return 'Kritis';
    if (stock <= minStock) return 'Menipis';
    return 'Aman';
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Aman': return 'bg-[#e6f4ea] text-[#006b1f] border-[#a8dab5]';
      case 'Menipis': return 'bg-[#fff4d6] text-[#b8860b] border-[#ffe082]';
      case 'Kritis': return 'bg-[#fce8e6] text-[#c5221f] border-[#f8bbd0]';
      default: return 'bg-surface-container-high text-on-surface';
    }
  };

  const getCategoryColor = (category: string) => {
    switch(category) {
      case 'Produk Retail': return 'bg-primary-container/40 text-primary';
      case 'Alat': return 'bg-[#e8f0fe] text-[#1967d2]';
      case 'Bahan': return 'bg-[#f3e8fd] text-[#7b1fa2]';
      default: return 'bg-surface-container-high text-on-surface';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'Semua' || item.category === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const totalItems = inventory.length;
  const lowStockItems = inventory.filter(item => item.stock > 0 && item.stock <= item.minStock).length;
  const criticalStockItems = inventory.filter(item => item.stock <= 0).length;

  return (
    <div className="pt-28 pb-32 px-6 md:px-12 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-headline font-extrabold text-primary tracking-tight">Inventaris</h1>
          <p className="text-on-surface-variant font-medium mt-2">Kelola stok alat, bahan habis pakai, dan produk retail.</p>
        </div>
        <button 
          onClick={() => {
            setEditingId(null);
            setIsModalOpen(true);
          }}
          className="px-5 py-3 rounded-2xl bg-primary text-white font-bold flex items-center justify-center gap-2 shadow-[0_10px_20px_rgba(5,99,128,0.2)] hover:shadow-[0_15px_25px_rgba(5,99,128,0.3)] active:scale-95 transition-all"
        >
          <Plus size={20} />
          Tambah Item
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-white/60 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary-container/50 flex items-center justify-center text-primary">
            <Package size={24} />
          </div>
          <div>
            <p className="text-sm font-label text-on-surface-variant uppercase tracking-widest font-bold">Total Item</p>
            <h3 className="text-2xl font-headline font-extrabold text-on-surface">{totalItems} Jenis</h3>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-white/60 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#fff4d6] flex items-center justify-center text-[#b8860b]">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm font-label text-on-surface-variant uppercase tracking-widest font-bold">Stok Menipis</p>
            <h3 className="text-2xl font-headline font-extrabold text-on-surface">{lowStockItems} Item</h3>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-white/60 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#fce8e6] flex items-center justify-center text-[#c5221f]">
            <Box size={24} />
          </div>
          <div>
            <p className="text-sm font-label text-on-surface-variant uppercase tracking-widest font-bold">Stok Kritis / Habis</p>
            <h3 className="text-2xl font-headline font-extrabold text-on-surface">{criticalStockItems} Item</h3>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={20} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama barang, kategori..." 
            className="w-full pl-12 pr-4 py-4 bg-surface-container-lowest rounded-2xl border border-white/60 shadow-sm focus:ring-2 focus:ring-primary/20 transition-all text-on-surface outline-none font-medium"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {['Semua', 'Produk Retail', 'Alat', 'Bahan'].map((filter) => (
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

      {/* Inventory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-on-surface-variant">Memuat data inventaris...</div>
        ) : filteredInventory.length === 0 ? (
          <div className="col-span-full text-center py-12 text-on-surface-variant">Belum ada data inventaris.</div>
        ) : (
          filteredInventory.map((item) => {
            const status = getItemStatus(item.stock, item.minStock);
            return (
              <div key={item.id} className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-[0_10px_30px_rgba(0,50,74,0.03)] border border-white/60 group hover:shadow-[0_20px_40px_rgba(0,50,74,0.06)] transition-all duration-300 flex flex-col">
                
                {/* Image & Status Badge */}
                <div className="h-40 relative overflow-hidden bg-surface-container-low">
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 left-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${getStatusColor(status)}`}>
                      {status}
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <button className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors">
                      <MoreVertical size={16} />
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
                  </div>

                  <div className="mt-auto">
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <p className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Sisa Stok</p>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-2xl font-headline font-extrabold ${item.stock <= item.minStock ? 'text-[#c5221f]' : 'text-on-surface'}`}>
                            {item.stock}
                          </span>
                          <span className="text-xs text-on-surface-variant font-medium">/ min. {item.minStock}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Harga / Nilai</p>
                        <span className="font-bold text-primary">{formatCurrency(item.price)}</span>
                      </div>
                    </div>

                    {/* Progress Bar for Stock */}
                    <div className="w-full bg-surface-container-highest rounded-full h-1.5 mb-5 overflow-hidden">
                      <div 
                        className={`h-1.5 rounded-full ${item.stock <= item.minStock ? 'bg-[#c5221f]' : 'bg-[#006b1f]'}`} 
                        style={{ width: `${Math.min((item.stock / (item.minStock * 3)) * 100, 100)}%` }}
                      ></div>
                    </div>

                    <div className="flex gap-2">
                      <button className="flex-1 py-2.5 rounded-xl bg-primary-container/30 text-primary font-bold text-sm hover:bg-primary-container/50 transition-colors flex items-center justify-center gap-2">
                        <RefreshCw size={16} /> Restock
                      </button>
                      <button 
                        onClick={() => openEditModal(item)}
                        className="p-2.5 rounded-xl border border-outline-variant/30 text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirmId(item.id)}
                        className="p-2.5 rounded-xl border border-outline-variant/30 text-on-surface-variant hover:text-error hover:border-error/30 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            );
          })
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
              <h2 className="text-xl font-headline font-bold text-on-surface mb-2">Hapus Item?</h2>
              <p className="text-on-surface-variant text-sm">
                Data item inventaris ini akan dihapus secara permanen.
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

      {/* Add/Edit Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-[2rem] w-full max-w-md shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-surface-container-highest flex justify-between items-center bg-surface-container-low/50">
              <h2 className="text-2xl font-headline font-bold text-primary">{editingId ? 'Edit Item' : 'Tambah Item'}</h2>
              <button 
                onClick={closeModal}
                className="p-2 rounded-full hover:bg-surface-container-highest text-on-surface-variant transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="inventory-form" onSubmit={handleAddItem} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">Nama Item</label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    placeholder="Contoh: Minyak Pijat Lavender"
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
                    <option value="Bahan">Bahan</option>
                    <option value="Alat">Alat</option>
                    <option value="Produk Retail">Produk Retail</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Stok Awal</label>
                    <input 
                      type="number" 
                      required
                      min="0"
                      value={stock}
                      onChange={(e) => setStock(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Stok Minimum</label>
                    <input 
                      type="number" 
                      required
                      min="0"
                      value={minStock}
                      onChange={(e) => setMinStock(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                      placeholder="10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">Harga / Nilai (Rp)</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    placeholder="50000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">Gambar Item (Opsional)</label>
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
                onClick={closeModal}
                className="px-6 py-3 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-highest transition-colors"
              >
                Batal
              </button>
              <button 
                type="submit"
                form="inventory-form"
                className="px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-md hover:shadow-lg active:scale-95 transition-all"
              >
                {editingId ? 'Simpan Perubahan' : 'Simpan Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
