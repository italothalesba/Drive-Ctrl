import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { FileItemData } from '../App';
import { 
  Folder, File, FileText, Image as ImageIcon, 
  Video, Music, MoreVertical, Download, 
  Trash2, Edit3, ChevronRight, Upload, 
  Plus, Search, Grid, List as ListIcon,
  X, Play, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FileExplorerProps {
  currentPath: string;
  setCurrentPath: (path: string) => void;
}

export default function FileExplorer({ currentPath, setCurrentPath }: FileExplorerProps) {
  const [items, setItems] = useState<FileItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ name: string; path: string; type: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/files?path=${encodeURIComponent(currentPath)}`);
      setItems(response.data.items);
    } catch (error) {
      console.error('Failed to fetch files', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [currentPath]);

  const handleFolderClick = (folderName: string) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    setCurrentPath(newPath);
  };

  const handleBack = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) {
      formData.append('files', e.target.files[i]);
    }

    setUploading(true);
    try {
      await api.post(`/api/upload?folderPath=${encodeURIComponent(currentPath)}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchFiles();
    } catch (error) {
      console.error('Upload failed', error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Deseja realmente excluir "${name}"?`)) return;
    try {
      const targetPath = currentPath ? `${currentPath}/${name}` : name;
      await api.delete('/api/delete', { data: { targetPath } });
      fetchFiles();
    } catch (error) {
      console.error('Delete failed', error);
    }
  };

  const handleRename = async (oldName: string) => {
    const newName = prompt('Novo nome:', oldName);
    if (!newName || newName === oldName) return;
    
    try {
      const oldPath = currentPath ? `${currentPath}/${oldName}` : oldName;
      await api.put('/api/rename', { oldPath, newName });
      fetchFiles();
    } catch (error) {
      console.error('Rename failed', error);
    }
  };

  const handleDownload = (name: string) => {
    const path = currentPath ? `${currentPath}/${name}` : name;
    window.open(`/api/download?path=${encodeURIComponent(path)}&token=${localStorage.getItem('drive_token')}`, '_blank');
  };

  const handleCreateFolder = async () => {
    const folderName = prompt('Nome da pasta:');
    if (!folderName) return;
    
    try {
      await api.post('/api/mkdir', { currentPath, folderName });
      fetchFiles();
    } catch (error) {
      console.error('Mkdir failed', error);
    }
  };

  const getFileIcon = (item: FileItemData) => {
    if (item.isDirectory) return <Folder className="w-8 h-8 text-blue-500 fill-blue-500/10" />;
    
    const ext = item.extension;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return <ImageIcon className="w-8 h-8 text-emerald-500" />;
    if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return <Video className="w-8 h-8 text-purple-500" />;
    if (['mp3', 'wav', 'ogg'].includes(ext)) return <Music className="w-8 h-8 text-rose-500" />;
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return <FileText className="w-8 h-8 text-blue-400" />;
    return <File className="w-8 h-8 text-slate-400" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '--';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 overflow-hidden">
          <button 
            onClick={() => setCurrentPath('')}
            className="hover:text-blue-600 transition-colors shrink-0"
          >
            Meu Drive
          </button>
          {currentPath.split('/').filter(Boolean).map((part, index, arr) => (
            <React.Fragment key={index}>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              <button 
                onClick={() => setCurrentPath(arr.slice(0, index + 1).join('/'))}
                className={`truncate ${index === arr.length - 1 ? 'text-slate-900 font-semibold' : 'hover:text-blue-600 transition-colors'}`}
              >
                {part}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text"
              placeholder="Pesquisar arquivos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all w-full md:w-64"
            />
          </div>
          
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block" />

          <button 
            onClick={handleCreateFolder}
            className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors hidden sm:flex"
            title="Nova Pasta"
          >
            <Plus className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Enviando...' : 'Upload'}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleUpload} 
            multiple 
            className="hidden" 
          />
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500">Sincronizando arquivos...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
          <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center mb-6">
            <Folder className="w-12 h-12 text-slate-200" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Esta pasta está vazia</h3>
          <p className="text-slate-500 mt-2 max-w-xs text-sm">Arraste arquivos para cá ou use o botão de upload para começar a organizar seus documentos.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredItems.map((item) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              key={item.name}
              className="group relative bg-white border border-slate-200 rounded-2xl p-4 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/5 transition-all cursor-pointer"
              onClick={() => item.isDirectory ? handleFolderClick(item.name) : null}
            >
              <div className="aspect-square flex items-center justify-center mb-3">
                {getFileIcon(item)}
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-900 truncate" title={item.name}>
                  {item.name}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-medium uppercase tracking-wider">
                  {item.isDirectory ? 'Pasta' : formatSize(item.size)}
                </p>
              </div>

              {/* Hover Actions */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDownload(item.name); }}
                  className="p-1.5 bg-white shadow-sm border border-slate-100 rounded-lg text-slate-400 hover:text-blue-600 hover:border-blue-100 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(item.name); }}
                  className="p-1.5 bg-white shadow-sm border border-slate-100 rounded-lg text-slate-400 hover:text-red-600 hover:border-red-100 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Nome</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest hidden md:table-cell">Última Modificação</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Tamanho</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr 
                  key={item.name}
                  onClick={() => item.isDirectory ? handleFolderClick(item.name) : null}
                  className="group hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 last:border-0"
                >
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 scale-75 origin-center">
                        {getFileIcon(item)}
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 hidden md:table-cell">
                    <span className="text-xs text-slate-500 font-medium">
                      {new Date(item.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="text-xs text-slate-500 font-mono tabular-nums">
                      {item.isDirectory ? '--' : formatSize(item.size)}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDownload(item.name); }}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRename(item.name); }}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.name); }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Media Viewer Modal (Placeholder for future expansion) */}
      <AnimatePresence>
        {selectedMedia && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-sm">
            <div className="relative w-full max-w-4xl bg-black rounded-3xl overflow-hidden shadow-2xl">
              <div className="absolute top-4 right-4 z-10 flex gap-2">
                <button 
                  onClick={() => setSelectedMedia(null)}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-12 flex items-center justify-center min-h-[400px]">
                <p className="text-white">Player de Mídia em Desenvolvimento...</p>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
