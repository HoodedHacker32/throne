/** The Throne d20 with a 0 on the face. Red lines, bone-coloured 0 with an ink halo. */
export function DieMark({ size = 40, ink = '#14100e', zero = '#efe6d2' }: { size?: number; ink?: string; zero?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="Throne">
      <g fill="none" stroke="#ba0000" strokeWidth="11" strokeLinejoin="round" strokeLinecap="round">
        <path d="M100 10L178 55V145L100 190L22 145V55Z" />
        <path d="M100 46L150 132H50Z" />
        <path d="M100 10V46M22 55L100 46L178 55M22 145L50 132M178 145L150 132M50 132L100 190L150 132M22 55L50 132M178 55L150 132" />
      </g>
      <text
        transform="translate(100 0) scale(1.5 1) translate(-100 0)"
        x="100" y="132" textAnchor="middle" fontFamily="Pirata One, serif" fontSize="104"
        fill={zero} stroke={ink} strokeWidth="10" paintOrder="stroke" strokeLinejoin="round"
      >0</text>
    </svg>
  )
}
