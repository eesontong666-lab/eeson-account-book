export default function AnalysisText({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <div className="flex flex-col gap-2 text-sm text-neutral-300 leading-relaxed">
      {lines.map((line, i) => {
        const isBullet = /^[-•*]\s/.test(line);
        const clean = line
          .replace(/^[-•*]\s*/, "")
          .replace(/^#+\s*/, "")
          .replace(/\*\*/g, "");
        const isHeading = !isBullet && (/^\d+[.、]/.test(line) || line.startsWith("#") || line.startsWith("【"));

        if (isBullet) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-indigo-400 mt-0.5">•</span>
              <span>{clean}</span>
            </div>
          );
        }
        if (isHeading) {
          return (
            <p key={i} className="text-neutral-100 font-medium mt-2 first:mt-0">
              {clean}
            </p>
          );
        }
        return <p key={i}>{clean}</p>;
      })}
    </div>
  );
}
