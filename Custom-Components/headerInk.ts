// MetroMatrix — "This control sits on the gradient page header."
// PageHeader provides it around its trailing actions, so an IconButton,
// CountIconButton, TextAction or Button placed there paints itself for the
// coloured ground (white glyphs, a white button) without the screen knowing
// which header its module wears.

import { createContext, useContext } from 'react';

export const OnGradientContext = createContext(false);

export const useOnGradient = () => useContext(OnGradientContext);
