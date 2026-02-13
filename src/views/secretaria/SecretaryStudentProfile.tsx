import { type FC, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    FileText,
    CheckCircle,
    AlertCircle,
    Clock,
    ChevronDown,
    ChevronUp,
    MessageCircle,
    Eye,
    Plus
} from 'lucide-react';
import { Button, Card, Modal, Input } from '../../components/ui';
import { supabase } from '../../services/supabase';

// --- COMPONENTS ---

// 1. Doc Item Component
const DocItem = ({ title, status, onAction }: any) => {
    const statusConfig: any = {
        approved: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50', text: 'Aprovado' },
        rejected: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50', text: 'Rejeitado' },
        pending: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', text: 'Pendente Análise' },
        uploaded: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', text: 'Pendente Análise' },
        submitted: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', text: 'Pendente Análise' },
        missing: { icon: AlertCircle, color: 'text-gray-400', bg: 'bg-gray-50', text: 'Não Enviado' }
    };

    const cfg = statusConfig[status] || statusConfig.missing;
    const Icon = cfg.icon;

    return (
        <div className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors group">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${cfg.bg}`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                </div>
                <div>
                    <h4 className="text-sm font-medium text-gray-900">{title}</h4>
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${cfg.color}`}>
                        {cfg.text}
                    </span>
                </div>
            </div>

            <div className="flex gap-2">
                {status !== 'rejected' && (
                    <Button
                        size="sm"
                        className={`h-8 text-xs ${status === 'approved' ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
                        onClick={() => onAction('validate')}
                    >
                        {status === 'approved' ? 'Ver' : 'Avaliar'}
                    </Button>
                )}

                {status === 'rejected' && (
                    <Button
                        size="sm"
                        className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 h-8 text-xs font-bold"
                        onClick={() => onAction('validate')}
                    >
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Ver Motivo
                    </Button>
                )}
                {status === 'approved' && (
                    <Button size="sm" variant="ghost" className="text-gray-400 hover:text-brand-600 h-8 w-8 p-0">
                        <Eye className="w-4 h-4" />
                    </Button>
                )}
            </div>
        </div>
    );
};

// 2. Timeline Item
const TimelineItem = ({ date, title, desc, type, author }: any) => {
    return (
        <div className="relative pl-6 pb-6 border-l border-gray-200 last:pb-0">
            <div className={`absolute -left-1.5 top-0 w-3 h-3 rounded-full border-2 border-white ${type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-red-500' : 'bg-gray-300'}`} />
            <span className="text-[10px] text-gray-400 font-mono mb-1 block">{date}</span>
            <h4 className="text-sm font-medium text-gray-900">{title}</h4>
            <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            {author && <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">👤 {author}</p>}
        </div>
    );
};

export const SecretaryStudentProfile: FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // Validation State
    const [validatingDoc, setValidatingDoc] = useState<any>(null);
    const [rejectionMode, setRejectionMode] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    // Data State
    const [enrollment, setEnrollment] = useState<any>(null);
    const [docTemplates, setDocTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Ad-Hoc Request State
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [newDocName, setNewDocName] = useState('');
    const [requesting, setRequesting] = useState(false);

    // History State
    const [history, setHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Fetch Enrollment & Settings
    useEffect(() => {
        if (!id) return;
        fetchData();
        fetchHistory();
    }, [id]);

    const fetchData = async () => {
        try {
            // 1. Fetch Enrollment with JOINS
            const { data: enrollmentData, error: enrollmentError } = await supabase
                .from('enrollments')
                .select('*, student:students(name, photo_url, financial_responsible), class_enrollments(classes(name))')
                .eq('id', id)
                .single();

            if (enrollmentError) throw enrollmentError;
            setEnrollment(enrollmentData);

            // 2. Fetch Settings (if school_id exists)
            if (enrollmentData.school_id) {
                const { data: settingsData } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('school_id', enrollmentData.school_id)
                    .eq('key', 'enrollment_docs_template')
                    .maybeSingle();

                if (settingsData?.value) {
                    let val = settingsData.value;
                    // Recursive JSON parse fix
                    let attempts = 0;
                    while (typeof val === 'string' && attempts < 3) {
                        try {
                            val = JSON.parse(val);
                        } catch (e) { break; }
                        attempts++;
                    }
                    if (Array.isArray(val)) setDocTemplates(val);
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        if (!id) return;
        setHistoryLoading(true);
        try {
            const { data, error } = await supabase
                .from('enrollment_history')
                .select('*, profiles(name, email)')
                .eq('enrollment_id', id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) setHistory(data);
        } catch (error: any) {
            console.error('Error fetching history:', error);
            // DEBUG: Show error in UI
            if (error.code) alert(`History Error: ${error.code} - ${error.details || error.message}`);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleApproveDoc = async (docId: string, docTitle: string) => {
        if (!confirm(`Aprovar o documento ${docTitle}?`)) return;
        setLoading(true);
        try {
            // 1. Update Enrollment
            const newDetails = {
                ...enrollment.details,
                documents: {
                    ...enrollment.details.documents,
                    [docId]: {
                        ...enrollment.details.documents[docId],
                        status: 'approved',
                        approved_at: new Date().toISOString()
                    }
                }
            };

            const { error } = await supabase
                .from('enrollments')
                .update({ details: newDetails })
                .eq('id', id);

            if (error) throw error;

            // 2. Log History
            await supabase.from('enrollment_history').insert({
                enrollment_id: id,
                school_id: enrollment.school_id,
                action_type: 'APPROVE_DOC',
                title: 'Documento Aprovado',
                description: `Documento ${docTitle} foi aprovado pela secretaria.`,
                metadata: { doc_id: docId },
                created_by: (await supabase.auth.getUser()).data.user?.id
            });

            fetchData();
            fetchHistory();
        } catch (err: any) {
            alert('Erro: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRejectDoc = async (docId: string, docTitle: string, reasonInput?: string) => {
        let reason = reasonInput;
        if (!reason) {
            reason = prompt(`Motivo da rejeição para ${docTitle}:`) || '';
        }

        if (!reason) return;

        setLoading(true);
        try {
            // 1. Update Enrollment
            const newDetails = {
                ...enrollment.details,
                documents: {
                    ...enrollment.details.documents,
                    [docId]: {
                        ...enrollment.details.documents[docId],
                        status: 'rejected',
                        rejection_reason: reason,
                        rejected_at: new Date().toISOString()
                    }
                }
            };

            const { error } = await supabase
                .from('enrollments')
                .update({ details: newDetails })
                .eq('id', id);

            if (error) throw error;

            // 2. Log History
            await supabase.from('enrollment_history').insert({
                enrollment_id: id,
                school_id: enrollment.school_id,
                action_type: 'REJECT_DOC',
                title: 'Documento Rejeitado',
                description: `Documento ${docTitle} rejeitado. Motivo: ${reason}`,
                metadata: { doc_id: docId, reason },
                created_by: (await supabase.auth.getUser()).data.user?.id
            });

            // 3. Notify Parent (Real-time Notification)
            if (enrollment.user_id) {
                await supabase.from('notifications').insert({
                    school_id: enrollment.school_id,
                    user_id: enrollment.user_id,
                    type: 'document_rejected',
                    title: 'Documento Rejeitado',
                    message: `O documento ${docTitle} precisa ser corrigido: ${reason}`,
                    data: { doc_id: docId, enrollment_id: id, reason },
                    read: false
                });
            }

            // Close modal and reset state
            setValidatingDoc(null);
            setRejectionMode(false);
            setRejectionReason('');
            fetchData();
            fetchHistory();
        } catch (err: any) {
            alert('Erro: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Handle Finalize (Approve)
    const handleFinalize = async () => {
        if (!confirm('Tem certeza que deseja finalizar esta matrícula? O aluno será criado oficialmente.')) return;

        setLoading(true);
        try {
            const { error } = await supabase.rpc('approve_enrollment', {
                enrollment_id: id
            });
            if (error) throw error;

            // Log History
            await supabase.from('enrollment_history').insert({
                enrollment_id: id,
                school_id: enrollment?.school_id, // Access safely
                action_type: 'STATUS_CHANGE',
                title: 'Matrícula Finalizada',
                description: 'O aluno foi matriculado oficialmente no sistema.',
                created_by: (await supabase.auth.getUser()).data.user?.id
            });

            alert('Matrícula finalizada com sucesso!');
            fetchData();
            fetchHistory();
        } catch (err: any) {
            alert('Erro ao finalizar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRemindPending = () => {
        // Placeholder for future WhatsApp integration
        alert('Lembrete enviado para o responsável via WhatsApp!');
    };

    // Derived Data (from Enrollment)
    const studentData = enrollment?.details?.student || {};
    const parentData = enrollment?.details?.responsible || {};
    const uploadedDocs = enrollment?.details?.documents || {};

    const linkedStudent = enrollment?.student || {};
    const financialResp = linkedStudent.financial_responsible || {};

    const studentName = linkedStudent.name || enrollment?.candidate_name || studentData.full_name || 'Nome não informado';

    // Robust Grade Resolution: Check object OR array return from Join
    const classEnrollment = enrollment?.class_enrollments?.[0];
    const joinedClass = classEnrollment?.classes;
    const className = Array.isArray(joinedClass) ? joinedClass[0]?.name : joinedClass?.name;
    const studentGrade = className || enrollment?.grade_level || 'Série n/a';

    const student = {
        name: studentName,
        grade: studentGrade,
        photo: linkedStudent.photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${studentName}`,
        // Priority: Details (Enrollment Form) -> Financial Resp (Student Table) -> Direct Params
        parent: parentData.full_name || financialResp.name || enrollment?.parent_name || 'Responsável não informado',
        phone: parentData.phone || parentData.mobile || financialResp.phone || enrollment?.parent_phone || 'Sem contato',
        email: parentData.email || financialResp.email || enrollment?.parent_email || 'Sem email',
        status: enrollment?.status || 'draft'
    };

    // ... (keep getDocGroup and merges) ...


    // Map Documents to Groups (Enhanced)
    const getDocGroup = (key: string) => {
        const map: any = {
            'student_id': 'Identificação', // RG do Aluno
            'birth_cert': 'Identificação', // Certidão
            'parent_id': 'Identificação', // RG do Responsável
            'cpf': 'Identificação',
            'residency': 'Identificação',
            'proof_of_residence': 'Identificação',
            'transfer': 'Acadêmico',
            'report_card': 'Acadêmico',
            'history': 'Acadêmico', // Histórico
            'vaccination': 'Saúde',
            'medical_report': 'Saúde',
            'photo': 'Identificação'
        };
        return map[key] || 'Solicitações Extras';
    };

    const getDocUrl = (path: string) => {
        if (!path) return null;
        const { data } = supabase.storage.from('documents').getPublicUrl(path);
        return data.publicUrl;
    };

    // Merge Templates + Uploaded
    const allDocKeys = new Set([...docTemplates.map(t => t.id), ...Object.keys(uploadedDocs)]);

    let missingCount = 0;
    let pendingReviewCount = 0;

    const groupedDocs = Array.from(allDocKeys).reduce((acc: any, key: string) => {
        const template = docTemplates.find(t => t.id === key);
        const uploaded = uploadedDocs[key];
        const group = getDocGroup(key);

        if (!acc[group]) acc[group] = [];

        // Determine status
        let status = 'missing';
        if (uploaded?.status) status = uploaded.status;
        else if (template?.required && !uploaded) status = 'missing'; // Required but not uploaded

        // Count Stats for "Status Geral"
        if (status === 'uploaded') pendingReviewCount++;
        if (status === 'missing' || status === 'rejected' || status === 'pending') missingCount++;

        // Show if: it's in templates OR it's uploaded (ad-hoc)
        acc[group].push({
            id: key,
            title: template?.label || uploaded?.label || key.replace(/_/g, ' '),
            status: status,
            required: template?.required || uploaded?.required || false,
            url: uploaded?.url || (uploaded?.file_path ? getDocUrl(uploaded.file_path) : null),
            type: uploaded?.type || uploaded?.file_path?.split('.').pop()?.toLowerCase(), // infer type from extension
            rejection_reason: uploaded?.rejection_reason // Pass rejection reason explicitly
        });
        return acc;
    }, {});

    // Recalculate accurately based on the reduced list
    // We can just iterate the generated `groupedDocs` to count
    let realMissingCount = 0;
    let realPendingReviewCount = 0;

    Object.values(groupedDocs).forEach((docs: any) => {
        docs.forEach((d: any) => {
            if (d.status === 'uploaded') realPendingReviewCount++;
            if (d.status === 'missing' || d.status === 'rejected' || d.status === 'pending') {
                if (d.required) realMissingCount++; // Only count required docs as missing issues
            }
        });
    });

    const getStatusConfig = () => {
        if (realPendingReviewCount > 0) return { variant: 'warning', label: 'Docs em Análise', color: 'text-amber-700 bg-amber-50' };
        if (realMissingCount > 0) return { variant: 'danger', label: 'Docs Faltantes', color: 'text-red-700 bg-red-50' };

        if (student.status === 'approved') return { variant: 'success', label: 'Matriculado', color: 'text-emerald-700 bg-emerald-50' };
        if (student.status === 'draft') return { variant: 'neutral', label: 'Rascunho', color: 'text-gray-600 bg-gray-100' };
        if (student.status === 'sent') return { variant: 'warning', label: 'Em Análise', color: 'text-amber-700 bg-amber-50' };

        return { variant: 'neutral', label: student.status, color: 'text-gray-600 bg-gray-100' };
    };

    const statusConfig = getStatusConfig();

    // Ensure groups exist even if empty
    const docGroups = [
        { title: 'Identificação', docs: groupedDocs['Identificação'] || [] },
        { title: 'Acadêmico', docs: groupedDocs['Acadêmico'] || [] },
        { title: 'Saúde', docs: groupedDocs['Saúde'] || [] },
        { title: 'Solicitações Extras', docs: groupedDocs['Solicitações Extras'] || [] },
    ].filter(g => g.docs.length > 0)
        .map(g => ({
            ...g,
            status: g.docs.some((d: any) => d.status === 'rejected') ? 'error' :
                g.docs.some((d: any) => ['pending', 'uploaded', 'submitted'].includes(d.status)) ? 'warning' : 'success'
        }));

    const handleRequestDoc = async () => {
        if (!newDocName) return;
        setRequesting(true);
        try {
            // 1. Generate Key
            const key = `adhoc_${Date.now()}`;

            // 2. Prepare new documents object
            const currentDetails = enrollment?.details || {};
            const currentDocs = currentDetails.documents || {};
            const newDocs = {
                ...currentDocs,
                [key]: {
                    status: 'missing',
                    required: true,
                    label: newDocName,
                    created_at: new Date().toISOString(),
                    is_adhoc: true
                }
            };

            // 3. Update Supabase
            const { error } = await supabase
                .from('enrollments')
                .update({
                    details: {
                        ...currentDetails,
                        documents: newDocs
                    }
                })
                .eq('id', id);

            if (error) throw error;

            alert('Solicitação enviada com sucesso!');
            setIsRequestModalOpen(false);
            setNewDocName('');
            fetchData(); // Refresh UI

        } catch (err: any) {
            alert('Erro ao solicitar documento: ' + err.message);
        } finally {
            setRequesting(false);
        }
    };

    // Accordion State
    const [openBlocks, setOpenBlocks] = useState<Record<string, boolean>>({
        'Identificação': true,
        'Acadêmico': true,
        'Saúde': true,
        'Solicitações Extras': true
    });

    const toggleBlock = (title: string) => {
        setOpenBlocks(prev => ({ ...prev, [title]: !prev[title] }));
    };

    const handleValidate = async (doc: any) => {
        let signedUrl = doc.url;
        if (doc.file_path) {
            const { data, error } = await supabase.storage
                .from('documents')
                .createSignedUrl(doc.file_path, 600); // 10 minutes
            if (!error && data) {
                signedUrl = data.signedUrl;
            }
        }
        setValidatingDoc({ ...doc, signedUrl });
        setRejectionMode(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20 animate-fade-in">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 lg:px-8 py-3 lg:py-4 sticky top-0 z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
                <div className="flex items-center gap-3 lg:gap-4">
                    <Button variant="ghost" onClick={() => navigate('/secretaria')}>
                        <ArrowLeft className="w-5 h-5 text-gray-500" />
                    </Button>
                    <div className="flex items-center gap-2 lg:gap-3">
                        <img src={student.photo} className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gray-100" />
                        <div>
                            <h1 className="text-base lg:text-lg font-bold text-gray-900 leading-tight">{student.name}</h1>
                            <span className="text-[10px] lg:text-xs text-gray-500">{student.grade} • Matrícula #{id?.slice(0, 8)}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" className="text-gray-600">
                        <FileText className="w-4 h-4 mr-2" />
                        Ver Contrato
                    </Button>

                    {student.status === 'approved' ? (
                        <Button
                            className="bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-200"
                            onClick={handleRemindPending}
                        >
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Cobrar Pendências
                        </Button>
                    ) : (
                        <Button
                            className="bg-brand-600 hover:bg-brand-700 text-white"
                            onClick={handleFinalize}
                        >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Finalizar Matrícula
                        </Button>
                    )}
                </div>
            </div>

            {/* 3-Column Layout */}
            <div className="max-w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* LEFT: Student Summary (25%) */}
                <div className="lg:col-span-3 space-y-4 lg:space-y-6">
                    <Card className="p-4 lg:p-6">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Dados Principais</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-500">Responsável Financeiro</label>
                                <p className="font-medium text-gray-900">{student.parent}</p>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Contato</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="font-medium text-gray-900">{student.phone}</p>
                                    <button className="text-green-600 hover:bg-green-50 p-1 rounded-full"><MessageCircle className="w-4 h-4" /></button>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">{student.email}</p>
                            </div>

                            <hr className="border-gray-100" />

                            <div>
                                <label className="text-xs text-gray-500">Status Geral</label>
                                <div className="mt-1">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${statusConfig.color.replace('text-', 'border-').replace('bg-', 'bg-opacity-20 ')} ${statusConfig.color}`}>
                                        {statusConfig.label}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4 lg:p-6 bg-blue-50 border-blue-100">
                        <h3 className="text-sm font-bold text-blue-900 mb-2 lg:mb-3">Observações Internas</h3>
                        <p className="text-[11px] lg:text-xs text-blue-800 leading-relaxed">
                            Mãe solicitou desconto de irmãos. Aguardando aprovação da diretoria para liberar o contrato.
                        </p>
                        <div className="mt-2 lg:mt-3 text-[10px] text-blue-600 font-medium">
                            Última edição: Ontem por Ana
                        </div>
                    </Card>
                </div>

                {/* CENTER: Document Accordions (50%) */}
                <div className="lg:col-span-6 space-y-4">
                    {docGroups.length === 0 && !loading && (
                        <div className="text-center py-10 text-gray-400">
                            Nenhum documento encontrado.
                        </div>
                    )}

                    {docGroups.map((group) => (
                        <div key={group.title} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <button
                                onClick={() => toggleBlock(group.title)}
                                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    {group.status === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                                    {group.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                                    {group.status === 'warning' && <Clock className="w-5 h-5 text-amber-500" />}
                                    <span className="font-semibold text-gray-800">{group.title}</span>
                                </div>
                                {openBlocks[group.title] ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            </button>

                            {openBlocks[group.title] && (
                                <div className="p-4 space-y-3 animate-fade-in">
                                    {group.docs.map((doc: any) => (
                                        <DocItem
                                            key={doc.id}
                                            title={doc.title}
                                            status={doc.status}
                                            onAction={() => handleValidate(doc)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* RIGHT: Status Timeline (25%) */}
                <div className="lg:col-span-3">
                    <Card className="p-4 lg:p-6 sticky top-24">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Linha do Tempo</h3>

                        <div className="space-y-1">
                            {historyLoading && <p className="text-xs text-gray-400 p-2">Carregando histórico...</p>}

                            {!historyLoading && history.length === 0 && (
                                <p className="text-xs text-gray-400 p-2 italic">Nenhum evento registrado.</p>
                            )}

                            {history.map((h: any) => (
                                <TimelineItem
                                    key={h.id}
                                    date={new Date(h.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    title={h.title}
                                    desc={h.description}
                                    type={
                                        h.action_type === 'APPROVE_DOC' || h.action_type === 'STATUS_CHANGE' ? 'success' :
                                            h.action_type === 'REJECT_DOC' ? 'error' : 'neutral'
                                    }
                                    author={
                                        h.profiles?.name || h.profiles?.email || (h.action_type === 'UPLOAD' ? 'Responsável' : 'Sistema')
                                    }
                                />
                            ))}
                        </div>
                    </Card>

                    {/* Ad-Hoc Request Button */}
                    <Card className="p-4 lg:p-6 mt-4 border-dashed border-2 border-brand-200 bg-brand-50 hover:bg-brand-100 transition-colors cursor-pointer group" onClick={() => setIsRequestModalOpen(true)}>
                        <div className="flex items-center gap-2 lg:gap-3 justify-center text-brand-700 text-sm font-medium">
                            <div className="p-1.5 lg:p-2 bg-white rounded-full shadow-sm text-brand-600 group-hover:scale-110 transition-transform">
                                <Plus className="w-4 h-4 lg:w-5 lg:h-5" />
                            </div>
                            Solicitar Documento Extra
                        </div>
                    </Card>
                </div>
            </div>

            {/* Ad-Hoc Request MODAL */}
            <Modal
                isOpen={isRequestModalOpen}
                onClose={() => setIsRequestModalOpen(false)}
                title="Solicitar Documento Extra"
                footer={
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setIsRequestModalOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={handleRequestDoc}
                            disabled={!newDocName || requesting}
                            className="bg-brand-600 text-white"
                        >
                            {requesting ? 'Enviando...' : 'Solicitar'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Você está prestes a solicitar um documento adicional que <strong>não está na lista padrão</strong>.
                        Isso criará um novo campo de upload no link de matrícula do responsável.
                    </p>

                    <div>
                        <Input
                            label="Nome do Documento / Solicitação"
                            placeholder="Ex: Laudo Fonoaudiólogo, Comprovante de Renda..."
                            value={newDocName}
                            onChange={(e) => setNewDocName(e.target.value)}
                            autoFocus
                        />
                        <p className="text-xs text-gray-500 mt-1">Seja claro no nome para que o pai entenda o que deve enviar.</p>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-lg flex gap-3 items-start border border-blue-100">
                        <MessageCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-blue-800">Notificação Automática</p>
                            <p className="text-xs text-blue-700">
                                Ao confirmar, enviaremos um WhatsApp para o responsável informando sobre esta nova solicitação.
                            </p>
                        </div>
                    </div>
                </div>
            </Modal>


            {/* 4. Split Screen Validation Modal */}
            {validatingDoc && (
                <div className="fixed inset-0 z-50 flex animate-fade-in">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/80" onClick={() => setValidatingDoc(null)} />

                    {/* Panel Container */}
                    <div className="relative w-full h-full flex flex-col md:flex-row bg-white overflow-hidden">

                        {/* LEFT: Document Preview (70%) */}
                        <div className="flex-1 bg-gray-900 relative flex items-center justify-center p-2 md:p-8 overflow-hidden group/preview">
                            <div className="absolute top-4 left-4 z-10 text-white font-mono text-xs opacity-50 bg-black/50 px-2 py-1 rounded">
                                PREVIEW: {validatingDoc.title}
                            </div>

                            {validatingDoc.signedUrl || validatingDoc.url ? (
                                (validatingDoc.signedUrl || validatingDoc.url).toLowerCase().match(/\.(jpeg|jpg|png|webp|.*token=.*)$/) ? (
                                    <img
                                        src={validatingDoc.signedUrl || validatingDoc.url}
                                        alt="Documento"
                                        className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center relative">
                                        <iframe
                                            src={validatingDoc.signedUrl || validatingDoc.url}
                                            className="w-full h-full bg-white rounded shadow-lg border-none"
                                            title="PDF Preview"
                                        />
                                        <div className="absolute bottom-6 z-20 opacity-0 group-hover/preview:opacity-100 transition-opacity">
                                            <a href={validatingDoc.signedUrl || validatingDoc.url} target="_blank" rel="noopener noreferrer" className="bg-brand-600 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-brand-700 shadow-lg transition-all transform hover:scale-105">
                                                Abrir PDF Completo ↗
                                            </a>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <div className="bg-white/10 p-8 rounded-xl text-center backdrop-blur-sm">
                                    <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                                    <p className="text-gray-400 font-medium">Arquivo não encontrado</p>
                                    <p className="text-xs text-gray-500 mt-1">URL inválida ou documento não enviado.</p>
                                </div>
                            )}

                            {/* Zoom Controls (Mock - Visual Only for now) */}
                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
                                <button className="text-white hover:text-brand-400 font-bold">-</button>
                                <span className="text-white text-xs px-2 py-1">100%</span>
                                <button className="text-white hover:text-brand-400 font-bold">+</button>
                            </div>
                        </div>

                        {/* RIGHT: Action Panel (30%) */}
                        <div className="w-full md:w-[400px] bg-white border-l border-gray-200 flex flex-col shadow-2xl z-20">

                            {/* Header */}
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                                <div>
                                    <h2 className="font-bold text-gray-900">{validatingDoc.title}</h2>
                                    <p className="text-xs text-gray-500">Enviado em 20/01/2026</p>
                                </div>
                                <button onClick={() => setValidatingDoc(null)} className="p-2 hover:bg-gray-100 rounded-full">
                                    <span className="sr-only">Fechar</span>
                                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Análise</label>
                                    <p className="text-sm text-gray-600 mt-2">
                                        Verifique se o documento está legível e se os dados conferem com o formulário.
                                    </p>
                                    {validatingDoc?.status === 'rejected' && (
                                        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                                            <h5 className="text-xs font-bold text-red-800 flex items-center gap-1 mb-1">
                                                <AlertCircle className="w-3 h-3" />
                                                Motivo da Rejeição Anterior:
                                            </h5>
                                            <p className="text-sm text-red-700 font-medium">
                                                "{validatingDoc.rejection_reason || 'Motivo não registrado'}"
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Rejection Flow */}
                                {rejectionMode ? (
                                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 animate-fade-in-up">
                                        <h4 className="text-sm font-bold text-red-900 mb-3 flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" />
                                            Motivo da Rejeição
                                        </h4>
                                        <div className="space-y-2">
                                            {['Legibilidade Ruim / Foto Embaçada', 'Documento Vencido', 'Falta Assinatura', 'Documento Incorreto'].map(reason => (
                                                <label key={reason} className={`flex items-center gap-3 p-2 bg-white rounded border cursor-pointer hover:border-red-300 ${rejectionReason === reason ? 'border-red-500 ring-1 ring-red-500' : 'border-red-100'}`}>
                                                    <input
                                                        type="radio"
                                                        name="reason"
                                                        className="text-red-600 focus:ring-red-500"
                                                        onChange={() => setRejectionReason(reason)}
                                                        checked={rejectionReason === reason}
                                                    />
                                                    <span className="text-sm text-gray-700">{reason}</span>
                                                </label>
                                            ))}
                                            <textarea
                                                className="w-full mt-2 p-2 text-sm border border-red-200 rounded outline-none focus:border-red-400"
                                                placeholder="Observação adicional ou motivo personalizado..."
                                                rows={2}
                                                value={rejectionReason}
                                                onChange={(e) => setRejectionReason(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex gap-2 mt-4">
                                            <Button variant="outline" className="flex-1 border-red-200 text-red-700 hover:bg-red-100" onClick={() => setRejectionMode(false)}>Cancelar</Button>
                                            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                                disabled={!rejectionReason}
                                                onClick={() => handleRejectDoc(validatingDoc.id, validatingDoc.title, rejectionReason)}>
                                                Confirmar Rejeição
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-gray-50 p-4 rounded-xl border border-dashed border-gray-200 text-center py-8">
                                        <p className="text-sm text-gray-400">Nenhuma observação registrada.</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer Actions */}
                            {!rejectionMode && (
                                <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
                                    <Button
                                        variant="outline"
                                        className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                                        onClick={() => setRejectionMode(true)}
                                    >
                                        Rejeitar (X)
                                    </Button>
                                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                                        onClick={() => {
                                            handleApproveDoc(validatingDoc.id, validatingDoc.title);
                                            setValidatingDoc(null);
                                        }}
                                    >
                                        Aprovar (✓)
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* DEBUG PANEL (Data Inspector) */}
            <div className="max-w-full mx-auto px-6 mt-8 pb-12 opacity-50 hover:opacity-100 transition-opacity">
                <details className="cursor-pointer">
                    <summary className="text-xs text-brand-600 font-bold uppercase tracking-widest select-none">🛠️ Debug Info (Clique para expandir)</summary>
                    <div className="mt-4 p-4 bg-slate-900 text-emerald-400 rounded-xl font-mono text-xs overflow-auto max-h-96 shadow-2xl border border-slate-800">
                        <p className="mb-2"><strong className="text-slate-500">ID Matrícula:</strong> {id}</p>
                        <p className="mb-2"><strong className="text-slate-500">ID Escola:</strong> {enrollment?.school_id}</p>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <strong className="block text-slate-200 mb-1 border-b border-slate-700 pb-1">Docs do Aluno (DB)</strong>
                                {Object.keys(uploadedDocs).length === 0 ? <span className="text-gray-500">Nenhum</span> : (
                                    <ul className="list-disc pl-4 space-y-1">
                                        {Object.keys(uploadedDocs).map(k => (
                                            <li key={k}>
                                                <span className="text-yellow-300">{k}</span>
                                                <span className="text-gray-500"> {`->`} </span>
                                                <span className="text-blue-300">{getDocGroup(k)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div>
                                <strong className="block text-slate-200 mb-1 border-b border-slate-700 pb-1">Templates (Config)</strong>
                                <ul className="list-disc pl-4 space-y-1 text-gray-400">
                                    {docTemplates.map((t: any) => <li key={t.id}>{t.id} ({t.label})</li>)}
                                </ul>
                            </div>
                        </div>

                        <hr className="border-slate-700 my-4" />
                        <strong className="block text-slate-200 mb-2">Raw Details JSON:</strong>
                        <pre className="text-[10px] text-gray-500 overflow-x-auto">{JSON.stringify(enrollment?.details, null, 2)}</pre>
                    </div>
                </details>
            </div>
        </div>
    );
};
