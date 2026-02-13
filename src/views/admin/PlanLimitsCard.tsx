import React from 'react';
import { usePlan } from '../../hooks/usePlan';
import { Users, Shield, MessageSquare, Infinity as InfinityIcon } from 'lucide-react';

export const PlanLimitsCard: React.FC = () => {
    const { config } = usePlan();
    const limits = config.limits;

    const items = [
        {
            label: 'Máx. Alunos',
            value: limits.max_students,
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-50'
        },
        {
            label: 'Máx. Usuários (Admin)',
            value: limits.max_users,
            icon: Shield,
            color: 'text-purple-600',
            bg: 'bg-purple-50'
        },
        {
            label: 'Mensagens/Mês',
            value: limits.max_messages_month,
            icon: MessageSquare,
            color: 'text-green-600',
            bg: 'bg-green-50'
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {items.map((item, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{item.label}</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1 flex items-center gap-1">
                            {item.value ? (
                                item.value >= 999999 ? (
                                    <span className="flex items-center gap-1"><InfinityIcon size={20} className="text-gray-600" /> Ilimitado</span>
                                ) : (
                                    item.value.toLocaleString('pt-BR')
                                )
                            ) : (
                                <span className="text-gray-400 text-lg italic">--</span>
                            )}
                        </p>
                    </div>
                    <div className={`p-3 rounded-lg ${item.bg} ${item.color}`}>
                        <item.icon size={24} />
                    </div>
                </div>
            ))}
        </div>
    );
};
