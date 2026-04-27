'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Download, Settings2, History } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';

export default function DataSovereigntyPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  const auditQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'securityScanResults'), orderBy('scanTimestamp', 'desc'));
  }, [firestore, user]);

  const { data: auditLogs, isLoading } = useCollection(auditQuery);

  const handleDownloadAudit = () => {
    if (!auditLogs || auditLogs.length === 0) {
      toast({
        variant: "destructive",
        title: "No Data to Export",
        description: "There are no security audit logs to download.",
      });
      return;
    }

    const dataToExport = {
      userId: user?.uid,
      exportDate: new Date().toISOString(),
      compliance: "Sovereignty Audit V2 (GP-2026)",
      auditLogs,
    };

    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `da-costa-audit-report-${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);

    toast({
      title: "Audit Report Exported",
      description: "Your security audit log has been downloaded as a JSON file.",
    });
  };

  const handleExportMetadata = () => {
    // This is a mock implementation as tone signatures are stored locally on the device.
    const mockToneSignatures = {
      'sender1@example.com': {
        version: '1.2',
        signature: 'VECTOR-HASH-SIMULATED-LSA-256-DIM-A',
        lastUpdated: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      },
      'sender2@example.com': {
        version: '1.2',
        signature: 'VECTOR-HASH-SIMULATED-LSA-256-DIM-B',
        lastUpdated: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
      },
    };
    
    const dataToExport = {
      userId: user?.uid,
      exportDate: new Date().toISOString(),
      dataType: "Email Tone Signatures (Local Cache)",
      note: "This is a representation of the data stored locally on your primary device. To transfer, this file can be imported on a new device.",
      signatures: mockToneSignatures,
    };

    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `da-costa-tone-signatures-${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);

    toast({
      title: "Metadata Exported",
      description: "Your simulated email tone signature cache has been downloaded.",
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold">User Data Sovereignty</h1>
        <p className="text-muted-foreground">You own your data. We only audit it for your safety.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="text-primary" />
              Download Audit
            </CardTitle>
            <CardDescription>Get a machine-readable copy of your security logs.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleDownloadAudit}
              disabled={isLoading || !user}
            >
              {isLoading ? 'Loading Logs...' : 'Download JSON Report'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="text-primary" />
              Portability
            </CardTitle>
            <CardDescription>Transfer your tone signatures to another device.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleExportMetadata}
              disabled={!user}
            >
              Export Metadata
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="text-primary" />
              Compliance Transparency
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Da-Costa adheres to the "Architecture of Sovereignty," ensuring that the user remains the sole owner of their security context. 
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Linguistic signatures are encrypted with device-level keys.</li>
              <li>Scan credits are managed via secure ledger, decoupled from private activity.</li>
              <li>Perimeter logs are stored for your eyes only.</li>
            </ul>
            <Button asChild variant="link" className="p-0">
              <Link href="/privacy-policy">View Full Policy</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
