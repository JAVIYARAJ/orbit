import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import './styles/global.css';
import './styles/landing.css';
import './styles/admin.css';

createRoot(document.getElementById('root')).render(<App />);
