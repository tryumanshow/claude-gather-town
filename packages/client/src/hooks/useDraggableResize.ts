import React, { useState, useRef, useCallback } from 'react';

interface Options {
  direction: 'horizontal' | 'vertical';
  min: number;
  max: number;
  initial: number;
  /** If true, dragging opposite direction (up/left) increases size. Default: false */
  invert?: boolean;
}

export function useDraggableResize({ direction, min, max, initial, invert = false }: Options) {
  const [size, setSize] = useState(initial);
  const isDraggingRef = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    const startCoord = direction === 'horizontal' ? e.clientX : e.clientY;
    const startSize = size;
    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = (direction === 'horizontal' ? ev.clientX : ev.clientY) - startCoord;
      const effectiveDelta = invert ? -delta : delta;
      setSize(Math.max(min, Math.min(max, startSize + effectiveDelta)));
    };
    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [direction, min, max, size, invert]);

  return { size, setSize, onMouseDown, isDraggingRef };
}
