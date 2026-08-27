"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

/**
 * A select whose trigger shows the option's label, not its stored value.
 *
 * Base UI's `SelectValue` renders the value it was given, so a plain
 * `<SelectValue />` puts `advanced_operations` on the trigger while the list
 * that set it said "Advanced Operations". Passing the options once means the
 * trigger and the list are read from the same array and cannot drift.
 *
 * Everything that is a fixed list of choices should use this. A select over
 * live records — pilots, aircraft, projects — is built from data rather than a
 * constant, so those keep their own `SelectValue` function child.
 */
export function OptionSelect<T extends string>({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  className,
  id,
  name,
  disabled,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
}) {
  const labelFor = (candidate: string): string =>
    options.find((option) => option.value === candidate)?.label ?? placeholder;

  return (
    <Select
      value={value}
      // Base UI hands back null when a selection is cleared; the caller's
      // current value is the sensible thing to keep in that case.
      onValueChange={(next) => onValueChange((next as T | null) ?? value)}
      disabled={disabled}
      name={name}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue>{(selected) => labelFor(String(selected ?? ""))}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
