import { type FC, useState, useEffect } from 'react';
import { useSystem, type SchoolYear } from '../../contexts/SystemContext';
import { supabase } from '../../services/supabase';
import { Button, Card, Badge } from '../../components/ui';
import { Calendar, CheckCircle2, AlertCircle, Plus, Lock, Unlock, Trash2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useAuth } from '../../contexts/AuthContext';

export const AcademicYearsSettings: FC = () => {
    const { refreshSystem } = useSystem();
    const { currentSchool } = useAuth();
    const [years, setYears] = useState<SchoolYear[]>([]);
    const { addToast } = useToast();
    const { confirm } = useConfirm();

    useEffect(() => {
        fetchYears();
    }, []);

    const fetchYears = async () => {
        try {
            if (!currentSchool) return;
            const { data, error } = await supabase
                .from('school_years')
                .select('*')
                .eq('school_id', currentSchool.id)
                .order('year', { ascending: false });

            if (error) throw error;
            setYears(data || []);
        } catch (error) {
            console.error('Error fetching years:', error);
            addToast('error', 'Erro ao carregar anos letivos');
        }
    };

    const handleCreateYear = async () => {
        // Simple auto-increment logic for now
        const nextYear = years.length > 0
            ? (parseInt(years[0].year) + 1).toString()
            : new Date().getFullYear().toString();

        try {
            if (!currentSchool) throw new Error('Escola não selecionada');

            const { error } = await supabase.from('school_years').insert({
                year: nextYear,
                status: 'planning',
                is_current: false,
                school_id: currentSchool.id
            });

            if (error) throw error;
            addToast('success', `Ano ${nextYear} criado com sucesso!`);
            fetchYears();
            refreshSystem();
        } catch (error) {
            console.error('Error creating year:', error);
            addToast('error', 'Erro ao criar novo ano');
        }
    };

    const handleStatusChange = async (id: string, newStatus: 'active' | 'planning' | 'closed') => {
        try {
            const { error } = await supabase
                .from('school_years')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
            addToast('success', 'Status atualizado!');
            fetchYears();
            refreshSystem();
        } catch (error) {
            addToast('error', 'Erro ao atualizar status');
        }
    };

    const handleSetCurrent = async (id: string) => {
        try {
            // Transaction-like update: Set all to false, then target to true
            // Supabase doesn't support transactions in client lib easily, so we do two revisions
            // Ideally this should be a stored procedure, but for low frequency admin task it's ok.

            // 1. Reset all FOR THIS SCHOOL
            if (!currentSchool) return;

            await supabase
                .from('school_years')
                .update({ is_current: false })
                .eq('school_id', currentSchool.id) // CRITICAL FIX
                .neq('id', '00000000-0000-0000-0000-000000000000');

            // 2. Set new
            const { error } = await supabase
                .from('school_years')
                .update({ is_current: true })
                .eq('id', id);

            if (error) throw error;

            addToast('success', 'Ano Letivo Atual alterado com sucesso!');
            fetchYears();
            refreshSystem();
        } catch (error) {
            addToast('error', 'Erro ao definir ano atual');
        }
    };

    const handleDeleteYear = async (id: string, yearValue: string) => {
        const currentActive = years.find(y => y.is_current);
        const currentYearInt = currentActive ? parseInt(currentActive.year) : new Date().getFullYear();
        const targetYearInt = parseInt(yearValue);

        if (targetYearInt <= currentYearInt) {
            addToast('error', 'Não é permitido excluir o ano vigente ou passados.');
            return;
        }

        const isConfirmed = await confirm({
            title: 'Excluir Ano Letivo',
            message: `Tem certeza que deseja EXCLUIR o ano letivo ${yearValue}? Todas as turmas e matrículas vinculadas podem ficar órfãs.`,
            type: 'danger',
            confirmText: 'Excluir Definitivamente'
        });

        if (!isConfirmed) return;

        try {
            const { error } = await supabase.from('school_years').delete().eq('id', id);
            if (error) throw error;
            addToast('success', `Ano ${yearValue} excluído!`);
            fetchYears();
            refreshSystem();
        } catch (error) {
            console.error(error);
            addToast('error', 'Erro ao excluir (verifique se há dados vinculados)');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active': return <Badge variant="success">Ativo</Badge>;
            case 'planning': return <Badge variant="warning">Planejamento</Badge>;
            case 'closed': return <Badge variant="default">Fechado</Badge>;
            default: return <Badge variant="default">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestão de Anos Letivos</h1>
                    <p className="text-gray-500">Abra novos anos para matrícula ou feche anos anteriores.</p>
                </div>
                <Button onClick={handleCreateYear}>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Ano
                </Button>
            </div>

            <div className="grid gap-4">
                {years.map(year => (
                    <Card key={year.id} className={`p-4 flex items-center justify-between ${year.is_current ? 'border-brand-500 ring-1 ring-brand-500' : ''}`}>
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-lg ${year.is_current ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}`}>
                                <Calendar className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-bold text-gray-900">{year.year}</h3>
                                    {getStatusBadge(year.status)}
                                    {year.is_current && (
                                        <span className="text-xs bg-brand-600 text-white px-2 py-0.5 rounded-full font-bold">
                                            ANO ATUAL
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500">
                                    {year.status === 'active' ? 'Matrículas abertas e aulas em andamento.' :
                                        year.status === 'planning' ? 'Matrículas abertas para o futuro.' : 'Somente consulta.'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {year.status !== 'closed' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleStatusChange(year.id, 'closed')}
                                    title="Fechar Ano"
                                >
                                    <Lock className="w-4 h-4 text-gray-400 hover:text-red-500" />
                                </Button>
                            )}

                            {year.status === 'closed' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleStatusChange(year.id, 'planning')}
                                    title="Reabrir para Planejamento"
                                >
                                    <Unlock className="w-4 h-4 text-gray-400 hover:text-amber-500" />
                                </Button>
                            )}

                            {year.status === 'planning' && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-green-600 border-green-200 hover:bg-green-50"
                                    onClick={() => handleStatusChange(year.id, 'active')}
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Ativar
                                </Button>
                            )}

                            {!year.is_current && year.status === 'active' && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleSetCurrent(year.id)}
                                >
                                    Tornar Atual
                                </Button>
                            )}

                            {!year.is_current && parseInt(year.year) > new Date().getFullYear() && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteYear(year.id, year.year)}
                                    className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                                    title="Excluir Ano (Apenas Futuros)"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </Card>
                ))}
            </div>

            <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3 text-sm text-blue-700">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                    <span className="font-bold">Como funciona?</span>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>**Planejamento**: Aceita matrículas novas (ex: Rematrícula), mas não é o ano padrão do app.</li>
                        <li>**Ativo**: Aceita matrículas e é o ano padrão de visualização.</li>
                        <li>**Fechado**: Apenas histórico. Ninguém pode se matricular.</li>
                        <li>**Ano Atual**: Define o que o App dos Pais mostra como "Hoje".</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
