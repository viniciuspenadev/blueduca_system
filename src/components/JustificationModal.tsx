import { type FC, useState } from 'react';
import { Modal, Button } from './ui';
import { FileText, Upload, X } from 'lucide-react';
import { supabase } from '../services/supabase';

interface JustificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    attendanceRecordId: string;
    studentId: string;
    date: string;
    onSuccess: () => void;
}

export const JustificationModal: FC<JustificationModalProps> = ({
    isOpen,
    onClose,
    attendanceRecordId,
    studentId,
    date,
    onSuccess
}) => {
    const [justification, setJustification] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (!justification.trim()) {
            alert('Por favor, informe o motivo da justificativa.');
            return;
        }

        setUploading(true);
        try {
            let documentUrl = null;

            // Upload file if provided
            if (file) {
                const filePath = `attendance-justifications/${studentId}/${Date.now()}_${file.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('student-documents')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('student-documents')
                    .getPublicUrl(filePath);

                documentUrl = publicUrl;
            }

            // Update attendance record
            const { error: updateError } = await supabase
                .from('student_attendance')
                .update({
                    status: 'justified',
                    justification: justification.trim(),
                    justification_document_url: documentUrl,
                    justified_at: new Date().toISOString()
                })
                .eq('id', attendanceRecordId);

            if (updateError) throw updateError;

            onSuccess();
            onClose();
            setJustification('');
            setFile(null);
        } catch (error: any) {
            console.error('Error submitting justification:', error);
            alert('Erro ao enviar justificativa: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Justificar Falta">
            <div className="space-y-4">
                {/* Date Display */}
                <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                        <strong>Data da falta:</strong> {new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                        })}
                    </p>
                </div>

                {/* Justification Text */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Motivo da Justificativa *
                    </label>
                    <textarea
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                        rows={4}
                        placeholder="Ex: Atestado médico por gripe..."
                        value={justification}
                        onChange={(e) => setJustification(e.target.value)}
                    />
                </div>

                {/* File Upload */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Documento Comprobatório (opcional)
                    </label>
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                        {file ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-brand-600" />
                                    <span className="text-sm text-gray-700">{file.name}</span>
                                </div>
                                <button
                                    onClick={() => setFile(null)}
                                    className="p-1 hover:bg-gray-100 rounded"
                                >
                                    <X className="w-4 h-4 text-gray-500" />
                                </button>
                            </div>
                        ) : (
                            <label className="cursor-pointer">
                                <input
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={handleFileChange}
                                />
                                <div className="flex flex-col items-center gap-2">
                                    <Upload className="w-8 h-8 text-gray-400" />
                                    <p className="text-sm text-gray-600">
                                        Clique para selecionar arquivo
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        PDF, JPG ou PNG (máx. 5MB)
                                    </p>
                                </div>
                            </label>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end pt-4">
                    <Button
                        onClick={onClose}
                        className="bg-gray-100 text-gray-700 hover:bg-gray-200"
                        disabled={uploading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        className="bg-brand-600 hover:bg-brand-700"
                        disabled={uploading}
                    >
                        {uploading ? 'Salvando...' : 'Salvar Justificativa'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
