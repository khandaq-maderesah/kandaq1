'use client'

import { useEffect } from 'react'

/** True for a form control or editable area, where the browser's own text behaviour must stay. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], .select-text'))
}

/**
 * Makes the installed app behave like a native app instead of a web page.
 *
 * Together with the rules in globals.css (no text selection on the interface,
 * no tap highlight, no page bounce): a long press no longer opens the browser
 * context menu ("Open in new tab", "Copy link", the text-selection toolbar
 * with its web search), and a double tap no longer zooms. Typing fields keep
 * every normal behaviour, so copying a phone number from a field still works.
 */
export function NativeFeel() {
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (!isEditable(e.target)) e.preventDefault()
    }
    const onSelectStart = (e: Event) => {
      if (!isEditable(e.target)) e.preventDefault()
    }
    document.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('selectstart', onSelectStart)
    return () => {
      document.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('selectstart', onSelectStart)
    }
  }, [])
  return null
}
