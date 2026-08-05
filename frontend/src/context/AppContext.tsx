import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'en' | 'ar';
export type Theme = 'light' | 'dark';

interface AppContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isRTL: boolean;
  currency: string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>('en');
  // The "Riverside Padel" glass/neon design system is dark-native — there's no
  // spec'd light variant, so dark is the fixed theme (no toggle exposed in the UI).
  const [theme, setTheme] = useState<Theme>('dark');

  const isRTL = lang === 'ar';
  const currency = lang === 'ar' ? 'ر.ع.' : 'OMR';

  // Apply dark mode class to root HTML element and set text direction
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    root.dir = isRTL ? 'rtl' : 'ltr';
    root.lang = lang;
  }, [theme, isRTL, lang]);

  return (
    <AppContext.Provider
      value={{
        lang,
        setLang,
        theme,
        setTheme,
        isRTL,
        currency,
      }}
    >
      <div className={theme === 'dark' ? 'dark' : ''}>
        {children}
      </div>
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
