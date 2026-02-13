
import React, { useState, useCallback } from 'react';
import Cropper, { type Point, type Area } from 'react-easy-crop';
import { Button } from './index';
import { X, Check, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImageCropperProps {
    image: string;
    onCropComplete: (blob: Blob) => void;
    onCancel: () => void;
    aspectRatio?: number;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
    image,
    onCropComplete,
    onCancel,
    aspectRatio = 16 / 9
}) => {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    const onCropChange = (crop: Point) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom: number) => {
        setZoom(zoom);
    };

    const onCropCompleteInternal = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const createImage = (url: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
            const image = new Image();
            image.addEventListener('load', () => resolve(image));
            image.addEventListener('error', (error) => reject(error));
            image.setAttribute('crossOrigin', 'anonymous');
            image.src = url;
        });

    const getCroppedImg = async (
        imageSrc: string,
        pixelCrop: Area,
        rotation = 0
    ): Promise<Blob | null> => {
        const image = await createImage(imageSrc);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) return null;

        const rotRad = (rotation * Math.PI) / 180;
        const { width: bWidth, height: bHeight } = {
            width: Math.abs(Math.cos(rotRad) * image.width) + Math.abs(Math.sin(rotRad) * image.height),
            height: Math.abs(Math.sin(rotRad) * image.width) + Math.abs(Math.cos(rotRad) * image.height),
        };

        canvas.width = bWidth;
        canvas.height = bHeight;

        ctx.translate(bWidth / 2, bHeight / 2);
        ctx.rotate(rotRad);
        ctx.translate(-image.width / 2, -image.height / 2);

        ctx.drawImage(image, 0, 0);

        const data = ctx.getImageData(
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height
        );

        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        ctx.putImageData(data, 0, 0);

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/webp', 0.85); // Convert to WebP with 85% quality
        });
    };

    const handleConfirm = async () => {
        if (croppedAreaPixels) {
            const blob = await getCroppedImg(image, croppedAreaPixels, rotation);
            if (blob) {
                onCropComplete(blob);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/50 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-brand-500 rounded-full" />
                    <h2 className="text-white font-black uppercase tracking-widest text-sm">Ajustar Imagem</h2>
                </div>
                <button onClick={onCancel} className="p-2 text-white/50 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Cropper Area */}
            <div className="relative flex-1 bg-black/40">
                <Cropper
                    image={image}
                    crop={crop}
                    zoom={zoom}
                    rotation={rotation}
                    aspect={aspectRatio}
                    onCropChange={onCropChange}
                    onCropComplete={onCropCompleteInternal}
                    onZoomChange={onZoomChange}
                    showGrid={true}
                    style={{
                        containerStyle: { background: 'transparent' },
                        cropAreaStyle: { border: '2px solid white', boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)' }
                    }}
                />
            </div>

            {/* Controls */}
            <div className="p-6 pb-12 bg-black/80 backdrop-blur-xl border-t border-white/10 space-y-6">
                <div className="flex flex-col gap-4 max-w-md mx-auto">
                    {/* Zoom Sliders */}
                    <div className="flex items-center gap-4">
                        <ZoomOut className="w-5 h-5 text-white/40" />
                        <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            aria-labelledby="Zoom"
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="flex-1 accent-brand-500 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                        />
                        <ZoomIn className="w-5 h-5 text-white/40" />
                    </div>

                    {/* Rotation */}
                    <div className="flex items-center gap-4">
                        <RotateCcw className="w-5 h-5 text-white/40" />
                        <input
                            type="range"
                            value={rotation}
                            min={0}
                            max={360}
                            step={1}
                            aria-labelledby="Rotation"
                            onChange={(e) => setRotation(Number(e.target.value))}
                            className="flex-1 accent-white/30 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                        />
                        <span className="text-[10px] font-black text-white/30 w-8">{rotation}°</span>
                    </div>
                </div>

                <div className="flex justify-center gap-4 pt-2">
                    <Button
                        variant="ghost"
                        onClick={onCancel}
                        className="rounded-2xl border border-white/10 text-white px-8 font-black text-xs uppercase hover:bg-white/5"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        className="bg-brand-600 text-white rounded-2xl px-12 font-black text-xs uppercase shadow-xl shadow-brand-500/20"
                    >
                        <Check className="w-4 h-4 mr-2" /> Finalizar Corte
                    </Button>
                </div>
            </div>
        </div>
    );
};
