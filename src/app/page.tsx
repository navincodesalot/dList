"use client";

import { ScanControls } from "@/components/scan-controls";
import { DomainTable } from "@/components/domain-table";
import { ChatPanel } from "@/components/chat-panel";
import { SettingsModal } from "@/components/settings-modal";
import { ModeToggle } from "@/components/mode-toggle";
import { Separator } from "@/components/ui/separator";
export default function HomePage() {
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
          <div className="flex items-center gap-2">
            <ModeToggle />
            <SettingsModal />
          </div>
        </div>
        <Separator className="mt-4" />
        <div className="mt-4">
          <ScanControls />
        </div>
      </header>

      {/* Main content */}
      <div className="flex min-h-0 flex-1">
        {/* Table panel */}
        <div className="flex-1 overflow-auto p-6">
          <DomainTable />
        </div>

        {/* Chat panel */}
        <div className="hidden w-[380px] border-l lg:block">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
