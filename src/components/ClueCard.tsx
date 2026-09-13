import type { Clue } from '../game/clues'
import { useI18n } from '../i18n'

interface ClueCardProps {
  clue: Clue
  index: number
  newlyRevealed?: boolean
}

export function ClueCard({ clue, index, newlyRevealed = false }: ClueCardProps) {
  const { locale, t } = useI18n()
  return (
    <article className={`clue-card ${newlyRevealed ? 'clue-card--new' : ''}`} aria-label={`${locale === 'es' ? 'Pista' : 'Clue'} ${index}`}>
      <div className="clue-card__number" aria-hidden="true">
        {String(index).padStart(2, '0')}
      </div>
      <div className="clue-card__body">
        <span className="eyebrow">{clue.label}</span>
        {clue.kind === 'teams' ? (
          <div className="team-clue">
            <div className="team-clue__copy">
              <p>
                {t('Career decades in the Big Five European leagues (Spain, England, Germany, Italy, France):')}{' '}
                <strong>{clue.decades.join(' · ')}</strong>
              </p>
              <p className="career-decades">
                {t('One club this player represented:')} <strong>{clue.teams[0].clubName}</strong>
              </p>
            </div>
            <div className="team-logos" aria-label={locale === 'es' ? 'Escudos de los equipos' : 'Team logos'}>
              {clue.teams.map((team) => (
                <div className="team-logo" key={team.clubId} title={team.clubName}>
                  <img
                    src={`${import.meta.env.BASE_URL}${team.logoPath.replace(/^\/+/, '')}`}
                    alt={t('{club} badge', { club: team.clubName })}
                  />
                  <span>{team.leagueName}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="clue-copy">{clue.text}</p>
        )}
      </div>
    </article>
  )
}
