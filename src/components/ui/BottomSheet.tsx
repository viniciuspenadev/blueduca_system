import { type FC, type ReactNode, useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
}

export const BottomSheet: FC<BottomSheetProps> = ({ isOpen, onClose, title, children }) => {
    const [shouldRender, setShouldRender] = useState(isOpen);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => {
                setShouldRender(false);
                document.body.style.overflow = '';
            }, 400);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!shouldRender) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
            {/* Overlay */}
            <div
                className={`absolute inset-0 bg-slate-900/60 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />

            {/* Sheet */}
            <div
                className={`
                    relative w-full max-w-lg bg-white rounded-t-[32px] shadow-2xl overflow-hidden
                    ${isOpen ? 'animate-slide-up' : 'translate-y-full transition-transform duration-400'}
                `}
                style={{ maxHeight: '90vh' }}
            >
                {/* Drag Handle Decoration */}
                <div className="flex justify-center py-3">
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
                </div>

                {/* Header */}
                {(title || !!onClose) && (
                    <div className="px-6 pb-4 flex items-center justify-between border-b border-gray-50">
                        {title && <h3 className="text-xl font-black text-gray-900 tracking-tight">{title}</h3>}
                        <button
                            onClick={onClose}
                            className="p-2 bg-gray-50 text-gray-400 hover:text-gray-600 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6 pb-safe-area">
                    {children}
                </div>
            </div>
        </div>
    );
};
