"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function getMessageText(
  parts: { type: string; text?: string }[],
): string {
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text)
    .join("");
}

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage, status } = useChat();

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue("");
    void sendMessage({ text });
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50"
        onClick={() => setIsOpen(true)}
      >
        Open Chat
      </Button>
    );
  }

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center justify-between p-3">
        <h3 className="text-sm font-semibold">AI Assistant</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
          className="h-6 w-6 p-0"
        >
          ×
        </Button>
      </div>
      <Separator />
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-muted-foreground space-y-2 py-8 text-center text-sm">
              <p>Ask me about your domain scan results.</p>
              <div className="space-y-1 text-xs">
                <p>&quot;How many domains are available?&quot;</p>
                <p>&quot;Show me 2-letter .ai domains&quot;</p>
                <p>&quot;Which premium domains have the lowest price?&quot;</p>
              </div>
            </div>
          )}
          {messages.map((m) => {
            const text = getMessageText(
              m.parts as { type: string; text?: string }[],
            );
            if (!text) return null;
            return (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{text}</div>
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                <span className="animate-pulse">Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <Separator />
      <form onSubmit={handleSubmit} className="flex gap-2 p-3">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask about domains..."
          className="flex-1"
          disabled={isLoading}
        />
        <Button
          type="submit"
          size="sm"
          disabled={isLoading || !inputValue.trim()}
        >
          Send
        </Button>
      </form>
    </Card>
  );
}
