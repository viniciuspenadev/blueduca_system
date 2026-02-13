import { type FC, useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { Modal, Button } from '../ui';
import {
    User, Search, DollarSign, Calendar,
    Hash, CheckCircle, Zap, Loader2, Info,
    QrCode, Barcode, FileUp, X, Clock
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { triggerImmediateDunning } from '../../services/dunning-engine';
import { maskCurrency, parseCurrencyToNumber } from '../../utils/core_formatters';

interface NewChargeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const NewChargeModal: FC<NewChargeModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { currentSchool } = useAuth();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [gatewayConfig, setGatewayConfig] = useState<any>(null);

    // Form State
    const [studentSearch, setStudentSearch] = useState('');
    const [students, setStudents] = useState<any[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<any>(null);

    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        dueDate: new Date().toISOString().split('T')[0],
        installments: 1,
        category: 'mensalidade',
        chargeType: 'manual' as 'manual' | 'automatic',
        // Manual Payment Data
        pixKey: '',
        boletoMode: 'code' as 'code' | 'pdf',
        boletoCode: '',
        boletoFile: null as File | null
    });

    // Search students
    useEffect(() => {
        const delay = setTimeout(() => {
            if (studentSearch.length >= 3) {
                handleSearch();
            }
        }, 500);
        return () => clearTimeout(delay);
    }, [studentSearch]);

    useEffect(() => {
        if (isOpen && currentSchool) {
            fetchGatewayConfig();
        }
    }, [isOpen, currentSchool]);

    const fetchGatewayConfig = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'finance_gateway_config')
                .eq('school_id', currentSchool?.id)
                .maybeSingle();

            if (error) throw error;
            if (data) {
                let val = data.value;
                if (typeof val === 'string') {
                    try { val = JSON.parse(val); } catch (e) { }
                }
                setGatewayConfig(val);
            } else {
                setGatewayConfig(null);
            }
        } catch (err) {
            console.error('Error fetching gateway config:', err);
        }
    };

    const handleSearch = async () => {
        setSearching(true);
        try {
            const { data, error } = await supabase
                .from('enrollments')
                .select(`
                    id,
                    student_id,
                    candidate_name
                `)
                .eq('school_id', currentSchool?.id)
                .ilike('candidate_name', `%${studentSearch}%`)
                .limit(5);

            if (error) throw error;
            setStudents(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setSearching(false);
        }
    };

    const handleSubmit = async () => {
        if (!selectedStudent || !formData.amount || !formData.description) {
            addToast('error', 'Preencha todos os campos obrigatórios.');
            return;
        }

        // Mandatory validation for manual payments
        if (formData.chargeType === 'manual' && !formData.pixKey && !formData.boletoCode && !formData.boletoFile) {
            addToast('error', 'Para cobrança manual, informe ao menos um método (Pix, Código ou PDF do Boleto).');
            return;
        }

        setLoading(true);
        try {
            const baseAmount = parseCurrencyToNumber(formData.amount);
            const firstDate = new Date(formData.dueDate);
            const installmentCount = formData.installments;

            let boletoUrl = '';

            // Upload PDF if needed
            if (formData.boletoMode === 'pdf' && formData.boletoFile) {
                const fileName = `${currentSchool?.id}/${selectedStudent.id}/${Date.now()}-${formData.boletoFile.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('finance')
                    .upload(fileName, formData.boletoFile);

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('finance')
                    .getPublicUrl(fileName);

                boletoUrl = urlData.publicUrl;
            }

            const newInstallments = [];

            for (let i = 0; i < installmentCount; i++) {
                const dueDate = new Date(firstDate);
                dueDate.setMonth(dueDate.getMonth() + i);

                newInstallments.push({
                    school_id: currentSchool?.id,
                    enrollment_id: selectedStudent.id,
                    value: baseAmount,
                    due_date: dueDate.toISOString().split('T')[0],
                    status: 'pending',
                    installment_number: i + 1,
                    is_published: true,
                    metadata: {
                        description: formData.description,
                        category: formData.category,
                        pix_key: formData.pixKey,
                        boleto_code: formData.boletoMode === 'code' ? formData.boletoCode : '',
                        boleto_url: formData.boletoMode === 'pdf' ? boletoUrl : ''
                    }
                });
            }

            const { data, error } = await supabase
                .from('installments')
                .insert(newInstallments)
                .select();

            if (error) throw error;

            addToast('success', `${installmentCount} lançamento(s) criado(s) com sucesso!`);

            // If marked as automatic charge
            if (formData.chargeType === 'automatic' && data && data.length > 0) {
                try {
                    // 1. Generate Asaas Charge via Edge Function
                    const { error: asaasError } = await supabase.functions.invoke('send-payment-link', {
                        body: { installment_ids: data.map(inst => inst.id) }
                    });

                    if (asaasError) throw asaasError;

                    // 2. Trigger WhatsApp Dunning
                    for (const inst of data) {
                        await triggerImmediateDunning(supabase, currentSchool?.id!, inst.id, 'CREATION')
                            .catch(e => console.error('Dunning Trigger Error:', e));
                    }
                    addToast('info', 'Cobranças geradas no Asaas e notificações enviadas.');
                } catch (asaasErr: any) {
                    console.error('Asaas Integration Error:', asaasErr);
                    addToast('error', 'Parcelas criadas, mas erro ao gerar no Asaas: ' + (asaasErr.message || 'Erro no Gateway'));
                }
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            addToast('error', 'Erro ao criar lançamento: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Novo Lançamento Financeiro"
            size="lg"
        >
            <div className="space-y-6">
                {/* Student Selection */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <User className="w-4 h-4" /> Aluno
                    </label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar aluno por nome..."
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all font-medium"
                            value={selectedStudent ? selectedStudent.candidate_name : studentSearch}
                            onChange={(e) => {
                                setStudentSearch(e.target.value);
                                if (selectedStudent) setSelectedStudent(null);
                            }}
                        />
                        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-brand-600" />}
                    </div>

                    {/* Search Results Dropdown */}
                    {!selectedStudent && students.length > 0 && studentSearch.length >= 3 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                            {students.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setSelectedStudent(s)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-50 text-left transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
                                        <Hash className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{s.candidate_name}</p>
                                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Matrícula: {s.id.split('-')[0]}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Descrição</label>
                        <input
                            type="text"
                            placeholder="Ex: Mensalidade Março"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Categoria</label>
                        <select
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-bold text-gray-700"
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                        >
                            <option value="mensalidade">Mensalidade</option>
                            <option value="material">Material Escolar</option>
                            <option value="evento">Evento / Passeio</option>
                            <option value="taxa">Taxa Extra</option>
                            <option value="outro">Outro</option>
                        </select>
                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <DollarSign className="w-4 h-4" /> Valor (R$)
                        </label>
                        <input
                            type="text"
                            placeholder="0,00"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-bold text-lg text-gray-900"
                            value={formData.amount}
                            onChange={e => setFormData({ ...formData, amount: maskCurrency(e.target.value) })}
                        />
                    </div>

                    {/* Due Date */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> 1º Vencimento
                        </label>
                        <input
                            type="date"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-bold text-gray-700"
                            value={formData.dueDate}
                            onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                        />
                    </div>
                </div>

                {/* Recurrence */}
                <div className="bg-brand-50/50 p-4 rounded-2xl border border-brand-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-brand-600 shadow-sm">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-brand-900 leading-none">Parcelamento</h4>
                            <p className="text-[10px] text-brand-600 font-bold uppercase mt-1">Repetir mensalmente</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-brand-200 shadow-sm">
                        <input
                            type="number"
                            min="1"
                            max="48"
                            className="w-8 border-none bg-transparent text-center font-bold text-brand-900 focus:ring-0 p-0"
                            value={formData.installments}
                            onChange={e => setFormData({ ...formData, installments: parseInt(e.target.value) || 1 })}
                        />
                        <span className="text-[10px] font-bold text-brand-300">X</span>
                    </div>
                </div>

                {/* Charge Type Selection (UX Tabs) */}
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Modalidade de Cobrança</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, chargeType: 'manual' })}
                            className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${formData.chargeType === 'manual'
                                ? 'border-brand-600 bg-brand-50/50 text-brand-700 shadow-sm'
                                : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                                }`}
                        >
                            <FileUp className={`w-5 h-5 ${formData.chargeType === 'manual' ? 'text-brand-600' : 'text-slate-400'}`} />
                            <div className="text-center">
                                <span className="block text-xs font-black uppercase">Manual</span>
                                <span className="text-[10px] font-medium opacity-70">Eu informo Pix/Boleto</span>
                            </div>
                        </button>

                        <button
                            type="button"
                            disabled={gatewayConfig?.provider !== 'asaas'}
                            onClick={() => setFormData({ ...formData, chargeType: 'automatic' })}
                            className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${formData.chargeType === 'automatic'
                                ? 'border-brand-600 bg-brand-50/50 text-brand-700 shadow-sm'
                                : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200 disabled:opacity-50 disabled:grayscale'
                                }`}
                        >
                            <Zap className={`w-5 h-5 ${formData.chargeType === 'automatic' ? 'text-amber-500' : 'text-slate-400'}`} />
                            <div className="text-center">
                                <span className="block text-xs font-black uppercase">Automática</span>
                                <span className="text-[10px] font-medium opacity-70">
                                    {gatewayConfig?.provider === 'asaas' ? 'Gerar pelo Asaas' : 'Gateway Desativado'}
                                </span>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Conditional Inputs for Manual Payment */}
                {formData.chargeType === 'manual' && (
                    <div className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2 mb-2">
                            <Info className="w-3.5 h-3.5 text-brand-600" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Dados para Recebimento Manual</span>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Chave Pix</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <QrCode className="h-4 w-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Informe a chave Pix"
                                    className="block w-full pl-10 pr-3 py-2 text-sm border-slate-200 rounded-xl focus:ring-brand-500 focus:border-brand-500 transition-all font-medium text-slate-800 placeholder:text-slate-300"
                                    value={formData.pixKey}
                                    onChange={e => setFormData({ ...formData, pixKey: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Documento de Boleto</label>
                            <div className="p-1 bg-white rounded-xl border border-slate-200 flex gap-1">
                                <button
                                    onClick={() => setFormData({ ...formData, boletoMode: 'code' })}
                                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${formData.boletoMode === 'code' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                >
                                    <Barcode className="w-3 h-3" />
                                    Código de Barras
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, boletoMode: 'pdf' })}
                                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${formData.boletoMode === 'pdf' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                >
                                    <FileUp className="w-3 h-3" />
                                    Link / PDF
                                </button>
                            </div>
                        </div>

                        {formData.boletoMode === 'code' ? (
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Barcode className="h-4 w-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Linha digitável do boleto"
                                    className="block w-full pl-10 pr-3 py-2 text-sm border-slate-200 rounded-xl focus:ring-brand-500 focus:border-brand-500 transition-all font-mono text-slate-800"
                                    value={formData.boletoCode}
                                    onChange={e => setFormData({ ...formData, boletoCode: e.target.value })}
                                />
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <label className="flex-1 flex items-center gap-2 px-3 py-2 border-2 border-dashed border-slate-200 rounded-xl hover:border-brand-400 cursor-pointer transition-all group">
                                    <FileUp className="w-4 h-4 text-slate-400 group-hover:text-brand-500" />
                                    <span className="text-xs font-bold text-slate-500 group-hover:text-brand-600 flex-1 truncate">
                                        {formData.boletoFile ? formData.boletoFile.name : 'Selecionar arquivo PDF'}
                                    </span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="application/pdf"
                                        onChange={e => setFormData({ ...formData, boletoFile: e.target.files?.[0] || null })}
                                    />
                                </label>
                                {formData.boletoFile && (
                                    <button
                                        onClick={() => setFormData({ ...formData, boletoFile: null })}
                                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Info Text for Automatic Selection */}
                {formData.chargeType === 'automatic' && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <Zap className="w-5 h-5 text-amber-500 shrink-0" />
                        <div>
                            <h4 className="text-xs font-black text-amber-900 uppercase tracking-tight mb-1">Cobrança Via Gateway Asaas</h4>
                            <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
                                O sistema gerará automaticamente o Pix/Boleto e enviará o link diretamente para o WhatsApp do responsável cadastrado.
                            </p>
                        </div>
                    </div>
                )}

                {/* Footer Info */}
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                    <Info className="w-3 h-3" />
                    <span>O sistema calculará automaticamente as datas para parcelamentos subsequentes.</span>
                </div>

                {/* Buttons */}
                <div className="flex gap-4 pt-4">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 font-bold text-xs uppercase"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-[2] bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs uppercase shadow-xl shadow-brand-600/20"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        {loading ? 'Processando...' : 'Confirmar Lançamento'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
