import React, { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabase';
import { Button, Input } from '../../../components/ui';
import { Megaphone, Save, X, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { SysPushManager } from './SysPushManager';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export const SystemAnnouncementDialog: React.FC<Props> = ({ isOpen, onClose }) => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [type, setType] = useState<'info' | 'warning' | 'error'>('info');
    const [active, setActive] = useState(false);

    // Tab State
    const [activeTab, setActiveTab] = useState<'banner' | 'push'>('banner');

    useEffect(() => {
        if (isOpen) fetchConfig();
    }, [isOpen]);

    const fetchConfig = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('sys_config')
            .select('value')
            .eq('key', 'global_announcement')
            .single();

        if (data?.value) {
            setMessage(data.value.message || '');
            setType(data.value.type || 'info');
            setActive(data.value.active || false);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('sys_config')
                .upsert({
                    key: 'global_announcement',
                    value: { message, type, active },
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            addToast('success', 'Aviso global atualizado!');
            // Don't close immediately allow further edits
        } catch (error) {
            console.error(error);
            addToast('error', 'Erro ao salvar aviso.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Megaphone className="text-brand-600" /> Central de Comunicados
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 mb-6">
                    <button
                        onClick={() => setActiveTab('banner')}
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'banner' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        Banner no Site
                    </button>
                    <button
                        onClick={() => setActiveTab('push')}
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'push' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        Push (Celular)
                    </button>
                </div>

                {activeTab === 'banner' ? (
                    <div className="space-y-4 animate-in fade-in">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem do Banner</label>
                            <Input
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Ex: Manutenção programada para Domingo às 00:00"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Alerta</label>
                                <select
                                    className="w-full p-2 bg-white border border-gray-300 rounded-lg"
                                    value={type}
                                    onChange={(e) => setType(e.target.value as any)}
                                >
                                    <option value="info">Informação (Azul)</option>
                                    <option value="warning">Atenção (Amarelo)</option>
                                    <option value="error">Crítico (Vermelho)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <button
                                    onClick={() => setActive(!active)}
                                    className={`w-full p-2 rounded-lg font-medium transition-colors border ${active
                                        ? 'bg-green-100 text-green-700 border-green-200'
                                        : 'bg-gray-100 text-gray-500 border-gray-200'
                                        }`}
                                >
                                    {active ? 'ATIVO (Visível)' : 'INATIVO (Oculto)'}
                                </button>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 mt-4">
                            <p className="text-xs text-gray-500 mb-2 uppercase font-bold">Preview:</p>
                            {active ? (
                                <div className={`
                                    px-4 py-2 rounded shadow-sm flex items-center gap-3 text-sm font-medium text-white
                                    ${type === 'info' ? 'bg-blue-600' : type === 'warning' ? 'bg-amber-500' : 'bg-red-600'}
                                `}>
                                    {type === 'info' ? <Info size={18} /> : <AlertTriangle size={18} />}
                                    <span>{message || 'Sua mensagem aqui...'}</span>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 italic text-center">Banner desativado</p>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button variant="ghost" onClick={onClose}>Fechar</Button>
                            <Button onClick={handleSave} disabled={loading} className="bg-brand-600 text-white">
                                {loading ? <Loader2 className="animate-spin" /> : <><Save size={18} className="mr-2" /> Publicar Aviso</>}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-right-4">
                        <SysPushManager />
                    </div>
                )}
            </div>
        </div>
    );
};
