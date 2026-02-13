
import { type FC, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Button, Input } from './ui';
import { Loader2, Plus, Trash2, FileText, ChevronDown, Save, LayoutGrid, List as ListIcon, Calendar } from 'lucide-react';
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
    const [viewMode, setViewMode] = useState<'list' | 'matrix'>('matrix'); // Default to Matrix for Boletim view
    const [selectedTerm, setSelectedTerm] = useState('1_bimestre');

    // Data
    const [assessments, setAssessments] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);

    // List View State
    const [selectedAssessment, setSelectedAssessment] = useState<string | null>(null);
    const [gradesValues, setGradesValues] = useState<Record<string, number | string>>({}); // student_id -> score (for single assessment)

    // Matrix View State
    const [matrixGrades, setMatrixGrades] = useState<Record<string, Record<string, number | string>>>({}); // student_id -> { assessment_id: score }
    const [matrixChanges, setMatrixChanges] = useState<Set<string>>(new Set()); // list of "studentId-assessmentId" that changed

    // Shared State
    const [savingGrades, setSavingGrades] = useState(false);

    // New Assessment State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newAssessment, setNewAssessment] = useState({
        title: '',
        term: '1_bimestre',
        subject: '',
        max_score: 10,
        weight: 1,
        date: new Date().toLocaleDateString('en-CA')
    });

    const TERMS = [
        { id: '1_bimestre', label: '1º Bimestre' },
        { id: '2_bimestre', label: '2º Bimestre' },
        { id: '3_bimestre', label: '3º Bimestre' },
        { id: '4_bimestre', label: '4º Bimestre' },
    ];

    const STANDARD_SUBJECTS = [
        'Português', 'Matemática', 'História', 'Geografia', 'Ciências', 'Artes', 'Ed. Física', 'Inglês'
    ];

    useEffect(() => {
        fetchAssessments();
        fetchStudents();
    }, [classId, selectedTerm]); // Refetch when term changes

    // Load full matrix data when switching to matrix view
    useEffect(() => {
        if (viewMode === 'matrix' && assessments.length > 0) {
            fetchMatrixGrades();
        }
    }, [viewMode, assessments]);

    const fetchAssessments = async () => {
        try {
            const { data, error } = await supabase
                .from('grade_books')
                .select('*')
                .eq('class_id', classId)
                .eq('term', selectedTerm) // Filter by Term
                .order('subject', { ascending: true }); // Order by Subject

            if (error) throw error;
            setAssessments(data || []);
        } catch (error) {
            console.error(error);
            addToast('error', 'Erro ao carregar avaliações.');
        }
    };

    const handleGenerateSubjects = async () => {
        const isConfirmed = await confirm({
            title: 'Gerar Pauta',
            message: `Deseja gerar automaticamente a pauta para o ${TERMS.find(t => t.id === selectedTerm)?.label}?`,
            type: 'info',
            confirmText: 'Gerar'
        });

        if (!isConfirmed) return;

        setLoading(true);
        try {
            // Check existing subjects
            const existingSubjects = new Set(assessments.map(a => a.subject));
            const subjectsToAdd = STANDARD_SUBJECTS.filter(s => !existingSubjects.has(s));

            if (subjectsToAdd.length === 0) {
                addToast('info', 'Todas as matérias já existem.');
                setLoading(false);
                return;
            }

            const newAssessments = subjectsToAdd.map(subject => ({
                class_id: classId,
                title: `${subject} - ${TERMS.find(t => t.id === selectedTerm)?.label}`,
                term: selectedTerm,
                subject: subject,
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

    // --- LIST VIEW LOGIC ---

    const fetchGrades = async (gradeBookId: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('student_grades')
                .select('student_id, score')
                .eq('grade_book_id', gradeBookId);

            if (error) throw error;

            const map: any = {};
            data?.forEach((g: any) => {
                map[g.student_id] = g.score;
            });
            setGradesValues(map);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGrades = async () => {
        if (!selectedAssessment) return;
        setSavingGrades(true);
        try {
            const records = Object.keys(gradesValues).map(studentId => ({
                grade_book_id: selectedAssessment,
                student_id: studentId,
                score: gradesValues[studentId] === '' ? null : Number(gradesValues[studentId])
            }));

            const { error } = await supabase
                .from('student_grades')
                .upsert(records, { onConflict: 'grade_book_id,student_id' });

            if (error) throw error;
            addToast('success', 'Notas salvas!');
        } catch (error: any) {
            addToast('error', error.message);
        } finally {
            setSavingGrades(false);
        }
    };

    const toggleAssessment = (id: string) => {
        if (selectedAssessment === id) {
            setSelectedAssessment(null);
        } else {
            setSelectedAssessment(id);
            fetchGrades(id);
        }
    };

    // --- MATRIX VIEW LOGIC ---

    const fetchMatrixGrades = async () => {
        setLoading(true);
        try {
            const assessmentIds = assessments.map(a => a.id);
            if (assessmentIds.length === 0) return;

            const { data, error } = await supabase
                .from('student_grades')
                .select('student_id, grade_book_id, score')
                .in('grade_book_id', assessmentIds);

            if (error) throw error;

            // Build Matrix: StudentID -> { AssessmentID -> Score }
            const matrix: Record<string, Record<string, number | string>> = {};

            // Initialize for all students
            students.forEach(s => {
                matrix[s.student_id] = {};
            });

            // Fill with data
            data?.forEach((g: any) => {
                if (!matrix[g.student_id]) matrix[g.student_id] = {};
                matrix[g.student_id][g.grade_book_id] = g.score;
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
            // Convert matrix back to records, but ONLY for changed cells
            const records: any[] = [];

            Array.from(matrixChanges).forEach(key => {
                const [studentId, assessmentId] = key.split('|');
                const scoreVal = matrixGrades[studentId]?.[assessmentId];
                records.push({
                    grade_book_id: assessmentId,
                    student_id: studentId,
                    score: scoreVal === '' || scoreVal === undefined ? null : Number(scoreVal)
                });
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
            const { error } = await supabase
                .from('grade_books')
                .insert({
                    class_id: classId,
                    school_id: currentSchool?.id,
                    ...newAssessment
                });

            if (error) throw error;

            addToast('success', 'Avaliação criada!');
            setIsCreateOpen(false);
            setNewAssessment({
                title: '', term: '1_bimestre', subject: '', max_score: 10, weight: 1,
                date: new Date().toLocaleDateString('en-CA')
            });
            fetchAssessments();
        } catch (error: any) {
            addToast('error', error.message);
        }
    };

    const handleDeleteAssessment = async (id: string) => {
        const isConfirmed = await confirm({
            title: 'Excluir Avaliação',
            message: 'Tem certeza que deseja excluir esta avaliação e todas as notas associadas?',
            type: 'danger',
            confirmText: 'Excluir'
        });

        if (!isConfirmed) return;
        try {
            const { error } = await supabase.from('grade_books').delete().eq('id', id);
            if (error) throw error;
            addToast('success', 'Avaliação excluída.');
            fetchAssessments();
            // If in matrix mode, we should reload matrix too
            if (viewMode === 'matrix') fetchMatrixGrades();
            if (selectedAssessment === id) setSelectedAssessment(null);
        } catch (error: any) {
            addToast('error', error.message);
        }
    };

    // --- RENDER ---

    const termLabels: any = {
        '1_bimestre': '1º Bimestre',
        '2_bimestre': '2º Bimestre',
        '3_bimestre': '3º Bimestre',
        '4_bimestre': '4º Bimestre'
    };

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

                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'list' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <ListIcon className="w-4 h-4" /> Lista
                    </button>
                    <button
                        onClick={() => setViewMode('matrix')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'matrix' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <LayoutGrid className="w-4 h-4" /> Grade Geral
                    </button>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    {assessments.length === 0 && (
                        <Button variant="ghost" onClick={handleGenerateSubjects} className="text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-200">
                            <Plus className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Gerar Pauta</span>
                        </Button>
                    )}
                    {viewMode === 'matrix' && matrixChanges.size > 0 && (
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
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Bimestre</label>
                            <div className="relative">
                                <select
                                    className="w-full h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none appearance-none font-medium text-gray-700"
                                    value={newAssessment.term}
                                    onChange={e => setNewAssessment({ ...newAssessment, term: e.target.value })}
                                >
                                    <option value="1_bimestre">1º Bimestre</option>
                                    <option value="2_bimestre">2º Bimestre</option>
                                    <option value="3_bimestre">3º Bimestre</option>
                                    <option value="4_bimestre">4º Bimestre</option>
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
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Nota Máxima</label>
                            <Input type="number" placeholder="10.0" value={newAssessment.max_score} onChange={e => setNewAssessment({ ...newAssessment, max_score: Number(e.target.value) })} className="h-11 text-center font-mono" />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Peso</label>
                            <Input type="number" placeholder="1" value={newAssessment.weight} onChange={e => setNewAssessment({ ...newAssessment, weight: Number(e.target.value) })} className="h-11 text-center font-mono" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="hover:bg-gray-100 text-gray-500">Cancelar</Button>
                        <Button onClick={handleCreateAssessment} className="bg-brand-600 text-white px-8 shadow-lg shadow-brand-200">Criar Avaliação</Button>
                    </div>
                </div>
            )}

            {/* Term Selector */}
            <div className="flex px-1 gap-2 overflow-x-auto pb-2 -mx-4 md:mx-0 px-4 md:px-0 no-scrollbar">
                {TERMS.map(term => (
                    <button
                        key={term.id}
                        onClick={() => setSelectedTerm(term.id)}
                        className={`
                            px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all
                            ${selectedTerm === term.id
                                ? 'bg-brand-600 text-white shadow-md shadow-brand-200'
                                : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}
                        `}
                    >
                        {term.label}
                    </button>
                ))}
            </div>

            {/* Loading State */}
            {loading ? (
                <div className="flex flex-col items-center justify-center p-12 text-gray-400 animate-in fade-in">
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-brand-600" />
                    <p>Carregando notas...</p>
                </div>
            ) : (
                <>
                    {/* VIEW MODE: LIST */}
                    {viewMode === 'list' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {assessments.length === 0 ? (
                                <div className="p-12 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
                                    Nenhuma avaliação neste bimestre.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {assessments.map(assessment => {
                                        const isOpen = selectedAssessment === assessment.id;
                                        return (
                                            <div key={assessment.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer relative group" onClick={() => toggleAssessment(assessment.id)}>
                                                <div className="absolute top-4 right-4 flex gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteAssessment(assessment.id); }}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Excluir Avaliação"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <div className="flex justify-between items-start mb-4 pr-10">
                                                    <div className="p-3 bg-brand-50 rounded-xl">
                                                        <FileText className="w-6 h-6 text-brand-600" />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-lg">
                                                            {termLabels[assessment.term]}
                                                        </span>
                                                        <span className="bg-blue-50 text-brand-600 text-xs font-bold px-2 py-1 rounded-lg">
                                                            Peso {assessment.weight}
                                                        </span>
                                                    </div>
                                                </div>
                                                <h3 className="font-bold text-gray-900 text-lg mb-1">{assessment.title}</h3>
                                                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                                                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {new Date(assessment.date).toLocaleDateString()}</span>
                                                    <span className="flex items-center gap-1">Max: {assessment.max_score}</span>
                                                </div>

                                                {/* Inline Grade Editor for List View (Simplified) */}
                                                {isOpen && (
                                                    <div className="mt-4 pt-4 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                                                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Lançamento Rápido</p>
                                                        <div className="max-h-60 overflow-y-auto space-y-2">
                                                            {students.map(student => (
                                                                <div key={student.student_id} className="flex justify-between items-center text-sm">
                                                                    <span>{student.student?.name}</span>
                                                                    <Input
                                                                        className="w-20 h-8 text-center"
                                                                        type="number"
                                                                        value={gradesValues[student.student_id] ?? ''}
                                                                        onChange={(e) => setGradesValues(prev => ({ ...prev, [student.student_id]: e.target.value }))}
                                                                        placeholder="-"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <Button onClick={handleSaveGrades} disabled={savingGrades} className="w-full mt-4 bg-brand-600 text-white">
                                                            Salvar Notas
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* VIEW MODE: MATRIX */}
                    {viewMode === 'matrix' && (
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

                                                        return (
                                                            <td key={a.id} className="p-2 text-center border-l border-dashed border-gray-100">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max={a.max_score}
                                                                    step="0.1"
                                                                    value={score}
                                                                    onChange={(e) => updateMatrixGrade(student.student_id, a.id, e.target.value)}
                                                                    className={`w-16 text-center font-bold rounded-lg py-1.5 outline-none transition-all
                                                                ${score === '' ? 'bg-gray-50 text-gray-400 hover:bg-gray-100' : ''}
                                                                ${score !== '' && Number(score) >= 6 ? 'text-green-700 bg-green-50 focus:bg-white focus:ring-2 focus:ring-green-200' : ''}
                                                                ${score !== '' && Number(score) < 6 ? 'text-red-600 bg-red-50 focus:bg-white focus:ring-2 focus:ring-red-200' : ''}
                                                                ${isChanged ? 'ring-2 ring-amber-400 bg-amber-50' : ''}
                                                            `}
                                                                    placeholder="-"
                                                                />
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
        </div>
    );
};

