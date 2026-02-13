import { useState, useRef, type ChangeEvent } from 'react';
import { supabase } from '../../services/supabase';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from './Button';

interface ImageUploadProps {
    currentUrl?: string;
    onUpload: (url: string) => void;
    label: string;
    bucketName?: string;
    folderPath?: string;
    className?: string;
}

export const ImageUpload = ({
    currentUrl,
    onUpload,
    label,
    bucketName = 'school-assets',
    folderPath = 'logos',
    className = ''
}: ImageUploadProps) => {
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | undefined>(currentUrl);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation
        const MAX_SIZE = 2 * 1024 * 1024; // 2MB
        if (file.size > MAX_SIZE) {
            alert('Imagem muito grande. Máximo 2MB.');
            return;
        }

        if (!file.type.startsWith('image/')) {
            alert('Apenas imagens são permitidas.');
            return;
        }

        setUploading(true);
        try {
            // Create unique filename
            const fileExt = file.name.split('.').pop();
            const fileName = `${folderPath}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from(bucketName)
                .getPublicUrl(fileName);

            const publicUrl = data.publicUrl;

            setPreview(publicUrl);
            onUpload(publicUrl);

        } catch (error: any) {
            console.error('Error uploading image:', error);
            alert('Erro no upload: ' + error.message);
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleRemove = () => {
        setPreview(undefined);
        onUpload(''); // Clear URL
    };

    return (
        <div className={`space-y-2 ${className}`}>
            <label className="block text-sm font-medium text-gray-700">{label}</label>

            <div className={`
                relative flex flex-col items-center justify-center w-full h-40 
                border-2 border-dashed rounded-xl transition-colors
                ${preview ? 'border-gray-200 bg-gray-50' : 'border-gray-300 hover:border-brand-400 bg-white hover:bg-gray-50'}
            `}>

                {uploading ? (
                    <div className="flex flex-col items-center gap-2 text-brand-600">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="text-sm font-medium">Enviando...</span>
                    </div>
                ) : preview ? (
                    <div className="relative w-full h-full p-2 group flex flex-col items-center justify-center">
                        <img
                            src={preview}
                            alt="Logo Preview"
                            className="w-full h-24 object-contain mx-auto mb-2"
                        />
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                className="text-xs bg-white hover:bg-gray-50 h-8"
                            >
                                Substituir
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleRemove}
                                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-8 border-red-100"
                            >
                                Remover
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div
                        className="flex flex-col items-center gap-2 cursor-pointer w-full h-full justify-center"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="p-3 bg-brand-50 rounded-full text-brand-500">
                            <ImageIcon className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-gray-700">Clique para enviar</p>
                            <p className="text-xs text-gray-400">PNG, JPG (Max 2MB)</p>
                        </div>
                    </div>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                    disabled={uploading}
                />
            </div>
        </div>
    );
};
