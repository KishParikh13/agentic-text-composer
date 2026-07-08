import { createRoot } from 'react-dom/client'
import { App, Landing } from './App'
import './styles.css'

const docId = location.pathname.startsWith('/doc/') ? location.pathname.split('/doc/')[1] : null

createRoot(document.getElementById('root')!).render(docId ? <App docId={docId} /> : <Landing />)
