import React from 'react';
import { Home, Clock, Star, Trash2, Cloud, HardDrive, Plus, Upload } from 'lucide-react';

interface SidebarProps {
  currentView: 'home' | 'recent' | 'starred' | 'trash';
  onViewChange: (view: 'home' | 'recent' | 'starred' | 'trash') => void;
  storageInfo: {
    total: number;
    used: number;
    label: string;
  } | null;
}

export default function Sidebar({ currentView, onViewChange, storageInfo }: SidebarProps) {
  const menuItems = [
    { id: 'home', label: 'Meu Drive', icon: Home },
    { id: 'recent', label: 'Recentes', icon: Clock },
    { id: 'starred', label: 'Favoritos', icon: Star },
    { id: 'trash', label: 'Lixeira', icon: Trash2 },
  ];

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(1) + ' GB';
  };

  const usagePercent = storageInfo ? (storageInfo.used / storageInfo.total) * 100 : 0;

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0 hidden lg:flex">
      <div className="p-6">
        <button className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-semibold text-sm hover:shadow-md hover:border-slate-300 transition-all group">
          <Plus className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
          Novo Item
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id as any)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-700' : 'text-slate-400'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-6 border-t border-slate-100">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Cloud className="w-3.5 h-3.5" />
            Armazenamento (Unidade {storageInfo?.label || '...'})
          </div>
          <div className="space-y-2">
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 rounded-full transition-all duration-500" 
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-medium">
              <span className="text-slate-900">
                {formatSize(storageInfo?.used || 0)} de {formatSize(storageInfo?.total || 0)}
              </span>
              <span className="text-slate-400">{usagePercent.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 m-3 rounded-xl bg-slate-50 border border-slate-100">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white rounded-lg border border-slate-200">
            <HardDrive className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-900 leading-tight">Servidor Local</p>
            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">Online • HD F:</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
