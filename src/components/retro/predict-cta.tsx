import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function PredictCTA({
  children, className = '', ...rest
}: { children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`rp-cta px-5 py-3 disabled:opacity-60 cursor-pointer ${className}`} {...rest}>
      {children}
    </button>
  );
}
