import { useState } from 'react'
import { isValidNickname } from '../game/daily'
import { buildDailyShareData, buildLineupDailyShareData, getLocalizedGameUrl } from '../game/sharing'
import type {
  LeaderboardHubResponse,
  LineupLeaderboardHubResponse,
  Pool,
} from '../game/types'
import { LeaderboardTabs } from './LeaderboardTabs'
import { SavedResultShare } from './SavedResultShare'
import { useI18n } from '../i18n'

export type LeaderboardFamily = 'player' | 'lineup'

interface LeaderboardHubScreenProps {
  family: LeaderboardFamily | null
  nickname: string
  playerResponse: LeaderboardHubResponse | null
  lineupResponse: LineupLeaderboardHubResponse | null
  loading: boolean
  error: string | null
  onFamilyChange: (family: LeaderboardFamily | null) => void
  onNicknameChange: (nickname: string) => void
  onSubmit: (family: LeaderboardFamily) => void
  onRefresh: (family: LeaderboardFamily) => void
  onResetAccess: (family: LeaderboardFamily) => void
  onExit: () => void
}

export function LeaderboardHubScreen(props: LeaderboardHubScreenProps) {
  const { locale, t, modeLabel, poolLabel, known } = useI18n()
  const { family, nickname, playerResponse, lineupResponse, loading, error, onFamilyChange, onNicknameChange, onSubmit, onRefresh, onResetAccess, onExit } = props
  const [page, setPage] = useState<'daily' | 'challenge'>('daily')
  const [pool, setPool] = useState<Pool>('normal')
  const response = family === 'lineup' ? lineupResponse : playerResponse
  const unlocked = response?.eligible === true
  const ownDailyResult = response?.eligible
    ? response.dailyBoards.today.find((entry) => entry.nickname === response.nickname)
    : undefined

  return (
    <main className="leaderboard-hub-shell">
      <header className="leaderboard-hub-hero">
        <button className="wordmark" type="button" onClick={onExit}>LEO <span>GUESSI</span></button>
        <span className="eyebrow">{t('Shared records · Independent daily gates')}</span>
        <h1>{t('Check the leaderboard.')}</h1>
        <p>{t('Choose the game family, then use the nickname that completed its daily game.')}</p>
      </header>

      {!family ? (
        <section className="leaderboard-family-picker" aria-labelledby="leaderboard-family-title">
          <span className="eyebrow">{t('Choose your board')}</span>
          <h2 id="leaderboard-family-title">{t('What did you guess?')}</h2>
          <div>
            <button type="button" onClick={() => onFamilyChange('player')}><small>{t('Five clues')}</small><strong>{t('Guess the player')}</strong><span>{t('Daily player and 10-round challenge boards →')}</span></button>
            <button type="button" onClick={() => onFamilyChange('lineup')}><small>{t('One blank shirt')}</small><strong>{t('Guess the lineup')}</strong><span>{t('Daily lineup and 10-round lineup boards →')}</span></button>
          </div>
        </section>
      ) : !unlocked ? (
        <section className="leaderboard-access" aria-labelledby="leaderboard-access-title">
          <button className="leaderboard-family-back" type="button" onClick={() => onFamilyChange(null)}>{t('← Choose another game')}</button>
          <div><span className="eyebrow">{family === 'player' ? t('Guess the player') : t('Guess the lineup')}</span><h2 id="leaderboard-access-title">{t('Enter your nickname.')}</h2><p>{t('Use the nickname that saved today’s {mode}.', { mode: modeLabel(family === 'player' ? 'daily' : 'lineup-daily') })}</p></div>
          <form onSubmit={(event) => { event.preventDefault(); onSubmit(family) }}>
            <label htmlFor="leaderboard-nickname">{t('Public nickname')}</label>
            <div><input id="leaderboard-nickname" value={nickname} onChange={(event) => onNicknameChange(event.target.value)} maxLength={24} placeholder={t('Name or nickname')} autoComplete="nickname" /><button className="primary-button" type="submit" disabled={loading || !isValidNickname(nickname)}>{loading ? t('Checking…') : t('Check the leaderboard')}</button></div>
          </form>
          {response?.eligible === false && <p className="leaderboard-access__locked" role="status">{t('Guess today’s {mode} to see this leaderboard!', { mode: modeLabel(family === 'player' ? 'daily' : 'lineup-daily') })}</p>}
          {error && <p className="daily-service-error" role="alert">{known(error)}</p>}
        </section>
      ) : (
        <section className="leaderboard-hub-content" aria-label={t('Unlocked leaderboards')}>
          <div className="leaderboard-hub-toolbar">
            <div className="leaderboard-hub-toolbar__share"><button className="leaderboard-family-back" type="button" onClick={() => onFamilyChange(null)}>{t('← All leaderboard games')}</button><p>{t('Viewing as')} <strong>{response.nickname}</strong></p>{ownDailyResult && <SavedResultShare data={family === 'player' ? buildDailyShareData({ points: ownDailyResult.value, rank: ownDailyResult.rank, date: response.date, url: getLocalizedGameUrl(locale), locale }) : buildLineupDailyShareData({ points: ownDailyResult.value, rank: ownDailyResult.rank, date: response.date, url: getLocalizedGameUrl(locale), locale })} />}</div>
            <div className="leaderboard-hub-toolbar__tools"><button className="text-button" type="button" onClick={() => onRefresh(family)} disabled={loading}>{loading ? t('Refreshing…') : t('Refresh leaderboards')}</button><button className="text-button" type="button" onClick={() => onResetAccess(family)}>{t('Change nickname')}</button></div>
          </div>
          <div className="leaderboard-hub-pages" role="tablist" aria-label={t('Leaderboard game')}>
            <button type="button" role="tab" aria-selected={page === 'daily'} className={page === 'daily' ? 'active' : ''} onClick={() => setPage('daily')}>{modeLabel(family === 'player' ? 'daily' : 'lineup-daily')}</button>
            <button type="button" role="tab" aria-selected={page === 'challenge'} className={page === 'challenge' ? 'active' : ''} onClick={() => setPage('challenge')}>{modeLabel(family === 'player' ? 'challenge' : 'lineup-challenge')}</button>
          </div>
          {page === 'daily' ? (
            <LeaderboardTabs
              key={`${family}-daily`}
              mode={family === 'player' ? 'daily' : 'lineup-daily'}
              boards={response.dailyBoards}
              currentNickname={response.nickname}
            />
          ) : family === 'player' && playerResponse?.eligible ? (
            <>
              <div className="leaderboard-pool-toggle" aria-label={t('Challenge player pool')}>
                {(['normal', 'hardcore'] as const).map((option) => (
                  <button type="button" aria-pressed={pool === option} className={pool === option ? 'active' : ''} onClick={() => setPool(option)} key={option}>{poolLabel(option)}</button>
                ))}
              </div>
              <LeaderboardTabs key={`hub-challenge-${pool}`} mode="challenge" boards={playerResponse.challengeBoards[pool]} currentNickname={response.nickname} />
            </>
          ) : family === 'lineup' && lineupResponse?.eligible ? (
            <LeaderboardTabs key="hub-lineup-challenge" mode="lineup-challenge" boards={lineupResponse.challengeBoards} currentNickname={response.nickname} />
          ) : null}
        </section>
      )}
      <div className="leaderboard-hub-home"><button className="secondary-button" type="button" onClick={onExit}>{t('Back to home page')}</button></div>
    </main>
  )
}
