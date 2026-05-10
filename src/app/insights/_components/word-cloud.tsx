export function WordCloud({ words }: { words: { word: string; count: number }[] }) {
  if (words.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Write some gratitude entries to see themes here.
      </p>
    );
  }
  const max = words[0]?.count ?? 1;
  const min = Math.min(...words.map((w) => w.count));
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
      {words.map((w) => {
        // map count → font-size 12..28 px
        const t = max === min ? 1 : (w.count - min) / (max - min);
        const size = 12 + t * 16;
        const opacity = 0.5 + t * 0.5;
        return (
          <span
            key={w.word}
            className="font-serif lowercase leading-none"
            style={{ fontSize: `${size}px`, opacity }}
          >
            {w.word}
            <span className="ml-0.5 align-super text-[9px] font-mono tabular-nums text-muted-foreground/70">
              {w.count}
            </span>
          </span>
        );
      })}
    </div>
  );
}
