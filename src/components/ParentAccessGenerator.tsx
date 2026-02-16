import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { Button, Input, Card } from './ui';
import { useToast } from '../contexts/ToastContext';
import { Loader2, Copy, Send, CheckCircle, UserPlus, Lock, AlertCircle, Info } from 'lucide-react';
import { isValidCPF, formatCPF } from '../utils/validators';

interface ParentAccessGeneratorProps {
    studentId: string;
    studentName: string;
    responsibleEmail?: string;
    responsibleName?: string;
    responsibleCpf?: string; // Added CPF
    onClose?: () => void;
    onSuccess?: () => void;
}

export const ParentAccessGenerator = ({
    studentId,
    studentName,
    responsibleEmail = '',
    responsibleName = 'Responsável',
    responsibleCpf = '',
    onClose,
    onSuccess
}: ParentAccessGeneratorProps) => {
    const { addToast } = useToast();
    const [step, setStep] = useState<'form' | 'confirmation' | 'success'>('form');
    const [loading, setLoading] = useState(false);
    const [isExistingUser, setIsExistingUser] = useState(false);
    const [foundUser, setFoundUser] = useState<{ id: string, name: string, email: string, cpf?: string } | null>(null);

    const [formData, setFormData] = useState({
        email: responsibleEmail,
        password: '',
        name: responsibleName,
        cpf: responsibleCpf
    });

    // Auto-generate a strong but readable password
    const generatePassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O, 0, I, l
        let pass = 'Escola';
        for (let i = 0; i < 4; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setFormData(prev => ({ ...prev, password: pass }));
    };

    // Initial Check on Mount
    useEffect(() => {
        const checkInitialUser = async () => {
            if (!responsibleCpf && !responsibleEmail) return;

            setLoading(true);
            try {
                const cleanCpf = responsibleCpf?.replace(/\D/g, '');
                let existingData: any = null;

                // 1. Check CPF
                if (cleanCpf && cleanCpf.length === 11) {
                    const { data } = await supabase
                        .from('profiles')
                        .select('id, name, email, cpf')
                        .eq('cpf', cleanCpf)
                        .maybeSingle();
                    if (data) existingData = data;
                }

                // 2. Check Email
                if (!existingData && responsibleEmail) {
                    const { data } = await supabase
                        .from('profiles')
                        .select('id, name, email, cpf')
                        .eq('email', responsibleEmail)
                        .maybeSingle();
                    if (data) existingData = data;
                }

                if (existingData) {
                    setFoundUser(existingData);
                    setStep('confirmation'); // Go straight to confirmation view (reused)
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        checkInitialUser();
    }, [responsibleCpf, responsibleEmail]);

    // Step 1: Check if user exists before doing anything (Manual Form Submit)
    const checkAndSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setFoundUser(null);

        try {
            // ... (Same logic as before for manual entry)
            const cleanCpf = formData.cpf.replace(/\D/g, '');
            let existingData: any = null;

            if (cleanCpf && cleanCpf.length === 11) {
                const { data } = await supabase.from('profiles').select('id, name, email, cpf').eq('cpf', cleanCpf).maybeSingle();
                if (data) existingData = data;
            }
            if (!existingData) {
                const { data } = await supabase.from('profiles').select('id, name, email, cpf').eq('email', formData.email).maybeSingle();
                if (data) existingData = data;
            }

            if (existingData) {
                setFoundUser(existingData);
                setStep('confirmation');
            } else {
                await executeAction(null);
            }

        } catch (err: any) {
            console.error(err);
            addToast('error', 'Erro: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Execute operation (Link Existing OR Create New)
    const executeAction = async (existingId: string | null) => {
        setLoading(true);
        try {
            let userId = existingId;
            let isNewUser = !existingId;
            const cleanCpf = formData.cpf.replace(/\D/g, '');

            // A. Create User if needed
            if (!userId) {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
                if (!supabaseUrl || !supabaseKey) throw new Error("Missing Env Vars");

                const tempClient = createClient(supabaseUrl, supabaseKey, {
                    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
                });

                const { data: authData, error: authError } = await tempClient.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            name: formData.name,
                            role: 'PARENT'
                        }
                    }
                });

                if (authError) {
                    if (authError.message.includes('already registered')) {
                        throw new Error('Email já registrado (conflito entre Auth e Profiles). Contate suporte.');
                    }
                    throw authError;
                }
                if (!authData.user) throw new Error("Falha ao criar usuário.");
                userId = authData.user.id;
            }

            // B. Link to Student
            const { error: linkError } = await supabase.rpc('admin_add_guardian', {
                p_student_id: studentId,
                p_guardian_id: userId,
                p_relationship: 'financial_responsible'
            });

            if (linkError) throw linkError;

            // C. Update CPF if missing/changed (only if valid)
            if (cleanCpf && cleanCpf.length === 11) {
                await supabase.from('profiles').update({ cpf: cleanCpf }).eq('id', userId);
            }

            // Finish
            setIsExistingUser(!isNewUser);
            setStep('success');
            onSuccess?.();
            addToast('success', isNewUser ? 'Acesso criado e vinculado!' : 'Vínculo realizado com sucesso!');

        } catch (err: any) {
            console.error(err);
            addToast('error', 'Erro: ' + (err.message || 'Falha na operação'));
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        let text = `*Acesso ao Portal do Aluno* 🎓\n\nOlá, segue seu acesso para acompanhar o aluno *${studentName}*:\n\n🔗 Link: https://escola-app.com/login (Exemplo)\n📧 Email: ${formData.email}`;

        if (!isExistingUser) {
            text += `\n🔑 Senha: ${formData.password}`;
        } else {
            text += `\n🔑 Senha: (Sua senha atual)`;
        }

        navigator.clipboard.writeText(text);
        addToast('success', 'Credenciais copiadas!');
    };

    const sendWhatsapp = () => {
        let text = `Olá! Segue seu acesso ao Portal do Aluno para acompanhar *${studentName}*:%0A%0A📧 Login: ${formData.email}`;

        if (!isExistingUser) {
            text += `%0A🔑 Senha: ${formData.password}`;
        } else {
            text += `%0A🔑 Senha: (Utilize sua senha atual)`;
        }

        text += `%0A%0AAcesse em: [Link do App]`;
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    if (step === 'confirmation' && foundUser) {
        const normalize = (s: string) => s ? s.toLowerCase().trim() : '';
        const normalizeCpf = (s: string) => s ? s.replace(/\D/g, '') : '';

        const dbCpf = foundUser.cpf || '';
        const formCpf = formData.cpf || '';

        const isCpfMatch = normalizeCpf(dbCpf) === normalizeCpf(formCpf);
        const isEmailMatch = normalize(foundUser.email) === normalize(formData.email);
        const isNameSimilar = normalize(foundUser.name) === normalize(formData.name);

        const hasConflict = !isCpfMatch || !isEmailMatch;

        return (
            <div className={`p-6 rounded-xl border animate-fade-in text-center ${hasConflict ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 animate-bounce ${hasConflict ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                    <AlertCircle className="w-6 h-6" />
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {hasConflict ? 'Atenção: Divergência de Dados' : 'Usuário Identificado'}
                </h3>

                <p className="text-sm text-gray-600 mb-6">
                    {hasConflict
                        ? 'Encontramos um cadastro, mas alguns dados não batem. Verifique antes de vincular.'
                        : 'Encontramos o responsável no sistema. Confirme os dados para vincular.'}
                </p>

                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6 shadow-sm text-left text-sm">
                    {/* Header Table */}
                    <div className="grid grid-cols-10 bg-gray-50 border-b p-2 font-bold text-gray-500 text-xs uppercase tracking-wider">
                        <div className="col-span-3">Dado</div>
                        <div className="col-span-7">Status da Validação</div>
                    </div>

                    {/* CPF Check */}
                    <div className="grid grid-cols-10 p-3 border-b items-center gap-2">
                        <div className="col-span-3 font-medium text-gray-700">CPF</div>
                        <div className="col-span-7 flex items-center gap-2">
                            {isCpfMatch ? (
                                <span className="flex items-center gap-1 text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full text-xs">
                                    <CheckCircle className="w-3 h-3" /> Confere
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full text-xs">
                                    <AlertCircle className="w-3 h-3" /> Divergente
                                </span>
                            )}
                            <span className="text-gray-400 text-xs">({foundUser.cpf || 'Sem CPF'})</span>
                        </div>
                    </div>

                    {/* Email Check */}
                    <div className="grid grid-cols-10 p-3 border-b items-center gap-2">
                        <div className="col-span-3 font-medium text-gray-700">Email</div>
                        <div className="col-span-7 flex items-center gap-2">
                            {isEmailMatch ? (
                                <span className="flex items-center gap-1 text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full text-xs">
                                    <CheckCircle className="w-3 h-3" /> Confere
                                </span>
                            ) : (
                                <div className="flex flex-col">
                                    <span className="flex items-center gap-1 text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full text-xs w-fit">
                                        <Info className="w-3 h-3" /> Diferente
                                    </span>
                                    <span className="text-xs text-gray-400 mt-0.5">Banco: {foundUser.email}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Name Preview */}
                    <div className="grid grid-cols-10 p-3 items-center gap-2">
                        <div className="col-span-3 font-medium text-gray-700">Nome</div>
                        <div className="col-span-7 text-gray-600">
                            {foundUser.name}
                            {!isNameSimilar && <span className="text-xs text-amber-500 ml-1">(Diferente do digitado)</span>}
                        </div>
                    </div>
                </div>

                {hasConflict && !isCpfMatch && (
                    <div className="mb-4 bg-red-50 p-3 rounded-lg border border-red-100 text-red-700 text-xs text-left">
                        <strong>Cuidado:</strong> O CPF do cadastro encontrado é diferente do CPF informado agora.
                        Isso pode indicar que o email pertence a outra pessoa. Tem certeza que deseja vincular?
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setStep('form')}
                            className="flex-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={() => executeAction(foundUser.id)}
                            className={`flex-1 text-white ${hasConflict ? 'bg-amber-600 hover:bg-amber-700' : 'bg-brand-600 hover:bg-brand-700'}`}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                            {hasConflict ? 'Confirmar Mesmo Assim' : 'Confirmar Vínculo'}
                        </Button>
                    </div>

                    <div className="relative flex items-center gap-2 py-2">
                        <div className="h-px bg-gray-200 flex-1"></div>
                        <span className="text-xs text-gray-400 uppercase font-bold">Ou</span>
                        <div className="h-px bg-gray-200 flex-1"></div>
                    </div>

                    <Button
                        variant="outline"
                        onClick={() => {
                            setStep('form');
                            setFormData({
                                name: '',
                                email: '',
                                cpf: '',
                                password: ''
                            });
                            generatePassword();
                        }}
                        className="w-full border-dashed text-gray-500 hover:text-brand-600 hover:border-brand-300"
                    >
                        Criar Novo Acesso (Outra Pessoa)
                    </Button>
                </div>
            </div>
        );
    }

    if (step === 'success') {
        return (
            <div className={`p-6 rounded-xl border text-center space-y-4 ${isExistingUser ? 'bg-blue-50 border-blue-100' : 'bg-green-50 border-green-100'}`}>
                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${isExistingUser ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                    {isExistingUser ? <Info className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900">{isExistingUser ? 'Vínculo Realizado!' : 'Acesso Criado!'}</h3>
                    <p className="text-sm text-gray-600">
                        {isExistingUser
                            ? 'O usuário já existia no sistema e foi vinculado ao aluno com sucesso.'
                            : 'O cadastro foi realizado e vinculado ao aluno.'}
                    </p>
                </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200 text-left space-y-2 relative group">
                    <div>
                        <span className="text-xs text-gray-400 uppercase font-bold">Email</span>
                        <p className="font-mono text-gray-800">{formData.email}</p>
                    </div>

                    {!isExistingUser ? (
                        <div>
                            <span className="text-xs text-gray-400 uppercase font-bold">Senha Provisória</span>
                            <p className="font-mono text-gray-800 font-bold">{formData.password}</p>
                        </div>
                    ) : (
                        <div className="bg-amber-50 p-2 rounded border border-amber-100 mt-2">
                            <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                O usuário deve usar a senha que já possui.
                            </p>
                        </div>
                    )}

                    <button onClick={copyToClipboard} className="absolute top-2 right-2 p-2 text-gray-400 hover:text-brand-600 hover:bg-gray-50 rounded-lg transition-colors">
                        <Copy className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex gap-2">
                    <Button onClick={sendWhatsapp} className={`flex-1 ${isExistingUser ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}>
                        <Send className="w-4 h-4 mr-2" /> Enviar Whats
                    </Button>
                    <Button variant="outline" onClick={onClose} className="flex-1">
                        Fechar
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-600" />
                Gerar Acesso Manual
            </h3>

            <form onSubmit={checkAndSubmit} className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-gray-700">Nome do Responsável</label>
                    <Input
                        type="text"
                        required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Nome do Responsável"
                    />
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-700">CPF do Responsável</label>
                    <Input
                        type="text"
                        required
                        value={formData.cpf}
                        onChange={e => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                        placeholder="000.000.000-00"
                        className={formData.cpf.length === 14 ? (isValidCPF(formData.cpf) ? 'border-green-300' : 'border-red-300') : ''}
                    />
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-700">Email do Responsável</label>
                    <Input
                        type="email"
                        required
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@exemplo.com"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Se o email já existir, pediremos confirmação para vincular.</p>
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-700 flex justify-between">
                        Senha Inicial
                        <button type="button" onClick={generatePassword} className="text-xs text-brand-600 hover:align-baseline">Gerar Automática</button>
                    </label>
                    <div className="relative">
                        <Input
                            type="text"
                            required
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Defina uma senha"
                        />
                        <Lock className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                    </div>
                </div>

                <div className="pt-2 flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" className="flex-1 bg-brand-600" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                        Criar e Vincular
                    </Button>
                </div>
            </form>
        </Card>
    );
};
