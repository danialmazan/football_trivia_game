import { useI18n } from '../i18n'

export function GoatCrest() {
  const { t } = useI18n()
  return (
    <svg
      className="goat-crest"
      viewBox="0 0 160 190"
      role="img"
      aria-label={t('Leo Guessi goat crest')}
    >
      <g className="goat-crest__outline">
        <path d="M57 43C44 39 31 28 27 12c17 1 31 11 38 27" />
        <path d="M103 43c13-4 26-15 30-31-17 1-31 11-38 27" />
        <path d="M56 45c-13-7-28-6-38 1 9 10 20 14 34 12" />
        <path d="M104 45c13-7 28-6 38 1-9 10-20 14-34 12" />
        <path d="M53 38c7-8 17-12 27-12s20 4 27 12l5 35c2 17-6 34-20 43l-12 8-12-8c-14-9-22-26-20-43l5-35Z" />
        <path d="M49 71c7-6 16-7 23-2" />
        <path d="M111 71c-7-6-16-7-23-2" />
        <path d="M66 91c5-4 9-5 14-5s9 1 14 5l-3 12-11 5-11-5-3-12Z" />
        <path d="M80 108v10" />
      </g>
      <g className="goat-crest__detail">
        <circle cx="63" cy="73" r="2.5" />
        <circle cx="97" cy="73" r="2.5" />
        <path d="M55 119c5 14 14 24 25 31 11-7 20-17 25-31" />
        <path d="M61 125c-4 4-7 8-9 13M69 136c-4 4-7 8-8 13M91 136c4 4 7 8 8 13M99 125c4 4 7 8 9 13" />
      </g>
      <g className="goat-crest__chain">
        <ellipse cx="55" cy="141" rx="5" ry="3" transform="rotate(35 55 141)" />
        <ellipse cx="64" cy="150" rx="5" ry="3" transform="rotate(45 64 150)" />
        <ellipse cx="74" cy="156" rx="5" ry="3" transform="rotate(62 74 156)" />
        <ellipse cx="86" cy="156" rx="5" ry="3" transform="rotate(118 86 156)" />
        <ellipse cx="96" cy="150" rx="5" ry="3" transform="rotate(135 96 150)" />
        <ellipse cx="105" cy="141" rx="5" ry="3" transform="rotate(145 105 141)" />
        <path d="M80 159v5" />
        <path d="M69 164h22l3 5-4 16H70l-4-16 3-5Z" />
        <text x="80" y="179" textAnchor="middle">
          LG
        </text>
      </g>
    </svg>
  )
}
