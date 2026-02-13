import { type FC } from 'react';

import { TaskWidget } from '../components/dashboard/TaskWidget';
import { NextEvents } from '../components/dashboard/NextEvents';
import { AttendanceChart } from '../components/dashboard/AttendanceChart';
import { StudentMoodChart } from '../components/dashboard/StudentMoodChart';
import { UpcomingVisitsWidget } from '../components/dashboard/UpcomingVisitsWidget';
import { usePlan } from '../hooks/usePlan';
import { useAuth } from '../contexts/AuthContext';

export const DashboardView: FC = () => {
    const { hasModule } = usePlan();
    const { user } = useAuth();

    const canSeeCRM = hasModule('crm') &&
        (user?.role === 'ADMIN' || user?.role === 'SECRETARY' || user?.role === 'SUPER_ADMIN');

    return (
        <div className="space-y-4 lg:space-y-6 animate-fade-in pb-20">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                <div>
                    <h1 className="text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900 tracking-tight">Painel de Controle</h1>
                    <p className="text-xs lg:text-sm text-gray-500">Visão geral e operações diárias da escola.</p>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">

                {/* Left Column: Analytics & Major Flows & Tasks (Span 8) */}
                <div className="lg:col-span-8 space-y-6 lg:space-y-8">


                    {/* Pedagogical Indicators */}
                    <section className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                            {hasModule('academic') && <AttendanceChart />}
                            {hasModule('academic') && <StudentMoodChart />}
                        </div>
                    </section>

                    {/* Tasks List (Now at bottom of main column) */}
                    <section className="space-y-3">
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm min-h-[300px]">
                            <TaskWidget />
                        </div>
                    </section>
                </div>

                {/* Right Column: Daily Operations (Span 4) */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Operational Widgets */}
                    <section className="space-y-4 lg:space-y-6">

                        {/* Recent Widget: Visits */}
                        {canSeeCRM && (
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                                <UpcomingVisitsWidget />
                            </div>
                        )}

                        <div>
                            {/* Next Events Widget */}
                            {hasModule('academic') && (
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm min-h-[380px] overflow-hidden">
                                    <NextEvents />
                                </div>
                            )}
                        </div>
                    </section>
                </div>

            </div>
        </div>
    );
};
