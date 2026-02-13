import { type FC, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Modal, Button } from './ui';
import { Loader2, CheckCircle, School } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface AssignClassModalProps {
    isOpen: boolean;
    onClose: () => void;
    studentId: string | null;
    studentName: string;
    academicYear: number;
    onSuccess?: () => void;
}

export const AssignClassModal: FC<AssignClassModalProps> = ({
    isOpen,
    onClose,
    studentId,
    studentName,
    academicYear,
    onSuccess
}) => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [currentEnrollment, setCurrentEnrollment] = useState<any>(null);

    useEffect(() => {
        if (isOpen && studentId) {
            fetchClassesAndEnrollment();
        } else {
            // Reset state when closed
            setSelectedClassId(null);
            setCurrentEnrollment(null);
        }
    }, [isOpen, studentId, academicYear]);

    const fetchClassesAndEnrollment = async () => {
        setLoading(true);
        try {
            // 1. Fetch available classes for the year
            const { data: classesData, error: classesError } = await supabase
                .from('classes')
                .select('*')
                .eq('school_year', academicYear)
                .order('grade', { ascending: true })
                .order('name', { ascending: true });

            if (classesError) throw classesError;
            setClasses(classesData || []);

            // 2. Check if student is already assigned to a class this year
            // 2. Check if student is already assigned to a class this year
            // Filter for current year if the user has multiple class enrollments across years
            // (Standard Supabase .single() might fail if multiple rows, so might need better query if history exists)
            // Ideally: .select(..., class!inner(school_year)).eq('class.school_year', academicYear)

            // For safety, let's fetch all and filter in JS to avoid complex JOIN syntax errors strictly
            const { data: allEnrollments } = await supabase
                .from('class_enrollments')
                .select('*, class:classes(*)')
                .eq('student_id', studentId);

            const match = allEnrollments?.find((e: any) => e.class?.school_year === academicYear);

            if (match) {
                setCurrentEnrollment(match);
                setSelectedClassId(match.class_id);
            } else {
                setCurrentEnrollment(null);
                setSelectedClassId(null);
            }

        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro ao carregar turmas.');
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedClassId || !studentId) return;
        setAssigning(true);
        try {
            // If already enrolled in a DIFFERENT class, we might want to update or warn.
            // For now, let's assume we update if exists, or insert if new.

            if (currentEnrollment && currentEnrollment.class_id !== selectedClassId) {
                // Transfer logic: Update existing
                const { error } = await supabase
                    .from('class_enrollments')
                    .update({ class_id: selectedClassId })
                    .eq('id', currentEnrollment.id);
                if (error) throw error;
                addToast('success', 'Aluno transferido de turma com sucesso!');
            } else if (!currentEnrollment) {
                // New Assignment
                const { error } = await supabase
                    .from('class_enrollments')
                    .insert({
                        class_id: selectedClassId,
                        student_id: studentId,
                        enrolled_at: new Date().toISOString()
                    });
                if (error) throw error;
                addToast('success', 'Aluno enturmado com sucesso!');
            }

            if (onSuccess) onSuccess();
            onClose();

        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro ao enturmar: ' + error.message);
        } finally {
            setAssigning(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Enturmar: ${studentName}`}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={assigning}>
                        Cancelar
                    </Button>
                    <Button
                        className="bg-brand-600 hover:bg-brand-700"
                        onClick={handleAssign}
                        disabled={assigning || !selectedClassId || (currentEnrollment && currentEnrollment.class_id === selectedClassId)}
                    >
                        {assigning ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <School className="w-4 h-4 mr-2" />}
                        {currentEnrollment && currentEnrollment.class_id !== selectedClassId ? 'Trocar de Turma' : 'Confirmar Enturmação'}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-gray-500">
                    Selecione a turma para o ano letivo de <strong>{academicYear}</strong>.
                </p>

                {loading ? (
                    <div className="py-8 flex justify-center text-brand-600">
                        <Loader2 className="animate-spin w-8 h-8" />
                    </div>
                ) : (
                    <div className="grid gap-3 max-h-[300px] overflow-y-auto pr-2">
                        {classes.length === 0 ? (
                            <div className="text-center p-4 border border-dashed rounded-lg text-gray-400">
                                Nenhuma turma encontrada para {academicYear}.
                            </div>
                        ) : (
                            classes.map((cls) => {
                                const isSelected = selectedClassId === cls.id;
                                const isCurrent = currentEnrollment?.class_id === cls.id;

                                return (
                                    <div
                                        key={cls.id}
                                        onClick={() => setSelectedClassId(cls.id)}
                                        className={`
                                            cursor-pointer p-4 rounded-lg border flex items-center justify-between transition-all
                                            ${isSelected
                                                ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                                                : 'border-gray-200 hover:border-brand-200 hover:bg-gray-50'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`
                                                w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                                                ${isSelected ? 'bg-brand-200 text-brand-800' : 'bg-gray-100 text-gray-500'}
                                            `}>
                                                {cls.grade?.substring(0, 2)}
                                            </div>
                                            <div>
                                                <h4 className={`font-semibold ${isSelected ? 'text-brand-900' : 'text-gray-700'}`}>
                                                    {cls.name}
                                                </h4>
                                                <div className="text-xs text-gray-500 flex gap-2">
                                                    <span>{cls.grade}</span>
                                                    <span>•</span>
                                                    <span className="capitalize">{cls.shift === 'morning' ? 'Matutino' : cls.shift === 'afternoon' ? 'Vespertino' : 'Integral'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {isCurrent && (
                                            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full flex items-center">
                                                <CheckCircle className="w-3 h-3 mr-1" /> Atual
                                            </span>
                                        )}
                                        {isSelected && !isCurrent && (
                                            <CheckCircle className="w-5 h-5 text-brand-600" />
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};
