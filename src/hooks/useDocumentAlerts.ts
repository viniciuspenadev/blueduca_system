import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useStudent } from '../contexts/StudentContext';

export const useDocumentAlerts = () => {
    const { selectedStudent } = useStudent();
    const [alertCount, setAlertCount] = useState(0);
    const [statusMap, setStatusMap] = useState<Record<string, string>>({});

    const checkDocs = async () => {
        if (!selectedStudent) return;

        try {
            // Fetch enrollment details
            const { data, error } = await supabase
                .from('enrollments')
                .select('details, school_id')
                .eq('student_id', selectedStudent.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error || !data) {
                setAlertCount(0);
                return;
            }

            // Fetch templates
            let templates: any[] = [];
            if (data.school_id) {
                const { data: settingsData } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('school_id', data.school_id)
                    .eq('key', 'enrollment_docs_template')
                    .maybeSingle();

                if (settingsData?.value) {
                    try {
                        const val = typeof settingsData.value === 'string' ? JSON.parse(settingsData.value) : settingsData.value;
                        if (Array.isArray(val)) templates = val;
                    } catch (e) { }
                }
            }

            // Default templates fallback (sync with ParentDocuments)
            if (templates.length === 0) {
                templates = [
                    { id: 'transfer', label: 'Declaração de Transferência', required: true },
                    { id: 'report_card', label: 'Histórico Escolar', required: true },
                    { id: 'vaccination', label: 'Carteirinha de Vacinação', required: true },
                    { id: 'cpf', label: 'CPF do Aluno', required: false },
                    { id: 'residency', label: 'Comprovante de Residência', required: true }
                ];
            }

            const uploadedDocs = data.details?.documents || {};
            let count = 0;

            // Check all templates
            templates.forEach(template => {
                const doc = uploadedDocs[template.id];
                const status = doc?.status || 'missing';

                if (status === 'rejected') {
                    count++;
                } else if (status === 'missing' && template.required) {
                    count++;
                }
            });

            // Also check for any extra docs that might remain rejected even if not in current template (edge case)
            Object.keys(uploadedDocs).forEach(key => {
                if (!templates.find(t => t.id === key) && uploadedDocs[key].status === 'rejected') {
                    count++;
                }
            });

            setAlertCount(count);
            setStatusMap({}); // Reset or keep empty as it's not being populated currently

        } catch (err) {
            console.error('Error checking doc alerts:', err);
        }
    };

    useEffect(() => {
        checkDocs();

        // Optional: subscribe to changes
    }, [selectedStudent]);

    return { alertCount, statusMap, refresh: checkDocs };
};
