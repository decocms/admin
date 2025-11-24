import {
  Component,
  createContext,
  type ErrorInfo,
  type ReactNode,
} from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  shouldCatch?: (error: Error) => boolean;
};

type State = {
  error: Error | null;
};

const Context = createContext<{ state: State; reset: () => void }>({
  state: { error: null },
  reset: () => {},
});

// Removed: useError was unused

const catchAll = (_error: Error) => true;

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  public shouldCatch = (error: Error) => {
    return this.props.shouldCatch?.(error) ?? catchAll(error);
  };

  public reset() {
    this.setState({ error: null });
  }

  // TODO: Add posthog error tracking in here
  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (this.shouldCatch(error)) {
      return;
    }

    console.error(error, errorInfo);
  }

  override render() {
    if (this.state.error && this.shouldCatch(this.state.error)) {
      return (
        <Context.Provider
          value={{
            state: this.state,
            reset: () => this.reset(),
          }}
        >
          {this.props.fallback ?? null}
        </Context.Provider>
      );
    }

    return this.props.children;
  }
}
