import { useEffect, useState } from 'react';

import { CbtCard, SCHOOL_NAME, vi, isProductionUi, getSubjectNameVi, formatSlotStatus } from '@shared/index';

import { studentApi } from '../api';

import { useOfflinePrefetch } from '../hooks/useOffline';

import { useExamStore } from '../store';



interface Slot {

  id: string;

  subjectCode: string;

  sbd?: string;

  labRoom?: string;

  scheduledStart: string;

  scheduledEnd: string;

  status: string;

  structureTemplate?: { code: string; durationMin: number; uiMode: string } | null;

}



interface Props {

  onStartExam: () => void;

}



function slotStatusLabel(status: string): string {
  return formatSlotStatus(status);
}

function Countdown({ target }: { target: string }) {

  const [label, setLabel] = useState('');

  useEffect(() => {

    const tick = () => {

      const diff = new Date(target).getTime() - Date.now();

      if (diff <= 0) {

        setLabel('Sắp mở');

        return;

      }

      const m = Math.floor(diff / 60000);

      const s = Math.floor((diff % 60000) / 1000);

      setLabel(`Mở sau ${m}:${String(s).padStart(2, '0')}`);

    };

    tick();

    const id = setInterval(tick, 1000);

    return () => clearInterval(id);

  }, [target]);

  return label ? <p style={{ fontSize: '0.85rem', color: 'var(--cbt-primary)' }}>{label}</p> : null;

}



export default function SlotsPage({ onStartExam }: Props) {

  const [slots, setSlots] = useState<Slot[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [roomName, setRoomName] = useState('');

  const storeSbd = useExamStore((s) => s.sbd);



  const load = async () => {

    try {

      const data = await studentApi.listSlots();

      setSlots(data);

    } catch (e) {

      setError(e instanceof Error ? e.message : 'Không tải được lịch thi');

    } finally {

      setLoading(false);

    }

  };



  useEffect(() => {

    load();

    studentApi.roomContext().then((ctx) => setRoomName(ctx.roomName)).catch(() => {});

    const t = setInterval(load, 15000);

    return () => clearInterval(t);

  }, []);



  const nextScheduled = slots.find((s) => s.status === 'scheduled');

  useOfflinePrefetch(nextScheduled?.id ?? slots[0]?.id ?? null);



  const startSlot = async (slot: Slot) => {

    if (slot.status !== 'open') return;

    try {

      await studentApi.startSlot(slot.id);

      onStartExam();

    } catch (e) {

      setError(e instanceof Error ? e.message : 'Không mở được ca thi');

    }

  };



  if (loading) return <div className="loading">Đang tải lịch thi cá nhân...</div>;



  const production = isProductionUi();



  return (

    <div className="slots-page">

      {!production && (

        <div className="slots-page__feature">

          <h1>PHÒNG CHỜ — LỊCH THI CÁ NHÂN</h1>

          <p>{vi.subtitle}</p>

        </div>

      )}

      {production && (

        <header className="slots-page__header">

          <h1>Phòng chờ thi</h1>

          <p>{SCHOOL_NAME}</p>

        </header>

      )}

      {error && <p className="cbt-error-text">{error}</p>}

      <div className="slots-grid">

        {slots.map((slot) => {

          const sbd = slot.sbd || storeSbd || '—';

          const room = slot.labRoom || roomName || '—';

          const statusLabel = slotStatusLabel(slot.status);

          const statusColor =

            slot.status === 'open'

              ? 'var(--cbt-success)'

              : slot.status === 'completed'

                ? 'var(--cbt-text-muted)'

                : slot.status === 'scheduled' &&

                    new Date() >= new Date(slot.scheduledStart)

                  ? '#b45309'

                  : 'var(--cbt-text-muted)';

          const statusBg =

            slot.status === 'open'

              ? 'var(--cbt-success-bg)'

              : slot.status === 'completed'

                ? 'var(--cbt-empty-bg)'

                : 'var(--cbt-empty-bg)';



          return (

            <CbtCard key={slot.id} variant={slot.status === 'open' ? 'passage' : 'default'}>

              <h3 style={{ color: 'var(--cbt-primary)' }}>

                {getSubjectNameVi(slot.subjectCode)}

              </h3>

              <p style={{ fontSize: '0.9rem', margin: '0.35rem 0' }}>

                <strong>SBD:</strong> {sbd} · <strong>Phòng:</strong> {room}

              </p>

              <p style={{ fontSize: '0.85rem', color: 'var(--cbt-text-muted)' }}>

                {new Date(slot.scheduledStart).toLocaleString('vi-VN')} —{' '}

                {new Date(slot.scheduledEnd).toLocaleString('vi-VN')}

              </p>

              <p style={{ fontSize: '0.85rem' }}>Thời lượng: {slot.structureTemplate?.durationMin ?? 90} phút</p>

              {slot.status === 'scheduled' && new Date() >= new Date(slot.scheduledStart) && (

                <p style={{ fontSize: '0.85rem', color: '#b45309' }}>Đã đến giờ — chờ giám thị mở đề</p>

              )}

              {slot.status === 'scheduled' && new Date() < new Date(slot.scheduledStart) && (

                <Countdown target={slot.scheduledStart} />

              )}

              <span

                className="slot-status"

                style={{

                  display: 'inline-block',

                  marginTop: '0.5rem',

                  padding: '0.2rem 0.5rem',

                  borderRadius: '4px',

                  background: statusBg,

                  color: statusColor,

                  fontWeight: 600,

                }}

              >

                {statusLabel}

              </span>

              <button

                type="button"

                className="cbt-btn cbt-btn-primary"

                style={{ width: '100%', marginTop: '0.75rem' }}

                disabled={slot.status !== 'open'}

                onClick={() => startSlot(slot)}

              >

                VÀO THI

              </button>

            </CbtCard>

          );

        })}

      </div>

      {slots.length === 0 && <p>Chưa có ca thi được phân. Liên hệ giám thị.</p>}

      {slots.every((s) => s.status !== 'open') && slots.length > 0 && (

        <button type="button" className="cbt-btn cbt-btn-outline" onClick={onStartExam}>

          Tiếp tục (đề đã gán)

        </button>

      )}

      {!production && (

        <footer className="slots-page__footer">

          <span>

            {SCHOOL_NAME} | {vi.footerDoc}

          </span>

          <span>Trang 3/24</span>

        </footer>

      )}

    </div>

  );

}

