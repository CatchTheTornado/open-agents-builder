'use client';

import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Bell, DollarSign, User } from 'lucide-react';
import { useContext } from 'react';
import { DatabaseContext } from '@/contexts/db-context';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './language-switcher';
import { useRouter } from 'next/navigation';
import { ChangeKeyPopup } from '../change-key-popup';
import { KeyContext } from '@/contexts/key-context';
import FeedbackWidget from '../feedback-widget';
import StatsPopup from '../stats-popup';
import { StatsContext } from '@/contexts/stats-context';
import SharedKeysPopup from '../shared-keys-popup';
import { useTheme } from 'next-themes';

export function Header() {
  const { t } = useTranslation();
  const dbContext = useContext(DatabaseContext);
  const keysContext = useContext(KeyContext);
  const statsContext = useContext(StatsContext);
  const router = useRouter();

  const { theme, systemTheme } = useTheme();
  const currentTheme = (theme === 'system' ? systemTheme : theme)


  return (
    <header className="flex h-14 items-center gap-4 border-b bg-card px-6">
      <FeedbackWidget />
      <StatsPopup />
      {!dbContext?.acl || dbContext.acl.role === 'owner' ? (<SharedKeysPopup />) : (null)}
      <div className="flex-1">
        <img src={ currentTheme === 'dark' ? "/img/OAB-Logo-dark.svg" : "/img/OAB-Logo.svg"} alt="Open Agents Builder" className="w-64"/>
      </div>
      {!dbContext?.acl || dbContext.acl.role === 'owner' ? (<ChangeKeyPopup />) : (null)}
      <div className="flex items-center gap-4">
        {!dbContext?.acl || dbContext.acl.role === 'owner' ? (
          <Button variant="ghost" size="icon" onClick={(e) => statsContext.setStatsPopupOpen(true)}>
            <DollarSign className="h-5 w-5" />
          </Button>
        ) : (null)}
        <ThemeToggle />
        <LanguageSwitcher />        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* <DropdownMenuItem>{t('Profile')}</DropdownMenuItem> */}
            {!dbContext?.acl || dbContext.acl.role === 'owner' ? (<DropdownMenuItem onSelect={() => router.push('/admin/settings')}>{t('Your profile and settings')}</DropdownMenuItem>) : (null)}
            {!dbContext?.acl || dbContext.acl.role === 'owner' ? (<DropdownMenuItem onSelect={() => keysContext?.setChangePasswordDialogOpen(true)}>{t('Change password')}</DropdownMenuItem>) : (null)}
            {!dbContext?.acl || dbContext.acl.role === 'owner' ? (<DropdownMenuItem onSelect={() => { keysContext.setSharedKeysDialogOpen(true); } }>{t('Team & Sharing')}</DropdownMenuItem>) : (null)}
            <DropdownMenuSeparator />
            {!dbContext?.acl || dbContext.acl.role === 'owner' ? (<DropdownMenuItem onSelect={() => router.push('/admin/settings')}>{t('Agent templates')}</DropdownMenuItem>) : (null)}
            <DropdownMenuItem onClick={() => {
                router.push("/admin/settings/stats");
                // statsContext.setStatsPopupOpen(true)
              }} > {t('Stats and token usage')} </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => window.open('mailto:info@catchthetornado.com?subject=' + encodeURIComponent('Support reuest for ' + dbContext?.databaseIdHash))}>{t('Contact Support')}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => {
              dbContext?.logout();
            }}>{t('Sign out')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}