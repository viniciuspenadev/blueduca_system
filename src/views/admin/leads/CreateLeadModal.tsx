import React, { useState } from 'react';
import { supabase } from '../../../services/supabase';
import { X, Save } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

interface CreateLeadModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateLeadModal: React.FC<CreateLeadModalProps> = ({ onClose, onSuccess }) => {
    const { currentSchool } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        source: 'referral', // Default
        notes: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentSchool) return;

        setLoading(true);
        try {
            const { error } = await supabase.from('leads').insert({
                school_id: currentSchool.id,
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                source: formData.source,
                status: 'new', // Always start as new
                notes: formData.notes
            });

            if (error) throw error;

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error creating lead:', error);
            alert('Erro ao criar lead. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-800">Novo Lead</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Responsável *</label>
                        <input
                            required
                            type="text"
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ex: Maria Silva"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                placeholder="maria@email.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone (WhatsApp)</label>
                            <input
                                type="tel"
                                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="(11) 99999-9999"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
                        <select
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.source}
                            onChange={e => setFormData({ ...formData, source: e.target.value })}
                        >
                            <option value="referral">Indicação</option>
                            <option value="walk_in">Passou na Frente</option>
                            <option value="social_media">Redes Sociais</option>
                            <option value="google">Google</option>
                            <option value="event">Evento</option>
                            <option value="other">Outro</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                        <textarea
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Interesses, nome dos filhos, etc..."
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
                        >
                            {loading ? 'Salvando...' : <><Save size={18} /> Salvar Lead</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
