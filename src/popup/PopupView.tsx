/** Composes the popup from presentational sections while keeping the view separate from popup state orchestration. */
import type { PopupAppModel } from './hooks/usePopupApp'
import { PopupCaptureSection } from './components/PopupCaptureSection'
import { PopupCatalogImportSection } from './components/PopupCatalogImportSection'
import { PopupEmptyCaptureSection } from './components/PopupEmptyCaptureSection'
import { PopupHeader } from './components/PopupHeader'
import { PopupRecentSection } from './components/PopupRecentSection'

interface PopupViewProps {
  model: PopupAppModel
}

export function PopupView({ model }: PopupViewProps) {
  return (
    <div className="app-shell popup-shell">
      <div className="panel popup-card">
        <PopupHeader onOpenLibrary={model.actions.openLibrary} t={model.t} />

        {model.detection ? (
          <PopupCaptureSection
            availableLists={model.availableListOptions}
            busy={model.busy}
            captureInitials={model.captureInitials}
            captureProgressPercent={model.captureProgressPercent}
            currentListLabel={model.currentListLabel}
            detection={model.detection}
            detectionProgressLabel={model.detectionProgressLabel}
            fallbackCapturePoster={model.fallbackCapturePoster}
            favorite={model.favorite}
            matchedLibraryEntry={model.matchedLibraryEntry}
            message={model.message}
            onChangeProgress={model.actions.changeDetectionProgress}
            onOpenLibrary={model.actions.openLibrary}
            onOpenMatchedEntry={model.actions.openMatchedEntry}
            onSave={model.actions.save}
            onSelectList={model.actions.selectList}
            onSelectPoster={model.actions.selectPoster}
            onSelectSuggestedTitle={model.actions.selectSuggestedTitle}
            onToggleFavorite={model.actions.toggleFavorite}
            popupOtherTitles={model.popupOtherTitles}
            posterCandidates={model.posterCandidates}
            saveButtonLabel={model.saveButtonLabel}
            saveState={model.saveState}
            selectedList={model.selectedList}
            selectedPosterCandidateUrl={model.selectedPosterCandidateUrl}
            selectedUnofficialPoster={model.selectedUnofficialPoster}
            shouldShowUnofficialPosterUI={model.shouldShowUnofficialPosterUI}
            sourceHost={model.sourceHost}
            t={model.t}
            titleSuggestions={model.titleSuggestions}
          />
        ) : (
          <PopupEmptyCaptureSection
            analyzing={model.analyzing}
            debug={model.debug}
            message={model.message}
            onOpenLibrary={model.actions.openLibrary}
            onRetryAnalysis={model.actions.retryAnalysis}
            t={model.t}
            targetTabId={model.targetTabId}
          />
        )}

        <PopupCatalogImportSection
          availableLists={model.availableLists}
          buttonLabel={model.catalogImport.buttonLabel}
          canRun={model.catalogImport.canRun}
          completedTarget={model.catalogImport.completedTarget}
          count={model.catalogImport.count}
          duplicateList={model.catalogImport.duplicateList}
          hintMessage={model.catalogImport.hintMessage}
          isBusy={model.catalogImport.isBusy}
          isOlympusCatalogPage={model.catalogImport.isOlympusCatalogPage}
          mergeConfirmed={model.catalogImport.mergeConfirmed}
          needsNewListName={model.catalogImport.needsNewListName}
          newListLabel={model.catalogImport.newListLabel}
          onAction={model.actions.runCatalogImportAction}
          onChangeMergeConfirmed={model.actions.changeCatalogImportMergeConfirmed}
          onChangeNewListLabel={model.actions.changeCatalogImportNewListLabel}
          onChangeTarget={model.actions.changeCatalogImportTarget}
          onScanOlympus={model.actions.scanOlympusCatalog}
          previewItems={model.catalogImport.previewItems}
          progress={model.catalogImport.progress}
          scanBusy={model.catalogImport.scanBusy}
          snapshot={model.catalogImport.snapshot}
          statusMessage={model.catalogImport.statusMessage}
          t={model.t}
          target={model.catalogImport.target}
        />

        <PopupRecentSection
          activeSessionsLabel={model.activeSessionsLabel}
          entries={model.recentEntries}
          lists={model.availableLists}
          t={model.t}
        />
      </div>
    </div>
  )
}
