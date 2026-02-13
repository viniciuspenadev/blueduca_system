import { type FC, useState, useEffect } from 'react';
import { useStudent } from '../../contexts/StudentContext';
import { supabase } from '../../services/supabase';
import { FileText, ChevronDown, ChevronUp, GraduationCap, AlertCircle } from 'lucide-react';

interface GradeBook {
    id: string;
    title: string;
    term: string;
    subject: string;
    max_score: number;
    weight: number;
    date: string;
}

interface StudentGrade {
    grade_book_id: string;
    score: number;
}

interface SubjectData {
    name: string;
    terms: Record<string, {
        assessments: GradeBook[];
        grades: Record<string, number>;
        totalScore: number;
        maxPossible: number;
    }>;
    overallScore: number;
    overallMax: number;
}

let cachedGradesData: Record<string, SubjectData[]> = {};

export const ParentGrades: FC = () => {
    const { selectedStudent } = useStudent();
    const cacheKey = selectedStudent?.id || '';
    const [subjects, setSubjects] = useState<SubjectData[]>(cachedGradesData[cacheKey] || []);
    const [loading, setLoading] = useState(!cachedGradesData[cacheKey]);
    const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
    const [selectedTerm, setSelectedTerm] = useState('1_bimestre');

    useEffect(() => {
        if (selectedStudent) {
            fetchGrades();
        }
    }, [selectedStudent]);

    const fetchGrades = async () => {
        if (!selectedStudent) return;
        const cacheKey = selectedStudent.id;
        if (!cachedGradesData[cacheKey]) {
            setLoading(true);
        }
        try {
            const { data: enrollments, error: enrollError } = await supabase
                .from('class_enrollments')
                .select('class_id, classes!inner(id, name, school_year)')
                .eq('student_id', selectedStudent!.id)
                .eq('classes.school_year', selectedStudent.academic_year);

            if (enrollError) throw enrollError;

            const classIds = enrollments?.map(e => e.class_id) || [];
            if (classIds.length === 0) {
                setSubjects([]);
                return;
            }

            const { data: gradeBooks, error: gbError } = await supabase
                .from('grade_books')
                .select('*')
                .in('class_id', classIds)
                .order('date', { ascending: false });

            if (gbError) throw gbError;

            const { data: grades, error: gError } = await supabase
                .from('student_grades')
                .select('*')
                .eq('student_id', selectedStudent!.id)
                .in('grade_book_id', gradeBooks?.map(gb => gb.id) || []);

            if (gError) throw gError;

            const subjectMap: Record<string, SubjectData> = {};

            gradeBooks?.forEach((gb: GradeBook) => {
                const subjectName = gb.subject || 'Geral';

                if (!subjectMap[subjectName]) {
                    subjectMap[subjectName] = {
                        name: subjectName,
                        terms: {},
                        overallScore: 0,
                        overallMax: 0
                    };
                }

                if (!subjectMap[subjectName].terms[gb.term]) {
                    subjectMap[subjectName].terms[gb.term] = {
                        assessments: [],
                        grades: {},
                        totalScore: 0,
                        maxPossible: 0
                    };
                }

                const termData = subjectMap[subjectName].terms[gb.term];
                termData.assessments.push(gb);

                const grade = grades?.find((g: StudentGrade) => g.grade_book_id === gb.id);
                termData.maxPossible += gb.weight;

                if (grade) {
                    termData.grades[gb.id] = grade.score;
                }
            });

            Object.values(subjectMap).forEach(subject => {
                Object.values(subject.terms).forEach(term => {
                    let totalWeightedScore = 0;
                    let totalWeight = 0;

                    term.assessments.forEach(assessment => {
                        const score = term.grades[assessment.id];
                        if (score !== undefined) {
                            totalWeightedScore += score * assessment.weight;
                            totalWeight += assessment.weight;
                        }
                    });

                    term.totalScore = totalWeight > 0 ? (totalWeightedScore / totalWeight) : 0;
                    term.maxPossible = 10;
                });
            });

            const finalSubjects = Object.values(subjectMap).sort((a, b) => a.name.localeCompare(b.name));
            cachedGradesData[cacheKey] = finalSubjects;
            setSubjects(finalSubjects);

        } catch (error) {
            console.error('Error fetching grades:', error);
        } finally {
            setLoading(false);
        }
    };

    const TERMS = [
        { id: '1_bimestre', label: '1º Bim' },
        { id: '2_bimestre', label: '2º Bim' },
        { id: '3_bimestre', label: '3º Bim' },
        { id: '4_bimestre', label: '4º Bim' },
    ];

    const getScoreColor = (score: number) => {
        if (score >= 6) return 'text-green-600 bg-green-50 border-green-200';
        if (score >= 4) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        return 'text-red-600 bg-red-50 border-red-200';
    };

    return (
        <div className="space-y-8 pb-24">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-brand-100 rounded-xl text-brand-600">
                        <GraduationCap className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Boletim Escolar</h2>
                        <p className="text-xs text-gray-400 font-medium">Acompanhe o desempenho acadêmico</p>
                    </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
                    {TERMS.map(term => (
                        <button
                            key={term.id}
                            onClick={() => setSelectedTerm(term.id)}
                            className={`
                                px-5 py-2 rounded-full whitespace-nowrap text-xs font-black transition-all uppercase tracking-wider
                                ${selectedTerm === term.id
                                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-200'
                                    : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100 shadow-sm'}
                            `}
                        >
                            {term.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-1 max-w-2xl mx-auto space-y-6">
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white h-24 rounded-2xl animate-pulse shadow-sm border border-gray-100" />
                        ))}
                    </div>
                ) : subjects.length === 0 ? (
                    <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-8 h-8 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">Nenhuma nota disponível</h3>
                        <p className="text-gray-500 text-sm">
                            As avaliações aparecerão aqui assim que forem lançadas.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {subjects.map((subject) => {
                            const termData = subject.terms[selectedTerm];
                            if (!termData) return null;

                            const isExpanded = expandedSubject === subject.name;
                            const scoreColor = getScoreColor(termData.totalScore);

                            return (
                                <div key={subject.name} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300">
                                    <button
                                        onClick={() => setExpandedSubject(isExpanded ? null : subject.name)}
                                        className="w-full flex items-center justify-between p-5 hover:bg-gray-50/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4 text-left">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border-2 shadow-inner ${scoreColor}`}>
                                                {termData.totalScore.toFixed(1)}
                                            </div>
                                            <div>
                                                <h3 className="font-black text-gray-900 text-lg leading-tight uppercase tracking-tight">{subject.name}</h3>
                                                <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">
                                                    Média do Bimestre
                                                </p>
                                            </div>
                                        </div>
                                        {isExpanded ? (
                                            <ChevronUp className="w-5 h-5 text-gray-300" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-gray-300" />
                                        )}
                                    </button>

                                    {isExpanded && (
                                        <div className="border-t border-gray-50 bg-gray-50/30">
                                            <div className="p-4 space-y-3">
                                                {termData.assessments.map(assessment => {
                                                    const score = termData.grades[assessment.id];
                                                    const hasScore = score !== undefined;

                                                    return (
                                                        <div key={assessment.id} className="bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm">
                                                            <div className="flex-1 min-w-0 pr-4">
                                                                <p className="text-sm font-bold text-gray-900 truncate uppercase tracking-tight">
                                                                    {assessment.title}
                                                                </p>
                                                                <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">
                                                                    {new Date(assessment.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                                </p>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                {hasScore ? (
                                                                    <div className={`font-black text-sm px-3 py-1 rounded-lg shadow-inner border ${(score / assessment.max_score) >= 0.6 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                                        (score / assessment.max_score) >= 0.4 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                                            'bg-red-50 text-red-700 border-red-100'
                                                                        }`}>
                                                                        {Number(score).toFixed(1)}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                                                        <AlertCircle className="w-3 h-3" /> Pendente
                                                                    </span>
                                                                )}
                                                                <p className="text-[9px] font-black text-gray-300 mt-1.5 uppercase tracking-tighter">
                                                                    Peso: {assessment.weight}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {subjects.every(s => !s.terms[selectedTerm]) && (
                            <div className="py-12 text-center">
                                <p className="text-gray-400 font-bold uppercase text-xs tracking-widest">Nenhuma avaliação encontrada neste período.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
