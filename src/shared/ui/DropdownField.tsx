"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import type { FocusEvent } from "react";

import styles from "@/shared/ui/DropdownField.module.css";
import { useCloseOnOutsidePointerDown } from "@/shared/ui/useCloseOnOutsidePointerDown";

export type DropdownOption<TValue extends string> = {
  label: string;
  value: TValue;
};

type DropdownFieldProps<TValue extends string> = {
  className?: string;
  disabled?: boolean;
  options: Array<DropdownOption<TValue>>;
  value: TValue;
  onChange: (value: TValue) => void;
};

const joinClassNames = (...classNames: Array<string | undefined>): string =>
  classNames.filter(Boolean).join(" ");

export function DropdownField<TValue extends string>({
  className,
  disabled = false,
  options,
  onChange,
  value,
}: DropdownFieldProps<TValue>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const closeDropdown = useCallback(() => setIsOpen(false), []);

  useCloseOnOutsidePointerDown({
    containerRef: dropdownRef,
    isOpen,
    onClose: closeDropdown,
  });

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={dropdownRef}
      className={joinClassNames(styles.dropdown, className)}
      onBlur={handleBlur}
    >
      <button
        type="button"
        className={styles.trigger}
        data-open={isOpen}
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
      >
        <span className={styles.value}>{selectedOption?.label ?? "Selecionar"}</span>
        <ChevronDown size={16} />
      </button>
      {isOpen ? (
        <div className={styles.menu} id={listboxId} role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={styles.option}
              data-selected={option.value === value}
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
