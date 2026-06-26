import { useEffect, useRef, useState } from 'react';
import { proctorApi } from '../api';

const API = import.meta.env.VITE_API_URL || '';

export function BackupTab({ token }: { token: string }) {
  const [backups, setBackups] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () => {
    proctorApi<string[]>('/core/backup', token)
      .then(setBackups)
      .catch(console.error);
  };

  useEffect(() => {
    reload();
  }, [token]);

  const doBackup = async () => {
    if (!confirm('Tạo bản sao lưu CSDL và tệp đính kèm trên máy chủ?')) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await proctorApi<{ path: string }>('/core/backup', token, { method: 'POST' });
      setMsg(`Đã tạo sao lưu: ${res.path.split(/[/\\]/).pop() ?? res.path}`);
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Tạo sao lưu thất bại');
    } finally {
      setBusy(false);
    }
  };

  const exportFile = async (filename: string) => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/api/core/backup/download/${encodeURIComponent(filename)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setMsg(`Đã xuất file ${filename}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Xuất file thất bại');
    } finally {
      setBusy(false);
    }
  };

  const restore = async (filename: string) => {
    if (!confirm(`Phục hồi từ "${filename}"? Dữ liệu hiện tại có thể bị ghi đè.`)) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await proctorApi<{ message: string }>('/core/backup/restore', token, {
        method: 'POST',
        body: JSON.stringify({ filename }),
      });
      setMsg(res.message);
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Phục hồi thất bại');
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file: File) => {
    if (!confirm(`Nhập và phục hồi từ "${file.name}"? Dữ liệu hiện tại có thể bị ghi đè.`)) return;
    setBusy(true);
    setMsg('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API}/api/core/backup/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { message: string };
      setMsg(data.message);
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Nhập file thất bại');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="proctor-tab-panel">
      <h3>Sao lưu &amp; phục hồi</h3>
      <p className="admin-hint">Chỉ thực hiện trên máy Edge LAN tin cậy. Xuất file ra USB trước khi phục hồi.</p>

      <div className="proctor-backup-actions">
        <button type="button" className="cbt-btn cbt-btn-primary" disabled={busy} onClick={doBackup}>
          {busy ? 'Đang xử lý…' : 'Tạo sao lưu mới'}
        </button>
        <button
          type="button"
          className="cbt-btn cbt-btn-outline"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          Nhập file phục hồi
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,.enc"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
          }}
        />
      </div>

      <h4 className="proctor-backup-list-title">Danh sách bản sao lưu trên máy chủ</h4>
      {backups.length === 0 ? (
        <p className="admin-hint">Chưa có bản sao lưu nào.</p>
      ) : (
        <ul className="proctor-backup-list">
          {backups.map((b) => (
            <li key={b}>
              <span className="proctor-backup-list__name">{b}</span>
              <div className="proctor-backup-list__btns">
                <button
                  type="button"
                  className="cbt-btn cbt-btn-outline cbt-btn-sm"
                  disabled={busy}
                  onClick={() => exportFile(b)}
                >
                  Xuất file
                </button>
                <button
                  type="button"
                  className="cbt-btn cbt-btn-outline cbt-btn-sm"
                  disabled={busy}
                  onClick={() => restore(b)}
                >
                  Phục hồi
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="proctor-tab-msg">{msg}</p>}
    </div>
  );
}
