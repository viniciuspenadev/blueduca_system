import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import { useSystem } from './SystemContext';

interface Student {
    id: string;
    name: string;
    photo_url?: string;
    class_name?: string;
    age?: number;
    academic_year: number;
    enrollment_id: string;
}

interface StudentContextType {
    students: Student[];
    selectedStudent: Student | null;
    setSelectedStudent: (student: Student) => void;
    loading: boolean;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const { currentYear: systemCurrentYear, isLoading: systemLoading } = useSystem();
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudent, setSelectedStudentState] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || systemLoading) {
            if (!user) {
                setStudents([]);
                setSelectedStudentState(null);
                setLoading(false);
            }
            return;
        }

        fetchStudents();
    }, [user, systemLoading, systemCurrentYear]);

    const fetchStudents = async () => {
        try {
            setLoading(true);

            // Fetch all students linked to this guardian
            const { data: guardianLinks, error } = await supabase
                .from('student_guardians')
                .select(`
                    student_id,
                    students!inner (
                        name,
                        photo_url,
                        birth_date
                    )
                `)
                .eq('guardian_id', user!.id);

            if (error) throw error;

            if (!guardianLinks || guardianLinks.length === 0) {
                setStudents([]);
                setSelectedStudentState(null);
                setLoading(false);
                return;
            }

            // Process students
            const studentList: (Student | null)[] = await Promise.all(
                guardianLinks.map(async (link) => {
                    const student = link.students as any;

                    // Determine current academic year from System or Fallback to Date
                    const activeYear = systemCurrentYear ? parseInt(systemCurrentYear.year) : new Date().getFullYear();

                    // Get approved enrollment for current year (or most recent)
                    let enrollmentData = await supabase
                        .from('enrollments')
                        .select('id, academic_year')
                        .eq('student_id', link.student_id)
                        .eq('status', 'approved')
                        .eq('academic_year', activeYear)
                        .maybeSingle();

                    // Fallback: if no enrollment for current year, get most recent approved
                    if (!enrollmentData.data) {
                        enrollmentData = await supabase
                            .from('enrollments')
                            .select('id, academic_year')
                            .eq('student_id', link.student_id)
                            .eq('status', 'approved')
                            .order('academic_year', { ascending: false })
                            .limit(1)
                            .maybeSingle();
                    }

                    if (!enrollmentData.data) {
                        // Student has no approved enrollment - skip
                        return null;
                    }

                    const enrollment = enrollmentData.data;

                    // Get class info
                    let className = '';
                    const { data: classEnrollmentData } = await supabase
                        .from('class_enrollments')
                        .select('class_id')
                        .eq('enrollment_id', enrollment.id)
                        .maybeSingle();

                    if (classEnrollmentData) {
                        const { data: classData } = await supabase
                            .from('classes')
                            .select('name')
                            .eq('id', classEnrollmentData.class_id)
                            .maybeSingle();

                        if (classData) className = classData.name;
                    }

                    // Calculate age
                    let age;
                    if (student.birth_date) {
                        const birthDate = new Date(student.birth_date);
                        const today = new Date();
                        age = today.getFullYear() - birthDate.getFullYear();
                        const monthDiff = today.getMonth() - birthDate.getMonth();
                        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                            age--;
                        }
                    }

                    return {
                        id: link.student_id,
                        name: student.name,
                        photo_url: student.photo_url,
                        class_name: className,
                        age,
                        academic_year: enrollment.academic_year,
                        enrollment_id: enrollment.id
                    };
                })
            );

            // Filter out students with no approved enrollment
            const validStudents = studentList.filter(s => s !== null) as Student[];

            setStudents(validStudents);

            // Restore from localStorage or select first
            const savedId = localStorage.getItem('selectedStudentId');
            const savedStudent = validStudents.find(s => s.id === savedId);
            setSelectedStudentState(savedStudent || validStudents[0]);

        } catch (error) {
            console.error('Error fetching students:', error);
        } finally {
            setLoading(false);
        }
    };

    const setSelectedStudent = (student: Student) => {
        setSelectedStudentState(student);
        localStorage.setItem('selectedStudentId', student.id);
    };

    return (
        <StudentContext.Provider value={{ students, selectedStudent, setSelectedStudent, loading }}>
            {children}
        </StudentContext.Provider>
    );
};

export const useStudent = () => {
    const context = useContext(StudentContext);
    if (context === undefined) {
        throw new Error('useStudent must be used within a StudentProvider');
    }
    return context;
};
