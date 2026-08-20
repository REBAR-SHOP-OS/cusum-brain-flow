import React, { Component, ErrorInfo } from "react";

interface Props {
  children: React.ReactNode;
  /** Optional fallback UI; defaults to rendering nothing */
  fallback?: React.ReactNode;
  /** Label for console logging */
  section?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Lightweight error boundary for landing page sections.
 * On error: logs to console and renders fallback (or nothing).
 * Prevents a single broken section from taking down the whole page.
 */
export class LandingSectionBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[LandingSectionBoundary] Section "${this.props.section || "unknown"}" crashed:`,
      error.message,
      info.componentStack
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
