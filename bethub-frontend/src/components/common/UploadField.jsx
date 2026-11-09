import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { uploadImage } from "../../lib/api";
import { cn } from "../../lib/utils";

export default function UploadField({ label, value, onChange, folder = "misc", shape = "square", hint, maxMb = 50 }) {
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(-1);
  const [error, setError] = useState("");

  const pick = async (file) => {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file");
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setError(`Image must be under ${maxMb} MB`);
      return;
    }
    setProgress(0);
    try {
      const media = await uploadImage(file, folder, setProgress);
      onChange({ url: media.url, publicId: media.publicId });
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setProgress(-1);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "group relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden border border-dashed border-white/15 bg-white/[0.03] text-white/40 transition hover:border-lime/40 hover:text-lime",
            shape === "circle" ? "rounded-full" : "rounded-xl"
          )}
        >
          {value?.url ? (
            <img src={value.url} alt="Upload preview" className="h-full w-full object-cover" />
          ) : progress >= 0 ? (
            <Loader2 size={18} className="animate-spin text-lime" />
          ) : (
            <ImagePlus size={20} />
          )}
          {progress >= 0 && (
            <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[9px] font-bold text-lime">{progress}%</span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-soft btn-xs" onClick={() => inputRef.current?.click()} disabled={progress >= 0}>
              <UploadCloud size={13} /> {value?.url ? "Replace" : "Upload"}
            </button>
            {value?.url && (
              <button type="button" className="btn-danger btn-xs" onClick={() => onChange({ url: "", publicId: "" })}>
                <Trash2 size={13} /> Remove
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-white/35">{hint || `PNG, JPG or WebP · max ${maxMb} MB · stored on Cloudinary`}</p>
          {error && <p className="mt-1 text-[11px] text-coral">{error}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => pick(event.target.files?.[0])}
      />
    </div>
  );
}
