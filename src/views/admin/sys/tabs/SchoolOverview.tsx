import React from 'react';
import {
    MessageSquare,
    HardDrive,
    Users,
    AlertTriangle,
    CheckCircle,
    Activity
} from 'lucide-react';

interface Props {
    school: any;
    limits: any;
}

export const SchoolOverview: React.FC<Props> = ({ school, limits }) => {
    // Helper to calculate percentage and color
    const getProgress = (used: number, max: number) => {
        if (!max) return { percent: 0, color: 'bg-gray-300' };
        const percent = Math.min(Math.round((used / max) * 100), 100);
        let color = 'bg-green-500';
        if (percent > 80) color = 'bg-amber-500';
        if (percent > 95) color = 'bg-red-500';
        return { percent, color };
    };

    // Parse limits from plan config (Priority: School Override > Plan Default > Fallback)
    const maxMessages = (school.config_limits?.max_messages_month) || (school.product_plans?.config_limits?.max_messages_month) || 1000;
    const maxStorage = 5 * 1024 * 1024 * 1024; // 5GB default (mocked for now, pending DB column)
    const maxUsers = (school.config_limits?.max_users) || (school.product_plans?.config_limits?.max_users) || 5;

    // Real usage
    const usedMessages = limits.messages_sent_count || 0;
    const usedStorage = limits.storage_used_bytes || 0;
    const usedUsers = limits.active_users_count || 0;

    const msgProgress = getProgress(usedMessages, maxMessages);
    const storageProgress = getProgress(usedStorage, maxStorage);
    // const usersProgress = getProgress(usedUsers, maxUsers);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Left Column: Usage Stats */}
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Activity className="text-brand-600" size={20} />
                        Limites do Plano
                    </h3>

                    <div className="space-y-6">
                        {/* Messages */}
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <MessageSquare size={16} className="text-gray-400" />
                                    Mensagens (Mês)
                                </label>
                                <span className="text-xs font-bold text-gray-600">
                                    {usedMessages} / {maxMessages}
                                </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${msgProgress.color}`}
                                    style={{ width: `${msgProgress.percent}%` }}
                                ></div>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1 text-right">Renova em 01/Next</p>
                        </div>

                        {/* Storage */}
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <HardDrive size={16} className="text-gray-400" />
                                    Armazenamento
                                </label>
                                <span className="text-xs font-bold text-gray-600">
                                    {(usedStorage / 1024 / 1024).toFixed(1)}MB / {(maxStorage / 1024 / 1024 / 1024).toFixed(1)}GB
                                </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${storageProgress.color}`}
                                    style={{ width: `${storageProgress.percent}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Users (Total Active) */}
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <Users size={16} className="text-gray-400" />
                                    Usuários (Logins)
                                </label>
                                <span className="text-xs font-bold text-gray-600">
                                    {usedUsers} / {maxUsers}
                                </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 bg-blue-500`}
                                    style={{ width: `${Math.min((usedUsers / (maxUsers || 1)) * 100, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Health & Quick Info */}
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4">Saúde da Conta</h3>

                    <div className="space-y-4">
                        <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                            <CheckCircle className="text-green-600 shrink-0 mt-0.5" size={18} />
                            <div>
                                <h4 className="text-sm font-bold text-green-800">Pagamentos em dia</h4>
                                <p className="text-xs text-green-700">Nenhuma fatura pendente nos últimos 6 meses.</p>
                            </div>
                        </div>

                        {msgProgress.percent > 90 && (
                            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                                <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={18} />
                                <div>
                                    <h4 className="text-sm font-bold text-red-800">Cota de Mensagens Crítica</h4>
                                    <p className="text-xs text-red-700">A escola atingiu 90% do limite. Sugerir upgrade.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
