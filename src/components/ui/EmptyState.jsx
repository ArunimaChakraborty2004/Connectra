import { FileQuestion } from 'lucide-react';

export default function EmptyState({
  icon: Icon = FileQuestion,
  title = 'No data found',
  description = 'There is nothing to show here right now.',
}) {
  return (
    <div
      className="flex flex-col items-center justify-center p-12 text-center rounded-2xl"
      style={{
        border: '2px dashed var(--border-color)',
        backgroundColor: 'var(--surface-color)',
      }}
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border-color)' }}
      >
        <Icon size={28} style={{ color: 'var(--text-muted)', opacity: 0.7 }} />
      </div>
      <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-color)' }}>
        {title}
      </h3>
      <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>
        {description}
      </p>
    </div>
  );
}
