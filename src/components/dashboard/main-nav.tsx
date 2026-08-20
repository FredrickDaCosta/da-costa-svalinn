'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard,
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
} from 'lucide-react';
import { SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { useLocalization } from '@/hooks/use-localization';
import type { TranslationKey } from '@/context/language-provider';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'nav_dashboard', scan: null },
  { href: '/dashboard?scan=link', icon: LinkIcon, labelKey: 'nav_link_scrutinizer', scan: 'link' },
  { href: '/dashboard?scan=lure', icon: ScanText, labelKey: 'nav_lure_detector', scan: 'lure' },
  { href: '/dashboard?scan=video', icon: Film, labelKey: 'nav_video_auditor', scan: 'video' },
  { href: '/dashboard?scan=email', icon: MailWarning, labelKey: 'nav_email_analyzer', scan: 'email' },
  { href: '/dashboard?scan=sms', icon: Phone, labelKey: 'nav_sms_call_shield', scan: 'sms' },
  { href: '/dashboard?scan=deepfake', icon: Mic, labelKey: 'nav_deepfake_analyzer', scan: 'deepfake' },
  { href: '/dashboard/email-accounts', icon: Mail, labelKey: 'nav_linked_accounts', scan: null },
  { href: '/dashboard/account', icon: CreditCard, labelKey: 'nav_account_settings', scan: null },
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
      </SidebarMenu>
    </SidebarContent>
  );
}
