export function EmptyTab({
  tab,
  justification,
}: {
  tab: string;
  justification: string;
}): JSX.Element {
  return (
    <div
      role="status"
      data-testid={`empty-${tab}`}
      className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm"
    >
      <div className="font-semibold">No data for this tab yet.</div>
      <div className="mt-1 text-muted-foreground" data-testid={`empty-${tab}-justification`}>
        {justification}
      </div>
    </div>
  );
}
