import { describe, expect, it } from 'vitest'
import { SimpleMetadataMergePolicy } from '../src/domains/metadata/merge-policy'
import { MetadataResolver } from '../src/domains/metadata/resolver'
import { MetadataSourceRegistry } from '../src/domains/metadata/source-registry'
import type { MetadataSource } from '../src/domains/metadata/contracts'
import type { MetadataCard } from '../src/shared/types'
import { normalizeTitle } from '../src/shared/utils/normalize'

function createCard(
  id: string,
  title: string,
  mediaType: MetadataCard['mediaType'],
): MetadataCard {
  return {
    id,
    title,
    normalizedTitle: normalizeTitle(title),
    mediaType,
    genres: [],
    description: `${title} description`,
  }
}

class FakeSource implements MetadataSource {
  readonly id: string
  readonly label: string
  readonly domains
  readonly supportedMediaTypes
  readonly capabilities
  readonly priority: number

  private readonly searchItems: MetadataCard[]
  private readonly normalizedMatch?: MetadataCard
  private readonly itemById?: MetadataCard

  constructor(params: {
    id: string
    priority: number
    mediaTypes: MetadataCard['mediaType'][]
    searchItems?: MetadataCard[]
    normalizedMatch?: MetadataCard
    itemById?: MetadataCard
  }) {
    this.id = params.id
    this.label = params.id
    this.domains = ['general'] as const
    this.supportedMediaTypes = params.mediaTypes
    this.capabilities = ['search', 'lookup-by-id', 'lookup-by-normalized-title'] as const
    this.priority = params.priority
    this.searchItems = params.searchItems ?? []
    this.normalizedMatch = params.normalizedMatch
    this.itemById = params.itemById
  }

  async search() {
    return this.searchItems
  }

  async findByNormalizedTitle() {
    return this.normalizedMatch
  }

  async getById() {
    return this.itemById
  }
}

describe('MetadataResolver', () => {
  it('merges search results from multiple sources and dedupes them', async () => {
    const duplicate = createCard('shared:1', 'One Piece', 'anime')
    const resolver = new MetadataResolver(
      new MetadataSourceRegistry([
        new FakeSource({
          id: 'source-a',
          priority: 20,
          mediaTypes: ['anime'],
          searchItems: [duplicate, createCard('a:2', 'Naruto', 'anime')],
        }),
        new FakeSource({
          id: 'source-b',
          priority: 10,
          mediaTypes: ['anime'],
          searchItems: [duplicate, createCard('b:3', 'Bleach', 'anime')],
        }),
      ]),
      new SimpleMetadataMergePolicy(),
    )

    const items = await resolver.search({
      query: 'one piece',
      preferredMediaTypes: ['anime'],
    })

    expect(items.map((item) => item.id)).toEqual(['shared:1', 'b:3', 'a:2'])
  })

  it('picks the best normalized-title match compatible with requested media type', async () => {
    const resolver = new MetadataResolver(
      new MetadataSourceRegistry([
        new FakeSource({
          id: 'movies-db',
          priority: 20,
          mediaTypes: ['movie'],
          normalizedMatch: createCard('movie:1', 'One Piece', 'movie'),
        }),
        new FakeSource({
          id: 'anime-db',
          priority: 10,
          mediaTypes: ['anime'],
          normalizedMatch: createCard('anime:1', 'One Piece', 'anime'),
        }),
      ]),
      new SimpleMetadataMergePolicy(),
    )

    const item = await resolver.findByNormalizedTitle({
      normalizedTitle: normalizeTitle('One Piece'),
      preferredMediaTypes: ['anime'],
    })

    expect(item?.id).toBe('anime:1')
    expect(item?.mediaType).toBe('anime')
  })

  it('routes direct id lookups to the matching source when the id is namespaced', async () => {
    const resolver = new MetadataResolver(
      new MetadataSourceRegistry([
        new FakeSource({
          id: 'anilist',
          priority: 10,
          mediaTypes: ['anime'],
          itemById: createCard('anilist:21', 'One Piece', 'anime'),
        }),
      ]),
      new SimpleMetadataMergePolicy(),
    )

    const item = await resolver.getById({ id: 'anilist:21' })

    expect(item?.title).toBe('One Piece')
  })
})
