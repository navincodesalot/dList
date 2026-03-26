"use client";

import { useRef, useCallback } from "react";
import { ScanControls } from "@/components/scan-controls";
import { DomainTable, type DomainTableHandle } from "@/components/domain-table";
import { ChatPanel } from "@/components/chat-panel";
import { SettingsModal } from "@/components/settings-modal";
import { Separator } from "@/components/ui/separator";

export default function HomePage() {
  const tableRef = useRef<DomainTableHandle>(null);

  const handleResultsUpdate = useCallback(() => {
    tableRef.current?.refresh();
  }, []);

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">dList</h1>
            <p className="text-muted-foreground text-sm">
              Short domain availability checker
            </p>
          </div>
          <SettingsModal />
        </div>
        <Separator className="mt-4" />
        <div className="mt-4">
          <ScanControls onResultsUpdate={handleResultsUpdate} />
        </div>
      </header>

      {/* Main content */}
      <div className="flex min-h-0 flex-1">
        {/* Table panel */}
        <div className="flex-1 overflow-auto p-6">
          <DomainTable ref={tableRef} />
        </div>

        {/* Chat panel */}
        <div className="hidden w-[380px] border-l lg:block">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
