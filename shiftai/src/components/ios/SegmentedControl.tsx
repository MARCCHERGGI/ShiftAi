"use client";

interface SegmentedControlProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export default function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  const count = Math.max(options.length, 1);
  const activeIndex = Math.max(options.indexOf(value), 0);

  return (
    <div className="seg" role="radiogroup" aria-label="Options">
      <div
        className="seg__thumb"
        style={{
          width: `calc((100% - 4px) / ${count})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
        aria-hidden="true"
      />
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            className={active ? "seg__option seg__option--active" : "seg__option"}
            onClick={() => {
              if (!active) onChange(option);
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export { SegmentedControl };
