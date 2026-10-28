import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Mount our homepage inside the root div in index.html.
createRoot(document.getElementById('root')).render(<App />);
