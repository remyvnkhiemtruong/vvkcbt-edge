import { getSubjectNameVi } from '@shared/index';

export function SubjectCodeSelect({
  subjectCodes,
  value,
  onChange,
  label = 'Môn',
}: {
  subjectCodes: string[];
  value: string;
  onChange: (code: string) => void;
  label?: string;
}) {
  if (subjectCodes.length <= 1) {
    const name = value ? getSubjectNameVi(value) : '—';
    return (
      <p className="admin-hint">
        {label}: <strong>{name}</strong>
      </p>
    );
  }

  return (
    <label className="proctor-form-row" style={{ alignItems: 'center', gap: '0.5rem' }}>
      {label}
      <select className="cbt-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {subjectCodes.map((code) => (
          <option key={code} value={code}>
            {getSubjectNameVi(code)}
          </option>
        ))}
      </select>
    </label>
  );
}
