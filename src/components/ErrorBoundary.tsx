import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

// Last line of defense against a blank screen: if a component throws during
// render, show a message instead of an empty page. This cannot catch errors
// thrown at module-import time (e.g. src/firebase.ts running before React
// mounts) - those are guarded separately where they happen.
class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled error in app tree:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>Something went wrong.</h1>
          <p>Please refresh the page. If this keeps happening, let us know.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
