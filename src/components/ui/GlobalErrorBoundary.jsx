import { Component } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Captured by GlobalErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#fdfbf9] text-[#1c130d] font-sans">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#eeddd0] shadow-xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto border border-amber-500/20">
              <AlertTriangle size={28} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#1c130d]">Something went wrong</h2>
              <p className="text-xs text-[#8d7565] mt-1 leading-relaxed">
                Connectra encountered an unexpected render issue. We've caught it safely so your session remains intact.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-left font-mono text-[11px] text-red-700 overflow-x-auto max-h-28">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer hover:brightness-105"
            >
              <RefreshCcw size={14} /> Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
