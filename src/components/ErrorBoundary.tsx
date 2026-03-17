import { Component, type ErrorInfo, type ReactNode } from 'react'

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
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#12122a] border border-white/10 rounded-2xl p-8 text-center space-y-5">
          {/* Icon */}
          <div className="mx-auto w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Something went wrong</h2>
            {this.props.label && (
              <p className="text-xs text-white/40 mb-2 font-mono">{this.props.label}</p>
            )}
            {this.state.error && (
              <p className="text-sm text-red-300/80 bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-2 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={this.reset}
              className="px-5 py-2.5 text-sm font-medium rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.assign('/')}
              className="px-5 py-2.5 text-sm font-medium rounded-xl border border-white/10 hover:border-white/20 text-white/70 hover:text-white transition-colors"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    )
  }
}
