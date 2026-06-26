import type { ReactNode } from 'react';

import { APP_AUTHOR, SCHOOL_NAME, vi, isProductionUi } from '../i18n/vi';



interface CbtPageShellProps {

  featureTitle?: string;

  headerTitle: string;

  headerLeft?: ReactNode;

  headerRight?: ReactNode;

  children: ReactNode;

  pageNumber?: number;

  totalPages?: number;

  darkBody?: boolean;

  variant?: 'production' | 'spec';

}



export function CbtPageShell({

  featureTitle,

  headerTitle,

  headerLeft,

  headerRight,

  children,

  pageNumber,

  totalPages = 24,

  darkBody = false,

  variant,

}: CbtPageShellProps) {

  const production = variant ? variant === 'production' : isProductionUi();

  const showSpec = !production && featureTitle;



  return (

    <div className="cbt-shell">

      {showSpec && (

        <div className="cbt-feature-header">

          <h1 className="cbt-feature-title">{featureTitle}</h1>

          <p className="cbt-feature-subtitle">{vi.subtitle}</p>

        </div>

      )}

      <div className={`cbt-app-window ${darkBody ? 'cbt-app-window--dark' : ''}`}>

        <header className="cbt-app-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {headerLeft}
            <span className="cbt-app-header__title">{headerTitle}</span>
          </div>
          {headerRight && <span className="cbt-app-header__right">{headerRight}</span>}
        </header>

        <div className="cbt-app-body">{children}</div>

        <footer className="cbt-app-footer">

          <span>
            © {APP_AUTHOR} · {production ? vi.footerPublic : `${SCHOOL_NAME} — ${vi.footerDoc}`}
          </span>

          {!production && pageNumber != null && (

            <span>

              Trang {pageNumber}/{totalPages}

            </span>

          )}

        </footer>

      </div>

      <style>{`

        .cbt-shell { min-height: 100vh; padding: 1.5rem; background: var(--cbt-bg); }

        .cbt-feature-header { text-align: center; margin-bottom: 1rem; }

        .cbt-feature-title { color: var(--cbt-primary); font-size: 1.35rem; margin: 0; text-transform: uppercase; }

        .cbt-feature-subtitle { color: var(--cbt-text-muted); margin: 0.25rem 0 0; font-size: 0.9rem; }

        .cbt-app-window { max-width: 1100px; margin: 0 auto; background: var(--cbt-surface); border-radius: var(--cbt-radius); box-shadow: var(--cbt-shadow); overflow: hidden; border: 1px solid var(--cbt-border); }

        .cbt-app-window--dark .cbt-app-body { background: var(--cbt-navy); }

        .cbt-app-header { display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1.25rem; background: var(--cbt-navy); color: #fff; }

        .cbt-app-header__title { font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }

        .cbt-app-header__right { font-size: 0.85rem; color: #94a3b8; }

        .cbt-app-body { padding: 1.25rem; }

        .cbt-app-footer { display: flex; justify-content: space-between; padding: 0.65rem 1.25rem; font-size: 0.75rem; color: var(--cbt-text-muted); border-top: 1px solid var(--cbt-border); background: #fafafa; }

      `}</style>

    </div>

  );

}

