export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary shadow-card">
        <img
          src="/railway-logo.jpeg"
          alt="Indian Railways logo"
          className="h-full w-full object-cover"
        />
      </div>
      <div className="min-w-0">
        <div className="text-[14px] font-bold leading-snug tracking-normal text-primary sm:text-sm">
          SOUTH EAST CENTRAL RAILWAY
          <span className="block">NAGPUR DIVISION</span>
        </div>
        {/* <div className="truncate text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          {subtitle ?? "TC Daily Earning & Complaint System"}
        </div> */}
      </div>
    </div>
  );
}