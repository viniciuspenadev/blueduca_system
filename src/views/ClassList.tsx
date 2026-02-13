import { useSystem } from '../contexts/SystemContext';
import { useAuth } from '../contexts/AuthContext';
import { type FC, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Button, Badge } from '../components/ui';
import { useToast } from '../contexts/ToastContext';

import {
    Users,
    Plus,
    Search,
    Calendar,
    Sun,
    Moon,
    Clock
} from 'lucide-react';
import type { Class } from '../types';

export const ClassListView: FC = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { currentSchool, user } = useAuth();
    const { currentYear, years } = useSystem(); // We need the full year objects
    const [loading, setLoading] = useState(true);
    const [classes, setClasses] = useState<Class[]>([]);

    // Filter available years to only Active or Planning (hide Closed/Archived)
    const visibleYears = years?.filter(y => y.status === 'active' || y.status === 'planning') || [];
    const sortedVisibleYears = visibleYears.sort((a, b) => Number(b.year) - Number(a.year));

    // Default to current year or the newest visible year
    const [yearFilter, setYearFilter] = useState(() => {
        if (currentYear) return currentYear.year;
        return sortedVisibleYears.length > 0 ? sortedVisibleYears[0].year : new Date().getFullYear().toString();
    });

    // Effect to sync filter when SystemContext loads the actual current year
    useEffect(() => {
        if (currentYear) {
            setYearFilter(currentYear.year);
        }
    }, [currentYear]);

    const [searchTerm, setSearchTerm] = useState('');

    const fetchClasses = async () => {
        setLoading(true);
        try {
            if (!currentSchool) return;
            let query = supabase
                .from('classes')
                .select(`
                    *, 
                    enrollments:class_enrollments(count),
                    class_teachers(
                        teacher_id,
                        subject,
                        is_primary,
                        profiles:teacher_id(name)
                    )
                `)
                .eq('school_year', Number(yearFilter))
                .eq('school_id', currentSchool.id);

            // Regra de Negócio: Professor vê apenas as dele
            if (user?.role === 'TEACHER') {
                const { data: myClassIds } = await supabase
                    .from('class_teachers')
                    .select('class_id')
                    .eq('teacher_id', user.id)
                    .eq('status', 'ACTIVE');

                const ids = myClassIds?.map(c => c.class_id) || [];
                if (ids.length > 0) {
                    query = query.in('id', ids);
                } else {
                    // Sem turmas, retorna vazio
                    setClasses([]);
                    setLoading(false);
                    return;
                }
            }

            const { data, error } = await query.order('name');

            if (error) throw error;

            // Step 2: Fetch Logic for Regents (Separate query to avoid RLS filtering inner joins)
            const classIds = data.map((c: any) => c.id);
            let regentsMap: Record<string, string> = {};

            if (classIds.length > 0) {
                const { data: regents } = await supabase
                    .from('class_teachers')
                    .select('class_id, profiles!inner(name)')
                    .in('class_id', classIds)
                    .eq('is_primary', true);

                regents?.forEach((r: any) => {
                    regentsMap[r.class_id] = r.profiles?.name;
                });
            }

            // Map count and teachers
            const mapped = data.map((c: any) => {
                // Determine primary teacher from separate query or fallback to join
                const joinPrimary = c.class_teachers?.find((ct: any) => ct.is_primary)?.profiles?.name;
                const primaryName = regentsMap[c.id] || joinPrimary;

                return {
                    ...c,
                    _count: { enrollments: c.enrollments?.[0]?.count || 0 },
                    // Inject a virtual 'teachers' array if needed or just use properties helper
                    primary_teacher_name: primaryName,
                    teachers: c.class_teachers?.map((ct: any) => ({
                        name: ct.profiles?.name,
                        subject: ct.subject,
                        is_primary: ct.is_primary
                    })) || []
                };
            });

            setClasses(mapped);
        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro ao carregar turmas');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentSchool?.id) {
            fetchClasses();
        }
    }, [yearFilter, currentSchool?.id]);

    // Derived filtering for search
    const filteredClasses = classes.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getShiftIcon = (shift: string) => {
        switch (shift) {
            case 'morning': return <Sun className="w-4 h-4 text-orange-500" />;
            case 'afternoon': return <Sun className="w-4 h-4 text-yellow-500" />;
            case 'night': return <Moon className="w-4 h-4 text-indigo-500" />;
            default: return <Clock className="w-4 h-4 text-gray-500" />;
        }
    };

    const getShiftLabel = (shift: string) => {
        const map: any = { morning: 'Manhã', afternoon: 'Tarde', night: 'Noite', full: 'Integral' };
        return map[shift] || shift;
    };

    return (
        <div className="space-y-4 lg:space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl lg:text-3xl font-bold text-gray-900 tracking-tight">
                        Gestão de Turmas
                    </h1>
                    <p className="text-xs lg:text-sm text-gray-500">Gerencie turmas, alunos e professores em um só lugar.</p>
                </div>
                {(user?.role === 'ADMIN' || user?.role === 'SECRETARY') && (
                    <Button className="bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-600/20 px-4 lg:px-6 text-sm lg:text-base" onClick={() => navigate('/turmas/nova')}>
                        <Plus className="w-4 h-4 lg:w-5 lg:h-5 mr-2" />
                        Nova Turma
                    </Button>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-2 lg:gap-4 items-center bg-white p-1.5 lg:p-2 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex-1 w-full relative group">
                    <Search className="absolute left-3 top-2.5 lg:top-3 w-4 h-4 lg:w-5 lg:h-5 text-gray-400 group-focus-within:text-brand-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por nome da turma..."
                        className="w-full pl-9 lg:pl-10 pr-4 py-2 lg:py-2.5 border-transparent rounded-lg text-[13px] lg:text-sm text-gray-700 placeholder-gray-400 focus:ring-0 bg-transparent outline-none"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-px h-6 lg:h-8 bg-gray-200 hidden md:block" />
                <select
                    className="w-full md:w-auto px-3 lg:px-4 py-1.5 lg:py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs lg:text-sm font-medium text-gray-700 focus:ring-2 focus:ring-brand-500 outline-none cursor-pointer hover:bg-gray-100 transition-colors"
                    value={yearFilter}
                    onChange={e => setYearFilter(e.target.value)}
                >
                    {sortedVisibleYears.length > 0 ? (
                        sortedVisibleYears.map(year => (
                            <option key={year.id} value={year.year}>
                                {year.year} {year.status === 'planning' ? '(Planejamento)' : ''}
                            </option>
                        ))
                    ) : (
                        <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                    )}
                </select>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
                    ))
                ) : filteredClasses.length === 0 ? (
                    <div className="col-span-full py-20 text-center">
                        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Search className="w-10 h-10 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">Nenhuma turma encontrada</h3>
                        <p className="text-gray-500">Tente buscar com outros termos ou altere o ano letivo.</p>
                    </div>
                ) : (
                    filteredClasses.map((cls) => {
                        const enrollmentCount = cls._count?.enrollments || 0;
                        const capacityPercentage = Math.round((enrollmentCount / cls.capacity) * 100);
                        const isFull = enrollmentCount >= cls.capacity;

                        // Teacher Helper
                        const primaryTeacherName = (cls as any).primary_teacher_name;
                        const otherTeachersCount = (cls as any).teachers?.length - ((cls as any).teachers?.some((t: any) => t.is_primary) ? 1 : 0);

                        return (
                            <div
                                key={cls.id}
                                onClick={() => navigate(`/turmas/${cls.id}`)}
                                className="group bg-white rounded-xl lg:rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-brand-200 transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-400 to-brand-600 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />

                                <div className="p-4 lg:p-6 flex-1">
                                    <div className="flex justify-between items-start mb-3 lg:mb-4">
                                        <div className="flex items-center gap-3 lg:gap-4">
                                            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg lg:rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-lg lg:text-xl shadow-inner">
                                                {cls.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-base lg:text-lg text-gray-900 group-hover:text-brand-600 transition-colors leading-tight">{cls.name}</h3>
                                                <div className="flex items-center gap-2 mt-0.5 lg:mt-1">
                                                    <span className="text-[10px] lg:text-xs font-medium px-1.5 lg:px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                                                        {cls.school_year}
                                                    </span>
                                                    <span className="text-[10px] lg:text-xs text-gray-400 flex items-center gap-1">
                                                        {getShiftIcon(cls.shift)}
                                                        {getShiftLabel(cls.shift)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <Badge variant={cls.status === 'active' ? 'success' : 'default'} className="shadow-sm">
                                            {cls.status === 'active' ? 'Ativa' : 'Arquivada'}
                                        </Badge>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Capacity Bar */}
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="font-medium text-gray-500">Ocupação</span>
                                                <span className={`font-bold ${isFull ? 'text-red-500' : 'text-gray-700'}`}>
                                                    {enrollmentCount}/{cls.capacity} <span className="text-gray-400 font-normal">({capacityPercentage}%)</span>
                                                </span>
                                            </div>
                                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-100">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${isFull ? 'bg-red-500' : capacityPercentage > 80 ? 'bg-amber-500' : 'bg-gradient-to-r from-green-400 to-green-500'}`}
                                                    style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Teachers */}
                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100/50">
                                            <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100">
                                                <Users className="w-4 h-4 text-brand-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">Professor(a) Regente</p>
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {primaryTeacherName ? primaryTeacherName : <span className="text-gray-400 italic">Não atribuído</span>}
                                                </p>
                                            </div>
                                            {otherTeachersCount > 0 && (
                                                <div className="bg-brand-100 text-brand-700 text-xs font-bold px-2 py-1 rounded-full">
                                                    +{otherTeachersCount}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 px-4 lg:px-6 py-3 lg:py-4 border-t border-gray-100 flex justify-between items-center group-hover:bg-brand-50/30 transition-colors">
                                    <span className="text-[13px] lg:text-sm font-semibold text-gray-600 group-hover:text-brand-700 transition-colors">
                                        Gerenciar Turma
                                    </span>
                                    <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center group-hover:border-brand-300 group-hover:text-brand-600 transition-all shadow-sm">
                                        <Calendar className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
