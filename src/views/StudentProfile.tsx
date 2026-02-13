import { type FC, useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Button, Card } from '../components/ui';
import {
    User, MapPin, Phone, FileText, Heart, Shield,
    ArrowLeft, Mail, GraduationCap, RefreshCw, CheckCircle,
    Moon, Utensils, Smile, Users, AlertTriangle, Droplet, Activity, Ban, Camera, Loader2,
    MessageCircle
} from 'lucide-react';

import { useToast } from '../contexts/ToastContext';
import { useSystem } from '../contexts/SystemContext';
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../hooks/usePlan';
import { AttendanceDetailTable } from '../components/AttendanceDetailTable';
import { JustificationModal } from '../components/JustificationModal';
import { useConfirm } from '../contexts/ConfirmContext';
import { ImageCropperModal } from '../components/ui/ImageCropperModal';
import { DigitalStudentId } from '../components/DigitalStudentId';

export const StudentProfileView: FC = () => {
    const maskSensitiveData = (value: string | null | undefined) => {
        if (!value) return '-';
        const clean = value.replace(/\D/g, '');
        if (clean.length === 11) { // CPF
            return `${value.substring(0, 3)}.***.***-${value.substring(value.length - 2)}`;
        }
        if (clean.length >= 7) { // RG ou similar
            return `${value.substring(0, 2)}.***.***-${value.substring(value.length - 1)}`;
        }
        return value;
    };

    const { id } = useParams<{ id: string }>();

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { addToast } = useToast();
    const { confirm } = useConfirm();
    const { currentSchool, user } = useAuth();
    const { years } = useSystem();
    const { hasModule } = usePlan();

    const canChangePhoto = user && ['ADMIN', 'SECRETARY', 'SUPER_ADMIN'].includes(user.role);


    // Get Year Context from URL or Default
    const contextYear = Number(searchParams.get('year')) || new Date().getFullYear();
    const NEXT_YEAR = contextYear + 1;

    const [student, setStudent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'personal');
    const [renewalEnrollmentId, setRenewalEnrollmentId] = useState<string | null>(null);

    // State for Academic Data
    const [academicData, setAcademicData] = useState<{
        currentClass: any | null;
        attendance: { total: number; present: number; absent: number; justified: number } | null;
        reports: any[];
        grades: any[];
        loading: boolean;
    }>({
        currentClass: null,
        attendance: null,
        reports: [],
        grades: [],
        loading: true // Start loading when mounting or when tab switches to academic
    });

    // State for Detailed Attendance Management
    const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
    const [justificationModal, setJustificationModal] = useState<{
        isOpen: boolean;
        recordId: string | null;
        date: string | null;
    }>({ isOpen: false, recordId: null, date: null });

    // --- Photo Edit Logic ---
    const [isPhotoCropperOpen, setIsPhotoCropperOpen] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
    const [isPhotoUploading, setIsPhotoUploading] = useState(false);

    const handlePhotoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        const { isValidImageExtension, MAX_FILE_SIZE_BYTES } = await import('../utils/image');
        if (!isValidImageExtension(file.name)) {
            addToast('error', 'Formato inválido. Use JPG, PNG ou WEBP.');
            return;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            addToast('error', 'Arquivo muito grande (Máx 5MB).');
            return;
        }

        const reader = new FileReader();
        reader.addEventListener('load', () => {
            setSelectedPhoto(reader.result?.toString() || null);
            setIsPhotoCropperOpen(true);
        });
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handlePhotoCropComplete = async (croppedFile: File) => {
        if (!student) return;
        try {
            setIsPhotoUploading(true);
            const { processImage } = await import('../utils/image');
            const processedFile = await processImage(croppedFile);

            const timestamp = new Date().getTime();
            const filePath = `students/${student.id}/photo_${timestamp}.webp`;

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, processedFile, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);

            const { error: updateError } = await supabase
                .from('students')
                .update({ photo_url: publicUrl })
                .eq('id', student.id);

            if (updateError) throw updateError;

            setStudent({ ...student, photo_url: publicUrl });

            addToast('success', 'Foto atualizada com sucesso!');
            setIsPhotoCropperOpen(false);

        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro ao atualizar foto: ' + error.message);
        } finally {
            setIsPhotoUploading(false);
        }
    };


    // ... (rest of imports/setup)

    useEffect(() => {
        const fetchStudentAndRenewal = async () => {
            if (!id || !currentSchool) return;

            // 1. Fetch Student
            const { data: studentData, error: studentError } = await supabase
                .from('students')
                .select('*')
                .eq('id', id)
                .eq('school_id', currentSchool.id)
                .single();

            if (studentError) {
                console.error('Error fetching student:', studentError);
                addToast('error', 'Erro ao carregar aluno');
                navigate('/alunos');
                return;
            }
            setStudent(studentData);

            // 2. Check for Renewal Enrollment (Next Year)
            const { data: renewalData } = await supabase
                .from('enrollments')
                .select('id')
                .eq('student_id', id)
                .eq('academic_year', NEXT_YEAR)
                .neq('status', 'cancelled') // Ignore cancelled
                .maybeSingle();

            if (renewalData) {
                setRenewalEnrollmentId(renewalData.id);
            }

            setLoading(false);
        };
        fetchStudentAndRenewal();
    }, [id, navigate, addToast, NEXT_YEAR]);

    // Fetch Academic Data when tab is active
    useEffect(() => {
        if (activeTab === 'academic' && id) {
            const fetchAcademic = async () => {
                try {
                    // Define promise functions for cleaner execution
                    const startDate = `${contextYear}-01-01`;
                    const endDate = `${contextYear}-12-31`;

                    const fetchClassPromise = supabase
                        .from('class_enrollments')
                        .select('*, classes!inner(*)')
                        .eq('student_id', id)
                        .eq('classes.school_year', contextYear)
                        .maybeSingle();

                    const fetchAttendanceStatsPromise = supabase
                        .from('attendance_dashboard_view')
                        .select('*')
                        .eq('student_id', id)
                        .eq('school_year', contextYear)
                        .maybeSingle();

                    const fetchDetailedAttendancePromise = supabase
                        .from('student_attendance')
                        .select('id, status, justification, justification_document_url, justified_at, class_attendance_sheets!inner(date)')
                        .eq('student_id', id)
                        .gte('class_attendance_sheets.date', startDate)
                        .lte('class_attendance_sheets.date', endDate)
                        .order('date', { foreignTable: 'class_attendance_sheets', ascending: false });

                    const fetchReportsPromise = supabase
                        .from('daily_reports')
                        .select('*')
                        .eq('student_id', id)
                        .gte('date', startDate)
                        .lte('date', endDate)
                        .order('date', { ascending: false })
                        .limit(5);

                    const fetchGradesPromise = supabase
                        .from('student_grades')
                        .select('*, grade_books!inner(date, title, subject, max_score)')
                        .eq('student_id', id)
                        .gte('grade_books.date', startDate)
                        .lte('grade_books.date', endDate);

                    // Execute all in parallel
                    const [
                        { data: classData },
                        { data: attendanceViewData },
                        { data: detailedAttendance },
                        { data: reportsData },
                        { data: gradesData }
                    ] = await Promise.all([
                        fetchClassPromise,
                        fetchAttendanceStatsPromise,
                        fetchDetailedAttendancePromise,
                        fetchReportsPromise,
                        fetchGradesPromise
                    ]);

                    const stats = {
                        total: attendanceViewData?.total_records || 0,
                        present: attendanceViewData?.present_count || 0,
                        absent: attendanceViewData?.absent_count || 0,
                        justified: attendanceViewData?.justified_count || 0
                    };

                    // Map detailed records
                    const mappedRecords = detailedAttendance?.map((record: any) => ({
                        id: record.id,
                        date: record.class_attendance_sheets.date,
                        status: record.status,
                        justification: record.justification,
                        justification_document_url: record.justification_document_url,
                        justified_at: record.justified_at
                    })) || [];

                    setAttendanceRecords(mappedRecords);

                    setAcademicData({
                        currentClass: classData?.classes || null,
                        attendance: stats,
                        reports: reportsData || [],
                        grades: gradesData || [],
                        loading: false
                    });

                } catch (error) {
                    console.error("Error fetching academic data:", error);
                }
            };
            fetchAcademic();
        }
    }, [activeTab, id, contextYear]);
    // ...
    // ... in return JSX ...
    <div className="mb-4">
        <p className="text-brand-200 text-xs uppercase tracking-wider font-bold">Status Atual</p>
        <p className="text-2xl font-bold">Matriculado</p>
        <p className="text-brand-300 text-sm">Ano Letivo {contextYear}</p>
    </div>

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
            </div>
        );
    }

    if (!student) return null;

    const TabButton = ({ id, label, icon: Icon }: any) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${activeTab === id
                ? 'border-brand-600 text-brand-600 font-medium bg-brand-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/alunos')}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                    </Button>
                    <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-full bg-gray-100 border-2 border-white shadow-md overflow-hidden flex-shrink-0 relative ${canChangePhoto ? 'group' : ''}`}>
                            {canChangePhoto && (
                                <>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        id="profile-photo-upload"
                                        onChange={handlePhotoFileSelect}
                                        disabled={isPhotoUploading}
                                    />

                                    <label
                                        htmlFor="profile-photo-upload"
                                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                                        title="Alterar Foto"
                                    >
                                        {isPhotoUploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
                                    </label>
                                </>
                            )}


                            {/* Fallback Initial */}
                            <div className="absolute inset-0 flex items-center justify-center bg-brand-100 text-brand-700 font-bold text-2xl z-0">
                                {student.name.charAt(0)}
                            </div>

                            {/* Image */}
                            {student.photo_url && (
                                <img
                                    src={student.photo_url}
                                    alt={student.name}
                                    className="w-full h-full object-cover relative z-1"
                                    onError={(e) => e.currentTarget.style.display = 'none'}
                                />
                            )}
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{student.name}</h1>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium uppercase">
                                    {student.status}
                                </span>
                                <span>• ID: {student.id.split('-')[0]}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => addToast('info', 'Em breve: Histórico')}>
                        <FileText className="w-4 h-4 mr-2" /> Histórico
                    </Button>

                    {renewalEnrollmentId ? (
                        <Button
                            className="bg-green-600 hover:bg-green-700 shadow-lg"
                            onClick={() => navigate(`/matriculas/${renewalEnrollmentId}`)}
                        >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Ver Matrícula {NEXT_YEAR}
                        </Button>
                    ) : (
                        (() => {
                            const targetYearObj = years.find(y => parseInt(y.year) === NEXT_YEAR);
                            const canRenew = hasModule('academic') && targetYearObj && ['active', 'planning'].includes(targetYearObj.status);

                            if (!canRenew) return null;

                            return (
                                <Button
                                    disabled={loading}
                                    onClick={async () => {
                                        const isConfirmed = await confirm({
                                            title: 'Confirmar Renovação',
                                            message: `Deseja iniciar a renovação de matrícula para ${NEXT_YEAR}?`,
                                            confirmText: `Sim, Renovar`,
                                            type: 'success'
                                        });

                                        if (!isConfirmed) return;

                                        setLoading(true);
                                        try {
                                            // Map Student Data to Enrollment Details format
                                            const renewalDetails = {
                                                enrollment_type: 'renewal',
                                                student_cpf: student.cpf,
                                                rg: student.rg,
                                                birth_date: student.birth_date,
                                                // Address
                                                zip_code: student.address?.zip_code,
                                                address: student.address?.street,
                                                address_number: student.address?.number,
                                                neighbor: student.address?.neighbor,
                                                city: student.address?.city,
                                                state: student.address?.state,
                                                complement: student.address?.complement,
                                                // Health
                                                blood_type: student.health_info?.blood_type,
                                                allergies: student.health_info?.allergies,
                                                health_insurance: student.health_info?.health_insurance,
                                                health_insurance_number: student.health_info?.health_insurance_number,
                                                // Responsible
                                                parent_name: student.financial_responsible?.name,
                                                parent_cpf: student.financial_responsible?.cpf,
                                                parent_phone: student.financial_responsible?.phone,
                                            };

                                            const { data, error } = await supabase
                                                .from('enrollments')
                                                .insert({
                                                    student_id: student.id,
                                                    academic_year: NEXT_YEAR, // Explicitly set next year
                                                    candidate_name: student.name,
                                                    parent_email: student.financial_responsible?.email,
                                                    status: 'draft',
                                                    details: renewalDetails
                                                })
                                                .select()
                                                .single();

                                            if (error) throw error;

                                            addToast('success', `Renovação para ${NEXT_YEAR} iniciada!`);
                                            navigate(`/matriculas/${data.id}`);

                                        } catch (err: any) {
                                            console.error(err);
                                            addToast('error', 'Erro ao iniciar renovação: ' + err.message);
                                            setLoading(false);
                                        }
                                    }}
                                    className="bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-600/20"
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Renovar para {NEXT_YEAR}
                                </Button>
                            );
                        })()
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-gray-200 flex overflow-x-auto">
                <TabButton id="personal" label="Dados Pessoais" icon={User} />
                {hasModule('academic') && <TabButton id="academic" label="Acadêmico" icon={GraduationCap} />}
                <TabButton id="health" label="Saúde" icon={Heart} />
                {hasModule('finance') && <TabButton id="financial" label="Financeiro" icon={Shield} />}
            </div>


            {/* Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column (Main Info) */}
                <div className="lg:col-span-2 space-y-6">

                    {activeTab === 'personal' && (
                        <div className="space-y-6 animate-fade-in">
                            <Card className="p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                    <User className="w-5 h-5 mr-2 text-brand-600" /> Identificação
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Nome Completo</label>
                                        <p className="text-gray-900 font-medium">{student.name}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Data de Nascimento</label>
                                        <p className="text-gray-900">{new Date(student.birth_date).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">CPF</label>
                                        <p className="text-gray-900 font-mono">{maskSensitiveData(student.cpf)}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">RG</label>
                                        <p className="text-gray-900 font-mono">{maskSensitiveData(student.rg)}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Sexo</label>
                                        <p className="text-gray-900">{student.gender || '-'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Raça / Cor</label>
                                        <p className="text-gray-900">{student.race || '-'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Nacionalidade</label>
                                        <p className="text-gray-900">{student.nationality || '-'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Naturalidade</label>
                                        <p className="text-gray-900">{student.birth_city || '-'}</p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                    <MapPin className="w-5 h-5 mr-2 text-brand-600" /> Endereço
                                </h3>
                                {/* Address Parsing */}
                                {student.address ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="text-xs font-medium text-gray-500 uppercase">Logradouro</label>
                                            <p className="text-gray-900">{student.address.street}, {student.address.number}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">Bairro</label>
                                            <p className="text-gray-900">{student.address.neighbor}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">Cidade/UF</label>
                                            <p className="text-gray-900">{student.address.city} - {student.address.state}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">CEP</label>
                                            <p className="text-gray-900 font-mono">{student.address.zip_code}</p>
                                        </div>
                                    </div>
                                ) : <p className="text-gray-400 italic">Endereço não cadastrado.</p>}
                            </Card>
                        </div>
                    )}

                    {activeTab === 'health' && (
                        <div className="space-y-6 animate-fade-in">
                            <Card className="p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                    <Heart className="w-5 h-5 mr-2 text-red-500" /> Saúde Geral
                                </h3>
                                {student.health_info ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                                                <label className="text-xs font-bold text-red-800 uppercase block mb-1">Tipo Sanguíneo</label>
                                                <div className="flex items-center gap-2">
                                                    <Droplet className="w-5 h-5 text-red-600" />
                                                    <p className="text-xl font-bold text-red-900">{student.health_info.blood_type || '?'}</p>
                                                </div>
                                            </div>
                                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                                <label className="text-xs font-bold text-blue-800 uppercase block mb-1">Plano de Saúde</label>
                                                <div className="flex items-center gap-2">
                                                    <Shield className="w-5 h-5 text-blue-600" />
                                                    <p className="text-blue-900 font-medium">{student.health_info.health_insurance || 'Não possui'}</p>
                                                </div>
                                                {student.health_info.health_insurance_number && (
                                                    <p className="text-xs text-blue-700 mt-1 font-mono">Cart: {student.health_info.health_insurance_number}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase block mb-2">Alergias</label>
                                            {student.health_info.allergies && (Array.isArray(student.health_info.allergies) ? student.health_info.allergies.length > 0 : student.health_info.allergies) ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {Array.isArray(student.health_info.allergies) ? (
                                                        student.health_info.allergies.map((item: any, i: number) => {
                                                            const isObj = typeof item === 'object' && item !== null;
                                                            return (
                                                                <span key={i} className="inline-flex flex-col px-2 py-1.5 rounded bg-red-100 text-red-800 text-xs font-bold border border-red-200">
                                                                    <div className="flex items-center gap-1">
                                                                        <AlertTriangle className="w-3 h-3" />
                                                                        {isObj ? item.allergy : item}
                                                                    </div>
                                                                    {isObj && (item.reaction || item.severity) && (
                                                                        <div className="text-[10px] opacity-75 font-normal mt-0.5 leading-tight">
                                                                            {item.reaction && <span>Reação: {item.reaction}</span>}
                                                                            {item.severity && <span className="ml-1 px-1 rounded bg-red-200/50">{item.severity}</span>}
                                                                        </div>
                                                                    )}
                                                                </span>
                                                            );
                                                        })
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-1 rounded bg-red-100 text-red-800 text-xs font-bold border border-red-200">
                                                            <AlertTriangle className="w-3 h-3 mr-1" /> {student.health_info.allergies}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-gray-500 italic text-sm">Nenhuma alergia relatada.</div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {student.health_info.medications_allowed && student.health_info.medications_allowed.length > 0 && (
                                                <div>
                                                    <label className="text-xs font-medium text-gray-500 uppercase block mb-2">Medicamentos Permitidos</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {student.health_info.medications_allowed.map((item: any, i: number) => {
                                                            const isObj = typeof item === 'object' && item !== null;
                                                            return (
                                                                <span key={i} className="inline-flex flex-col px-2 py-1.5 rounded bg-green-100 text-green-800 text-xs font-bold border border-green-200">
                                                                    <div className="flex items-center gap-1">
                                                                        <CheckCircle className="w-3 h-3" />
                                                                        {isObj ? item.name : item}
                                                                    </div>
                                                                    {isObj && (item.dosage || item.trigger) && (
                                                                        <div className="text-[10px] opacity-75 font-normal mt-0.5 leading-tight">
                                                                            {item.dosage && <span>{item.dosage}</span>}
                                                                            {item.trigger && <span className="block italic">Causa: {item.trigger}</span>}
                                                                        </div>
                                                                    )}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {student.health_info.medications_restricted && student.health_info.medications_restricted.length > 0 && (
                                                <div>
                                                    <label className="text-xs font-medium text-gray-500 uppercase block mb-2">Medicamentos Restritos</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {student.health_info.medications_restricted.map((item: any, i: number) => {
                                                            const isObj = typeof item === 'object' && item !== null;
                                                            return (
                                                                <span key={i} className="inline-flex flex-col px-2 py-1.5 rounded bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200">
                                                                    <div className="flex items-center gap-1">
                                                                        <Ban className="w-3 h-3" />
                                                                        {isObj ? item.name : item}
                                                                    </div>
                                                                    {isObj && item.reason && (
                                                                        <div className="text-[10px] opacity-75 font-normal mt-0.5 italic leading-tight">
                                                                            Motivo: {item.reason}
                                                                        </div>
                                                                    )}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>


                                        {student.health_info.health_observations && (
                                            <div>
                                                <label className="text-xs font-medium text-gray-500 uppercase block mb-1">Observações Gerais</label>
                                                <div className="bg-gray-50 text-gray-700 p-3 rounded-md border border-gray-100 flex items-start gap-2 text-sm italic">
                                                    <Activity className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                                                    {student.health_info.health_observations}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : <p className="text-gray-400">Sem dados de saúde.</p>}
                            </Card>

                            {/* Habits Dashboard */}
                            {student.health_info?.habits && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                        <Activity className="w-5 h-5 mr-2 text-brand-600" /> Rotina e Hábitos
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Card className="p-5 border-l-4 border-l-purple-400">
                                            <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <Moon className="w-4 h-4 text-purple-600" /> Sono
                                            </h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between border-b border-purple-50 pb-1">
                                                    <span className="text-gray-500">Horário de Dormir</span>
                                                    <span className="font-medium">{student.health_info.habits.sleep?.bedtime || '-'}</span>
                                                </div>
                                                <div className="flex justify-between pt-1">
                                                    <span className="text-gray-500">Acorda à noite?</span>
                                                    <span className="font-medium capitalize">{student.health_info.habits.sleep?.wakes_up || '-'}</span>
                                                </div>
                                            </div>
                                        </Card>

                                        <Card className="p-5 border-l-4 border-l-orange-400">
                                            <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <Utensils className="w-4 h-4 text-orange-600" /> Alimentação
                                            </h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between border-b border-orange-50 pb-1">
                                                    <span className="text-gray-500">Apetite</span>
                                                    <span className="font-medium capitalize">{student.health_info.habits.food?.appetite || '-'}</span>
                                                </div>
                                                <div className="pt-1">
                                                    <span className="text-gray-500 block mb-1">Restrições:</span>
                                                    <span className="font-medium bg-orange-50 px-2 py-1 rounded block text-orange-800 text-xs">
                                                        {student.health_info.habits.food?.restrictions || 'Nenhuma'}
                                                    </span>
                                                </div>
                                            </div>
                                        </Card>

                                        <Card className="p-5 border-l-4 border-l-cyan-400">
                                            <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <Smile className="w-4 h-4 text-cyan-600" /> Higiene
                                            </h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Usa Fraldas?</span>
                                                    <span className="font-medium capitalize">{student.health_info.habits.hygiene?.diapers || '-'}</span>
                                                </div>
                                            </div>
                                        </Card>

                                        <Card className="p-5 border-l-4 border-l-pink-400">
                                            <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <Users className="w-4 h-4 text-pink-600" /> Social
                                            </h4>
                                            <div className="space-y-2 text-sm">
                                                <div>
                                                    <span className="text-gray-500 block mb-1">Comportamento:</span>
                                                    <span className="font-medium text-gray-800 italic">
                                                        "{student.health_info.habits.social?.behavior || '-'}"
                                                    </span>
                                                </div>
                                            </div>
                                        </Card>
                                    </div>
                                </div>
                            )}

                            {/* Authorized Pickups */}
                            {student.health_info?.authorized_pickups && student.health_info.authorized_pickups.length > 0 && (
                                <div className="mt-8">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                        <Users className="w-5 h-5 mr-2 text-brand-600" /> Pessoas Autorizadas a Buscar
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {student.health_info.authorized_pickups.map((person: any, idx: number) => (
                                            <Card key={idx} className="p-4 bg-gray-50/50 border border-gray-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-700">
                                                        <User className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900">{person.name}</p>
                                                        <p className="text-xs text-gray-500">{person.phone} {person.kinship ? `• ${person.kinship}` : ''}</p>
                                                    </div>
                                                </div>
                                                {person.cpf && (
                                                    <p className="mt-2 text-[10px] text-gray-400 font-mono uppercase">CPF: {maskSensitiveData(person.cpf)}</p>
                                                )}
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}


                    {activeTab === 'financial' && (
                        <Card className="p-6 animate-fade-in">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                <Shield className="w-5 h-5 mr-2 text-green-600" /> Responsável Financeiro
                            </h3>
                            {student.financial_responsible ? (
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                            <User className="w-5 h-5 text-green-700" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">{student.financial_responsible.name}</p>
                                            <p className="text-xs text-gray-500">Principal Pagador</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-6 text-sm">
                                        <div>
                                            <p className="text-gray-500 font-medium uppercase text-[10px]">CPF</p>
                                            <p className="font-mono text-gray-700">{maskSensitiveData(student.financial_responsible.cpf)}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 font-medium uppercase text-[10px]">Email</p>
                                            <p className="text-gray-700">{student.financial_responsible.email}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 font-medium uppercase text-[10px]">Telefone</p>
                                            <p className="text-gray-700">{student.financial_responsible.phone}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 font-medium uppercase text-[10px]">RG</p>
                                            <p className="text-gray-700">{maskSensitiveData(student.financial_responsible.rg)}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 font-medium uppercase text-[10px]">Data de Nascimento</p>
                                            <p className="text-gray-700">{student.financial_responsible.birth_date ? new Date(student.financial_responsible.birth_date).toLocaleDateString('pt-BR') : '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 font-medium uppercase text-[10px]">Nacionalidade</p>
                                            <p className="text-gray-700">{student.financial_responsible.nationality || '-'}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : <p className="text-gray-400">Responsável financeiro não definido.</p>}
                        </Card>
                    )}

                    {activeTab === 'academic' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Enrollment & Class Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="p-4 border-l-4 border-l-brand-500">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Turma Atual</h4>
                                    <div className="flex items-center gap-3">
                                        <div className="bg-brand-100 p-2 rounded-lg">
                                            <GraduationCap className="w-5 h-5 text-brand-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-lg">
                                                {academicData.currentClass ? academicData.currentClass.name : 'Sem Turma'}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {academicData.currentClass ? `Sala ${academicData.currentClass.room || 'Principal'}` : 'Não enturmado'}
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                                <Card className="p-4 border-l-4 border-l-green-500">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Frequência Global</h4>
                                    <div className="flex items-center gap-4">
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-green-600">
                                                {academicData.attendance?.total ? Math.round(((academicData.attendance.present + academicData.attendance.justified) / academicData.attendance.total) * 100) : 0}%
                                            </p>
                                            <p className="text-[10px] text-gray-400 uppercase">Presença</p>
                                        </div>
                                        <div className="h-8 w-px bg-gray-200"></div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">{academicData.attendance?.absent || 0} Faltas</p>
                                            <p className="text-xs text-gray-500">Justificadas: {academicData.attendance?.justified || 0}</p>
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            {/* Recent Daily Reports */}
                            <Card className="p-0 overflow-hidden">
                                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                        <RefreshCw className="w-4 h-4 text-brand-600" />
                                        Últimos Diários
                                    </h3>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {academicData.reports.length === 0 ? (
                                        <div className="p-8 text-center text-gray-400 text-sm">
                                            Nenhum diário registrado recentemente.
                                        </div>
                                    ) : (
                                        academicData.reports.map((report: any, i: number) => {
                                            // Fix Date Timezone: Treat YYYY-MM-DD as simple string or UTC
                                            // Splitting "2023-12-29" -> [2023, 11, 29]
                                            const [y, m, d] = report.date.split('-').map(Number);
                                            const date = new Date(y, m - 1, d); // Local time construction from parts

                                            const data = report.routine_data || {};
                                            return (
                                                <div key={i} className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
                                                    <div className="flex-col items-center text-center min-w-[3rem]">
                                                        <span className="text-xs font-bold text-gray-400 uppercase block mb-1">
                                                            {date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                                                        </span>
                                                        <span className="text-xl font-bold text-brand-700 block leading-none">
                                                            {date.getDate()}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex gap-2 flex-wrap">
                                                            {data.mood && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                                                                    {data.mood}
                                                                </span>
                                                            )}
                                                            {data.meals?.lunch && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                                                                    Almoço: {data.meals.lunch}
                                                                </span>
                                                            )}
                                                            {data.meals?.snack && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                                                                    Lanche: {data.meals.snack}
                                                                </span>
                                                            )}
                                                            {data.sleep?.nap && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
                                                                    Sono: {data.sleep.nap}
                                                                </span>
                                                            )}
                                                            {data.hygiene && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-700 border border-cyan-200">
                                                                    Higiene: {typeof data.hygiene === 'object'
                                                                        ? `${data.hygiene.status || ''}${data.hygiene.diapers ? ` (${data.hygiene.diapers} trocas)` : ''}`
                                                                        : data.hygiene}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-600 line-clamp-2">
                                                            {report.observations || report.activities || "Sem observações."}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </Card>

                            {/* Grades Summary */}
                            {academicData.grades.length > 0 && (
                                <Card className="p-6">
                                    <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-brand-600" />
                                        Desempenho
                                    </h3>
                                    <div className="space-y-4">
                                        {academicData.grades.map((item: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-4">
                                                <div className="w-1/3">
                                                    <p className="text-sm font-medium text-gray-700 truncate">
                                                        {item.grade_books?.title || item.grade_books?.subject || 'Atividade'}
                                                    </p>
                                                </div>
                                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${Number(item.score) >= 7 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                        style={{ width: `${(Number(item.score) / (item.grade_books?.max_score || 10)) * 100}%` }}
                                                    ></div>
                                                </div>
                                                <div className="w-12 text-right font-bold text-gray-900">{item.score}</div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}

                            {/* Detailed Attendance Management */}
                            <AttendanceDetailTable
                                records={attendanceRecords}
                                onJustify={(recordId) => {
                                    const record = attendanceRecords.find(r => r.id === recordId);
                                    if (record) {
                                        setJustificationModal({
                                            isOpen: true,
                                            recordId: recordId,
                                            date: record.date
                                        });
                                    }
                                }}
                                loading={academicData.loading}
                            />
                        </div>
                    )}

                </div>

                {/* Right Column (Sidebar Actions) */}
                <div className="space-y-6">
                    <div className="mb-6">
                        <DigitalStudentId
                            student={{
                                name: student.name,
                                id: student.id,
                                photo_url: student.photo_url,
                                grade: academicData.currentClass?.name,
                                status: 'Matriculado' // Default para esta visão
                            }}
                            schoolYear={contextYear}
                            schoolName={currentSchool?.name}
                        />
                    </div>


                    <Card className="p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Ações Rápidas</h4>
                        <div className="space-y-2">
                            <Button
                                variant="outline"
                                className="w-full justify-start text-xs h-9"
                                onClick={() => student.financial_responsible?.email && (window.location.href = `mailto:${student.financial_responsible.email}`)}
                                disabled={!student.financial_responsible?.email}
                            >
                                <Mail className="w-3.5 h-3.5 mr-2" />
                                {student.financial_responsible?.email ? 'Enviar Email' : 'Email não cadastrado'}
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full justify-start text-xs h-9 text-green-600 border-green-200 hover:bg-green-50"
                                onClick={() => {
                                    if (student.financial_responsible?.phone) {
                                        const phone = student.financial_responsible.phone.replace(/\D/g, '');
                                        window.open(`https://wa.me/55${phone}`, '_blank');
                                    }
                                }}
                                disabled={!student.financial_responsible?.phone}
                            >
                                <MessageCircle className="w-3.5 h-3.5 mr-2" />
                                WhatsApp
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full justify-start text-xs h-9"
                                onClick={() => student.financial_responsible?.phone && (window.location.href = `tel:${student.financial_responsible.phone.replace(/\D/g, '')}`)}
                                disabled={!student.financial_responsible?.phone}
                            >
                                <Phone className="w-3.5 h-3.5 mr-2" /> Contatar Responsável
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Justification Modal */}
            {justificationModal.isOpen && justificationModal.recordId && justificationModal.date && (
                <JustificationModal
                    isOpen={justificationModal.isOpen}
                    onClose={() => setJustificationModal({ isOpen: false, recordId: null, date: null })}
                    attendanceRecordId={justificationModal.recordId}
                    studentId={id!}
                    date={justificationModal.date}
                    onSuccess={async () => {
                        // Refetch academic data to update stats and records
                        if (activeTab === 'academic' && id) {
                            const startDate = `${contextYear}-01-01`;
                            const endDate = `${contextYear}-12-31`;

                            // Refetch attendance stats (KPI Parity via View)
                            const { data: attendanceViewData } = await supabase
                                .from('attendance_dashboard_view')
                                .select('*')
                                .eq('student_id', id)
                                .eq('school_year', contextYear)
                                .maybeSingle();

                            const stats = {
                                total: attendanceViewData?.total_records || 0,
                                present: attendanceViewData?.present_count || 0,
                                absent: attendanceViewData?.absent_count || 0,
                                justified: attendanceViewData?.justified_count || 0
                            };

                            // Refetch detailed records
                            const { data: detailedAttendance } = await supabase
                                .from('student_attendance')
                                .select('id, status, justification, justification_document_url, justified_at, class_attendance_sheets!inner(date)')
                                .eq('student_id', id)
                                .gte('class_attendance_sheets.date', startDate)
                                .lte('class_attendance_sheets.date', endDate)
                                .order('date', { foreignTable: 'class_attendance_sheets', ascending: false });

                            const mappedRecords = detailedAttendance?.map((record: any) => ({
                                id: record.id,
                                date: record.class_attendance_sheets.date,
                                status: record.status,
                                justification: record.justification,
                                justification_document_url: record.justification_document_url,
                                justified_at: record.justified_at
                            })) || [];

                            setAttendanceRecords(mappedRecords);
                            setAcademicData(prev => ({ ...prev, attendance: stats }));
                        }
                    }}
                />
            )}

            {/* Photo Cropper */}
            <ImageCropperModal
                isOpen={isPhotoCropperOpen}
                imageSrc={selectedPhoto}
                onClose={() => setIsPhotoCropperOpen(false)}
                onCropComplete={handlePhotoCropComplete}
            />

        </div>
    );
};
