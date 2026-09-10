import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

// The app previously had no error boundary at all -- an uncaught error thrown
// during render anywhere in the tree (a bad prop, a null reference after a state
// transition like logging out, etc.) would leave React unable to safely continue,
// with nothing on screen indicating why, and no button able to do anything about it
// short of a manual hard refresh. This catches that class of failure and offers an
// actual way back instead.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('Unhandled error in the app tree:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
          <p className="font-display text-2xl font-semibold text-ink">Something went wrong.</p>
          <p className="max-w-sm text-sm text-ink/60">
            This page hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            onClick={() => window.location.assign('/login')}
            className="rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-light"
          >
            Reload e-Sauda
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
