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
          : "cursor-pointer hover:border-[#14b8a6] hover:bg-[#14b8a6]/5",
        dragOver
          ? "border-[#14b8a6] bg-[#14b8a6]/5"
          : "border-[#bbcac6]/30 bg-white",
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
          <span className="material-symbols-outlined text-4xl text-[#006b5f]">
            sync
          </span>
          <p
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            className="text-sm font-semibold text-[#006b5f]"
          >
            Importing…{" "}
            {progress
              ? `${progress.inserted} / ${progress.total} rows`
              : ""}
          </p>
          <div className="w-full max-w-xs overflow-hidden rounded-full bg-[#bbcac6]/30 h-2">
            <div
              className="h-full rounded-full bg-[#006b5f] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </>
      ) : (
        <>
          <span className="material-symbols-outlined text-4xl text-[#6c7a77]">
            upload_file
          </span>
          <div className="text-center">
            <p
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              className="text-sm font-semibold text-[#1a2e2b]"
            >
              Drop Aspire CSV here
            </p>
            <p
              style={{ fontFamily: "'Manrope', sans-serif" }}
              className="text-xs text-[#6c7a77] mt-0.5"
            >
              or click to browse
            </p>
          </div>
        </>
      )}
    </div>
  );
}
