import { useState, useMemo, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, X, Clock, MapPin, LogIn, LogOut, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useI18n } from '@/contexts/I18nContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { auth } from '@/integrations/lovable/index';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  description?: string;
  color: string;
}

const eventColors = [
  'bg-primary/20 text-primary border-primary/30',
  'bg-success/20 text-success border-success/30',
  'bg-warning/20 text-warning border-warning/30',
  'bg-accent/20 text-accent border-accent/30',
  'bg-destructive/20 text-destructive border-destructive/30',
];

const CalendarPage = () => {
  const { t, lang } = useI18n();
  const locale = lang === 'fr' ? fr : enUS;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const calendarId = 'primary';
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [providerToken, setProviderToken] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  // New event form state
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const allEvents = [...events, ...googleEvents];

  // Auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      // provider_token is only available on initial sign-in; persist it
      if (session?.provider_token) {
        localStorage.setItem('google_provider_token', session.provider_token);
        setProviderToken(session.provider_token);
        if (session.provider_refresh_token) {
          console.log('Refresh token received and stored');
          localStorage.setItem('google_refresh_token', session.provider_refresh_token);
        }
      } else if (session?.user) {
        // Restore from localStorage on page reload
        setProviderToken(localStorage.getItem('google_provider_token'));
      } else {
        localStorage.removeItem('google_provider_token');
        localStorage.removeItem('google_refresh_token');
        setProviderToken(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.provider_token) {
        localStorage.setItem('google_provider_token', session.provider_token);
        setProviderToken(session.provider_token);
        if (session.provider_refresh_token) {
          localStorage.setItem('google_refresh_token', session.provider_refresh_token);
        }
      } else if (session?.user) {
        setProviderToken(localStorage.getItem('google_provider_token'));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
    }
    setSigningIn(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('google_provider_token');
    setUser(null);
    setProviderToken(null);
    setGoogleEvents([]);
    toast.success(lang === 'fr' ? 'Déconnecté' : 'Signed out');
  };

  // Calendar grid computation
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = useMemo(() => {
    const result: Date[] = [];
    let day = calStart;
    while (day <= calEnd) {
      result.push(day);
      day = addDays(day, 1);
    }
    return result;
  }, [currentMonth]);

  const getEventsForDate = (date: Date) =>
    allEvents.filter(e => isSameDay(new Date(e.date), date));

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  const handleAddEvent = async () => {
    if (!newTitle || !newDate) {
      toast.error(lang === 'fr' ? 'Titre et date requis' : 'Title and date required');
      return;
    }

    const localId = `local_${Date.now()}`;
    const color = eventColors[Math.floor(Math.random() * eventColors.length)];

    // Prepare Google Calendar event object if signed in
    if (providerToken) {
      const gEvent = {
        summary: newTitle,
        description: newDescription,
        location: newLocation,
        start: {
          dateTime: newTime ? `${newDate}T${newTime}:00` : undefined,
          date: !newTime ? newDate : undefined,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: newTime ? `${newDate}T${newTime}:00` : undefined, // Quick fix, should ideally be start + 1h
          date: !newTime ? newDate : undefined,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      console.log('Syncing new event to Google...');
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar`,
          {
            method: 'POST',
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Content-Type': 'application/json',
              'x-google-token': providerToken,
            },
            body: JSON.stringify({
              action: 'insert',
              event: gEvent,
            }),
          }
        );

        if (res.ok) {
          toast.success(lang === 'fr' ? 'Événement synchronisé avec Google' : 'Event synced with Google');
          fetchGoogleCalendar(); // Refresh to show the new event
        } else {
          const errorData = await res.json();
          console.error('Failed to sync event to Google:', errorData);
          toast.error(lang === 'fr' ? 'Échec de la synchronisation Google' : 'Failed to sync to Google');
          // Add locally as fallback
          const event: CalendarEvent = {
            id: localId,
            title: newTitle,
            date: newDate,
            time: newTime || undefined,
            location: newLocation || undefined,
            description: newDescription || undefined,
            color,
          };
          setEvents(prev => [...prev, event]);
        }
      } catch (err) {
        console.error('Sync error:', err);
        // Add locally as fallback
        const event: CalendarEvent = {
          id: localId,
          title: newTitle,
          date: newDate,
          time: newTime || undefined,
          location: newLocation || undefined,
          description: newDescription || undefined,
          color,
        };
        setEvents(prev => [...prev, event]);
      }
    } else {
      const event: CalendarEvent = {
        id: localId,
        title: newTitle,
        date: newDate,
        time: newTime || undefined,
        location: newLocation || undefined,
        description: newDescription || undefined,
        color,
      };
      setEvents(prev => [...prev, event]);
      toast.success(lang === 'fr' ? 'Événement ajouté localement' : 'Event added locally');
    }

    setNewTitle(''); setNewDate(''); setNewTime(''); setNewLocation(''); setNewDescription('');
    setShowAddDialog(false);
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent || !newTitle || !newDate) {
      toast.error(lang === 'fr' ? 'Titre et date requis' : 'Title and date required');
      return;
    }

    // If it's a Google event, sync update
    if (editingEvent.id.startsWith('gcal_') && providerToken) {
      const gcalId = editingEvent.id.replace('gcal_', '');
      const gEvent = {
        summary: newTitle,
        description: newDescription,
        location: newLocation,
        start: {
          dateTime: newTime ? `${newDate}T${newTime}:00` : undefined,
          date: !newTime ? newDate : undefined,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: newTime ? `${newDate}T${newTime}:01` : undefined,
          date: !newTime ? newDate : undefined,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      console.log('Syncing update to Google:', gcalId);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar`,
          {
            method: 'POST',
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Content-Type': 'application/json',
              'x-google-token': providerToken,
            },
            body: JSON.stringify({
              action: 'update',
              eventId: gcalId,
              event: gEvent,
            }),
          }
        );

        if (res.ok) {
          toast.success(lang === 'fr' ? 'Événement mis à jour sur Google' : 'Event updated on Google');
          fetchGoogleCalendar();
        } else {
          const errorData = await res.json();
          console.error('Update failed:', errorData);
          toast.error(lang === 'fr' ? 'Échec de la mise à jour Google' : 'Failed to update on Google');
        }
      } catch (err) {
        console.error('Update error:', err);
        toast.error(lang === 'fr' ? 'Erreur de connexion' : 'Connection error');
      }
    } else {
      // Local event update
      setEvents(prev => prev.map(e => e.id === editingEvent.id ? {
        ...e,
        title: newTitle,
        date: newDate,
        time: newTime || undefined,
        location: newLocation || undefined,
        description: newDescription || undefined,
      } : e));
      toast.success(lang === 'fr' ? 'Événement mis à jour localement' : 'Event updated locally');
    }

    setEditingEvent(null);
    setNewTitle(''); setNewDate(''); setNewTime(''); setNewLocation(''); setNewDescription('');
    setShowAddDialog(false);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setNewTitle(event.title);
    setNewDate(event.date);
    setNewTime(event.time || '');
    setNewLocation(event.location || '');
    setNewDescription(event.description || '');
    setShowAddDialog(true);
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    setGoogleEvents(prev => prev.filter(e => e.id !== id));
    toast.success(lang === 'fr' ? 'Événement supprimé' : 'Event deleted');
  };

  const fetchGoogleCalendar = useCallback(async () => {
    setLoadingGoogle(true);
    try {
      const timeMin = startOfMonth(subMonths(currentMonth, 1)).toISOString();
      const timeMax = endOfMonth(addMonths(currentMonth, 2)).toISOString();

      console.log('Fetching Google Calendar with:', {
        providerToken: providerToken ? 'Present' : 'Missing',
        user: user ? 'Signed in' : 'Not signed in',
        timeMin,
        timeMax
      });

      const headers: Record<string, string> = {
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };

      // If we have a provider token, send it for OAuth-based access
      if (providerToken) {
        headers['x-google-token'] = providerToken;
        console.log('Using OAuth with provider token');
      } else {
        console.log('No provider token, will use API key fallback');
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar?calendarId=${encodeURIComponent(calendarId)}&timeMin=${timeMin}&timeMax=${timeMax}`,
        { headers }
      );

      console.log('Response status:', res.status);
      const result = await res.json();
      console.log('Response data:', result);

      if (!res.ok) {
        // If the token is expired or unauthorized (401/403) and we were using a token, try to refresh it
        if ((res.status === 401 || res.status === 403) && providerToken) {
          const refreshToken = localStorage.getItem('google_refresh_token');
          if (refreshToken) {
            console.log('Attempting to refresh Google token...');
            try {
              const refreshRes = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar`,
                {
                  method: 'POST',
                  headers: {
                    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    action: 'refresh',
                    refresh_token: refreshToken,
                  }),
                }
              );

              if (refreshRes.ok) {
                const refreshData = await refreshRes.json();
                const newToken = refreshData.access_token;
                console.log('Token refreshed successfully');

                // Update storage and state
                localStorage.setItem('google_provider_token', newToken);
                setProviderToken(newToken);

                // The useEffect will re-run fetchGoogleCalendar because providerToken changed
                return;
              } else {
                const refreshError = await refreshRes.json();
                console.error('Refresh response failed:', refreshError);
              }
            } catch (refreshErr) {
              console.error('Token refresh network error:', refreshErr);
            }
          } else {
            console.log('No refresh token available in localStorage');
          }

          console.log('Clearing invalid tokens and prompting for re-auth');
          localStorage.removeItem('google_provider_token');
          localStorage.removeItem('google_refresh_token');
          setProviderToken(null);
          toast.error(lang === 'fr'
            ? 'Votre session Google a expiré. Veuillez vous reconnecter.'
            : 'Your Google session has expired. Please sign in again.'
          );
        } else {
          toast.error(result.error || result.details?.error?.message || 'Failed to fetch Google Calendar');
        }
        setLoadingGoogle(false);
        return;
      }
      const mapped: CalendarEvent[] = (result.items || []).map((item: any, i: number) => ({
        id: `gcal_${item.id}`,
        title: item.summary || (lang === 'fr' ? 'Sans titre' : 'No title'),
        date: (item.start?.date || item.start?.dateTime || '').split('T')[0],
        time: item.start?.dateTime ? format(new Date(item.start.dateTime), 'HH:mm') : undefined,
        location: item.location,
        description: item.description,
        color: eventColors[i % eventColors.length],
      }));
      console.log('Mapped events:', mapped);
      setGoogleEvents(mapped);
    } catch (err) {
      console.error('Calendar fetch error:', err);
      toast.error(lang === 'fr' ? 'Erreur de connexion' : 'Connection error');
    }
    setLoadingGoogle(false);
  }, [currentMonth, providerToken, lang]);

  // Auto-sync on mount and re-sync on month change or auth change
  useEffect(() => {
    fetchGoogleCalendar();

    // Refresh when window gains focus or visibility changes (return to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, refreshing calendar...');
        fetchGoogleCalendar();
      }
    };

    const handleFocus = () => {
      console.log('Window gained focus, refreshing calendar...');
      fetchGoogleCalendar();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchGoogleCalendar]);

  const weekDays = Array.from({ length: 7 }, (_, i) =>
    format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i), 'EEE', { locale })
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Google Calendar Auth & Sync Status */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <CalendarIcon className="w-5 h-5 text-primary shrink-0" />
          <span className="text-sm font-medium">Google Calendar{user ? `: ${user.email}` : ''}</span>
          {loadingGoogle && (
            <span className="text-xs text-muted-foreground">
              {lang === 'fr' ? 'Synchronisation...' : 'Syncing...'}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {user.email}
                </span>
                <Button size="sm" variant="outline" onClick={fetchGoogleCalendar} disabled={loadingGoogle}>
                  {lang === 'fr' ? 'Rafraîchir' : 'Refresh'}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-1" />
                  {lang === 'fr' ? 'Déconnexion' : 'Sign Out'}
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleGoogleSignIn} disabled={signingIn} className="bg-primary text-primary-foreground">
                <LogIn className="w-4 h-4 mr-1" />
                {signingIn
                  ? (lang === 'fr' ? 'Connexion...' : 'Signing in...')
                  : (lang === 'fr' ? 'Connexion Google' : 'Sign in with Google')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-bold capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale })}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground uppercase py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              const dayEvents = getEventsForDate(day);
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(day)}
                  className={`relative min-h-[80px] p-1.5 rounded-lg text-left transition-all border ${isSelected ? 'border-primary bg-primary/5' : 'border-transparent hover:border-border'
                    } ${!isCurrentMonth ? 'opacity-30' : ''}`}
                >
                  <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-primary text-primary-foreground' : ''
                    }`}>
                    {format(day, 'd')}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 2).map(e => (
                      <div key={e.id} className={`text-[10px] px-1 py-0.5 rounded truncate border ${e.color}`}>
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 2}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar: Selected day events + Add */}
        <div className="space-y-4">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">
                {selectedDate
                  ? format(selectedDate, 'EEEE d MMMM', { locale })
                  : (lang === 'fr' ? 'Sélectionnez un jour' : 'Select a day')}
              </h3>
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground">
                    <Plus className="w-4 h-4 mr-1" />
                    {lang === 'fr' ? 'Ajouter' : 'Add'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle>
                      {editingEvent
                        ? (lang === 'fr' ? 'Modifier l\'événement' : 'Edit Event')
                        : (lang === 'fr' ? 'Nouvel événement' : 'New Event')}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder={lang === 'fr' ? 'Titre *' : 'Title *'} value={newTitle} onChange={e => setNewTitle(e.target.value)} className="bg-secondary border-border" />
                    <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="bg-secondary border-border" />
                    <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="bg-secondary border-border" />
                    <Input placeholder={lang === 'fr' ? 'Lieu' : 'Location'} value={newLocation} onChange={e => setNewLocation(e.target.value)} className="bg-secondary border-border" />
                    <Textarea placeholder="Description" value={newDescription} onChange={e => setNewDescription(e.target.value)} className="bg-secondary border-border" rows={3} />
                    <Button onClick={editingEvent ? handleUpdateEvent : handleAddEvent} className="w-full bg-primary text-primary-foreground">
                      {editingEvent
                        ? (lang === 'fr' ? 'Mettre à jour' : 'Update')
                        : (lang === 'fr' ? 'Créer' : 'Create')}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {selectedDate ? (
              selectedEvents.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {selectedEvents.map(e => (
                    <div key={e.id} className={`p-3 rounded-lg border ${e.color} break-words`}>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm flex-1">{e.title}</h4>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openEditDialog(e)} title={lang === 'fr' ? 'Modifier' : 'Edit'} className="text-muted-foreground hover:text-primary p-1 transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteEvent(e.id)} title={lang === 'fr' ? 'Supprimer' : 'Delete'} className="text-muted-foreground hover:text-destructive p-1 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {e.time && (
                        <div className="flex items-center gap-1 mt-1 text-xs opacity-80">
                          <Clock className="w-3 h-3 shrink-0" /> {e.time}
                        </div>
                      )}
                      {e.location && (
                        <div className="flex items-center gap-1 mt-1 text-xs opacity-80 break-words">
                          <MapPin className="w-3 h-3 shrink-0" /> {e.location}
                        </div>
                      )}
                      {e.description && (
                        <p className="mt-2 text-xs opacity-70 whitespace-pre-wrap break-words border-t border-current/10 pt-2">{e.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {lang === 'fr' ? 'Aucun événement' : 'No events'}
                </p>
              )
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                {lang === 'fr' ? 'Cliquez sur un jour du calendrier' : 'Click a day on the calendar'}
              </p>
            )}
          </div>

          {/* Upcoming events */}
          <div className="glass-card p-6">
            <h3 className="font-semibold mb-3">{lang === 'fr' ? 'Prochains événements' : 'Upcoming Events'}</h3>
            <div className="space-y-2">
              {allEvents
                .filter(e => new Date(e.date) >= new Date())
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(0, 5)
                .map(e => (
                  <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className={`w-2 h-2 rounded-full ${e.color.split(' ')[0]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(e.date), 'd MMM', { locale })}
                        {e.time ? ` · ${e.time}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
