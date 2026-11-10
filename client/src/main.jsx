import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { detectMode } from './lib/mode.js';
import { startSync } from './lib/sync.js';
detectMode().then(() => { startSync(); return createRoot(document.getElementById('root')).render(<BrowserRouter><App /></BrowserRouter>); });
