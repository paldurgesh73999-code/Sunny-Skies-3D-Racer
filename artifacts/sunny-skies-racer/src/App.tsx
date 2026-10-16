import { useCallback, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Heart, Pause, Play, RotateCcw, Sparkles, Star } from 'lucide-react';
import { GameScene } from './game/GameScene';
import { getLevelRules, getDistanceProgress, STARTING_HEARTS } from './game/gameRules';

type Screen = 'start' | 'playing' | 'paused' | 'clear' | 'gameover';

function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [level, setLevel] = useState(1);
  const [session, setSession] = useState(0);
  const [distance, setDistance] = useState(0);
  const [stars, setStars] = useState(0);
  const [hearts, setHearts] = useState(STARTING_HEARTS);
  const heartsRef = useRef(STARTING_HEARTS);
  const [ready, setReady] = useState(false);
  const [bump, setBump] = useState(0);
  const rules = getLevelRules(level);
  const progress = getDistanceProgress(distance, rules.goalDistance);

  const begin = useCallback((nextLevel = level) => {
    setLevel(nextLevel);
    setDistance(0);
    setStars(0);
    heartsRef.current = STARTING_HEARTS;
    setHearts(STARTING_HEARTS);
    setSession((value) => value + 1);
    setScreen('playing');
  }, [level]);

  const collectStar = useCallback(() => setStars((value) => value + 1), []);
  const crash = useCallback(() => {
    setBump((value) => value + 1);
    heartsRef.current = Math.max(0, heartsRef.current - 1);
    setHearts(heartsRef.current);
    if (heartsRef.current === 0) setScreen('gameover');
  }, []);
  const clearLevel = useCallback(() => setScreen('clear'), []);
  const moveLane = useCallback((direction: number) => {
    window.dispatchEvent(new CustomEvent('sunny-lane-step', { detail: direction }));
  }, []);

  return (
    <main className="game-shell" data-testid="game-shell">
      <GameScene
        active={screen === 'playing'}
        session={session}
        level={level}
        onStats={setDistance}
        onStar={collectStar}
        onCrash={crash}
        onClear={clearLevel}
        onReady={setReady}
      />
      <div className="sky-wash" aria-hidden="true" />

      {screen !== 'start' && (
        <section className="game-hud" aria-label="Race information">
          <div className="hud-cluster">
            <div className="hud-chip" data-testid="status-level">
              <div><div className="level-label">Level {level}</div><strong>{Math.floor(distance)} <small style={{ fontSize: 11 }}>m</small></strong></div>
              <div className="progress-track" aria-label={`${Math.round(progress * 100)} percent complete`}>
                <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
            <div className="hud-chip" data-testid="status-stars">
              <Star className="star-mark" size={18} fill="currentColor" strokeWidth={2.5} aria-hidden="true" />
              <strong>{stars}</strong>
            </div>
          </div>
          <div className="hud-cluster">
            <div className="hud-chip" data-testid="status-hearts" aria-label={`${hearts} hearts remaining`}>
              <span className="heart-row" aria-hidden="true">{Array.from({ length: STARTING_HEARTS }, (_, index) => <Heart key={index} size={18} fill={index < hearts ? 'currentColor' : 'none'} strokeWidth={2.4} />)}</span>
            </div>
            {(screen === 'playing' || screen === 'paused') && (
              <button
                className="pause-button"
                type="button"
                aria-label={screen === 'playing' ? 'Pause race' : 'Resume race'}
                data-testid="button-pause"
                onClick={() => setScreen((state) => state === 'playing' ? 'paused' : 'playing')}
              >
                {screen === 'playing' ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
              </button>
            )}
          </div>
        </section>
      )}

      {bump > 0 && <div key={bump} className="feedback-flash" aria-hidden="true" />}

      {screen === 'playing' && (
        <div className="touch-controls" aria-label="Steering controls">
          <button className="touch-control" type="button" aria-label="Steer left" data-testid="button-steer-left" onClick={() => moveLane(-1)}>
            <ArrowLeft aria-hidden="true" />
          </button>
          <button className="touch-control" type="button" aria-label="Steer right" data-testid="button-steer-right" onClick={() => moveLane(1)}>
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      )}

      {screen !== 'playing' && (
        <div className="overlay-layer">
          {screen === 'start' && (
            <section className="overlay-card" aria-labelledby="game-title">
              <div className="eyebrow"><Sparkles size={14} /> A little road-trip adventure</div>
              <h1 id="game-title" className="brand-title">Sunny Skies<br /><span>Racer</span></h1>
              <p className="overlay-copy">Take the sunny route, scoop up shiny stars, and look out for the friendly road buddies.</p>
              <button className="primary-action" type="button" onClick={() => begin(1)} data-testid="button-start" disabled={!ready}>
                {ready ? 'Start the ride' : 'Getting the road ready…'}
              </button>
              <div className="how-to" aria-label="How to steer">
                <span><i className="keycap">←</i><i className="keycap">→</i> or <i className="keycap">A</i><i className="keycap">D</i></span>
                <span><ArrowLeft size={15} /> Steer between three lanes</span>
                <span><Star className="star-mark" size={14} fill="currentColor" /> Collect stars</span>
              </div>
            </section>
          )}

          {screen === 'paused' && (
            <section className="overlay-card" aria-labelledby="pause-title">
              <div className="eyebrow">A sunny little breather</div>
              <h2 id="pause-title" className="brand-title">Pit stop!</h2>
              <p className="overlay-copy">Your car is taking a rest. Ready when you are.</p>
              <button className="primary-action" type="button" onClick={() => setScreen('playing')} data-testid="button-resume"><Play size={17} fill="currentColor" /> &nbsp; Back to the road</button>
              <div className="action-row"><button className="secondary-action" type="button" onClick={() => setScreen('start')} data-testid="button-home">Back to start</button></div>
            </section>
          )}

          {screen === 'clear' && (
            <section className="overlay-card" aria-labelledby="clear-title">
              <div className="eyebrow"><Sparkles size={14} /> Lovely driving</div>
              <h2 id="clear-title" className="brand-title">Level <span>cleared!</span></h2>
              <div className="level-badge">Level {level} complete</div>
              <p className="overlay-copy">You found your way through the sunshine. There is a new road waiting.</p>
              <div className="clear-stats">
                <div className="stat-block"><strong>{stars}</strong>Stars collected</div>
                <div className="stat-block"><strong>{rules.goalDistance} m</strong>Road travelled</div>
              </div>
              <button className="primary-action" type="button" onClick={() => begin(level + 1)} data-testid="button-next-level">Continue to level {level + 1} <ArrowRight size={17} /></button>
              <div className="action-row"><button className="secondary-action" type="button" onClick={() => begin(level)} data-testid="button-replay-level"><RotateCcw size={15} /> &nbsp; Drive again</button></div>
            </section>
          )}

          {screen === 'gameover' && (
            <section className="overlay-card" aria-labelledby="gameover-title">
              <div className="eyebrow">A little bump in the road</div>
              <h2 id="gameover-title" className="brand-title">Try <span>again?</span></h2>
              <p className="overlay-copy">Those road buddies got a little too close. Take a breath and give it another go.</p>
              <div className="clear-stats">
                <div className="stat-block"><strong>{Math.floor(distance)} m</strong>Distance</div>
                <div className="stat-block"><strong>{stars}</strong>Stars found</div>
              </div>
              <button className="primary-action" type="button" onClick={() => begin(level)} data-testid="button-retry"><RotateCcw size={17} /> &nbsp; Try this level again</button>
              <div className="action-row"><button className="secondary-action" type="button" onClick={() => begin(1)} data-testid="button-restart">Start from level 1</button></div>
            </section>
          )}
        </div>
      )}
      <span className="sr-only" aria-live="polite">{screen === 'playing' ? `Level ${level}, ${Math.floor(distance)} meters, ${stars} stars, ${hearts} hearts` : ''}</span>
    </main>
  );
}

export default App;
