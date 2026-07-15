"use client";

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

type Props = { value: string; onChange: (next: string) => void };

export default function NumPad({ value, onChange }: Props) {
  function pulsar(d: string) {
    if (d === "⌫") { onChange(value.slice(0, -1)); return; }
    if (d === "." && value.includes(".")) return;
    if ((value.split(".")[1]?.length ?? 0) >= 2) return;
    onChange(value + d);
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {TECLAS.map((d, i) => (
        <button
          key={i}
          onClick={() => pulsar(d)}
          className="py-4 bg-gray-100 active:bg-gray-600 rounded-xl font-semibold text-xl touch-manipulation"
        >
          {d}
        </button>
      ))}
    </div>
  );
}
