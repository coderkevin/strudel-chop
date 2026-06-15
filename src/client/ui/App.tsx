import { useState } from 'react';
import { BeatGridPanel } from './BeatGridPanel';
import { ChopsPanel } from './ChopsPanel';
import { EditorToolbar } from './EditorToolbar';
import { SettingsPanel } from './SettingsPanel';
import { SourceSidebar } from './SourceSidebar';
import { WaveformPanel } from './WaveformPanel';
import { useSourceEditor } from './useSourceEditor';

export function App() {
  const { actions, state } = useSourceEditor();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
          onToggleSettings={() => setIsSettingsOpen((current) => !current)}
        />

        {isSettingsOpen && (
          <SettingsPanel tapLatencyMs={state.tapLatencyMs} onSetTapLatencyMs={actions.setTapLatencyMs} />
        )}

        <WaveformPanel
          barBeat={state.barBeat}
          currentTime={state.currentTime}
          duration={state.duration}
          autoScrollPlayhead={state.autoScrollPlayhead}
          hasSource={Boolean(state.detail)}
          isPlaying={state.isPlaying}
          ticks={state.ticks}
          timelineScrollLeft={state.timelineScrollLeft}
          timelineWidth={state.timelineWidth}
          waveformRef={state.waveformRef}
          zoom={state.zoom}
          onSetAutoScrollPlayhead={actions.setAutoScrollPlayhead}
          onSetZoom={actions.setZoom}
          onTogglePlayback={actions.togglePlayback}
        />

        <BeatGridPanel
          beatGrid={state.sourceMetadata?.beatGrid ?? []}
          hasSource={Boolean(state.detail)}
          taps={state.taps}
          tapEstimatedBpm={state.tapEstimatedBpm}
          onAddSection={actions.addSection}
          onAddTap={actions.addBeatGridTap}
          onApplyTappedDownbeats={actions.applyTappedDownbeats}
          onClearTaps={actions.clearBeatGridTaps}
          onDeleteSection={actions.deleteSection}
          onSetFirstBeat={actions.setFirstBeat}
          onUpdateSection={actions.updateSection}
        />

        <section className="editor-grid">
          <ChopsPanel
            chops={state.sourceMetadata?.chops ?? []}
            hasSource={Boolean(state.detail)}
            isAuditioning={state.isAuditioningSelectedChop}
            loopSelected={state.loopSelected}
            selectedChop={state.selectedChop}
            selectedChopId={state.selectedChopId}
            onAddChop={actions.addChopFromPlayhead}
            onDeleteSelectedChop={actions.deleteSelectedChop}
            onMoveChop={actions.moveChop}
            onPlaySelectedChop={actions.playSelectedChop}
            onSelectChop={actions.setSelectedChopId}
            onSetLoopSelected={actions.setLoopSelected}
            onUpdateChopName={actions.updateChopName}
          />
        </section>

        <p className="status">{state.isBusy ? 'Working...' : state.status}</p>
      </section>
    </main>
  );
}
