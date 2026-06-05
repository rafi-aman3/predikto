export function StatusPill({
  predicted, total,
}: { predicted: number; total: number }) {
  const done = predicted >= total && total > 0;
  return (
    <div className={`rp-pill text-center text-base ${done ? 'bg-pitch-light' : ''}`}>
      {done ? `✓ ${predicted}/${total} predicted` : `▶ predict ${total - predicted}`}
    </div>
  );
}
