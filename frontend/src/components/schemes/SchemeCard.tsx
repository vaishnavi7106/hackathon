import { Link } from 'react-router-dom'
import type { EligibleSchemeOut } from '@/types/api'
import { LevelBadge, EligibilityBadge } from '@/components/ui/Badge'
import { truncate } from '@/lib/utils'

interface SchemeCardProps {
  scheme: EligibleSchemeOut
  showEligibility?: boolean
  onCheckEligibility?: (scheme: EligibleSchemeOut) => void
}

export function SchemeCard({ scheme, showEligibility = false, onCheckEligibility }: SchemeCardProps) {
  return (
    <div className="card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug">{scheme.name_ta}</h3>
          {scheme.name_en && (
            <p className="text-gray-500 text-xs mt-0.5 truncate">{scheme.name_en}</p>
          )}
        </div>
        <LevelBadge level={scheme.level} />
      </div>

      {scheme.benefit_ta && (
        <p className="text-gray-700 text-xs leading-relaxed">
          {truncate(scheme.benefit_ta, 120)}
        </p>
      )}

      {showEligibility && (
        <div className="flex items-center gap-2">
          <EligibilityBadge
            isEligible={scheme.is_eligible}
            needsInfo={!scheme.is_eligible && scheme.missing_criteria.length > 0}
          />
          {!scheme.is_eligible && scheme.missing_criteria.length > 0 && (
            <span className="text-gray-500 text-xs truncate">
              {scheme.missing_criteria[0]}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Link
          to={`/schemes/${scheme.scheme_id}`}
          className="btn-secondary text-xs px-3 py-1.5"
        >
          விவரங்கள்
        </Link>
        {onCheckEligibility && (
          <button
            onClick={() => onCheckEligibility(scheme)}
            className="btn-ghost text-xs px-3 py-1.5"
          >
            தகுதி சரிபார்
          </button>
        )}
      </div>
    </div>
  )
}
