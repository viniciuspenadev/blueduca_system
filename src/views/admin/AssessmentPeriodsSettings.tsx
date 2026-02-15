import { type FC, useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Button, Input } from '../../components/ui';
import {
    Loader2,
    Trash2,
    Edit2,
    Calendar,
    Sparkles,
    AlertCircle,
    CheckCircle
} from 'lucide-react';

interface AssessmentPeriod {
    id: string;
    school_id: string;
    school_year: number;
    period_number: number;
    period_name: string;
    start_date: string;
    end_date: string;
}

interface SchoolYear {
    id: string;
    year: string;
    status: 'active' | 'planning' | 'closed';
    is_current: boolean;
}

export const AssessmentPeriodsSettings: FC = () => {
    const { currentSchool } = useAuth();
    const { addToast } = useToast();
    const { confirm } = useConfirm();

    const [periods, setPeriods] = useState<AssessmentPeriod[]>([]);
    const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [editingPeriod, setEditingPeriod] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<AssessmentPeriod>>({});

    // Generate modal state
    const [generateForm, setGenerateForm] = useState({
        year: new Date().getFullYear(),
        periodicity: 'quarterly' as 'bimonthly' | 'quarterly' | 'monthly',
        startDate: '',
        endDate: ''
    });

    useEffect(() => {
        if (currentSchool?.id) {
            fetchSchoolYears();
        }
    }, [currentSchool?.id]);

    useEffect(() => {
        if (selectedYear) {
            fetchPeriods();
        }
    }, [selectedYear]);

    const fetchSchoolYears = async () => {
        try {
            const { data, error } = await supabase
                .from('school_years')
                .select('*')
                .eq('school_id', currentSchool?.id)
                .in('status', ['active', 'planning']) // Apenas anos habilitados
                .order('year', { ascending: false });

            if (error) throw error;

            const years = data || [];
            setSchoolYears(years);

            // Auto-select current year or first available
            if (years.length > 0 && !selectedYear) {
                const currentYear = years.find(y => y.is_current);
                setSelectedYear(currentYear ? parseInt(currentYear.year) : parseInt(years[0].year));
            }
        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro ao carregar anos letivos.');
        }
    };

    const fetchPeriods = async () => {
        if (!selectedYear) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('assessment_periods')
                .select('*')
                .eq('school_id', currentSchool?.id)
                .eq('school_year', selectedYear)
                .order('period_number');

            if (error) throw error;
            setPeriods(data || []);
        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro ao carregar períodos.');
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePeriods = async () => {
        if (!generateForm.startDate || !generateForm.endDate) {
            addToast('error', 'Preencha todas as datas.');
            return;
        }

        const isConfirmed = await confirm({
            title: 'Gerar Períodos',
            message: `Isso irá ${periods.length > 0 ? 'substituir os períodos existentes' : 'criar novos períodos'} para ${generateForm.year}. Deseja continuar ? `,
            type: 'warning',
            confirmText: 'Gerar'
        });

        if (!isConfirmed) return;

        try {
            const { error } = await supabase.rpc('generate_assessment_periods', {
                p_school_id: currentSchool?.id,
                p_school_year: generateForm.year,
                p_periodicity: generateForm.periodicity,
                p_start_date: generateForm.startDate,
                p_end_date: generateForm.endDate
            });

            if (error) throw error;

            addToast('success', 'Períodos gerados com sucesso!');
            setIsGenerateModalOpen(false);
            setSelectedYear(generateForm.year);
            fetchPeriods();
        } catch (error: any) {
            console.error(error);
            addToast('error', error.message || 'Erro ao gerar períodos.');
        }
    };

    const handleEditPeriod = async (periodId: string) => {
        if (!editForm.period_name || !editForm.start_date || !editForm.end_date) {
            addToast('error', 'Preencha todos os campos.');
            return;
        }

        try {
            const { error } = await supabase
                .from('assessment_periods')
                .update({
                    period_name: editForm.period_name,
                    start_date: editForm.start_date,
                    end_date: editForm.end_date
                })
                .eq('id', periodId);

            if (error) throw error;

            addToast('success', 'Período atualizado!');
            setEditingPeriod(null);
            fetchPeriods();
        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro ao atualizar período.');
        }
    };

    const handleDeletePeriod = async (periodId: string, periodName: string) => {
        // Check if period has assessments
        const { data: assessments } = await supabase
            .from('grade_books')
            .select('id')
            .eq('period_id', periodId)
            .limit(1);

        const hasAssessments = assessments && assessments.length > 0;

        const isConfirmed = await confirm({
            title: 'Deletar Período',
            message: hasAssessments
                ? `O período "${periodName}" possui avaliações cadastradas.Ao deletar, essas avaliações ficarão sem período.Deseja continuar ? `
                : `Tem certeza que deseja deletar o período "${periodName}" ? `,
            type: 'danger',
            confirmText: 'Deletar'
        });

        if (!isConfirmed) return;

        try {
            const { error } = await supabase
                .from('assessment_periods')
                .delete()
                .eq('id', periodId);

            if (error) throw error;

            addToast('success', 'Período deletado!');
            fetchPeriods();
        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro ao deletar período.');
        }
    };

    const startEdit = (period: AssessmentPeriod) => {
        setEditingPeriod(period.id);
        setEditForm({
            period_name: period.period_name,
            start_date: period.start_date,
            end_date: period.end_date
        });
    };

    const cancelEdit = () => {
        setEditingPeriod(null);
        setEditForm({});
    };

    // Helper para formatar data sem timezone (evita bug de -1 dia)
    const formatDateBR = (dateString: string) => {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    const periodicityOptions = [
        { value: 'bimonthly', label: 'Bimestral (6 períodos)' },
        { value: 'quarterly', label: 'Trimestral (4 períodos)' },
        { value: 'monthly', label: 'Mensal (12 períodos)' }
    ];

    const getSelectedYearData = () => {
        return schoolYears.find(y => parseInt(y.year) === selectedYear);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Ativo</span>;
            case 'planning':
                return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Planejamento</span>;
            case 'closed':
                return <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">Fechado</span>;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header with Actions */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">Ano Letivo:</label>
                    <select
                        value={selectedYear || ''}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                        disabled={schoolYears.length === 0}
                    >
                        {schoolYears.length === 0 && <option value="">Nenhum ano habilitado</option>}
                        {schoolYears.map(year => (
                            <option key={year.id} value={parseInt(year.year)}>
                                {year.year} {year.is_current ? '(Atual)' : ''}
                            </option>
                        ))}
                    </select>
                    {getSelectedYearData() && getStatusBadge(getSelectedYearData()!.status)}
                </div>

                <Button
                    onClick={() => setIsGenerateModalOpen(true)}
                    className="bg-brand-600 text-white hover:bg-brand-700"
                    disabled={!selectedYear || schoolYears.length === 0}
                >
                    <Sparkles className="w-4 h-4" />
                    Gerar Períodos
                </Button>
            </div>

            {/* Periods Table */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                </div>
            ) : periods.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Nenhum período cadastrado
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                        Clique em "Gerar Períodos" para criar automaticamente.
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Nº</th>
                                <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Nome</th>
                                <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Início</th>
                                <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Fim</th>
                                <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {periods.map((period) => (
                                <tr key={period.id} className="hover:bg-gray-50">
                                    <td className="py-3 px-4 text-sm font-medium text-gray-900">
                                        {period.period_number}
                                    </td>
                                    <td className="py-3 px-4">
                                        {editingPeriod === period.id ? (
                                            <Input
                                                value={editForm.period_name || ''}
                                                onChange={(e) => setEditForm({ ...editForm, period_name: e.target.value })}
                                                className="h-8"
                                            />
                                        ) : (
                                            <span className="text-sm font-medium text-gray-900">{period.period_name}</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4">
                                        {editingPeriod === period.id ? (
                                            <Input
                                                type="date"
                                                value={editForm.start_date || ''}
                                                onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                                                className="h-8"
                                            />
                                        ) : (
                                            <span className="text-sm text-gray-600">
                                                {formatDateBR(period.start_date)}
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4">
                                        {editingPeriod === period.id ? (
                                            <Input
                                                type="date"
                                                value={editForm.end_date || ''}
                                                onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                                                className="h-8"
                                            />
                                        ) : (
                                            <span className="text-sm text-gray-600">
                                                {formatDateBR(period.end_date)}
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center justify-end gap-2">
                                            {editingPeriod === period.id ? (
                                                <>
                                                    <button
                                                        onClick={() => handleEditPeriod(period.id)}
                                                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                        title="Salvar"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={cancelEdit}
                                                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                        title="Cancelar"
                                                    >
                                                        <AlertCircle className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => startEdit(period)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeletePeriod(period.id, period.period_name)}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Deletar"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900">
                        <p className="font-medium mb-1">💡 Dica</p>
                        <p>
                            Períodos são usados para organizar avaliações e notas ao longo do ano letivo.
                            Após criar os períodos, eles aparecerão automaticamente na tela de Avaliações e Notas.
                        </p>
                    </div>
                </div>
            </div>

            {/* Generate Modal */}
            {isGenerateModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-brand-600" />
                            Gerar Períodos Automaticamente
                        </h3>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Ano Letivo
                                </label>
                                <select
                                    value={generateForm.year}
                                    onChange={(e) => setGenerateForm({ ...generateForm, year: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                >
                                    {schoolYears.map(year => (
                                        <option key={year.id} value={parseInt(year.year)}>{year.year}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Tipo de Periodicidade
                                </label>
                                <div className="space-y-2">
                                    {periodicityOptions.map(option => (
                                        <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="periodicity"
                                                value={option.value}
                                                checked={generateForm.periodicity === option.value}
                                                onChange={(e) => setGenerateForm({ ...generateForm, periodicity: e.target.value as any })}
                                                className="text-brand-600 focus:ring-brand-500"
                                            />
                                            <span className="text-sm text-gray-700">{option.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Data de Início
                                </label>
                                <Input
                                    type="date"
                                    value={generateForm.startDate}
                                    onChange={(e) => setGenerateForm({ ...generateForm, startDate: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Data de Fim
                                </label>
                                <Input
                                    type="date"
                                    value={generateForm.endDate}
                                    onChange={(e) => setGenerateForm({ ...generateForm, endDate: e.target.value })}
                                />
                            </div>

                            {periods.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    <p className="text-sm text-amber-900">
                                        ⚠️ Isso irá substituir os {periods.length} períodos existentes para {generateForm.year}.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <Button
                                onClick={() => setIsGenerateModalOpen(false)}
                                className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleGeneratePeriods}
                                className="flex-1 bg-brand-600 text-white hover:bg-brand-700"
                            >
                                Gerar Períodos
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
