import { type FC, memo } from 'react';
import { ChevronRight } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DiaryCardProps {
    report: any;
    onToggle: (report: any) => void;
    isLocked?: boolean;
    releaseTime?: string;
}

export const DiaryCard: FC<DiaryCardProps> = memo(({ report, onToggle, isLocked = false, releaseTime = '17:00' }) => {
    const reportDate = new Date(report.date + 'T00:00:00');
    const dateStr = isValid(reportDate)
        ? format(reportDate, "EEEE, d 'de' MMMM", { locale: ptBR })
        : 'Data inválida';

    const getCardSummary = (r: any) => {
        if (isLocked) return `🔒 Disponível após as ${releaseTime}h`;
        if (r.homework) return `📚 ${r.homework.split('\n')[0].substring(0, 40)}...`;
        if (r.activities) return `🎨 ${r.activities.split('\n')[0].substring(0, 40)}...`;
        if (r.observations) return `📝 ${r.observations.split('\n')[0].substring(0, 40)}...`;
        return 'Confira os detalhes da rotina';
    };

    return (
        <div
            onClick={() => !isLocked && onToggle(report)}
            className={`
                group bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer 
                transition-all hover:shadow-md hover:border-brand-200 active:scale-[0.98]
                ${isLocked ? 'opacity-75 bg-gray-50 grayscale' : ''}
            `}
        >
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-sm font-black text-gray-800 capitalize truncate">
                            {dateStr}
                        </h2>
                        {report.attendance_status && (
                            <span className={`
                                px-2 py-0.5 rounded-full text-[10px] font-black uppercase
                                ${report.attendance_status === 'present' ? 'bg-green-50 text-green-600' :
                                    report.attendance_status === 'absent' ? 'bg-red-50 text-red-600' :
                                        'bg-blue-50 text-blue-600'}
                            `}>
                                {report.attendance_status === 'present' ? 'Presente' :
                                    report.attendance_status === 'absent' ? 'Faltou' : 'Outro'}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-500 font-medium truncate flex-1 pr-2">
                            {getCardSummary(report)}
                        </p>
                        {report.teacher?.name && (
                            <span className="text-[9px] font-bold text-brand-600/60 uppercase whitespace-nowrap">
                                {report.teacher.name.split(' ')[0]}
                            </span>
                        )}
                    </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                    <ChevronRight size={18} />
                </div>
            </div>
        </div>
    );
});

export const DiarySkeleton: FC = () => {
    return (
        <div className="space-y-4 animate-pulse">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-5 bg-gray-100 rounded-full w-8"></div>
                </div>
                <div className="h-3 bg-gray-100 rounded w-2/3"></div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-5 bg-gray-100 rounded-full w-8"></div>
                </div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-5 bg-gray-100 rounded-full w-8"></div>
                </div>
                <div className="h-3 bg-gray-100 rounded w-3/4"></div>
            </div>
        </div>
    )
}
