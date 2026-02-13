
import { type FC, useState } from 'react';
import { useSystem } from '../contexts/SystemContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Button, Card, Input } from '../components/ui';
import { Loader2, Plus, ArrowRight } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';

export const EnrollmentCreateView: FC = () => {
    const { availableYears, planningYear, currentYear } = useSystem();
    const { currentSchool } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // URL Params for Pre-fill (Leads conversion)
    const initialName = searchParams.get('name') || '';
    const parentEmail = searchParams.get('parentEmail') || '';
    const leadId = searchParams.get('leadId');
    const childId = searchParams.get('childId');

    const [loading, setLoading] = useState(false);
    const [candidateName, setCandidateName] = useState(initialName);

    // Default to Planning Year (Next Year) if available, otherwise Current Year
    const [selectedYear, setSelectedYear] = useState<number>(() => {
        if (planningYear) return parseInt(planningYear.year);
        if (currentYear) return parseInt(currentYear.year);
        return new Date().getFullYear() + 1; // Fallback
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!candidateName.trim()) return;

        setLoading(true);
        try {
            // 1. Create the Enrollment Draft
            const { data, error } = await supabase
                .from('enrollments')
                .insert({
                    candidate_name: candidateName,
                    parent_email: parentEmail,
                    status: 'draft',
                    academic_year: selectedYear,
                    details: {
                        lead_id: leadId,
                        child_id: childId,
                        source: leadId ? 'crm' : 'manual'
                    },
                    school_id: currentSchool?.id
                })
                .select()
                .single();

            if (error) throw error;

            // 2. Redirect immediately to the Editor
            navigate(`/matriculas/${data.id}`);

        } catch (error: any) {
            console.error(error);
            alert('Erro ao criar: ' + error.message);
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto mt-20">
            <Card className="p-8 shadow-lg">
                <div className="text-center mb-6 lg:mb-8">
                    <div className="w-12 h-12 lg:w-16 lg:h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-3 lg:mb-4">
                        <Plus className="w-6 h-6 lg:w-8 lg:h-8 text-brand-600" />
                    </div>
                    <h1 className="text-lg lg:text-xl font-bold text-gray-900">Nova Matrícula</h1>
                    <p className="text-gray-500 text-xs lg:text-sm">Comece informando apenas o nome do aluno.</p>
                </div>

                <form onSubmit={handleCreate} className="space-y-6">
                    <div>
                        <Input
                            placeholder="Nome do Candidato/Aluno"
                            value={candidateName}
                            onChange={e => setCandidateName(e.target.value)}
                            autoFocus
                            className="text-center text-lg"
                        />
                    </div>

                    <div className="flex justify-center gap-4">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            Ano Letivo:
                        </label>
                        <div className="flex gap-2">
                            {availableYears.map(year => (
                                <button
                                    key={year}
                                    type="button"
                                    onClick={() => setSelectedYear(parseInt(year))}
                                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedYear === parseInt(year)
                                        ? 'bg-brand-600 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                    </div>

                    <Button type="submit" className="w-full h-12" disabled={loading || !candidateName}>
                        {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <span className="flex items-center text-base">Criar e Editar <ArrowRight className="ml-2 w-5 h-5" /></span>}
                    </Button>
                </form>
            </Card>
        </div>
    );
};
