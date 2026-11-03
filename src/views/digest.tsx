import type { DigestRow } from '../digest/types.js';

const columns = ['job', 'owner', 'runs', 'retries', 'last status', 'last error', 'first at', 'last at'];

export function DigestPage({ night, rows }: { night: string; rows: DigestRow[] }) {
  const sortedRows = [...rows].sort((a, b) => a.job.localeCompare(b.job));

  return (
    <>
      <h1>digest · {night}</h1>
      {sortedRows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              {columns.map((column) => <th>{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr>
                <td>{row.job}</td>
                <td>{row.owner ?? '—'}</td>
                <td>{row.runs}</td>
                <td>{row.retries >= 3 ? <span class="warn">{row.retries}</span> : row.retries}</td>
                <td>{row.lastStatus === 'fail' ? <span class="warn">{row.lastStatus}</span> : row.lastStatus}</td>
                <td>{row.lastError ?? '—'}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
