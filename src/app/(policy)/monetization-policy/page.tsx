import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

export default function MonetizationPolicyPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-3xl">Monetization & Ads Policy</CardTitle>
        <p className="text-sm text-muted-foreground">Our commitment to a fair experience.</p>
      </CardHeader>
      <CardContent className="space-y-4 text-muted-foreground">
        <h2 className="text-xl font-semibold text-foreground pt-4">Our Hybrid Freemium Model</h2>
        <p>
          We believe everyone deserves access to essential cybersecurity tools. Our model is designed to provide a robust free service while offering advanced features for professionals and power users.
        </p>
        
        <div className="space-y-2 rounded-lg border p-4">
            <h3 className="font-bold text-foreground">Free Tier</h3>
            <ul className="space-y-1">
                <li className="flex items-center gap-2"><CheckCircle className="size-4 text-primary"/> Access to core scanning tools.</li>
                <li className="flex items-center gap-2"><CheckCircle className="size-4 text-primary"/> A daily limit of free scans (credits).</li>
                <li className="flex items-center gap-2"><CheckCircle className="size-4 text-primary"/> Occasional banner ads to support the service.</li>
                <li className="flex items-center gap-2"><CheckCircle className="size-4 text-primary"/> Option to watch rewarded ads for more credits.</li>
            </ul>
        </div>

        <div className="space-y-2 rounded-lg border p-4">
            <h3 className="font-bold text-foreground">Premium Tier</h3>
            <ul className="space-y-1">
                <li className="flex items-center gap-2"><CheckCircle className="size-4 text-primary"/> Completely ad-free experience.</li>
                <li className="flex items-center gap-2"><CheckCircle className="size-4 text-primary"/> Unlimited scans with no credit limits.</li>
                <li className="flex items-center gap-2"><CheckCircle className="size-4 text-primary"/> Access to all premium and early-access features.</li>
            </ul>
        </div>

        <h2 className="text-xl font-semibold text-foreground pt-4">Our Ad Placement Philosophy</h2>
        <p>
          Our first priority is your security and user experience.
          - Ads will NEVER block, cover, or interfere with security functions.
          - We only use standard banner formats in non-intrusive locations.
          - There are no pop-up or full-screen interstitial ads outside of user-initiated rewarded videos.
        </p>
      </CardContent>
    </Card>
  );
}
