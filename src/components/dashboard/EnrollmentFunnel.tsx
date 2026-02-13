import { type FC, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { ArrowRight, CheckCircle2, FileText, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const EnrollmentFunnel: FC = () => {
    const navigate = useNavigate();
    const [counts, setCounts] = useState({ draft: 0, review: 0, active: 0 });

    useEffect(() => {
        const fetchCounts = async () => {
            const { data } = await supabase.from('enrollments').select('status');
            const newCounts = { draft: 0, review: 0, active: 0 };
            data?.forEach((e: any) => {
                if (e.status === 'draft') newCounts.draft++;
                else if (e.status === 'sent' || e.status === 'submitted' || e.status === 'analysis' || e.status === 'pending') newCounts.review++;
                else if (e.status === 'approved' || e.status === 'active') newCounts.active++;
            });
            setCounts(newCounts);
        };
        fetchCounts();
    }, []);

    const steps = [
        {
            id: 'draft',
            label: 'Rascunho',
            count: counts.draft,
            icon: FileText,
            color: 'text-gray-500',
            bg: 'bg-gray-50',
            border: 'border-gray-200',
            barColor: 'bg-gray-300'
        },
        {
            id: 'review',
            label: 'Em Análise',
            count: counts.review,
            icon: UserCheck,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            barColor: 'bg-amber-400'
        },
        {
            id: 'active',
            label: 'Aprovadas',
            count: counts.active,
            icon: CheckCircle2,
            color: 'text-green-600',
            bg: 'bg-green-50',
            border: 'border-green-200',
            barColor: 'bg-green-500'
        }
    ];

    return (
        <div className="relative group cursor-pointer" onClick={() => navigate('/enrollments')}>
            <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200">
                <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-full bg-brand-50 text-brand-600">
                        <ArrowRight className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Funil de Matrículas</h3>
                        <p className="text-sm text-gray-500">Acompanhe o progresso das matrículas</p>
                    </div>
                </div>
                <div className="flex items-center space-x-6">
                    {steps.map((step, index) => (
                        <div key={step.id} className="flex flex-col items-center gap-3 relative bg-white px-2">
                            <div className={`w-10 h-10 rounded-full border-2 ${step.border} ${step.bg} flex items-center justify-center ${step.color} shadow-sm z-10 transition-transform group-hover:scale-110`}>
                                <step.icon className="w-5 h-5" />
                            </div>
                            <div className="text-center">
                                <span className="block text-2xl font-bold text-gray-900">{step.count}</span>
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{step.label}</span>
                            </div>
                            {index < steps.length - 1 && (
                                <div className={`absolute left-[calc(50%+2.5rem)] top-1/2 -translate-y-1/2 w-24 h-1 ${step.barColor} z-0`} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick Action Overlay Hint */}
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-gray-200 via-brand-200 to-gray-200 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );
};
