import { type FC } from 'react';
import { SuperAdminLayout } from './layouts/SuperAdminLayout';
import { SuperAdminDashboard } from './views/admin/sys/SuperAdminDashboard';
import { SchoolManagement } from './views/admin/sys/SchoolManagement';
import { SchoolDetails } from './views/admin/sys/SchoolDetails';
import { PlanManagement } from './views/admin/sys/PlanManagement';
import { GlobalSystemSettings } from './views/admin/sys/GlobalSystemSettings';
import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import { EnrollmentPage } from './views/public/EnrollmentPage';
import { Login } from './views/Login';
import { EnrollmentListView } from './views/EnrollmentList';
import { SecretaryDashboard } from './views/secretaria/SecretaryDashboard';
import { SecretaryStudentProfile } from './views/secretaria/SecretaryStudentProfile';
import { EnrollmentCreateView } from './views/EnrollmentCreate';
import { CompleteEnrollmentView } from './views/CompleteEnrollment';
import { EnrollmentDetailsView } from './views/EnrollmentDetails';
import { StudentListView } from './views/StudentList';
import { StudentProfileView } from './views/StudentProfile';
import { DashboardView } from './views/Dashboard';
import { FinancialPlansView } from './views/FinancialPlans';
import { FinancialReceivablesView } from './views/FinancialReceivables';
import { FinancialReceivablesPremiumView } from './views/FinancialReceivablesPremium';
import { FinancialStudentHub } from './views/FinancialStudentHub';
import { ChargeDetailsView } from './views/ChargeDetails';
import { AccountsPayableView } from './views/AccountsPayable';
import { AttendanceManagementView } from './views/AttendanceManagement';
import { ClassListView } from './views/ClassList';
import { ClassCreateView } from './views/ClassCreate';
import { ClassDetailsView } from './views/ClassDetails';
import { AgendaView } from './views/Agenda';
import { ParentLayout } from './layouts/ParentLayout';
import { ParentDashboard } from './views/parent/ParentDashboard';
import { ParentCalendar } from './views/parent/ParentCalendar';
import { ParentDiary } from './views/parent/ParentDiary';
import { ParentFinancial } from './views/parent/ParentFinancial';
import { ParentGrades } from './views/parent/ParentGrades';
import { ParentSchedule } from './views/parent/ParentSchedule';
import { MuralDetails } from './views/parent/MuralDetails';
import { ParentNotificationsPage } from './views/parent/ParentNotificationsPage';
import { ParentPushSettings } from './views/parent/ParentPushSettings';
import { ParentMenu } from './views/parent/ParentMenu';
import { ParentLunchMenu } from './views/parent/ParentLunchMenu';
import CommunicationsInbox from './views/parent/CommunicationsInbox';
import TeacherMessages from './views/teacher/TeacherMessages';
import { ParentDocuments } from './views/parent/ParentDocuments';
import { UserManagement } from './views/UserManagement';
// Config components consolidated into Hub
import { SchoolConfigHub } from './views/admin/SchoolConfigHub';
import { PlanningDashboard } from './views/planning/PlanningDashboard';
import { PlanningOverviewMockup } from './views/planning/PlanningOverviewMockup';
import { TeacherMobileMockup } from './views/mockups/TeacherMobileMockup';
import CommunicationsComposer from './views/admin/CommunicationsComposer';
import CommunicationsDashboard from './views/admin/CommunicationsDashboard';
import { LeadsKanban } from './views/admin/leads/LeadsKanban';
import { DunningManagement } from './views/admin/DunningManagement';
import { DirectorDashboard } from './views/admin/DirectorDashboard';

import { LunchMenuManager } from './views/admin/LunchMenuManager';

import type { User } from './types';

import { ProtectedRoute } from './components/ProtectedRoute';
import { getDefaultRoute } from './utils/rolePermissions';

interface AppRouterProps {
    user: User | null;
    onLogin: (user: User) => void;
    onLogout: () => void;
}



export const AppRouter: FC<AppRouterProps> = ({ user, onLogin, onLogout }) => {
    if (!user) {
        return (
            <Routes>
                <Route path="/" element={<Login onLogin={onLogin} onPublicEnrollment={() => { }} />} />

                {/* Public Routes */}
                <Route element={<PublicLayout />}>
                    <Route path="/matricula" element={<EnrollmentPage />} />
                    <Route path="/matricula/:slug" element={<EnrollmentPage />} />
                </Route>

                <Route path="/completar-matricula/:token" element={<CompleteEnrollmentView />} />
                <Route path="/mockup-gestao" element={<PlanningOverviewMockup />} />
                <Route path="/mockup-mobile" element={<TeacherMobileMockup />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        );
    }

    return (
        <Routes>
            <Route path="/" element={<Navigate to={getDefaultRoute(user.role)} replace />} />

            {/* Admin Routes (Should be protected against Parents in a real scenario, but RLS handles data) */}
            <Route path="/dashboard" element={<ProtectedRoute user={user} onLogout={onLogout}><DashboardView /></ProtectedRoute>} />

            {/* Enrollment Routes */}
            <Route path="/matriculas" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="academic"><EnrollmentListView /></ProtectedRoute>} />
            <Route path="/matriculas/nova" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="academic"><EnrollmentCreateView /></ProtectedRoute>} />
            <Route path="/matriculas/:id" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="academic"><EnrollmentDetailsView /></ProtectedRoute>} />

            {/* Student Routes */}
            <Route path="/alunos" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="academic"><StudentListView /></ProtectedRoute>} />
            <Route path="/alunos/:id" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="academic"><StudentProfileView /></ProtectedRoute>} />
            <Route path="/frequencia" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="academic"><AttendanceManagementView /></ProtectedRoute>} />

            {/* User Management */}
            <Route path="/usuarios" element={<ProtectedRoute user={user} onLogout={onLogout}><UserManagement /></ProtectedRoute>} />

            {/* Config Routes */}
            {/* Config Routes - Consolidated to Hub */}
            <Route path="/config" element={<Navigate to="/config/hub?tab=school" replace />} />
            <Route path="/config/hub" element={<ProtectedRoute user={user} onLogout={onLogout}><SchoolConfigHub /></ProtectedRoute>} />

            {/* Super Admin Routes */}
            <Route path="/sys/admin" element={<ProtectedRoute user={user} onLogout={onLogout} skipLayout><SuperAdminLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<SuperAdminDashboard />} />
                <Route path="escolas" element={<SchoolManagement />} />
                <Route path="escolas/:id" element={<SchoolDetails />} />
                <Route path="planos" element={<PlanManagement />} />
                <Route path="admins" element={<div className="p-8 text-center text-gray-500">Gestão de Admins do Sistema em Produção</div>} />
                <Route path="config" element={<GlobalSystemSettings />} />
            </Route>

            {/* Class Routes */}
            <Route path="/turmas" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="academic"><ClassListView /></ProtectedRoute>} />
            <Route path="/turmas/nova" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="academic"><ClassCreateView /></ProtectedRoute>} />
            <Route path="/turmas/:id" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="academic"><ClassDetailsView /></ProtectedRoute>} />

            {/* Administrative / Config */}
            <Route
                path="/admin/comunicados/*"
                element={
                    <ProtectedRoute user={user} onLogout={onLogout} requiredModule="communications">
                        {user?.role === 'TEACHER' ? <TeacherMessages /> : <CommunicationsDashboard />}
                    </ProtectedRoute>
                }
            />
            <Route path="/admin/comunicados/novo" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="communications"><CommunicationsComposer /></ProtectedRoute>} />
            <Route path="/admin/cardapio" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="menu"><LunchMenuManager /></ProtectedRoute>} />

            {/* CRM / Leads */}
            <Route path="/admin/leads" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="crm"><LeadsKanban /></ProtectedRoute>} />

            {/* Director Dashboard */}
            <Route path="/diretoria/dashboard" element={<ProtectedRoute user={user} onLogout={onLogout}><DirectorDashboard /></ProtectedRoute>} />

            {/* SECRETARIA (TESTE / NEW MODULE) */}
            <Route path="/secretaria" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="academic"><SecretaryDashboard /></ProtectedRoute>} />
            <Route path="/secretaria/aluno/:id" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="academic"><SecretaryStudentProfile /></ProtectedRoute>} />

            {/* Financial Routes */}
            <Route path="/financeiro" element={<Navigate to="/financeiro/recebiveis" replace />} />
            <Route path="/financeiro/planos" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="finance"><FinancialPlansView /></ProtectedRoute>} />
            <Route path="/financeiro/recebiveis" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="finance"><FinancialReceivablesView /></ProtectedRoute>} />
            <Route path="/financeiro/recebiveis-premium" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="finance"><FinancialReceivablesPremiumView /></ProtectedRoute>} />
            <Route path="/financeiro/alunos" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="finance"><FinancialStudentHub /></ProtectedRoute>} />
            <Route path="/financeiro/regua" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="finance"><DunningManagement /></ProtectedRoute>} />
            <Route path="/financeiro/pagar" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="finance"><AccountsPayableView /></ProtectedRoute>} />
            <Route path="/financeiro/cobranca/:id" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="finance"><ChargeDetailsView /></ProtectedRoute>} />

            <Route path="/agenda" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="academic"><AgendaView /></ProtectedRoute>} />
            <Route path="/planejamento" element={<ProtectedRoute user={user} onLogout={onLogout} requiredModule="academic"><PlanningDashboard /></ProtectedRoute>} />
            <Route path="/mockup-gestao" element={<PlanningOverviewMockup />} />

            {/* Parent Portal Routes */}
            <Route path="/pais" element={<ParentLayout />}>
                <Route path="home" element={<ParentDashboard />} />
                <Route path="agenda" element={<ProtectedRoute user={user} onLogout={onLogout} skipLayout requiredModule="academic"><ParentCalendar /></ProtectedRoute>} />
                <Route path="diario" element={<ProtectedRoute user={user} onLogout={onLogout} skipLayout requiredModule="academic"><ParentDiary /></ProtectedRoute>} />
                <Route path="financeiro" element={<ProtectedRoute user={user} onLogout={onLogout} skipLayout requiredModule="finance"><ParentFinancial /></ProtectedRoute>} />
                <Route path="boletim" element={<ProtectedRoute user={user} onLogout={onLogout} skipLayout requiredModule="academic"><ParentGrades /></ProtectedRoute>} />
                <Route path="cronograma" element={<ProtectedRoute user={user} onLogout={onLogout} skipLayout requiredModule="academic"><ParentSchedule /></ProtectedRoute>} />
                <Route path="mural/:id" element={<ProtectedRoute user={user} onLogout={onLogout} skipLayout><MuralDetails /></ProtectedRoute>} />
                <Route path="comunicados/*" element={<ProtectedRoute user={user} onLogout={onLogout} skipLayout requiredModule="communications"><CommunicationsInbox /></ProtectedRoute>} />
                <Route path="comunicados/novo" element={<ProtectedRoute user={user} onLogout={onLogout} skipLayout requiredModule="communications"><CommunicationsComposer /></ProtectedRoute>} />
                <Route path="notificacoes" element={<ProtectedRoute user={user} onLogout={onLogout} skipLayout><ParentNotificationsPage /></ProtectedRoute>} />
                <Route path="configuracoes/notificacoes" element={<ProtectedRoute user={user} onLogout={onLogout} skipLayout><ParentPushSettings /></ProtectedRoute>} />
                <Route path="menu" element={<ParentMenu />} />
                <Route path="cardapio" element={<ProtectedRoute user={user} onLogout={onLogout} skipLayout requiredModule="menu"><ParentLunchMenu /></ProtectedRoute>} />
                <Route path="documentos" element={<ProtectedRoute user={user} onLogout={onLogout} skipLayout><ParentDocuments /></ProtectedRoute>} />
                <Route path="perfil" element={<div className="p-6 text-center text-gray-500">Módulo Perfil em Construção</div>} />
                <Route index element={<Navigate to="home" replace />} />
            </Route>


            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
};
