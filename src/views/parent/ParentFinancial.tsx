import { type FC, useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Card, Button, Badge, Modal, BottomSheet } from '../../components/ui';
import {
    CreditCard,
    Calendar,
    CheckCircle2,
    Clock,
    AlertCircle,
    Share2,
    QrCode,
    Barcode,
    ExternalLink,
    FileText,
    Eye
} from 'lucide-react';

import { formatCurrency, parseLocalDate } from '../../utils/core_formatters';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';


export const ParentFinancial: FC = () => {
    const { currentSchool, user } = useAuth();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [installments, setInstallments] = useState<any[]>([]);
    const [selectedInstallment, setSelectedInstallment] = useState<any>(null);
    const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
    const [isBoletoModalOpen, setIsBoletoModalOpen] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        if (currentSchool && user) {
            fetchInstallments();
        }
    }, [currentSchool, user]);

    const fetchInstallments = async () => {
        try {
            setLoading(true);
            const { data: enrollments, error: enrollError } = await supabase
                .from('enrollments')
                .select('id')
                .eq('school_id', currentSchool?.id)
                .eq('details->>parent_email', user?.email);

            if (enrollError) throw enrollError;

            const enrollmentIds = enrollments.map(e => e.id);

            const { data, error } = await supabase
                .from('installments')
                .select('*')
                .in('enrollment_id', enrollmentIds)
                .order('due_date', { ascending: true });

            if (error) throw error;
            setInstallments(data || []);
        } catch (error: any) {
            console.error('Error fetching installments:', error);
            addToast('error', 'Erro ao carregar dados financeiros');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            addToast('success', 'Código copiado!');
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            addToast('error', 'Erro ao copiar código');
        }
    };

    const handleShare = async () => {
        if (!selectedInstallment) return;
        const text = `Fatura Escolar - ${formatCurrency(selectedInstallment.value)}\nVencimento: ${format(new Date(selectedInstallment.due_date + 'T12:00:00'), "dd/MM/yyyy")}\nLink: ${selectedInstallment.billing_url || selectedInstallment.metadata?.boleto_url || 'Confira no App'}`;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: 'Fatura Escolar',
                    text: text,
                    url: selectedInstallment.billing_url || selectedInstallment.metadata?.boleto_url
                });
            } else {
                handleCopy(text, 'share');
            }
        } catch (err) {
            console.error('Error sharing:', err);
        }
    };

    const StatusBadge = ({ item }: { item: any }) => {
        if (item.status === 'paid') return (
            <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Pago</span>
            </div>
        );

        const isOverdue = parseLocalDate(item.due_date) < new Date(new Date().setHours(0, 0, 0, 0));

        if (isOverdue) return (
            <div className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2.5 py-1 rounded-full animate-pulse">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Atrasado</span>
            </div>
        );

        return (
            <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                <Clock className="w-3.5 h-3.5" />
                <span>Pendente</span>
            </div>
        );
    };

    const stats = {
        pending: installments.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length,
        totalValue: installments
            .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
            .reduce((acc, curr) => acc + Number(curr.value), 0)
    };

    if (loading) return (
        <div className="p-6 space-y-4 animate-pulse">
            <div className="h-32 bg-gray-100 rounded-3xl" />
            <div className="h-10 w-32 bg-gray-100 rounded-full" />
            <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50/50 pb-24">
            {/* Header / Stats Card */}
            <div className="p-4 pt-8">
                <Card className="p-6 bg-brand-600 text-white rounded-[32px] border-0 shadow-2xl shadow-brand-200 relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-brand-100 text-sm font-medium opacity-80">Total em Aberto</p>
                        <h1 className="text-4xl font-bold mt-1 tracking-tight">
                            {formatCurrency(stats.totalValue)}
                        </h1>
                        <div className="flex items-center gap-2 mt-4 bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-md">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-xs font-bold">{stats.pending} faturas pendentes</span>
                        </div>
                    </div>
                    {/* Decorative element */}
                    <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                    <div className="absolute -left-4 -top-4 w-24 h-24 bg-brand-400/20 rounded-full blur-2xl" />
                </Card>
            </div>

            <div className="p-4">
                <div className="flex items-center justify-between mb-6 px-1">
                    <h2 className="text-xl font-bold text-gray-900">Mensalidades</h2>
                    <div className="flex gap-2">
                        <Badge variant="info" className="text-[10px] font-bold py-1">TODAS</Badge>
                    </div>
                </div>

                <div className="space-y-3">
                    {installments.length === 0 ? (
                        <div className="text-center py-12 px-4">
                            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300">
                                <CreditCard className="w-8 h-8" />
                            </div>
                            <h3 className="text-gray-900 font-bold">Nenhuma fatura encontrada</h3>
                            <p className="text-gray-500 text-sm mt-1 text-balance">Suas faturas aparecerão aqui assim que forem geradas pela escola.</p>
                        </div>
                    ) : (
                        installments.map((item) => (
                            <Card
                                key={item.id}
                                onClick={() => {
                                    setSelectedInstallment(item);
                                    setIsBottomSheetOpen(true);
                                }}
                                className="p-4 border border-gray-100 rounded-2xl active:scale-[0.98] transition-all hover:border-brand-200 group"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${item.status === 'paid' ? 'bg-green-50 text-green-600' : 'bg-brand-50 text-brand-600'}`}>
                                            {item.status === 'paid' ? <CheckCircle2 className="w-6 h-6" /> : <Calendar className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 leading-tight">
                                                Parcela {item.installment_number}
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                Venc. {format(new Date(item.due_date + 'T12:00:00'), "dd/MM/yyyy")}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <div className="font-bold text-gray-900 group-hover:text-brand-600 transition-colors">
                                            {formatCurrency(item.value)}
                                        </div>
                                        <div className="mt-1">
                                            <StatusBadge item={item} />
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))
                    )}
                </div>

                {/* BottomSheet with Installment Details */}
                <BottomSheet
                    isOpen={isBottomSheetOpen}
                    onClose={() => setIsBottomSheetOpen(false)}
                    title="Detalhes da Fatura"
                >
                    {selectedInstallment && (
                        <div className="p-0 animate-fade-in">
                            <div className="text-center mb-8">
                                <p className="text-sm font-medium text-gray-500 mb-1">Total da Parcela</p>
                                <h2 className="text-4xl font-black text-gray-900 tracking-tight">
                                    {formatCurrency(selectedInstallment.value)}
                                </h2>
                                <div className="mt-4 text-xs font-bold flex justify-center">
                                    <StatusBadge item={selectedInstallment} />
                                </div>
                            </div>

                            <div className="space-y-4">
                                {selectedInstallment.metadata?.description && (
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                        <span className="text-sm text-gray-500">Descrição</span>
                                        <span className="text-sm font-bold text-brand-600">
                                            {selectedInstallment.metadata.description}
                                        </span>
                                    </div>
                                )}
                                {(selectedInstallment.metadata?.category || selectedInstallment.negotiation_type) && (
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                        <span className="text-sm text-gray-500">Categoria</span>
                                        <span className="text-sm font-bold text-gray-900 capitalize">
                                            {selectedInstallment.metadata?.category || selectedInstallment.negotiation_type || "Geral"}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                    <span className="text-sm text-gray-500">Vencimento</span>
                                    <span className="text-sm font-bold text-gray-900">
                                        {format(new Date(selectedInstallment.due_date + 'T12:00:00'), "dd/MM/yyyy")}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                    <span className="text-sm text-gray-500">Mês de Referência</span>
                                    <span className="text-sm font-bold text-gray-900 capitalize">
                                        {format(new Date(selectedInstallment.due_date + 'T12:00:00'), "MMMM 'de' yyyy", { locale: ptBR })}
                                    </span>
                                </div>
                                {selectedInstallment.original_value && selectedInstallment.original_value !== selectedInstallment.value && (
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                        <span className="text-sm text-gray-500">Valor Original</span>
                                        <span className="text-sm font-medium text-gray-400 line-through">
                                            {formatCurrency(selectedInstallment.original_value)}
                                        </span>
                                    </div>
                                )}
                                {(selectedInstallment.discount_value || 0) > 0 && (
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                        <span className="text-sm text-green-600 font-medium">Desconto Aplicado</span>
                                        <span className="text-sm font-bold text-green-600">
                                            - {formatCurrency(selectedInstallment.discount_value!)}
                                        </span>
                                    </div>
                                )}

                                {selectedInstallment.status === 'paid' && selectedInstallment.metadata?.manual_obs && (
                                    <div className="mt-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 italic text-sm text-emerald-800">
                                        <div className="flex items-center gap-2 mb-1 not-italic">
                                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Observação do Pagamento</span>
                                        </div>
                                        {selectedInstallment.metadata.manual_obs}
                                    </div>
                                )}
                            </div>

                            {selectedInstallment.status !== 'paid' && selectedInstallment.status !== 'cancelled' && (
                                <div className="flex flex-col gap-3 pt-4">
                                    {/* Asaas Priority */}
                                    {selectedInstallment.billing_url ? (
                                        <Button
                                            className="w-full h-14 rounded-2xl text-base font-bold shadow-lg shadow-brand-200"
                                            onClick={() => setIsBoletoModalOpen(true)}
                                        >
                                            <Barcode className="w-5 h-5 mr-2" />
                                            Boleto
                                        </Button>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Manual Pix */}
                                            {selectedInstallment.metadata?.pix_key && (
                                                <Button
                                                    variant="outline"
                                                    className={`h-14 rounded-2xl text-base font-bold px-2 transition-all ${copiedId === selectedInstallment.id + '_pix' ? 'border-green-500 text-green-600 bg-green-50' : ''}`}
                                                    onClick={() => handleCopy(selectedInstallment.metadata!.pix_key!, selectedInstallment.id + '_pix')}
                                                >
                                                    {copiedId === selectedInstallment.id + '_pix' ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <QrCode className="w-5 h-5 mr-2" />}
                                                    {copiedId === selectedInstallment.id + '_pix' ? 'Copiado!' : 'Copiar PIX'}
                                                </Button>
                                            )}

                                            {/* Manual Boleto XOR (Code or PDF) */}
                                            {selectedInstallment.metadata?.boleto_code ? (
                                                <Button
                                                    variant="outline"
                                                    className={`h-14 rounded-2xl text-base font-bold px-2 transition-all ${copiedId === selectedInstallment.id + '_boleto' ? 'border-green-500 text-green-600 bg-green-50' : ''}`}
                                                    onClick={() => handleCopy(selectedInstallment.metadata!.boleto_code!, selectedInstallment.id + '_boleto')}
                                                >
                                                    {copiedId === selectedInstallment.id + '_boleto' ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Barcode className="w-5 h-5 mr-2" />}
                                                    {copiedId === selectedInstallment.id + '_boleto' ? 'Copiado!' : 'Copiar Boleto'}
                                                </Button>
                                            ) : selectedInstallment.metadata?.boleto_url ? (
                                                <Button
                                                    variant="outline"
                                                    className="h-14 rounded-2xl text-base font-bold px-2"
                                                    onClick={() => setIsBoletoModalOpen(true)}
                                                >
                                                    <Eye className="w-5 h-5 mr-2" />
                                                    Ver Boleto
                                                </Button>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </BottomSheet>

                <Modal
                    isOpen={isBoletoModalOpen}
                    onClose={() => setIsBoletoModalOpen(false)}
                    title="Fatura Digital"
                    size="xl"
                    footer={
                        <div className="flex justify-between w-full items-center">
                            <span className="text-xs text-gray-500">Não carregou?</span>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={handleShare}>
                                    <Share2 className="w-3 h-3 mr-2" />
                                    Compartilhar
                                </Button>
                                <Button variant="outline" onClick={() => window.open(selectedInstallment?.billing_url || selectedInstallment?.metadata?.boleto_url || '', '_blank')}>
                                    Abrir no Navegador <ExternalLink className="w-3 h-3 ml-2" />
                                </Button>
                            </div>
                        </div>
                    }
                >
                    <div className="w-full h-[65vh] bg-gray-100 rounded-lg overflow-hidden relative">
                        <iframe
                            src={selectedInstallment?.billing_url || selectedInstallment?.metadata?.boleto_url || ''}
                            className="w-full h-full relative z-10 border-0"
                            title="Boleto"
                        />
                    </div>
                </Modal>
            </div>
        </div>
    );
};
