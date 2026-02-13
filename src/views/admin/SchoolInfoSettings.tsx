import { type FC, useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Save, Building2, MapPin, Phone, Globe, Info, School, Search, Loader2, ChevronDown, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { Button } from '../../components/ui';
import { ImageUpload } from '../../components/ui/ImageUpload';

interface SchoolInfo {
    name: string;
    cnpj: string;
    cep: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    phone: string;
    country_code: string;
    website: string;
    logo_url: string;
    app_logo_url: string;
}

const COUNTRIES = [
    { name: 'Brasil', code: 'BR', ddi: '55', flag: '🇧🇷', mask: '(99) 99999-9999' },
    { name: 'Portugal', code: 'PT', ddi: '351', flag: '🇵🇹', mask: '999 999 999' },
    { name: 'Estados Unidos', code: 'US', ddi: '1', flag: '🇺🇸', mask: '(999) 999-9999' },
    { name: 'Angola', code: 'AO', ddi: '244', flag: '🇦🇴', mask: '999 999 999' },
    { name: 'Moçambique', code: 'MZ', ddi: '258', flag: '🇲🇿', mask: '99 999 9999' },
];

export const SchoolInfoSettings: FC = () => {
    const { currentSchool } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [info, setInfo] = useState<SchoolInfo>({
        name: '',
        cnpj: '',
        cep: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        phone: '',
        country_code: 'BR',
        website: '',
        logo_url: '',
        app_logo_url: ''
    });
    const [displayCnpj, setDisplayCnpj] = useState('');
    const [cnpjValid, setCnpjValid] = useState<boolean | null>(null);
    const [displayPhone, setDisplayPhone] = useState('');
    const [cepLoading, setCepLoading] = useState(false);
    const [showCountrySelector, setShowCountrySelector] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        if (currentSchool) {
            fetchSettings();
        }
    }, [currentSchool]);

    const formatPhone = (value: string, countryCode: string = 'BR') => {
        const digits = value.replace(/\D/g, '');
        if (countryCode === 'BR') {
            if (digits.length <= 10) {
                return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
            }
            return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
        }
        // Fallback para outros países ou formato genérico
        return digits;
    };

    const formatCNPJ = (value: string) => {
        const digits = value.replace(/\D/g, '');
        return digits
            .replace(/^(\d{2})(\d)/, '$1.$2')
            .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d)/, '.$1/$2')
            .replace(/(\d{4})(\d)/, '$1-$2')
            .slice(0, 18);
    };

    const validateCNPJ = (cnpj: string) => {
        const b = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        const c = cnpj.replace(/[^\d]/g, '');

        if (c.length !== 14) return false;

        if (/0{14}/.test(c)) return false;

        let n = 0;
        for (let i = 0; i < 12; i++) {
            n += Number(c[i]) * b[i + 1];
        }
        if (Number(c[12]) !== (((n %= 11) < 2) ? 0 : 11 - n)) return false;

        n = 0;
        for (let i = 0; i <= 12; i++) {
            n += Number(c[i]) * b[i];
        }
        if (Number(c[13]) !== (((n %= 11) < 2) ? 0 : 11 - n)) return false;

        return true;
    };

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'school_info')
                .eq('school_id', currentSchool?.id)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;

            if (data?.value) {
                const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
                setInfo({
                    name: parsed.name || '',
                    cnpj: parsed.cnpj || '',
                    cep: parsed.cep || '',
                    street: parsed.street || '',
                    number: parsed.number || '',
                    complement: parsed.complement || '',
                    neighborhood: parsed.neighborhood || '',
                    city: parsed.city || '',
                    state: parsed.state || '',
                    phone: parsed.phone || '',
                    country_code: parsed.country_code || 'BR',
                    website: parsed.website || '',
                    logo_url: parsed.logo_url || '',
                    app_logo_url: parsed.app_logo_url || ''
                });
                if (parsed.phone) {
                    setDisplayPhone(formatPhone(parsed.phone, parsed.country_code || 'BR'));
                }
                if (parsed.cnpj) {
                    setDisplayCnpj(formatCNPJ(parsed.cnpj));
                    setCnpjValid(validateCNPJ(parsed.cnpj));
                }
            }
        } catch (err) {
            console.error('Error loading school info:', err);
            setMessage({ type: 'error', text: 'Erro ao carregar dados da escola.' });
        } finally {
            setLoading(false);
        }
    };

    const handleCEPLookup = async (cep: string) => {
        const cleanedCEP = cep.replace(/\D/g, '');
        if (cleanedCEP.length !== 8) return;

        setCepLoading(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanedCEP}/json/`);
            const data = await response.json();

            setInfo(prev => ({
                ...prev,
                cep: data.cep,
                street: data.logradouro || '',
                neighborhood: data.bairro || '',
                city: data.localidade || '',
                state: data.uf || '',
            }));
            setMessage({ type: 'success', text: 'Endereço atualizado via CEP!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {
            console.error('Error fetching CEP:', err);
            setMessage({ type: 'error', text: 'Erro ao buscar CEP.' });
        } finally {
            setCepLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'school_info',
                    value: info,
                    description: 'Informações gerais da escola (Nome, Endereço, Logo)',
                    school_id: currentSchool?.id,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key,school_id' });

            if (error) throw error;
            setMessage({ type: 'success', text: 'Dados da escola atualizados com sucesso!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {
            console.error('Error saving school info:', err);
            setMessage({ type: 'error', text: 'Erro ao salvar alterações.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando dados...</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in max-w-4xl">
            {/* Header Section */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-2 mb-1">
                        <School className="w-5 h-5 text-brand-600" />
                        <h2 className="font-semibold text-gray-900">Identidade da Escola</h2>
                    </div>
                    <p className="text-sm text-gray-500">
                        Essas informações aparecem no cabeçalho dos documentos, faturas e mensagens automáticas (WhatsApp).
                    </p>
                </div>

                <div className="p-6 space-y-6">
                    {/* Feedback Message */}
                    {message && (
                        <div className={`p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            <Info className="w-5 h-5" />
                            {message.text}
                        </div>
                    )}

                    {/* Branding Section */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-gray-100">
                        <ImageUpload
                            label="Logo do Painel (Horizontal)"
                            currentUrl={info.logo_url}
                            onUpload={(url) => setInfo(prev => ({ ...prev, logo_url: url }))}
                            bucketName="school-assets"
                            folderPath="logos/panel"
                        />
                        <ImageUpload
                            label="Logo do App (Quadrado/Icon)"
                            currentUrl={info.app_logo_url}
                            onUpload={(url) => setInfo(prev => ({ ...prev, app_logo_url: url }))}
                            bucketName="school-assets"
                            folderPath="logos/app"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Nome da Escola */}
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nome da Instituição
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Building2 className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={info.name}
                                    onChange={(e) => setInfo(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ex: Colégio Futuro"
                                    className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2.5 border"
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">Usado no cabeçalho das mensagens do WhatsApp.</p>
                        </div>

                        {/* CNPJ */}
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                CNPJ da Instituição
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FileText className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={displayCnpj}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '').slice(0, 14);
                                        setDisplayCnpj(formatCNPJ(value));
                                        setInfo(prev => ({ ...prev, cnpj: value }));
                                        if (value.length === 14) {
                                            setCnpjValid(validateCNPJ(value));
                                        } else {
                                            setCnpjValid(null);
                                        }
                                    }}
                                    placeholder="00.000.000/0000-00"
                                    className={`block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:ring-brand-500 sm:text-sm p-2.5 border ${cnpjValid === true ? 'border-green-300 focus:border-green-500' :
                                        cnpjValid === false ? 'border-red-300 focus:border-red-500' :
                                            'focus:border-brand-500'
                                        }`}
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    {cnpjValid === true && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                                    {cnpjValid === false && <AlertCircle className="h-5 w-5 text-red-500" />}
                                </div>
                            </div>
                            {cnpjValid === false && <p className="mt-1 text-xs text-red-600">CNPJ inválido</p>}
                        </div>

                        {/* CEP */}
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                CEP (Busca Automática)
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    {cepLoading ? (
                                        <Loader2 className="h-5 w-5 text-brand-500 animate-spin" />
                                    ) : (
                                        <Search className="h-5 w-5 text-gray-400" />
                                    )}
                                </div>
                                <input
                                    type="text"
                                    value={info.cep}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                                        setInfo(prev => ({ ...prev, cep: value }));
                                        if (value.length === 8) handleCEPLookup(value);
                                    }}
                                    placeholder="00000-000"
                                    className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2.5 border h-[42px]"
                                />
                            </div>
                        </div>

                        {/* Logradouro (Rua) */}
                        <div className="col-span-1 md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Rua / Logradouro
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <MapPin className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={info.street}
                                    onChange={(e) => setInfo(prev => ({ ...prev, street: e.target.value }))}
                                    placeholder="Ex: Rua das Flores"
                                    className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2.5 border h-[42px]"
                                />
                            </div>
                        </div>

                        {/* Número e Complemento */}
                        <div className="grid grid-cols-2 gap-4 col-span-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Número
                                </label>
                                <input
                                    type="text"
                                    value={info.number}
                                    onChange={(e) => setInfo(prev => ({ ...prev, number: e.target.value }))}
                                    placeholder="Ex: 123"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2.5 border h-[42px]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Complemento
                                </label>
                                <input
                                    type="text"
                                    value={info.complement}
                                    onChange={(e) => setInfo(prev => ({ ...prev, complement: e.target.value }))}
                                    placeholder="Ex: Sala 4"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2.5 border h-[42px]"
                                />
                            </div>
                        </div>

                        {/* Bairro, Cidade e UF */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 col-span-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Bairro
                                </label>
                                <input
                                    type="text"
                                    value={info.neighborhood}
                                    onChange={(e) => setInfo(prev => ({ ...prev, neighborhood: e.target.value }))}
                                    placeholder="Ex: Centro"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2.5 border h-[42px]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Cidade
                                </label>
                                <input
                                    type="text"
                                    value={info.city}
                                    onChange={(e) => setInfo(prev => ({ ...prev, city: e.target.value }))}
                                    placeholder="Ex: São Paulo"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2.5 border h-[42px]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Estado (UF)
                                </label>
                                <input
                                    type="text"
                                    value={info.state}
                                    onChange={(e) => setInfo(prev => ({ ...prev, state: e.target.value }))}
                                    placeholder="Ex: SP"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2.5 border h-[42px]"
                                />
                            </div>
                        </div>

                        {/* Telefone */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Telefone de Contato
                            </label>
                            <div className="flex gap-2">
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowCountrySelector(!showCountrySelector)}
                                        className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm font-medium whitespace-nowrap hover:bg-gray-100 transition-colors h-[42px]"
                                    >
                                        <span className="text-xl">{COUNTRIES.find(c => c.code === info.country_code)?.flag}</span>
                                        <span className="text-gray-600">+{COUNTRIES.find(c => c.code === info.country_code)?.ddi}</span>
                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                    </button>

                                    {showCountrySelector && (
                                        <div className="absolute z-10 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 max-h-60 overflow-auto">
                                            {COUNTRIES.map((country) => (
                                                <button
                                                    key={country.code}
                                                    type="button"
                                                    onClick={() => {
                                                        setInfo(prev => ({ ...prev, country_code: country.code }));
                                                        setShowCountrySelector(false);
                                                        setDisplayPhone(formatPhone(info.phone, country.code));
                                                    }}
                                                    className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                                                >
                                                    <span className="text-xl">{country.flag}</span>
                                                    <span className="flex-1 font-medium">{country.name}</span>
                                                    <span className="text-gray-400 text-xs">+{country.ddi}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="relative flex-1">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Phone className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        value={displayPhone}
                                        onChange={(e) => {
                                            const rawValue = e.target.value.replace(/\D/g, '').slice(0, 11);
                                            setDisplayPhone(formatPhone(rawValue, info.country_code));
                                            setInfo(prev => ({ ...prev, phone: rawValue }));
                                        }}
                                        placeholder={COUNTRIES.find(c => c.code === info.country_code)?.mask.replace(/9/g, '0')}
                                        className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2.5 border h-[42px]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Website */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Website / Portal
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Globe className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={info.website}
                                    onChange={(e) => setInfo(prev => ({ ...prev, website: e.target.value }))}
                                    placeholder="www.suaescola.com.br"
                                    className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2.5 border"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-brand-600 text-white min-w-[150px]"
                        >
                            {saving ? (
                                <>
                                    <Save className="w-4 h-4 mr-2 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Salvar Alterações
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
