
import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from './Button';
import { Modal } from './Modal';
import { getCroppedImg } from '../../utils/image';
import { Loader2 } from 'lucide-react';

interface ImageCropperModalProps {
    isOpen: boolean;
    imageSrc: string | null;
    onClose: () => void;
    onCropComplete: (file: File) => void;
    aspect?: number;
}

export const ImageCropperModal = ({
    isOpen,
    imageSrc,
    onClose,
    onCropComplete,
    aspect = 3 / 4 // Default 3x4 (standard photo format)
}: ImageCropperModalProps) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const onCropChange = (crop: { x: number; y: number }) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom: number) => {
        setZoom(zoom);
    };

    const onCropCompleteHandler = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = async () => {
        if (!imageSrc || !croppedAreaPixels) return;

        setIsProcessing(true);
        try {
            const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
            onCropComplete(croppedImage);
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!imageSrc) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Ajustar Foto" size="md">
            <div className="relative w-full h-80 bg-black rounded-lg overflow-hidden mb-6">
                <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={aspect}
                    onCropChange={onCropChange}
                    onCropComplete={onCropCompleteHandler}
                    onZoomChange={onZoomChange}
                    objectFit="contain"
                />
            </div>

            <div className="flex flex-col gap-2 mb-6">
                <label className="text-sm font-medium text-slate-700">Zoom</label>
                <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
                />
            </div>

            <div className="flex justify-end gap-3 sticky bottom-0 bg-white pt-4 border-t">
                <Button variant="outline" onClick={onClose} disabled={isProcessing}>
                    Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                    Confirmar Recorte
                </Button>
            </div>
        </Modal>
    );
};
