"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">出错了</h1>
      <p className="text-muted-foreground text-sm">
        {error.message || "页面加载失败"}
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90"
      >
        重试
      </button>
    </div>
  );
}
