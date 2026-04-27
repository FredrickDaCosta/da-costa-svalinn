export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <h2>404 – Page Not Found</h2>
      <a href="/" style={{ marginTop: 16, color: '#00e5c8' }}>Go home</a>
    </div>
  );
}
