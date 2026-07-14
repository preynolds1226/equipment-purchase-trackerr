type StateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: StateProps) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background p-6 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-md bg-surface-muted text-sm font-bold text-muted">
        0
      </div>
      <h2 className="mt-4 text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}

export function LoadingState({ title, description }: StateProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-sm text-muted">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function ErrorState({ title, description }: StateProps) {
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-950 shadow-sm dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-sm opacity-80">{description}</p>
    </div>
  );
}
