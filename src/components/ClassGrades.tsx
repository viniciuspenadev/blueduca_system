
import { type FC, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { planningService } from '../services/planningService';
import { Button, Input } from './ui';
import { Loader2, Plus, FileText, ChevronDown, Save, Calendar } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useAuth } from '../contexts/AuthContext';

interface ClassGradesProps {
    classId: string;
}

export const ClassGrades: FC<ClassGradesProps> = ({ classId }) => {
    const { addToast } = useToast();
    const { confirm } = useConfirm();
    const { currentSchool } = useAuth();
    const [loading, setLoading] = useState(true);
    const [periods, setPeriods] = useState<any[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

    // Data
    const [assessments, setAssessments] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [catalogSubjects, setCatalogSubjects] = useState<any[]>([]); // Matérias do catálogo

    // Matrix View State
    const [matrixGrades, setMatrixGrades] = useState<Record<string, Record<string, number | string>>>({}); // student_id -> { assessment_id: score }
    const [matrixChanges, setMatrixChanges] = useState<Set<string>>(new Set()); // list of "studentId-assessmentId" that changed

    // Shared State
    const [savingGrades, setSavingGrades] = useState(false);

    // Descriptive Modal State
    const [descriptiveModal, setDescriptiveModal] = useState<{
        isOpen: boolean;
        studentId: string;
        assessmentId: string;
        currentValue: string;
        studentName: string;
        assessmentTitle: string;
    } | null>(null);
    const [descriptiveText, setDescriptiveText] = useState('');

    // New Assessment State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newAssessment, setNewAssessment] = useState({
        title: '',
        subject: '',
        assessment_type: 'numeric' as 'numeric' | 'concept' | 'descriptive' | 'diagnostic',
        max_score: 10,
        weight: 1,
        date: new Date().toLocaleDateString('en-CA')
    });

    // Fetch periods from database
    const fetchPeriods = async () => {
        try {
            const { data, error } = await supabase
                .from('assessment_periods')
                .select('*')
                .eq('school_id', currentSchool?.id)
                .order('period_number', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                setPeriods(data);
                // Auto-select the first period if none is selected
                if (!selectedPeriod) {
                    setSelectedPeriod(data[0].id);
                }
            } else {
                setPeriods([]);
                setSelectedPeriod(null);
            }
        } catch (error) {
            console.error(error);
            setPeriods([]);
        }
    };

    useEffect(() => {
        if (currentSchool?.id) {
            fetchPeriods();
        }
    }, [currentSchool?.id]);

    useEffect(() => {
        fetchAssessments();
        fetchStudents();
        fetchCatalogSubjects(); // Buscar matérias do catálogo
    }, [classId, selectedPeriod]); // Refetch when period changes

    const fetchCatalogSubjects = async () => {
        try {
            if (!currentSchool?.id) return;
            const subjects = await planningService.getSubjects(currentSchool.id);
            setCatalogSubjects(subjects);
        } catch (error) {
            console.error('Erro ao carregar catálogo de matérias:', error);
            // Não mostra toast para não poluir UI, apenas loga
        }
    };

    // Load matrix data when assessments or students change
    useEffect(() => {
        if (assessments.length > 0 && students.length > 0) {
            fetchMatrixGrades();
        }
    }, [assessments, students]);

    const fetchAssessments = async () => {
        try {
            let query = supabase
                .from('grade_books')
                .select('*, period:assessment_periods(period_name, period_number)')
                .eq('class_id', classId);

            // Filter by period if one is selected
            if (selectedPeriod) {
                query = query.eq('period_id', selectedPeriod);
            }

            const { data, error } = await query.order('created_at', { ascending: true });

            if (error) throw error;
            setAssessments(data || []);
        } catch (error) {
            console.error(error);
            addToast('error', 'Erro ao carregar avaliações.');
        }
    };

    const handleGenerateSubjects = async () => {
        if (!selectedPeriod) {
            addToast('error', 'Selecione um período primeiro.');
            return;
        }

        // Verifica se há matérias no catálogo
        if (catalogSubjects.length === 0) {
            addToast('error', 'Nenhuma matéria cadastrada no catálogo. Configure em Configurações > Matérias.');
            return;
        }

        const periodName = periods.find(p => p.id === selectedPeriod)?.period_name || 'Período';

        const isConfirmed = await confirm({
            title: 'Gerar Pauta',
            message: `Deseja gerar automaticamente a pauta para o ${periodName}?`,
            type: 'info',
            confirmText: 'Gerar'
        });

        if (!isConfirmed) return;

        setLoading(true);
        try {
            // Check existing subjects
            const existingSubjects = new Set(assessments.map(a => a.subject));
            const subjectsToAdd = catalogSubjects
                .map(s => s.name)
                .filter(name => !existingSubjects.has(name));

            if (subjectsToAdd.length === 0) {
                addToast('info', 'Todas as matérias já existem.');
                setLoading(false);
                return;
            }

            const periodLabel = periods.find(p => p.id === selectedPeriod)?.period_name || 'Período';

            const newAssessments = subjectsToAdd.map(subject => ({
                class_id: classId,
                title: `${subject} - ${periodLabel}`,
                period_id: selectedPeriod,
                subject: subject,
                assessment_type: 'numeric', // Default to numeric
                max_score: 10,
                weight: 1,
                date: new Date().toLocaleDateString('en-CA'),
                school_id: currentSchool?.id
            }));

            const { error } = await supabase.from('grade_books').insert(newAssessments);
            if (error) throw error;

            addToast('success', `${subjectsToAdd.length} matérias adicionadas.`);
            fetchAssessments();

        } catch (error: any) {
            addToast('error', 'Erro ao gerar pauta: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        try {
            const { data, error } = await supabase
                .from('class_enrollments')
                .select('student_id, student:students(name)')
                .eq('class_id', classId)
                .order('student(name)');

            if (error) throw error;
            const sorted = (data || []).sort((a: any, b: any) =>
                (a.student?.name || '').localeCompare(b.student?.name || '')
            );
            setStudents(sorted);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // --- MATRIX VIEW LOGIC ---

    const fetchMatrixGrades = async () => {
        if (assessments.length === 0) return;

        setLoading(true);
        try {
            const assessmentIds = assessments.map(a => a.id);
            const { data: grades, error } = await supabase
                .from('student_grades')
                .select('student_id, grade_book_id, score_numeric, score_concept, score_descriptive, score_diagnostic')
                .in('grade_book_id', assessmentIds);

            if (error) throw error;

            // Build matrix
            const matrix: Record<string, Record<string, any>> = {};
            students.forEach(s => {
                matrix[s.student_id] = {};
            });

            // Fill with data - map to correct field based on assessment type
            grades?.forEach(g => {
                if (!matrix[g.student_id]) matrix[g.student_id] = {};

                // Find the assessment to get its type
                const assessment = assessments.find(a => a.id === g.grade_book_id);
                if (!assessment) return;

                // Get the correct score based on type
                let scoreValue: any = null;
                switch (assessment.assessment_type) {
                    case 'numeric':
                        scoreValue = g.score_numeric;
                        break;
                    case 'concept':
                        scoreValue = g.score_concept;
                        break;
                    case 'descriptive':
                        scoreValue = g.score_descriptive;
                        break;
                    case 'diagnostic':
                        scoreValue = g.score_diagnostic;
                        break;
                    default:
                        scoreValue = g.score_numeric; // Default to numeric
                }

                matrix[g.student_id][g.grade_book_id] = scoreValue;
            });

            setMatrixGrades(matrix);
            setMatrixChanges(new Set()); // Reset changes
        } catch (error) {
            console.error(error);
            addToast('error', 'Erro ao carregar grade de notas.');
        } finally {
            setLoading(false);
        }
    };

    const updateMatrixGrade = (studentId: string, assessmentId: string, value: string) => {
        setMatrixGrades(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [assessmentId]: value
            }
        }));
        setMatrixChanges(prev => new Set(prev).add(`${studentId}|${assessmentId}`));
    };

    const saveMatrixGrades = async () => {
        if (matrixChanges.size === 0) return;
        setSavingGrades(true);
        try {
            // Get current user for auditing
            const { data: { user } } = await supabase.auth.getUser();
            // Convert matrix back to records, but ONLY for changed cells
            const records: any[] = [];

            Array.from(matrixChanges).forEach(key => {
                const [studentId, assessmentId] = key.split('|');
                const scoreVal = matrixGrades[studentId]?.[assessmentId];

                // Find the assessment to get its type
                const assessment = assessments.find(a => a.id === assessmentId);
                const assessmentType = assessment?.assessment_type || 'numeric';

                const baseRecord: any = {
                    grade_book_id: assessmentId,
                    student_id: studentId,
                    school_id: currentSchool?.id,
                    created_by: user?.id
                };

                // Map to correct field based on type
                switch (assessmentType) {
                    case 'numeric':
                        baseRecord.score_numeric = scoreVal === '' || scoreVal === undefined ? null : Number(scoreVal);
                        break;
                    case 'concept':
                        baseRecord.score_concept = scoreVal || null;
                        break;
                    case 'descriptive':
                        baseRecord.score_descriptive = scoreVal || null;
                        break;
                    case 'diagnostic':
                        try {
                            const value = String(scoreVal || '');
                            baseRecord.score_diagnostic = value ? JSON.parse(value) : null;
                        } catch {
                            baseRecord.score_diagnostic = null;
                        }
                        break;
                    default:
                        // Fallback for old system
                        baseRecord.score = scoreVal === '' || scoreVal === undefined ? null : Number(scoreVal);
                }

                records.push(baseRecord);
            });

            if (records.length === 0) return;

            const { error } = await supabase
                .from('student_grades')
                .upsert(records, { onConflict: 'grade_book_id,student_id' });

            if (error) throw error;

            addToast('success', `${records.length} notas atualizadas!`);
            setMatrixChanges(new Set());

        } catch (error: any) {
            addToast('error', error.message);
        } finally {
            setSavingGrades(false);
        }
    };

    // --- CREATE / DELETE ---

    const handleCreateAssessment = async () => {
        if (!newAssessment.title) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const assessmentData: any = {
                class_id: classId,
                school_id: currentSchool?.id,
                title: newAssessment.title,
                subject: newAssessment.subject,
                assessment_type: newAssessment.assessment_type,
                max_score: newAssessment.max_score,
                weight: newAssessment.weight,
                date: newAssessment.date,
                created_by: user?.id
            };

            // Require period selection
            if (!selectedPeriod) {
                addToast('error', 'Selecione um período primeiro.');
                return;
            }

            assessmentData.period_id = selectedPeriod;

            const { error } = await supabase
                .from('grade_books')
                .insert(assessmentData);

            if (error) throw error;

            addToast('success', 'Avaliação criada!');
            setIsCreateOpen(false);
            setNewAssessment({
                title: '',
                subject: '',
                assessment_type: 'numeric',
                max_score: 10,
                weight: 1,
                date: new Date().toLocaleDateString('en-CA')
            });
            fetchAssessments();
        } catch (error: any) {
            addToast('error', error.message);
        }
    };

    // --- RENDER ---

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm sticky top-4 z-20 backdrop-blur-sm bg-white/95">
                <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                        <FileText className="w-5 h-5 text-brand-600" />
                        Avaliações e Notas
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Gerencie provas, trabalhos e lançamentos.</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    {assessments.length === 0 && (
                        <Button variant="ghost" onClick={handleGenerateSubjects} className="text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-200">
                            <Plus className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Gerar Pauta</span>
                        </Button>
                    )}
                    {matrixChanges.size > 0 && (
                        <Button onClick={saveMatrixGrades} disabled={savingGrades} className="bg-green-600 hover:bg-green-700 text-white shadow-md animate-pulse">
                            {savingGrades ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar ({matrixChanges.size})
                        </Button>
                    )}
                    <Button onClick={() => setIsCreateOpen(true)} className="bg-brand-600 hover:bg-brand-700 text-white shadow-md">
                        <Plus className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Nova Avaliação</span>
                    </Button>
                </div>
            </div>

            {/* Create Modal */}
            {isCreateOpen && (
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-lg animate-scale-in mb-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-400 to-brand-600" />
                    <h4 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <div className="p-2 bg-brand-50 rounded-lg text-brand-600"><Plus className="w-4 h-4" /></div>
                        Nova Avaliação
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">
                        <div className="md:col-span-6">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Título da Avaliação</label>
                            <Input placeholder="Ex: Prova de Matemática - Cap. 1" value={newAssessment.title} onChange={e => setNewAssessment({ ...newAssessment, title: e.target.value })} className="h-11" />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                                Período
                            </label>
                            <div className="relative">
                                <select
                                    className="w-full h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none appearance-none font-medium text-gray-700"
                                    value={selectedPeriod || ''}
                                    onChange={e => setSelectedPeriod(e.target.value)}
                                >
                                    {periods.length === 0 && <option value="">Nenhum período cadastrado</option>}
                                    {periods.map(period => (
                                        <option key={period.id} value={period.id}>
                                            {period.period_name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Data</label>
                            <div className="relative">
                                <input type="date" className="w-full h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none font-medium text-gray-700" value={newAssessment.date} onChange={e => setNewAssessment({ ...newAssessment, date: e.target.value })} />
                                <Calendar className="absolute right-3 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                        <div className="md:col-span-4">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Tipo de Avaliação</label>
                            <div className="relative">
                                <select
                                    className="w-full h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none appearance-none font-medium text-gray-700"
                                    value={newAssessment.assessment_type}
                                    onChange={e => setNewAssessment({ ...newAssessment, assessment_type: e.target.value as any })}
                                >
                                    <option value="numeric">Numérico (0-10)</option>
                                    <option value="concept">Conceitual (A-E)</option>
                                    <option value="descriptive">Descritivo (Parecer)</option>
                                    <option value="diagnostic">Diagnóstico (Sondagem)</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                        {newAssessment.assessment_type === 'numeric' && (
                            <>
                                <div className="md:col-span-4">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Nota Máxima</label>
                                    <Input type="number" placeholder="10.0" value={newAssessment.max_score} onChange={e => setNewAssessment({ ...newAssessment, max_score: Number(e.target.value) })} className="h-11 text-center font-mono" />
                                </div>
                                <div className="md:col-span-4">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Peso</label>
                                    <Input type="number" placeholder="1" value={newAssessment.weight} onChange={e => setNewAssessment({ ...newAssessment, weight: Number(e.target.value) })} className="h-11 text-center font-mono" />
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="hover:bg-gray-100 text-gray-500">Cancelar</Button>
                        <Button onClick={handleCreateAssessment} className="bg-brand-600 text-white px-8 shadow-lg shadow-brand-200">Criar Avaliação</Button>
                    </div>
                </div>
            )}

            {/* Period Selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                <Calendar className="w-5 h-5 text-gray-400 flex-shrink-0" />
                {periods.length > 0 ? (
                    periods.map(period => (
                        <button
                            key={period.id}
                            onClick={() => setSelectedPeriod(period.id)}
                            className={`
                                        px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all
                                        ${selectedPeriod === period.id
                                    ? 'bg-brand-600 text-white shadow-md shadow-brand-200'
                                    : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}
                                    `}
                        >
                            {period.period_name}
                        </button>
                    ))
                ) : (
                    <span className="text-sm text-gray-400 italic">
                        Nenhum período cadastrado. Configure os períodos nas configurações da escola.
                    </span>
                )}
            </div>

            {/* Loading State */}
            {loading ? (
                <div className="flex flex-col items-center justify-center p-12 text-gray-400 animate-in fade-in">
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-brand-600" />
                    <p>Carregando notas...</p>
                </div>
            ) : (
                <>
                    {/* MATRIX VIEW (GRADE GERAL) */}
                    {assessments.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
                            Nenhuma avaliação neste período.
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="text-left p-4 font-bold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                Aluno
                                            </th>
                                            {assessments.map((a) => (
                                                <th key={a.id} className="p-4 text-center min-w-[120px]">
                                                    <div className="flex flex-col items-center group cursor-pointer hover:bg-gray-100 p-2 rounded-lg transition-colors">
                                                        <span className="font-bold text-gray-800 text-base">{a.subject || a.title}</span>
                                                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity">
                                                            Max: {a.max_score} | Peso: {a.weight}
                                                        </span>
                                                    </div>
                                                </th>
                                            ))}
                                            <th className="p-4 text-center font-bold text-gray-500 uppercase tracking-wider w-[100px]">
                                                Média
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {students.map((student) => {
                                            // Calculate average
                                            const studentGrades = matrixGrades[student.student_id] || {};
                                            let totalScore = 0;
                                            let totalWeight = 0;

                                            assessments.forEach(a => {
                                                const score = parseFloat(String(studentGrades[a.id] || 0));
                                                if (!isNaN(score)) {
                                                    totalScore += score * (a.weight || 1);
                                                    totalWeight += (a.weight || 1);
                                                }
                                            });

                                            const finalAverage = totalWeight > 0 ? (totalScore / totalWeight).toFixed(1) : '-';

                                            return (
                                                <tr key={student.student_id} className="hover:bg-blue-50/30 transition-colors">
                                                    <td className="p-4 font-medium text-gray-900 sticky left-0 bg-white group-hover:bg-blue-50/30 z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-xs">
                                                                {student.student?.name.substring(0, 2)}
                                                            </div>
                                                            {student.student?.name}
                                                        </div>
                                                    </td>
                                                    {assessments.map((a) => {
                                                        const score = matrixGrades[student.student_id]?.[a.id] ?? '';
                                                        const isChanged = matrixChanges.has(`${student.student_id}|${a.id}`);
                                                        const assessmentType = a.assessment_type || 'numeric';

                                                        return (
                                                            <td key={a.id} className="p-2 text-center border-l border-dashed border-gray-100">
                                                                {/* Numeric Input */}
                                                                {assessmentType === 'numeric' && (
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max={a.max_score}
                                                                        step="0.1"
                                                                        value={score}
                                                                        onChange={(e) => updateMatrixGrade(student.student_id, a.id, e.target.value)}
                                                                        className={`w-full px-2 py-1.5 text-center rounded-lg border transition-all ${isChanged
                                                                            ? 'border-green-400 bg-green-50 ring-2 ring-green-200'
                                                                            : 'border-gray-200 bg-gray-50 hover:border-brand-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200'
                                                                            } outline-none font-mono text-sm`}
                                                                    />
                                                                )}

                                                                {/* Concept Select */}
                                                                {assessmentType === 'concept' && (
                                                                    <select
                                                                        value={score}
                                                                        onChange={(e) => updateMatrixGrade(student.student_id, a.id, e.target.value)}
                                                                        className={`w-full px-2 py-1.5 text-center rounded-lg border transition-all ${isChanged
                                                                            ? 'border-green-400 bg-green-50 ring-2 ring-green-200'
                                                                            : 'border-gray-200 bg-gray-50 hover:border-brand-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200'
                                                                            } outline-none font-medium text-sm`}
                                                                    >
                                                                        <option value="">-</option>
                                                                        <option value="A">A</option>
                                                                        <option value="B">B</option>
                                                                        <option value="C">C</option>
                                                                        <option value="D">D</option>
                                                                        <option value="E">E</option>
                                                                    </select>
                                                                )}

                                                                {/* Descriptive - Show indicator only */}
                                                                {assessmentType === 'descriptive' && (
                                                                    <div className="flex items-center justify-center">
                                                                        <button
                                                                            onClick={() => {
                                                                                setDescriptiveText(String(score || ''));
                                                                                setDescriptiveModal({
                                                                                    isOpen: true,
                                                                                    studentId: student.student_id,
                                                                                    assessmentId: a.id,
                                                                                    currentValue: String(score || ''),
                                                                                    studentName: student.student?.name || '',
                                                                                    assessmentTitle: a.title
                                                                                });
                                                                            }}
                                                                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${score
                                                                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                                                } ${isChanged ? 'ring-2 ring-green-400' : ''}`}
                                                                        >
                                                                            {score ? '✓ Parecer' : '+ Parecer'}
                                                                        </button>
                                                                    </div>
                                                                )}

                                                                {/* Diagnostic - Not supported in matrix */}
                                                                {assessmentType === 'diagnostic' && (
                                                                    <span className="text-xs text-gray-400 italic">N/A</span>
                                                                )}

                                                                {/* Fallback for undefined type */}
                                                                {!assessmentType && (
                                                                    <input
                                                                        type="number"
                                                                        value={score}
                                                                        onChange={(e) => updateMatrixGrade(student.student_id, a.id, e.target.value)}
                                                                        className={`w-full px-2 py-1.5 text-center rounded-lg border transition-all ${isChanged
                                                                            ? 'border-green-400 bg-green-50 ring-2 ring-green-200'
                                                                            : 'border-gray-200 bg-gray-50 hover:border-brand-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200'
                                                                            } outline-none font-mono text-sm`}
                                                                    />
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="p-4 text-center">
                                                        <span className={`font-black text-lg ${Number(finalAverage) >= 6 ? 'text-green-600' : 'text-red-500'}`}>
                                                            {finalAverage}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Matrix Save Action */}
                            {matrixChanges.size > 0 && (
                                <div className="p-4 bg-amber-50 border-t border-amber-100 flex justify-between items-center animate-in slide-in-from-bottom-2 sticky bottom-0 z-20 bg-amber-50/95 backdrop-blur-sm">
                                    <span className="text-amber-800 font-bold flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        {matrixChanges.size} alterações não salvas
                                    </span>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" onClick={() => fetchMatrixGrades()} className="text-amber-700 hover:text-amber-800 hover:bg-amber-100">
                                            Cancelar
                                        </Button>
                                        <Button onClick={saveMatrixGrades} disabled={savingGrades} className="bg-amber-600 hover:bg-amber-700 text-white shadow-md">
                                            {savingGrades ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                            Salvar Notas
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Descriptive Assessment Modal */}
            {descriptiveModal?.isOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-scale-up">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100">
                            <h3 className="text-xl font-bold text-gray-900 mb-1">
                                Parecer Descritivo
                            </h3>
                            <p className="text-sm text-gray-500">
                                <span className="font-medium text-gray-700">{descriptiveModal.studentName}</span>
                                {' • '}
                                <span className="text-gray-600">{descriptiveModal.assessmentTitle}</span>
                            </p>
                        </div>

                        {/* Body */}
                        <div className="p-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Digite o parecer descritivo para este aluno:
                            </label>
                            <textarea
                                value={descriptiveText}
                                onChange={(e) => setDescriptiveText(e.target.value)}
                                placeholder="Ex: O aluno demonstrou excelente compreensão dos conceitos apresentados..."
                                className="w-full h-40 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none text-sm"
                                autoFocus
                            />
                            <p className="text-xs text-gray-400 mt-2">
                                {descriptiveText.length} caracteres
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setDescriptiveModal(null);
                                    setDescriptiveText('');
                                }}
                            >
                                Cancelar
                            </Button>
                            <Button
                                className="bg-brand-600 text-white"
                                onClick={async () => {
                                    if (descriptiveModal) {
                                        try {


                                            // Get current user for auditing
                                            const { data: { user } } = await supabase.auth.getUser();

                                            // Save directly to database
                                            const { error } = await supabase
                                                .from('student_grades')
                                                .upsert({
                                                    grade_book_id: descriptiveModal.assessmentId,
                                                    student_id: descriptiveModal.studentId,
                                                    school_id: currentSchool?.id,
                                                    score_descriptive: descriptiveText || null,
                                                    status: 'published',
                                                    created_by: user?.id
                                                }, { onConflict: 'grade_book_id,student_id' })
                                                .select();

                                            if (error) throw error;

                                            // Update local state to reflect the change
                                            setMatrixGrades(prev => ({
                                                ...prev,
                                                [descriptiveModal.studentId]: {
                                                    ...prev[descriptiveModal.studentId],
                                                    [descriptiveModal.assessmentId]: descriptiveText
                                                }
                                            }));

                                            addToast('success', 'Parecer salvo com sucesso!');
                                            setDescriptiveModal(null);
                                            setDescriptiveText('');
                                        } catch (error: any) {
                                            addToast('error', error.message || 'Erro ao salvar parecer');
                                        }
                                    }
                                }}
                            >
                                Salvar Parecer
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
