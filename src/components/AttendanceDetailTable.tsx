import { type FC, useState } from 'react';
import { Calendar, CheckCircle, XCircle, AlertTriangle, FileText } from 'lucide-react';
import { Button, Card } from './ui';

interface AttendanceRecord {
    id: string;
    date: string;
    status: 'present' | 'absent' | 'justified' | 'late';
    justification?: string;
    justification_document_url?: string;
    justified_at?: string;
}

interface AttendanceDetailTableProps {
    records: AttendanceRecord[];
    onJustify: (recordId: string) => void;
    loading?: boolean;
}

export const AttendanceDetailTable: FC<AttendanceDetailTableProps> = ({
    records,
    onJustify,
    loading = false
}) => {
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Status Badge Component
    const StatusBadge = ({ status }: { status: string }) => {
        const config: any = {
            present: { label: 'Presente', bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle },
            absent: { label: 'Falta', bg: 'bg-red-50', text: 'text-red-700', icon: XCircle },
            justified: { label: 'Justificada', bg: 'bg-blue-50', text: 'text-blue-700', icon: FileText },
            late: { label: 'Atraso', bg: 'bg-yellow-50', text: 'text-yellow-700', icon: AlertTriangle }
        };
        const s = config[status] || config.present;
        const Icon = s.icon;

        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${s.bg} ${s.text}`}>
                <Icon className="w-3 h-3" /> {s.label}
            </span>
        );
    };

    // Filter Records
    const filteredRecords = records.filter(record => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'absent_only') return record.status === 'absent';
        if (statusFilter === 'justified_only') return record.status === 'justified';
        return true;
    });

    // Sort by date descending
    const sortedRecords = [...filteredRecords].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return (
        <Card className="p-0 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-gray-50">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-brand-600" />
                        Registro Detalhado de Frequência
                    </h3>

                    {/* Filters */}
                    <select
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-brand-500"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">Todos os Registros</option>
                        <option value="absent_only">Apenas Faltas</option>
                        <option value="justified_only">Apenas Justificadas</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Justificativa</th>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-gray-400">
                                    Carregando registros...
                                </td>
                            </tr>
                        ) : sortedRecords.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-gray-400">
                                    Nenhum registro encontrado.
                                </td>
                            </tr>
                        ) : (
                            sortedRecords.map((record) => (
                                <tr key={record.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <span className="text-sm font-medium text-gray-900">
                                            {new Date(record.date + 'T00:00:00').toLocaleDateString('pt-BR', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={record.status} />
                                    </td>
                                    <td className="px-4 py-3">
                                        {record.justification ? (
                                            <div>
                                                <p className="text-sm text-gray-700">{record.justification}</p>
                                                {record.justification_document_url && (
                                                    <a
                                                        href={record.justification_document_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-brand-600 hover:underline flex items-center gap-1 mt-1"
                                                    >
                                                        <FileText className="w-3 h-3" /> Ver documento
                                                    </a>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-sm text-gray-400 italic">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {record.status === 'absent' && (
                                            <Button
                                                onClick={() => onJustify(record.id)}
                                                className="text-xs bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200"
                                            >
                                                Justificar
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer Summary */}
            {!loading && sortedRecords.length > 0 && (
                <div className="p-3 border-t border-gray-100 bg-gray-50 text-sm text-gray-600">
                    Mostrando {sortedRecords.length} registro{sortedRecords.length !== 1 ? 's' : ''}
                </div>
            )}
        </Card>
    );
};
