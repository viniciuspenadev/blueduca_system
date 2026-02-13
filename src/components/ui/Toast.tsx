import { type FC, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    id: string;
    type: ToastType;
    message: string;
    onClose: (id: string) => void;
}

export const Toast: FC<ToastProps> = ({ id, type, message, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, 5000); // Auto close after 5s

        return () => clearTimeout(timer);
    }, [id, onClose]);

    const styles = {
        success: 'bg-green-50 text-green-800 border-green-200',
        error: 'bg-red-50 text-red-800 border-red-200',
        info: 'bg-blue-50 text-blue-800 border-blue-200'
    };

    const icons = {
        success: <CheckCircle className="w-5 h-5 text-green-500" />,
        error: <AlertCircle className="w-5 h-5 text-red-500" />,
        info: <Info className="w-5 h-5 text-blue-500" />
    };

    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg animate-slide-in-right max-w-sm w-full transition-all ${styles[type]}`}>
            <div className="flex-shrink-0">
                {icons[type]}
            </div>
            <p className="text-sm font-medium flex-1">{message}</p>
            <button
                onClick={() => onClose(id)}
                className="p-1 rounded hover:bg-black/5 opacity-60 hover:opacity-100 transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};
