import React, { createContext, useState, useEffect } from 'react';
import { en } from './en';
import { ta } from './ta';

export const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('treatmentpath_language') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('treatmentpath_language', lang);
  }, [lang]);

  const t = (key, params = {}) => {
    const keys = key.split('.');
    const dictionary = lang === 'ta' ? ta : en;
    let value = dictionary;

    for (let k of keys) {
      if (value[k] === undefined) {
        // Fallback to English
        let fallbackValue = en;
        for (let fk of keys) {
          if (fallbackValue[fk] === undefined) return key; // Return key if missing in English too
          fallbackValue = fallbackValue[fk];
        }
        value = fallbackValue;
        break;
      }
      value = value[k];
    }

    if (typeof value === 'string') {
      let interpolatedValue = value;
      Object.keys(params).forEach(paramKey => {
        interpolatedValue = interpolatedValue.replace(new RegExp(`{{${paramKey}}}`, 'g'), params[paramKey]);
      });
      return interpolatedValue;
    }

    return key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
