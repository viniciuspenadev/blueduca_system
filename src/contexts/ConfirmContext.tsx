
import React, { createContext, useContext, useState, useCallback, type ReactNode, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface ConfirmOptions {
    title?: string;
    message: ReactNode;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'info' | 'success' | 'warning';

    // Legacy support for simple window.confirm string
    // If just checking confirm("message"), we map it to message
}

interface ConfirmContextType {
    confirm: (messageOrOptions: string | ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context;
};

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState<ConfirmOptions>({
        message: '',
        type: 'info'
    });

    // We keep a reference to the promise resolve function
    // so we can call it when the user clicks a button.
    const resolveRef = useRef<(value: boolean) => void>(() => { });

    const confirm = useCallback((messageOrOptions: string | ConfirmOptions): Promise<boolean> => {
        let options: ConfirmOptions;

        if (typeof messageOrOptions === 'string') {
            options = {
                message: messageOrOptions,
                title: 'Confirmação',
                type: 'info'
            };
        } else {
            options = {
                title: 'Confirmação',
                type: 'info',
                ...messageOrOptions
            };
        }

        setConfig(options);
        setIsOpen(true);

        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
        });
    }, []);

    const handleConfirm = () => {
        setIsOpen(false);
        resolveRef.current(true);
    };

    const handleCancel = () => {
        setIsOpen(false);
        resolveRef.current(false);
    };

    // Icon Mapping
    const getIcon = () => {
        switch (config.type) {
            case 'danger': return <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4"><AlertTriangle className="w-6 h-6 text-red-600" /></div>;
            case 'warning': return <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-4"><AlertTriangle className="w-6 h-6 text-orange-600" /></div>;
            case 'success': return <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4"><CheckCircle className="w-6 h-6 text-green-600" /></div>;
            default: return <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4"><Info className="w-6 h-6 text-blue-600" /></div>;
        }
    };

    const getPrimaryButtonClass = () => {
        const base = "px-6 py-2.5 rounded-xl font-semibold shadow-lg transition-transform active:scale-95 flex items-center gap-2 text-white";
        switch (config.type) {
            case 'danger': return `${base} bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-red-500/25`;
            case 'warning': return `${base} bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/25`;
            case 'success': return `${base} bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-green-500/25`;
            default: return `${base} bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25`;
        }
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}

            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleCancel}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                        >
                            <div className="p-6 flex flex-col items-center text-center">
                                {/* Icon */}
                                <motion.div
                                    initial={{ scale: 0, rotate: -45 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
                                >
                                    {getIcon()}
                                </motion.div>

                                {/* Content */}
                                <h3 className="text-xl font-bold text-gray-900 mb-2">
                                    {config.title}
                                </h3>
                                <div className="text-gray-500 mb-8 leading-relaxed">
                                    {config.message}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={handleCancel}
                                        className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                                    >
                                        {config.cancelText || 'Cancelar'}
                                    </button>
                                    <button
                                        onClick={handleConfirm}
                                        className={`flex-1 ${getPrimaryButtonClass()}`}
                                    >
                                        {config.confirmText || 'Sim, confirmar'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </ConfirmContext.Provider>
    );
};
