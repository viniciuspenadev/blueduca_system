import { type FC, useState, useEffect } from 'react';
import { useSystem } from '../contexts/SystemContext';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '../services/supabase';
import { Button, Input, Card } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ArrowLeft, Save, GraduationCap } from 'lucide-react';

export const ClassCreateView: FC = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { currentSchool } = useAuth();
    const { availableYears, planningYear, currentYear } = useSystem();
    const [loading, setLoading] = useState(false);
    const [timelines, setTimelines] = useState<any[]>([]);

    useEffect(() => {
        const fetchTimelines = async () => {
            if (!currentSchool) return;
            const { data } = await supabase
                .from('daily_timelines')
                .select('id, name')
                .eq('school_id', currentSchool.id);
            if (data) setTimelines(data);
        };
        fetchTimelines();
    }, [currentSchool]);

    const { register, handleSubmit, formState: { errors } } = useForm({
        defaultValues: {
            name: '',
            school_year: planningYear ? planningYear.year : (currentYear ? currentYear.year : new Date().getFullYear()),
            shift: 'morning',
            capacity: 25,
            daily_timeline_id: ''
        }
    });

    const onSubmit = async (data: any) => {
        setLoading(true);
        try {
            if (!currentSchool) throw new Error('Escola não identificada');
            const { error: dbError } = await supabase
                .from('classes')
                .insert({
                    name: data.name,
                    school_year: Number(data.school_year),
                    shift: data.shift,
                    capacity: Number(data.capacity),
                    status: 'active',
                    school_id: currentSchool.id,
                    daily_timeline_id: data.daily_timeline_id || null
                });

            if (dbError) throw dbError;

            addToast('success', 'Turma criada com sucesso!');
            navigate('/turmas');
        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro ao criar turma: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" className="w-10 h-10 p-0 rounded-full" onClick={() => navigate('/turmas')}>
                    <ArrowLeft className="w-6 h-6 text-gray-500" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Nova Turma</h1>
                    <p className="text-gray-500 text-sm">Crie uma nova turma para iniciar o ano letivo.</p>
                </div>
            </div>

            <Card className="p-6 md:p-8 shadow-lg border border-gray-100">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="flex items-center gap-4 p-4 bg-brand-50 rounded-xl mb-6">
                        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-brand-600 shadow-sm">
                            <GraduationCap className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-brand-900">Dados da Turma</h3>
                            <p className="text-xs text-brand-700">Defina o nome, turno e capacidade.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-full">
                            <Input
                                label="Nome da Turma"
                                placeholder="Ex: 1º Ano A - Fundamental"
                                {...register('name', { required: 'Nome é obrigatório' })}
                                error={errors.name?.message}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ano Letivo</label>
                            <select
                                {...register('school_year', { required: true })}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                            >
                                {availableYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Turno</label>
                            <select
                                {...register('shift')}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                            >
                                <option value="morning">Manhã</option>
                                <option value="afternoon">Tarde</option>
                                <option value="full">Integral</option>
                                <option value="night">Noite</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rotina Padrão (Timeline)</label>
                            <select
                                {...register('daily_timeline_id')}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                            >
                                <option value="">Nenhuma (Padrão)</option>
                                {timelines.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <Input
                                label="Capacidade Máxima"
                                type="number"
                                {...register('capacity', { required: true, min: 1 })}
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                        <Button type="button" variant="ghost" onClick={() => navigate('/turmas')}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-brand-600 hover:bg-brand-700 w-full md:w-auto">
                            <Save className="w-4 h-4 mr-2" />
                            {loading ? 'Salvando...' : 'Criar Turma'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};
