import React, { Component } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import SessionTimeoutWatcher from "@/components/workspace/SessionTimeoutWatcher";
import SessionExpiryBanner from "@/components/workspace/SessionExpiryBanner";

class PageErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("Page crash:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-red-400 font-semibold">Error al cargar la página</p>
          <p className="text-zinc-500 text-sm text-center max-w-md">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors">
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <SessionTimeoutWatcher />
      <SessionExpiryBanner />
      <Sidebar />
      <main className="lg:ml-64 min-h-screen">
        <div className="p-4 pt-16 lg:p-8 lg:pt-8 max-w-7xl mx-auto">
          <PageErrorBoundary>
            <Outlet />
          </PageErrorBoundary>
        </div>
      </main>
    </div>
  );
}