import { GoogleAuthProvider, OAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Download, 
  Info, 
  ShieldCheck,
  Smartphone,
  Lock,
  ChevronRight,
  LogOut,
  Upload,
  User,
  Plus
} from 'lucide-react';
import { AppCategory, AppItem } from './types';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useCollection } from 'react-firebase-hooks/firestore';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { collection, query, orderBy, getDocs, doc, setDoc, deleteDoc, where } from 'firebase/firestore';

function AppCard({ app, isUnlocked, onUnlock, isAdmin, isYCP }: { app: AppItem; isUnlocked: boolean; onUnlock: (pwd: string) => void; isAdmin: boolean; isYCP: boolean }) {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editChecksum, setEditChecksum] = useState(app.checksum || '');
  const [editUrl, setEditUrl] = useState(app.downloadUrl || '');

  const isLocked = !isAdmin && !isUnlocked && (!isYCP || app.category === 'Personal');

  const handleAction = () => {
    if (isLocked) {
      if (showPassword) {
        onUnlock(password);
      } else {
        setShowPassword(true);
      }
    } else {
      if (app.downloadUrl) {
        window.open(app.downloadUrl, '_blank');
      } else {
        alert(`Download URL missing for ${app.name}`);
      }
    }
  };

  const handleSaveApp = async () => {
    try {
      if (!isAdmin) return;
      const ref = doc(db, 'apps', app.id);
      await setDoc(ref, {
        ...app,
        checksum: editChecksum,
        downloadUrl: editUrl,
        updatedAt: Date.now()
      });
      setIsEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `apps/${app.id}`);
    }
  };

  const handleDelete = async () => {
    if (!isAdmin) return;
    if (window.confirm('Delete this app?')) {
      try {
        await deleteDoc(doc(db, 'apps', app.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `apps/${app.id}`);
      }
    }
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="bg-white border border-slate-200 p-6 rounded-xl hover:shadow-md transition-shadow flex flex-col"
    >
      <div className="flex justify-between items-start mb-4">
        <span className={`text-[10px] font-bold px-2 py-1 rounded ${
          app.category === 'Work' 
            ? 'bg-slate-100 text-slate-600' 
            : 'bg-purple-100 text-purple-600'
        }`}>
          {app.category.toUpperCase()}
        </span>
        <div className="flex items-center space-x-2">
          {isAdmin && (
            <button onClick={() => setIsEditing(!isEditing)} className="text-xs text-blue-600 hover:underline">
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          )}
          <span className="text-slate-400 text-xs">{app.date}</span>
        </div>
      </div>
      
      <h3 className="font-bold text-lg mb-2">{app.name}</h3>
      <p className="text-sm text-slate-500 mb-4 flex-grow">{app.description}</p>
      
      {isEditing && isAdmin ? (
        <div className="flex flex-col space-y-2 mb-4">
          <input 
            type="text" 
            placeholder="Download URL"
            value={editUrl}
            onChange={e => setEditUrl(e.target.value)}
            className="border p-2 rounded text-xs w-full"
          />
          <input 
            type="text" 
            placeholder="SHA-256 Checksum"
            value={editChecksum}
            onChange={e => setEditChecksum(e.target.value)}
            className="border p-2 rounded text-xs w-full"
          />
          <div className="flex justify-between">
            <button onClick={handleDelete} className="bg-red-500 text-white text-xs px-3 py-1 rounded">Delete</button>
            <button onClick={handleSaveApp} className="bg-blue-600 text-white text-xs px-3 py-1 rounded">Save</button>
          </div>
        </div>
      ) : (
        <div className="mt-auto">
          {isLocked && showPassword ? (
            <form 
              onSubmit={(e) => { e.preventDefault(); handleAction(); }} 
              className="flex items-center space-x-2"
            >
              <input 
                type="password" 
                placeholder="Password..."
                className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <button 
                type="submit" 
                className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-bold hover:bg-blue-700 transition-colors"
              >
                Unlock
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={handleAction}
                className={`text-sm font-bold flex items-center space-x-2 transition-colors ${
                  isLocked ? 'text-slate-500 hover:text-slate-700' : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                {isLocked ? <Lock className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                <span>{isLocked ? 'Unlock to Download' : `Download APK (v${app.version})`}</span>
              </button>
              
              {!isLocked && app.checksum && (
                <div className="border border-slate-200 rounded p-2 text-xs text-slate-500 break-all bg-slate-50 relative mt-1">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">SHA-256 Checksum (Verified)</span>
                  {app.checksum}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function UploadAppModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<'Work' | 'Personal'>('Work');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [checksum, setChecksum] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const appId = Math.random().toString(36).substring(2, 9);
    
    try {
      const newApp: AppItem = {
        name,
        description,
        version,
        date,
        category,
        downloadUrl,
        checksum,
      } as AppItem;
      const docRef = doc(db, 'apps', appId);
      const appData = {
        ...newApp,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await setDoc(docRef, appData);
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `apps/${appId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold mb-4">Upload New App</h3>
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block font-medium mb-1">App Name</label>
            <input required type="text" className="w-full border p-2 rounded" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="block font-medium mb-1">Description</label>
            <textarea required className="w-full border p-2 rounded" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1">Version</label>
              <input required type="text" className="w-full border p-2 rounded" value={version} onChange={e => setVersion(e.target.value)} />
            </div>
            <div>
              <label className="block font-medium mb-1">Date</label>
              <input required type="date" className="w-full border p-2 rounded" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block font-medium mb-1">Category</label>
            <select className="w-full border p-2 rounded" value={category} onChange={e => setCategory(e.target.value as 'Work' | 'Personal')}>
              <option value="Work">Work</option>
              <option value="Personal">Personal</option>
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Download URL</label>
            <input required type="url" className="w-full border p-2 rounded" value={downloadUrl} onChange={e => setDownloadUrl(e.target.value)} />
          </div>
          <div>
            <label className="block font-medium mb-1">SHA-256 Checksum (Optional)</label>
            <input type="text" className="w-full border p-2 rounded" value={checksum} onChange={e => setChecksum(e.target.value)} />
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 font-medium">Cancel</button>
            <button disabled={loading} type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold">
              {loading ? 'Saving...' : 'Upload App'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [activeCategory, setActiveCategory] = useState<AppCategory>('All');
  const [isPersonalUnlocked, setIsPersonalUnlocked] = useState(false);
  const [user, loading] = useAuthState(auth);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  const handleUnlockPersonal = (pwd: string) => {
    if (pwd === 'amanda123') {
      setIsPersonalUnlocked(true);
    } else {
      alert('Incorrect password. Please try again.');
    }
  };

  const isAdmin = user?.email === 'adsamanda02@gmail.com' || user?.email === 'aadestia@gmail.com';
  const isYCP = user?.email?.endsWith('@ycp.com') || isAdmin;

  const [allDocs] = useCollection(collection(db, 'apps'));

  const apps = React.useMemo(() => {
    if (!allDocs) return [];
    return allDocs.docs
      .map(d => ({ id: d.id, ...d.data() } as AppItem))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [allDocs]);

  const filteredApps = apps.filter(app => {
    if (activeCategory === 'All') return true;
    return app.category === activeCategory;
  });

  const handleGoogleSignIn = () => {
  signInWithPopup(auth, new GoogleAuthProvider());
};

const handleMicrosoftSignIn = () => {
  const provider = new OAuthProvider('microsoft.com');
  // This forces it to ask for their corporate login
  provider.setCustomParameters({
    tenant: 'common' 
  });
  signInWithPopup(auth, provider).catch(err => {
    console.error("Login failed", err);
    alert("Login failed. Please make sure you are using your YCP email.");
  });
};

  const handleSignOut = () => {
    signOut(auth);
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Left Sidebar: Identity & Filters */}
      <aside className="w-72 bg-slate-900 text-white flex flex-col p-8 shrink-0 overflow-y-auto hidden md:flex">
        <div className="mb-12">
          <div className="h-12 w-12 bg-blue-500 rounded-lg flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">INTERNAL APPS</h1>
          <p className="text-slate-400 text-xs mt-1 uppercase tracking-widest">Secure Distribution</p>
        </div>

        <nav className="flex-1 space-y-6">
          <div>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-4">Navigation</p>
            <ul className="space-y-2">
              {(['All', 'Work', 'Personal'] as AppCategory[]).map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <li key={cat}>
                    <button
                      onClick={() => setActiveCategory(cat)}
                      className={`w-full flex items-center space-x-3 p-2 rounded-md transition-colors ${
                        isActive 
                          ? 'bg-slate-800 text-white font-medium' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {isActive && <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0"></span>}
                      <span>{cat === 'All' ? 'All Archives' : `${cat === 'Work' ? 'Work' : 'Personal'} Applications`}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        <div className="mt-8">
          <div className="pt-6 border-t border-slate-800">
            {user ? (
              <div className="flex flex-col space-y-3">
                <div className="flex items-center space-x-3">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-lg">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold truncate w-36" title={user.email || ''}>{user.displayName || user.email}</p>
                    <p className="text-[10px] text-slate-400">{isAdmin ? 'Portal Admin' : (isYCP ? 'YCP Team' : 'Guest')}</p>
                  </div>
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => setShowUploadModal(true)}
                    className="flex flex-1 w-full items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Upload App</span>
                  </button>
                )}
                <button 
                  onClick={handleSignOut}
                  className="flex items-center justify-center space-x-2 text-slate-400 hover:text-white text-xs py-2 rounded-lg transition-colors border border-slate-700 w-full"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col space-y-3">
                <div className="text-xs text-slate-400 leading-tight">
                  Sign in with your @ycp.com email for team access.
                </div>
                <button 
                  onClick={handleMicrosoftSignIn}
                  className="bg-blue-600 text-white hover:bg-blue-700 text-sm font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors w-full"
                >
                  <User className="w-4 h-4" />
                  <span>Sign in with YCP</span>
                </button>
                <button 
                  onClick={handleGoogleSignIn}
                  className="bg-white text-slate-900 hover:bg-slate-200 text-sm font-bold py-2 px-4 border border-slate-200 rounded-lg flex items-center justify-center space-x-2 transition-colors w-full"
                >
                  <User className="w-4 h-4 text-slate-500" />
                  <span>Sign in with Google</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 sm:px-10 shrink-0">
          <div className="flex items-center space-x-4 overflow-hidden">
            <h1 className="text-xl font-bold tracking-tight md:hidden">INTERNAL APPS</h1>
            <span className="text-slate-600 font-medium truncate hidden md:inline">v2.4.0 Production Build</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right shrink-0 hidden md:block">
              <p className="text-xs text-slate-500 mb-1">Questions? Reach out directly:</p>
              <a href="mailto:amanda.aprilia@ycp.com" className="text-blue-600 font-semibold hover:underline text-xs">amanda.aprilia@ycp.com</a>
            </div>
            
            {/* Mobile Auth Button */}
            <div className="md:hidden">
              {user ? (
                <button 
                  onClick={handleSignOut}
                  className="bg-slate-100 p-2 rounded-full text-slate-600 border border-slate-200"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              ) : (
                <button 
                  onClick={handleSignIn}
                  className="bg-blue-600 p-2 rounded-full text-white"
                >
                  <User className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Content Grid */}
        <div className="p-6 md:p-10 flex-1 overflow-y-auto bg-slate-50">
          
          {/* Mobile Categories (Visible only on mobile since sidebar is hidden) */}
          <div className="md:hidden flex overflow-x-auto space-x-2 mb-6 pb-2">
            {(['All', 'Work', 'Personal'] as AppCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  activeCategory === cat 
                    ? 'bg-slate-900 text-white' 
                    : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Hero Download Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm flex flex-col lg:flex-row items-center justify-between mb-8 gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start space-x-0 sm:space-x-6 gap-4 sm:gap-0 w-full text-center sm:text-left">
              <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 shrink-0">
                <Smartphone className="w-10 h-10 text-slate-400" />
              </div>
              <div>
                <div className="flex flex-col sm:flex-row items-center space-x-0 sm:space-x-3 mb-1 gap-2 sm:gap-0 mt-2 sm:mt-0">
                  <h2 className="text-2xl font-bold">Welcome to the portal.</h2>
                  <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide">APP PORTAL</span>
                </div>
                <p className="text-slate-500 max-w-xl mt-2 text-sm sm:text-base">
                  I built this space so you can easily and securely download our latest internal Android applications. Everything listed here is vetted and ready for your device. Please download the applications individually below.
                </p>
              </div>
            </div>
          </div>

          {/* Other Versions List */}
          {loading ? (
             <div className="text-center py-20">
               <p className="text-slate-500">Checking authentication...</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredApps.map((app) => (
                <AppCard 
                  key={app.id} 
                  app={app} 
                  isAdmin={isAdmin}
                  isYCP={isYCP}
                  isUnlocked={isPersonalUnlocked}
                  onUnlock={handleUnlockPersonal}
                />
              ))}
            </div>
          )}
          
          {!loading && filteredApps.length === 0 && (
             <div className="text-center py-20 bg-white border border-slate-200 rounded-xl mt-6">
               <p className="text-slate-500">No applications found in this category.</p>
             </div>
          )}

          {/* Information Footer */}
          <div className="mt-12 bg-blue-50 border border-blue-100 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row items-start space-x-0 sm:space-x-4 gap-4 sm:gap-0">
              <div className="p-2 bg-blue-200 rounded-lg text-blue-700 shrink-0">
                <Info className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-blue-900">Developer Reassurance & Integrity Verification</h4>
                <p className="text-blue-800/70 text-sm mt-1">
                  This APK portal has been compiled and scanned for vulnerabilities by Amanda Aprilia personally. 
                  Every application listed is regularly checked against our internal anti-malware systems.
                </p>
                <div className="mt-3 text-sm text-blue-800/80 bg-blue-100/50 p-3 rounded-lg">
                  <strong>How to verify your download:</strong>
                  <ol className="list-decimal pl-5 mt-1 space-y-1">
                    <li>Download the APK file to your device.</li>
                    <li>Use a checksum tool to calculate the SHA-256 hash of the downloaded file.</li>
                    <li>Compare it against the <strong>SHA-256 Checksum (Verified)</strong> displayed on each app card above.</li>
                    <li>If the hashes match exactly, the file has not been tampered with and is safe to install.</li>
                  </ol>
                </div>
                <p className="text-blue-800/70 text-sm mt-3">
                  If your device displays a security warning or if the checksums do not match, please verify with me directly at my company email before proceeding with the sideload install.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {showUploadModal && <UploadAppModal onClose={() => setShowUploadModal(false)} />}
    </div>
  );
}
