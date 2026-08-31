import type { LineupMatch } from '../data/lineupTypes'
import { positionLineupStarter } from '../game/lineups'
import { useI18n } from '../i18n'

interface LineupPitchProps {
  match: LineupMatch
  missingPlayerId: string
  revealed: boolean
}

export function LineupPitch({ match, missingPlayerId, revealed }: LineupPitchProps) {
  const { t } = useI18n()
  return (
    <section className="lineup-pitch" aria-label={t('{home} and {away} starting lineups', { home: match.homeTeam.name, away: match.awayTeam.name })}>
      <div className="lineup-pitch__markings" aria-hidden="true"><i /><b /><span /></div>
      {match.teams.map((team, teamIndex) => (
        <div className={`lineup-pitch__team lineup-pitch__team--${teamIndex === 0 ? 'home' : 'away'}`} key={team.id}>
          <div className="lineup-pitch__team-label">
            <strong>{team.name}</strong><span>{team.formation}</span>
          </div>
          {team.starters.map((player) => {
            const missing = player.id === missingPlayerId
            const { left, top } = positionLineupStarter(player.x, player.y, teamIndex)
            return (
              <div
                className={`pitch-player ${missing ? 'pitch-player--missing' : ''} ${missing && revealed ? 'pitch-player--revealed' : ''}`}
                style={{ left: `${left}%`, top: `${top}%` }}
                key={player.id}
                aria-label={missing && !revealed ? t('Missing {team} starter', { team: team.name }) : `${player.displayName}, ${team.name}`}
              >
                <span className="pitch-player__marker" aria-hidden="true">{missing && !revealed ? '?' : player.shirtNumber}</span>
                <small>{missing && !revealed ? t('Missing player') : player.displayName}</small>
              </div>
            )
          })}
        </div>
      ))}
    </section>
  )
}
