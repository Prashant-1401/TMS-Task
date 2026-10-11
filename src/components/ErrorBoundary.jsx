/* eslint-disable react-refresh/only-export-components */
import React from "react";

/* ===================== ERROR BOUNDARY ===================== */
export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) {
    console.error("[TMS ErrorBoundary] CRASH:", error?.message, "\nStack:", error?.stack, "\nComponent Stack:", errorInfo?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#F5F5FB", padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, color: "#272262", marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#636E72", fontSize: 13, maxWidth: 400, marginBottom: 20, lineHeight: 1.5 }}>{this.state.error?.message || "An unexpected error occurred."}</p>
          <button className="btn btn-navy" onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>Reload Application</button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ===================== ROOT APP ===================== */
