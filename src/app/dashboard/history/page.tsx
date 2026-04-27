'use client';

import dynamic from 'next/dynamic';

const HistoryPageClient = dynamic(
  () => import('@/components/dashboard/history-client'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[50vh]">
        <div style={{color:'#00e5c8',fontSize:14}}>Loading security logs...</div>
      </div>
    ),
  }
);

export default function HistoryPage() {
  return <HistoryPageClient />;
}
