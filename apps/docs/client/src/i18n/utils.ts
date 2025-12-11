import { defaultLang, ui } from "./ui";

export function useTranslations(lang: keyof typeof ui) {
  return function t(key: keyof (typeof ui)[typeof defaultLang]) {
    return key in ui[lang]
      ? ui[lang][key as keyof (typeof ui)[typeof lang]]
      : ui[defaultLang][key];
  };
}
