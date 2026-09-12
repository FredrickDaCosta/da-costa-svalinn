'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard,
  Crown,
  Film,
  LayoutDashboard,
  Link as LinkIcon,
  MailWarning,
  ScanText,
  Mail,
  FileLock,
  UserCog,
  Phone,
  Mic,
  Shield,
} from 'lucide-react';
import { SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarSeparator } from '@/components/ui/sidebar';
import { useLocalization } from '@/hooks/use-localization';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@/context/language-provider';

const ADMIN_UIDS = [process.env.NEXT_PUBLIC_ADMIN_UID].filter(Boolean);
const ADMIN_EMAILS = ['fredrick.a.dacosta@gmail.com', 'fad@da-costa.online'];

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'nav_dashboard', scan: null },
  { href: '/dashboard/analyst', icon: Shield, labelKey: 'nav_analyst', scan: null },
  { href: '/dashboard?scan=link', icon: LinkIcon, labelKey: 'nav_link_scrutinizer', scan: 'link' },
  { href: '/dashboard?scan=lure', icon: ScanText, labelKey: 'nav_lure_detector', scan: 'lure' },
  { href: '/dashboard?scan=video', icon: Film, labelKey: 'nav_video_auditor', scan: 'video' },
  { href: '/dashboard?scan=email', icon: MailWarning, labelKey: 'nav_email_analyzer', scan: 'email' },
  { href: '/dashboard?scan=sms', icon: Phone, labelKey: 'nav_sms_call_shield', scan: 'sms' },
  { href: '/dashboard?scan=deepfake', icon: Mic, labelKey: 'nav_deepfake_analyzer', scan: 'deepfake' },
  { href: '/dashboard/email-accounts', icon: Mail, labelKey: 'nav_linked_accounts', scan: null },
  { href: '/dashboard/account', icon: CreditCard, labelKey: 'nav_account_settings', scan: null },
  { href: '/dashboard/upgrade', icon: Crown, labelKey: 'account_view_upgrades', scan: null },
];

const policyNavItems = [
    { href: '/privacy-policy', icon: FileLock, labelKey: 'nav_privacy_policy' },
    { href: '/dashboard/sovereignty', icon: UserCog, labelKey: 'nav_sovereignty_privacy' },
]

export function MainNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeScan = searchParams.get('scan');
  const { t } = useLocalization();
  const { user } = useAuth();

  const isAdmin =
    (!!user?.uid && ADMIN_UIDS.includes(user.uid)) ||
    (!!user?.email && ADMIN_EMAILS.includes(user.email));

  return (
    <SidebarContent>
      <SidebarMenu>
        {navItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/dashboard' ? activeScan === item.scan : pathname === item.href}
              tooltip={{ children: t(item.labelKey as TranslationKey), className: 'bg-primary text-primary-foreground' }}
            >
              <Link href={item.href}>
                <item.icon />
                <span>{t(item.labelKey as TranslationKey)}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        {policyNavItems.map((item) => (
             <SidebarMenuItem key={item.href}>
             <SidebarMenuButton
               asChild
               isActive={pathname === item.href}
               tooltip={{ children: t(item.labelKey as TranslationKey), className: 'bg-primary text-primary-foreground' }}
             >
               <Link href={item.href}>
                 <item.icon />
                 <span>{t(item.labelKey as TranslationKey)}</span>
               </Link>
             </SidebarMenuButton>
           </SidebarMenuItem>
        ))}
        {isAdmin && (
          <>
            <SidebarSeparator />
            <SidebarMenuItem key="/dashboard/admin">
              <SidebarMenuButton
                asChild
                isActive={pathname === '/dashboard/admin'}
                tooltip={{ children: 'Admin', className: 'bg-primary text-primary-foreground' }}
                className={cn(
                  'border border-teal-500/40 bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 hover:text-teal-700',
                  'dark:text-teal-400 dark:hover:text-teal-300'
                )}
              >
                <Link href="/dashboard/admin">
                  <Shield />
                  <span>Admin</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </>
        )}
      </SidebarMenu>
    </SidebarContent>
  );
}
