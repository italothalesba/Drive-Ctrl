import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { FileItemData } from '../App';
import { 
  Folder, File, FileText, Image as ImageIcon, 
  Video, Music, MoreVertical, Download, 
  Trash2, Edit3, ChevronRight, Upload, 
  Plus, Search, Grid, List as ListIcon,
  X, Play, ExternalLink, CheckCircle2, 
  AlertCircle, Loader2, Minimize2, Maximize2,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FileExplorerProps {
  currentPath: string;
  setCurrentPath: (path: string) => void;
  view: 'home' | 'recent' | 'starred' | 'trash';
}

export default function FileExplorer({ currentPath, setCurrentPath, view }: FileExplorerProps) {
  const [items, setItems] = useState<FileItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadQueue, setUploadQueue] = useState<{ id: string; name: string; progress: number; status: 'uploading' | 'completed' | 'error'; }[]>([]);
  const [showUploadQueue, setShowUploadQueue] = useState(false);
  const [isQueueMinimized, setIsQueueMinimized] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ name: string; path: string; type: string; extension: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [heicLoading, setHeicLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileUrl = (path: string) => {
    return `/api/preview?path=${encodeURIComponent(path)}&token=${localStorage.getItem('drive_token')}`;
  };

  const handleItemClick = async (item: any) => {
    if (item.isDirectory) {
      handleFolderClick(item.name);
      return;
    }

    const path = item.path || (currentPath ? `${currentPath}/${item.name}` : item.name);
    const ext = item.extension.toLowerCase();
    
    setSelectedMedia({ 
      name: item.name, 
      path, 
      type: 'file',
      extension: ext
    });

    const url = getFileUrl(path);
    console.log('Opening preview for:', path, url);

    if (['heic', 'heif'].includes(ext)) {
      setHeicLoading(true);
      try {
        const heic2any = (await import('heic2any')).default;
        const res = await fetch(url);
        const blob = await res.blob();
        const convertedBlob = await heic2any({ blob, toType: 'image/jpeg' });
        const convertedUrl = URL.createObjectURL(Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob);
        setPreviewUrl(convertedUrl);
      } catch (err) {
        console.error('HEIC conversion failed', err);
        setPreviewUrl(url);
      } finally {
        setHeicLoading(false);
      }
    } else if (['txt', 'md', 'log', 'js', 'ts', 'tsx', 'html', 'css', 'json'].includes(ext)) {
      try {
        const res = await fetch(url);
        const text = await res.text();
        setTextContent(text);
        setPreviewUrl(url);
      } catch (err) {
        console.error('Text fetch failed', err);
        setPreviewUrl(url);
      }
    } else {
      setPreviewUrl(url);
    }
  };

  const closePreview = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedMedia(null);
    setPreviewUrl(null);
    setTextContent(null);
  };

  const fetchFiles = async () => {
    setLoading(true);
    try {
      if (view === 'recent') {
        const response = await api.get('/api/recent-files');
        setItems(response.data);
      } else {
        const response = await api.get(`/api/files?path=${encodeURIComponent(currentPath)}`);
        setItems(response.data.items);
      }
    } catch (error) {
      console.error('Failed to fetch files', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [currentPath, view]);

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
    
    const files = Array.from(e.target.files);
    setShowUploadQueue(true);
    setIsQueueMinimized(false);
    
    // Process files one by one for better progress tracking
    for (const file of files) {
      const uploadId = Math.random().toString(36).substring(7);
      
      setUploadQueue(prev => [...prev, { 
        id: uploadId, 
        name: file.name, 
        progress: 0, 
        status: 'uploading' 
      }]);

      const formData = new FormData();
      formData.append('files', file);

      try {
        await api.post(`/api/upload?folderPath=${encodeURIComponent(currentPath)}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const progress = progressEvent.total 
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            
            setUploadQueue(prev => prev.map(item => 
              item.id === uploadId ? { ...item, progress } : item
            ));
          }
        });
        
        setUploadQueue(prev => prev.map(item => 
          item.id === uploadId ? { ...item, status: 'completed', progress: 100 } : item
        ));
      } catch (error) {
        console.error('Upload failed', error);
        setUploadQueue(prev => prev.map(item => 
          item.id === uploadId ? { ...item, status: 'error' } : item
        ));
      }
    }
    
    fetchFiles();
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  const handleDownload = (name: string, itemPath?: string) => {
    const path = itemPath || (currentPath ? `${currentPath}/${name}` : name);
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
    
    const ext = item.extension.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'heif', 'cr2', 'nef', 'arw'].includes(ext)) return <ImageIcon className="w-8 h-8 text-emerald-500" />;
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return <Video className="w-8 h-8 text-purple-500" />;
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return <Music className="w-8 h-8 text-rose-500" />;
    if (['pdf'].includes(ext)) return <FileText className="w-8 h-8 text-red-500" />;
    if (['doc', 'docx', 'txt', 'md', 'log'].includes(ext)) return <FileText className="w-8 h-8 text-blue-400" />;
    if (['dcm', 'dicom'].includes(ext)) return <FileText className="w-8 h-8 text-cyan-500" />;
    return <File className="w-8 h-8 text-slate-400" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '--';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredItems = items
    .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (view === 'recent') {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
      return a.isDirectory ? -1 : 1;
    });

  if (view === 'starred' || view === 'trash') {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-center h-full">
        <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6">
          <Star className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Em Breve</h3>
        <p className="text-slate-500 text-sm max-w-xs mt-2">
          As funções de Favoritos e Lixeira estão sendo preparadas para integração total com seu HD.
        </p>
      </div>
    );
  }

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
            disabled={uploadQueue.some(u => u.status === 'uploading')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {uploadQueue.some(u => u.status === 'uploading') ? 'Enviando...' : 'Upload'}
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
              onClick={() => handleItemClick(item)}
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
                  onClick={(e) => { e.stopPropagation(); handleDownload(item.name, item.path); }}
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
                  onClick={() => handleItemClick(item)}
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
                        onClick={(e) => { e.stopPropagation(); handleDownload(item.name, item.path); }}
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

      {/* Media Viewer Modal */}
      <AnimatePresence>
        {selectedMedia && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-5xl bg-black rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-20 bg-gradient-to-b from-black/60 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm leading-tight">{selectedMedia.name}</h3>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest mt-0.5">{selectedMedia.extension}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleDownload(selectedMedia.name, selectedMedia.path)}
                    className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors backdrop-blur-md flex items-center gap-2 text-xs font-medium px-4"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button 
                    onClick={closePreview}
                    className="p-2 bg-white/10 hover:bg-red-500/80 text-white rounded-xl transition-colors backdrop-blur-md"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto flex items-center justify-center bg-[#0a0a0a]">
                {heicLoading ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-white/10 border-t-white rounded-full animate-spin" />
                    <p className="text-white/60 text-sm font-medium">Convertendo HEIC...</p>
                  </div>
                ) : !previewUrl ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-white/10 border-t-white rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Image Preview */}
                    {['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'svg'].includes(selectedMedia.extension) && (
                      <div className="relative flex items-center justify-center w-full h-full">
                        <img 
                          src={previewUrl} 
                          alt={selectedMedia.name} 
                          className="max-w-full max-h-full object-contain"
                          crossOrigin="anonymous"
                          onLoad={() => console.log('Image loaded successfully')}
                          onError={(e) => {
                            console.error('Image load failed', e);
                            // Fallback to error message
                          }}
                        />
                      </div>
                    )}

                    {/* Video Preview */}
                    {['mp4', 'webm', 'ogg', 'mov'].includes(selectedMedia.extension) && (
                      <video 
                        src={previewUrl} 
                        controls 
                        autoPlay
                        className="max-w-full max-h-full"
                      />
                    )}

                    {/* Audio Preview */}
                    {['mp3', 'wav', 'ogg', 'm4a'].includes(selectedMedia.extension) && (
                      <div className="flex flex-col items-center gap-8 p-12">
                        <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center animate-pulse">
                          <Music className="w-16 h-16 text-white/20" />
                        </div>
                        <audio 
                          src={previewUrl} 
                          controls 
                          autoPlay
                          className="w-80 h-12"
                        />
                      </div>
                    )}

                    {/* PDF Preview */}
                    {selectedMedia.extension === 'pdf' && (
                      <iframe 
                        src={`${previewUrl}#toolbar=0`}
                        className="w-full h-full border-0 bg-white"
                        title={selectedMedia.name}
                      />
                    )}

                    {/* Text Preview */}
                    {['txt', 'md', 'log', 'js', 'ts', 'tsx', 'html', 'css', 'json'].includes(selectedMedia.extension) && (
                      <div className="w-full h-full p-8 md:p-12 overflow-auto bg-[#0a0a0a]">
                        <pre className="text-slate-300 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {textContent || 'Carregando conteúdo...'}
                        </pre>
                      </div>
                    )}

                    {/* Unsupported Preview */}
                    {!['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'svg', 'mp4', 'webm', 'ogg', 'mov', 'mp3', 'wav', 'm4a', 'pdf', 'txt', 'md', 'log', 'js', 'ts', 'tsx', 'html', 'css', 'json'].includes(selectedMedia.extension) && (
                      <div className="text-center p-12">
                        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6 mx-auto">
                          <File className="w-10 h-10 text-white/20" />
                        </div>
                        <h4 className="text-white font-bold text-lg">Visualização não disponível</h4>
                        <p className="text-white/40 mt-2 text-sm max-w-xs mx-auto">Este formato de arquivo não pode ser visualizado no navegador.</p>
                        <button 
                          onClick={() => handleDownload(selectedMedia.name)}
                          className="mt-8 px-6 py-3 bg-white text-black rounded-2xl font-bold hover:bg-blue-50 transition-colors"
                        >
                          Baixar Arquivo
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Upload Progress Queue Panel */}
      <AnimatePresence>
        {showUploadQueue && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className={`fixed bottom-6 right-6 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-[60] transition-all duration-300 ${isQueueMinimized ? 'h-14' : 'max-h-[400px]'}`}
          >
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                {uploadQueue.some(u => u.status === 'uploading') ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                <span className="text-xs font-bold uppercase tracking-wider">
                  {uploadQueue.some(u => u.status === 'uploading') 
                    ? `Enviando ${uploadQueue.filter(u => u.status === 'uploading').length} arquivos`
                    : 'Uploads concluídos'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsQueueMinimized(!isQueueMinimized)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {isQueueMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => {
                    if (uploadQueue.some(u => u.status === 'uploading')) {
                      if (confirm('Cancelar todos os uploads em andamento?')) {
                        setShowUploadQueue(false);
                        setUploadQueue([]);
                      }
                    } else {
                      setShowUploadQueue(false);
                      setUploadQueue([]);
                    }
                  }}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            {!isQueueMinimized && (
              <div className="overflow-y-auto max-h-[344px] p-2 bg-white">
                {uploadQueue.map((item) => (
                  <div key={item.id} className="p-3 border-b border-slate-50 last:border-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 overflow-hidden">
                        {item.status === 'uploading' && <Loader2 className="w-3 h-3 animate-spin text-blue-500 shrink-0" />}
                        {item.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                        {item.status === 'error' && <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />}
                        <span className="text-xs font-medium text-slate-700 truncate">{item.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {item.status === 'uploading' ? `${item.progress}%` : item.status}
                      </span>
                    </div>
                    {item.status === 'uploading' && (
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-blue-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
