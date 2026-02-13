
import { type FC } from 'react';
import { Button, Card } from '../components/ui';
import { Plus } from 'lucide-react';

export const DashboardView: FC = () => (
    <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card title="Total Alunos" description="Ativos">
                <p className="text-3xl font-bold text-brand-600">1,240</p>
            </Card>
            <Card title="Matrículas" description="Em aberto">
                <p className="text-3xl font-bold text-yellow-600">45</p>
            </Card>
        </div>
    </div>
);

export const EnrollmentListView: FC = () => (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Matrículas</h1>
            <Button>
                <Plus className="w-4 h-4 mr-2" /> Nova Matrícula
            </Button>
        </div>
        <Card>
            <p className="text-gray-500 text-center py-8">Lista de matrículas aparecerá aqui.</p>
        </Card>
    </div>
);

export const EnrollmentCreateView: FC = () => (
    <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Nova Matrícula</h1>
        <Card title="Dados Iniciais">
            <p className="text-gray-500">Formulário de criação aqui.</p>
        </Card>
    </div>
);

export const StudentProfileView: FC = () => (
    <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Perfil do Aluno</h1>
        <Card>
            <p className="text-gray-500">Detalhes do aluno id: ...</p>
        </Card>
    </div>
);
