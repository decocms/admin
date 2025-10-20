import React from "react";
import { Select } from "../atoms/Select";

interface LanguageSelectorProps {
  locale: string;
  className?: string;
}

export function LanguageSelector({ locale, className }: LanguageSelectorProps) {
  const languageOptions = [
    { value: "en", label: "English" },
    { value: "pt-br", label: "Português" },
  ];

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocale = event.target.value;
    // Navigate to the new locale URL
    const currentPath = globalThis.location.pathname;
    const pathWithoutLocale = currentPath.replace(/^\/[^/]+/, "");
    globalThis.location.href = `/${newLocale}${pathWithoutLocale}`;
  };

  return (
    <Select
      options={languageOptions}
      value={locale}
      icon="Languages"
      className={className}
      selectClassName="text-muted-foreground"
      onChange={handleChange}
    />
  );
}
