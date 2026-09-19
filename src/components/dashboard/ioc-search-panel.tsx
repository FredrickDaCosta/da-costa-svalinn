'use client';

import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import app from '@/firebase/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const IOC_TYPES = [
  'IPv4', 'IPv6', 'DOMAIN', 'HOSTNAME', 'URL',
  'HASH_MD5', 'HASH_SHA1', 'HASH_SHA256', 'HASH_SHA512',
  'EMAIL', 'CVE', 'CRYPTO_WALLET', 'IP_RANGE',
] as const;

interface IOCResult {
  id: string;
  type: string;
  value: string;
  confidence: number;
  sources: string[];
  firstSeen: string;
  lastSeen: string;
}

async function searchIOCsViaApi(params: { type?: string; value?: string }): Promise<IOCResult[]> {
  const idToken = await getAuth(app).currentUser?.getIdToken();
  if (!idToken) throw new Error('Not signed in.');

  const search = new URLSearchParams();
  if (params.type) search.set('type', params.type);
  if (params.value) search.set('value', params.value);
  search.set('limit', '50');

  const res = await fetch(`/api/ioc/process?${search.toString()}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'IOC search failed.');
  }
  const data = await res.json();
  return data.iocs || [];
}

export function IOCSearchPanel() {
  const { toast } = useToast();
  const [type, setType] = useState<string>('all');
  const [value, setValue] = useState('');
  const [results, setResults] = useState<IOCResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const iocs = await searchIOCsViaApi({
        type: type !== 'all' ? type : undefined,
        value: value.trim() || undefined,
      });
      setResults(iocs);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Search failed', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="size-5 text-primary" /> IOC Search
        </CardTitle>
        <CardDescription>Search indicators of compromise collected from threat-intel and analyst alerts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {IOC_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search value (URL, IP, hash, email, CVE ID...)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 min-w-[240px]"
          />
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Search className="mr-2 size-4" />}
            Search
          </Button>
        </div>

        {results === null ? (
          <p className="text-sm text-muted-foreground">Run a search to see results.</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground">No IOCs matched.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>First Seen</TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((ioc) => (
                <TableRow key={ioc.id}>
                  <TableCell><Badge variant="outline">{ioc.type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs max-w-[280px] truncate">{ioc.value}</TableCell>
                  <TableCell>{Math.round(ioc.confidence * 100)}%</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{ioc.sources?.join(', ')}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {ioc.firstSeen ? new Date(ioc.firstSeen).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {ioc.lastSeen ? new Date(ioc.lastSeen).toLocaleDateString() : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
