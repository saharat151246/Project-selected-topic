import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import GameCanvas from './components/Game/GameCanvas';
import AchievementsModal from './components/Menu/AchievementsModal';
import MainMenu from './components/Menu/MainMenu';
import MapSelectScreen from './components/Menu/MapSelectScreen';
import SettingsScreen from './components/Menu/SettingsScreen';
import BossBar from './components/UI/BossBar';
import BuildMenu from './components/UI/BuildMenu';
import DifficultySelector from './components/UI/DifficultySelector';
import FullscreenButton from './components/UI/FullscreenButton';
import GameControls from './components/UI/GameControls';
import GameOverScreen from './components/UI/GameOverScreen';
import HUD from './components/UI/HUD';
import PauseScreen from './components/UI/PauseScreen';
import PerfOverlay from './components/UI/PerfOverlay';
import RotateOverlay from './components/UI/RotateOverlay';
import TowerInfoPanel from './components/UI/TowerInfoPanel';
import VictoryScreen from './components/UI/VictoryScreen';
import WaveControl from './components/UI/WaveControl';
import { greenValley } from './data/maps';
import { appController } from './game/AppController';
import { globalAudio } from './game/AudioSystem';
import { GameEngine } from './game/GameEngine';
import { SaveSystem } from './systems/SaveSystem';
import type { MapData } from './types/game';
import type { SettingsData } from './types/save';

export default function App() {
  const [engine, setEngine] = useState<GameEngine>(() => new GameEngine(greenValley));
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);

  const [screen, setScreen] = useState<'menu' | 'mapSelect' | 'game'>('menu');
  const [showAchievements, setShowAchievements] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [wasPlayingBeforeSettings, setWasPlayingBeforeSettings] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsData>(() => SaveSystem.load().settings);

  useEffect(() => {
    appController.setActiveGame(engine.map, engine);
    return () => appController.clearActiveGame(engine);
  }, [engine]);

  // Sync music to screen state
  useEffect(() => {
    if (screen === 'menu' || screen === 'mapSelect') {
      globalAudio.playMusic('menu');
    } else if (screen === 'game') {
      globalAudio.playMusic('battle');
    }
  }, [screen]);

  // Open & close settings with pause management
  const handleOpenSettings = () => {
    const isPlaying = engine.getSnapshot().status === 'PLAYING';
    setWasPlayingBeforeSettings(isPlaying);
    if (isPlaying) {
      engine.pause();
    }
    setShowSettings(true);
  };

  const handleCloseSettings = () => {
    setShowSettings(false);
    if (wasPlayingBeforeSettings && engine.getSnapshot().status === 'PAUSED') {
      engine.resume();
    }
    setWasPlayingBeforeSettings(false);
  };

  // Select Map & start game
  const handleSelectMap = useCallback((map: MapData) => {
    engine.dispose();
    const newEngine = new GameEngine(map);
    newEngine.presentation.setEffectsLevel(settings.effects);
    setEngine(newEngine);
    setScreen('game');
  }, [engine, settings.effects]);

  // Quick play starts immediately
  const handleQuickPlay = () => {
    const { status } = engine.getSnapshot();
    if (status === 'VICTORY' || status === 'GAME_OVER') {
      engine.restart();
    } else if (status === 'PAUSED') {
      engine.resume();
    }
    setScreen('game');
  };

  // Return to menu
  const handleReturnToMenu = () => {
    engine.pause();
    setScreen('menu');
  };

  // Handle score recording on game conclusion
  useEffect(() => {
    if (snapshot.status === 'VICTORY' && snapshot.result) {
      appController.handleVictory(snapshot.result);
    } else if (snapshot.status === 'GAME_OVER') {
      appController.handleGameOver(snapshot.score);
    }
  }, [snapshot.status, snapshot.result, snapshot.score]);

  // Initialize audio & effects settings
  useEffect(() => {
    globalAudio.updateSettings(settings);
    engine.presentation.setEffectsLevel(settings.effects);
  }, [settings, engine]);

  // Global UI Click Sound via event delegation
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      globalAudio.init();
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, [role="button"], input[type="radio"], input[type="checkbox"]')) {
        globalAudio.play('uiClick');
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  // Keyboard shortcut 'P' for Pause, 'Esc' to clear selection / close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (screen !== 'game') {
        if (e.key === 'Escape') {
          if (showAchievements) setShowAchievements(false);
          if (showSettings) handleCloseSettings();
          if (screen === 'mapSelect') setScreen('menu');
        }
        return;
      }

      if (e.key === 'p' || e.key === 'P') {
        engine.togglePause();
      } else if (e.key === 'Escape') {
        if (showSettings) {
          handleCloseSettings();
        } else {
          engine.clearSelection();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSettings, showAchievements, screen, wasPlayingBeforeSettings, engine]);

  // Auto-pause and suspend audio when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (screen === 'game' && engine.getSnapshot().status === 'PLAYING') {
          engine.pause();
        }
        globalAudio.suspend();
      } else {
        globalAudio.resume();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [engine, screen]);

  // Duck music when paused
  useEffect(() => {
    engine.presentation.audio.duckMusic(snapshot.status === 'PAUSED');
  }, [snapshot.status, engine]);

  // Toast notification
  useEffect(() => {
    if (!snapshot.notice) {
      setToast(null);
      return;
    }
    setToast(snapshot.notice.text);
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [snapshot.notice]);

  const playing = snapshot.status === 'PLAYING';
  const paused = snapshot.status === 'PAUSED';
  const sel = snapshot.selection;
  const { width, height } = engine.map;

  const isWarningActive = snapshot.banner?.kind === 'warning';

  const handleUpdateSettings = (newSettings: SettingsData) => {
    setSettings(newSettings);
    globalAudio.updateSettings(newSettings);
    engine.presentation.setEffectsLevel(newSettings.effects);
  };

  return (
    <div className="stage">
      <RotateOverlay
        isPlaying={playing && screen === 'game'}
        onPauseGame={() => {
          if (engine.getSnapshot().status === 'PLAYING') engine.pause();
        }}
      />

      <div className={`game-frame ${isWarningActive ? 'warning-active' : ''}`}>
        {screen === 'game' && <GameCanvas engine={engine} />}

        {screen === 'game' && (
          <>
            <HUD snapshot={snapshot} />

            {/* Performance Overlay (Toggled with F3 or ?debug=1) */}
            <PerfOverlay engine={engine} />

            {/* Fullscreen Button */}
            <FullscreenButton />

            {/* Settings Button */}
            <button
              type="button"
              onClick={handleOpenSettings}
              title="Settings"
              aria-label="Open Settings"
              style={{
                position: 'absolute',
                top: '12px',
                right: '64px',
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(26, 32, 44, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '18px',
                cursor: 'pointer',
                zIndex: 100,
              }}
            >
              ⚙
            </button>

            {snapshot.boss && <BossBar boss={snapshot.boss} />}

            {snapshot.banner && (
              <div
                className={`boss-banner banner-${snapshot.banner.kind}`}
                role="alert"
              >
                {snapshot.banner.text}
              </div>
            )}

            <GameControls
              status={snapshot.status}
              speed={snapshot.speed}
              onTogglePause={engine.togglePause}
              onSetSpeed={engine.setSpeed}
            />

            {snapshot.canChangeDifficulty && (
              <DifficultySelector
                currentDifficulty={snapshot.difficulty}
                onSelect={engine.setDifficulty}
              />
            )}

            {playing && (
              <WaveControl
                wavePhase={snapshot.wavePhase}
                waveRemaining={snapshot.waveRemaining}
                waveTotal={snapshot.waveTotal}
                onStartWave={engine.startWave}
              />
            )}

            {playing && sel?.kind === 'spot' && (
              <BuildMenu
                x={sel.x}
                y={sel.y}
                mapWidth={width}
                mapHeight={height}
                gold={snapshot.gold}
                onBuild={(typeId) => engine.buildTower(sel.spotId, typeId)}
              />
            )}

            {playing && sel?.kind === 'tower' && snapshot.selectedTower && (
              <TowerInfoPanel
                info={snapshot.selectedTower}
                x={sel.x}
                y={sel.y}
                mapWidth={width}
                mapHeight={height}
                gold={snapshot.gold}
                onTargetMode={engine.setTargetMode}
                onUpgrade={engine.upgradeTower}
                onSell={engine.sellTower}
                onClose={engine.clearSelection}
              />
            )}

            {toast && (
              <div className="toast" role="status">
                {toast}
              </div>
            )}

            {paused && (
              <PauseScreen
                onResume={engine.togglePause}
                onRestart={engine.restart}
                onMainMenu={handleReturnToMenu}
              />
            )}

            {snapshot.status === 'VICTORY' && snapshot.result && (
              <VictoryScreen
                result={snapshot.result}
                onRestart={engine.restart}
                onMainMenu={handleReturnToMenu}
              />
            )}

            {snapshot.status === 'GAME_OVER' && (
              <GameOverScreen
                escaped={snapshot.escaped}
                score={snapshot.score}
                difficulty={snapshot.difficulty}
                onRestart={engine.restart}
                onMainMenu={handleReturnToMenu}
              />
            )}
          </>
        )}

        {/* Phase 6 Navigation Menus */}
        {screen === 'menu' && (
          <MainMenu
            onStartGame={handleQuickPlay}
            onOpenMapSelect={() => setScreen('mapSelect')}
            onOpenAchievements={() => setShowAchievements(true)}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}

        {screen === 'mapSelect' && (
          <MapSelectScreen
            onSelectMap={handleSelectMap}
            onBack={() => setScreen('menu')}
          />
        )}

        {showAchievements && (
          <AchievementsModal onClose={() => setShowAchievements(false)} />
        )}

        {showSettings && (
          <SettingsScreen
            initialSettings={settings}
            onUpdateSettings={handleUpdateSettings}
            onClose={handleCloseSettings}
          />
        )}
      </div>
    </div>
  );
}
