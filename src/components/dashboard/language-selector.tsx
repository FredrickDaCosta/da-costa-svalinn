'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocalization } from '@/hooks/use-localization';
import { supportedLanguages, type Locale } from '@/context/language-provider';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { Languages } from 'lucide-react';

export function LanguageSelector() {
  const { locale, setLocale, t } = useLocalization();
  const currentLang = supportedLanguages.find((l) => l.code === locale);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-headline">
            <Languages className="text-primary size-5" />
            {t('account_language_region')}
        </CardTitle>
        <CardDescription>{t('account_language_region_desc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Select onValueChange={(value: Locale) => setLocale(value)} defaultValue={locale}>
          <SelectTrigger className="w-full bg-background/50 border-primary/20 hover:border-primary/40 transition-colors h-11">
            <SelectValue placeholder={t('account_select_language')}>
              {currentLang && (
                <div className="flex items-center gap-2.5">
                  <span className="text-xl leading-none">{currentLang.icon}</span>
                  <span className="font-medium">{currentLang.name}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[300px] border-primary/20 bg-card">
            {supportedLanguages.map((lang) => (
              <SelectItem 
                key={lang.code} 
                value={lang.code}
                className="focus:bg-primary/10 focus:text-primary cursor-pointer py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl leading-none">{lang.icon}</span>
                  <span className={lang.code === locale ? 'font-bold' : 'font-medium'}>
                    {lang.name}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
