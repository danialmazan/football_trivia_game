import type { LineupMatch } from '../data/lineupTypes'
import { positionLineupStarter } from '../game/lineups'

interface LineupPitchProps {
  match: LineupMatch
  missingPlayerId: string
  revealed: boolean
}

export function LineupPitch({ match, missingPlayerId, revealed }: LineupPitchProps) {
  return (
    <section className="lineup-pitch" aria-label={`${match.homeTeam.name} and ${match.awayTeam.name} starting lineups`}>
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
                aria-label={missing && !revealed ? `Missing ${team.name} starter` : `${player.displayName}, ${team.name}`}
              >
                <span className="pitch-player__marker" aria-hidden="true">{missing && !revealed ? '?' : player.shirtNumber}</span>
                <small>{missing && !revealed ? 'Missing player' : player.displayName}</small>
              </div>
            )
          })}
        </div>
      ))}
    </section>
  )
}
