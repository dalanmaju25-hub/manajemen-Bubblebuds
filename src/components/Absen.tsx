import { useState, useEffect } from 'react';
import { MapPin, Clock, Camera, CheckCircle2, Fingerprint, History, Calendar, AlertCircle, FileText, Check, X } from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
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

interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  status: string;
}

interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'Menunggu' | 'Disetujui' | 'Ditolak';
  createdAt: any;
}

// --- KONFIGURASI LOKASI KLINIK ---
// Ganti koordinat ini dengan koordinat asli klinik Anda (Latitude, Longitude)
// Anda bisa mendapatkan koordinat dari Google Maps (klik kanan pada lokasi -> copy koordinat)
const CLINIC_LAT = -8.3464483; // Contoh: Jakarta
const CLINIC_LNG = 113.6009492;
const MAX_RADIUS_METERS = 500; // Jarak maksimal yang diizinkan (dalam meter)

function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius bumi dalam meter
  const dLat = deg2rad(lat2-lat1);
  const dLon = deg2rad(lon2-lon1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
}

function deg2rad(deg: number) {
  return deg * (Math.PI/180);
}

export default function Absen() {
  const [time, setTime] = useState(new Date());
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [activeTab, setActiveTab] = useState<'absen' | 'cuti'>('absen');

  // State Lokasi
  const [locationStatus, setLocationStatus] = useState<'checking' | 'in-range' | 'out-of-range' | 'error'>('checking');
  const [distance, setDistance] = useState<number | null>(null);

  // State Riwayat Absen
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [historyRecord, setHistoryRecord] = useState<AttendanceRecord | null>(null);

  // State Cuti
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [allPendingLeaves, setAllPendingLeaves] = useState<LeaveRequest[]>([]);
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribeUser = onSnapshot(doc(db, 'users', auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserRole(docSnap.data().role);
      }
    });

    const todayDate = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, 'attendance'),
      where('userId', '==', auth.currentUser.uid),
      where('date', '==', todayDate)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setTodayRecord({ id: doc.id, ...doc.data() } as AttendanceRecord);
      } else {
        setTodayRecord(null);
      }
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
      setIsLoading(false);
    });

    // Fetch user's leave requests
    const qLeaves = query(
      collection(db, 'leave_requests'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeLeaves = onSnapshot(qLeaves, (snapshot) => {
      const leaves: LeaveRequest[] = [];
      snapshot.forEach(doc => leaves.push({ id: doc.id, ...doc.data() } as LeaveRequest));
      setLeaveRequests(leaves);
    });

    // Fetch all pending leaves for managers
    const qAllLeaves = query(
      collection(db, 'leave_requests'),
      where('status', '==', 'Menunggu'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeAllLeaves = onSnapshot(qAllLeaves, (snapshot) => {
      const leaves: LeaveRequest[] = [];
      snapshot.forEach(doc => leaves.push({ id: doc.id, ...doc.data() } as LeaveRequest));
      setAllPendingLeaves(leaves);
    });

    return () => {
      unsubscribeUser();
      unsubscribe();
      unsubscribeLeaves();
      unsubscribeAllLeaves();
    };
  }, []);

  // Cek Lokasi
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const dist = getDistanceFromLatLonInM(
            position.coords.latitude,
            position.coords.longitude,
            CLINIC_LAT,
            CLINIC_LNG
          );
          setDistance(Math.round(dist));
          if (dist <= MAX_RADIUS_METERS) {
            setLocationStatus('in-range');
          } else {
            setLocationStatus('out-of-range');
          }
        },
        (error) => {
          console.error("Error getting location:", error);
          setLocationStatus('error');
        },
        { enableHighAccuracy: true }
      );
    } else {
      setLocationStatus('error');
    }
  }, []);

  // Fetch Riwayat berdasarkan tanggal
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'attendance'),
      where('userId', '==', auth.currentUser.uid),
      where('date', '==', selectedDate)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setHistoryRecord({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as AttendanceRecord);
      } else {
        setHistoryRecord(null);
      }
    });
    return () => unsubscribe();
  }, [selectedDate]);

  const handleClockIn = async () => {
    if (!auth.currentUser) return;
    
    const todayDate = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    
    // Simple logic for status: before 08:00 is Tepat Waktu, else Terlambat
    const currentHour = new Date().getHours();
    const status = currentHour < 8 ? 'Tepat Waktu' : 'Terlambat';

    try {
      await addDoc(collection(db, 'attendance'), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email || 'User',
        date: todayDate,
        clockIn: now,
        clockOut: null,
        status: status,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'attendance');
    }
  };

  const handleClockOut = async () => {
    if (!auth.currentUser || !todayRecord) return;
    
    const now = new Date().toISOString();

    try {
      await updateDoc(doc(db, 'attendance', todayRecord.id), {
        clockOut: now
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `attendance/${todayRecord.id}`);
    }
  };

  const hasCheckedIn = !!todayRecord?.clockIn;
  const hasCheckedOut = !!todayRecord?.clockOut;

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !leaveStartDate || !leaveEndDate || !leaveReason) return;

    try {
      await addDoc(collection(db, 'leave_requests'), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email || 'User',
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        reason: leaveReason,
        status: 'Menunggu',
        createdAt: serverTimestamp()
      });
      setLeaveStartDate('');
      setLeaveEndDate('');
      setLeaveReason('');
      alert('Pengajuan cuti berhasil dikirim.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'leave_requests');
    }
  };

  const handleUpdateLeaveStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'leave_requests', id), {
        status: newStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leave_requests/${id}`);
    }
  };

  const canApproveLeave = ['Super Admin', 'Manajer'].includes(userRole);

  return (
    <div className="pt-28 pb-32 px-6 md:px-12 max-w-4xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-headline font-extrabold text-primary tracking-tight">Portal Karyawan</h1>
        <p className="text-on-surface-variant font-medium mt-2">Catat kehadiran dan ajukan cuti Anda.</p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="bg-surface-container-low p-1 rounded-2xl inline-flex">
          <button
            onClick={() => setActiveTab('absen')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'absen' ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:text-primary'}`}
          >
            Absensi Harian
          </button>
          <button
            onClick={() => setActiveTab('cuti')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'cuti' ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:text-primary'}`}
          >
            Pengajuan Cuti
          </button>
        </div>
      </div>

      {activeTab === 'absen' ? (
        <>
          {/* Main Absen Card */}
      <div className="bg-surface-container-lowest rounded-[3rem] p-8 shadow-[0_20px_40px_rgba(0,50,74,0.06)] border border-white/60 flex flex-col items-center relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary-container/30 to-transparent -z-10"></div>
        
        {/* Clock */}
        <div className="text-5xl md:text-7xl font-headline font-extrabold text-primary tracking-tighter mb-2">
          {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="text-on-surface-variant font-medium mb-8">
          {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>

        {/* Location Status */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-10 ${
          locationStatus === 'checking' ? 'bg-surface-container-high text-on-surface-variant' :
          locationStatus === 'in-range' ? 'bg-[#e6f4ea] text-[#006b1f]' :
          locationStatus === 'out-of-range' ? 'bg-error-container text-error' :
          'bg-surface-container-high text-on-surface-variant'
        }`}>
          {locationStatus === 'checking' && <Clock size={16} className="animate-spin" />}
          {locationStatus === 'in-range' && <MapPin size={16} />}
          {locationStatus === 'out-of-range' && <AlertCircle size={16} />}
          {locationStatus === 'error' && <AlertCircle size={16} />}
          
          <span>
            {locationStatus === 'checking' ? 'Mengecek lokasi...' :
             locationStatus === 'in-range' ? `Lokasi Sesuai (${distance}m)` :
             locationStatus === 'out-of-range' ? `Di Luar Jangkauan (${distance}m)` :
             'Akses Lokasi Ditolak/Gagal'}
          </span>
        </div>

        {/* Action Button */}
        {isLoading ? (
          <div className="w-48 h-48 rounded-full flex items-center justify-center bg-surface-container-high animate-pulse">
            <span className="text-on-surface-variant font-bold">Memuat...</span>
          </div>
        ) : hasCheckedOut ? (
          <div className="w-48 h-48 rounded-full flex flex-col items-center justify-center gap-3 bg-surface-container-highest text-on-surface-variant shadow-inner">
            <CheckCircle2 size={48} />
            <span className="font-headline font-bold text-xl tracking-widest uppercase text-center leading-tight">
              Selesai<br/>Hari Ini
            </span>
          </div>
        ) : (
          <button 
            onClick={hasCheckedIn ? handleClockOut : handleClockIn}
            disabled={locationStatus !== 'in-range'}
            className={`w-48 h-48 rounded-full flex flex-col items-center justify-center gap-3 text-white shadow-[0_20px_40px_rgba(5,99,128,0.3)] transition-all duration-500 active:scale-95 ${
              locationStatus !== 'in-range' ? 'bg-surface-container-highest text-on-surface-variant shadow-none cursor-not-allowed opacity-70' :
              hasCheckedIn 
                ? 'bg-gradient-to-br from-[#b31b25] to-[#ff5449] shadow-[0_20px_40px_rgba(179,27,37,0.3)]' 
                : 'bg-gradient-to-br from-primary to-primary-container'
            }`}
          >
            <Fingerprint size={48} className={hasCheckedIn && locationStatus === 'in-range' ? 'animate-pulse' : ''} />
            <span className="font-headline font-bold text-xl tracking-widest uppercase text-center whitespace-pre-line">
              {locationStatus !== 'in-range' ? 'Lokasi\nTidak Valid' : hasCheckedIn ? 'Clock Out' : 'Clock In'}
            </span>
          </button>
        )}

        <p className="text-xs text-on-surface-variant mt-6 flex items-center gap-1">
          <Camera size={14} /> Foto selfie akan diambil otomatis saat absen
        </p>
      </div>

      {/* History */}
      <div className="mt-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-xl font-headline font-bold flex items-center gap-2">
            <History className="text-primary" size={24} />
            Riwayat Absensi
          </h3>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10 pr-4 py-2 bg-surface-container-lowest rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium text-sm"
            />
          </div>
        </div>
        <div className="space-y-4">
          <div className={`bg-surface-container-lowest p-5 rounded-2xl border-l-4 flex items-center justify-between shadow-sm ${historyRecord?.clockIn ? 'border-[#006b1f]' : 'border-outline-variant opacity-60'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${historyRecord?.clockIn ? 'bg-[#e6f4ea] text-[#006b1f]' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                {historyRecord?.clockIn ? <CheckCircle2 size={20} /> : <Clock size={20} />}
              </div>
              <div>
                <p className="font-bold text-on-surface">Clock In (Masuk)</p>
                <p className="text-xs text-on-surface-variant">{historyRecord?.clockIn ? `${formatTime(historyRecord.clockIn)}` : 'Belum absen masuk'}</p>
              </div>
            </div>
            <span className={`text-sm font-bold ${historyRecord?.status === 'Tepat Waktu' ? 'text-[#006b1f]' : historyRecord?.status === 'Terlambat' ? 'text-[#b31b25]' : 'text-on-surface-variant'}`}>
              {historyRecord?.clockIn ? historyRecord.status : '-'}
            </span>
          </div>
          
          <div className={`bg-surface-container-lowest p-5 rounded-2xl border-l-4 flex items-center justify-between shadow-sm ${historyRecord?.clockOut ? 'border-[#006b1f]' : 'border-outline-variant opacity-60'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${historyRecord?.clockOut ? 'bg-[#e6f4ea] text-[#006b1f]' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                {historyRecord?.clockOut ? <CheckCircle2 size={20} /> : <Clock size={20} />}
              </div>
              <div>
                <p className="font-bold text-on-surface">Clock Out (Pulang)</p>
                <p className="text-xs text-on-surface-variant">{historyRecord?.clockOut ? `${formatTime(historyRecord.clockOut)}` : 'Belum absen pulang'}</p>
              </div>
            </div>
            <span className="text-sm font-bold text-on-surface-variant">-</span>
          </div>
        </div>
      </div>
      </>
      ) : (
        <div className="space-y-8 animate-in fade-in">
          {/* Leave Request Form */}
          <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-white/60">
            <h3 className="text-xl font-headline font-bold flex items-center gap-2 mb-6">
              <FileText className="text-primary" size={24} />
              Form Pengajuan Cuti
            </h3>
            <form onSubmit={handleSubmitLeave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">Mulai Tanggal</label>
                  <input 
                    type="date" 
                    required
                    value={leaveStartDate}
                    onChange={(e) => setLeaveStartDate(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">Sampai Tanggal</label>
                  <input 
                    type="date" 
                    required
                    value={leaveEndDate}
                    onChange={(e) => setLeaveEndDate(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-2">Alasan Cuti</label>
                <textarea 
                  required
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium resize-none"
                  placeholder="Tuliskan alasan pengajuan cuti Anda..."
                ></textarea>
              </div>
              <div className="flex justify-end">
                <button 
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-md hover:shadow-lg active:scale-95 transition-all"
                >
                  Ajukan Cuti
                </button>
              </div>
            </form>
          </div>

          {/* Manager Approval Section */}
          {canApproveLeave && allPendingLeaves.length > 0 && (
            <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-white/60 border-l-4 border-l-[#fbbc05]">
              <h3 className="text-xl font-headline font-bold flex items-center gap-2 mb-6">
                <AlertCircle className="text-[#fbbc05]" size={24} />
                Menunggu Persetujuan Anda
              </h3>
              <div className="space-y-4">
                {allPendingLeaves.map(leave => (
                  <div key={leave.id} className="p-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-on-surface">{leave.userName}</h4>
                      <p className="text-sm text-on-surface-variant mt-1">{formatDate(leave.startDate)} - {formatDate(leave.endDate)}</p>
                      <p className="text-sm text-on-surface/70 mt-2 italic">"{leave.reason}"</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleUpdateLeaveStatus(leave.id, 'Disetujui')}
                        className="p-2 rounded-xl bg-[#e6f4ea] text-[#006b1f] hover:bg-[#006b1f] hover:text-white transition-colors flex items-center gap-1 text-sm font-bold"
                      >
                        <Check size={16} /> Setujui
                      </button>
                      <button 
                        onClick={() => handleUpdateLeaveStatus(leave.id, 'Ditolak')}
                        className="p-2 rounded-xl bg-error-container text-error hover:bg-error hover:text-white transition-colors flex items-center gap-1 text-sm font-bold"
                      >
                        <X size={16} /> Tolak
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* My Leave History */}
          <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-white/60">
            <h3 className="text-xl font-headline font-bold flex items-center gap-2 mb-6">
              <History className="text-primary" size={24} />
              Riwayat Cuti Saya
            </h3>
            {leaveRequests.length === 0 ? (
              <p className="text-on-surface-variant text-center py-4">Belum ada riwayat pengajuan cuti.</p>
            ) : (
              <div className="space-y-4">
                {leaveRequests.map(leave => (
                  <div key={leave.id} className="p-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-on-surface">{formatDate(leave.startDate)} - {formatDate(leave.endDate)}</p>
                      <p className="text-sm text-on-surface-variant mt-1">{leave.reason}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold w-fit ${
                      leave.status === 'Disetujui' ? 'bg-[#e6f4ea] text-[#006b1f]' :
                      leave.status === 'Ditolak' ? 'bg-error-container text-error' :
                      'bg-[#fff4d6] text-[#b8860b]'
                    }`}>
                      {leave.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
