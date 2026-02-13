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

    if (loading) return <div className="h-40 animate-pulse bg-gray-50 rounded-xl" />;

    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm h-full flex flex-col justify-between">
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
                    className={`h-full rounded-full transition-all duration-1000 ${stats.rate >= 90 ? 'bg-green-500' : stats.rate >= 75 ? 'bg-blue-500' : 'bg-amber-500'}`}
                    style={{ width: `${stats.rate}%` }}
                />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-auto">
                <div className="bg-green-50 rounded-lg p-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <div>
                        <span className="block text-sm font-bold text-green-700">{stats.present}</span>
                        <span className="text-[10px] text-green-600 uppercase">Presentes</span>
                    </div>
                </div>
                <div className="bg-red-50 rounded-lg p-2 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <div>
                        <span className="block text-sm font-bold text-red-700">{stats.absent}</span>
                        <span className="text-[10px] text-red-600 uppercase">Faltas</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
