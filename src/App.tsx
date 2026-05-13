/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut 
} from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { Dashboard } from './components/Dashboard';
import { LogIn, LogOut, HeartPulse } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDocFromServer } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Test connection as required by skill
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-pulse flex flex-col items-center">
          <HeartPulse className="w-12 h-12 text-stone-400 mb-4" />
          <p className="text-stone-500 font-medium font-sans">Connecting to CivicPulse...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      <nav className="border-b border-stone-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-stone-900 text-stone-50 p-1.5 rounded-lg">
              <HeartPulse className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-tight">CivicPulse</span>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium leading-none">{user.displayName}</p>
                  <p className="text-xs text-stone-500">{user.email}</p>
                </div>
                <img 
                  src={user.photoURL || ''} 
                  alt={user.displayName || ''} 
                  className="w-8 h-8 rounded-full border border-stone-200" 
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={handleLogout}
                  className="p-2 text-stone-500 hover:text-stone-900 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center space-x-2 bg-stone-900 text-stone-50 px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors font-medium shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {user ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Dashboard user={user} />
            </motion.div>
          ) : (
            <motion.div 
              key="welcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20 bg-white rounded-3xl border border-stone-200 shadow-sm"
            >
              <div className="max-w-2xl mx-auto px-6">
                <h1 className="text-5xl font-bold tracking-tight mb-6">
                  Empowering communities to shape their future.
                </h1>
                <p className="text-lg text-stone-600 mb-10 leading-relaxed font-serif italic">
                  Report issues, vote on priorities, and track resolutions. Your voice matters in every pothole fixed and every light restored.
                </p>
                <button 
                  onClick={handleLogin}
                  className="inline-flex items-center space-x-3 bg-stone-900 text-stone-50 px-8 py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all font-bold text-lg shadow-lg"
                >
                  <LogIn className="w-6 h-6" />
                  <span>Get Started today</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-stone-200 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center text-stone-500 text-sm">
          <p>© 2026 CivicPulse Social Platform. Built for the community.</p>
          <div className="mt-4 sm:mt-0 flex space-x-6">
            <a href="#" className="hover:text-stone-900">Privacy</a>
            <a href="#" className="hover:text-stone-900">Terms</a>
            <a href="#" className="hover:text-stone-900">Official Portal</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
