import React, { useRef, useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadImage } from '@/services/uploadService';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  aspectClass?: string; // e.g. 'aspect-video' | 'aspect-square'
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  label = 'Click to upload',
  hint = 'JPG, PNG, WebP — max 5 MB',
  aspectClass = 'aspect-video',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
      toast.success('Image uploaded');
    } catch (e: any) {
      toast.error(e?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl overflow-hidden transition-colors group ${
        uploading ? 'border-indigo-300' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'
      } ${aspectClass} cursor-pointer`}
      onClick={() => !uploading && inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleChange}
      />

      {uploading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80">
          <Loader2 size={24} className="animate-spin text-indigo-500 mb-2" />
          <p className="text-xs text-slate-500">Uploading…</p>
        </div>
      ) : value ? (
        <>
          <img src={value} alt="Uploaded" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <p className="text-white text-xs font-medium">Click to replace</p>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
          >
            <X size={12} />
          </button>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
          <Upload size={20} className="text-slate-400 mb-2" />
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</p>
          <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
