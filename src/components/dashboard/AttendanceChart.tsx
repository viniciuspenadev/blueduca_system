import { type FC, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Users, CheckCircle, XCircle } from 'lucide-react';

export const AttendanceChart: FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ present: 0, absent: 0, total: 0, rate: 0 });

    useEffect(() => {
        fetchAttendance();
    }, []);

    const fetchAttendance = async () => {
        try {
            const today = new Date().toLocaleDateString('en-CA');

            // Get all sheets for today
            const { data: sheets } = await supabase
                .from('class_attendance_sheets')
                .select('id')
                .eq('date', today);

            if (!sheets || sheets.length === 0) {
                setStats({ present: 0, absent: 0, total: 0, rate: 0 });
                setLoading(false);
                return;
            }

            const sheetIds = sheets.map(s => s.id);

            // Get attendance records
            const { data: records, error } = await supabase
                .from('student_attendance')
                .select('status')
                .in('sheet_id', sheetIds);

            if (error) throw error;

            const total = records?.length || 0;
            const present = records?.filter(r => r.status === 'present').length || 0;
            const absent = records?.filter(r => r.status === 'absent').length || 0;
            const rate = total > 0 ? Math.round((present / total) * 100) : 0;

            setStats({ present, absent, total, rate });
        } catch (error) {
            console.error('Error fetching attendance stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="bg-white rounded-3xl border border-gray-100/80 p-6 shadow-sm h-full flex flex-col justify-between animate-pulse">
            <div className="flex justify-between items-start mb-4">
                <div className="space-y-2">
                    <div className="h-3 w-24 bg-gray-200 rounded"></div>
                    <div className="h-2 w-16 bg-gray-100 rounded"></div>
                </div>
                <div className="w-9 h-9 bg-gray-100 rounded-full"></div>
            </div>
            <div className="h-8 w-16 bg-gray-200 rounded mb-2"></div>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-4"></div>
            <div className="grid grid-cols-2 gap-3 mt-auto">
                <div className="h-12 bg-gray-50 rounded-2xl"></div>
                <div className="h-12 bg-gray-50 rounded-2xl"></div>
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-3xl border border-gray-100/80 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 h-full flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wider">Presença Hoje</h3>
                    <p className="text-[10px] text-gray-400">Geral da escola</p>
                </div>
                <div className={`p-2 rounded-full ${stats.rate >= 85 ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                    <Users className="w-5 h-5" />
                </div>
            </div>

            <div className="flex items-end gap-2 mb-2">
                <span className="text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 leading-none">{stats.rate}%</span>
                <span className="text-[10px] lg:text-xs text-gray-500 mb-0.5">presentes</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-100 rounded-full h-2 mb-4 overflow-hidden">
                <div
                    className={`h-full rounded-full ${stats.rate >= 90 ? 'bg-green-500' : stats.rate >= 75 ? 'bg-blue-500' : 'bg-amber-500'}`}
                    style={{ width: `${stats.rate}%` }}
                />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-auto">
                <div className="bg-green-50/70 hover:bg-green-50 rounded-2xl p-3 flex items-center gap-3 transition-colors border border-green-100/50">
                    <div className="bg-green-100/50 p-1.5 rounded-xl">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                        <span className="block text-sm lg:text-base font-bold text-green-700 leading-tight">{stats.present}</span>
                        <span className="text-[10px] text-green-600 font-medium uppercase tracking-wider">Presentes</span>
                    </div>
                </div>
                <div className="bg-red-50/70 hover:bg-red-50 rounded-2xl p-3 flex items-center gap-3 transition-colors border border-red-100/50">
                    <div className="bg-red-100/50 p-1.5 rounded-xl">
                        <XCircle className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                        <span className="block text-sm lg:text-base font-bold text-red-700 leading-tight">{stats.absent}</span>
                        <span className="text-[10px] text-red-600 font-medium uppercase tracking-wider">Faltas</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
