import { useEffect, useState } from 'react';
import { proctorApi } from '../api';

export function BackupTab({ token }: { token: string }) {
  const [backups, setBackups] = useState<string[]>([]);

  const reload = () => {
    proctorApi<string[]>('/core/backup', token)
      .then(setBackups)
      .catch(console.error);
  };

  useEffect(() => {
    reload();
  }, [token]);

  const doBackup = async () => {
    if (!confirm('Tạo backup CSDL và uploads trên server?')) return;
    const res = await proctorApi<{ path: string }>('/core/backup', token, { method: 'POST' });
    alert(`Backup: ${res.path}`);
    reload();
  };

  const restore = async (filename: string) => {
    if (!confirm(`Phục hồi từ ${filename}? Dữ liệu hiện tại có thể bị ghi đè.`)) return;
    const res = await proctorApi<{ message: string }>('/core/backup/restore', token, {
      method: 'POST',
      body: JSON.stringify({ filename }),
    });
    alert(res.message);
    reload();
  };

  return (
    <div className="proctor-tab-panel">
      <h3>Sao lưu & phục hồi</h3>
      <p className="admin-hint">Chỉ thực hiện trên máy Edge LAN tin cậy.</p>
      <button type="button" className="cbt-btn cbt-btn-primary" onClick={doBackup} style={{ marginBottom: '1rem' }}>
        Tạo backup
      </button>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {backups.map((b) => (
          <li key={b} style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span>{b}</span>
            <button type="button" className="cbt-btn cbt-btn-outline" style={{ fontSize: '0.75rem' }} onClick={() => restore(b)}>
              Phục hồi
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
