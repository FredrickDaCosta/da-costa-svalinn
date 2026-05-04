'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { CreditCard, LifeBuoy, LogOut, Settings } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth as useFirebaseService } from '@/firebase';
import { useLocalization } from '@/hooks/use-localization';

export function UserNav() {
  const { user, logout } = useAuth();
  const auth = useFirebaseService();
  const router = useRouter();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const { t } = useLocalization();

  useEffect(() => { setIsClient(true); }, []);

  const getInitials = (name: string) => {
    if (!name || name === 'User') return 'DC';
    const names = name.trim().split(' ').filter(Boolean);
    if (names.length >= 2) return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    return names[0].substring(0, 2).toUpperCase();
  };

  const handleSupportClick = () => {
    toast({ title: 'Support Requested', description: 'A support agent will be with you shortly via secure chat.' });
  };

  const handleLogoutClick = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear all local state and session flags
      logout();
      sessionStorage.clear();
      localStorage.removeItem('da-costa-consent-given');

      // Navigate to home page
      setTimeout(() => { window.location.href = '/'; }, 100);
    }
  };

  if (!isClient) return <Skeleton className="h-10 w-10 rounded-full" />;

  const displayName = user.name && user.name !== 'User' ? user.name : '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 rounded-full flex items-center gap-2 px-2 hover:bg-primary/10">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          {displayName && (
            <span className="hidden md:inline text-sm font-semibold text-foreground max-w-[140px] truncate">
              {displayName}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-semibold leading-none text-foreground">
              {user.name && user.name !== 'User' ? user.name : 'Da-Costa User'}
            </p>
            {user.email && (
              <p className="text-xs leading-none text-muted-foreground truncate">{user.email}</p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className="cursor-default">
            <CreditCard className="mr-2 h-4 w-4" />
            <span>{t('user_nav_credits', { count: user.credits.toString() })}</span>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/account" className="flex w-full items-center">
              <Settings className="mr-2 h-4 w-4" />
              <span>{t('user_nav_settings')}</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSupportClick} className="cursor-pointer">
          <LifeBuoy className="mr-2 h-4 w-4" />
          <span>{t('user_nav_support')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogoutClick} className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t('user_nav_logout')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
