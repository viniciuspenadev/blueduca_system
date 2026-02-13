import { type FC, useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { Button } from '../../components/ui';
import {
    FileText, Plus, Trash2, Save,
    Loader2, Info
} from 'lucide-react';

interface DocTemplate {
    id: string;
    label: string;
    required: boolean;
    description?: string;
}

export const EnrollmentDocsSettings: FC = () => {
    const { currentSchool } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [docs, setDocs] = useState<DocTemplate[]>([]);

    // Default Template for new setups
    const DEFAULT_DOCS: DocTemplate[] = [
        { id: 'student_id', label: 'Certidão de Nascimento / RG do Aluno', required: true },
        { id: 'parent_id', label: 'RG / CPF do Responsável', required: true },
        { id: 'residency', label: 'Comprovante de Residência', required: true },
        { id: 'vaccination', label: 'Carteira de Vacinação', required: true },
        { id: 'transfer', label: 'Declaração de Transferência / Histórico', required: true },
        { id: 'photo', label: 'Foto 3x4 do Aluno', required: true }
    ];

    useEffect(() => {
        if (currentSchool) loadSettings();
    }, [currentSchool]);

    const loadSettings = async () => {
        try {
            const { data } = await supabase
                .from('app_settings')
                .select('value')
                .eq('school_id', currentSchool?.id)
                .eq('key', 'enrollment_docs_template')
                .maybeSingle();

            if (data) {
                let val = data.value;

                // Recursively parse if string (handles double/triple encoding)
                let attempts = 0;
                while (typeof val === 'string' && attempts < 3) {
                    try {
                        const parsed = JSON.parse(val);
                        val = parsed;
                    } catch (e) {
                        console.error('Parse error:', e);
                        break;
                    }
                    attempts++;
                }

                if (Array.isArray(val)) {
                    setDocs(val);
                } else {
                    console.warn('Data loaded but not an array:', val);
                    setDocs(DEFAULT_DOCS);
                }
            } else {
                setDocs(DEFAULT_DOCS);
            }
        } catch (err) {
            console.error('Error loading docs settings:', err);
            setDocs(DEFAULT_DOCS);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                school_id: currentSchool?.id,
                key: 'enrollment_docs_template',
                value: docs,
                description: 'Template de documentos exigidos na matrícula',
                updated_at: new Date().toISOString()
            };

            // Check if exists
            const { count } = await supabase
                .from('app_settings')
                .select('*', { count: 'exact', head: true })
                .eq('school_id', currentSchool?.id)
                .eq('key', 'enrollment_docs_template');

            let error;

            if (count && count > 0) {
                // Update existing using Composite Key
                const { error: updateError } = await supabase
                    .from('app_settings')
                    .update(payload)
                    .eq('school_id', currentSchool?.id)
                    .eq('key', 'enrollment_docs_template');
                error = updateError;
            } else {
                // Insert new
                const { error: insertError } = await supabase
                    .from('app_settings')
                    .insert(payload);
                error = insertError;
            }

            if (error) throw error;

            alert('Configuração salva com sucesso!');
        } catch (err: any) {
            alert('Erro ao salvar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const addDoc = () => {
        const newId = `custom_${Date.now()}`;
        setDocs([...docs, { id: newId, label: 'Novo Documento', required: true }]);
    };

    const updateDoc = (index: number, field: keyof DocTemplate, value: any) => {
        const newDocs = [...docs];
        newDocs[index] = { ...newDocs[index], [field]: value };
        setDocs(newDocs);
    };

    const removeDoc = (index: number) => {
        if (confirm('Tem certeza que deseja remover este documento da lista de exigências?')) {
            const newDocs = [...docs];
            newDocs.splice(index, 1);
            setDocs(newDocs);
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-brand-600" /></div>;

    return (
        <div className="space-y-6 animate-fade-in max-w-4xl">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                <div className="p-2 bg-blue-100 rounded-lg h-fit text-blue-600">
                    <Info className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-blue-900">Personalização de Documentos</h3>
                    <p className="text-sm text-blue-700 mt-1">
                        Defina quais documentos são solicitados aos pais durante o processo de matrícula online.
                        Alterações aqui refletem imediatamente para novos acessos aos links de matrícula.
                    </p>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Lista de Documentos
                    </h3>
                    <Button size="sm" onClick={addDoc} variant="outline" className="bg-white hover:bg-gray-50">
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Documento
                    </Button>
                </div>

                <div className="divide-y divide-gray-100">
                    {docs.map((doc, index) => (
                        <div key={doc.id} className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center group hover:bg-gray-50 transition-colors">
                            <div className="p-2 bg-gray-100 rounded text-gray-400">
                                <FileText className="w-5 h-5" />
                            </div>

                            <div className="flex-1 w-full space-y-2 md:space-y-0 md:flex md:gap-4">
                                <div className="flex-1">
                                    <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1 block">Nome do Documento</label>
                                    <input
                                        type="text"
                                        value={doc.label}
                                        onChange={(e) => updateDoc(index, 'label', e.target.value)}
                                        className="w-full bg-transparent border-b border-gray-300 focus:border-brand-500 outline-none py-1 text-gray-900 font-medium"
                                        placeholder="Ex: Comprovante de Vacinação"
                                    />
                                </div>
                                <div className="w-full md:w-48">
                                    <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1 block">Identificador (Sistema)</label>
                                    <input
                                        type="text"
                                        value={doc.id}
                                        readOnly
                                        disabled
                                        className="w-full bg-transparent border-b border-gray-200 text-gray-500 text-sm py-1 font-mono cursor-not-allowed"
                                        title="Identificador interno gerado automaticamente"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end mt-2 md:mt-0">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={doc.required}
                                        onChange={(e) => updateDoc(index, 'required', e.target.checked)}
                                        className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 border-gray-300"
                                    />
                                    <span className={`text-sm ${doc.required ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                                        Obrigatório
                                    </span>
                                </label>

                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-400 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => removeDoc(index)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ))}

                    {docs.length === 0 && (
                        <div className="p-8 text-center text-gray-400">
                            Nenhum documento configurado. Adicione um novo item.
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                    <Button onClick={handleSave} disabled={saving} className="bg-brand-600 hover:bg-brand-700 text-white min-w-[150px]">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Salvar Configuração
                    </Button>
                </div>
            </div>
        </div>
    );
};
