import { useState, useEffect } from 'react';
import { User } from '@/types';
import { Button } from '@/components/ui/button';
import { LogIn, Calendar } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import logo from '@/assets/logo.jpeg';
import LanguageToggle from './LanguageToggle';
import { supabase } from '@/integrations/supabase/client';
import { auth } from '@/integrations/lovable/index';
import { toast } from 'sonner';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

const LoginScreen = ({ onLogin }: LoginScreenProps) => {
  const { t, lang } = useI18n();
  const [signingIn, setSigningIn] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Map Google user to internal User type
          const user: User = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            role: 'admin' // Default role, can be customized based on email domain or other logic
          };
          onLogin(user);
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const user: User = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          role: 'admin'
        };
        onLogin(user);
      }
    });

    return () => subscription.unsubscribe();
  }, [onLogin]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      const { error } = await auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: {
          prompt: "consent",
          access_type: "offline",
          scope: "openid email profile https://www.googleapis.com/auth/calendar",
        },
      });

      if (error) {
        toast.error(lang === 'fr' ? 'Erreur de connexion Google' : 'Google sign-in error');
        console.error('Google sign-in error:', error);
      }
    } catch (err) {
      toast.error(lang === 'fr' ? 'Erreur de connexion' : 'Connection error');
      console.error('Sign-in error:', err);
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{lang === 'fr' ? 'Chargement...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute top-4 right-4 z-20">
        <LanguageToggle />
      </div>

      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="glass-card p-10 w-full max-w-md animate-fade-in relative z-10">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="SA Location" className="w-24 h-24 object-contain mb-4 rounded-xl" />
          <h1 className="font-display text-2xl font-bold gradient-text">SA LOCATION</h1>
          <p className="text-muted-foreground text-sm mt-2">{t('login.subtitle')}</p>
        </div>

        <div className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground text-sm">
              {lang === 'fr'
                ? 'Connectez-vous avec votre compte Google pour accéder au calendrier'
                : 'Sign in with your Google account to access calendar features'
              }
            </p>
          </div>

          <Button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-12 flex items-center justify-center gap-3"
          >
            <LogIn className="w-5 h-5" />
            {signingIn
              ? (lang === 'fr' ? 'Connexion en cours...' : 'Signing in...')
              : (lang === 'fr' ? 'Continuer avec Google' : 'Continue with Google')
            }
          </Button>

          <div className="mt-8 p-4 rounded-lg bg-secondary/50 border border-border/50">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">
                {lang === 'fr' ? 'Fonctionnalités incluses' : 'Included Features'}
              </span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• {lang === 'fr' ? 'Accès Google Calendar' : 'Google Calendar access'}</li>
              <li>• {lang === 'fr' ? 'Gestion des documents' : 'Document management'}</li>
              <li>• {lang === 'fr' ? 'Synchronisation en temps réel' : 'Real-time synchronization'}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
