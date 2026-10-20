import type { ReactNode } from 'react';

/** Hand-made plant illustration for the lucky garden, one look per growth stage (0–6). */

function Leaf({ x, y, angle, size, fill = '#22c55e' }: { x: number; y: number; angle: number; size: number; fill?: string }) {
  const s = size;
  return (
    <path
      d={`M0,0 C${s * 0.45},${-s * 0.55} ${s * 1.15},${-s * 0.5} ${s * 1.4},0 C${s * 1.15},${s * 0.5} ${s * 0.45},${s * 0.55} 0,0 Z`}
      transform={`translate(${x} ${y}) rotate(${angle})`}
      fill={fill}
    />
  );
}

function Flower({ x, y, color = '#f472b6' }: { x: number; y: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="0" cy="-5" rx="3.6" ry="5.4" fill={color} transform={`rotate(${a})`} />
      ))}
      <circle r="3.2" fill="#fde047" />
    </g>
  );
}

function Coin({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <line x1="0" y1="-9" x2="0" y2="-4" stroke="#15803d" strokeWidth="1.5" />
      <circle r="6.5" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
      <circle r="3" fill="none" stroke="#ca8a04" strokeWidth="1.2" />
    </g>
  );
}

function Stem({ top, bend = 0 }: { top: number; bend?: number }) {
  return <path d={`M120,160 C${120 + bend},${(160 + top) / 2} ${120 - bend},${(160 + top) / 2 + 10} 120,${top}`} stroke="#16a34a" strokeWidth="4.5" fill="none" strokeLinecap="round" />;
}

function Plant({ stage }: { stage: number }) {
  switch (stage) {
    case 0:
      return (
        <g>
          <ellipse cx="120" cy="155" rx="10" ry="6.5" fill="#a16207" />
          <ellipse cx="116.5" cy="152.5" rx="3.4" ry="1.8" fill="#fde68a" opacity="0.75" />
          <path d="M120,149 q2,-6 7,-7" stroke="#16a34a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      );
    case 1:
      return (
        <g>
          <Stem top={140} />
          <Leaf x={120} y={142} angle={-35} size={13} />
          <Leaf x={120} y={142} angle={-145} size={13} />
        </g>
      );
    case 2:
      return (
        <g>
          <Stem top={118} bend={4} />
          <Leaf x={120} y={140} angle={-25} size={16} />
          <Leaf x={120} y={132} angle={-155} size={16} />
          <Leaf x={120} y={120} angle={-60} size={14} />
          <Leaf x={120} y={120} angle={-120} size={14} />
        </g>
      );
    case 3:
      return (
        <g>
          <Stem top={96} bend={6} />
          {[146, 132, 118, 104].map((y, i) => (
            <g key={y}>
              <Leaf x={120} y={y} angle={i % 2 ? -150 : -30} size={20 - i} />
              <Leaf x={120} y={y - 4} angle={i % 2 ? -30 : -150} size={18 - i} fill="#16a34a" />
            </g>
          ))}
          <Leaf x={120} y={97} angle={-90} size={14} />
        </g>
      );
    case 4:
    case 5:
      return (
        <g>
          <Stem top={104} />
          <circle cx="98" cy="102" r="24" fill="#16a34a" />
          <circle cx="142" cy="102" r="24" fill="#16a34a" />
          <circle cx="120" cy="84" r="28" fill="#22c55e" />
          <circle cx="104" cy="82" r="14" fill="#4ade80" opacity="0.55" />
          {stage === 5 && (
            <>
              <Flower x={96} y={92} />
              <Flower x={130} y={72} color="#fb7185" />
              <Flower x={146} y={104} />
              <Flower x={112} y={110} color="#c084fc" />
              <Flower x={120} y={64} color="#f472b6" />
            </>
          )}
        </g>
      );
    default:
      return (
        <g>
          <path d="M113,162 C114,140 112,118 108,100 L132,100 C128,118 126,140 127,162 Z" fill="#92400e" />
          <path d="M120,112 C108,104 100,96 92,90" stroke="#92400e" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M122,108 C134,100 142,92 150,86" stroke="#92400e" strokeWidth="6" fill="none" strokeLinecap="round" />
          <circle cx="86" cy="78" r="30" fill="#15803d" />
          <circle cx="154" cy="78" r="30" fill="#15803d" />
          <circle cx="120" cy="58" r="38" fill="#16a34a" />
          <circle cx="104" cy="50" r="18" fill="#4ade80" opacity="0.45" />
          <Coin x={84} y={96} />
          <Coin x={150} y={98} />
          <Coin x={120} y={84} />
          <Coin x={102} y={64} />
          <Coin x={140} y={58} />
          <path d="M176,40 l3,7 7,3 -7,3 -3,7 -3,-7 -7,-3 7,-3 Z" fill="#fde047" />
          <path d="M62,48 l2,5 5,2 -5,2 -2,5 -2,-5 -5,-2 5,-2 Z" fill="#fde047" />
        </g>
      );
  }
}

export function GardenScene({ stage, watering, overlay }: { stage: number; watering: boolean; overlay?: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-sky-100 to-emerald-50 dark:from-sky-950 dark:to-emerald-950">
      <svg viewBox="0 0 240 220" className="block w-full" role="img" aria-hidden>
        <circle cx="200" cy="38" r="20" fill="#fbbf24" opacity="0.9" />
        <circle cx="200" cy="38" r="30" fill="#fbbf24" opacity="0.18" />
        <ellipse cx="120" cy="214" rx="140" ry="22" fill="#86efac" className="dark:fill-emerald-900" />
        <rect x="80" y="157" width="80" height="13" rx="4" fill="#ea580c" />
        <path d="M86,168 L154,168 L146,206 Q145,210 140,210 L100,210 Q95,210 94,206 Z" fill="#c2410c" />
        <ellipse cx="120" cy="160" rx="35" ry="4.5" fill="#78350f" />
        <g className="origin-[120px_160px] animate-sway">
          <Plant stage={stage} />
        </g>
        {watering && (
          <g fill="#38bdf8">
            {[104, 120, 136].map((x, i) => (
              <path key={x} d={`M${x},70 q-5,8 0,12 q5,-4 0,-12 Z`} className="animate-drop" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </g>
        )}
      </svg>
      {overlay}
    </div>
  );
}
