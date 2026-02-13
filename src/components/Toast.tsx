
import React from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export interface ToastMessage {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface ToastContainerProps {
    toasts: ToastMessage[];
    removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`
            flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-fade-in min-w-[300px]
            ${toast.type === 'success' ? 'bg-white border-green-100 text-green-800' : ''}
            ${toast.type === 'error' ? 'bg-white border-red-100 text-red-800' : ''}
            ${toast.type === 'info' ? 'bg-white border-blue-100 text-blue-800' : ''}
          `}
                >
                    {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                    {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                    {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}

                    <p className="text-sm font-medium flex-1">{toast.message}</p>

                    <button onClick={() => removeToast(toast.id)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
};
