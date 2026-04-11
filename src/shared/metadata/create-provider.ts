import { SimpleMetadataMergePolicy } from '../../domains/metadata/merge-policy'
import { ResolverMetadataProvider } from '../../domains/metadata/provider-adapter'
import { MetadataResolver } from '../../domains/metadata/resolver'
import { MetadataSourceRegistry } from '../../domains/metadata/source-registry'
import { AniListMetadataSource } from '../../integrations/metadata/anilist/source'

export function createMetadataProvider() {
  const registry = new MetadataSourceRegistry([new AniListMetadataSource()])
  const resolver = new MetadataResolver(registry, new SimpleMetadataMergePolicy())

  return new ResolverMetadataProvider(resolver)
}
