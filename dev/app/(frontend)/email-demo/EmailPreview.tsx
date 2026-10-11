'use client'

import { useEffect, useRef } from 'react'

export function EmailPreview({
  html,
  title,
  mobile,
}: {
  html: string
  title: string
  mobile: boolean
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    let contentObserver: ResizeObserver | undefined
    let animationFrame = 0

    const resize = () => {
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(() => {
        const document = frame.contentDocument
        if (!document?.body) return
        // Reset before measuring so shorter templates and wider layouts also shrink.
        frame.style.height = '0px'
        const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
        frame.style.height = `${Math.ceil(height) + 2}px`
      })
    }

    const observeContent = () => {
      contentObserver?.disconnect()
      const body = frame.contentDocument?.body
      if (!body) return
      contentObserver = new ResizeObserver(resize)
      contentObserver.observe(body)
      resize()
    }

    let previousWidth = -1
    const widthObserver = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width !== previousWidth) {
        previousWidth = entry.contentRect.width
        resize()
      }
    })
    widthObserver.observe(frame)
    frame.addEventListener('load', observeContent)
    observeContent()

    return () => {
      cancelAnimationFrame(animationFrame)
      contentObserver?.disconnect()
      widthObserver.disconnect()
      frame.removeEventListener('load', observeContent)
    }
  }, [html])

  return (
    <iframe
      ref={frameRef}
      title={title}
      // Parent access enables measurement; email scripts, forms and popups remain blocked.
      sandbox="allow-same-origin"
      referrerPolicy="no-referrer"
      srcDoc={html}
      className="mx-auto block w-full border-0"
      style={{ maxWidth: mobile ? 375 : 800 }}
    />
  )
}
