import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logCrash, exportCrashLogsAsJson } from '../services/crashLogService';
import { AlertTriangle, RotateCcw, Download, Terminal, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Automatically log crash to local audit log and Google Drive Lakshay_Library_Logs folder
    logCrash(error, {
      type: 'REACT_CRASH',
      severity: 'CRITICAL',
      componentStack: errorInfo.componentStack || undefined,
      extraMessage: 'React Component Tree Exception Caught by ErrorBoundary',
    });
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleHardReset = () => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'This will clear local temporary caches while preserving your Firestore/Drive settings. Reload now?'
      );
      if (confirmed) {
        sessionStorage.clear();
        window.location.reload();
      }
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 animate-in fade-in">
            {/* Header */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  Application Encountered an Error
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lakshay Library safely intercepted this crash and saved the log
                </p>
              </div>
            </div>

            {/* Error Message Card */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                Crash Intercepted
              </span>
              <p className="text-xs font-mono text-rose-200 break-words">
                {this.state.error?.message || 'An unknown render error occurred.'}
              </p>
              <p className="text-[11px] text-slate-500">
                This crash was automatically recorded into your local audit log and will sync to
                Google Drive in the <code className="text-amber-400 font-mono">Lakshay_Library_Logs</code> folder.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>

              <button
                type="button"
                onClick={() => exportCrashLogsAsJson()}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>Download Crash Log (.json)</span>
              </button>
            </div>

            {/* Technical Stack Trace Accordion */}
            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <span className="flex items-center gap-1.5 font-mono text-[11px]">
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  <span>Technical Diagnostics &amp; Stack Trace</span>
                </span>
                {this.state.showDetails ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {this.state.showDetails && (
                <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 max-h-48 overflow-y-auto text-[11px] font-mono text-slate-400 space-y-2">
                  <div>
                    <span className="text-amber-300 font-bold block mb-1">Stack:</span>
                    <pre className="whitespace-pre-wrap break-all text-[10px] text-slate-300">
                      {this.state.error?.stack || 'No stack trace available'}
                    </pre>
                  </div>
                  {this.state.errorInfo?.componentStack && (
                    <div className="pt-2 border-t border-slate-900">
                      <span className="text-amber-300 font-bold block mb-1">Component Stack:</span>
                      <pre className="whitespace-pre-wrap break-all text-[10px] text-slate-400">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick cache recovery */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>Still crashing after reload?</span>
              <button
                type="button"
                onClick={this.handleHardReset}
                className="text-amber-400 hover:underline"
              >
                Reset Session Storage
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
