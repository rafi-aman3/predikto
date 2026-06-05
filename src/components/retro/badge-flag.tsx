const SIZES = { sm: 'w-8 h-8 text-sm', md: 'w-11 h-11 text-xl', lg: 'w-[74px] h-[74px] text-4xl' } as const;

export function BadgeFlag({
  flag, code, size = 'md',
}: { flag: string | null; code: string; size?: keyof typeof SIZES }) {
  return (
    <span
      role="img"
      aria-label={code}
      className={`${SIZES[size]} inline-flex items-center justify-center rounded-full border-[3px] border-ink bg-gold rp-shadow-sm`}
    >
      {flag ?? code}
    </span>
  );
}
