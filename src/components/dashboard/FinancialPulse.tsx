import { type FC, useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { supabase } from '../../services/supabase';
import { AlertCircle, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const FinancialPulse: FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState({
        revenue_month_actual: 0,
        overdue_count: 0,
        overdue_amount: 0
    });

    useEffect(() => {
        fetchMetrics();
    }, []);

    const fetchMetrics = async () => {
        try {
            const today = new Date();
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
            const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString();

            const { data: paid } = await supabase
                .from('installments') // Or 'charges' - check db schema if needed, assuming 'installments' is correct based on previous contexts
                .select('value')
                .eq('status', 'paid')
                .gte('paid_at', firstDayOfMonth)
                .lte('paid_at', lastDayOfMonth);

            const { data: overdue } = await supabase
                .from('installments')
                .select('value')
                .eq('status', 'overdue');

            const actual = paid?.reduce((sum, item) => sum + item.value, 0) || 0;
            const overdueAmt = overdue?.reduce((sum, item) => sum + item.value, 0) || 0;
            const overdueCount = overdue?.length || 0;

            setMetrics({
                revenue_month_actual: actual,
                overdue_count: overdueCount,
                overdue_amount: overdueAmt
            });
        } catch (error) {
            console.error('Error fetching financial pulse:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="h-24 bg-gray-50 rounded-xl animate-pulse"></div>;

    return (
        <Card className="p-4 flex flex-col justify-center h-full border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                    <DollarSign className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Receita (Mês)</p>
                    <p className="text-xl font-bold text-gray-900 leading-none">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.revenue_month_actual)}
                    </p>
                </div>
            </div>

            {metrics.overdue_count > 0 && (
                <div
                    onClick={() => navigate('/financeiro/inadimplentes')}
                    className="mt-2 text-xs flex items-center gap-1.5 text-red-600 bg-red-50 px-2 py-1.5 rounded-md cursor-pointer hover:bg-red-100 transition-colors border border-red-100"
                >
                    <AlertCircle className="w-3 h-3" />
                    <span className="font-medium">{metrics.overdue_count} inadimplentes</span>
                    <span className="text-red-400">({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.overdue_amount)})</span>
                </div>
            )}
        </Card>
    );
};
