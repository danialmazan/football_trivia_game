import { useState } from 'react'
import { deliverShare } from '../game/sharing'

interface SavedResultShareProps {
  data: ShareData
}

const FEEDBACK = {
  shared: 'Shared.',
  copied: 'Link copied.',
  cancelled: '',
  failed: 'Couldn’t share or copy the link. Copy it from your address bar.',
} as const

export function SavedResultShare({ data }: SavedResultShareProps) {
  const [sharing, setSharing] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function handleShare() {
    setSharing(true)
    setFeedback('')
    const status = await deliverShare(data)
    setFeedback(FEEDBACK[status])
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
        <span>{sharing ? 'Opening share…' : 'Share your result'}</span>
        <span className="share-result__icon" aria-hidden="true">↗</span>
      </button>
      <span className="share-result__feedback" role="status" aria-live="polite">
        {feedback}
      </span>
    </div>
  )
}
