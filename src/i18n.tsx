import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { FeedbackMessage, GameMode, Pool, PracticeLeague } from './game/types'

export type Locale = 'en' | 'es'
export const LANGUAGE_STORAGE_KEY = 'leo-guessi:language'

const ES_MESSAGES = {
  'European football knowledge test': 'Test de conocimientos sobre fútbol europeo',
  'Big Five · Since 1995': 'Big Five · Desde 1995',
  'Can you become the G.O.A.T. of player guessing?': '¿Puedes convertirte en el G.O.A.T. de adivinar futbolistas?',
  'What does “Big Five” mean?': '¿Qué significa «Big Five»?',
  'England, Spain, Italy, Germany and France. The player pool only includes footballers who appeared in at least one of those countries’ top leagues from 1995 onwards.': 'Inglaterra, España, Italia, Alemania y Francia. El grupo de jugadores solo incluye futbolistas que disputaron al menos un partido en la máxima categoría de uno de esos países desde 1995.',
  'Check the leaderboard': 'Ver la clasificación',
  'Play today': 'Juega hoy',
  'Daily games': 'Juegos diarios',
  'Want more more guessing?': '¿Quieres adivinar aún más?',
  'More games': 'Más juegos',
  'Guess the player — 10-round challenge': 'Adivina el jugador — reto de 10 rondas',
  'Guess the lineup — 10-round challenge': 'Adivina la alineación — reto de 10 rondas',
  'Guess the player — endless mode': 'Adivina el jugador — modo infinito',
  'Guess the player — by decade/league': 'Adivina el jugador — por década/liga',
  'Game setup': 'Configuración de la partida',
  'Choose the fixture': 'Elige el partido',
  'Game format': 'Formato de juego',
  'A player each day. Same for everyone.': 'Un jugador al día. El mismo para todos.',
  '10 players · 1,000 max': '10 jugadores · máximo 1.000',
  'One missing starter. Same for everyone.': 'Falta un titular. El mismo para todos.',
  '10 historic lineups · 1,000 max': '10 alineaciones históricas · máximo 1.000',
  'Play through the pool': 'Juega con todo el grupo',
  '10 players from your chosen filter': '10 jugadores del filtro elegido',
  'More game formats': 'Más formatos de juego',
  'Practice filter type': 'Tipo de filtro de práctica',
  'By decade': 'Por década',
  'By league': 'Por liga',
  'Practice selection': 'Selección de práctica',
  'Set the squad depth': 'Elige la profundidad de la plantilla',
  'Player pool': 'Grupo de jugadores',
  'Choose your player pool': 'Elige tu grupo de jugadores',
  'Player of the day uses the Normal pool.': 'El Jugador del día usa el grupo Normal.',
  '250 recognised players with 50+ Big-Five appearances since 1995.': '250 jugadores reconocidos con más de 50 partidos en el Big Five desde 1995.',
  '800 ranked players with 150+ career Big-Five appearances.': '800 jugadores ordenados con más de 150 partidos en el Big Five durante su carrera.',
  'historic matches available': 'partidos históricos disponibles',
  'players available': 'jugadores disponibles',
  'Kick off': 'Empezar',
  'Continue unfinished {mode}': 'Continuar {mode} sin terminar',
  'Continue unfinished lineup challenge': 'Continuar el reto de alineaciones sin terminar',
  'Player of the day': 'Jugador del día',
  '10-round challenge': 'Reto de 10 rondas',
  'Lineup of the day': 'Alineación del día',
  '10-round lineup challenge': 'Reto de 10 alineaciones',
  'Endless mode': 'Modo infinito',
  'By decade or league': 'Por década o liga',
  'England': 'Inglaterra',
  'Spain': 'España',
  'Italy': 'Italia',
  'Germany': 'Alemania',
  'France': 'Francia',
  'Back': 'Volver',
  'Quick rules': 'Reglas rápidas',
  "You'll get the first clue. You can choose to guess for 100 points, get the next clue or give up.": 'Recibirás la primera pista. Puedes responder por 100 puntos, pedir la siguiente pista o rendirte.',
  'Every missed guess reduces the prize by 10 points.': 'Cada respuesta fallida reduce el premio en 10 puntos.',
  'Every clue requested reduces the prize by 20 points.': 'Cada pista solicitada reduce el premio en 20 puntos.',
  'Same Player of the Day and clue set for everyone playing today.': 'El mismo Jugador del día y las mismas pistas para todos los que jueguen hoy.',
  'A new player is generated every day at midnight UTC.': 'Se genera un nuevo jugador cada día a medianoche UTC.',
  "Understood, let's play!": '¡Entendido, a jugar!',
  'Quick rules · then kick-off': 'Reglas rápidas · y a jugar',
  'One player. One shared fixture.': 'Un jugador. Un reto compartido.',
  'Know your three moves.': 'Conoce tus tres opciones.',
  'One player': 'Un jugador',
  '{count} players': '{count} jugadores',
  'Unlimited players': 'Jugadores ilimitados',
  '{runLength}, with the same clue set for everyone worldwide. It stays live until the next player is selected at 00:00:00 UTC.': '{runLength}, con las mismas pistas para todo el mundo. Estará disponible hasta que se elija el siguiente jugador a las 00:00:00 UTC.',
  '{runLength}. Five progressively easier clues per player. You can make a guess, request the next clue, or give up at any time.': '{runLength}. Cinco pistas cada vez más fáciles por jugador. Puedes responder, pedir la siguiente pista o rendirte en cualquier momento.',
  '{pool} pool': 'Grupo {pool}',
  'Five clues, hardest first': 'Cinco pistas, de más difícil a más fácil',
  'Each player starts on clue 1. Request the next clue whenever you need it.': 'Cada jugador empieza con la pista 1. Pide la siguiente cuando la necesites.',
  'Points fall as help increases': 'Los puntos bajan cuanto más ayudas recibes',
  'Clues are worth 100, 80, 60, 40, then 20 points. Every distinct miss costs another 10.': 'Las pistas valen 100, 80, 60, 40 y, por último, 20 puntos. Cada fallo distinto resta otros 10.',
  'The maximum daily score is 100.': 'La puntuación máxima diaria es 100.',
  'Choose one move at any time': 'Elige una opción en cualquier momento',
  'Available actions': 'Acciones disponibles',
  'Guess': 'Responder',
  'Next clue': 'Siguiente pista',
  'Give up': 'Rendirse',
  'The first result submitted under a nickname locks that nickname for today’s player.': 'El primer resultado enviado con un apodo vincula ese apodo al jugador de hoy.',
  'Submit every completed game under the same nickname to keep its challenge history together.': 'Envía todas las partidas terminadas con el mismo apodo para mantener unido su historial de retos.',
  'Loading today’s player…': 'Cargando el jugador de hoy…',
  "Let's go!": '¡Vamos!',
  'Leave game': 'Salir de la partida',
  'Exit': 'Salir',
  'Game status': 'Estado de la partida',
  'Lineup game status': 'Estado de la partida de alineaciones',
  'Today’s lineup': 'Alineación de hoy',
  'Today’s player': 'Jugador de hoy',
  'Progress': 'Progreso',
  'Players seen': 'Jugadores vistos',
  'Round score': 'Puntos de la ronda',
  'Available now': 'Disponibles ahora',
  'for': 'por',
  'Daily score': 'Puntuación diaria',
  'Game score': 'Puntuación de la partida',
  'Avg / player': 'Media / jugador',
  'Review all five clues': 'Revisar las cinco pistas',
  'Optional · answer shown above': 'Opcional · respuesta mostrada arriba',
  'Current clues': 'Pistas actuales',
  'Clue {current} / 5': 'Pista {current} / 5',
  'Top bins.': '¡A la escuadra!',
  'Answer revealed': 'Respuesta revelada',
  'points earned': 'puntos conseguidos',
  'Missed guesses': 'Respuestas fallidas',
  'Enter your nickname to save this result, build your stats history and unlock sharing.': 'Introduce tu apodo para guardar este resultado, crear tu historial y desbloquear la opción de compartir.',
  'Your nickname is public and can submit once today.': 'Tu apodo es público y solo puede enviar un resultado hoy.',
  'Name or nickname': 'Nombre o apodo',
  'Your name or nickname': 'Tu nombre o apodo',
  'Required before the game starts.': 'Es obligatorio antes de empezar la partida.',
  'Enter your name or nickname before playing.': 'Introduce tu nombre o apodo antes de jugar.',
  'Saving…': 'Guardando…',
  'Waiting to sync': 'Esperando para sincronizar',
  'Your score is saved automatically when this round ends.': 'Tu puntuación se guarda automáticamente al terminar esta ronda.',
  'Retry': 'Reintentar',
  'An unfinished Player of the Day already exists for {nickname}. Continue it here?': 'Ya hay un Jugador del día sin terminar para {nickname}. ¿Quieres continuarlo aquí?',
  'An unfinished Lineup of the Day already exists for {nickname}. Continue it here?': 'Ya hay una Alineación del día sin terminar para {nickname}. ¿Quieres continuarla aquí?',
  'This game was updated in another browser. The latest progress has been restored.': 'Esta partida se actualizó en otro navegador. Se ha restaurado el progreso más reciente.',
  'Could not save your result. Your progress is waiting to sync.': 'No se ha podido guardar tu resultado. Tu progreso está esperando para sincronizarse.',
  'Could not save your lineup result. Your progress is waiting to sync.': 'No se ha podido guardar tu resultado de alineaciones. Tu progreso está esperando para sincronizarse.',
  'Could not confirm the unfinished daily game.': 'No se ha podido confirmar la partida diaria sin terminar.',
  'Could not confirm the unfinished lineup game.': 'No se ha podido confirmar la partida diaria de alineaciones sin terminar.',
  'Save score': 'Guardar puntuación',
  'Use the same nickname every time for your stats history to stay together.': 'Usa siempre el mismo apodo para mantener unido tu historial.',
  'See final results': 'Ver resultado final',
  'Next player': 'Siguiente jugador',
  'Your call': 'Tu decisión',
  'Guess · clue · give up': 'Responder · pista · rendirse',
  'Guess now': 'Responde ahora',
  'Player name': 'Nombre del jugador',
  'Player suggestions': 'Sugerencias de jugadores',
  'Submit': 'Enviar',
  'Full names, unique surnames and common short names work.': 'Se aceptan nombres completos, apellidos únicos y nombres habituales.',
  'All shown': 'Todas mostradas',
  '{points} pts base': '{points} pts base',
  'and play for {points} pts': 'y juega por {points} puntos',
  'Guess now, next clue or give up': 'Responde ahora, pide otra pista o ríndete',
  'Incorrect guesses': 'Respuestas incorrectas',
  'Historic teamsheet · one blank shirt': 'Alineación histórica · falta una camiseta',
  'Read the shape. Find the missing starter.': 'Lee el dibujo. Encuentra al titular que falta.',
  'One match and one missing player shared worldwide until 00:00:00 UTC.': 'Un partido y un jugador ausente compartidos en todo el mundo hasta las 00:00:00 UTC.',
  'Ten historic matches. Identify one missing starter from each real starting XI.': 'Diez partidos históricos. Identifica a un titular ausente de cada once real.',
  '{count} different semifinal or final lineups from the Champions League, EURO or World Cup.': '{count} alineaciones diferentes de semifinales o finales de Champions, EURO o Mundial.',
  '{count} matches': '{count} partidos',
  'Both XIs, one shared pitch': 'Dos onces, un mismo campo',
  'The actual starting formations face each other. The highlighted question mark is the only missing player.': 'Las formaciones titulares reales se enfrentan. El signo de interrogación destacado es el único jugador ausente.',
  '100 points on the board': '100 puntos en juego',
  'Each distinct wrong guess costs {points} points. At zero you can still identify the player.': 'Cada respuesta incorrecta distinta cuesta {points} puntos. Aunque llegues a cero, todavía puedes identificar al jugador.',
  'Two optional clues': 'Dos pistas opcionales',
  'Reveal the player’s nationality in UCL games, or their most-played club that season in EURO and World Cup games, for a maximum of 40 points. Initials cap the round at 20.': 'Revela la nacionalidad del jugador en partidos de Champions, o el club en el que más jugó esa temporada en partidos de EURO y Mundial, con un máximo de 40 puntos. Las iniciales limitan la ronda a 20.',
  '2 clues': '2 pistas',
  'Complete the lineup and save a public nickname to unlock the Guess the lineup leaderboards.': 'Completa la alineación y guarda un apodo público para desbloquear las clasificaciones de Adivina la alineación.',
  'Loading the teamsheet…': 'Cargando la alineación…',
  "You'll see two starting lineups with one player missing. Guess for 100 points, get the next clue or give up.": 'Verás dos alineaciones titulares con un jugador ausente. Responde por 100 puntos, pide la siguiente pista o ríndete.',
  'Every missed guess reduces the prize by 20 points.': 'Cada respuesta fallida reduce el premio en 20 puntos.',
  'The first clue lets you play for 40 points. The initials clue lets you play for 20 points.': 'La primera pista te permite jugar por 40 puntos. La pista de las iniciales te permite jugar por 20 puntos.',
  'Same Lineup of the Day and missing player for everyone playing today.': 'La misma Alineación del día y el mismo jugador ausente para todos los que jueguen hoy.',
  'A new lineup is generated every day at midnight UTC.': 'Se genera una nueva alineación cada día a medianoche UTC.',
  'Next clue — and play for 40 pts': 'Siguiente pista — y juega por 40 puntos',
  'Next clue — and play for 20 pts': 'Siguiente pista — y juega por 20 puntos',
  'Shared records · Independent daily gates': 'Récords compartidos · Accesos diarios independientes',
  'Check the leaderboard.': 'Consulta la clasificación.',
  'Choose the game family, then use the nickname that completed its daily game.': 'Elige el tipo de juego y usa el apodo con el que completaste su reto diario.',
  'Choose your board': 'Elige tu clasificación',
  'What did you guess?': '¿Qué has adivinado?',
  'Five clues': 'Cinco pistas',
  'Guess the player': 'Adivina el jugador',
  'Daily player and 10-round challenge boards →': 'Clasificaciones diarias y del reto de 10 rondas →',
  'One blank shirt': 'Falta una camiseta',
  'Guess the lineup': 'Adivina la alineación',
  'Daily lineup and 10-round lineup boards →': 'Clasificaciones diarias y del reto de 10 alineaciones →',
  '← Choose another game': '← Elegir otro juego',
  'Enter your nickname.': 'Introduce tu apodo.',
  'Use the nickname that saved today’s {mode}.': 'Usa el apodo con el que guardaste el reto de {mode}.',
  'Public nickname': 'Apodo público',
  'Checking…': 'Comprobando…',
  'Guess today’s {mode} to see this leaderboard!': '¡Adivina el reto de {mode} de hoy para ver esta clasificación!',
  'Unlocked leaderboards': 'Clasificaciones desbloqueadas',
  '← All leaderboard games': '← Todos los juegos con clasificación',
  'Viewing as': 'Viendo como',
  'Refreshing…': 'Actualizando…',
  'Refresh leaderboards': 'Actualizar clasificaciones',
  'Change nickname': 'Cambiar apodo',
  'Leaderboard game': 'Juego de clasificación',
  'Challenge player pool': 'Grupo de jugadores del reto',
  'Back to home page': 'Volver a la página de inicio',
  'Nickname history': 'Historial del apodo',
  '{mode} leaderboard': 'Clasificación de {mode}',
  'Leaderboard view': 'Vista de clasificación',
  'Today': 'Hoy',
  'Cumulative points': 'Puntos acumulados',
  'Games played': 'Partidas jugadas',
  'Average points/game': 'Media de puntos/partida',
  'Average score/game': 'Puntuación media/partida',
  'Best day': 'Mejor día',
  'Best 10-round': 'Mejor reto de 10 rondas',
  'Shared 10-round records began on 31 July 2026. Earlier games stayed only in each browser.': 'Los récords compartidos de 10 rondas comenzaron el 31 de julio de 2026. Las partidas anteriores se guardaron únicamente en cada navegador.',
  'Ranked after at least three completed games.': 'La clasificación comienza tras completar al menos tres partidas.',
  '{label} leaderboard': 'Clasificación: {label}',
  'Rank': 'Puesto',
  'Nickname': 'Apodo',
  'Games': 'Partidas',
  'Points': 'Puntos',
  'Played': 'Jugadas',
  'games': 'partidas',
  'No nickname has reached three games yet.': 'Ningún apodo ha alcanzado todavía las tres partidas.',
  'No scores yet.': 'Todavía no hay puntuaciones.',
  'Full time': 'Final del partido',
  'That’s the final whistle.': 'Ha sonado el pitido final.',
  'Ten filtered players completed.': 'Has completado diez jugadores filtrados.',
  'New personal best.': 'Nuevo récord personal.',
  'Personal best: {score}': 'Récord personal: {score}',
  'Score saved.': 'Puntuación guardada.',
  'Save your game': 'Guarda tu partida',
  'Now share your result.': 'Ahora comparte tu resultado.',
  'Save it. Share it.': 'Guárdalo. Compártelo.',
  'This game now counts toward your challenge history.': 'Esta partida ya cuenta para tu historial de retos.',
  'Save score & view boards': 'Guardar puntuación y ver clasificaciones',
  'Game statistics': 'Estadísticas de la partida',
  'Identified': 'Identificados',
  'Avg clues used': 'Media de pistas',
  'Wrong guesses': 'Respuestas fallidas',
  'Best round': 'Mejor ronda',
  'Box score': 'Acta del partido',
  'Round by round': 'Ronda a ronda',
  'Round results': 'Resultados por ronda',
  'Rnd': 'Rda',
  'Player': 'Jugador',
  'Clues': 'Pistas',
  'Misses': 'Fallos',
  'Play again': 'Jugar de nuevo',
  'Player of the day · {date} UTC': 'Jugador del día · {date} UTC',
  'points · rank #{rank}': 'puntos · puesto #{rank}',
  '{nickname}, your score is locked until 00:00:00 UTC. The answer stays hidden here so the fixture remains fair.': '{nickname}, tu puntuación queda bloqueada hasta las 00:00:00 UTC. La respuesta permanece oculta para que el reto siga siendo justo.',
  'Lineup of the day · {date} UTC': 'Alineación del día · {date} UTC',
  'Lineup score saved.': 'Puntuación de alineación guardada.',
  'Today’s player was {player}. {nickname}, your result is locked until a new player arrives at 00:00:00 UTC.': 'El jugador de hoy era {player}. {nickname}, tu resultado queda bloqueado hasta que llegue uno nuevo a las 00:00:00 UTC.',
  '{nickname}, you identified {player}. Your result is locked until 00:00:00 UTC.': '{nickname}, has identificado a {player}. Tu resultado queda bloqueado hasta las 00:00:00 UTC.',
  'the missing starter': 'el titular ausente',
  'Share your result': 'Compartir resultado',
  'Shared.': 'Compartido.',
  'Link copied.': 'Enlace copiado.',
  'Could not share. Copy the page URL instead.': 'No se ha podido compartir. Copia la URL de la página.',
  'Couldn’t share or copy the link. Copy it from your address bar.': 'No se ha podido compartir ni copiar el enlace. Cópialo desde la barra de direcciones.',
  'Opening share…': 'Abriendo opciones…',
  'Lineup game statistics': 'Estadísticas de alineaciones',
  'Ten teamsheets completed.': 'Diez alineaciones completadas.',
  'New personal lineup best.': 'Nuevo récord personal de alineaciones.',
  'Personal lineup best: {score}': 'Récord personal de alineaciones: {score}',
  'Lineup history updated.': 'Historial de alineaciones actualizado.',
  'Put it on the board.': 'Súbelo a la clasificación.',
  'This game now counts toward your lineup challenge history.': 'Esta partida ya cuenta para tu historial de retos de alineaciones.',
  'Enter your nickname to save this game and view the lineup leaderboards.': 'Introduce tu apodo para guardar esta partida y ver las clasificaciones de alineaciones.',
  'First try': 'A la primera',
  'Teamsheet log': 'Registro de alineaciones',
  'Lineup round results': 'Resultados por ronda de alineaciones',
  'Match': 'Partido',
  'Misses · clues': 'Fallos · pistas',
  'Settings': 'Ajustes',
  'Open settings': 'Abrir ajustes',
  'Close settings': 'Cerrar ajustes',
  'Preferences and records': 'Preferencias y récords',
  'Player and lineup progress and personal records live in this browser. Submitted nicknames and scores join their matching shared leaderboard.': 'El progreso, las partidas y los récords personales se guardan en este navegador. Los apodos y puntuaciones enviados aparecen en la clasificación compartida correspondiente.',
  'Normal high score': 'Récord Normal',
  'Hardcore high score': 'Récord Hardcore',
  'Lineup challenge best': 'Récord del reto de alineaciones',
  'Reset saved data': 'Borrar datos guardados',
  'Language': 'Idioma',
  'Select language': 'Seleccionar idioma',
  'English': 'Inglés',
  'Spanish': 'Español',
  'Leo Guessi goat crest': 'Escudo de cabra de Leo Guessi',
  'Club & career era': 'Club y época de carrera',
  'National team': 'Selección nacional',
  'Major team titles': 'Principales títulos colectivos',
  'Career milestones': 'Hitos de carrera',
  'Position': 'Posición',
  'Initials': 'Iniciales',
  'Initials: {initials}': 'Iniciales: {initials}',
  'One club from the Big-Five leagues this player represented:': 'Un club de las ligas del Big Five que representó este jugador:',
  'Career decades in the Big-Five leagues:': 'Décadas de carrera en las ligas del Big Five:',
  'Career decades in the Big Five European leagues (Spain, England, Germany, Italy, France):': 'Décadas de carrera en las grandes ligas europeas del Big Five (España, Inglaterra, Alemania, Italia, Francia):',
  'One club this player represented:': 'Un club que representó este jugador:',
  'The decades cover the full eligible career—not necessarily the years with this club.': 'Las décadas abarcan toda la carrera que cumple los requisitos, no necesariamente los años en este club.',
  '{club} badge': 'Escudo de {club}',
  '{caps} caps': '{caps} partidos internacionales',
  '{count} Champions League appearances': '{count} partidos de Champions League',
  '{count} senior caps': '{count} partidos con la selección absoluta',
  '{count} appearances in the Big-Five leagues': '{count} partidos en las ligas del Big Five',
  '{position} · {appearances} appearances in the Big-Five leagues · Most appearances for {club} · {achievement}.': '{position} · {appearances} partidos en las ligas del Big Five · Más partidos con {club} · {achievement}.',
  'Goalkeeper': 'Portero',
  'Defender': 'Defensa',
  'Midfielder': 'Centrocampista',
  'Forward': 'Delantero',
  'Attack': 'Ataque',
  'Midfield': 'Centro del campo',
  'Semi-final': 'Semifinal',
  'First leg': 'Ida',
  'Second leg': 'Vuelta',
  'Final': 'Final',
  'UEFA Champions League': 'UEFA Champions League',
  'UEFA European Championship': 'Eurocopa de la UEFA',
  'FIFA World Cup': 'Copa Mundial de la FIFA',
  'Missing player': 'Jugador ausente',
  'Missing {team} starter': 'Falta un titular del {team}',
  'Nationality': 'Nacionalidad',
  'Most-played club that season': 'Club con más partidos esa temporada',
  'Starter identified.': 'Titular identificado.',
  'Missing player revealed': 'Jugador ausente revelado',
  'Enter your nickname to save this result and unlock Guess the lineup leaderboards.': 'Introduce tu apodo para guardar este resultado y desbloquear las clasificaciones de Adivina la alineación.',
  'Next lineup': 'Siguiente alineación',
  'The blank shirt': 'La camiseta vacía',
  'Guess · give up': 'Responder · rendirse',
  'Who is missing?': '¿Quién falta?',
  'Lineup player suggestions': 'Sugerencias de jugadores de la alineación',
  'Previous guesses': 'Respuestas anteriores',
  'Lineup clues': 'Pistas de la alineación',
  'Player initials': 'Iniciales del jugador',
  'Get nationality clue — max 40 pts': 'Ver pista de nacionalidad — máximo 40 pts',
  'Get club clue — max 40 pts': 'Ver pista de club — máximo 40 pts',
  'Get initials clue — max 20 pts': 'Ver pista de iniciales — máximo 20 pts',
  'Give up and reveal': 'Rendirse y revelar',
  '{home} and {away} starting lineups': 'Alineaciones titulares de {home} y {away}',
  'Already guessed — no points deducted.': 'Ya lo habías intentado: no pierdes puntos.',
  'Not this player. Keep going.': 'No es este jugador. Sigue intentándolo.',
  'Not the missing starter. Keep going.': 'No es el titular que falta. Sigue intentándolo.',
  'Clue {number} revealed.': 'Pista {number} revelada.',
  'Enter a player name first.': 'Introduce primero el nombre de un jugador.',
  'Enter one player per guess.': 'Introduce un solo jugador por respuesta.',
  'Please be more specific.': 'Sé más específico.',
  'The player pool is complete. Starting a fresh cycle.': 'Has completado el grupo de jugadores. Empieza un nuevo ciclo.',
  'Reset high scores, endless stats, preferences and saved games?': '¿Quieres borrar récords, estadísticas del modo infinito, preferencias y partidas guardadas?',
  'Start a new lineup challenge and abandon the saved one?': '¿Quieres empezar un nuevo reto de alineaciones y abandonar el guardado?',
  'Start a new game and abandon the saved 10-round game?': '¿Quieres empezar una partida nueva y abandonar el reto de 10 rondas guardado?',
  'Return home without submitting this score to the leaderboard?': '¿Quieres volver al inicio sin enviar esta puntuación a la clasificación?',
  'Leave this active 10-round game? Your progress will remain saved.': '¿Quieres salir de este reto de 10 rondas? Tu progreso seguirá guardado.',
  'Return home without submitting this lineup score?': '¿Quieres volver al inicio sin enviar esta puntuación de alineaciones?',
  'Leave this active lineup challenge? Your progress will remain saved.': '¿Quieres salir de este reto de alineaciones? Tu progreso seguirá guardado.',
  'Play again without submitting this score to the leaderboard?': '¿Quieres volver a jugar sin enviar esta puntuación a la clasificación?',
  'Play again without submitting this lineup score?': '¿Quieres volver a jugar sin enviar esta puntuación de alineaciones?',
  'Today’s player is not available in this game version. Please reload.': 'El jugador de hoy no está disponible en esta versión. Recarga la página.',
  'Today’s lineup is not available in this game version. Please reload.': 'La alineación de hoy no está disponible en esta versión. Recarga la página.',
  'Could not load the lineup game.': 'No se ha podido cargar el juego de alineaciones.',
  'Could not load lineup data.': 'No se han podido cargar los datos de alineaciones.',
  'Could not load today’s player.': 'No se ha podido cargar el jugador de hoy.',
  'Could not submit this lineup game.': 'No se ha podido enviar esta partida de alineaciones.',
  'Could not refresh the lineup leaderboard.': 'No se ha podido actualizar la clasificación de alineaciones.',
  'Could not submit your lineup result.': 'No se ha podido enviar tu resultado de alineaciones.',
  'Could not submit this game.': 'No se ha podido enviar esta partida.',
  'Could not refresh the leaderboard.': 'No se ha podido actualizar la clasificación.',
  'Could not submit your result.': 'No se ha podido enviar tu resultado.',
  'Could not load the leaderboards.': 'No se han podido cargar las clasificaciones.',
  'A new Player of the day is now available.': 'Ya hay un nuevo Jugador del día disponible.',
  'A new Lineup of the day is now available.': 'Ya hay una nueva Alineación del día disponible.',
  'Player of the day is not connected yet. Configure the online service and retry.': 'El Jugador del día todavía no está conectado. Configura el servicio online y vuelve a intentarlo.',
  'The daily game service is unavailable. Please retry.': 'El servicio del juego diario no está disponible. Vuelve a intentarlo.',
  'The daily game service returned an empty response.': 'El servicio del juego diario ha devuelto una respuesta vacía.',
  'Lineup of the day is not connected yet. Configure the online service and retry.': 'La Alineación del día todavía no está conectada. Configura el servicio online y vuelve a intentarlo.',
  'The lineup service is unavailable. Please retry.': 'El servicio de alineaciones no está disponible. Vuelve a intentarlo.',
  'The lineup service returned an empty response.': 'El servicio de alineaciones ha devuelto una respuesta vacía.',
} as const

export type MessageKey = keyof typeof ES_MESSAGES
export type MessageValues = Record<string, string | number>

function interpolate(template: string, values: MessageValues = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`))
}

export function translate(locale: Locale, key: MessageKey, values?: MessageValues): string {
  return interpolate(locale === 'es' ? ES_MESSAGES[key] : key, values)
}

export function pluralize(
  locale: Locale,
  count: number,
  singular: MessageKey,
  plural: MessageKey,
  values: MessageValues = {},
): string {
  return translate(locale, new Intl.PluralRules(locale).select(count) === 'one' ? singular : plural, {
    ...values,
    count,
  })
}

export function translateKnown(locale: Locale, text: string): string {
  if (locale === 'en') return text
  return text in ES_MESSAGES ? ES_MESSAGES[text as MessageKey] : text
}

export function localeFromSearch(search: string): Locale | null {
  const language = new URLSearchParams(search).get('lang')
  return language === 'en' || language === 'es' ? language : null
}

export function resolveInitialLocale(
  search = window.location.search,
  stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY),
  languages = navigator.languages,
): Locale {
  return localeFromSearch(search) ?? (stored === 'en' || stored === 'es' ? stored : null)
    ?? (languages.some((language) => language.toLowerCase().startsWith('es')) ? 'es' : 'en')
}

export function urlWithLocale(locale: Locale, href = window.location.href): string {
  const url = new URL(href)
  url.searchParams.set('lang', locale)
  return url.toString()
}

const MODE_KEYS: Record<GameMode, MessageKey> = {
  daily: 'Player of the day',
  challenge: '10-round challenge',
  'lineup-daily': 'Lineup of the day',
  'lineup-challenge': '10-round lineup challenge',
  endless: 'Endless mode',
  practice: 'By decade or league',
}

const LEAGUE_KEYS: Record<PracticeLeague, MessageKey> = {
  GB1: 'England', ES1: 'Spain', IT1: 'Italy', L1: 'Germany', FR1: 'France',
}

const FOOTBALL_TERMS: Partial<Record<string, MessageKey>> = {
  Goalkeeper: 'Goalkeeper', Defender: 'Defender', Midfielder: 'Midfielder', Forward: 'Forward',
  Attack: 'Attack', Midfield: 'Midfield', 'Semi-final': 'Semi-final', 'First leg': 'First leg',
  'Second leg': 'Second leg', Final: 'Final', 'UEFA Champions League': 'UEFA Champions League',
  'UEFA European Championship': 'UEFA European Championship', 'FIFA World Cup': 'FIFA World Cup',
}

const COUNTRY_ES: Record<string, string> = {
  Albania: 'Albania', Algeria: 'Argelia', Argentina: 'Argentina', Armenia: 'Armenia',
  Australia: 'Australia', Austria: 'Austria', Belarus: 'Bielorrusia', Belgium: 'Bélgica',
  Bolivia: 'Bolivia', 'Bosnia-Herzegovina': 'Bosnia-Herzegovina', Brazil: 'Brasil',
  Bulgaria: 'Bulgaria', Cameroon: 'Camerún', Canada: 'Canadá', Chad: 'Chad', Chile: 'Chile',
  Colombia: 'Colombia', Comoros: 'Comoras', 'Costa Rica': 'Costa Rica',
  "Cote d'Ivoire": 'Costa de Marfil', Croatia: 'Croacia', 'Czech Republic': 'República Checa',
  Denmark: 'Dinamarca', 'Dominican Republic': 'República Dominicana', Ecuador: 'Ecuador',
  Egypt: 'Egipto', England: 'Inglaterra', Estonia: 'Estonia', Finland: 'Finlandia',
  France: 'Francia', Georgia: 'Georgia', Germany: 'Alemania', Ghana: 'Ghana', Greece: 'Grecia',
  Guinea: 'Guinea', Honduras: 'Honduras', Hungary: 'Hungría', Iceland: 'Islandia',
  Indonesia: 'Indonesia', Iran: 'Irán', Ireland: 'Irlanda', Israel: 'Israel', Italy: 'Italia',
  Jamaica: 'Jamaica', Japan: 'Japón', Kenya: 'Kenia', 'Korea, South': 'Corea del Sur',
  Kosovo: 'Kosovo', Luxembourg: 'Luxemburgo', Mali: 'Mali', Malta: 'Malta', Mexico: 'México',
  Montenegro: 'Montenegro', Morocco: 'Marruecos', Netherlands: 'Países Bajos', Nigeria: 'Nigeria',
  'North Macedonia': 'Macedonia del Norte', 'Northern Ireland': 'Irlanda del Norte',
  Norway: 'Noruega', Paraguay: 'Paraguay', Peru: 'Perú', Poland: 'Polonia', Portugal: 'Portugal',
  Romania: 'Rumanía', Russia: 'Rusia', Scotland: 'Escocia', Senegal: 'Senegal', Serbia: 'Serbia',
  Slovakia: 'Eslovaquia', Slovenia: 'Eslovenia', 'South Africa': 'Sudáfrica',
  'South Korea': 'Corea del Sur', Spain: 'España', Sweden: 'Suecia', Switzerland: 'Suiza',
  Togo: 'Togo', Tunisia: 'Túnez', Turkiye: 'Turquía', Türkiye: 'Turquía', Ukraine: 'Ucrania',
  'United States': 'Estados Unidos', Uruguay: 'Uruguay', Wales: 'Gales',
}

export function translateCountryName(locale: Locale, value: string): string {
  if (locale === 'en') return value
  return value.split(' / ').map((country) => COUNTRY_ES[country] ?? country).join(' / ')
}

export function translateFootballTerm(locale: Locale, value: string): string {
  const exact = FOOTBALL_TERMS[value]
  if (exact) return translate(locale, exact)
  return value.split(' · ').map((part) => {
    const key = FOOTBALL_TERMS[part]
    return key ? translate(locale, key) : part
  }).join(' · ')
}

interface I18nValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, values?: MessageValues) => string
  known: (text: string) => string
  modeLabel: (mode: GameMode) => string
  poolLabel: (pool: Pool) => string
  leagueLabel: (league: PracticeLeague) => string
  term: (value: string) => string
  country: (value: string) => string
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
  feedback: (message: FeedbackMessage | null) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => resolveInitialLocale())

  function setLocale(next: Locale) {
    setLocaleState(next)
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
    window.history.replaceState(window.history.state, '', urlWithLocale(next))
  }

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale)
    if (localeFromSearch(window.location.search) !== locale) {
      window.history.replaceState(window.history.state, '', urlWithLocale(locale))
    }
    document.documentElement.lang = locale
    document.title = locale === 'es' ? 'Leo Guessi — Trivia de fútbol' : 'Leo Guessi — Football Player Trivia'
    document.querySelector('meta[name="description"]')?.setAttribute(
      'content',
      locale === 'es'
        ? 'Leo Guessi — identifica futbolistas mediante pistas de carrera cada vez más fáciles.'
        : 'Leo Guessi — identify football players from progressively easier career clues.',
    )
  }, [locale])

  const value = useMemo<I18nValue>(() => ({
    locale,
    setLocale,
    t: (key, values) => translate(locale, key, values),
    known: (text) => translateKnown(locale, text),
    modeLabel: (mode) => translate(locale, MODE_KEYS[mode]),
    poolLabel: (pool) => pool === 'normal' ? 'Normal' : 'Hardcore',
    leagueLabel: (league) => translate(locale, LEAGUE_KEYS[league]),
    term: (term) => translateFootballTerm(locale, term),
    country: (country) => translateCountryName(locale, country),
    formatNumber: (number, options) => number.toLocaleString(locale === 'es' ? 'es-ES' : 'en-US', options),
    feedback: (message) => {
      if (!message) return ''
      const keys: Record<FeedbackMessage['key'], MessageKey> = {
        'already-guessed': 'Already guessed — no points deducted.',
        'incorrect-player': 'Not this player. Keep going.',
        'incorrect-lineup-player': 'Not the missing starter. Keep going.',
        'clue-revealed': 'Clue {number} revealed.',
        'enter-player-name': 'Enter a player name first.',
        'one-player-per-guess': 'Enter one player per guess.',
        'be-specific': 'Please be more specific.',
        'pool-reset': 'The player pool is complete. Starting a fresh cycle.',
      }
      return translate(locale, keys[message.key], { number: message.number ?? '' })
    },
  }), [locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n()
  return (
    <div className="language-toggle" role="group" aria-label={t('Select language')}>
      {(['en', 'es'] as const).map((option) => (
        <button
          type="button"
          key={option}
          aria-pressed={locale === option}
          aria-label={option === 'en' ? t('English') : t('Spanish')}
          onClick={() => setLocale(option)}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
