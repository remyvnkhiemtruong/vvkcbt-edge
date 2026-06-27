import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ExamErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Exam render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="exam-empty-state">
          <p>Không hiển thị được đề thi.</p>
          <p className="exam-empty-state__detail">{this.state.error.message}</p>
          <button
            type="button"
            className="cbt-btn cbt-btn-primary"
            onClick={() => this.setState({ error: null })}
          >
            Thử lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
