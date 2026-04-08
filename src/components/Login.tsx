import { useState } from 'react';
import { Mail, Lock, Eye, ArrowRight, Fingerprint, User } from 'lucide-react';
import { auth, googleProvider, db } from '../firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [activeRole, setActiveRole] = useState('Member');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [memberNumber, setMemberNumber] = useState('');
  
  const roles = ['Member', 'Staf', 'Kasir', 'Manajer', 'Super Admin'];

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const user = userCredential.user;
      
      // Check if user document exists
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        // Determine accessible menus based on role
        let accessibleMenus: string[] = [];
        switch (activeRole) {
          case 'Member':
            accessibleMenus = ['jadwal'];
            break;
          case 'Staf':
            accessibleMenus = ['jadwal', 'member', 'staff', 'absen'];
            break;
          case 'Kasir':
            accessibleMenus = ['dashboard', 'jadwal', 'member', 'laporan', 'absen'];
            break;
          case 'Manajer':
            accessibleMenus = ['dashboard', 'jadwal', 'staff', 'member', 'laporan', 'pengguna', 'inventaris', 'layanan'];
            break;
          case 'Super Admin':
            accessibleMenus = ['dashboard', 'jadwal', 'staff', 'member', 'laporan', 'absen', 'pengguna', 'inventaris', 'layanan'];
            break;
          default:
            accessibleMenus = ['jadwal'];
        }

        // Create user document
        await setDoc(userDocRef, {
          name: user.displayName || 'User',
          email: user.email || '',
          role: activeRole,
          status: 'Aktif',
          accessibleMenus,
          lastLogin: new Date().toISOString(),
          avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName || 'User'}`,
          createdAt: new Date().toISOString()
        });

        // If role is Member, also add to members collection
        if (activeRole === 'Member') {
          const memberDocRef = doc(db, 'members', user.uid);
          const memberDocSnap = await getDoc(memberDocRef);
          if (!memberDocSnap.exists()) {
            await setDoc(memberDocRef, {
              memberNumber: '',
              name: user.displayName || 'User',
              email: user.email || '',
              tier: 'Bronze',
              points: 0,
              avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName || 'User'}`,
              createdAt: new Date().toISOString()
            });
          }
        }
      } else {
        // Update last login
        await setDoc(userDocRef, { lastLogin: new Date().toISOString() }, { merge: true });
      }

      onLogin();
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || 'Gagal login dengan Google');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email dan password harus diisi');
      return;
    }
    if (isRegistering && !name) {
      setError('Nama lengkap harus diisi untuk pendaftaran');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Determine accessible menus based on role
        let accessibleMenus: string[] = [];
        switch (activeRole) {
          case 'Member':
            accessibleMenus = ['jadwal'];
            break;
          case 'Staf':
            accessibleMenus = ['jadwal', 'member', 'staff', 'absen'];
            break;
          case 'Kasir':
            accessibleMenus = ['dashboard', 'jadwal', 'member', 'laporan', 'absen'];
            break;
          case 'Manajer':
            accessibleMenus = ['dashboard', 'jadwal', 'staff', 'member', 'laporan', 'pengguna', 'inventaris', 'layanan'];
            break;
          case 'Super Admin':
            accessibleMenus = ['dashboard', 'jadwal', 'staff', 'member', 'laporan', 'absen', 'pengguna', 'inventaris', 'layanan'];
            break;
          default:
            accessibleMenus = ['jadwal'];
        }

        // Save user profile to Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          name,
          email,
          role: activeRole,
          status: 'Aktif',
          accessibleMenus,
          lastLogin: new Date().toISOString(),
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
          createdAt: new Date().toISOString()
        });

        // If role is Member, also add to members collection
        if (activeRole === 'Member') {
          await setDoc(doc(db, 'members', userCredential.user.uid), {
            memberNumber,
            name,
            email,
            tier: 'Bronze',
            points: 0,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
            createdAt: new Date().toISOString()
          });
        }

      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLogin();
    } catch (err: any) {
      console.error("Auth error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Email sudah terdaftar. Silakan login.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('Email atau password salah. Jika belum punya akun, silakan Daftar terlebih dahulu.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password terlalu lemah. Minimal 6 karakter.');
      } else {
        setError(err.message || 'Terjadi kesalahan saat otentikasi');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface relative overflow-hidden flex flex-col items-center justify-center p-6">
      {/* Background decorative organic shapes */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#d3ebff] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] opacity-50 blur-3xl -z-10"></div>
      <div className="absolute bottom-[-5%] right-[-5%] w-[600px] h-[600px] bg-[#c7e7ff] rounded-[60%_40%_30%_70%/60%_30%_70%_40%] opacity-40 blur-3xl -z-10"></div>

      {/* Logo & Header */}
      <div className="flex flex-col items-center mb-8 z-10">
        <img
          src="/logo.png"
          alt="Bubble Buds Logo"
          className="w-36 h-36 object-contain drop-shadow-xl mb-4"
          referrerPolicy="no-referrer"
        />
        <h1 className="font-headline text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-primary to-primary-container text-center max-w-md leading-tight">
          Baby, kids n mom <br /> Spa
        </h1>
        <p className="text-on-surface-variant font-medium mt-3 text-center">
          Relaksasi Sempurna, Stimulasi Terpercaya.
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-[420px] bg-surface-container-lowest/80 backdrop-blur-2xl rounded-[2.5rem] p-8 shadow-[0_20px_40px_rgba(0,50,74,0.06)] border border-white/50 z-10">
        {/* Role Selector */}
        <div className="mb-8">
          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-primary/60 ml-1 mb-3 block">
            Access Portal
          </span>
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                  activeRole === role
                    ? 'bg-primary text-on-primary shadow-md'
                    : 'bg-surface-container-highest text-on-surface-variant hover:bg-[#a8dbff]'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-[#fce8e6] text-[#c5221f] rounded-2xl text-sm font-medium text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form 
          className="space-y-5" 
          onSubmit={handleEmailAuth}
        >
          {/* Name Input (Only for Registration) */}
          {isRegistering && (
            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-primary group-focus-within:text-primary transition-colors">
                <User size={20} />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama Lengkap"
                className="w-full bg-surface-container-low border-none rounded-2xl py-4 pl-14 pr-4 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-primary-container transition-all font-medium outline-none"
              />
            </div>
          )}

          {/* Member Number Input (Only for Member Registration) */}
          {isRegistering && activeRole === 'Member' && (
            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-primary group-focus-within:text-primary transition-colors">
                <User size={20} />
              </div>
              <input
                type="text"
                value={memberNumber}
                onChange={(e) => setMemberNumber(e.target.value)}
                placeholder="Nomor Member"
                className="w-full bg-surface-container-low border-none rounded-2xl py-4 pl-14 pr-4 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-primary-container transition-all font-medium outline-none"
              />
            </div>
          )}

          {/* Email Input */}
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-primary group-focus-within:text-primary transition-colors">
              <Mail size={20} />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address"
              className="w-full bg-surface-container-low border-none rounded-2xl py-4 pl-14 pr-4 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-primary-container transition-all font-medium outline-none"
            />
          </div>

          {/* Password Input */}
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-primary group-focus-within:text-primary transition-colors">
              <Lock size={20} />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-surface-container-low border-none rounded-2xl py-4 pl-14 pr-12 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-primary-container transition-all font-medium outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-primary transition-colors"
            >
              <Eye size={20} />
            </button>
          </div>

          {/* Forgot Password */}
          {!isRegistering && (
            <div className="flex justify-end pt-1">
              <a href="#" className="text-sm font-bold text-primary hover:opacity-80 transition-opacity">
                Forgot Password?
              </a>
            </div>
          )}

          {/* Login/Register Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-bold py-4 rounded-full shadow-[0_10px_20px_rgba(5,99,128,0.2)] hover:shadow-[0_15px_25px_rgba(5,99,128,0.3)] transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 mt-4 disabled:opacity-70"
          >
            {isLoading ? 'MEMPROSES...' : (isRegistering ? 'DAFTAR' : 'LOGIN')}
            {!isLoading && <ArrowRight size={20} />}
          </button>
        </form>

        {/* Divider */}
        <div className="mt-10 mb-6 flex items-center justify-center relative">
          <div className="absolute w-full h-px bg-surface-container-highest"></div>
          <span className="relative bg-surface-container-lowest/80 px-4 font-label text-xs font-medium text-on-surface-variant/60">
            Or continue with
          </span>
        </div>

        {/* Social Logins */}
        <div className="flex justify-center gap-4">
          <button className="w-14 h-14 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors active:scale-95">
            <Fingerprint size={24} />
          </button>
          <button 
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-14 h-14 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors active:scale-95 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-10 text-center text-on-surface-variant font-medium text-sm z-10">
        {isRegistering ? 'Sudah punya akun?' : 'Belum punya akun?'} {' '}
        <button 
          onClick={() => {
            setIsRegistering(!isRegistering);
            setError('');
          }} 
          className="text-primary font-bold hover:underline"
        >
          {isRegistering ? 'Masuk di sini' : 'Daftar sekarang'}
        </button>
      </p>
    </div>
  );
}
