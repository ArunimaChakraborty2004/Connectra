import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { UploadCloud, File, FileText, Image as ImageIcon, Archive, Download, Trash2 } from 'lucide-react';
import { toast } from '../../lib/toast';

export default function ProjectFiles({ projectId, userRole, session }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const hasAccess = userRole === 'owner' || userRole === 'admin' || userRole === 'developer';

  useEffect(() => {
    fetchFiles();
  }, [projectId]);

  const fetchFiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('project_files')
      .select('*, uploader:profiles(username, avatar_url)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setFiles(data);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e) => {
    if (!hasAccess) return;
    const file = e.target.files[0];
    if (!file) return;

    // Check file type (PDF, Images, ZIP, PPT)
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/zip', 'application/x-zip-compressed', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Only PDFs, Images, ZIPs, and PPTs are allowed.');
      return;
    }

    // Check size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File exceeds 10MB limit.');
      return;
    }

    setUploading(true);
    
    // In a real scenario, this uploads to Supabase Storage bucket
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${projectId}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('project_files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('project_files')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('project_files')
        .insert([{
          project_id: projectId,
          uploader_id: session.user.id,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          file_size: file.size
        }]);

      if (dbError) throw dbError;

      toast.success('File uploaded successfully!');
      fetchFiles();
    } catch (err) {
      console.error(err);
      toast.error('Error uploading file. Make sure bucket exists.');
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (id, fileUrl) => {
    if (!confirm('Delete this file?')) return;
    
    // Extract path from public URL
    try {
      const pathParts = fileUrl.split('/project_files/');
      if (pathParts.length > 1) {
        const filePath = pathParts[1];
        await supabase.storage.from('project_files').remove([filePath]);
      }
      
      const { error } = await supabase.from('project_files').delete().eq('id', id);
      if (error) throw error;
      
      toast.success('File deleted');
      fetchFiles();
    } catch (err) {
      toast.error('Failed to delete file');
    }
  };

  const getFileIcon = (type) => {
    if (type.includes('image')) return <ImageIcon size={24} className="text-blue-400" />;
    if (type.includes('pdf')) return <FileText size={24} className="text-red-400" />;
    if (type.includes('zip') || type.includes('archive')) return <Archive size={24} className="text-yellow-400" />;
    if (type.includes('presentation') || type.includes('powerpoint')) return <File size={24} className="text-orange-400" />;
    return <File size={24} className="text-muted" />;
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) return <div className="animate-pulse h-64 bg-surface rounded-xl"></div>;

  return (
    <div className="space-y-6">
      {hasAccess && (
        <div className="glass-panel p-8 rounded-2xl border-dashed border-2 border-primary/30 text-center relative hover:border-primary/60 transition-colors">
          <input 
            type="file" 
            onChange={handleFileUpload} 
            disabled={uploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <UploadCloud size={48} className="mx-auto text-primary mb-4" />
          <h3 className="text-lg font-bold text-main mb-2">
            {uploading ? 'Uploading...' : 'Click or Drag & Drop to Upload'}
          </h3>
          <p className="text-sm text-muted">Supports PDFs, Images, ZIPs, and PPTs (Max 10MB)</p>
        </div>
      )}

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-lg font-bold">Project Files</h3>
          <span className="text-sm font-mono text-muted">{files.length} Files</span>
        </div>
        
        <div className="divide-y divide-white/5">
          {files.map(file => (
            <div key={file.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-surface rounded-xl border border-border">
                  {getFileIcon(file.file_type)}
                </div>
                <div>
                  <a href={file.file_url} target="_blank" rel="noreferrer" className="font-semibold text-main hover:text-primary transition-colors hover:underline line-clamp-1">
                    {file.file_name}
                  </a>
                  <div className="flex items-center gap-3 text-xs text-muted mt-1">
                    <span>{formatSize(file.file_size)}</span>
                    <span>•</span>
                    <span>{new Date(file.created_at).toLocaleDateString()}</span>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <div className="h-4 w-4 rounded-full bg-surface overflow-hidden">
                        {file.uploader?.avatar_url ? <img src={file.uploader.avatar_url} alt="" /> : file.uploader?.username[0].toUpperCase()}
                      </div>
                      {file.uploader?.username}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <a 
                  href={file.file_url} 
                  download 
                  target="_blank" 
                  rel="noreferrer"
                  className="p-2 text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                >
                  <Download size={18} />
                </a>
                {hasAccess && (
                  <button 
                    onClick={() => deleteFile(file.id, file.file_url)}
                    className="p-2 text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {files.length === 0 && (
            <div className="p-8 text-center text-muted">No files uploaded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
