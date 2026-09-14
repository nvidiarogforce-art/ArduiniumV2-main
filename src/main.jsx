import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import BlockEditor from './editor/BlockEditor.jsx'
import './styles.css'

/**
 * The block canvas editor is a separate tool from the 3D workshop, so it is
 * mounted behind `?editor=1` rather than bolted into the main UI. That keeps
 * the default app — and the 14 UI assertions in tools/ui-test.mjs — exactly as
 * they were, while still shipping the editor in the same bundle.
 */
const useEditor = new URLSearchParams(window.location.search).has('editor')

createRoot(document.getElementById('root')).render(
  <React.StrictMode>{useEditor ? <BlockEditor /> : <App />}</React.StrictMode>,
)
