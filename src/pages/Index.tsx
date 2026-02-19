import { useState, useEffect } from 'react';
import { User } from '@/types';
import LoginScreen from '@/components/LoginScreen';
import DocumentManager from '@/components/DocumentManager';
import CalendarPage from '@/components/CalendarPage';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';
import { useI18n } from '@/contexts/I18nContext';
import { Files, CalendarDays, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import logo from '@/assets/logo.jpeg';

type Tab = 'documents' | 'calendar';

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('documents');
  const { t, lang } = useI18n();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('google_provider_token');
      setUser(null);
      toast.success(lang === 'fr' ? 'Déconnexion réussie' : 'Successfully signed out');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error(lang === 'fr' ? 'Erreur de déconnexion' : 'Logout error');
    }
  };

  if (!user) return <LoginScreen onLogin={setUser} />;

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header */}
      <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <img src={logo} alt="SA Location" className="w-9 h-9 rounded-lg object-contain" />
          <div>
            <h1 className="font-display text-sm font-bold gradient-text">SA LOCATION</h1>
            <p className="text-xs text-muted-foreground">{t('app.management')}</p>
          </div>
        </div>

        {/* Nav tabs */}
        <nav className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'documents'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Files className="w-4 h-4" />
            <span className="hidden sm:inline">{lang === 'fr' ? 'Documents' : 'Documents'}</span>
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'calendar'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span className="hidden sm:inline">{lang === 'fr' ? 'Calendrier' : 'Calendar'}</span>
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <LanguageToggle />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs">
              {user.name.charAt(0)}
            </div>
            <span className="text-sm font-medium hidden sm:block">{user.name}</span>
          </div>
          <button onClick={handleLogout} className="text-muted-foreground hover:text-destructive transition-colors" title={t('app.logout')}>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Content */}
      {activeTab === 'documents' ? (
        <DocumentManager user={user} onLogout={handleLogout} />
      ) : (
        <CalendarPage />
      )}
    </div>
  );
};

export default Index;
