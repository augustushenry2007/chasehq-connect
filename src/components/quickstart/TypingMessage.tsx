import { useEffect, useState } from "react";

interface TypingMessageProps {
  text: string;
  /** Total max duration in ms — speed adapts to text length */
  maxDuration?: number;
  onDone?: () => void;
  className?: string;
}

export default function TypingMessage({ text, maxDuration = 1500, onDone, className }: TypingMessageProps) {
  const [shown, setShown] = useState("");

  useEffect(() => {
    if (!text) {
      setShown("");
      return;
    }
    setShown("");
    const perChar = Math.max(8, Math.min(30, maxDuration / Math.max(text.length, 1)));
    let i = 0;
    const id = window.setInterval(() => {
      i += Math.max(1, Math.ceil(text.length / (maxDuration / perChar)));
      if (i >= text.length) {
        setShown(text);
        window.clearInterval(id);
        onDone?.();
      } else {
        setShown(text.slice(0, i));
      }
    }, perChar);
    return () => window.clearInterval(id);
  }, [text, maxDuration, onDone]);

  return (
    <p className={className} style={{ whiteSpace: "pre-wrap" }}>
      {shown}
      {shown.length < text.length && <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary/70 animate-pulse align-middle" />}
    </p>
  );
}
