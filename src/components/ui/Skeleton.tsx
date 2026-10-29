/** Loading placeholder shown briefly before data is ready: `tiles` (in the header), `filters`, `list` (lead list). */
export function Skeleton({ part }: { part: 'tiles' | 'filters' | 'list' }) {
  if (part === 'tiles') {
    return (
      <>
        <div className="kpis">
          {Array.from({ length: 4 }, (_, i) => (
            <div className="card kpi" key={i}>
              <div style={{ flex: 1 }}>
                <div className="skel" style={{ width: '60%' }} />
                <div className="skel" style={{ width: '40%', height: 24, margin: '10px 0' }} />
                <div className="skel" />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }
  if (part === 'filters') {
    return (
      <div className="card filters" aria-busy="true">
        <div style={{ padding: '14px 16px', display: 'grid', gap: 10 }}>
          <div className="skel" style={{ height: 32 }} />
        </div>
      </div>
    );
  }
  return (
    <section className="card leads" aria-busy="true">
      <div className="lhead"><div className="skel" style={{ width: 220 }} /></div>
      <div style={{ padding: '14px 16px', display: 'grid', gap: 10 }}>
        {Array.from({ length: 5 }, (_, i) => <div className="skel" key={i} />)}
      </div>
    </section>
  );
}
