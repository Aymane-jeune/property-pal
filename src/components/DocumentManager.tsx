import { useState, useCallback, useEffect } from 'react';
import { DocumentCategory, FileRecord, User } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Upload, FileUp, CheckCircle, X, Search, Eye, Download, Trash2,
  FileText, Image, FolderOpen, ClipboardCheck, HardDrive, Files, Handshake
} from 'lucide-react';
import { toast } from 'sonner';

const categoryIcons: Record<DocumentCategory, React.ElementType> = {
  'contract': FileText,
  'property-photo': Image,
  'client-file': FolderOpen,
  'condition-report': ClipboardCheck,
  'supplier-contract': Handshake,
};

const categoryColors: Record<DocumentCategory, string> = {
  'contract': 'bg-primary/15 text-primary border-primary/30',
  'property-photo': 'bg-success/15 text-success border-success/30',
  'client-file': 'bg-accent/15 text-accent border-accent/30',
  'condition-report': 'bg-warning/15 text-warning border-warning/30',
  'supplier-contract': 'bg-chrome/15 text-chrome border-chrome/30',
};

const badgeColors: Record<DocumentCategory, string> = {
  'contract': 'bg-primary/20 text-primary',
  'property-photo': 'bg-success/20 text-success',
  'client-file': 'bg-accent/20 text-accent',
  'condition-report': 'bg-warning/20 text-warning',
  'supplier-contract': 'bg-chrome/20 text-chrome',
};

interface Props {
  user: User;
  onLogout: () => void;
}

const GCS_FUNCTION_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/gcs-storage`;

const DocumentManager = ({ user, onLogout }: Props) => {
  const { t } = useI18n();
  const isAdmin = user.role === 'admin';

  // State
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [activeCategory, setActiveCategory] = useState<DocumentCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory | ''>('');
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const categories: DocumentCategory[] = ['contract', 'property-photo', 'client-file', 'condition-report', 'supplier-contract'];

  // Fetch files from GCS
  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${GCS_FUNCTION_URL}?action=list`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const items: FileRecord[] = (data.items || []).map((item: any, i: number) => {
        const parts = item.name.split('/');
        const category = categories.includes(parts[0] as DocumentCategory) ? parts[0] as DocumentCategory : 'contract';
        const fileName = parts.slice(1).join('/') || item.name;
        return {
          id: `gcs_${i}_${item.name}`,
          fileName,
          category,
          cloudPath: item.name,
          uploadedBy: '-',
          fileSize: `${(Number(item.size) / 1024 / 1024).toFixed(1)} MB`,
          createdAt: item.updated ? new Date(item.updated).toISOString().split('T')[0] : '-',
        };
      });
      setFiles(items);
    } catch (err) {
      console.error('Failed to list files:', err);
      toast.error('Failed to load files from storage');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const filteredFiles = files.filter(f => {
    const matchCategory = activeCategory === 'all' || f.category === activeCategory;
    const matchSearch = f.fileName.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  const getCategoryCount = (cat: DocumentCategory) => files.filter(f => f.category === cat).length;

  // Upload handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setSelectedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
  };

  const removeFile = (index: number) => setSelectedFiles(prev => prev.filter((_, i) => i !== index));

  const handleUpload = async () => {
    if (!selectedFiles.length || !uploadCategory) {
      toast.error(t('upload.error'));
      return;
    }
    setUploading(true);
    setProgress(0);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const path = `${uploadCategory}/${file.name}`;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', path);

        const res = await fetch(`${GCS_FUNCTION_URL}?action=upload`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
      }

      toast.success(`${selectedFiles.length} ${t('upload.success')}`);
      setSelectedFiles([]);
      setUploadCategory('');
      await fetchFiles();
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDelete = async (file: FileRecord) => {
    try {
      const res = await fetch(`${GCS_FUNCTION_URL}?action=delete&path=${encodeURIComponent(file.cloudPath)}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFiles(prev => prev.filter(f => f.id !== file.id));
      toast.success(t('files.deleted'));
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Delete failed');
    }
  };

  const handleDownload = async (file: FileRecord) => {
    try {
      const res = await fetch(`${GCS_FUNCTION_URL}?action=download&path=${encodeURIComponent(file.cloudPath)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.open(data.url, '_blank');
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Download failed');
    }
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Category Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {categories.map(cat => {
            const Icon = categoryIcons[cat];
            const count = getCategoryCount(cat);
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(isActive ? 'all' : cat)}
                className={`stat-card text-left transition-all ${isActive ? 'glow-border' : ''}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 border ${categoryColors[cat]}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm font-medium mt-1">{t(`cat.${cat}` as any)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t(`cat.${cat}.desc` as any)}</p>
              </button>
            );
          })}
        </div>

        {/* Upload Section */}
        <div className="glass-card p-6 space-y-5">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            {t('upload.title')}
          </h2>

          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={uploadCategory} onValueChange={(v) => setUploadCategory(v as DocumentCategory)}>
              <SelectTrigger className="bg-secondary border-border sm:w-64">
                <SelectValue placeholder={t('upload.selectCategory')} />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{t(`cat.${cat}` as any)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div
              onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
              className={`flex-1 border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <input id="file-input" type="file" multiple className="hidden" onChange={handleFileInput} />
              <Upload className={`w-8 h-8 mx-auto mb-2 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="text-sm font-medium">{t('upload.dragDrop')}</p>
              <p className="text-xs text-muted-foreground">{t('upload.browse')} • {t('upload.maxSize')}</p>
            </div>
          </div>

          {/* Selected files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              {selectedFiles.map((file, i) => (
                <div key={i} className="flex items-center justify-between bg-secondary/50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <FileUp className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">{progress}% — {t('upload.uploading')}</p>
            </div>
          )}

          {selectedFiles.length > 0 && (
            <Button onClick={handleUpload} disabled={uploading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <CheckCircle className="w-4 h-4 mr-2" />
              {uploading ? t('upload.uploading') : `${t('upload.upload')} (${selectedFiles.length})`}
            </Button>
          )}
        </div>

        {/* File Browser */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Files className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">
                {activeCategory === 'all' ? t('cat.all') : t(`cat.${activeCategory}` as any)}
              </h2>
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                {filteredFiles.length} {t('files.total')}
              </span>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('app.search')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 bg-secondary border-border h-9 text-sm"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('files.fileName')}</th>
                  <th>{t('files.category')}</th>
                  <th>{t('files.size')}</th>
                  <th>{t('files.uploadedBy')}</th>
                  <th>{t('files.date')}</th>
                  <th>{t('files.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map(file => (
                  <tr key={file.id}>
                    <td className="font-medium">{file.fileName}</td>
                    <td>
                      <span className={`text-xs px-2 py-1 rounded-full ${badgeColors[file.category]}`}>
                        {t(`cat.${file.category}` as any)}
                      </span>
                    </td>
                    <td className="text-muted-foreground">{file.fileSize}</td>
                    <td className="text-muted-foreground">{file.uploadedBy}</td>
                    <td className="text-muted-foreground">{file.createdAt}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => toast.info(t('files.preview'))}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleDownload(file)}>
                          <Download className="w-4 h-4" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(file)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredFiles.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">{t('files.noFiles')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentManager;
