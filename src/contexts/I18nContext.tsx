import { createContext, useContext, useState, ReactNode } from 'react';

type Lang = 'fr' | 'en';

const translations = {
  // Login
  'login.subtitle': { fr: 'Gestion de location de véhicules', en: 'Vehicle Rental Management' },
  'login.email': { fr: 'Email', en: 'Email' },
  'login.password': { fr: 'Mot de passe', en: 'Password' },
  'login.submit': { fr: 'Se connecter', en: 'Sign In' },
  'login.error': { fr: 'Identifiants incorrects', en: 'Invalid credentials' },
  'login.demo': { fr: 'Démo', en: 'Demo' },

  // App
  'app.title': { fr: 'Gestion documentaire', en: 'Document Management' },
  'app.management': { fr: 'Gestion locative', en: 'Rental Management' },
  'app.logout': { fr: 'Déconnexion', en: 'Sign Out' },
  'app.search': { fr: 'Rechercher un fichier...', en: 'Search files...' },

  // Categories
  'cat.contract': { fr: 'Contrats', en: 'Contracts' },
  'cat.contract.desc': { fr: 'Contrats de location signés', en: 'Signed rental agreements' },
  'cat.property-photo': { fr: 'Photos', en: 'Photos' },
  'cat.property-photo.desc': { fr: 'Photos HD des véhicules/appartements', en: 'HD photos of vehicles/apartments' },
  'cat.client-file': { fr: 'Dossiers clients', en: 'Client Files' },
  'cat.client-file.desc': { fr: 'CNI, bulletins de salaire, justificatifs', en: 'IDs, payslips, supporting documents' },
  'cat.condition-report': { fr: 'États des lieux', en: 'Condition Reports' },
  'cat.condition-report.desc': { fr: 'Photos et rapports d\'état des lieux', en: 'Photos and condition report documents' },
  'cat.supplier-contract': { fr: 'Contrats fournisseurs', en: 'Supplier Contracts' },
  'cat.supplier-contract.desc': { fr: 'Contrats et documents fournisseurs', en: 'Supplier contracts and documents' },
  'cat.all': { fr: 'Tous les fichiers', en: 'All Files' },

  // Upload
  'upload.title': { fr: 'Uploader des fichiers', en: 'Upload Files' },
  'upload.selectCategory': { fr: 'Catégorie *', en: 'Category *' },
  'upload.dragDrop': { fr: 'Glissez vos fichiers ici', en: 'Drag & drop files here' },
  'upload.browse': { fr: 'ou cliquez pour parcourir', en: 'or click to browse' },
  'upload.maxSize': { fr: 'PDF, JPG, PNG — Max 50 MB', en: 'PDF, JPG, PNG — Max 50 MB' },
  'upload.uploading': { fr: 'Upload en cours...', en: 'Uploading...' },
  'upload.upload': { fr: 'Uploader', en: 'Upload' },
  'upload.success': { fr: 'fichier(s) uploadé(s) avec succès', en: 'file(s) uploaded successfully' },
  'upload.error': { fr: 'Veuillez sélectionner des fichiers et une catégorie', en: 'Please select files and a category' },

  // Files table
  'files.fileName': { fr: 'Fichier', en: 'File' },
  'files.category': { fr: 'Catégorie', en: 'Category' },
  'files.size': { fr: 'Taille', en: 'Size' },
  'files.uploadedBy': { fr: 'Uploadé par', en: 'Uploaded By' },
  'files.date': { fr: 'Date', en: 'Date' },
  'files.actions': { fr: 'Actions', en: 'Actions' },
  'files.noFiles': { fr: 'Aucun fichier dans cette catégorie', en: 'No files in this category' },
  'files.deleted': { fr: 'Fichier supprimé', en: 'File deleted' },
  'files.preview': { fr: 'Aperçu (URL signée 15min)', en: 'Preview (signed URL 15min)' },
  'files.downloading': { fr: 'Téléchargement lancé', en: 'Download started' },
  'files.total': { fr: 'fichiers', en: 'files' },

  // Stats
  'stats.totalFiles': { fr: 'Total fichiers', en: 'Total Files' },
  'stats.totalSize': { fr: 'Stockage utilisé', en: 'Storage Used' },
} as const;

type TranslationKey = keyof typeof translations;

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>('fr');
  const t = (key: TranslationKey): string => translations[key]?.[lang] || key;
  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
};
