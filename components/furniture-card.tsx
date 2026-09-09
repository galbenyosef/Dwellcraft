'use client';
import { useEffect, useRef, type ReactNode } from 'react';

// Pointer capture keeps the library gesture alive across the canvas and panels.
// Touch uses tap-to-add so vertical swipes can still scroll the furniture list.
export function FurnitureCard({
  disabled,
  label,
  children,
  onAdd,
  onStart,
  onMove,
  onDrop,
  onFinish,
}: {
  disabled: boolean;
  label: string;
  children: ReactNode;
  onAdd: () => void;
  onStart: () => boolean;
  onMove: (x: number, y: number) => void;
  onDrop: (x: number, y: number) => void;
  onFinish: () => void;
}) {
  const cleanup = useRef<(() => void) | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => () => cleanup.current?.(), []);
  return (
    <button
      className="asset-card"
      disabled={disabled}
      aria-label={label}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onClick={(e) => {
        if (e.detail === 0 || !suppressClick.current) onAdd();
        suppressClick.current = false;
      }}
      onPointerDown={(e) => {
        if (e.button !== 0 || !e.isPrimary || disabled) return;
        cleanup.current?.();
        suppressClick.current = false;
        if (e.pointerType === 'touch') return;
        const button = e.currentTarget;
        const id = e.pointerId,
          startX = e.clientX,
          startY = e.clientY;
        let dragging = false,
          finished = false;
        button.setPointerCapture(id);
        const finish = () => {
          if (finished) return;
          finished = true;
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', cancel);
          window.removeEventListener('blur', finish);
          window.removeEventListener('keydown', key);
          button.removeEventListener('lostpointercapture', finish);
          if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
          cleanup.current = null;
          if (dragging) onFinish();
        };
        const move = (event: PointerEvent) => {
          if (event.pointerId !== id) return;
          if (!dragging) {
            if (Math.hypot(event.clientX - startX, event.clientY - startY) < 6)
              return;
            suppressClick.current = true;
            if (!onStart()) {
              finish();
              return;
            }
            dragging = true;
          }
          event.preventDefault();
          onMove(event.clientX, event.clientY);
        };
        const up = (event: PointerEvent) => {
          if (event.pointerId !== id) return;
          if (dragging) onDrop(event.clientX, event.clientY);
          finish();
        };
        const cancel = (event: PointerEvent) => {
          if (event.pointerId === id) finish();
        };
        const key = (event: KeyboardEvent) => {
          if (event.key === 'Escape') finish();
        };
        window.addEventListener('pointermove', move, { passive: false });
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', cancel);
        window.addEventListener('blur', finish);
        window.addEventListener('keydown', key);
        button.addEventListener('lostpointercapture', finish);
        cleanup.current = finish;
      }}
    >
      {children}
    </button>
  );
}
