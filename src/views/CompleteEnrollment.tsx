import { type FC, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Button, Card, Input, Select } from '../components/ui';
import { cn } from '../components/ui/Button';
import {
    Loader2, CheckCircle, Upload, Clock, GraduationCap, Heart,
    FileWarning, RefreshCw, Trash2, Users, FileText, CheckCircle2, AlertCircle, Building, Hash, Calendar, Mail, Search, MapPin, Globe, Info, User, Droplet, Shield, Activity, PartyPopper
} from 'lucide-react';
import { PhoneInput } from '../components/ui';
import { isValidCPF, formatCPF } from '../utils/validators';
import { useToast } from '../contexts/ToastContext';
import { ImageCropperModal } from '../components/ui/ImageCropperModal';

// ... (Interfaces remain same)
interface Allergy {
    allergy: string;
    severity: string;
    reaction: string;
}

interface MedicationAllowed {
    name: string;
    dosage: string;
    trigger: string;
}

interface MedicationRestricted {
    name: string;
    reason: string;
}

export const CompleteEnrollmentView: FC = () => {
    const { token } = useParams<{ token: string }>();
    const { addToast } = useToast();

    // State
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState(1); // Wizard Steps
    const [enrollment, setEnrollment] = useState<any>(null);
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [docTemplates, setDocTemplates] = useState<any[]>([]);

    // Cropper State
    const [isCropperOpen, setIsCropperOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [pendingUploadDocId, setPendingUploadDocId] = useState<string | null>(null);

    // Retrieve 'enrollment_docs_template' (default fallback)
    const DEFAULT_DOCS = [
        { id: 'student_id', label: 'Certidão de Nascimento / RG do Aluno', required: true },
        { id: 'parent_id', label: 'RG / CPF do Responsável', required: true },
        { id: 'residency', label: 'Comprovante de Residência', required: true },
        { id: 'vaccination', label: 'Carteira de Vacinação', required: true },
        { id: 'transfer', label: 'Declaração de Transferência / Histórico', required: true },
        { id: 'photo', label: 'Foto 3x4 do Aluno', required: true }
    ];

    // Portal Logic
    const isDraft = enrollment?.status === 'draft';
    const isApproved = enrollment?.status === 'approved' || enrollment?.status === 'completed';
    // Check for rejected documents regardless of enrollment status (unless approved)
    const rejectedDocs = enrollment?.details?.documents ?
        Object.entries(enrollment.details.documents).filter(([_, doc]: any) => doc.status === 'rejected') : [];
    const hasIssues = rejectedDocs.length > 0 && !isApproved;

    // Derived Mode
    const mode = isDraft ? 'wizard' : isApproved ? 'success' : hasIssues ? 'action_required' : 'analysis';

    const uploadFile = async (file: File, docId: string) => {
        try {
            setUploading(true);
            const filePath = `enrollments/${enrollment.id}/${docId}_${file.name}`;

            // 1. Upload
            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // 2. Update Details
            const existingDoc = enrollment.details?.documents?.[docId] || {};
            const newDocMetadata = {
                ...existingDoc,
                status: 'uploaded', // Reset status to uploaded (pending review)
                file_path: filePath,
                file_name: file.name,
                uploaded_at: new Date().toISOString(),
                rejection_reason: null // Clear previous rejection reason
            };

            const newDetails = {
                ...(enrollment.details || {}),
                documents: {
                    ...(enrollment.details?.documents || {}),
                    [docId]: newDocMetadata
                }
            };

            await supabase.from('enrollments').update({ details: newDetails }).eq('id', enrollment.id);

            // Update local state
            setEnrollment({ ...enrollment, details: newDetails });

            // 3. Log History
            await supabase.from('enrollment_history').insert({
                enrollment_id: enrollment.id,
                school_id: enrollment.school_id,
                action_type: 'UPLOAD',
                title: 'Documento Enviado',
                description: `O responsável enviou o documento: ${docId.replace(/_/g, ' ')}`,
                metadata: { doc_id: docId, file_name: file.name }
            });

            // 4. Notify Admin
            await supabase.rpc('create_admin_notification', {
                p_title: 'Documento Reenviado',
                p_message: `O responsável reenviou o documento: ${docId}`,
                p_link: `/matriculas/${enrollment.id}`,
                p_enrollment_id: enrollment.id
            });

            addToast('success', 'Documento enviado com sucesso!');

        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro no upload: ' + error.message);
        } finally {
            setUploading(false);
            setPendingUploadDocId(null);
            setSelectedImage(null); // Clear cropper state
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docId: string) => {
        if (!e.target.files || e.target.files.length === 0 || !enrollment) return;
        let file = e.target.files[0];
        e.target.value = ''; // Reset input to allow re-selection of same file

        try {
            // Photo Validation & Optimization
            if (docId === 'photo') {
                const { isValidImageExtension, MAX_FILE_SIZE_BYTES } = await import('../utils/image');

                if (!isValidImageExtension(file.name)) {
                    addToast('error', 'Formato de arquivo inválido. Apenas imagens (JPG, PNG, WEBP) são permitidas para a foto.');
                    return;
                }

                if (file.size > MAX_FILE_SIZE_BYTES) {
                    addToast('error', 'O arquivo excede o tamanho máximo permitido de 5MB.');
                    return;
                }

                // Instead of processing immediately, open Cropper
                const reader = new FileReader();
                reader.addEventListener('load', () => {
                    setSelectedImage(reader.result?.toString() || null);
                    setPendingUploadDocId(docId);
                    setIsCropperOpen(true);
                });
                reader.readAsDataURL(file);

                return; // Stop here, wait for crop
            } else {
                // Generic Validation for other docs
                const MAX_SIZE = 5 * 1024 * 1024; // 5MB
                if (file.size > MAX_SIZE) {
                    addToast('error', 'Arquivo muito grande! O tamanho máximo permitido é 5MB.');
                    return;
                }

                const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'image/webp'];
                if (!ALLOWED_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
                    addToast('error', 'Formato inválido! Permitido apenas imagens (JPG, PNG, WEBP) ou PDF.');
                    return;
                }

                // Direct Upload for non-photos
                await uploadFile(file, docId);
            }

        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro: ' + error.message);
        }
    };

    const handleCropComplete = async (croppedFile: File) => {
        if (!pendingUploadDocId) return;

        try {
            // Process (resize/webp) the cropped image
            const { processImage } = await import('../utils/image');
            const processedFile = await processImage(croppedFile); // This ensures it's WebP and optimized

            await uploadFile(processedFile, pendingUploadDocId);
            setIsCropperOpen(false);
        } catch (e: any) {
            addToast('error', 'Erro ao processar imagem recortada: ' + e.message);
        }
    };

    // ... rest of component


    // Form Data Helpers
    const [formData, setFormData] = useState<any>({
        student_name: '',
        student_cpf: '',
        birth_date: '',
        rg: '',
        rg_issuing_body: '',
        blood_type: '',
        allergies: [] as Allergy[],
        medications_allowed: [] as MedicationAllowed[],
        medications_restricted: [] as MedicationRestricted[],
        health_insurance: '',
        health_insurance_number: '',
        health_observations: '',
        habits: {
            sleep: { bedtime: '', wakes_up: '' },
            food: { restrictions: '', appetite: '' },
            hygiene: { diapers: '' },
            social: { behavior: '' }
        },

        gender: '',
        race: '',
        nationality: 'Brasileira',
        place_of_birth: '',

        parent_name: '',
        parent_cpf: '',
        parent_rg: '',
        parent_rg_issuing_body: '',
        parent_gender: '',
        parent_race: '',
        parent_nationality: 'Brasileira',
        parent_place_of_birth: '',
        parent_birth_date: '',
        parent_email: '',
        phone: '',

        zip_code: '',
        address: '',
        address_number: '',
        neighbor: '',
        city: '',
        state: '',
        complement: '',

        authorized_pickups: []
    });

    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchEnrollment = async () => {
            if (!token) return;
            try {
                const { data, error } = await supabase
                    .from('enrollments')
                    .select('*')
                    .eq('invite_token', token)
                    .single();

                if (error || !data) throw new Error('Convite inválido ou expirado.');

                // Fetch Dynamic Doc Templates using school_id from enrollment
                // Note: In a real multi-tenant scenario we might need to query by school_id
                // Since enrollment has a school_id (implied), we fetch settings for that school.
                let templates = DEFAULT_DOCS;
                if (data.school_id) {
                    const { data: settingsData } = await supabase
                        .from('app_settings')
                        .select('value')
                        .eq('school_id', data.school_id)
                        .eq('key', 'enrollment_docs_template')
                        .maybeSingle();

                    if (settingsData?.value) {
                        let val = settingsData.value;
                        let attempts = 0;
                        while (typeof val === 'string' && attempts < 3) {
                            try {
                                val = JSON.parse(val);
                            } catch (e) {
                                console.error('Error parsing doc templates:', e);
                                break;
                            }
                            attempts++;
                        }

                        if (Array.isArray(val)) {
                            templates = val;
                        }
                    }
                }
                setDocTemplates(templates);

                setEnrollment(data);

                // Map database details to form structure
                // Priority: Existing details > Defaults
                const details = data.details || {};

                setFormData({
                    student_name: data.candidate_name,
                    student_cpf: details.student_cpf || '',
                    birth_date: details.birth_date || '',
                    rg: details.rg || '',
                    rg_issuing_body: details.rg_issuing_body || '',
                    blood_type: details.blood_type || '',
                    allergies: Array.isArray(details.allergies)
                        ? details.allergies.map((a: any) => typeof a === 'string' ? { allergy: a, severity: 'leve', reaction: '' } : a)
                        : [],
                    medications_allowed: Array.isArray(details.medications_allowed)
                        ? details.medications_allowed.map((m: any) => typeof m === 'string' ? { name: m, dosage: '', trigger: '' } : m)
                        : [],
                    medications_restricted: Array.isArray(details.medications_restricted)
                        ? details.medications_restricted.map((m: any) => typeof m === 'string' ? { name: m, reason: '' } : m)
                        : [],
                    health_insurance: details.health_insurance || '',
                    health_insurance_number: details.health_insurance_number || '',
                    health_observations: details.health_observations || details.medications || '',
                    habits: {
                        sleep: {
                            bedtime: details.habits?.sleep?.bedtime || '',
                            wakes_up: details.habits?.sleep?.wakes_up || ''
                        },
                        food: {
                            restrictions: details.habits?.food?.restrictions || '',
                            appetite: details.habits?.food?.appetite || ''
                        },
                        hygiene: {
                            diapers: details.habits?.hygiene?.diapers || ''
                        },
                        social: {
                            behavior: details.habits?.social?.behavior || ''
                        }
                    },

                    gender: details.gender || '',
                    race: details.race || '',
                    nationality: details.nationality || 'Brasileira',
                    place_of_birth: details.place_of_birth || '',

                    parent_name: data.parent_name || details.parent_name || '',
                    parent_cpf: details.parent_cpf || '',
                    parent_rg: details.parent_rg || '',
                    parent_rg_issuing_body: details.parent_rg_issuing_body || '',
                    parent_gender: details.parent_gender || '',
                    parent_race: details.parent_race || '',
                    parent_nationality: details.parent_nationality || 'Brasileira',
                    parent_place_of_birth: details.parent_place_of_birth || '',
                    parent_birth_date: details.parent_birth_date || '',
                    parent_email: data.parent_email || details.parent_email,
                    phone: data.parent_phone || details.parent_phone || '',

                    zip_code: details.zip_code || '',
                    address: details.address || '',
                    address_number: details.address_number || '',
                    neighbor: details.neighbor || '',
                    city: details.city || '',
                    state: details.state || '',
                    complement: details.complement || '',

                    authorized_pickups: details.authorized_pickups || []
                });
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchEnrollment();
    }, [token]);


    // Pickup Handlers
    const addPickupPerson = () => {
        setFormData((prev: any) => ({
            ...prev,
            authorized_pickups: [...(prev.authorized_pickups || []), { name: '', relation: '', cpf: '' }]
        }));
    };

    const removePickupPerson = (index: number) => {
        setFormData((prev: any) => {
            const newPickups = [...(prev.authorized_pickups || [])];
            newPickups.splice(index, 1);
            return { ...prev, authorized_pickups: newPickups };
        });
    };

    const updatePickupPerson = (index: number, field: string, value: string) => {
        setFormData((prev: any) => {
            const newPickups = [...(prev.authorized_pickups || [])];
            newPickups[index] = { ...newPickups[index], [field]: value };
            return { ...prev, authorized_pickups: newPickups };
        });
    };

    // Health Helpers
    const addAllergy = () => {
        setFormData((prev: any) => ({
            ...prev,
            allergies: [...(prev.allergies || []), { allergy: '', severity: 'leve', reaction: '' }]
        }));
    };

    const removeAllergy = (index: number) => {
        setFormData((prev: any) => {
            const newItems = [...(prev.allergies || [])];
            newItems.splice(index, 1);
            return { ...prev, allergies: newItems };
        });
    };

    const updateAllergy = (index: number, field: string, value: string) => {
        setFormData((prev: any) => {
            const newItems = [...(prev.allergies || [])];
            newItems[index] = { ...newItems[index], [field]: value };
            return { ...prev, allergies: newItems };
        });
    };

    const addMedAllowed = () => {
        setFormData((prev: any) => ({
            ...prev,
            medications_allowed: [...(prev.medications_allowed || []), { name: '', dosage: '', trigger: '' }]
        }));
    };

    const removeMedAllowed = (index: number) => {
        setFormData((prev: any) => {
            const newItems = [...(prev.medications_allowed || [])];
            newItems.splice(index, 1);
            return { ...prev, medications_allowed: newItems };
        });
    };

    const updateMedAllowed = (index: number, field: string, value: string) => {
        setFormData((prev: any) => {
            const newItems = [...(prev.medications_allowed || [])];
            newItems[index] = { ...newItems[index], [field]: value };
            return { ...prev, medications_allowed: newItems };
        });
    };

    const addMedRestricted = () => {
        setFormData((prev: any) => ({
            ...prev,
            medications_restricted: [...(prev.medications_restricted || []), { name: '', reason: '' }]
        }));
    };

    const removeMedRestricted = (index: number) => {
        setFormData((prev: any) => {
            const newItems = [...(prev.medications_restricted || [])];
            newItems.splice(index, 1);
            return { ...prev, medications_restricted: newItems };
        });
    };

    const updateMedRestricted = (index: number, field: string, value: string) => {
        setFormData((prev: any) => {
            const newItems = [...(prev.medications_restricted || [])];
            newItems[index] = { ...newItems[index], [field]: value };
            return { ...prev, medications_restricted: newItems };
        });
    };



    // Unified Save Function
    const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 8) value = value.substring(0, 8);

        // Format ####-###
        const formatted = value.replace(/^(\d{5})(\d)/, '$1-$2');

        setFormData((prev: any) => ({ ...prev, zip_code: formatted }));

        if (value.length === 8) {
            try {
                const res = await fetch(`https://viacep.com.br/ws/${value}/json/`);
                const data = await res.json();

                if (!data.erro) {
                    setFormData((prev: any) => ({
                        ...prev,
                        address: data.logradouro,
                        neighbor: data.bairro,
                        city: data.localidade,
                        state: data.uf
                    }));
                }
            } catch (err) {
                console.error('Error fetching CEP:', err);
            }
        }
    };

    // Unified Save Function
    const handleSave = async (finalize = false) => {
        setLoading(true);
        try {
            // Check required fields for final submission
            if (finalize) {
                const errors: Record<string, string> = {};
                if (!formData.parent_name) errors.parent_name = 'Nome do responsável é obrigatório';
                if (!formData.parent_cpf || !isValidCPF(formData.parent_cpf)) errors.parent_cpf = 'CPF inválido';
                if (!formData.student_name) errors.student_name = 'Nome do aluno é obrigatório';
                if (formData.student_cpf && !isValidCPF(formData.student_cpf)) errors.student_cpf = 'CPF do aluno inválido';
                if (!formData.phone || formData.phone.length < 10) errors.phone = 'Telefone inválido';

                if (Object.keys(errors).length > 0) {
                    setFormErrors(errors);
                    setStep(1);
                    throw new Error('Verifique os campos obrigatórios.');
                }
            }

            const newDetails = {
                ...(enrollment?.details || {}), // Keep existing details

                // Merge FormData
                student_cpf: formData.student_cpf,
                birth_date: formData.birth_date,
                rg: formData.rg,
                rg_issuing_body: formData.rg_issuing_body,
                gender: formData.gender,
                race: formData.race,
                nationality: formData.nationality,
                place_of_birth: formData.place_of_birth,
                // Merge FormData for health info
                blood_type: formData.blood_type,
                allergies: formData.allergies,
                medications_allowed: formData.medications_allowed,
                medications_restricted: formData.medications_restricted,
                health_insurance: formData.health_insurance,
                health_insurance_number: formData.health_insurance_number,

                // Structured Habits
                health_observations: formData.health_observations,
                habits: {
                    sleep: {
                        bedtime: formData.sleep_bedtime,
                        wakes_up: formData.sleep_wakes_up
                    },
                    food: {
                        restrictions: formData.food_restrictions,
                        appetite: formData.food_appetite
                    },
                    hygiene: {
                        diapers: formData.hygiene_diapers
                    },
                    social: {
                        behavior: formData.social_behavior
                    }
                },

                parent_name: formData.parent_name,
                parent_cpf: formData.parent_cpf,
                parent_rg: formData.parent_rg,
                parent_rg_issuing_body: formData.parent_rg_issuing_body,
                parent_gender: formData.parent_gender,
                parent_race: formData.parent_race,
                parent_nationality: formData.parent_nationality,
                parent_place_of_birth: formData.parent_place_of_birth,
                parent_birth_date: formData.parent_birth_date,
                parent_phone: formData.phone,
                parent_email: formData.parent_email, // Also save in details just in case

                zip_code: formData.zip_code,
                address: formData.address,
                address_number: formData.address_number,
                neighbor: formData.neighbor,
                city: formData.city,
                state: formData.state,
                complement: formData.complement,

                authorized_pickups: formData.authorized_pickups
            };

            const payload: any = {
                candidate_name: formData.student_name,
                parent_name: formData.parent_name,
                parent_email: formData.parent_email,
                details: newDetails,
                updated_at: new Date().toISOString()
            };

            // If finalizing, set status to 'sent'
            if (finalize && mode === 'wizard') {
                payload.status = 'sent';
            }

            const { error: updateError } = await supabase
                .from('enrollments')
                .update(payload)
                .eq('id', enrollment.id);

            if (updateError) throw updateError;

            // Success feedback
            if (finalize) {
                // Force reload to show 'analysis' mode
                window.location.reload();
            } else {
                // Silent save or specific feedback if needed, but for 'next' usually we just proceed
            }

        } catch (err: any) {
            console.error(err);
            alert('Erro ao salvar: ' + err.message);
            // If finalize failed, we don't reload, so user stays on step 3
        } finally {
            setLoading(false);
        }
    };

    const handleNext = async () => {
        await handleSave(false); // Just save data
        if (step < 4) setStep(step + 1);
    };

    const handleSubmit = async () => {
        await handleSave(true); // Save + Finalize
    };

    const handleBack = () => setStep(step - 1);

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>;
    if (error) return <div className="min-h-screen flex items-center justify-center text-red-600 p-4 text-center">{error}</div>;

    // View: Success / Analysis (Celebration Mode)
    if (mode === 'analysis' || mode === 'success') {
        const isFinished = mode === 'success';

        return (
            <div className="min-h-screen bg-slate-50 relative overflow-hidden font-sans flex items-center justify-center p-4">
                {/* Dynamic Background Elements */}
                <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-green-50/80 to-slate-50 pointer-events-none" />
                <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-green-100/30 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 bg-brand-100/30 rounded-full blur-3xl pointer-events-none" />

                <div className="max-w-lg w-full relative z-10 animate-fade-in">
                    <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-green-900/5 border border-white/60 p-8 md:p-12 text-center">

                        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-100 mb-8 animate-bounce-slow relative">
                            <div className="absolute inset-0 rounded-full bg-green-200/50 animate-ping-slow" />
                            {isFinished ? <CheckCircle className="w-10 h-10 text-green-600 relative z-10" /> : <PartyPopper className="w-10 h-10 text-green-600 relative z-10" />}
                        </div>

                        <h1 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">
                            {isFinished ? 'Matrícula Concluída!' : 'Solicitação Enviada!'}
                        </h1>
                        <p className="text-slate-500 text-lg mb-8 font-light leading-relaxed">
                            {isFinished
                                ? <>A matrícula de <strong className="text-slate-800 font-semibold">{enrollment.candidate_name}</strong> foi finalizada com sucesso. <br /> Bem-vindo(a) à família!</>
                                : <>Recebemos a matrícula de <strong className="text-slate-800 font-semibold">{enrollment.candidate_name}</strong>.<br /> Agora é só aguardar a nossa análise.</>
                            }
                        </p>

                        <div className="bg-slate-50/80 rounded-2xl p-6 mb-8 border border-slate-100 text-left">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Próximos Passos</h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 opacity-50">
                                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
                                        <CheckCircle2 size={14} />
                                    </div>
                                    <span className="text-sm text-slate-600 line-through">Envio dos Dados</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 shrink-0 animate-pulse">
                                        <Clock size={14} />
                                    </div>
                                    <span className="text-sm font-medium text-slate-800">Análise da Secretaria (até 48h)</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                        <FileText size={14} />
                                    </div>
                                    <span className="text-sm text-slate-500">Assinatura do Contrato</span>
                                </div>
                            </div>
                        </div>

                        <Button className="w-full h-12 text-base shadow-lg shadow-brand-500/20" onClick={() => window.location.reload()}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Acompanhar Status
                        </Button>
                    </div>

                    <p className="text-center text-slate-400 text-sm mt-6">
                        Dúvidas? <a href="#" className="text-brand-600 hover:underline">Fale com a secretaria</a>
                    </p>
                </div>
            </div>
        );
    }

    // View: Action Required (Rejected Docs)
    if (mode === 'action_required') {
        return (
            <div className="min-h-screen bg-gray-50 p-4 md:p-8">
                <div className="max-w-3xl mx-auto space-y-6">
                    <Card className="p-6 border-l-4 border-red-500">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-red-100 rounded-full">
                                <FileWarning className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Ação Necessária</h1>
                                <p className="text-gray-600 mt-1">Alguns documentos precisam ser reenviados para prosseguir com a matrícula.</p>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <h2 className="text-lg font-bold mb-4">Documentos Reprovados</h2>
                        <div className="space-y-4">
                            {rejectedDocs.map(([docId, doc]: any) => (
                                <div key={docId} className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-semibold text-red-800 capitalize">
                                            {docId.replace(/_/g, ' ')}
                                        </h3>
                                        <span className="bg-red-200 text-red-800 text-xs px-2 py-1 rounded-full font-bold">
                                            Reprovado
                                        </span>
                                    </div>
                                    <p className="text-sm text-red-700 mb-3">
                                        <strong>Motivo:</strong> {doc.rejection_reason || 'Documento ilegível ou incorreto.'}
                                    </p>

                                    <div className="flex items-center gap-4 mt-4">
                                        <div className="relative">
                                            <input
                                                type="file"
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                onChange={(e) => handleFileUpload(e, docId)}
                                                disabled={uploading}
                                            />
                                            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" disabled={uploading}>
                                                <Upload className="w-4 h-4 mr-2" />
                                                {uploading ? 'Enviando...' : 'Reenviar Documento'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
                {/* Image Cropper Modal */}
                <ImageCropperModal
                    isOpen={isCropperOpen}
                    imageSrc={selectedImage}
                    onClose={() => setIsCropperOpen(false)}
                    onCropComplete={handleCropComplete}
                />
            </div>
        );
    }

    // Hero Header for "Jornada Acolhedora"
    const renderHeroHeader = () => (
        <header className="text-center mb-10 animate-fade-in pt-10 relative z-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-lg shadow-brand-500/10 mb-6 text-brand-600 ring-4 ring-white">
                <GraduationCap size={40} strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 tracking-tight">
                {formData.student_name ? `Matrícula de ${formData.student_name.split(' ')[0]}` : 'Bem-vindo(a)!'}
            </h1>
            <p className="text-slate-500 text-lg max-w-xl mx-auto font-light">
                {isApproved
                    ? "Tudo pronto! A matrícula foi concluída com sucesso."
                    : "Falta pouco para garantir o futuro do aluno em 2026."}
            </p>
        </header>
    );

    // Default: Wizard Mode (Draft)
    return (
        <div className="min-h-screen bg-slate-50 relative overflow-hidden font-sans pb-20">
            {/* Dynamic Background Elements */}
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-brand-50/80 to-slate-50 pointer-events-none" />
            <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-brand-100/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-[20%] left-[-10%] w-72 h-72 bg-blue-100/30 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-4xl mx-auto px-4 relative z-10">
                {renderHeroHeader()}

                {/* Glassmorphism Main Container */}
                <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl shadow-brand-900/5 border border-white/60 p-6 md:p-10 transition-all duration-500">

                    {mode === 'wizard' && (
                        <div className="space-y-8">
                            {/* Progress Stepper with Premium Look */}
                            <div className="relative mb-12 px-4">
                                <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-10 rounded-full" />
                                <div className="absolute top-1/2 left-0 h-1 bg-brand-500 transition-all duration-500 ease-out rounded-full shadow-[0_0_10px_rgba(14,165,233,0.3)]"
                                    style={{ width: `${((step - 1) / 3) * 100}%` }}
                                />

                                <div className="flex justify-between relative">
                                    {[
                                        { num: 1, label: 'Responsáveis', icon: User },
                                        { num: 2, label: 'Aluno', icon: Users },
                                        { num: 3, label: 'Saúde', icon: Heart },
                                        { num: 4, label: 'Documentos', icon: FileText }
                                    ].map((s) => {
                                        const isActive = step >= s.num;
                                        return (
                                            <div key={s.num} className="flex flex-col items-center group cursor-default">
                                                <div className={cn(
                                                    "w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-300 relative z-10",
                                                    isActive
                                                        ? "bg-brand-600 border-white text-white shadow-lg shadow-brand-500/20 scale-110"
                                                        : "bg-white border-slate-100 text-slate-300"
                                                )}>
                                                    {isActive ? <s.icon size={20} /> : <span className="font-bold text-lg">{s.num}</span>}
                                                </div>
                                                <span className={cn(
                                                    "text-xs font-semibold mt-3 transition-colors duration-300 absolute -bottom-8 whitespace-nowrap",
                                                    isActive ? "text-brand-700" : "text-slate-300"
                                                )}>
                                                    {s.label}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-8">
                        <form onSubmit={(e) => { e.preventDefault(); if (step === 4) handleSubmit(); else handleNext(); }}>

                            {step === 1 && (
                                <div className="space-y-6 animate-fade-in">
                                    {/* Moved Parents/Address Logic Here from Step 2 */}
                                    <h3 className="text-xl font-semibold border-b pb-2">1. Responsáveis e Endereço</h3>

                                    <div className="space-y-4">
                                        <h4 className="font-medium text-gray-700">Responsável Financeiro / Pedagógico</h4>
                                        <Input
                                            label="Nome Completo"
                                            icon={<User className="h-4 w-4" />}
                                            value={formData.parent_name}
                                            onChange={e => setFormData({ ...formData, parent_name: e.target.value })}
                                            error={formErrors.parent_name}
                                        />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                label="CPF"
                                                icon={<FileText className="h-4 w-4" />}
                                                placeholder="000.000.000-00"
                                                value={formData.parent_cpf || ''}
                                                onChange={e => setFormData({ ...formData, parent_cpf: formatCPF(e.target.value) })}
                                                error={formErrors.parent_cpf}
                                                disabled={!!enrollment?.details?.parent_cpf}
                                                className={`${formData.parent_cpf?.length === 14 ? (isValidCPF(formData.parent_cpf) ? 'border-green-300 focus:ring-green-500' : 'border-red-300 focus:ring-red-500') : ''} ${!!enrollment?.details?.parent_cpf ? 'bg-slate-50 opacity-80' : ''}`}
                                                rightIcon={formData.parent_cpf?.length === 14 && (
                                                    isValidCPF(formData.parent_cpf) ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />
                                                )}
                                            />
                                            <div className="grid grid-cols-2 gap-4">
                                                <Input
                                                    label="RG"
                                                    icon={<Hash className="h-4 w-4" />}
                                                    value={formData.parent_rg || ''}
                                                    onChange={e => setFormData({ ...formData, parent_rg: e.target.value })}
                                                />
                                                <Input
                                                    label="Órgão"
                                                    icon={<Building className="h-4 w-4" />}
                                                    value={formData.parent_rg_issuing_body || ''}
                                                    onChange={e => setFormData({ ...formData, parent_rg_issuing_body: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Select
                                                label="Sexo"
                                                icon={<Users className="h-4 w-4" />}
                                                value={formData.parent_gender || ''}
                                                onChange={e => setFormData({ ...formData, parent_gender: e.target.value })}
                                            >
                                                <option value="">Selecione...</option>
                                                <option value="Masculino">Masculino</option>
                                                <option value="Feminino">Feminino</option>
                                                <option value="Outro">Outro</option>
                                            </Select>

                                            <Select
                                                label="Raça / Cor"
                                                icon={<User className="h-4 w-4" />}
                                                value={formData.parent_race || ''}
                                                onChange={e => setFormData({ ...formData, parent_race: e.target.value })}
                                            >
                                                <option value="">Selecione...</option>
                                                <option value="Branca">Branca</option>
                                                <option value="Preta">Preta</option>
                                                <option value="Parda">Parda</option>
                                                <option value="Amarela">Amarela</option>
                                                <option value="Indígena">Indígena</option>
                                                <option value="Não declarado">Não declarado</option>
                                            </Select>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <Input
                                                label="Data de Nascimento"
                                                type="date"
                                                icon={<Calendar className="h-4 w-4" />}
                                                value={formData.parent_birth_date || ''}
                                                onChange={e => setFormData({ ...formData, parent_birth_date: e.target.value })}
                                            />
                                            <Input
                                                label="Nacionalidade"
                                                icon={<Globe className="h-4 w-4" />}
                                                value={formData.parent_nationality || ''}
                                                onChange={e => setFormData({ ...formData, parent_nationality: e.target.value })}
                                            />
                                            <Input
                                                label="Naturalidade (Cidade/UF)"
                                                icon={<MapPin className="h-4 w-4" />}
                                                value={formData.parent_place_of_birth || ''}
                                                onChange={e => setFormData({ ...formData, parent_place_of_birth: e.target.value })}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                label="E-mail"
                                                type="email"
                                                icon={<Mail className="h-4 w-4" />}
                                                value={formData.parent_email || ''}
                                                onChange={e => setFormData({ ...formData, parent_email: e.target.value })}
                                            />
                                            <PhoneInput
                                                label="Telefone / WhatsApp"
                                                value={formData.phone || ''}
                                                onChange={val => setFormData({ ...formData, phone: val })}
                                                error={formErrors.phone}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4 mt-6">
                                        <h4 className="font-medium text-gray-700">Endereço Residencial</h4>
                                        <div className="grid grid-cols-3 gap-4">
                                            <Input
                                                containerClassName="col-span-1"
                                                label="CEP"
                                                icon={<Search className="h-4 w-4" />}
                                                value={formData.zip_code}
                                                onChange={handleCepChange}
                                                maxLength={9}
                                                placeholder="00000-000"
                                            />
                                            <Input
                                                containerClassName="col-span-2"
                                                label="Logradouro"
                                                icon={<MapPin className="h-4 w-4" />}
                                                value={formData.address}
                                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <Input
                                                label="Número"
                                                icon={<Hash className="h-4 w-4" />}
                                                value={formData.address_number || ''}
                                                onChange={e => setFormData({ ...formData, address_number: e.target.value })}
                                            />
                                            <Input
                                                containerClassName="col-span-2"
                                                label="Bairro"
                                                icon={<Building className="h-4 w-4" />}
                                                value={formData.neighbor || ''}
                                                onChange={e => setFormData({ ...formData, neighbor: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-12 gap-4">
                                            <Input
                                                containerClassName="col-span-12 md:col-span-6"
                                                label="Cidade"
                                                icon={<MapPin className="h-4 w-4" />}
                                                value={formData.city || ''}
                                                onChange={e => setFormData({ ...formData, city: e.target.value })}
                                            />
                                            <Input
                                                containerClassName="col-span-12 md:col-span-2"
                                                label="UF"
                                                icon={<Globe className="h-4 w-4" />}
                                                maxLength={2}
                                                value={formData.state || ''}
                                                onChange={e => setFormData({ ...formData, state: e.target.value })}
                                            />
                                            <Input
                                                containerClassName="col-span-12 md:col-span-4"
                                                label="Complemento"
                                                icon={<Info className="h-4 w-4" />}
                                                value={formData.complement || ''}
                                                onChange={e => setFormData({ ...formData, complement: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                </div>
                            )}


                            {step === 2 && (
                                <div className="space-y-6 animate-fade-in">
                                    <h3 className="text-xl font-semibold border-b pb-2">2. Dados do Aluno</h3>

                                    <div className="space-y-4">
                                        <Input
                                            label="Nome Completo"
                                            icon={<User className="h-4 w-4" />}
                                            value={formData.student_name}
                                            onChange={e => setFormData({ ...formData, student_name: e.target.value })}
                                            error={formErrors.student_name}
                                        />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                label="CPF"
                                                icon={<FileText className="h-4 w-4" />}
                                                placeholder="000.000.000-00"
                                                value={formData.student_cpf || ''}
                                                onChange={e => setFormData({ ...formData, student_cpf: formatCPF(e.target.value) })}
                                                error={formErrors.student_cpf}
                                                disabled={!!enrollment?.details?.student_cpf}
                                                className={`${formData.student_cpf?.length === 14 ? (isValidCPF(formData.student_cpf) ? 'border-green-300 focus:ring-green-500' : 'border-red-300 focus:ring-red-500') : ''} ${!!enrollment?.details?.student_cpf ? 'bg-slate-50 opacity-80' : ''}`}
                                                rightIcon={formData.student_cpf?.length === 14 && (
                                                    isValidCPF(formData.student_cpf) ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />
                                                )}
                                            />
                                            <Input
                                                label="Data de Nascimento"
                                                type="date"
                                                icon={<Calendar className="h-4 w-4" />}
                                                value={formData.birth_date}
                                                onChange={e => setFormData({ ...formData, birth_date: e.target.value })}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                label="RG"
                                                icon={<Hash className="h-4 w-4" />}
                                                value={formData.rg || ''}
                                                onChange={e => setFormData({ ...formData, rg: e.target.value })}
                                            />
                                            <Input
                                                label="Órgão Emissor"
                                                icon={<Building className="h-4 w-4" />}
                                                value={formData.rg_issuing_body || ''}
                                                onChange={e => setFormData({ ...formData, rg_issuing_body: e.target.value })}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Select
                                                label="Sexo"
                                                icon={<Users className="h-4 w-4" />}
                                                value={formData.gender || ''}
                                                onChange={e => setFormData({ ...formData, gender: e.target.value })}
                                            >
                                                <option value="">Selecione...</option>
                                                <option value="Masculino">Masculino</option>
                                                <option value="Feminino">Feminino</option>
                                                <option value="Outro">Outro</option>
                                            </Select>

                                            <Select
                                                label="Raça / Cor"
                                                icon={<User className="h-4 w-4" />}
                                                value={formData.race || ''}
                                                onChange={e => setFormData({ ...formData, race: e.target.value })}
                                            >
                                                <option value="">Selecione...</option>
                                                <option value="Branca">Branca</option>
                                                <option value="Preta">Preta</option>
                                                <option value="Parda">Parda</option>
                                                <option value="Amarela">Amarela</option>
                                                <option value="Indígena">Indígena</option>
                                                <option value="Não declarado">Não declarado</option>
                                            </Select>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                label="Nacionalidade"
                                                icon={<Globe className="h-4 w-4" />}
                                                value={formData.nationality || ''}
                                                onChange={e => setFormData({ ...formData, nationality: e.target.value })}
                                            />
                                            <Input
                                                label="Naturalidade (Cidade/UF)"
                                                icon={<MapPin className="h-4 w-4" />}
                                                value={formData.place_of_birth || ''}
                                                onChange={e => setFormData({ ...formData, place_of_birth: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Authorized Pickups Moved Here */}
                                    <div className="space-y-4 mt-8 border-t pt-6 text-left">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-medium text-gray-700">Pessoas Autorizadas a Buscar</h4>
                                            <Button type="button" size="sm" variant="outline" onClick={addPickupPerson}>+ Adicionar</Button>
                                        </div>

                                        {(formData.authorized_pickups || []).length === 0 && (
                                            <p className="text-sm text-gray-400 italic">Nenhuma pessoa autorizada adicionada além dos responsáveis.</p>
                                        )}

                                        <div className="space-y-3">
                                            {(formData.authorized_pickups || []).map((person: any, index: number) => (
                                                <div key={index} className="grid grid-cols-12 gap-3 items-center p-3 bg-white rounded-xl shadow-sm border border-slate-100 animate-slide-up">
                                                    <Input
                                                        containerClassName="col-span-12 md:col-span-5"
                                                        placeholder="Nome Completo"
                                                        value={person.name}
                                                        onChange={e => updatePickupPerson(index, 'name', e.target.value)}
                                                    />
                                                    <Input
                                                        containerClassName="col-span-1 5 md:col-span-3"
                                                        placeholder="Parentesco"
                                                        value={person.relation}
                                                        onChange={e => updatePickupPerson(index, 'relation', e.target.value)}
                                                    />
                                                    <Input
                                                        containerClassName="col-span-5 md:col-span-3"
                                                        placeholder="Doc. ID"
                                                        value={person.cpf}
                                                        onChange={e => updatePickupPerson(index, 'cpf', e.target.value)}
                                                    />
                                                    <div className="col-span-2 md:col-span-1 flex justify-center">
                                                        <Button type="button" size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => removePickupPerson(index)}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-6 animate-fade-in">
                                    <h3 className="text-xl font-semibold border-b pb-2">3. Saúde e Hábitos</h3>
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <Select
                                                label="Tipo Sanguíneo"
                                                icon={<Droplet className="h-4 w-4 text-red-500" />}
                                                value={formData.blood_type || ''}
                                                onChange={e => setFormData({ ...formData, blood_type: e.target.value })}
                                            >
                                                <option value="">Selecione...</option>
                                                <option value="A+">A+</option>
                                                <option value="A-">A-</option>
                                                <option value="B+">B+</option>
                                                <option value="B-">B-</option>
                                                <option value="AB+">AB+</option>
                                                <option value="AB-">AB-</option>
                                                <option value="O+">O+</option>
                                                <option value="O-">O-</option>
                                            </Select>
                                        </div>

                                        {/* ALLERGIES */}
                                        <div className="space-y-4 pt-4 border-t">
                                            <div className="flex justify-between items-center">
                                                <h4 className="font-medium text-gray-700 flex items-center gap-2">
                                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                                    Alergias / Intolerâncias
                                                </h4>
                                                <Button type="button" size="sm" variant="outline" onClick={addAllergy}>+ Adicionar</Button>
                                            </div>
                                            {(formData.allergies || []).length === 0 && (
                                                <p className="text-sm text-gray-400 italic">Nenhuma alergia relatada.</p>
                                            )}
                                            <div className="space-y-3">
                                                {(formData.allergies || []).map((item: any, index: number) => (
                                                    <div key={index} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 animate-slide-up space-y-3 relative">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            className="absolute top-2 right-2 text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                                                            onClick={() => removeAllergy(index)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>

                                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                                            <div className="col-span-12 md:col-span-6">
                                                                <Input
                                                                    label="Alergia a que?"
                                                                    placeholder="Ex: Amendoim, Lactose"
                                                                    value={item.allergy}
                                                                    onChange={e => updateAllergy(index, 'allergy', e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="col-span-12 md:col-span-6">
                                                                <Select
                                                                    label="Severidade"
                                                                    value={item.severity}
                                                                    onChange={e => updateAllergy(index, 'severity', e.target.value)}
                                                                >
                                                                    <option value="leve">Leve</option>
                                                                    <option value="moderada">Moderada</option>
                                                                    <option value="grave">Grave ⚠️</option>
                                                                </Select>
                                                            </div>
                                                            <div className="col-span-12">
                                                                <Input
                                                                    label="Reação / O que acontece?"
                                                                    placeholder="Ex: Inchaço, falta de ar, vermelhidão..."
                                                                    value={item.reaction}
                                                                    onChange={e => updateAllergy(index, 'reaction', e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* MEDICATIONS ALLOWED */}
                                        <div className="space-y-4 pt-4 border-t">
                                            <div className="flex justify-between items-center">
                                                <h4 className="font-medium text-gray-700 flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                    Medicamentos Permitidos
                                                </h4>
                                                <Button type="button" size="sm" variant="outline" onClick={addMedAllowed}>+ Adicionar</Button>
                                            </div>
                                            {(formData.medications_allowed || []).length === 0 && (
                                                <p className="text-sm text-gray-400 italic">Nenhum medicamento listado.</p>
                                            )}
                                            <div className="space-y-3">
                                                {(formData.medications_allowed || []).map((item: any, index: number) => (
                                                    <div key={index} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 animate-slide-up space-y-3 relative">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            className="absolute top-2 right-2 text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                                                            onClick={() => removeMedAllowed(index)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>

                                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                                            <div className="col-span-12 md:col-span-5">
                                                                <Input
                                                                    label="Nome do Medicamento"
                                                                    placeholder="Ex: Dipirona"
                                                                    value={item.name}
                                                                    onChange={e => updateMedAllowed(index, 'name', e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="col-span-6 md:col-span-3">
                                                                <Input
                                                                    label="Dosagem (Opcional)"
                                                                    placeholder="Ex: 10 gotas"
                                                                    value={item.dosage}
                                                                    onChange={e => updateMedAllowed(index, 'dosage', e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="col-span-6 md:col-span-4">
                                                                <Input
                                                                    label="Quando usar? (Gatilho)"
                                                                    placeholder="Ex: Se febre > 38°C"
                                                                    value={item.trigger}
                                                                    onChange={e => updateMedAllowed(index, 'trigger', e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* MEDICATIONS RESTRICTED */}
                                        <div className="space-y-4 pt-4 border-t">
                                            <div className="flex justify-between items-center">
                                                <h4 className="font-medium text-gray-700 flex items-center gap-2">
                                                    <FileWarning className="w-4 h-4 text-red-500" />
                                                    Medicamentos Restritos / Proibidos
                                                </h4>
                                                <Button type="button" size="sm" variant="outline" onClick={addMedRestricted}>+ Adicionar</Button>
                                            </div>
                                            {(formData.medications_restricted || []).length === 0 && (
                                                <p className="text-sm text-gray-400 italic">Nenhum registro.</p>
                                            )}
                                            <div className="space-y-3">
                                                {(formData.medications_restricted || []).map((item: any, index: number) => (
                                                    <div key={index} className="bg-red-50/50 rounded-xl p-4 shadow-sm border border-red-100 animate-slide-up space-y-3 relative">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            className="absolute top-2 right-2 text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                                                            onClick={() => removeMedRestricted(index)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>

                                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                                            <div className="col-span-12 md:col-span-6">
                                                                <Input
                                                                    label="Nome do Medicamento"
                                                                    placeholder="Ex: Ibuprofeno"
                                                                    value={item.name}
                                                                    onChange={e => updateMedRestricted(index, 'name', e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="col-span-12 md:col-span-6">
                                                                <Input
                                                                    label="Motivo da Restrição"
                                                                    placeholder="Ex: Alergia grave"
                                                                    value={item.reason}
                                                                    onChange={e => updateMedRestricted(index, 'reason', e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <Input
                                            label="Observações Gerais de Saúde / Cuidados Especiais"
                                            icon={<Activity className="h-4 w-4" />}
                                            value={formData.health_observations}
                                            onChange={e => setFormData({ ...formData, health_observations: e.target.value })}
                                            placeholder="Cirurgias, tratamentos em andamento, cuidados especiais..."
                                        />

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                label="Plano de Saúde"
                                                icon={<Shield className="h-4 w-4" />}
                                                value={formData.health_insurance || ''}
                                                onChange={e => setFormData({ ...formData, health_insurance: e.target.value })}
                                            />
                                            <Input
                                                label="Carteirinha / SUS"
                                                icon={<Activity className="h-4 w-4" />}
                                                value={formData.health_insurance_number || ''}
                                                onChange={e => setFormData({ ...formData, health_insurance_number: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-semibold border-b pb-2 mt-6">Hábitos e Rotina</h3>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                label="Horário de Dormir (Aprox.)"
                                                type="time"
                                                icon={<Clock className="h-4 w-4" />}
                                                value={formData.sleep_bedtime || ''}
                                                onChange={e => setFormData({ ...formData, sleep_bedtime: e.target.value })}
                                            />
                                            <Select
                                                label="Acorda durante a noite?"
                                                value={formData.sleep_wakes_up || ''}
                                                onChange={e => setFormData({ ...formData, sleep_wakes_up: e.target.value })}
                                            >
                                                <option value="">Selecione...</option>
                                                <option value="sim">Sim</option>
                                                <option value="nao">Não</option>
                                                <option value="as_vezes">Às vezes</option>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Select
                                                label="Usa Fraldas?"
                                                value={formData.hygiene_diapers || ''}
                                                onChange={e => setFormData({ ...formData, hygiene_diapers: e.target.value })}
                                            >
                                                <option value="">Selecione...</option>
                                                <option value="sim">Sim (Sempre)</option>
                                                <option value="nao">Não (Desfraldado)</option>
                                                <option value="anoite">Apenas para dormir</option>
                                                <option value="em_processo">Em processo de desfralde</option>
                                            </Select>
                                            <Select
                                                label="Como é o apetite?"
                                                value={formData.food_appetite || ''}
                                                onChange={e => setFormData({ ...formData, food_appetite: e.target.value })}
                                            >
                                                <option value="">Selecione...</option>
                                                <option value="pouco">Pouco</option>
                                                <option value="normal">Normal</option>
                                                <option value="muito">Muito (Bom garfo)</option>
                                                <option value="seletivo">Seletivo</option>
                                            </Select>
                                        </div>
                                        <Input
                                            label="Restrições Alimentares (Detalhes)"
                                            icon={<AlertCircle className="h-4 w-4" />}
                                            value={formData.food_restrictions || ''}
                                            onChange={e => setFormData({ ...formData, food_restrictions: e.target.value })}
                                            placeholder="Ex: Não come carne, evitar açúcar, intolerância..."
                                        />
                                        <Input
                                            label="Comportamento / Sociabilização"
                                            icon={<Users className="h-4 w-4" />}
                                            value={formData.social_behavior || ''}
                                            onChange={e => setFormData({ ...formData, social_behavior: e.target.value })}
                                            placeholder="Gosta de brincar com outras crianças? Tímido? Alguma observação?"
                                        />
                                        <Input
                                            label="Outras Observações de Saúde"
                                            icon={<Activity className="h-4 w-4" />}
                                            value={formData.health_observations || ''}
                                            onChange={e => setFormData({ ...formData, health_observations: e.target.value })}
                                            placeholder="Cirurgias, tratamentos em andamento, cuidados especiais..."
                                        />
                                    </div>
                                </div>
                            )}

                            {step === 4 && (
                                <div className="space-y-6 animate-fade-in">
                                    <h3 className="text-xl font-semibold border-b pb-2">4. Documentos Obrigatórios</h3>

                                    <div className="grid grid-cols-1 gap-4">
                                        {/* DYNAMIC REQUIRED DOCS + AD-HOC EXTRA DOCS */}
                                        {(() => {
                                            // 1. Get IDs from Templates
                                            const templateIds = new Set(docTemplates.map(d => d.id));

                                            // 2. Find Ad-hoc Docs (present in enrollment but not in template)
                                            const currentDocs = enrollment?.details?.documents || {};
                                            const adHocDocs = Object.keys(currentDocs)
                                                .filter(key => !templateIds.has(key))
                                                .map(key => ({
                                                    id: key,
                                                    label: currentDocs[key].label || `Solicitação Extra: ${key.replace(/_/g, ' ')}`,
                                                    required: true, // Ad-hoc usually implies requirement
                                                    isAdHoc: true
                                                }));

                                            // 3. Merge Lists
                                            const allDocs = [...docTemplates, ...adHocDocs];

                                            return allDocs.map((docType) => {
                                                const docKey = docType.id;
                                                const docStatus = enrollment?.details?.documents?.[docKey]?.status;
                                                const isCompleted = docStatus === 'uploaded' || docStatus === 'approved';
                                                const rejectionReason = enrollment?.details?.documents?.[docKey]?.rejection_reason;

                                                return (
                                                    <div key={docKey} className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors relative ${docType.isAdHoc ? 'bg-amber-50 border-amber-200' : ''} ${isCompleted ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                                        {/* Hidden Input */}
                                                        <input
                                                            type="file"
                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                            onChange={(e) => handleFileUpload(e, docKey)}
                                                            disabled={uploading}
                                                        />

                                                        {/* Ad-Hoc Badge */}
                                                        {docType.isAdHoc && (
                                                            <div className="absolute top-2 right-2 bg-amber-200 text-amber-800 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                                                                Solicitado Extra
                                                            </div>
                                                        )}

                                                        {isCompleted ? (
                                                            <>
                                                                <CheckCircle className="w-8 h-8 mx-auto text-green-500 mb-2" />
                                                                <p className="text-sm font-bold text-green-700">
                                                                    {docStatus === 'approved' ? 'Documento Aprovado' : 'Arquivo Enviado'}
                                                                </p>
                                                                <p className="text-xs text-green-600">{docType.label}</p>
                                                                <p className="text-[10px] text-gray-400 mt-2 z-20 relative pointer-events-none">(Clique para substituir se necessário)</p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                {uploading ? <Loader2 className="w-8 h-8 mx-auto text-brand-400 animate-spin mb-2" /> : <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />}
                                                                <p className="text-sm font-medium text-gray-700">
                                                                    {docType.label} {docType.required && <span className="text-red-500">*</span>}
                                                                </p>
                                                                {rejectionReason && (
                                                                    <p className="text-xs text-red-500 mt-1 font-semibold">Motivo da recusa: {rejectionReason}</p>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}

                            <div className="pt-8 flex justify-between">
                                {step > 1 ? (
                                    <Button type="button" variant="ghost" onClick={handleBack}>Voltar</Button>
                                ) : <div></div>}

                                <Button type="submit">
                                    {step === 4 ? 'Finalizar Matrícula' : 'Próximo Passo'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
                {/* Image Cropper Modal */}
                <ImageCropperModal
                    isOpen={isCropperOpen}
                    imageSrc={selectedImage}
                    onClose={() => setIsCropperOpen(false)}
                    onCropComplete={handleCropComplete}
                />
            </div>
        </div>
    );
};

