"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

type UseCloseOnOutsidePointerDownParams<TElement extends HTMLElement> = {
  containerRef: RefObject<TElement | null>;
  isOpen: boolean;
  onClose: () => void;
};

export function useCloseOnOutsidePointerDown<TElement extends HTMLElement>({
  containerRef,
  isOpen,
  onClose,
}: UseCloseOnOutsidePointerDownParams<TElement>) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        containerRef.current?.contains(event.target)
      ) {
        return;
      }

      onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [containerRef, isOpen, onClose]);
}
