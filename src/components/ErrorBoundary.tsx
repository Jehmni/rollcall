import { Component, type ErrorInfo, type ReactNode } from 'react'
import * as Sentry from '@sentry/react'

interface Props {
  children: ReactNode
  /** Optional label shown in the fallback (e.g. page name) for faster debugging */
  label?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.label ?? 'page', error, info.componentStack)
    Sentry.captureException(error, {
      extra: { label: this.props.label, componentStack: info.componentStack },
    })
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface-dark border border-border-dark rounded-none p-8 text-center space-y-5">
          {/* Icon */}
          <div className="mx-auto size-14 rounded-none bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-400 text-2xl">error</span>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-100 mb-1">Something went wrong</h2>
            {this.props.label && (
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">{this.props.label}</p>
            )}
            {this.state.error && (
              <p className="text-xs text-red-300/70 bg-red-500/5 border border-red-500/10 rounded-none px-4 py-3 font-mono break-all leading-relaxed">
                {this.state.error.message}
              </p>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={this.reset}
              className="px-5 py-2.5 text-sm font-bold rounded-none bg-primary hover:bg-primary/90 text-white transition-all active:scale-[0.97]"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.assign('/')}
              className="px-5 py-2.5 text-sm font-bold rounded-none border border-border-dark hover:border-primary/30 text-slate-400 hover:text-slate-100 transition-all active:scale-[0.97]"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    )
  }
}


