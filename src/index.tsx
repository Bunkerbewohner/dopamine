import { createRoot } from 'react-dom/client';
import * as React from 'react';

function Model() {
    return <div>
        (Model)
    </div>
}

const root = createRoot(document.getElementById('right'));
root.render(<Model />);
