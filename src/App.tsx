import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './AppRouter';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { StudentProvider } from './contexts/StudentContext';
import { SystemProvider } from './contexts/SystemContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { Loader2 } from 'lucide-react';
import type { User } from './types';

function AppContent() {
  const { user, loading, signOut } = useAuth();

  // Handle Demo Login Prop (Legacy support for Login.tsx which calls onLogin)
  const handleLogin = (_user: User) => { /* No-op, context handles it */ };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <ConfirmProvider>
      <SystemProvider>
        <StudentProvider>
          <NotificationProvider>
            <AppRouter user={user} onLogin={handleLogin} onLogout={signOut} />
          </NotificationProvider>
        </StudentProvider>
      </SystemProvider>
    </ConfirmProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
