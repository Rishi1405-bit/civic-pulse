/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import { User } from 'firebase/auth';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Issue, IssueStatus, VoteType } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { 
  TrendingUp, 
  Clock, 
  Plus, 
  AlertCircle, 
  ChevronUp, 
  ChevronDown,
  MapPin,
  Tag,
  Search,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  user: User;
}

export function Dashboard({ user }: DashboardProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filter, setFilter] = useState<'trending' | 'newest'>('trending');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const issuesRef = collection(db, 'issues');
    const q = filter === 'trending' 
      ? query(issuesRef, orderBy('voteCount', 'desc'))
      : query(issuesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const issuesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Issue[];
      setIssues(issuesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'issues');
    });

    return () => unsubscribe();
  }, [filter]);

  const filteredIssues = issues.filter(issue => 
    issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    issue.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    issue.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-stone-900">Community Board</h2>
          <p className="text-stone-500 mt-1">Report and upvote local issues to prioritize government response.</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsFormOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2.5 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center space-x-2 shadow-lg shadow-blue-200 ring-2 ring-indigo-500/20 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span className="font-bold tracking-wide">Report Issue</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-2 rounded-2xl border border-stone-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input 
            type="text"
            placeholder="Search issues, categories, locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 rounded-xl border-none focus:ring-2 focus:ring-stone-200 transition-all bg-stone-50/50"
          />
        </div>
        
        <div className="flex bg-stone-100 p-1 rounded-xl">
          <button 
            onClick={() => setFilter('trending')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              filter === 'trending' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Trending</span>
          </button>
          <button 
            onClick={() => setFilter('newest')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              filter === 'newest' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Newest</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredIssues.map((issue, index) => (
            <IssueCard 
              key={issue.id} 
              issue={issue} 
              user={user} 
              highlight={index < 3 && filter === 'trending' && issue.voteCount > 0} 
            />
          ))}
        </AnimatePresence>
        
        {filteredIssues.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-stone-300">
            <div className="max-w-xs mx-auto">
              <AlertCircle className="w-12 h-12 text-stone-300 mx-auto mb-4" />
              <p className="text-stone-500 font-medium">No issues found. Be the first to report something in your neighborhood!</p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <IssueForm user={user} onClose={() => setIsFormOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function IssueCard({ issue, user, highlight }: { key?: string, issue: Issue, user: User, highlight?: boolean }) {
  const [userVote, setUserVote] = useState<VoteType | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  useEffect(() => {
    const voteRef = doc(db, 'issues', issue.id, 'votes', user.uid);
    const unsubscribe = onSnapshot(voteRef, (doc) => {
      if (doc.exists()) {
        setUserVote(doc.data().type as VoteType);
      } else {
        setUserVote(null);
      }
    });
    return () => unsubscribe();
  }, [issue.id, user.uid]);

  const handleVote = async (type: VoteType) => {
    if (isVoting) return;
    setIsVoting(true);

    try {
      const batch = writeBatch(db);
      const issueRef = doc(db, 'issues', issue.id);
      const voteRef = doc(db, 'issues', issue.id, 'votes', user.uid);
      
      const voteDoc = await getDoc(voteRef);
      let voteChange = 0;

      if (voteDoc.exists()) {
        const existingType = voteDoc.data().type;
        if (existingType === type) {
          // Remove vote
          batch.delete(voteRef);
          voteChange = type === 'up' ? -1 : 1;
        } else {
          // Change vote type
          batch.update(voteRef, { type, timestamp: serverTimestamp() });
          voteChange = type === 'up' ? 2 : -2;
        }
      } else {
        // New vote
        batch.set(voteRef, { type, userId: user.uid, timestamp: serverTimestamp() });
        voteChange = type === 'up' ? 1 : -1;
      }

      batch.update(issueRef, { 
        voteCount: (issue.voteCount || 0) + voteChange,
        updatedAt: serverTimestamp()
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `issues/${issue.id}/votes/${user.uid}`);
    } finally {
      setIsVoting(false);
    }
  };

  const statusColors = {
    'reported': 'bg-amber-100 text-amber-700 border-amber-200',
    'in-progress': 'bg-blue-100 text-blue-700 border-blue-200',
    'resolved': 'bg-emerald-100 text-emerald-700 border-emerald-200'
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group relative flex bg-white rounded-3xl border transition-all duration-300 ${
        highlight 
          ? 'border-stone-900 ring-4 ring-stone-900/5 shadow-xl scale-[1.02] z-10' 
          : 'border-stone-200 hover:border-stone-300 shadow-sm hover:shadow-md'
      }`}
    >
      <div className="flex flex-col items-center justify-start p-4 bg-stone-50/50 rounded-l-3xl border-r border-stone-100">
        <button 
          onClick={() => handleVote('up')}
          className={`p-2 rounded-xl transition-all ${
            userVote === 'up' ? 'bg-stone-900 text-stone-50 shadow-md' : 'text-stone-400 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <ChevronUp className="w-6 h-6" />
        </button>
        <span className={`my-2 font-bold text-lg tabular-nums ${highlight ? 'text-stone-900' : 'text-stone-700'}`}>
          {issue.voteCount}
        </span>
        <button 
          onClick={() => handleVote('down')}
          className={`p-2 rounded-xl transition-all ${
            userVote === 'down' ? 'bg-stone-900 text-stone-50 shadow-md' : 'text-stone-400 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <ChevronDown className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 p-6 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center space-x-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColors[issue.status]}`}>
              {issue.status}
            </span>
            <span className="text-xs text-stone-400 font-medium flex items-center">
              <Tag className="w-3 h-3 mr-1" />
              {issue.category}
            </span>
          </div>
          {highlight && <div className="bg-stone-900 text-stone-50 text-[10px] font-black px-2 py-0.5 rounded italic">TOP ISSUE</div>}
        </div>

        <h3 className="text-xl font-bold text-stone-900 mb-2 leading-tight group-hover:text-stone-700 transition-colors">
          {issue.title}
        </h3>
        
        {issue.photoData && (
          <div className="w-full h-48 mb-4 overflow-hidden rounded-xl bg-stone-100 flex-shrink-0">
            <img src={issue.photoData} alt={issue.title} className="w-full h-full object-cover" />
          </div>
        )}

        {issue.locationAddress && (
          <div className="flex items-center text-xs text-stone-500 mb-3 font-medium bg-stone-100 w-fit px-2 py-1 rounded-md">
            <MapPin className="w-3.5 h-3.5 mr-1 text-stone-400" />
            {issue.locationAddress}
          </div>
        )}

        <p className="text-stone-600 text-sm mb-6 line-clamp-3 font-serif leading-relaxed">
          {issue.description}
        </p>

        <div className="mt-auto pt-4 border-t border-stone-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center overflow-hidden">
              <span className="text-[10px] font-bold text-stone-400">{issue.authorName[0]}</span>
            </div>
            <span className="text-xs text-stone-500 font-medium">{issue.authorName}</span>
          </div>
          <div className="flex items-center text-stone-400 text-xs">
            <Clock className="w-3.5 h-3.5 mr-1" />
            {issue.createdAt?.toDate().toLocaleDateString()}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function IssueForm({ user, onClose }: { user: User, onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Infrastructure');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const categories = ['Infrastructure', 'Safety', 'Sanitation', 'Utility', 'Traffic', 'Environment'];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        setPhotoData(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleGetLocation = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocationLat(latitude);
        setLocationLng(longitude);
        setLocationAddress(`Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`);
        setIsLocating(false);
      },
      (err) => {
        console.error(err);
        setIsLocating(false);
      }
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !title || !description) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'issues'), {
        title,
        description,
        category,
        status: 'reported' as IssueStatus,
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
        voteCount: 0,
        photoData: photoData || null,
        locationAddress: locationAddress || null,
        locationLat: locationLat || null,
        locationLng: locationLng || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'issues');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-stone-100 flex justify-between items-center bg-stone-50">
          <div>
            <h3 className="text-2xl font-bold text-stone-900">Report an Issue</h3>
            <p className="text-stone-500 text-sm mt-1">Provide details to help officials understand the problem.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-stone-200 rounded-full transition-colors"
          >
            <AlertCircle className="w-6 h-6 rotate-45 text-stone-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-stone-700 uppercase tracking-wider">Issue Title</label>
            <input 
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Deep pothole on Main St."
              className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 focus:border-stone-900 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700 uppercase tracking-wider">Category</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white outline-none focus:ring-2 focus:ring-stone-900"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-stone-700 uppercase tracking-wider">Description</label>
            <textarea 
              required
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail, including specific landmarks nearby..."
              className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 focus:border-stone-900 outline-none transition-all font-serif"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700 uppercase tracking-wider block">Photo (Optional)</label>
              <div className="relative border-2 border-dashed border-stone-300 rounded-xl p-4 hover:bg-stone-50 transition-colors flex flex-col items-center justify-center text-center overflow-hidden">
                <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                {photoData ? (
                  <div className="relative w-full h-24 rounded overflow-hidden">
                    <img src={photoData} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs font-bold">Change Photo</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <Camera className="w-6 h-6 text-stone-400 mb-2" />
                    <span className="text-xs font-medium text-stone-500">Tap to upload image</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700 uppercase tracking-wider block">Location (Optional)</label>
              <div className="flex flex-col space-y-2">
                <input 
                  type="text"
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  placeholder="Enter street or neighborhood..."
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none"
                />
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={isLocating}
                  className="text-xs font-bold bg-stone-100 text-stone-600 px-3 py-2 rounded-lg hover:bg-stone-200 transition-colors flex items-center justify-center w-full disabled:opacity-50"
                >
                  <MapPin className="w-3.5 h-3.5 mr-1.5" />
                  {isLocating ? 'Detecting Location...' : 'Use Current Location'}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 flex space-x-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-2xl border border-stone-200 font-bold text-stone-600 hover:bg-stone-50 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex-3 bg-stone-900 text-stone-50 px-8 py-4 rounded-2xl font-bold hover:bg-stone-800 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  <span>Submit Report</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
