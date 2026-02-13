import { type FC, useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Calendar, MessageSquare, Clock, Zap, Edit2, ChevronRight, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge, Button, Modal } from '../../components/ui';
import { supabase } from '../../services/supabase';

export interface DunningStep {
    id?: string;
    day_offset: number;
    event_type?: 'DUE_DATE' | 'CREATION';
    template_key: string;
    active: boolean;
    use_custom_message?: boolean;
    custom_message?: string;
}

interface DunningTimelineEditorProps {
    steps: DunningStep[];
    onChange: (steps: DunningStep[]) => void;
    templates: { key: string; label: string }[];
}

export const DunningTimelineEditor: FC<DunningTimelineEditorProps> = ({
    steps,
    onChange,
    templates
}) => {
    const [selectedStep, setSelectedStep] = useState<DunningStep | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [templateContents, setTemplateContents] = useState<any[]>([]);

    useEffect(() => {
        const fetchTemplateContents = async () => {
            const { data } = await supabase.from('wpp_notification_templates').select('*');
            if (data) setTemplateContents(data);
        };
        fetchTemplateContents();
    }, []);

    // Group steps by their chronological position
    const segments = useMemo(() => {
        const sorted = [...steps].sort((a, b) => a.day_offset - b.day_offset);
        return {
            pre: sorted.filter(s => s.day_offset < 0),
            on: sorted.filter(s => s.day_offset === 0),
            post: sorted.filter(s => s.day_offset > 0)
        };
    }, [steps]);

    const handleSaveStep = (updated: DunningStep) => {
        if (updated.id === 'DELETE') {
            onChange(steps.filter(s => s.id !== selectedStep?.id));
        } else {
            onChange(steps.map(s => s.id === updated.id ? updated : s));
        }
        setIsModalOpen(false);
    };

    const handleAddStep = (offset: number) => {
        const newStep: DunningStep = {
            id: Math.random().toString(36).substr(2, 9),
            day_offset: offset,
            template_key: templates[0]?.key || '',
            active: true
        };
        onChange([...steps, newStep]);
        setSelectedStep(newStep);
        setIsModalOpen(true);
    };

    const StatusBadge = ({ step }: { step: DunningStep }) => {
        if (step.event_type === 'CREATION') return <Badge variant="success" className="text-[10px] font-bold">Imediato</Badge>;
        if (step.day_offset < 0) return <Badge variant="warning" className="text-[10px] font-bold">{Math.abs(step.day_offset)}d Antes</Badge>;
        if (step.day_offset === 0) return <Badge variant="danger" className="text-[10px] font-bold">No Dia</Badge>;
        return <Badge variant="info" className="text-[10px] font-bold">{step.day_offset}d Depois</Badge>;
    };

    const ActionCard = ({ step }: { step: DunningStep }) => (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`
                group relative min-w-[200px] max-w-[200px] bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer
                ${!step.active ? 'opacity-60 grayscale bg-gray-50' : 'hover:border-brand-300'}
            `}
            onClick={() => { setSelectedStep(step); setIsModalOpen(true); }}
        >
            <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${step.use_custom_message ? 'bg-indigo-50 text-indigo-600' : 'bg-brand-50 text-brand-600'}`}>
                    {step.use_custom_message ? <Edit2 className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                </div>
                <StatusBadge step={step} />
            </div>

            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                {step.use_custom_message ? 'Personalizado' : 'Template'}
            </p>
            <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-relaxed">
                {step.use_custom_message ? step.custom_message : (templates.find(t => t.key === step.template_key)?.label || '...')}
            </p>

            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="p-1 bg-brand-50 rounded-full text-brand-600">
                    <ChevronRight className="w-3 h-3" />
                </div>
            </div>
        </motion.div>
    );

    const Milestone = ({ label, icon: Icon, color, sublabel }: any) => (
        <div className="flex flex-col items-center gap-2 mx-4">
            <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center shadow-lg border-2 border-white ring-4 ring-gray-50`}>
                <Icon className="w-6 h-6 text-white" />
            </div>
            <div className="text-center">
                <span className="text-[10px] font-bold text-gray-900 uppercase block tracking-wider">{label}</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase">{sublabel}</span>
            </div>
        </div>
    );

    const Connector = () => (
        <div className="w-12 h-[2px] bg-slate-200 relative mx-1">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-400 border-2 border-white shadow-sm" />
        </div>
    );

    return (
        <div className="w-full bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2">
                        <Zap className="w-4 h-4 text-brand-600 fill-brand-600" />
                        Automação de Cobrança
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">Configuração da jornada de mensagens por WhatsApp.</p>
                </div>
                <Button size="sm" onClick={() => handleAddStep(-1)} className="bg-gray-900 text-white hover:bg-gray-800 px-4">
                    <Plus className="w-4 h-4 mr-2" /> Novo Passo
                </Button>
            </div>

            {/* Pipeline Canvas */}
            <div className="flex-1 p-12 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 bg-slate-50/50">
                <div className="inline-flex items-center min-w-full relative">
                    {/* Background Flow Line */}
                    <div className="absolute top-[28px] left-20 right-20 h-[2px] bg-slate-100 -z-10" />

                    {/* TRIGGER */}
                    <Milestone label="Início" sublabel="Cobrança Gerada" icon={Zap} color="bg-slate-900" />

                    <Connector />

                    {/* PRE-DUE SECTION */}
                    <div className="flex items-center gap-4 bg-amber-50/50 p-6 rounded-[2rem] border border-amber-200/50 mx-2 shadow-inner">
                        <AnimatePresence mode="popLayout">
                            {steps.filter(s => s.event_type === 'CREATION').map(s => (
                                <ActionCard key={s.id || s.day_offset} step={s} />
                            ))}
                            {segments.pre.filter(s => s.event_type !== 'CREATION').map(s => (
                                <ActionCard key={s.id || s.day_offset} step={s} />
                            ))}
                        </AnimatePresence>
                        {(segments.pre.length === 0 && steps.filter(s => s.event_type === 'CREATION').length === 0) && <span className="text-[10px] font-bold text-amber-500 uppercase px-4">Sem avisos prévios</span>}
                        <button
                            onClick={() => handleAddStep(-1)}
                            className="w-10 h-10 rounded-xl border-2 border-dashed border-amber-300 flex items-center justify-center text-amber-400 hover:bg-amber-100 hover:text-amber-500 transition-all"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    <Connector />

                    {/* DUE DATE MILSTONE */}
                    <div className="flex flex-col items-center gap-4">
                        <Milestone label="Vencimento" sublabel="Dia 0" icon={Calendar} color="bg-red-500" />
                        <AnimatePresence mode="popLayout">
                            {segments.on.map(s => (
                                <ActionCard key={s.id} step={s} />
                            ))}
                        </AnimatePresence>
                        {segments.on.length === 0 && (
                            <Button size="sm" variant="ghost" onClick={() => handleAddStep(0)} className="text-red-400 text-[10px] h-auto p-1 uppercase">
                                + Add no Dia
                            </Button>
                        )}
                    </div>

                    <Connector />

                    {/* POST-DUE SECTION */}
                    <div className="flex items-center gap-4 bg-purple-50/50 p-6 rounded-[2rem] border border-purple-200/50 mx-2 shadow-inner">
                        <AnimatePresence mode="popLayout">
                            {segments.post.map(s => (
                                <ActionCard key={s.id} step={s} />
                            ))}
                        </AnimatePresence>
                        {segments.post.length === 0 && <span className="text-[10px] font-bold text-purple-500 uppercase px-4">Sem avisos de atraso</span>}
                        <button
                            onClick={() => handleAddStep(1)}
                            className="w-10 h-10 rounded-xl border-2 border-dashed border-purple-300 flex items-center justify-center text-purple-400 hover:bg-purple-100 hover:text-purple-500 transition-all"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    <Connector />

                    <Milestone label="Concluir" sublabel="Fim da Régua" icon={Clock} color="bg-slate-200" />
                </div>
            </div>

            {/* Legend / Info */}
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex gap-8 justify-center">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Lembretes Antecipados</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Avisos no Vencimento</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Cobrança de Atraso</span>
                </div>
            </div>

            {/* MODAL (Refined for this layout) */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Configurar Passo da Automação"
                size="md"
            >
                {selectedStep && (
                    <div className="space-y-6">
                        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 bg-brand-100 rounded-xl text-brand-600">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900 uppercase">Agendamento</h4>
                                    <p className="text-xs text-gray-500">Quando disparar esta mensagem?</p>
                                </div>
                            </div>

                            <div className="flex gap-4 items-center">
                                <select
                                    className="flex-1 text-sm border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800 font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={selectedStep.event_type === 'CREATION' ? 'creation' : selectedStep.day_offset < 0 ? 'before' : selectedStep.day_offset > 0 ? 'after' : 'on'}
                                    onChange={e => {
                                        const type = e.target.value;
                                        const current = Math.abs(selectedStep.day_offset) || 1;
                                        if (type === 'creation') handleSaveStep({ ...selectedStep, event_type: 'CREATION', day_offset: 0 });
                                        else if (type === 'on') handleSaveStep({ ...selectedStep, event_type: 'DUE_DATE', day_offset: 0 });
                                        else if (type === 'before') handleSaveStep({ ...selectedStep, event_type: 'DUE_DATE', day_offset: -current });
                                        else handleSaveStep({ ...selectedStep, event_type: 'DUE_DATE', day_offset: current });
                                    }}
                                >
                                    <option value="before">Antes do Vencimento</option>
                                    <option value="on">No Dia do Vencimento</option>
                                    <option value="after">Após o Vencimento</option>
                                    <option value="creation">Ao Gerar Cobrança (Gatilho)</option>
                                </select>

                                {selectedStep.day_offset !== 0 && selectedStep.event_type !== 'CREATION' && (
                                    <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-xl border border-gray-200 h-full">
                                        <input
                                            type="number"
                                            min="1"
                                            max="90"
                                            className="w-10 text-sm border-none bg-transparent text-right font-bold text-gray-900 focus:ring-0 p-0"
                                            value={Math.abs(selectedStep.day_offset)}
                                            onChange={e => {
                                                const val = parseInt(e.target.value) || 1;
                                                handleSaveStep({ ...selectedStep, day_offset: selectedStep.day_offset < 0 ? -val : val });
                                            }}
                                        />
                                        <span className="text-[10px] font-bold text-gray-400">DIAS</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-gray-900 uppercase tracking-widest">Conteúdo da Mensagem</label>
                                <label className="flex items-center gap-2 cursor-pointer bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                                    <span className="text-[10px] font-bold text-slate-500">Personalizar?</span>
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                        checked={selectedStep.use_custom_message || false}
                                        onChange={e => handleSaveStep({ ...selectedStep, use_custom_message: e.target.checked })}
                                    />
                                </label>
                            </div>

                            {selectedStep.use_custom_message ? (
                                <div className="space-y-2">
                                    <textarea
                                        className="w-full min-h-[140px] p-4 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none font-medium bg-slate-50/50"
                                        placeholder="Olá {{responsavel}}, este é um lembrete..."
                                        value={selectedStep.custom_message || ''}
                                        onChange={e => handleSaveStep({ ...selectedStep, custom_message: e.target.value })}
                                    />
                                    <div className="flex gap-1.5 flex-wrap">
                                        {['aluno', 'responsavel', 'valor', 'vencimento', 'link_boleto'].map(tag => (
                                            <span key={tag} className="bg-white border text-[10px] font-bold text-slate-500 px-2.5 py-1 rounded-lg">
                                                {`{{${tag}}}`}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <select
                                        className="w-full border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none bg-slate-50/50"
                                        value={selectedStep.template_key}
                                        onChange={e => handleSaveStep({ ...selectedStep, template_key: e.target.value })}
                                    >
                                        {templates.map(t => (
                                            <option key={t.key} value={t.key}>{t.label}</option>
                                        ))}
                                    </select>

                                    {/* Template Preview */}
                                    <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4 animate-fade-in">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Info className="w-3.5 h-3.5 text-brand-600" />
                                            <span className="text-[10px] font-bold text-brand-700 uppercase">Prévia do Modelo Escolhido</span>
                                        </div>
                                        <div className="text-xs text-brand-800 leading-relaxed italic">
                                            {templateContents.find(tc => tc.key === selectedStep.template_key)?.message_template || (
                                                <span className="text-gray-400">Selecione um modelo para ver o texto...</span>
                                            )}
                                        </div>
                                        <p className="text-[9px] text-brand-500 mt-2 font-medium">
                                            * Variáveis como data, valor e link serão preenchidas automaticamente pelo sistema.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <div className={`w-11 h-6 rounded-full transition-all relative ${selectedStep.active ? 'bg-brand-600' : 'bg-slate-200'}`}>
                                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${selectedStep.active ? 'translate-x-5' : 'translate-x-0'}`} />
                                </div>
                                <span className={`text-xs font-bold uppercase ${selectedStep.active ? 'text-brand-700' : 'text-gray-400'}`}>
                                    {selectedStep.active ? 'Step Ativo' : 'Step Pausado'}
                                </span>
                            </label>

                            <Button
                                variant="ghost"
                                className="text-red-500 hover:bg-red-50 font-bold"
                                onClick={() => handleSaveStep({ ...selectedStep, id: 'DELETE' })}
                            >
                                <Trash2 className="w-4 h-4 mr-2" /> Excluir
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
