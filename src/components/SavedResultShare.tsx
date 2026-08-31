import { useState } from 'react'
import { deliverShare, type ShareDeliveryStatus } from '../game/sharing'
import { useI18n } from '../i18n'

interface SavedResultShareProps {
  data: ShareData
}

export function SavedResultShare({ data }: SavedResultShareProps) {
  const { t } = useI18n()
  const [sharing, setSharing] = useState(false)
  const [status, setStatus] = useState<ShareDeliveryStatus | null>(null)

  async function handleShare() {
    setSharing(true)
    setStatus(null)
    setStatus(await deliverShare(data))
    setSharing(false)
  }

  return (
    <div className="share-result">
      <button
        className="share-result__button"
        type="button"
        onClick={handleShare}
        disabled={sharing}
      >
        <span>{sharing ? t('Opening share…') : t('Share your result')}</span>
        <span className="share-result__icon" aria-hidden="true">↗</span>
      </button>
      <span className="share-result__feedback" role="status" aria-live="polite">
        {status === 'shared' ? t('Shared.') : status === 'copied' ? t('Link copied.') : status === 'failed' ? t('Couldn’t share or copy the link. Copy it from your address bar.') : ''}
      </span>
    </div>
  )
}
