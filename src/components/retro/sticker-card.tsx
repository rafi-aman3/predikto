import type { ReactNode } from 'react';

export function StickerCard({
  children, className = '', hover = false, as: Tag = 'div',
}: {
  children: ReactNode; className?: string; hover?: boolean;
  as?: 'div' | 'section' | 'article';
}) {
  return (
    <Tag className={`rp-card p-4 ${hover ? 'rp-hover-lift' : ''} ${className}`}>
      {children}
    </Tag>
  );
}
