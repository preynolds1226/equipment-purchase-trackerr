type StatCardProps = {
  label: string;
  value: string;
  note: string;
};

export function StatCard({ label, value, note }: StatCardProps) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <p className="text-sm font-medium text-muted">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <strong className="text-3xl font-bold">{value}</strong>
        <span className="h-2 w-14 rounded-full bg-accent" />
      </div>
      <p className="mt-3 text-sm text-muted">{note}</p>
    </article>
  );
}
