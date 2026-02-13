
import { type FC } from 'react';
import { User, ShieldCheck, GraduationCap } from 'lucide-react';

interface DigitalStudentIdProps {
    student: {
        name: string;
        id: string; // Used as RA (Registro Acadêmico)
        photo_url?: string;
        grade?: string;
        status?: string;
    };
    schoolYear: number;
    schoolName?: string;
}

export const DigitalStudentId: FC<DigitalStudentIdProps> = ({
    student,
    schoolYear,
    schoolName = "Escola Parceira"
}) => {
    const getStatusLabel = (status?: string) => {
        const s = status?.toLowerCase();
        if (s === 'approved' || s === 'matriculado' || s === 'active') return 'MATRICULADO';
        if (s === 'pending' || s === 'pendente') return 'PENDENTE';
        if (s === 'suspended' || s === 'suspenso') return 'SUSPENSO';
        return 'ESTUDANTE'; // Fallback generic
    };

    const getStatusColors = (status?: string) => {
        const s = status?.toLowerCase();
        if (s === 'approved' || s === 'matriculado' || s === 'active') {
            return 'bg-emerald-500/20 border-emerald-400/30 text-emerald-100';
        }
        if (s === 'pending' || s === 'pendente') {
            return 'bg-amber-500/20 border-amber-400/30 text-amber-100';
        }
        return 'bg-brand-500/20 border-brand-400/30 text-brand-100';
    };

    return (
        <div className="w-full h-56 group select-none relative">
            {/* FRONT ONLY */}
            <div className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden shadow-xl border border-white/20">
                {/* Background Art */}
                <div className="absolute inset-0 bg-gradient-to-br from-brand-600 to-brand-800">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-brand-400/20 rounded-full blur-xl -ml-5 -mb-5" />
                </div>

                <div className="relative z-10 p-5 h-full flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                                <GraduationCap className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] opacity-80 uppercase tracking-widest font-semibold">Carteirinha do Estudante</p>
                                <p className="text-sm font-bold leading-tight truncate max-w-[180px]">{schoolName}</p>
                            </div>
                        </div>
                        <span className="text-xs font-mono bg-white/10 px-2 py-1 rounded backdrop-blur-md border border-white/10">
                            {schoolYear}
                        </span>
                    </div>

                    <div className="flex items-center gap-4 mt-2">
                        <div className="w-20 h-24 bg-white/10 rounded-xl overflow-hidden border-2 border-white/30 backdrop-blur-sm relative flex-shrink-0">
                            {student.photo_url ? (
                                <img
                                    src={student.photo_url}
                                    alt={student.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-brand-800 text-brand-300">
                                    <User className="w-8 h-8 opacity-50" />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold leading-tight truncate">{student.name}</h3>
                            <p className="text-brand-100 text-xs mt-1 truncate">RA: {student.id?.substring(0, 8).toUpperCase()}</p>
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] border px-2 py-0.5 rounded-full uppercase font-bold tracking-wide ${getStatusColors(student.status)}`}>
                                    {getStatusLabel(student.status)}
                                </span>
                                {student.grade && (
                                    <span className="text-[10px] bg-white/10 border border-white/20 text-white px-2 py-0.5 rounded-full">
                                        {student.grade}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-end mt-1">
                        <div className="flex items-center gap-1.5 opacity-60 text-[10px]">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Identidade verificada</span>
                        </div>
                        {/* No "Ver Verso" text/icon as requested */}
                    </div>
                </div>
            </div>
        </div>
    );
};
