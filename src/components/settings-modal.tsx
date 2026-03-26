"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ConfigStatus {
  hasEnvKeys: boolean;
  hasBlobKeys: boolean;
  configured: boolean;
}

export function SettingsModal() {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      void fetchStatus();
    }
  }, [open]);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/config");
      const data = (await res.json()) as ConfigStatus;
      setStatus(data);
    } catch {
      // ignore
    }
  }

  async function handleSave() {
    if (!apiKey || !apiSecret) {
      setMessage("Both fields are required");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, apiSecret }),
      });

      if (res.ok) {
        setMessage("Saved successfully");
        setApiKey("");
        setApiSecret("");
        await fetchStatus();
      } else {
        setMessage("Failed to save");
      }
    } catch {
      setMessage("Network error");
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" />}
      >
        Settings
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>API Configuration</DialogTitle>
          <DialogDescription>
            Configure your Spaceship API credentials. Environment variables take
            priority over values saved here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {status && (
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${status.configured ? "bg-green-500" : "bg-red-500"}`}
                />
                <span>
                  {status.hasEnvKeys
                    ? "Using environment variables"
                    : status.hasBlobKeys
                      ? "Using saved API keys"
                      : "Not configured"}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">API Key</label>
            <Input
              type="password"
              placeholder="Enter Spaceship API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">API Secret</label>
            <Input
              type="password"
              placeholder="Enter Spaceship API secret"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
            />
          </div>

          {message && (
            <p
              className={`text-sm ${message.includes("success") ? "text-green-600" : "text-red-500"}`}
            >
              {message}
            </p>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save API Keys"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
