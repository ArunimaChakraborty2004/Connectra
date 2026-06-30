import { Hexagon } from 'lucide-react';

export default function Loader({ fullScreen = false }) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="animate-spin text-primary">
        <Hexagon size={40} />
      </div>
      <p className="text-[#666] text-sm font-medium animate-pulse">Loading...</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-[#000] flex items-center justify-center">
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
