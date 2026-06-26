import { CbtPageShell, CbtBrandLogo } from '@shared/index';

import { useExamStore } from '../store';



const SUBJECT_VI: Record<string, string> = {

  MATH: 'Toán',

  LITERATURE: 'Ngữ văn',

  ENGLISH: 'Tiếng Anh',

  PHYSICS: 'Vật lý',

  CHEMISTRY: 'Hóa học',

  BIOLOGY: 'Sinh học',

  HISTORY: 'Lịch sử',

  GEOGRAPHY: 'Địa lý',

  CIVIC_EDU: 'GDKT&PL',

  TECHNOLOGY: 'Công nghệ',

  INFORMATICS: 'Tin học',

};



export default function ResultPage() {

  const scoreResult = useExamStore((s) => s.scoreResult);

  const hasMoreSlots = useExamStore((s) => s.hasMoreSlots);

  const logout = useExamStore((s) => s.logout);

  const continueToWaitingRoom = useExamStore((s) => s.continueToWaitingRoom);



  const subjectLabel = scoreResult?.subject

    ? SUBJECT_VI[scoreResult.subject] ?? scoreResult.subject

    : '';

  const pending = scoreResult?.pendingManual;

  const parts = scoreResult?.partScores;



  return (

    <CbtPageShell headerTitle="KẾT QUẢ NỘP BÀI" headerLeft={<CbtBrandLogo size={40} />}>

      <div className="result-page">

        <h2>Đã nộp bài thành công</h2>

        {subjectLabel && (

          <p>

            Môn: <strong>{subjectLabel}</strong>

          </p>

        )}

        {pending ? (

          <p className="admin-hint" style={{ fontSize: '1.1rem' }}>

            Bài thi Ngữ văn — <strong>Chấm sau</strong>

          </p>

        ) : (

          <>

            <p className="total-score">Tổng điểm: {scoreResult?.total?.toFixed(2) ?? '—'}</p>

            {parts && (

              <div className="part-scores" style={{ marginTop: '1rem' }}>

                <p>

                  Phần I: {parts.part1.toFixed(2)} / {parts.maxPart1.toFixed(2)}

                </p>

                <p>

                  Phần II: {parts.part2.toFixed(2)} / {parts.maxPart2.toFixed(2)}

                </p>

                <p>

                  Phần III: {parts.part3.toFixed(2)} / {parts.maxPart3.toFixed(2)}

                </p>

              </div>

            )}

          </>

        )}

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>

          {hasMoreSlots && (

            <button type="button" className="cbt-btn cbt-btn-primary" onClick={continueToWaitingRoom}>

              Quay phòng chờ — môn tiếp theo

            </button>

          )}

          <button type="button" className="cbt-btn cbt-btn-outline" onClick={logout}>

            Đăng xuất

          </button>

        </div>

      </div>

    </CbtPageShell>

  );

}

