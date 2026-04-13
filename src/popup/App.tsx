/** Connects the popup controller hook with the popup view so the root stays intentionally small. */
import { PopupView } from './PopupView'
import { usePopupApp } from './hooks/usePopupApp'
import './popup.css'

export function PopupApp() {
  const model = usePopupApp()

  return <PopupView model={model} />
}
