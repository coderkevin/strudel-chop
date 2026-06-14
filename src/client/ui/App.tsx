import { BeatGridPanel } from './BeatGridPanel';
import { ChopsPanel } from './ChopsPanel';
import { EditorToolbar } from './EditorToolbar';
import { SourceSidebar } from './SourceSidebar';
import { WaveformPanel } from './WaveformPanel';
import { useSourceEditor } from './useSourceEditor';

export function App() {
  const { actions, state } = useSourceEditor();

  return (
    <main className="app-shell">
      <SourceSidebar
        activeSourceId={state.detail?.id}
        sources={state.sources}
        onImport={actions.onImport}
        onOpenSource={actions.openSource}
      />

      <section className="workspace">
        <EditorToolbar
          duration={state.duration}
          isBusy={state.isBusy}
          sourceMetadata={state.sourceMetadata}
          onExport={actions.exportCurrent}
          onSave={actions.persist}
        />

        <WaveformPanel
          barBeat={state.barBeat}
          currentTime={state.currentTime}
          duration={state.duration}
          hasSource={Boolean(state.detail)}
          isPlaying={state.isPlaying}
          ticks={state.ticks}
          waveformRef={state.waveformRef}
          zoom={state.zoom}
          onSetZoom={actions.setZoom}
          onTogglePlayback={actions.togglePlayback}
        />

        <section className="editor-grid">
          <BeatGridPanel
            beatGrid={state.sourceMetadata?.beatGrid ?? []}
            hasSource={Boolean(state.detail)}
            onAddSection={actions.addSection}
            onSetDownbeat={actions.setDownbeat}
            onUpdateSection={actions.updateSection}
          />

          <ChopsPanel
            chops={state.sourceMetadata?.chops ?? []}
            hasSource={Boolean(state.detail)}
            loopSelected={state.loopSelected}
            selectedChop={state.selectedChop}
            selectedChopId={state.selectedChopId}
            onAddChop={actions.addChopFromPlayhead}
            onDeleteSelectedChop={actions.deleteSelectedChop}
            onMoveChop={actions.moveChop}
            onPlaySelectedChop={actions.playSelectedChop}
            onSelectChop={actions.setSelectedChopId}
            onSetLoopSelected={actions.setLoopSelected}
          />
        </section>

        <p className="status">{state.isBusy ? 'Working...' : state.status}</p>
      </section>
    </main>
  );
}
