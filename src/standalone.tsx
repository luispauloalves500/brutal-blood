import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrutalBlood } from './components/game/BrutalBlood';
import { installPreviewHostBridge } from './lib/preview-host-bridge';
import './styles.css';
import { registerOfflineWorker } from './pwa';

function PreviewBridge() {
  useEffect(() => installPreviewHostBridge({
    navigate: (path) => {
      window.history.pushState({}, "", path);
    },
    getRoutePaths: () => ["/"],
  }), []);
  return null;
}

class GameBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main style={{padding:40,color:'#f4e8e6',background:'#09070b',minHeight:'100vh'}}>
      <h1>BRUTAL BLOOD</h1><p>Não foi possível abrir esta tela. Seu progresso local foi preservado.</p>
      <button onClick={() => location.reload()}>Tentar novamente</button>
    </main>;
    return this.props.children;
  }
}
createRoot(document.getElementById('root')!).render(
  <GameBoundary>
    <PreviewBridge />
    <BrutalBlood />
  </GameBoundary>,
);

void registerOfflineWorker();
