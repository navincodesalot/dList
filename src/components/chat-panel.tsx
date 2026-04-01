"use client";

import { useChat } from "@ai-sdk/react";
import { getToolName, isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import { useState, useRef, type FormEvent } from "react";
import { Streamdown } from "streamdown";

import "streamdown/styles.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function getMessageText(parts: UIMessage["parts"]): string {
  return parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join("");
}

function hasRenderableAssistantContent(message: UIMessage): boolean {
  if (message.role !== "assistant") return true;
  return message.parts.some((p) => isTextUIPart(p) || isToolUIPart(p));
}

function ToolRow({ part }: { part: UIMessage["parts"][number] }) {
  if (!isToolUIPart(part)) return null;
  const name = getToolName(part);
  let status: string;
  switch (part.state) {
    case "input-streaming":
    case "input-available":
      status = "Running…";
      break;
    case "output-available":
      status = "Done";
      break;
    case "output-error":
      status = part.errorText ?? "Error";
      break;
    default:
      status = "…";
  }
  return (
    <div className="border-border bg-muted/40 text-muted-foreground flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
      <span className="text-foreground font-medium">{name}</span>
      <span>{status}</span>
    </div>
  );
}

function AssistantMessageBody({
  message,
  isStreamingThisMessage,
}: {
  message: UIMessage;
  isStreamingThisMessage: boolean;
}) {
  return (
    <div className="space-y-2">
      {message.parts.map((part, i) => {
        if (
          isTextUIPart(part) &&
          (part.text !== "" || isStreamingThisMessage)
        ) {
          return (
            <div
              key={i}
              className="streamdown-chat text-foreground min-w-0 [&_a]:text-primary [&_a]:underline [&_code]:rounded-md [&_code]:bg-muted [&_code]:px-1 [&_pre]:overflow-x-auto [&_strong]:font-semibold"
            >
              <Streamdown
                mode={isStreamingThisMessage ? "streaming" : "static"}
                isAnimating={isStreamingThisMessage}
                parseIncompleteMarkdown={isStreamingThisMessage}
                lineNumbers={false}
                className="text-sm leading-relaxed"
              >
                {part.text}
              </Streamdown>
            </div>
          );
        }
        if (isToolUIPart(part)) {
          return <ToolRow key={i} part={part} />;
        }
        return null;
      })}
    </div>
  );
}

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage, status, error } = useChat();

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
          {messages.map((m, index) => {
            if (m.role === "user") {
              const text = getMessageText(m.parts);
              if (!text) return null;
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="bg-primary text-primary-foreground max-w-[85%] rounded-lg px-3 py-2 text-sm">
                    <div className="whitespace-pre-wrap">{text}</div>
                  </div>
                </div>
              );
            }

            if (!hasRenderableAssistantContent(m)) return null;

            const isStreamingThisMessage =
              isLoading &&
              index === messages.length - 1 &&
              m.role === "assistant";

            return (
              <div key={m.id} className="flex justify-start">
                <div className="bg-muted max-w-[85%] rounded-lg px-3 py-2 text-sm">
                  <AssistantMessageBody
                    message={m}
                    isStreamingThisMessage={isStreamingThisMessage}
                  />
                </div>
              </div>
            );
          })}
          {error && (
            <div className="text-destructive border-destructive/30 bg-destructive/5 rounded-lg border px-3 py-2 text-sm">
              {error.message}
            </div>
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                <span className="animate-pulse">Thinking…</span>
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
