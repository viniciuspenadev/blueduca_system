import { type FC, useState, useEffect } from 'react';
import { useStudent } from '../../contexts/StudentContext';
import { supabase } from '../../services/supabase';
import { FileText, CheckCircle, AlertCircle, Clock, Upload, Download } from 'lucide-react';

const DocStatusIcon = ({ status }: { status: string }) => {
    switch (status) {
        case 'approved': return <div className="p-2 bg-emerald-50 rounded-full"><CheckCircle className="w-5 h-5 text-emerald-500" /></div>;
        case 'rejected': return <div className="p-2 bg-red-50 rounded-full"><AlertCircle className="w-5 h-5 text-red-500" /></div>;
        case 'submitted':
        case 'uploaded': return <div className="p-2 bg-amber-50 rounded-full"><Clock className="w-5 h-5 text-amber-500" /></div>;
        default: return <div className="p-2 bg-gray-50 rounded-full"><div className="w-5 h-5 rounded-full border-2 border-gray-300 border-dashed" /></div>;
    }
};

export const ParentDocuments: FC = () => {
    const { selectedStudent } = useStudent();
    const [enrollment, setEnrollment] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
    const [docTemplates, setDocTemplates] = useState<any[]>([]);

    useEffect(() => {
        if (selectedStudent) fetchEnrollment();
    }, [selectedStudent]);

    const fetchEnrollment = async () => {
        try {
            const { data, error } = await supabase
                .from('enrollments')
                .select('*')
                .eq('student_id', selectedStudent?.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                setEnrollment(data);
                if (data.school_id) {
                    const { data: settingsData } = await supabase
                        .from('app_settings')
                        .select('value')
                        .eq('school_id', data.school_id)
                        .eq('key', 'enrollment_docs_template')
                        .maybeSingle();

                    if (settingsData?.value) {
                        let val = settingsData.value;
                        try {
                            if (typeof val === 'string') val = JSON.parse(val);
                            if (Array.isArray(val)) setDocTemplates(val);
                        } catch (e) { }
                    }
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (docId: string, file: File) => {
        if (!enrollment) return;

        const MAX_SIZE = 5 * 1024 * 1024;
        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'image/jpg', 'image/webp'];

        if (file.size > MAX_SIZE) {
            alert('O arquivo é muito grande. O tamanho máximo permitido é 5MB.');
            return;
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            alert('Tipo de arquivo não permitido. Apenas Imagens (JPG, PNG) ou PDF.');
            return;
        }

        setUploadingDoc(docId);

        try {
            const sanitizedOriginalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const fileName = `${docId}_${Date.now()}_${sanitizedOriginalName}`;
            const filePath = `enrollments/${enrollment.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const publicUrl = supabase.storage.from('documents').getPublicUrl(filePath).data.publicUrl;

            const newDetails = {
                ...enrollment.details,
                documents: {
                    ...enrollment.details?.documents,
                    [docId]: {
                        status: 'uploaded',
                        url: publicUrl,
                        uploaded_at: new Date().toISOString(),
                        label: docTemplates.find(t => t.id === docId)?.label || docId.replace(/_/g, ' ')
                    }
                }
            };

            await supabase.from('enrollments').update({ details: newDetails }).eq('id', enrollment.id);

            await supabase.from('enrollment_history').insert({
                enrollment_id: enrollment.id,
                school_id: enrollment.school_id,
                action_type: 'UPLOAD',
                title: 'Documento Reenviado (App)',
                description: `O responsável reenviou o documento via App: ${docId}`,
                metadata: { doc_id: docId },
                created_by: (await supabase.auth.getUser()).data.user?.id
            });

            fetchEnrollment();
            alert('Documento enviado com sucesso!');

        } catch (error: any) {
            alert('Erro no upload: ' + error.message);
        } finally {
            setUploadingDoc(null);
        }
    };

    const uploadedDocs = enrollment?.details?.documents || {};
    const defaultTemplates = [
        { id: 'transfer', label: 'Declaração de Transferência', required: true },
        { id: 'report_card', label: 'Histórico Escolar', required: true },
        { id: 'vaccination', label: 'Carteirinha de Vacinação', required: true },
        { id: 'cpf', label: 'CPF do Aluno', required: false },
        { id: 'residency', label: 'Comprovante de Residência', required: true }
    ];

    const templatesToUse = docTemplates.length > 0 ? docTemplates : defaultTemplates;

    // Check if contract documents should be visible to parent
    const hasContractDraft = !!uploadedDocs['contract_draft'];

    // Explicitly add contract_signed to list if school provided a draft
    const allDocKeys = new Set([...templatesToUse.map(t => t.id), ...Object.keys(uploadedDocs)]);
    if (hasContractDraft) {
        allDocKeys.add('contract_signed');
    }

    const docList = Array.from(allDocKeys).map((key) => {
        const template = templatesToUse.find(t => t.id === key);
        const uploaded = uploadedDocs[key];

        let title = template?.label || uploaded?.label || key.replace(/_/g, ' ');
        if (key === 'contract_draft') title = '📄 Minuta do Contrato';
        if (key === 'contract_signed') title = '✍️ Contrato Assinado';

        return {
            id: key,
            title,
            status: uploaded?.status || 'missing',
            reason: uploaded?.rejection_reason,
            required: template?.required || key === 'contract_signed',
            url: uploaded?.url || (uploaded?.file_path ? supabase.storage.from('documents').getPublicUrl(uploaded.file_path).data.publicUrl : null)
        };
    }).sort((a, b) => {
        const score = (s: string) => s === 'rejected' ? 0 : s === 'missing' ? 1 : 2;
        return score(a.status) - score(b.status);
    });

    return (
        <div className="space-y-8 pb-24">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-brand-100 rounded-xl text-brand-600">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Documentos</h2>
                        <p className="text-xs text-gray-400 font-medium tracking-tight">Mantenha a secretaria atualizada</p>
                    </div>
                </div>

                {!loading && enrollment && (
                    <div className="flex justify-between items-center bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Validados</span>
                        <span className="text-xs font-black text-brand-600">
                            {docList.filter(d => d.status === 'approved').length}/{docList.length}
                        </span>
                    </div>
                )}
            </div>

            <div className="px-1 max-w-2xl mx-auto space-y-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full mb-4"></div>
                        <p className="text-gray-500 font-bold tracking-tight">Buscando documentos...</p>
                    </div>
                ) : !enrollment ? (
                    <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 text-center">
                        <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                        <h2 className="text-lg font-bold text-gray-900 mb-2">Nenhuma Matrícula</h2>
                        <p className="text-gray-500 text-sm">Não encontramos pendências documentais.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {docList.map((doc) => {
                            const isRejected = doc.status === 'rejected';
                            const isMissing = doc.status === 'missing';
                            const isActionable = isRejected || isMissing;

                            return (
                                <div
                                    key={doc.id}
                                    className={`
                                        bg-white rounded-2xl p-5 shadow-sm border transition-all
                                        ${isRejected ? 'border-red-200 bg-red-50/10' : 'border-gray-100'}
                                    `}
                                >
                                    <div className="flex items-start gap-4">
                                        <DocStatusIcon status={doc.status} />

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <h3 className="font-bold text-gray-900 text-base leading-snug break-words">
                                                    {doc.title}
                                                </h3>
                                                {doc.required && (
                                                    <span className="shrink-0 text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                                        Obrigatório
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-xs">
                                                {isRejected ? (
                                                    <span className="text-red-500 font-black uppercase tracking-wider">Recusado</span>
                                                ) : isMissing ? (
                                                    <span className="text-gray-400 font-bold uppercase tracking-wider">Pendente</span>
                                                ) : doc.status === 'approved' ? (
                                                    <span className="text-emerald-600 font-black uppercase tracking-wider">Validado</span>
                                                ) : (
                                                    <span className="text-amber-600 font-black uppercase tracking-wider">Em análise</span>
                                                )}
                                            </div>

                                            {isRejected && doc.reason && (
                                                <div className="mt-3 bg-red-50 p-3 rounded-xl text-xs text-red-700 border border-red-100">
                                                    <p>{doc.reason}</p>
                                                </div>
                                            )}

                                            {isActionable && (
                                                <div className="mt-4 flex flex-col gap-2">
                                                    {doc.id === 'contract_signed' && !uploadedDocs['contract_draft'] ? (
                                                        <p className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded-lg border italic">
                                                            Aguardando a escola disponibilizar a minuta para assinatura.
                                                        </p>
                                                    ) : (
                                                        <>
                                                            <input
                                                                type="file"
                                                                id={`file-${doc.id}`}
                                                                className="hidden"
                                                                accept="image/jpeg,image/png,application/pdf"
                                                                onChange={(e) => {
                                                                    if (e.target.files?.[0]) handleFileUpload(doc.id, e.target.files[0]);
                                                                }}
                                                                disabled={!!uploadingDoc}
                                                            />
                                                            <label
                                                                htmlFor={`file-${doc.id}`}
                                                                className={`
                                                                    w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl cursor-pointer transition-all text-sm font-black uppercase tracking-widest
                                                                    ${uploadingDoc === doc.id
                                                                        ? 'bg-gray-100 text-gray-400'
                                                                        : 'bg-brand-600 text-white hover:bg-brand-700 active:scale-95 shadow-lg shadow-brand-100'}
                                                                `}
                                                            >
                                                                {uploadingDoc === doc.id ? (
                                                                    <span>Enviando...</span>
                                                                ) : (
                                                                    <>
                                                                        <Upload className="w-4 h-4" />
                                                                        <span>{isRejected ? 'Reenviar' : 'Enviar Documento'}</span>
                                                                    </>
                                                                )}
                                                            </label>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {!isActionable && doc.id === 'contract_draft' && doc.url && (
                                                <div className="mt-4">
                                                    <a
                                                        href={doc.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all text-sm font-black uppercase tracking-widest shadow-lg shadow-blue-100"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        Baixar Minuta
                                                    </a>
                                                    <p className="text-[10px] text-center text-gray-400 mt-2">
                                                        Baixe, assine e envie no campo "Contrato Assinado" abaixo.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
