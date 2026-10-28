import { Hexagon } from 'lucide-react';

export default function Loader({ fullScreen = false }) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="animate-spin" style={{ color: 'var(--primary-color)' }}>
        <Hexagon size={40} />
      </div>
      <p className="text-sm font-medium animate-pulse" style={{ color: 'var(--text-muted)' }}>
        Loading...
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-color)' }}
      >
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12 w-full">
      {content}
    </div>
  );
}
