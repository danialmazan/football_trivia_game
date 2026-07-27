import type { Clue } from '../game/clues'

interface ClueCardProps {
  clue: Clue
  index: number
  newlyRevealed?: boolean
}

export function ClueCard({ clue, index, newlyRevealed = false }: ClueCardProps) {
  return (
    <article className={`clue-card ${newlyRevealed ? 'clue-card--new' : ''}`} aria-label={`Clue ${index}`}>
      <div className="clue-card__number" aria-hidden="true">
        {String(index).padStart(2, '0')}
      </div>
      <div className="clue-card__body">
        <span className="eyebrow">{clue.label}</span>
        {clue.kind === 'teams' ? (
          <div className="team-clue">
            <div className="team-clue__copy">
              <p>
                One Big-Five club this player represented:{' '}
                <strong>{clue.teams[0].clubName}</strong>
              </p>
              <p className="career-decades">
                Big-Five career decades: <strong>{clue.decades.join(' · ')}</strong>
              </p>
              <small>
                The decades cover the full eligible career—not necessarily the years with this club.
              </small>
            </div>
            <div className="team-logos" aria-label="Team logos">
              {clue.teams.map((team) => (
                <div className="team-logo" key={team.clubId} title={team.clubName}>
                  <img
                    src={`${import.meta.env.BASE_URL}${team.logoPath.replace(/^\/+/, '')}`}
                    alt={`${team.clubName} badge`}
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
