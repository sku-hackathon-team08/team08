import { DotFilterChip, type FilterKey } from './DotFilterChip'
import { SortToggle, type SortValue } from './SortToggle'

export type FilterCounts = Record<FilterKey, number>

type FilterBarProps = {
  counts: FilterCounts
  activeFilter: FilterKey
  onFilterChange?: (key: FilterKey) => void
  sort: SortValue
  onSortChange?: (value: SortValue) => void
  /** 02-X(불러오기 실패)처럼 데이터가 불확실할 때 전체 바를 흐리게 하고 정렬을 잠근다 */
  disabled?: boolean
  className?: string
}

const ORDER: FilterKey[] = ['all', 'urgent', 'caution', 'done', 'unconfirmed']

export function FilterBar({
  counts,
  activeFilter,
  onFilterChange,
  sort,
  onSortChange,
  disabled = false,
  className = '',
}: FilterBarProps) {
  return (
    <div className={['flex items-center gap-[10px] px-[27px] pb-[15px]', disabled ? 'opacity-45' : '', className].join(' ')}>
      <div className="flex flex-wrap gap-[10px]">
        {ORDER.map((key) => (
          <DotFilterChip
            key={key}
            status={key}
            count={counts[key]}
            active={activeFilter === key}
            onClick={disabled ? undefined : () => onFilterChange?.(key)}
          />
        ))}
      </div>
      <div className="ml-auto">
        <SortToggle value={sort} onChange={onSortChange} disabled={disabled} />
      </div>
    </div>
  )
}
