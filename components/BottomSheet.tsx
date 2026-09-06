"use client";

type Props = {
  maxWidth?: "sm" | "md";
  maxHeight?: string;
  children: React.ReactNode;
};

export default function BottomSheet({ maxWidth = "sm", maxHeight, children }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className={`bg-white rounded-t-3xl sm:rounded-3xl w-full flex flex-col animate-sheet-in ${
          maxWidth === "md" ? "sm:max-w-md" : "sm:max-w-sm"
        }`}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 shrink-0 sm:hidden" />
        {children}
      </div>
    </div>
  );
}
