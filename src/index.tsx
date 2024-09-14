// <reference types="src/global.d.ts" />
import { createRoot } from 'react-dom/client';
import Model from "./Model/Model";

import './style.css';

const root = createRoot(document.getElementById('right'));
root.render(<Model />);
