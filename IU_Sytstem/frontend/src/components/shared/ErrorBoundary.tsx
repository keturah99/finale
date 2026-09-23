import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
          <h1 className="text-lg font-semibold text-slate-800">
            Something went wrong
          </h1>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            {this.state.error.message}
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              this.setState({ error: null })
              window.location.reload()
            }}
          >
            Reload
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}