import { useRef, useState } from "react";

export default function CsvUploader({ onFileSelected, importing, progress }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!importing) setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (importing) return;
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      onFileSelected(file);
    }
  };

  const handleClick = () => {
    if (!importing) inputRef.current?.click();
  };

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onFileSelected(file);
      e.target.value = "";
    }
  };

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.inserted / progress.total) * 100)
      : 0;

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={[
        "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-8 py-12 transition-all duration-200 select-none",
        importing
          ? "cursor-default opacity-80"
          : "cursor-pointer hover:border-accent hover:bg-accent/5",
        dragOver
          ? "border-accent bg-accent/5"
          : "border-border bg-surface",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleChange}
      />

      {importing ? (
        <>
          <span className="material-symbols-outlined text-4xl text-accent">
            sync
          </span>
          <p
            style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
            className="text-sm font-semibold text-accent"
          >
            Importing…{" "}
            {progress
              ? `${progress.inserted} / ${progress.total} rows`
              : ""}
          </p>
          <div className="w-full max-w-xs overflow-hidden rounded-full bg-surface-container h-2">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </>
      ) : (
        <>
          <span className="material-symbols-outlined text-4xl text-foreground-variant">
            upload_file
          </span>
          <div className="text-center">
            <p
              style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
              className="text-sm font-semibold text-accent"
            >
              Drop Aspire CSV here
            </p>
            <p
              style={{ fontFamily: "'Inter', sans-serif" }}
              className="text-xs text-foreground-variant mt-0.5"
            >
              or click to browse
            </p>
          </div>
        </>
      )}
    </div>
  );
}
