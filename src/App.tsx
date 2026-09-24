import React, { useState, useEffect } from 'react';
import api from './api';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import FileExplorer from './components/FileExplorer';
import { Folder, HardDrive, ShieldCheck, Clock, Star, Trash2 } from 'lucide-react';

export interface FileItemData {
  name: string;
  isDirectory: boolean;
  size: number;
  updatedAt: string;
  extension: string;
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('drive_token'));
  const [currentPath, setCurrentPath] = useState<string>('');
  const [view, setView] = useState<'home' | 'recent' | 'starred' | 'trash'>('home');
  const [storageInfo, setStorageInfo] = useState<{ total: number; used: number; label: string } | null>(null);

  useEffect(() => {
    if (token) {
      const fetchStorage = async () => {
        try {
          const res = await api.get('/api/storage-info');
          setStorageInfo(res.data);
        } catch (err) {
          console.error('Failed to fetch storage info', err);
        }
      };
      fetchStorage();
      // Refresh every 30 seconds
      const interval = setInterval(fetchStorage, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      <Sidebar currentView={view} onViewChange={setView} storageInfo={storageInfo} />
      
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-semibold tracking-tight">Drive Ctrl</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-slate-900">Drive Ctrl</p>
              <p className="text-[10px] text-slate-500">Gestão Inteligente de Arquivos</p>
            </div>
            <button 
              onClick={() => {
                localStorage.removeItem('drive_token');
                setToken(null);
              }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Sair
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <FileExplorer 
            currentPath={currentPath} 
            setCurrentPath={setCurrentPath} 
            view={view}
          />
        </div>

        <footer className="h-12 border-t border-slate-100 bg-white flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>© 2026 Drive Ctrl</span>
            <span>·</span>
            <span>Sua Nuvem Particular</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
