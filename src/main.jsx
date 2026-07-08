import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

const JSON_STORAGE_KEYS = [
  'admin_seasons',
  'admin_categories',
  'admin_positions',
  'catapult_matches',
  'schedule_events_v1',
  'gps_column_templates_v1',
]

for (const key of JSON_STORAGE_KEYS) {
  const value = localStorage.getItem(key)
  if (value) {
    try {
      JSON.parse(value)
    } catch {
      localStorage.removeItem(key)
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)