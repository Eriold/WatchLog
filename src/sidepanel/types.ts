import type { MediaType } from '../shared/types'

export type EntryDraft = {
  title: string
  mediaType: MediaType
  notes: string
  progressText: string
  progressValue: number | null
  listId: string
  favorite: boolean
}
