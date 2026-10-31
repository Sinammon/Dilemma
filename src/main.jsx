import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './theme.css';
import './styles.css';
import './landing.css';
import './evidence.css';
import './homepage.css';
import './decision.css';

// Mount our homepage inside the root div in index.html.
createRoot(document.getElementById('root')).render(<App />);
