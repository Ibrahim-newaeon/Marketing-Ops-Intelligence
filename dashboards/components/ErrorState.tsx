export function ErrorState({
  title = "Something went wrong",
  detail,
  onRetry,
}: {
  title?: string;
  detail?: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div
      role="alert"
      data-testid="error-state"
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-4"
    >
      <div className="text-sm font-semibold text-destructive">{title}</div>
      {detail && (
        <pre
          className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground"
          data-testid="error-detail"
        >
          {detail}
        </pre>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          data-testid="error-retry"
          className="mt-3 rounded-md border border-border px-3 py-1 text-xs hover:bg-muted"
        >
          Retry
        </button>
      )}
    </div>
  );
}
