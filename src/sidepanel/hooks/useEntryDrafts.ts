/** Stores editable entry drafts independently from the mutations that persist them. */
import { useState, type Dispatch, type SetStateAction } from 'react'
import type { EntryDraft } from '../types'

export function useEntryDrafts(): {
  drafts: Record<string, EntryDraft>
  setDrafts: Dispatch<SetStateAction<Record<string, EntryDraft>>>
} {
  const [drafts, setDrafts] = useState<Record<string, EntryDraft>>({})
  return { drafts, setDrafts }
}
