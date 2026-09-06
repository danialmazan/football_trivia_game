import { describe, expect, it } from 'vitest'
import {
  localeFromSearch,
  pluralize,
  resolveInitialLocale,
  translate,
  translateCountryName,
  translateFootballTerm,
  urlWithLocale,
} from './i18n'
import {
  buildChallengeShareData,
  buildDailyShareData,
  buildLineupChallengeShareData,
  buildLineupDailyShareData,
} from './game/sharing'

describe('localization', () => {
  it('resolves URL, stored preference, browser language, then English', () => {
    expect(resolveInitialLocale('?lang=es', 'en', ['en-GB'])).toBe('es')
    expect(resolveInitialLocale('', 'es', ['en-GB'])).toBe('es')
    expect(resolveInitialLocale('', null, ['es-ES', 'en'])).toBe('es')
    expect(resolveInitialLocale('', null, ['fr-FR'])).toBe('en')
    expect(localeFromSearch('?other=1&lang=en')).toBe('en')
    expect(localeFromSearch('?lang=fr')).toBeNull()
  })

  it('preserves unrelated URL state when changing language', () => {
    expect(urlWithLocale('es', 'https://example.com/leoguessi/?mode=daily#score'))
      .toBe('https://example.com/leoguessi/?mode=daily&lang=es#score')
  })

  it('interpolates Spanish copy and translates structured football terms', () => {
    expect(translate('es', '{count} players', { count: 10 })).toBe('10 jugadores')
    expect(pluralize('es', 10, 'One player', '{count} players')).toBe('10 jugadores')
    expect(translateFootballTerm('es', 'Midfielder')).toBe('Centrocampista')
    expect(translateFootballTerm('es', 'Semi-final · First leg')).toBe('Semifinal · Ida')
    expect(translateCountryName('es', 'Brazil / Spain')).toBe('Brasil / España')
    expect(translate('es', 'One club from the Big-Five leagues this player represented:'))
      .toBe('Un club de las ligas del Big Five que representó este jugador:')
    expect(translate('es', '{club} badge', { club: 'Barcelona' })).toBe('Escudo de Barcelona')
  })

  it('builds localized spoiler-free share text', () => {
    const daily = buildDailyShareData({ points: 80, rank: 3, date: '2026-08-31', url: 'https://example.com/?lang=es', locale: 'es' })
    expect(daily.title).toBe('Leo Guessi — Jugador del día')
    expect(daily.text).toContain('puesto #3')
    expect(JSON.stringify(daily)).not.toContain('nickname')

    const challenge = buildChallengeShareData({ points: 1000, pool: 'hardcore', identified: 9, url: 'https://example.com/?lang=es', locale: 'es' })
    expect(challenge.text).toContain('1000/1000')
    expect(challenge.text).toContain('Hardcore')

    expect(buildLineupDailyShareData({ points: 40, rank: 2, date: '2026-08-31', url: 'https://example.com/?lang=es', locale: 'es' }).title)
      .toBe('Leo Guessi — Alineación del día')
    expect(buildLineupChallengeShareData({ points: 800, identified: 8, url: 'https://example.com/?lang=es', locale: 'es' }).text)
      .toContain('8/10 jugadores ausentes')
  })
})
