import { Component, type ErrorInfo, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Keep this boundary UI-only. Production logging can be added by the host app.
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <main className="release-error-screen">
        <section className="release-error-card">
          <span><TriangleAlert size={24} /></span>
          <h1>AIOS could not render this screen.</h1>
          <p>{this.state.error.message || 'An unexpected UI error occurred.'}</p>
          <div>
            <button type="button" onClick={() => this.setState({ error: null })}>Try again</button>
            <button type="button" onClick={() => window.location.reload()}>Reload app</button>
          </div>
        </section>
      </main>
    );
  }
}
