"use client";

import { Component, type ReactNode } from "react";
import { DataError } from "@/components/loading/DataError";

export interface DataErrorBoundaryProps {
  children: ReactNode;
  resetKey: unknown;
  onRetry?: () => void;
}

class Boundary extends Component<DataErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: DataErrorBoundaryProps) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey)
      this.setState({ failed: false });
  }

  retry = () => {
    this.setState({ failed: false });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.failed)
      return <DataError onRetry={this.props.onRetry ? this.retry : undefined} />;
    return this.props.children;
  }
}

export function DataErrorBoundary(props: DataErrorBoundaryProps) {
  return <Boundary {...props} />;
}
