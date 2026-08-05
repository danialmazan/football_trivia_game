import type { SearchPlayer } from './types'
import type { LineupDataset } from './lineupTypes'

export async function loadLineupDataset(): Promise<{
  dataset: LineupDataset
  search: SearchPlayer[]
}> {
  const [datasetModule, searchModule] = await Promise.all([
    import('./lineupMatches.json'),
    import('./lineupSearch.json'),
  ])
  return {
    dataset: datasetModule.default as LineupDataset,
    search: searchModule.default as SearchPlayer[],
  }
}
