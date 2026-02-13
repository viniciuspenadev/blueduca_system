import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { Plus, Trash2, Send, CheckCircle, User, Baby, School } from 'lucide-react';

interface ChildForm {
    name: string;
    birth_date: string;
    intended_grade: string;
    previous_school: string;
}

export const EnrollmentPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [schoolId, setSchoolId] = useState<string | null>(null);
    const [schoolName, setSchoolName] = useState<string>('');
    const [checkingSchool, setCheckingSchool] = useState(!!slug);

    // Form States
    const [parentName, setParentName] = useState('');
    const [parentEmail, setParentEmail] = useState('');
    const [parentPhone, setParentPhone] = useState('+55 ');

    const formatPhone = (value: string) => {
        // Enforce +55 prefix
        let digits = value.replace(/\D/g, '');

        // If they try to delete the 55, put it back
        if (!digits.startsWith('55')) {
            digits = '55' + digits;
        }

        // Limit to 13 digits (55 + 11 for mobile)
        digits = digits.substring(0, 13);

        let formatted = '+55 ';
        const actualDigits = digits.substring(2);

        if (actualDigits.length > 0) {
            formatted += '(' + actualDigits.substring(0, 2);
        }
        if (actualDigits.length > 2) {
            formatted += ') ' + actualDigits.substring(2, 7);
        }
        if (actualDigits.length > 7) {
            formatted += '-' + actualDigits.substring(7, 11);
        }

        return formatted;
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value;
        setParentPhone(formatPhone(input));
    };

    const [children, setChildren] = useState<ChildForm[]>([
        { name: '', birth_date: '', intended_grade: '', previous_school: '' }
    ]);

    useEffect(() => {
        if (slug) {
            checkSchool();
        }
    }, [slug]);

    const checkSchool = async () => {
        try {
            const { data, error } = await supabase
                .from('schools')
                .select('id, name')
                .eq('slug', slug)
                .single();

            if (error || !data) {
                console.error('School not found');
                setError('Escola não encontrada. Verifique o endereço.');
                setCheckingSchool(false);
                return;
            }

            setSchoolId(data.id);
            setSchoolName(data.name);
        } catch (err) {
            console.error(err);
        } finally {
            setCheckingSchool(false);
        }
    };

    const handleAddChild = () => {
        setChildren([...children, { name: '', birth_date: '', intended_grade: '', previous_school: '' }]);
    };

    const handleRemoveChild = (index: number) => {
        if (children.length > 1) {
            setChildren(children.filter((_, i) => i !== index));
        }
    };

    const handleChildChange = (index: number, field: keyof ChildForm, value: string) => {
        const newChildren = [...children];
        newChildren[index] = { ...newChildren[index], [field]: value };
        setChildren(newChildren);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Use RPC to submit securely (bypassing public RLS limitations on select)
            const { data, error: rpcError } = await supabase.rpc('submit_enrollment', {
                p_parent_name: parentName,
                p_parent_email: parentEmail,
                p_parent_phone: parentPhone.replace(/\D/g, ''), // Clean: only digits
                p_children: children,
                p_school_id: schoolId // NEW: Passed from slug
            });

            if (rpcError) throw rpcError;

            // RPC returns { success: boolean, lead_id: uuid, error: string }
            if (data && !data.success) {
                throw new Error(data.error || 'Erro ao processar matrícula');
            }

            setSuccess(true);
        } catch (err: any) {
            console.error('Error submitting lead:', err);
            setError('Ocorreu um erro ao enviar sua solicitação. Por favor, tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
                <div className="bg-green-50 p-8 rounded-2xl flex flex-col items-center text-center max-w-md w-full animate-fade-in border border-green-100 shadow-sm">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-600">
                        <CheckCircle size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Solicitação Enviada!</h2>
                    <p className="text-gray-600 mb-6">
                        Recebemos seus dados com sucesso. Nossa equipe da {schoolName || 'escola'} entrará em contato em breve para dar andamento à matrícula.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="text-green-700 font-medium hover:underline"
                    >
                        Voltar para o início
                    </button>
                </div>
            </div>
        );
    }

    if (checkingSchool) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-50/50">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-8 lg:mb-12">
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 lg:mb-4">
                        {schoolName ? `Matrícula - ${schoolName}` : 'Garanta a vaga do seu filho'}
                    </h1>
                    <p className="text-base lg:text-lg text-gray-600 max-w-2xl mx-auto">
                        Preencha o formulário abaixo para iniciar o processo de matrícula. É rápido e simples.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Responsável */}
                    <section className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-100 p-5 lg:p-8">
                        <h2 className="text-lg lg:text-xl font-semibold text-gray-800 mb-4 lg:mb-6 flex items-center gap-2">
                            <User className="text-blue-600" size={20} />
                            Dados do Responsável
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo</label>
                                <input
                                    type="text"
                                    required
                                    value={parentName}
                                    onChange={(e) => setParentName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                    placeholder="Seu nome completo"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                                <input
                                    type="email"
                                    required
                                    value={parentEmail}
                                    onChange={(e) => setParentEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                    placeholder="seu@email.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Telefone / WhatsApp</label>
                                <input
                                    type="tel"
                                    required
                                    value={parentPhone}
                                    onChange={handlePhoneChange}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                    placeholder="(11) 99999-9999"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Alunos */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                                <Baby className="text-blue-600" size={20} />
                                Dados do(s) Aluno(s)
                            </h2>
                        </div>

                        {children.map((child, index) => (
                            <div key={index} className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-100 p-5 lg:p-8 relative">
                                {children.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveChild(index)}
                                        className="absolute top-6 right-6 text-gray-400 hover:text-red-500 transition-colors p-1"
                                        title="Remover aluno"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}

                                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
                                    Aluno {index + 1}
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo do Aluno</label>
                                        <input
                                            type="text"
                                            required
                                            value={child.name}
                                            onChange={(e) => handleChildChange(index, 'name', e.target.value)}
                                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                            placeholder="Nome do filho(a)"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Data de Nascimento</label>
                                        <input
                                            type="date"
                                            value={child.birth_date}
                                            onChange={(e) => handleChildChange(index, 'birth_date', e.target.value)}
                                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Série Pretendida</label>
                                        <select
                                            required
                                            value={child.intended_grade}
                                            onChange={(e) => handleChildChange(index, 'intended_grade', e.target.value)}
                                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all bg-white"
                                        >
                                            <option value="">Selecione...</option>
                                            <option value="Berçário">Berçário</option>
                                            <option value="Maternal I">Maternal I</option>
                                            <option value="Maternal II">Maternal II</option>
                                            <option value="Pré I">Pré I</option>
                                            <option value="Pré II">Pré II</option>
                                            <option value="1º Ano">1º Ano</option>
                                            <option value="2º Ano">2º Ano</option>
                                            <option value="3º Ano">3º Ano</option>
                                            <option value="4º Ano">4º Ano</option>
                                            <option value="5º Ano">5º Ano</option>
                                            <option value="6º Ano">6º Ano</option>
                                            <option value="7º Ano">7º Ano</option>
                                            <option value="8º Ano">8º Ano</option>
                                            <option value="9º Ano">9º Ano</option>
                                            <option value="1º Ano Médio">1º Ano Médio</option>
                                            <option value="2º Ano Médio">2º Ano Médio</option>
                                            <option value="3º Ano Médio">3º Ano Médio</option>
                                        </select>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Escola Anterior (Opcional)</label>
                                        <div className="relative">
                                            <School className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="text"
                                                value={child.previous_school}
                                                onChange={(e) => handleChildChange(index, 'previous_school', e.target.value)}
                                                className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                                placeholder="Nome da escola anterior"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={handleAddChild}
                            className="w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 font-medium hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={20} />
                            Adicionar outro aluno
                        </button>
                    </section>

                    {/* Submit */}
                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                        >
                            {loading ? 'Enviando...' : (
                                <>
                                    Enviar Solicitação <Send size={20} />
                                </>
                            )}
                        </button>
                        {error && (
                            <p className="mt-4 text-center text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                                {error}
                            </p>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};
